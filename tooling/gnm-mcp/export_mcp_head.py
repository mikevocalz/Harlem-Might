#!/usr/bin/env python3
"""Export a deterministic Google GNM Head as a runtime GLB for the MCP.

GNM stays an offline authoring dependency. The Expo/Viro/Three runtimes consume
only the resulting GLB, so none of GNM's Python/framework dependencies ship in
the game.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import trimesh
from gnm.shape import gnm_numpy


SOURCE_REPOSITORY = "https://github.com/google/GNM"
SOURCE_LICENSE = "Apache-2.0"
SOURCE_MODEL = "GNM Head v3"


def group_faces(gnm: gnm_numpy.GNM, group: str) -> np.ndarray | None:
    try:
        faces = np.asarray(gnm.triangles_group(group), dtype=np.int64)
    except (KeyError, ValueError):
        return None
    return faces if len(faces) else None


def pbr(
    *,
    base: tuple[int, int, int, int],
    metallic: float,
    roughness: float,
    emissive: tuple[int, int, int] | None = None,
) -> trimesh.visual.material.PBRMaterial:
    return trimesh.visual.material.PBRMaterial(
        baseColorFactor=base,
        metallicFactor=metallic,
        roughnessFactor=roughness,
        emissiveFactor=emissive,
    )


def add_part(
    scene: trimesh.Scene,
    *,
    vertices: np.ndarray,
    faces: np.ndarray | None,
    name: str,
    material: trimesh.visual.material.PBRMaterial,
) -> None:
    if faces is None or len(faces) == 0:
        return
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.metadata["gnm_component"] = name
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    scene.add_geometry(mesh, node_name=name, geom_name=name)


def export_head(
    output: Path,
    *,
    seed: int,
    identity_spread: float,
    target_height_meters: float,
) -> Path:
    gnm = gnm_numpy.GNM.from_remote(
        version=gnm_numpy.GNMMajorVersion.V3,
        variant=gnm_numpy.GNMVariant.HEAD,
    )

    rng = np.random.default_rng(seed)
    identity = np.clip(
        rng.normal(0.0, identity_spread, size=gnm.identity_dim),
        -0.8,
        0.8,
    )
    expression = np.zeros(gnm.expression_dim)
    rotations = np.zeros((gnm.num_joints, 3))
    translation = np.zeros(3)

    raw_vertices = np.asarray(
        gnm(
            identity=identity,
            expression=expression,
            rotations=rotations,
            translation=translation,
        ),
        dtype=np.float64,
    )

    bounds_min = raw_vertices.min(axis=0)
    bounds_max = raw_vertices.max(axis=0)
    center = (bounds_min + bounds_max) * 0.5
    source_height = float(bounds_max[1] - bounds_min[1])
    if source_height <= 1e-8:
        source_height = float(np.max(bounds_max - bounds_min))
    scale = target_height_meters / max(source_height, 1e-8)
    vertices = (raw_vertices - center) * scale

    scene = trimesh.Scene()
    chrome = pbr(
        base=(5, 6, 9, 255),
        metallic=0.96,
        roughness=0.13,
        emissive=(14, 1, 1),
    )
    red = pbr(
        base=(255, 43, 28, 255),
        metallic=0.48,
        roughness=0.15,
        emissive=(255, 30, 14),
    )
    glass = pbr(
        base=(32, 4, 3, 180),
        metallic=0.38,
        roughness=0.08,
        emissive=(72, 5, 3),
    )

    skin_faces = group_faces(gnm, "skin")
    if skin_faces is None:
        skin_faces = np.asarray(gnm.triangles, dtype=np.int64)

    add_part(
        scene,
        vertices=vertices,
        faces=skin_faces,
        name="MCP_GNM_skin",
        material=chrome,
    )
    add_part(
        scene,
        vertices=vertices,
        faces=group_faces(gnm, "eye_interiors"),
        name="MCP_GNM_eye_interiors",
        material=red,
    )
    add_part(
        scene,
        vertices=vertices,
        faces=group_faces(gnm, "eye_exteriors"),
        name="MCP_GNM_eye_exteriors",
        material=glass,
    )

    scene.metadata.update(
        {
            "source_repository": SOURCE_REPOSITORY,
            "source_license": SOURCE_LICENSE,
            "source_model": SOURCE_MODEL,
            "identity_seed": seed,
            "identity_spread": identity_spread,
            "target_height_meters": target_height_meters,
        }
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    glb = scene.export(file_type="glb")
    if not isinstance(glb, (bytes, bytearray)):
        raise RuntimeError("trimesh did not produce binary GLB bytes")
    output.write_bytes(glb)

    provenance = output.with_suffix(".provenance.json")
    provenance.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "source_repository": SOURCE_REPOSITORY,
                "source_license": SOURCE_LICENSE,
                "source_model": SOURCE_MODEL,
                "identity_seed": seed,
                "identity_spread": identity_spread,
                "target_height_meters": target_height_meters,
                "output": output.name,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return output


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate the black-chrome/red MCP head from Google GNM Head."
    )
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=1982)
    parser.add_argument("--identity-spread", type=float, default=0.18)
    parser.add_argument("--target-height-meters", type=float, default=0.255)
    args = parser.parse_args()

    result = export_head(
        args.output,
        seed=args.seed,
        identity_spread=max(0.0, min(args.identity_spread, 0.8)),
        target_height_meters=max(0.05, min(args.target_height_meters, 1.0)),
    )
    print(result)


if __name__ == "__main__":
    main()
