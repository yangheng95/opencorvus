from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import math
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parent
PLAN_PATH = ROOT / "v9-live-type-runtime-edit-plan.json"
WORDMARK_PATH = ROOT / "assets" / "live-type-runtime-v9-post" / "official-logo-light-4x.png"
ICON_PATH = ROOT.parents[2] / "packages" / "web" / "public" / "web-app-manifest-512x512.png"
DEFAULT_OUTPUT = Path(r"D:\myhexin-local\demos\opencorvus-live-type-v9-20260825")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_sha256(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def run(command: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, text=True, capture_output=capture)


def media_duration(path: Path) -> float:
    result = run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture=True,
    )
    return float(result.stdout.strip())


def load_sources(plan: dict[str, Any]) -> tuple[dict[str, Path], dict[str, Any]]:
    sources = {name: Path(path).resolve() for name, path in plan["assets"].items()}
    receipts: dict[str, Any] = {}
    for name, source in sources.items():
        if not source.is_file():
            raise FileNotFoundError(f"Edit-plan source is missing: {name} -> {source}")
        output_root = source.parents[3]
        shot_id = source.parents[1].name
        take_name = source.parent.name
        receipt = output_root / "reports" / shot_id / f"{take_name}.json"
        if not receipt.is_file():
            raise FileNotFoundError(f"H3 source has no generation receipt: {source}")
        payload = json.loads(receipt.read_text(encoding="utf-8"))
        physical_sha = sha256_file(source)
        if payload.get("output_sha256") != physical_sha:
            raise RuntimeError(f"H3 source digest does not match its receipt: {source}")
        receipts[name] = {
            "source": str(source),
            "sha256": physical_sha,
            "receipt": str(receipt),
            "receipt_sha256": sha256_file(receipt),
            "h3_build_digest": payload.get("build_digest"),
            "mode": payload.get("mode"),
        }
    return sources, receipts


