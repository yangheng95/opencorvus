from __future__ import annotations

import argparse
import asyncio
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
MANIFEST = ROOT / "v10-tech-blog-opening-manifest.json"
OUTPUT = Path(r"D:\myhexin-local\demos\opencorvus-tech-blog-v10-20260825")
ICON = REPO / "packages" / "web" / "public" / "web-app-manifest-512x512.png"
WORDMARK = ROOT / "assets" / "live-type-runtime-v9-post" / "official-logo-light-4x.png"
H3 = {
    "T01": OUTPUT / "h3-local" / "T01" / "take-002-f4edaa18d189" / "T01.mp4",
    "T02": OUTPUT / "h3-local" / "T02" / "take-001-0366640ab380" / "T02.mp4",
    "T03": OUTPUT / "h3-local" / "T03" / "take-001-0f32751a65dc" / "T03.mp4",
}
RECEIPTS = {
    "T01": OUTPUT / "reports" / "T01" / "take-002-f4edaa18d189.json",
    "T02": OUTPUT / "reports" / "T02" / "take-001-0366640ab380.json",
    "T03": OUTPUT / "reports" / "T03" / "take-001-0f32751a65dc.json",
}
WIDTH, HEIGHT, FPS, DURATION = 1920, 1080, 24, 30


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def run(command: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, text=True, capture_output=capture)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(name, size=size)


MONO = r"C:\Windows\Fonts\consola.ttf"
SANS = r"C:\Windows\Fonts\msyh.ttc"
COLORS = {
    "paper": (249, 248, 248, 242),
    "ink": (30, 35, 44, 255),
    "muted": (101, 99, 99, 255),
    "blue": (23, 43, 143, 255),
    "cobalt": (41, 70, 211, 255),
    "orange": (224, 75, 34, 255),
    "green": (29, 151, 86, 255),
    "red": (183, 50, 50, 255),
    "line": (41, 70, 211, 42),
}


def verify_h3() -> dict[str, dict[str, str]]:
    verified: dict[str, dict[str, str]] = {}
    for shot, source in H3.items():
        receipt_path = RECEIPTS[shot]
        if not source.is_file() or not receipt_path.is_file():
            raise FileNotFoundError(f"Missing H3 source or receipt for {shot}")
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        physical = sha256_file(source)
        if receipt.get("output_sha256") != physical:
            raise RuntimeError(f"H3 source digest mismatch for {shot}")
        verified[shot] = {
            "source": str(source),
            "sha256": physical,
            "receipt": str(receipt_path),
            "receipt_sha256": sha256_file(receipt_path),
        }
    return verified


def load_brand() -> tuple[Image.Image, Image.Image]:
    icon = Image.open(ICON).convert("RGBA")
    pixels = icon.load()
    for y in range(icon.height):
        for x in range(icon.width):
            red, green, blue, _ = pixels[x, y]
            distance = max(abs(red - 249), abs(green - 248), abs(blue - 248))
            pixels[x, y] = (red, green, blue, 0 if distance < 16 else min(255, distance * 16))
    icon.thumbnail((64, 64), Image.Resampling.LANCZOS)
    wordmark = Image.open(WORDMARK).convert("RGBA")
    box = wordmark.getbbox()
    if box is None:
        raise RuntimeError("Official wordmark is empty")
    wordmark = wordmark.crop(box)
    wordmark = wordmark.resize((210, round(wordmark.height * 210 / wordmark.width)), Image.Resampling.LANCZOS)
    return icon, wordmark


