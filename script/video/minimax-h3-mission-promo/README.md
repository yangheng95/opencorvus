# MiniMax H3 Mission promo pipeline

> Current planning direction: paper-collage science explainer V6, paused at Skill Gate 1 in `specs/records/2026-08/2026-08-24-paper-collage-explainer-v6.md`. No V6 still or video may be generated before approval. Desktop V5 remains a complete local candidate and is not overwritten. V4 character animation is paused; `storyboard.zh-CN.json`, character cards and H3 clips remain historical or alternate-direction evidence only.

The current machine-readable source is `desktop-storyboard-v5.zh-CN.json`; `desktop-script-v5.zh-CN.md` records how two independent drafts were synthesized. The story remains: user pain → context failure → multi-Agent fragmentation → persistent Mission → scheduling/resume/Artifact/review → expert-squad self-evolution and open source → short DeBERTa proof → personal long workflows.

```powershell
python -m pip install -r .\script\video\minimax-h3-mission-promo\requirements.txt
python .\script\video\minimax-h3-mission-promo\produce-desktop-v5.py compose
python .\script\video\minimax-h3-mission-promo\produce-desktop-v5.py inspect
```

Default output: `D:\myhexin-local\demos\opencorvus-desktop-promo-v5-20260824`. The final is 218 seconds, 1920×1080, H.264/AAC. H3 is intentionally not used in V5 because exact Desktop UI, code, metrics, logos, and repository addresses must remain deterministic.

Each scene and voice cache filename includes a build digest over the storyboard, renderer, official Logo, and retained evidence. A changed input therefore cannot silently reuse a stale scene. `inspect` samples every scene at start/middle/end plus the D11 confirmation and four D12 evidence events, writes 47 full-resolution frames and a contact sheet, and reports only structural checks as automated; text clipping and evidence semantics still require human visual review.

## Historical H3 character path

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

For character-consistent production, derive a story keyframe from the frozen
character bible and run the H3 image-to-video workflow:

```powershell
& $python .\script\video\minimax-h3-mission-promo\generate-local-h3.py `
  --scene user-pain-character-v2 `
  --reference-image .\script\video\minimax-h3-mission-promo\assets\character-story\user-pain-keyframe-v1.png `
  --width 608 --height 352 --duration 4 --steps 10
```

`--reference-image` uploads the frozen frame to the isolated local ComfyUI
input directory and selects the official H3 I2V API workflow. Standalone T2V
clips are exploratory only and are not valid character-story production shots.

## Historical H3 run

Use the bundled Codex Python or any Python 3.11+ with Pillow, plus FFmpeg and FFprobe on `PATH`.

```powershell
$python = 'C:\Users\hengu\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$out = 'D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824'

& $python .\script\video\minimax-h3-mission-promo\produce.py prepare --output $out
```

`voice`, `animatic`, and `compose` currently fail by design because the only storyboard is rejected. The retained animatic is evidence of the rejected direction, not a production candidate.

First approve `preproduction-v3.zh-CN.md` (project brief and story outline). Then create and separately lock labeled character cards and environment-only scene cards. Only after those Skill gates may the six-column shot table be rewritten, self-checked, approved, and expanded into the authoritative text storyboard. Per-shot keyframes and H3 prompts come after storyboard approval; retired scene IDs and old motion proofs are never reused.

After approval, the production sequence is:

```powershell
& $python .\script\video\minimax-h3-mission-promo\produce.py voice --output $out
& $python .\script\video\minimax-h3-mission-promo\produce.py animatic --output $out
# Generate each approved storyboard H3 scene with generate-local-h3.py.
& $python .\script\video\minimax-h3-mission-promo\produce.py compose --output $out
# Inspect only the digest-bound media produced by that approved storyboard.
& $python .\script\video\minimax-h3-mission-promo\produce.py inspect --output $out --final
```

## Outputs

- `draft/opencorvus-long-mission-animatic-<storyboard-sha12>.mp4`
- `final/opencorvus-long-mission-h3-<storyboard-sha12>.mp4`
- `frames/animatic-<storyboard-sha12>/contact-sheet.jpg` and per-scene checkpoints
- `reports/frame-check-animatic-<storyboard-sha12>.json` and generation receipts

Rejected historical media uses an explicit `rejected-<direction>-<date>` suffix and is never a current production target.

`compose` fails if any declared H3 scene is missing. It never substitutes a placeholder into a file named as the final H3 film. The final 1080p canvas is a local editorial upscale of the generated B-roll plus native-resolution product evidence; it is not marketed as H3 native 2K.