def restore_sources(
    plan: dict[str, Any], sources: dict[str, Path], h3_receipts: dict[str, Any]
) -> tuple[dict[str, Path], dict[str, Any]]:
    config = plan["restoration"]
    executable = Path(config["executable"]).resolve()
    if not executable.is_file():
        raise FileNotFoundError(f"Restoration executable is missing: {executable}")
    scale = int(config["scale"])
    model = str(config["model"])
    model_bin = executable.parent / "models" / f"{model}-x{scale}.bin"
    model_param = executable.parent / "models" / f"{model}-x{scale}.param"
    for model_file in (model_bin, model_param):
        if not model_file.is_file():
            raise FileNotFoundError(f"Restoration model file is missing: {model_file}")
    identity = {
        "engine": config["engine"],
        "executable": str(executable),
        "executable_sha256": sha256_file(executable),
        "model": model,
        "scale": scale,
        "model_bin_sha256": sha256_file(model_bin),
        "model_param_sha256": sha256_file(model_param),
    }
    cache_root = Path(config["cache_root"]).resolve()
    cache_root.mkdir(parents=True, exist_ok=True)
    restored: dict[str, Path] = {}
    reports: dict[str, Any] = {}
    for name, source in sources.items():
        source_sha = h3_receipts[name]["sha256"]
        cache_digest = canonical_sha256({"source_sha256": source_sha, **identity})
        target_root = cache_root / name / cache_digest[:12]
        target = target_root / f"{name}-x{scale}.mp4"
        receipt_path = target_root / "receipt.json"
        if target.is_file() and receipt_path.is_file():
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            if receipt.get("output_sha256") != sha256_file(target):
                raise RuntimeError(f"Restored source digest does not match receipt: {target}")
            restored[name] = target
            reports[name] = receipt
            continue
        if target.exists() or receipt_path.exists():
            raise RuntimeError(f"Incomplete immutable restoration destination: {target_root}")
        target_root.mkdir(parents=True, exist_ok=True)
        probe = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(source)], capture=True).stdout)
        video_stream = next(stream for stream in probe["streams"] if stream["codec_type"] == "video")
        fps_text = video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate") or "24/1"
        duration = float(probe["format"]["duration"])
        with tempfile.TemporaryDirectory(prefix=f"{name}-", dir=cache_root) as temporary:
            work = Path(temporary)
            input_frames = work / "input"
            output_frames = work / "output"
            input_frames.mkdir()
            output_frames.mkdir()
            run([
                "ffmpeg", "-y", "-v", "error", "-i", str(source), "-qscale:v", "1", "-qmin", "1", "-qmax", "1",
                "-fps_mode", "passthrough", str(input_frames / "frame%08d.jpg"),
            ])
            run([
                str(executable), "-i", str(input_frames), "-o", str(output_frames), "-n", model,
                "-s", str(scale), "-f", "png",
            ], capture=True)
            input_count = len(list(input_frames.glob("frame*.jpg")))
            output_count = len(list(output_frames.glob("frame*.png")))
            if input_count == 0 or output_count != input_count:
                raise RuntimeError(f"Restoration frame count mismatch for {name}: {input_count} -> {output_count}")
            run([
                "ffmpeg", "-y", "-v", "error", "-framerate", fps_text, "-i", str(output_frames / "frame%08d.png"),
                "-i", str(source), "-map", "0:v:0", "-map", "1:a:0?", "-c:v", "libx264", "-preset", "medium",
                "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "copy", "-t", f"{duration:.6f}", "-movflags", "+faststart", str(target),
            ])
        receipt = {
            **identity,
            "source": str(source),
            "source_sha256": source_sha,
            "source_generation_receipt": h3_receipts[name]["receipt"],
            "input_frames": input_count,
            "output_frames": output_count,
            "output": str(target),
            "output_sha256": sha256_file(target),
        }
        receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
        restored[name] = target
        reports[name] = receipt
        print(f"restored {name} ({input_count} frames)", flush=True)
    return restored, reports


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def official_icon(size: int) -> Image.Image:
    icon = Image.open(ICON_PATH).convert("RGBA")
    pixels = icon.load()
    for y in range(icon.height):
        for x in range(icon.width):
            red, green, blue, _ = pixels[x, y]
            distance = max(abs(red - 249), abs(green - 248), abs(blue - 248))
            alpha = 0 if distance < 16 else min(255, distance * 16)
            pixels[x, y] = (red, green, blue, alpha)
    box = icon.getbbox()
    if box is None:
        raise RuntimeError(f"Official icon render is empty: {ICON_PATH}")
    icon = icon.crop(box)
    icon.thumbnail((size, size), Image.Resampling.LANCZOS)
    return icon


def official_wordmark(width: int) -> Image.Image:
    logo = Image.open(WORDMARK_PATH).convert("RGBA")
    box = logo.getbbox()
    if box is None:
        raise RuntimeError(f"Official wordmark render is empty: {WORDMARK_PATH}")
    logo = logo.crop(box)
    return logo.resize((width, round(logo.height * width / logo.width)), Image.Resampling.LANCZOS)


def render_brand_card(destination: Path, width: int, height: int) -> None:
    image = Image.new("RGBA", (width, height), "#f9f8f8")
    mesh = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    mesh_draw = ImageDraw.Draw(mesh, "RGBA")
    for x in range(0, width, 64):
        mesh_draw.line((x, 0, x, height), fill=(41, 70, 211, 10), width=1)
    for y in range(0, height, 64):
        mesh_draw.line((0, y, width, y), fill=(41, 70, 211, 10), width=1)
    mesh_draw.ellipse((-520, -430, 420, 360), fill=(41, 70, 211, 13))
    mesh_draw.ellipse((1560, 760, 2220, 1380), fill=(224, 75, 34, 9))
    image = Image.alpha_composite(image, mesh)
    draw = ImageDraw.Draw(image, "RGBA")
    icon = official_icon(190)
    logo = official_wordmark(510)
    group_width = icon.width + 42 + logo.width
    group_x = (width - group_width) // 2
    image.alpha_composite(icon, (group_x, 132))
    image.alpha_composite(logo, (group_x + icon.width + 42, 190))
    body = font(r"C:\Windows\Fonts\consola.ttf", 34)
    small = font(r"C:\Windows\Fonts\msyh.ttc", 27)
    lines = [
        ("opencorvus.com", body, "#172b8f"),
        ("github.com/yangheng95/opencorvus", body, "#1e232c"),
        ("Heng Yang (@yangheng95)", small, "#656363"),
        ("Case: github.com/yangheng95/deberta-v3-absa-public-evidence", small, "#1e232c"),
    ]
    y = 410
    for text, face, color in lines:
        bounds = draw.textbbox((0, 0), text, font=face)
        draw.text(((width - (bounds[2] - bounds[0])) / 2, y), text, font=face, fill=color)
        y += 74
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(destination, quality=96)


