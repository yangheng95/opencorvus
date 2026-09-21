from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "v5c-cartoon-task-metaphor-trials.json"
GATES = HERE / "v5c-cartoon-take-gates.json"
DEFAULT_OUTPUT = Path(r"D:\myhexin-local\demos\opencorvus-cartoon-v5c-20260825")
ORDER = ["C01", "C02", "C02B", "C03"]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def run(command: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, text=True, capture_output=capture)


def accepted_sources() -> tuple[list[Path], dict[str, Any]]:
    manifest_sha = sha256_file(MANIFEST)
    gates = json.loads(GATES.read_text(encoding="utf-8"))
    if gates["manifest_sha256"] != manifest_sha:
        raise RuntimeError("The trial gate ledger does not bind the current manifest")
    sources = []
    for shot in ORDER:
        gate = gates["shots"].get(shot, {})
        if gate.get("status") != "accepted" or not gate.get("accepted"):
            raise RuntimeError(f"Trial shot is not manually accepted: {shot}")
        accepted = gate["accepted"]
        path = Path(accepted["path"])
        if not path.is_file() or sha256_file(path) != accepted["sha256"]:
            raise RuntimeError(f"Accepted trial digest mismatch: {shot}")
        sources.append(path)
    return sources, gates


def compose(output: Path) -> Path:
    sources, gates = accepted_sources()
    inputs = {
        "manifest_sha256": sha256_file(MANIFEST),
        "gates_sha256": sha256_file(GATES),
        "composer_sha256": sha256_file(Path(__file__).resolve()),
        "sources": [{"shot": shot, "path": str(path), "sha256": sha256_file(path)} for shot, path in zip(ORDER, sources, strict=True)],
    }
    digest = canonical_sha256(inputs)
    root = output / "trial-reels" / digest[:12]
    root.mkdir(parents=True, exist_ok=True)
    concat = root / "accepted.txt"
    concat.write_text("".join(f"file '{path.as_posix()}'\n" for path in sources), encoding="utf-8")
    final = output / f"opencorvus-cartoon-v5c-visual-trials-{digest[:12]}.mp4"
    run([
        "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(concat),
        "-vf", "scale=1865:1080:flags=lanczos,pad=1920:1080:(ow-iw)/2:0:color=0xf8f6f0",
        "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(final),
    ])
    receipt = {**inputs, "gate_rejections": {shot: gates["shots"][shot]["rejected"] for shot in ORDER}, "final": str(final), "final_sha256": sha256_file(final)}
    (root / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"final": str(final), "receipt": str(root / "receipt.json")}, ensure_ascii=False))
    return final


def inspect(video: Path, output: Path) -> dict[str, Any]:
    probe = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)], capture=True).stdout)
    video_stream = next(stream for stream in probe["streams"] if stream["codec_type"] == "video")
    audio_stream = next(stream for stream in probe["streams"] if stream["codec_type"] == "audio")
    duration = float(probe["format"]["duration"])
    root = output / "trial-inspection" / video.stem
    root.mkdir(parents=True, exist_ok=True)
    checkpoints = [5.9, 12.8, 16.4, 23.0]
    frames = []
    sheet = Image.new("RGB", (1920, 1080), (248, 246, 240))
    font = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 28)
    draw = ImageDraw.Draw(sheet)
    for index, (shot, timestamp) in enumerate(zip(ORDER, checkpoints, strict=True)):
        frame = root / f"{index:02d}-{shot}.png"
        run(["ffmpeg", "-y", "-v", "error", "-ss", str(timestamp), "-i", str(video), "-frames:v", "1", "-update", "1", str(frame)])
        image = Image.open(frame).convert("RGB").resize((960, 540), Image.Resampling.LANCZOS)
        x = (index % 2) * 960
        y = (index // 2) * 540
        sheet.paste(image, (x, y))
        draw.rectangle((x, y, x + 140, y + 40), fill=(248, 246, 240))
        draw.text((x + 10, y + 6), shot, font=font, fill=(23, 43, 143))
        frames.append({"shot": shot, "timestamp": timestamp, "path": str(frame), "sha256": sha256_file(frame)})
    contact = root / "accepted-trials-contact-sheet.jpg"
    sheet.save(contact, quality=95)
    result = {
        "video": str(video), "sha256": sha256_file(video), "duration": duration,
        "width": int(video_stream["width"]), "height": int(video_stream["height"]),
        "video_codec": video_stream["codec_name"], "audio_codec": audio_stream["codec_name"],
        "audio_sample_rate": int(audio_stream["sample_rate"]), "audio_channels": int(audio_stream["channels"]),
        "frames": frames, "contact_sheet": str(contact),
        "passed": 25.5 < duration < 27.5 and int(video_stream["width"]) == 1920 and int(video_stream["height"]) == 1080 and int(audio_stream["channels"]) == 2,
    }
    (root / "inspection.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"passed": result["passed"], "contact_sheet": str(contact), "report": str(root / "inspection.json")}, ensure_ascii=False))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Compose the manually accepted V5C cartoon visual trials.")
    parser.add_argument("command", choices=["compose", "inspect"])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--video", type=Path)
    args = parser.parse_args()
    if args.command == "compose":
        compose(args.output.resolve())
    else:
        video = args.video.resolve() if args.video else max(args.output.glob("opencorvus-cartoon-v5c-visual-trials-*.mp4"), key=lambda path: path.stat().st_mtime)
        inspect(video, args.output.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
