#!/usr/bin/env python3
"""Bake the MCP voice bank with VoxCPM2, the commercial-ready engine VoiceStudio
recommends for natural-language voice design and controllable cloning.

The first line designs one stable synthetic identity. Remaining lines clone that
anchor timbre while steering delivery per event. A restrained Grid processor
adds subharmonic weight and a short synthetic chamber without imitating a real
performer.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import soundfile as sf
from voxcpm import VoxCPM

SEED = 1982
MODEL = "openbmb/VoxCPM2"
VOICE = (
    "A very deep mature male baritone; resonant chest voice; controlled, "
    "authoritarian synthetic intelligence; slow deliberate pacing; cold calm "
    "menace; precise diction; subtle machine-like detachment; cinematic "
    "science-fiction control-room presence; never shout; no celebrity imitation"
)

CUES = {
    "race-start": (
        "calm, absolute authority, ceremonial",
        "Programs. The Grid is live. Power cycles are stable. Begin.",
    ),
    "boost": (
        "quietly intrigued, controlled",
        "Velocity anomaly detected. Interesting.",
    ),
    "low-energy": (
        "dry, amused threat, unhurried",
        "Want me to slow down your power cycles for you?",
    ),
    "derez-local": (
        "cold, final, no sympathy",
        "Program derezzed. The Grid remembers every mistake.",
    ),
    "derez-rival": (
        "satisfied but restrained",
        "Rival process terminated. Continue.",
    ),
    "round-result": (
        "formal adjudicator, controlled",
        "Round adjudicated. Return to your marks.",
    ),
    "end-of-line": (
        "very slow, final, ominous, allow the last word to resonate",
        "End of line.",
    ),
}


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def process_grid_voice(raw: Path, out: Path) -> None:
    """Create a dark machine-resonance mix while keeping speech intelligible."""
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is required for MCP voice mastering")

    # main: mild low-pass/high-pass cleanup + controlled compression
    # sub: pitch-like downward coloration by rate shift + tempo recovery,
    #      low-passed and quiet so it reads as machine resonance, not doubling
    # echo: two short reflections, deliberately subtle
    filt = (
        "[0:a]highpass=f=55,lowpass=f=11500,"
        "acompressor=threshold=-18dB:ratio=2.2:attack=8:release=120[main];"
        "[0:a]asetrate=43200,aresample=48000,atempo=1.111111,"
        "lowpass=f=950,volume=0.16[sub];"
        "[main][sub]amix=inputs=2:normalize=0,"
        "aecho=0.82:0.34:42|96:0.10|0.045,"
        "loudnorm=I=-17:TP=-1.5:LRA=7[out]"
    )
    run(
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(raw),
        "-filter_complex",
        filt,
        "-map",
        "[out]",
        "-ar",
        "48000",
        "-ac",
        "1",
        str(out),
    )


def main() -> None:
    out_dir = Path("packages/spatial/assets/mcp/voice")
    web_dir = Path("apps/web/public/assets/mcp/voice")
    raw_dir = Path(".cache/mcp-voice")
    out_dir.mkdir(parents=True, exist_ok=True)
    web_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    print("Loading VoxCPM2 on CPU...", flush=True)
    model = VoxCPM.from_pretrained(
        MODEL,
        load_denoiser=False,
        optimize=False,
        device="cpu",
    )
    sample_rate = model.tts_model.sample_rate

    anchor_name = "race-start"
    anchor_style, anchor_text = CUES[anchor_name]
    anchor_raw = raw_dir / f"{anchor_name}.raw.wav"

    print("Designing stable MCP identity...", flush=True)
    anchor = model.generate(
        text=f"({VOICE}; {anchor_style}){anchor_text}",
        cfg_value=2.0,
        inference_timesteps=8,
        seed=SEED,
    )
    sf.write(anchor_raw, anchor, sample_rate)

    manifest = {
        "engine": "VoxCPM2",
        "engine_repository": "https://github.com/OpenBMB/VoxCPM",
        "engine_license": "Apache-2.0",
        "source_strategy": "VoiceStudio-compatible VoxCPM2 voice design + controllable cloning",
        "identity_seed": SEED,
        "voice_description": VOICE,
        "sample_rate": 48000,
        "clips": {},
    }

    for index, (name, (style, text)) in enumerate(CUES.items()):
        raw = raw_dir / f"{name}.raw.wav"
        if name != anchor_name:
            print(f"Rendering {name}...", flush=True)
            wav = model.generate(
                text=f"({style}){text}",
                reference_wav_path=str(anchor_raw),
                cfg_value=2.0,
                inference_timesteps=8,
                seed=SEED + index,
            )
            sf.write(raw, wav, sample_rate)

        mastered = out_dir / f"{name}.wav"
        process_grid_voice(raw, mastered)
        shutil.copy2(mastered, web_dir / mastered.name)
        manifest["clips"][name] = {
            "file": mastered.name,
            "text": text,
            "style": style,
        }

    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    shutil.copy2(out_dir / "manifest.json", web_dir / "manifest.json")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