def render_opening_brand(destination: Path, width: int, height: int) -> None:
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle((1018, 34, 1880, 246), radius=38, fill=(249, 248, 248, 218), outline=(41, 70, 211, 38), width=2)
    icon = official_icon(124)
    logo = official_wordmark(350)
    image.alpha_composite(icon, (1044, 72))
    image.alpha_composite(logo, (1190, 62))
    mono = font(r"C:\Windows\Fonts\consola.ttf", 21)
    small = font(r"C:\Windows\Fonts\msyh.ttc", 18)
    draw.text((1192, 124), "opencorvus.com · github.com/yangheng95/opencorvus", font=mono, fill="#172b8f")
    draw.text((1192, 164), "Heng Yang (@yangheng95)", font=small, fill="#4f555e")
    draw.text((1192, 199), "Case · github.com/yangheng95/deberta-v3-absa-public-evidence", font=small, fill="#1e232c")
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination)


def scene_video(
    scene: dict[str, Any],
    sources: dict[str, Path],
    destination: Path,
    card: Path,
    width: int,
    height: int,
    fps: int,
) -> None:
    target = float(scene["duration"])
    if scene.get("type") == "brand_card":
        run(
            [
                "ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", str(card),
                "-f", "lavfi", "-i", "anullsrc=r=32000:cl=stereo", "-t", str(target),
                "-vf", f"scale={width}:{height},fade=t=in:st=0:d=4", "-r", str(fps),
                "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-ar", "32000", "-ac", "2", "-shortest", str(destination),
            ]
        )
        return

    command = ["ffmpeg", "-y", "-v", "error"]
    segments = scene["segments"]
    for asset, start, duration in segments:
        command += ["-ss", str(start), "-t", str(duration), "-i", str(sources[asset])]
    filters: list[str] = []
    concat_inputs = ""
    source_duration = 0.0
    for index, (_, _, duration) in enumerate(segments):
        source_duration += float(duration)
        filters.append(
            f"[{index}:v]fps={fps},scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=0xf9f8f8,setsar=1,setpts=PTS-STARTPTS[v{index}]"
        )
        filters.append(
            f"[{index}:a]aresample=32000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS[a{index}]"
        )
        concat_inputs += f"[v{index}][a{index}]"
    filters.append(f"{concat_inputs}concat=n={len(segments)}:v=1:a=1[vc][ac]")
    video_input = "vc"
    if scene["id"] in {"S14", "S17", "S18", "S27"}:
        filters.append("[vc]huesaturation=colors=r+y:saturation=-1:strength=100[vcolor]")
        video_input = "vcolor"
    if scene["id"] == "S19":
        filters.append(f"[{video_input}]split=2[vbase][vblurin]")
        filters.append("[vblurin]gblur=sigma=40[vblur]")
        filters.append(f"color=black:size={width}x{height}:rate={fps}:duration={target},drawbox=x=250:y=390:w=760:h=300:color=white:t=fill,gblur=sigma=42[vmask]")
        filters.append("[vbase][vblur][vmask]maskedmerge=planes=15[vclean]")
        video_input = "vclean"
    if scene["id"] in {"S35", "S36"}:
        filters.append(f"[{video_input}]split=2[vbase][vblurin]")
        filters.append("[vblurin]gblur=sigma=34[vblur]")
        filters.append(f"color=black:size={width}x{height}:rate={fps}:duration={target},drawbox=x=300:y=80:w=1320:h=360:color=white:t=fill,gblur=sigma=36[vmask]")
        filters.append("[vbase][vblur][vmask]maskedmerge=planes=15[vclean]")
        video_input = "vclean"
    if scene["id"] in {"S10", "S29"}:
        filters.append(f"[{video_input}]zoompan=z='min(zoom+0.00012,1.018)':d=1:s={width}x{height}:fps={fps}[vmotion]")
        video_input = "vmotion"
    gap = max(0.0, target - source_duration)
    filters.append(
        f"[{video_input}]tpad=stop_mode=clone:stop_duration={gap:.6f},trim=duration={target},setpts=PTS-STARTPTS[vout]"
    )
    filters.append(f"[ac]apad=pad_dur={gap:.6f},atrim=duration={target},asetpts=PTS-STARTPTS[aout]")
    command += [
        "-filter_complex", ";".join(filters), "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "32000", "-ac", "2", "-movflags", "+faststart",
        str(destination),
    ]
    run(command)


