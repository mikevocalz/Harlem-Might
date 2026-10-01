#!/usr/bin/env python3
"""Bake a deterministic MCP runtime head from Google's XR Blocks GNM v3 container.

This path intentionally consumes Google's already-quantized browser GNM payload
instead of installing TensorFlow/JAX/PyTorch. It reconstructs a deterministic
identity directly from the published GNM identity basis and writes a compact GLB.

Source payload:
  https://github.com/xrblocks/assets-gnm
The payload is produced from:
  https://github.com/google/GNM
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import trimesh


DTYPE_MAP = {
    "float32": np.dtype("<f4"),
    "int8": np.dtype("i1"),
    "uint8": np.dtype("u1"),
    "uint16": np.dtype("<u2"),
    "int32": np.dtype("<i4"),
}

MATERIAL_NAMES = (
    "skin",
    "teeth",
    "gums",
    "tongue",
    "scleras",
    "irises",
    "pupils",
)


def read_gnmw(path: Path) -> tuple[dict, dict[str, np.ndarray]]:
    raw = path.read_bytes()
    if raw[:4] != b"GNMW":
        raise ValueError("Not a GNMW container")
    version, header_length = struct.unpack_from("<II", raw, 4)
    if version != 1:
        raise ValueError(f"Unsupported GNMW version {version}")

    header_start = 12
    header_end = header_start + header_length
    header = json.loads(raw[header_start:header_end].decode("utf-8").strip())
    base = header_end

    sections: dict[str, np.ndarray] = {}
    for section in header["sections"]:
        dtype = DTYPE_MAP[section["dtype"]]
        shape = tuple(section["shape"])
        offset = base + int(section["offset"])
        count = int(np.prod(shape))
        arr = np.frombuffer(raw, dtype=dtype, count=count, offset=offset)
        sections[section["name"]] = arr.reshape(shape)
    return header["meta"], sections


def pbr(
    base_color: tuple[int, int, int, int],
    *,
    metallic: float,
    roughness: float,
    emissive: tuple[int, int, int] | None = None,
) -> trimesh.visual.material.PBRMaterial:
    return trimesh.visual.material.PBRMaterial(
        baseColorFactor=base_color,
        metallicFactor=metallic,
        roughnessFactor=roughness,
        emissiveFactor=emissive,
    )


def add_geometry(
    scene: trimesh.Scene,
    *,
    vertices: np.ndarray,
    faces: np.ndarray,
    name: str,
    material: trimesh.visual.material.PBRMaterial,
) -> None:
    if len(faces) == 0:
        return
    mesh = trimesh.Trimesh(
        vertices=vertices,
        faces=faces,
        process=False,
        validate=False,
    )
    mesh.metadata["gnm_component"] = name
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    scene.add_geometry(mesh, node_name=name, geom_name=name)


def bake(
    source: Path,
    output: Path,
    *,
    seed: int,
    identity_spread: float,
    target_height_meters: float,
) -> Path:
    meta, sections = read_gnmw(source)

    template = np.asarray(sections["template"], dtype=np.float32)
    triangles = np.asarray(sections["triangles"], dtype=np.int64)
    material_id = np.asarray(sections["material_id"], dtype=np.uint8)

    identity_q = np.asarray(sections["identity_basis"], dtype=np.int8)
    identity_scales = np.asarray(sections["identity_scales"], dtype=np.float32)

    identity_dim = int(meta["identityDim"])
    if identity_q.shape[0] != identity_dim:
        raise ValueError(
            f"Identity basis mismatch: {identity_q.shape[0]} != {identity_dim}"
        )

    rng = np.random.default_rng(seed)
    coefficients = np.clip(
        rng.normal(0.0, identity_spread, size=identity_dim),
        -0.8,
        0.8,
    ).astype(np.float32)

    displacement = (
        (coefficients * identity_scales) @ identity_q.astype(np.float32)
    ).reshape(template.shape)
    vertices = template + displacement

    bounds_min = vertices.min(axis=0)
    bounds_max = vertices.max(axis=0)
    center = (bounds_min + bounds_max) * 0.5
    source_height = float(bounds_max[1] - bounds_min[1])
    if source_height <= 1e-8:
        source_height = float(np.max(bounds_max - bounds_min))
    scale = target_height_meters / max(source_height, 1e-8)
    vertices = (vertices - center) * scale

    # XR Blocks classifies each vertex by GNM material. Its renderer classifies
    # each triangle by the first source vertex as well, so we mirror that here.
    triangle_material = material_id[triangles[:, 0]]

    scene = trimesh.Scene()

    chrome = pbr(
        (5, 6, 9, 255),
        metallic=0.96,
        roughness=0.14,
        emissive=(12, 1, 1),
    )
    dark_glass = pbr(
        (18, 4, 4, 230),
        metallic=0.62,
        roughness=0.08,
        emissive=(36, 2, 2),
    )
    hot_red = pbr(
        (255, 38, 22, 255),
        metallic=0.52,
        roughness=0.12,
        emissive=(255, 32, 12),
    )
    pale = pbr(
        (216, 220, 224, 255),
        metallic=0.58,
        roughness=0.2,
        emissive=(34, 7, 5),
    )

    add_geometry(
        scene,
        vertices=vertices,
        faces=triangles[triangle_material == 0],
        name="MCP_GNM_skin",
        material=chrome,
    )

    # Teeth/gums/tongue become pale/dark internal machine structure.
    add_geometry(
        scene,
        vertices=vertices,
        faces=triangles[np.isin(triangle_material, [1, 2, 3])],
        name="MCP_GNM_internal_structure",
        material=pale,
    )

    # Sclera shell stays dark; irises/pupils become the red MCP optics.
    add_geometry(
        scene,
        vertices=vertices,
        faces=triangles[triangle_material == 4],
        name="MCP_GNM_eye_shell",
        material=dark_glass,
    )
    add_geometry(
        scene,
        vertices=vertices,
        faces=triangles[np.isin(triangle_material, [5, 6])],
        name="MCP_GNM_eye_interiors",
        material=hot_red,
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    exported = scene.export(file_type="glb")
    if not isinstance(exported, (bytes, bytearray)):
        raise RuntimeError("trimesh did not return binary GLB data")
    output.write_bytes(exported)

    source_sha256 = hashlib.sha256(source.read_bytes()).hexdigest()
    output_sha256 = hashlib.sha256(output.read_bytes()).hexdigest()
    provenance = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_model": meta.get("model", "GNM Head"),
        "source_gnm_version": meta.get("gnmVersion"),
        "source_variant": meta.get("variant"),
        "source_repository": "https://github.com/google/GNM",
        "source_web_container_repository": "https://github.com/xrblocks/assets-gnm",
        "source_license": "Apache-2.0",
        "source_sha256": source_sha256,
        "output_sha256": output_sha256,
        "identity_seed": seed,
        "identity_spread": identity_spread,
        "target_height_meters": target_height_meters,
        "num_vertices": int(template.shape[0]),
        "num_triangles": int(triangles.shape[0]),
        "materials": list(MATERIAL_NAMES),
        "output": output.name,
    }
    output.with_suffix(".provenance.json").write_text(
        json.dumps(provenance, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "output": str(output),
                "bytes": output.stat().st_size,
                "sha256": output_sha256,
                "vertices": int(template.shape[0]),
                "triangles": int(triangles.shape[0]),
            },
            indent=2,
        )
    )
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=1982)
    parser.add_argument("--identity-spread", type=float, default=0.18)
    parser.add_argument("--target-height-meters", type=float, default=0.255)
    args = parser.parse_args()

    bake(
        args.source,
        args.output,
        seed=args.seed,
        identity_spread=max(0.0, min(args.identity_spread, 0.8)),
        target_height_meters=max(0.05, min(args.target_height_meters, 1.0)),
    )


if __name__ == "__main__":
    main()
