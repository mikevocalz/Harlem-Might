# GNM MCP Head Pipeline

The Master Control Program head is authored from Google's **GNM Head v3**
and then exported to an ordinary GLB. GNM is intentionally an offline authoring
dependency; it is not bundled into Expo, Viro, Three.js, Quest, Pico, or web.

Source: <https://github.com/google/GNM>  
GNM package license: Apache-2.0

## Why this split

The runtime needs a lightweight deterministic character, not NumPy/JAX/PyTorch/
TensorFlow. The game consumes a GLB while the futuristic MCP shell (halo rings,
data spines, red emissive core, scan/pulse behavior) is renderer-owned and driven
by the authoritative Light Cycle match state.

If the GLB is missing or fails to load, both Viro and Three.js keep a procedural
black-chrome/red MCP online instead of breaking the race.

## Generate the head

GNM currently targets Python 3.13. One reproducible setup is:

```bash
git clone https://github.com/google/GNM .cache/google-gnm
python3.13 -m venv .cache/gnm-venv
source .cache/gnm-venv/bin/activate
pip install -e .cache/google-gnm/gnm/shape
pip install trimesh

python tooling/gnm-mcp/export_mcp_head.py \
  --output apps/web/public/assets/mcp/mcp-gnm-head.glb \
  --seed 1982
```

GNM downloads its model weights on first use and caches them using its own model
cache. The exporter also writes a matching `.provenance.json` sidecar.

The exporter does **not** select a demographic semantic class. It makes a
deterministic synthetic identity from low-amplitude GNM identity coefficients,
keeping the MCP a fictional program rather than modeling a particular person.

## Runtime URLs

Point both runtimes at the same generated artifact:

```dotenv
NEXT_PUBLIC_MCP_GNM_GLB_URL=/assets/mcp/mcp-gnm-head.glb
EXPO_PUBLIC_MCP_GNM_GLB_URL=https://your-host/assets/mcp/mcp-gnm-head.glb
```

For a native bundled asset, the Viro presence can also be changed to a local
`require(...)`, but the shared hosted URL keeps web/native parity simple.

## Runtime contract

- MCP never owns race state.
- MCP never advances simulation ticks.
- MCP derives presentation from `LightCycleMatchState`.
- Co-located peers derive reactions from replicated authoritative snapshots.
- Derezzing, collision cause, round result, match result, boost state, and low
  energy all have deterministic MCP presentation states.
- No React `useState` is introduced; existing stores remain Zustand-based.
