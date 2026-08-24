# MiniMax H3 Mission promo pipeline

> Production gate: `storyboard.zh-CN.json` is a rejected 121-second draft retained as evidence. It is blocked from voice, animatic, H3 scene, and final composition commands. The current pre-production source is `creative-brief-v2.zh-CN.md`; rewrite and explicitly approve the storyboard before generating film media.

This directory produces the Chinese OpenCorvus long-horizon Mission case film from one frozen storyboard. It keeps generated imagery and product evidence separate:

- MiniMax H3 is used only for the abstract opening and closing B-roll. The explanatory body is deterministic motion design so the causal story stays legible and reproducible.
- OpenCorvus, training, inference, charts, paper, and publication visuals are real screenshots or retained Mission artifacts.
- Generation runs on the local RTX 5090; no MiniMax API key is required.
- Every run writes a resource and result manifest; the final composer refuses missing H3 clips.

## Why the single-5090 quantized path

The production host has one RTX 5090 (32 GB VRAM) and 64 GB system RAM. The full BF16 H3 components do not fit, so this pipeline uses the community-qualified ComfyUI path: a pruned INT8 ConvRot FL2VA diffusion model, NVFP4 AWQ Qwen3-VL text encoder, the two H3 VAEs, and ComfyUI DynamicVRAM. The four model files total about 39.6 GiB and retain native video plus stereo-audio generation. The installation manifest labels these as third-party quantized/repackaged weights rather than implying an official full-precision run.

Install into the isolated demo directory:

```powershell
.\script\video\minimax-h3-mission-promo\install-local-h3.ps1
```

Then run the automated single-card smoke test. It starts only the isolated local ComfyUI service on port 8188, submits a flat API workflow, and records VRAM/RAM/temperature samples:

```powershell
$python = 'C:\Users\hengu\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $python .\script\video\minimax-h3-mission-promo\generate-local-h3.py --scene smoke --width 608 --height 352 --duration 3 --steps 10
```

## Run

Use the bundled Codex Python or any Python 3.11+ with Pillow, plus FFmpeg and FFprobe on `PATH`.

```powershell
$python = 'C:\Users\hengu\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$out = 'D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824'

& $python .\script\video\minimax-h3-mission-promo\produce.py prepare --output $out
& $python .\script\video\minimax-h3-mission-promo\produce.py animatic --output $out
& $python .\script\video\minimax-h3-mission-promo\produce.py inspect --output $out
```

The animatic is intentionally honest: abstract H3 slots are rendered as branded motion-design placeholders, while all real product and deliverable shots are final-quality compositions.

After the smoke test passes and the V2 creative direction is approved, rewrite the storyboard with official H3 prompt fields. Only then generate the declared film shots:

```powershell
& $python .\script\video\minimax-h3-mission-promo\generate-local-h3.py --scene hook --width 864 --height 480 --duration 5 --steps 10
& $python .\script\video\minimax-h3-mission-promo\generate-local-h3.py --scene cta --width 864 --height 480 --duration 5 --steps 10
& $python .\script\video\minimax-h3-mission-promo\produce.py compose --output $out
& $python .\script\video\minimax-h3-mission-promo\produce.py inspect --output $out --final
```

## Outputs

- `draft/opencorvus-long-mission-animatic.mp4`
- `final/opencorvus-long-mission-h3.mp4`
- `frames/contact-sheet.jpg` and per-scene checkpoints
- `reports/media-check.json`, `reports/frame-check.json`, and `reports/generation-manifest.json`

`compose` fails if any declared H3 scene is missing. It never substitutes a placeholder into a file named as the final H3 film. The final 1080p canvas is a local editorial upscale of the generated B-roll plus native-resolution product evidence; it is not marketed as H3 native 2K.