async def synthesize(text: str, destination: Path) -> None:
    import edge_tts

    last_error: Exception | None = None
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text=text, voice="zh-CN-YunxiNeural", rate="+18%").save(str(destination))
            return
        except Exception as error:
            last_error = error
            destination.unlink(missing_ok=True)
            await asyncio.sleep(1.5 * (attempt + 1))
    assert last_error is not None
    raise last_error


def atempo_chain(value: float) -> str:
    factors: list[float] = []
    while value > 2.0:
        factors.append(2.0)
        value /= 2.0
    while value < 0.5:
        factors.append(0.5)
        value /= 0.5
    factors.append(value)
    return ",".join(f"atempo={factor:.6f}" for factor in factors)


def scene_voice(text: str, duration: float, raw: Path, destination: Path) -> dict[str, Any]:
    if not text:
        run(
            ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", str(duration), str(destination)]
        )
        return {"text": "", "raw_seconds": 0.0, "tempo": 1.0}
    asyncio.run(synthesize(text, raw))
    raw_seconds = media_duration(raw)
    available = max(0.5, duration - 0.25)
    tempo = max(1.0, raw_seconds / available)
    if tempo > 1.48:
        raise RuntimeError(f"Narration remains too dense ({tempo:.3f}x): {text}")
    audio_filter = f"{atempo_chain(tempo)},apad=pad_dur={duration},atrim=duration={duration}"
    run(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", audio_filter,
            "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(destination),
        ]
    )
    return {"text": text, "raw_seconds": raw_seconds, "tempo": tempo}


def ass_time(seconds: float) -> str:
    centiseconds = round(seconds * 100)
    hours, remainder = divmod(centiseconds, 360000)
    minutes, remainder = divmod(remainder, 6000)
    whole, cents = divmod(remainder, 100)
    return f"{hours}:{minutes:02d}:{whole:02d}.{cents:02d}"


def ass_escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}").replace("\n", r"\N")