def draw_grid(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    left, top, right, bottom = box
    for x in range(left, right + 1, 64):
        draw.line((x, top, x, bottom), fill=COLORS["line"], width=1)
    for y in range(top, bottom + 1, 64):
        draw.line((left, y, right, y), fill=COLORS["line"], width=1)


def brand_signature(layer: Image.Image, icon: Image.Image, wordmark: Image.Image, opacity: float) -> None:
    alpha = max(0, min(255, round(255 * opacity)))
    group = Image.new("RGBA", (430, 82), (249, 248, 248, round(220 * opacity)))
    group.alpha_composite(icon, (14, 9))
    group.alpha_composite(wordmark, (92, 20))
    draw = ImageDraw.Draw(group, "RGBA")
    draw.text((93, 52), "opencorvus.com", font=font(MONO, 18), fill=(23, 43, 143, alpha))
    layer.alpha_composite(group, (42, 34))


def draw_editor(frame: int, layer: Image.Image) -> None:
    local = frame / FPS
    draw = ImageDraw.Draw(layer, "RGBA")
    box = (720, 108, 1860, 1014)
    draw.rectangle(box, fill=COLORS["paper"], outline=(41, 70, 211, 92), width=2)
    draw_grid(draw, box)
    draw.text((770, 148), "MISSION REQUEST", font=font(MONO, 24), fill=COLORS["blue"])
    draw.line((770, 188, 1808, 188), fill=(41, 70, 211, 90), width=2)
    lines = [
        ("下载 DeBERTa V3 Base ABSA 模型与训练数据", False),
        ("重新调研、合成数据，完成 baseline + 2 次创新实验", False),
        ("RTX 5090 · CUDA ONLY · 禁止 CPU 训练", True),
        ("每次实验记录 train / validation / test 指标", False),
        ("交付监控页、推理页、图表与 ACL 风格论文", False),
        ("RUN TESTS · CONFIRM BEFORE PUBLISH", True),
    ]
    visible = min(len(lines), max(1, int(local / 1.25) + 1))
    y = 240
    for index, (text, hard) in enumerate(lines[:visible]):
        if hard:
            draw.rounded_rectangle((768, y - 4, 828, y + 36), radius=8, fill=(224, 75, 34, 24))
            draw.text((781, y + 2), "HARD", font=font(MONO, 16), fill=COLORS["orange"])
            x = 850
        else:
            draw.text((776, y + 2), f"{index + 1:02d}", font=font(MONO, 18), fill=COLORS["muted"])
            x = 850
        draw.text((x, y), text, font=font(SANS, 27), fill=COLORS["ink"])
        y += 104
    cursor_x = 850 + (local * 140) % 780
    draw.rectangle((cursor_x, min(895, y), cursor_x + 4, min(935, y + 38)), fill=COLORS["orange"])
    draw.text((770, 944), "不是一句问题，而是一个需要验收的项目。", font=font(SANS, 25), fill=COLORS["blue"])


def draw_context(frame: int, layer: Image.Image) -> None:
    local = frame / FPS - 10
    draw = ImageDraw.Draw(layer, "RGBA")
    box = (70, 58, 1850, 1018)
    draw.rectangle(box, fill=(249, 248, 248, 218))
    draw_grid(draw, box)
    draw.text((112, 98), "AGENT SESSION · session_01", font=font(MONO, 24), fill=COLORS["blue"])
    draw.text((112, 146), "early constraints", font=font(MONO, 18), fill=COLORS["muted"])
    constraints = ["CUDA ONLY", "RUN TESTS", "CONFIRM BEFORE PUBLISH"]
    for i, text in enumerate(constraints):
        y = 188 + i * 58
        draw.line((112, y + 15, 142, y + 15), fill=COLORS["orange"], width=6)
        draw.text((164, y), text, font=font(MONO, 25), fill=COLORS["orange"])
    draw.line((520, 90, 520, 970), fill=(41, 70, 211, 80), width=2)
    draw.text((568, 98), "tool / result stream", font=font(MONO, 18), fill=COLORS["muted"])
    results = [
        "tool:model_download  →  1.2 GB cached",
        "tool:dataset_search  →  14 sources",
        "tool:cuda_preflight  →  RTX 5090 detected",
        "tool:code_write      →  train.py",
        "tool:test_collect    →  27 cases",
        "tool:web_build       →  monitor + inference",
        "result:logs          →  18,426 tokens",
        "result:diff          →  312 lines",
    ]
    visible = min(len(results), 2 + int(local / 1.05))
    for i, text in enumerate(results[:visible]):
        y = 154 + i * 83
        draw.text((568, y), text, font=font(MONO, 25), fill=COLORS["ink"])
        draw.line((568, y + 48, 1480, y + 48), fill=(101, 99, 99, 40), width=1)
    occupancy = min(0.96, 0.63 + local * 0.033)
    draw.text((1540, 100), "CONTEXT", font=font(MONO, 20), fill=COLORS["blue"])
    draw.rectangle((1588, 160, 1642, 902), outline=(41, 70, 211, 120), width=2)
    fill_top = 902 - int(742 * occupancy)
    draw.rectangle((1594, fill_top, 1636, 896), fill=COLORS["cobalt"])
    draw.text((1518, 926), f"{round(occupancy * 100):02d}%", font=font(MONO, 36), fill=COLORS["blue"])
    draw.text((112, 938), "新结果不断写回同一个有限窗口。", font=font(SANS, 25), fill=COLORS["blue"])


def draw_failure(frame: int, layer: Image.Image) -> None:
    local = frame / FPS - 20
    draw = ImageDraw.Draw(layer, "RGBA")
    box = (70, 58, 1850, 1018)
    draw.rectangle(box, fill=(249, 248, 248, 224))
    draw_grid(draw, box)
    draw.text((110, 94), "event trace", font=font(MONO, 20), fill=COLORS["muted"])
    draw.text((110, 136), "20.000  Context compaction #3", font=font(MONO, 27), fill=COLORS["blue"])
    fade = max(55, round(255 * (1 - min(1, local / 3.2))))
    for i, text in enumerate(["CUDA ONLY", "RUN TESTS", "CONFIRM BEFORE PUBLISH"]):
        draw.text((116, 206 + i * 52), text, font=font(MONO, 23), fill=(101, 99, 99, fade))
    draw.text((600, 104), "plan.yml", font=font(MONO, 20), fill=COLORS["muted"])
    plan = [
        ("01", "download model + data", "done"),
        ("02", "run CUDA experiments", "skipped"),
        ("03", "run focused tests", "skipped"),
        ("04", "draft report", "running"),
    ]
    for i, (num, text, state) in enumerate(plan):
        y = 156 + i * 84
        color = COLORS["ink"] if state == "done" else COLORS["red"] if state == "skipped" else COLORS["cobalt"]
        draw.text((600, y), num, font=font(MONO, 24), fill=COLORS["muted"])
        draw.text((666, y), text, font=font(MONO, 26), fill=color)
        draw.text((1320, y), state.upper(), font=font(MONO, 20), fill=color)
    if local > 2.2:
        draw.line((572, 242, 572, 418), fill=COLORS["cobalt"], width=6)
        draw.polygon([(560, 406), (584, 406), (572, 430)], fill=COLORS["cobalt"])
        draw.text((600, 506), "$ python train.py", font=font(MONO, 23), fill=COLORS["muted"])
        draw.text((600, 550), "device: cpu", font=font(MONO, 30), fill=COLORS["red"])
        draw.text((600, 596), "tests: not run", font=font(MONO, 30), fill=COLORS["red"])
    if local > 5.2:
        draw.rounded_rectangle((1110, 680, 1460, 808), radius=18, fill=(29, 151, 86, 28), outline=COLORS["green"], width=3)
        draw.text((1204, 713), "DONE", font=font(MONO, 48), fill=COLORS["green"])
        draw.text((108, 706), "ACCEPTANCE", font=font(MONO, 20), fill=COLORS["blue"])
        for i, text in enumerate(["CUDA experiments", "tests", "publish confirmation"]):
            y = 752 + i * 62
            draw.rectangle((112, y + 4, 136, y + 28), outline=COLORS["red"], width=3)
            draw.text((158, y), f"{text}  ·  incomplete", font=font(MONO, 24), fill=COLORS["red"])
    draw.text((108, 944), "聊天记录 ≠ 可恢复、可验收的运行状态", font=font(SANS, 27), fill=COLORS["blue"])


def render_overlays(destination: Path) -> None:
    icon, wordmark = load_brand()
    destination.mkdir(parents=True, exist_ok=True)
    for frame in range(DURATION * FPS):
        layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        if frame < 10 * FPS:
            draw_editor(frame, layer)
        elif frame < 20 * FPS:
            draw_context(frame, layer)
        else:
            draw_failure(frame, layer)
        brand_signature(layer, icon, wordmark, 1.0 if frame < 4 * FPS else 0.78)
        layer.save(destination / f"frame{frame + 1:08d}.png", compress_level=4)


async def synthesize(text: str, destination: Path) -> None:
    import edge_tts

    await edge_tts.Communicate(text=text, voice="zh-CN-YunxiNeural", rate="+12%").save(str(destination))


def build() -> Path:
    verified = verify_h3()
    build_inputs = {
        "script_sha256": sha256_file(Path(__file__).resolve()),
        "manifest_sha256": sha256_file(MANIFEST),
        "icon_sha256": sha256_file(ICON),
        "wordmark_sha256": sha256_file(WORDMARK),
        "h3": verified,
    }
    digest = hashlib.sha256(json.dumps(build_inputs, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    root = OUTPUT / "opening-builds" / digest[:12]
    root.mkdir(parents=True, exist_ok=True)
    background = root / "h3-background.mp4"
    if not background.is_file():
        command = ["ffmpeg", "-y", "-v", "error"]
        for shot in ("T01", "T02", "T03"):
            command += ["-t", "10", "-i", str(H3[shot])]
        command += [
            "-filter_complex",
            "[0:v]fps=24,scale=1920:1080:flags=lanczos,setsar=1[v0];[1:v]fps=24,scale=1920:1080:flags=lanczos,setsar=1[v1];[2:v]fps=24,scale=1920:1080:flags=lanczos,setsar=1[v2];[v0][v1][v2]concat=n=3:v=1:a=0,cas=0.32[v]",
            "-map", "[v]", "-t", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(background),
        ]
        run(command)
    overlays = root / "overlay-frames"
    if len(list(overlays.glob("frame*.png"))) != DURATION * FPS:
        render_overlays(overlays)
    overlay_video = root / "overlays.mov"
    if not overlay_video.is_file():
        run([
            "ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-i", str(overlays / "frame%08d.png"),
            "-c:v", "qtrle", "-pix_fmt", "argb", str(overlay_video),
        ])
    voice_text = (
        "你给 Agent 的，往往不是一句问题，而是一个项目：下载模型，准备数据，只用 CUDA 跑实验，做网页，写论文，测试通过后再发布。"
        "任务一长，工具结果不断写回同一个 context。占用从六成涨到九成，最早的硬约束开始接近窗口边缘。"
        "第三次 compaction 后，CUDA、测试和发布确认被压成模糊摘要。计划直接跳到写报告，device 变成 CPU，测试没跑，Agent 却已经说 Done。"
    )
    voice_raw = root / "voice.mp3"
    if not voice_raw.is_file():
        asyncio.run(synthesize(voice_text, voice_raw))
    voice = root / "voice.wav"
    if not voice.is_file():
        run(["ffmpeg", "-y", "-v", "error", "-i", str(voice_raw), "-filter:a", "apad=pad_dur=30,atrim=duration=30", "-ar", "48000", "-ac", "2", str(voice)])
    final = OUTPUT / f"opencorvus-tech-blog-v10-opening-{digest[:12]}.mp4"
    run([
        "ffmpeg", "-y", "-v", "error", "-i", str(background), "-i", str(overlay_video), "-i", str(voice),
        "-filter_complex", "[0:v][1:v]overlay=0:0[v];[2:a]volume=1.0[a]", "-map", "[v]", "-map", "[a]",
        "-t", "30", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(final),
    ])
    receipt = {**build_inputs, "build_digest": digest, "final": str(final), "final_sha256": sha256_file(final)}
    (root / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"final": str(final), "receipt": str(root / "receipt.json")}, ensure_ascii=False))
    return final


def main() -> int:
    parser = argparse.ArgumentParser(description="Compose the V10 30-second tech-blog comprehension proof.")
    parser.add_argument("command", choices=["build"])
    args = parser.parse_args()
    if args.command == "build":
        build()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