def write_ass(plan: dict[str, Any], manifest: dict[str, Any], destination: Path) -> None:
    shots = {shot["id"]: shot for shot in manifest["shots"]}
    overrides = plan.get("voiceover_overrides", {})
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Narration,Microsoft YaHei,38,&H00FFFFFF,&H000000FF,&H90000000,&H50000000,0,0,0,0,100,100,0,0,1,2,0,2,100,100,48,1
Style: Fact,Microsoft YaHei,34,&H008F2B17,&H000000FF,&H40FFFFFF,&H90F9F8F8,1,0,0,0,100,100,0,0,3,1,0,8,90,90,70,1
Style: Mechanism,Consolas,28,&H008F2B17,&H000000FF,&H00FFFFFF,&H50000000,1,0,0,0,100,100,0,0,1,2,0,8,80,80,70,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events: list[str] = []
    cursor = 0.0
    for scene in plan["scenes"]:
        start = cursor
        end = cursor + float(scene["duration"])
        text = overrides.get(scene["id"], shots.get(scene["id"], {}).get("voiceover_zh", ""))
        if text:
            events.append(
                f"Dialogue: 0,{ass_time(start + 0.08)},{ass_time(end - 0.08)},Narration,,0,0,0,,{ass_escape(text)}"
            )
        cursor = end
    events += [
        "Dialogue: 1,0:01:02.00,0:01:05.00,Fact,,0,0,0,,别再替 Agent 收尾。",
        "Dialogue: 2,0:01:12.00,0:01:13.60,Mechanism,,0,0,0,,durable facts + prerequisites → read",
        "Dialogue: 2,0:01:13.60,0:01:15.10,Mechanism,,0,0,0,,model judgement → frontier selected",
        "Dialogue: 2,0:01:15.10,0:01:17.20,Mechanism,,0,0,0,,dispatch_agent(squad_revision, task_occurrence)",
        "Dialogue: 2,0:01:17.20,0:01:19.00,Mechanism,,0,0,0,,accepted receipt → Squad active",
        "Dialogue: 2,0:01:43.10,0:01:49.80,Mechanism,,0,0,0,,Artifact · type / source / locator / digest",
        "Dialogue: 2,0:03:31.10,0:03:37.80,Mechanism,,0,0,0,,Codex · code session     Claude Code · code session",
        "Dialogue: 1,0:03:45.00,0:03:55.00,Fact,,0,0,0,,6 Tasks · ~12h45m  |  3 Expert Squads  |  46 Agent sessions  |  20 roles",
        "Dialogue: 1,0:03:55.00,0:04:03.00,Fact,,0,0,0,,1× RTX 5090 · 3 CUDA experiments\\Nvalidation Macro-F1 83.43% · selected test 83.61%\\Nsingle seed 42 · 1,800 examples · fixed-run evidence only · not general SOTA",
        "Dialogue: 1,0:04:03.00,0:04:08.00,Fact,,0,0,0,,github.com/yangheng95/deberta-v3-absa-public-evidence",
        "Dialogue: 1,0:04:18.00,0:04:28.00,Fact,,0,0,0,,别再替 Agent 收尾。",
    ]
    destination.write_text(header + "\n".join(events) + "\n", encoding="utf-8-sig")


def compose(output: Path) -> Path:
    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    manifest_path = ROOT / plan["manifest"]
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if len(plan["scenes"]) != 42 or sum(float(scene["duration"]) for scene in plan["scenes"]) != 276:
        raise RuntimeError("V9 edit plan must contain 42 scenes totaling 276 seconds")
    h3_sources, receipts = load_sources(plan)
    sources, restoration_receipts = restore_sources(plan, h3_sources, receipts)
    build_inputs = {
        "plan_sha256": sha256_file(PLAN_PATH),
        "manifest_sha256": sha256_file(manifest_path),
        "script_sha256": sha256_file(Path(__file__).resolve()),
        "wordmark_sha256": sha256_file(WORDMARK_PATH),
        "icon_sha256": sha256_file(ICON_PATH),
        "sources": receipts,
        "restoration": restoration_receipts,
    }
    build_digest = canonical_sha256(build_inputs)
    build = output / "builds" / build_digest[:12]
    scenes_root = build / "scenes"
    voice_root = build / "voice"
    raw_root = voice_root / "raw"
    reports = build / "reports"
    for directory in (scenes_root, voice_root, raw_root, reports):
        directory.mkdir(parents=True, exist_ok=True)
    width = int(plan["canvas"]["width"])
    height = int(plan["canvas"]["height"])
    fps = int(plan["canvas"]["fps"])
    card = build / "brand-card.png"
    opening_brand = build / "opening-brand.png"
    render_brand_card(card, width, height)
    render_opening_brand(opening_brand, width, height)
    shots = {shot["id"]: shot for shot in manifest["shots"]}
    overrides = plan.get("voiceover_overrides", {})
    scene_files: list[Path] = []
    voice_files: list[Path] = []
    voice_report: list[dict[str, Any]] = []
    for index, scene in enumerate(plan["scenes"]):
        scene_file = scenes_root / f"{index:02d}-{scene['id']}.mp4"
        if not scene_file.exists():
            print(f"scene {scene['id']}", flush=True)
            scene_video(scene, sources, scene_file, card, width, height, fps)
        text = overrides.get(scene["id"], shots.get(scene["id"], {}).get("voiceover_zh", ""))
        voice_file = voice_root / f"{index:02d}-{scene['id']}.wav"
        raw_file = raw_root / f"{index:02d}-{scene['id']}.mp3"
        if not voice_file.exists():
            print(f"voice {scene['id']}", flush=True)
            report = scene_voice(text, float(scene["duration"]), raw_file, voice_file)
        else:
            report = {"text": text, "cached": True}
        report.update(scene=scene["id"], target_seconds=float(scene["duration"]), path=str(voice_file))
        voice_report.append(report)
        scene_files.append(scene_file)
        voice_files.append(voice_file)

    video_list = build / "video-concat.txt"
    voice_list = build / "voice-concat.txt"
    video_list.write_text("".join(f"file '{path.as_posix()}'\n" for path in scene_files), encoding="utf-8")
    voice_list.write_text("".join(f"file '{path.as_posix()}'\n" for path in voice_files), encoding="utf-8")
    video = build / "v9-video.mp4"
    voice = build / "v9-voice.wav"
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(video_list), "-c", "copy", str(video)])
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(voice_list), "-c", "copy", str(voice)])
    ass = build / "overlays.ass"
    write_ass(plan, manifest, ass)
    ass_filter = ass.as_posix().replace(":", r"\:")
    final = output / f"opencorvus-live-type-runtime-v9-{build_digest[:12]}.mp4"
    run(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(voice), "-loop", "1", "-i", str(opening_brand),
            "-filter_complex",
            f"[0:v]tpad=stop_mode=clone:stop_duration=1,trim=duration=276,setpts=PTS-STARTPTS,ass='{ass_filter}',cas=0.38,gradfun=1.2[vbase];"
            "[2:v]format=rgba,fade=t=in:st=0:d=0.45:alpha=1,fade=t=out:st=17:d=1:alpha=1[vbrand];"
            "[vbase][vbrand]overlay=0:0:enable='between(t,0,18)'[v];"
            "[0:a]apad=pad_dur=1,atrim=duration=276,volume=0.16[amb];"
            "[1:a]apad=pad_dur=1,atrim=duration=276,volume=1.0[vo];"
            "[amb][vo]amix=inputs=2:duration=longest:dropout_transition=0,atrim=duration=276[a]",
            "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-t", "276", "-movflags", "+faststart", str(final),
        ]
    )
    receipt = {
        **build_inputs,
        "build_digest": build_digest,
        "final": str(final),
        "final_sha256": sha256_file(final),
        "duration_seconds": media_duration(final),
        "scenes": [str(path) for path in scene_files],
        "voice": voice_report,
    }
    (reports / "build-receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"final": str(final), "receipt": str(reports / "build-receipt.json")}, ensure_ascii=False))
    return final


def inspect(video: Path, output: Path) -> dict[str, Any]:
    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    probe = json.loads(
        run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)], capture=True).stdout
    )
    video_stream = next(stream for stream in probe["streams"] if stream["codec_type"] == "video")
    audio_stream = next(stream for stream in probe["streams"] if stream["codec_type"] == "audio")
    duration = float(probe["format"]["duration"])
    frames_root = output / "inspection" / video.stem
    frames_root.mkdir(parents=True, exist_ok=True)
    checks: list[dict[str, Any]] = []
    cursor = 0.0
    representative: list[Path] = []
    for scene in plan["scenes"]:
        scene_duration = float(scene["duration"])
        scene_dir = frames_root / scene["id"]
        scene_dir.mkdir(parents=True, exist_ok=True)
        points = {
            "start": cursor + min(0.2, scene_duration * 0.1),
            "quarter": cursor + scene_duration * 0.25,
            "middle": cursor + scene_duration * 0.5,
            "three_quarter": cursor + scene_duration * 0.75,
            "end": min(duration - 0.08, cursor + scene_duration - min(0.2, scene_duration * 0.1)),
        }
        scene_frames: list[dict[str, Any]] = []
        for label, timestamp in points.items():
            path = scene_dir / f"{label}.png"
            run(["ffmpeg", "-y", "-v", "error", "-ss", f"{timestamp:.3f}", "-i", str(video), "-frames:v", "1", "-update", "1", str(path)])
            image = Image.open(path).convert("RGB")
            scene_frames.append(
                {
                    "label": label,
                    "timestamp": timestamp,
                    "path": str(path),
                    "luminance": ImageStat.Stat(image.convert("L")).mean[0],
                }
            )
            if label == "middle":
                representative.append(path)
        checks.append({"scene": scene["id"], "start": cursor, "duration": scene_duration, "frames": scene_frames})
        cursor += scene_duration

    thumb_width, thumb_height = 320, 180
    sheet = Image.new("RGB", (thumb_width * 6, thumb_height * 7), "#f9f8f8")
    draw = ImageDraw.Draw(sheet)
    label_font = font(r"C:\Windows\Fonts\consola.ttf", 18)
    for index, path in enumerate(representative):
        frame = Image.open(path).convert("RGB").resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        x = (index % 6) * thumb_width
        y = (index // 6) * thumb_height
        sheet.paste(frame, (x, y))
        draw.rectangle((x, y, x + 70, y + 25), fill=(249, 248, 248, 220))
        draw.text((x + 6, y + 3), plan["scenes"][index]["id"], font=label_font, fill="#172b8f")
    contact_sheet = frames_root / "42-scene-middle-contact-sheet.jpg"
    sheet.save(contact_sheet, quality=92)
    result = {
        "video": str(video),
        "sha256": sha256_file(video),
        "duration": duration,
        "width": int(video_stream["width"]),
        "height": int(video_stream["height"]),
        "video_codec": video_stream["codec_name"],
        "audio_codec": audio_stream["codec_name"],
        "audio_sample_rate": int(audio_stream["sample_rate"]),
        "audio_channels": int(audio_stream["channels"]),
        "contact_sheet": str(contact_sheet),
        "scenes": checks,
    }
    result["passed"] = (
        abs(duration - 276) <= 0.1
        and result["width"] == 1920
        and result["height"] == 1080
        and result["video_codec"] == "h264"
        and result["audio_codec"] == "aac"
        and result["audio_sample_rate"] == 48000
        and result["audio_channels"] == 2
        and all(frame["luminance"] >= 8 for scene in checks for frame in scene["frames"])
    )
    report = frames_root / "inspection.json"
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"passed": result["passed"], "report": str(report), "contact_sheet": str(contact_sheet)}, ensure_ascii=False))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Compose and inspect the 4:36 OpenCorvus V9 H3 film.")
    parser.add_argument("command", choices=("compose", "inspect"))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--video", type=Path)
    args = parser.parse_args()
    if args.command == "compose":
        compose(args.output.resolve())
    else:
        if args.video is None:
            candidates = sorted(args.output.glob("opencorvus-live-type-runtime-v9-*.mp4"), key=lambda path: path.stat().st_mtime)
            if not candidates:
                raise FileNotFoundError("No V9 final found; run compose first or pass --video")
            video = candidates[-1]
        else:
            video = args.video.resolve()
        result = inspect(video, args.output.resolve())
        if not result["passed"]:
            raise RuntimeError("V9 final failed structural inspection")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
