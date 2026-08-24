from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import math
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageStat


HERE = Path(__file__).resolve().parent
STORYBOARD_PATH = HERE / "storyboard.zh-CN.json"
DEFAULT_OUTPUT = Path(r"D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824")
MISSION_ROOT = Path(r"D:\myhexin-local\demos\deberta-absa-builtins-mission-rerun2-20260823")
CAPTURE_ROOT = DEFAULT_OUTPUT / "assets" / "screenshots"
FONT_REGULAR = Path(r"C:\Windows\Fonts\msyh.ttc")
FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_MONO = Path(r"C:\Windows\Fonts\consola.ttf")

BG = (9, 13, 20)
PANEL = (18, 25, 35)
INK = (238, 244, 249)
MUTED = (145, 161, 176)
CYAN = (64, 214, 216)
AMBER = (250, 170, 64)
GREEN = (75, 224, 156)


def run(args: list[str], *, cwd: Path | None = None, capture: bool = False) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(args), flush=True)
    return subprocess.run(args, cwd=cwd, check=True, text=True, capture_output=capture)


def load_storyboard(*, require_approved: bool = False) -> dict[str, Any]:
    storyboard = json.loads(STORYBOARD_PATH.read_text(encoding="utf-8"))
    if require_approved and storyboard.get("production_status") != "approved":
        raise RuntimeError(
            "The current storyboard was rejected and is blocked from production. "
            "Approve creative-brief-v2.zh-CN.md, rewrite the storyboard, and set production_status to approved first."
        )
    return storyboard


def font(size: int, *, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_MONO if mono else (FONT_BOLD if bold else FONT_REGULAR)
    return ImageFont.truetype(str(path), size=size)


@lru_cache(maxsize=4)
def _gradient_base(width: int, height: int) -> Image.Image:
    canvas = Image.new("RGB", (width, height), BG)
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((-420, -460, 980, 900), fill=(20, 165, 180, 105))
    glow_draw.ellipse((width - 920, height - 850, width + 300, height + 330), fill=(230, 102, 36, 72))
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    canvas.paste(glow, (0, 0), glow)
    return canvas


def gradient_canvas(width: int, height: int) -> Image.Image:
    return _gradient_base(width, height).copy()


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def fit_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS)


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int], text_font: ImageFont.FreeTypeFont, fill: tuple[int, int, int], max_width: int, spacing: int = 12) -> int:
    x, y = xy
    lines: list[str] = []
    for paragraph in text.splitlines() or [""]:
        current = ""
        for char in paragraph:
            candidate = current + char
            if draw.textbbox((0, 0), candidate, font=text_font)[2] <= max_width or not current:
                current = candidate
            else:
                lines.append(current)
                current = char
        lines.append(current)
    for line in lines:
        draw.text((x, y), line, font=text_font, fill=fill)
        y += text_font.size + spacing
    return y


def evidence_paths(output: Path) -> dict[str, Path]:
    assets = output / "assets" / "evidence"
    screenshots = output / "assets" / "screenshots"
    return {
        "mission-overview-7884.png": screenshots / "mission-overview-7884.png",
        "cuda-task-7884.png": screenshots / "cuda-task-7884.png",
        "publication-task-7884.png": screenshots / "publication-task-7884.png",
        "ready-desktop.png": assets / "ready-desktop.png",
        "inference-success-desktop.png": assets / "inference-success-desktop.png",
        "best-model-architecture.png": assets / "best-model-architecture.png",
        "best-experiment-lifecycle.png": assets / "best-experiment-lifecycle.png",
        "paper-1.png": assets / "paper-1.png",
        "paper-2.png": assets / "paper-2.png",
    }


def prepare(output: Path) -> None:
    assets = output / "assets" / "evidence"
    assets.mkdir(parents=True, exist_ok=True)
    copies = {
        MISSION_ROOT / "reports" / "task2" / "web-runtime" / "ready-desktop.png": assets / "ready-desktop.png",
        MISSION_ROOT / "reports" / "task2" / "web-runtime" / "inference-success-desktop.png": assets / "inference-success-desktop.png",
        MISSION_ROOT / "docs" / "figures" / "task3-best-experiment" / "best-model-architecture.png": assets / "best-model-architecture.png",
        MISSION_ROOT / "docs" / "figures" / "task3-best-experiment" / "best-experiment-lifecycle.png": assets / "best-experiment-lifecycle.png",
        MISSION_ROOT / "artifacts" / "research" / "deberta-absa-acl-paper-stage5-final" / "verification" / "pages" / "paper-1.png": assets / "paper-1.png",
        MISSION_ROOT / "artifacts" / "research" / "deberta-absa-acl-paper-stage5-final" / "verification" / "pages" / "paper-2.png": assets / "paper-2.png",
        MISSION_ROOT / "reports" / "task2" / "experiments" / "comparison.json": assets / "comparison.json",
        MISSION_ROOT / "reports" / "task6" / "github" / "publication.json": assets / "publication.json",
    }
    missing = [str(source) for source in copies if not source.exists()]
    missing += [str(path) for path in evidence_paths(output).values() if path.parent.name == "screenshots" and not path.exists()]
    if missing:
        raise FileNotFoundError("Missing real evidence:\n" + "\n".join(missing))
    for source, destination in copies.items():
        shutil.copy2(source, destination)
    manifest = {
        "schema_version": 1,
        "sources": [
            {"source": str(source), "copy": str(destination), "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}
            for source, destination in copies.items()
        ],
        "captures": [
            {"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
            for path in evidence_paths(output).values()
            if path.parent.name == "screenshots"
        ],
    }
    reports = output / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    (reports / "evidence-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def draw_brand(draw: ImageDraw.ImageDraw, storyboard: dict[str, Any], width: int) -> None:
    draw.rounded_rectangle((76, 54, 332, 110), radius=18, fill=(21, 36, 46), outline=CYAN, width=2)
    draw.text((98, 66), "OPEN", font=font(23, bold=True), fill=INK)
    draw.text((177, 66), "CORVUS", font=font(23, bold=True), fill=CYAN)
    draw.text((width - 360, 68), "LONG-HORIZON CASE 01", font=font(18, bold=True), fill=MUTED)


def render_scene(scene: dict[str, Any], storyboard: dict[str, Any], output: Path, *, placeholder: bool = False) -> Image.Image:
    width = storyboard["canvas"]["width"]
    height = storyboard["canvas"]["height"]
    image = gradient_canvas(width, height)
    draw = ImageDraw.Draw(image)
    draw_brand(draw, storyboard, width)
    draw.text((80, 154), scene.get("eyebrow", ""), font=font(22, bold=True), fill=CYAN)

    assets = [evidence_paths(output)[name] for name in scene.get("assets", [])]
    if assets:
        title_width = 670 if len(assets) <= 2 else 610
        title_end = draw_wrapped(draw, scene["title"], (80, 206), font(54, bold=True), INK, title_width, spacing=8)
        if scene.get("metric"):
            draw.rounded_rectangle((80, title_end + 26, 710, title_end + 92), radius=16, fill=(22, 42, 48), outline=GREEN, width=2)
            draw.text((104, title_end + 45), scene["metric"], font=font(17, bold=True), fill=GREEN)
        area = (760, 160, 1840, 830)
        gap = 24
        columns = 1 if len(assets) == 1 else 2
        rows = math.ceil(len(assets) / columns)
        cell_w = (area[2] - area[0] - gap * (columns - 1)) // columns
        cell_h = (area[3] - area[1] - gap * (rows - 1)) // rows
        for index, path in enumerate(assets):
            row, col = divmod(index, columns)
            x = area[0] + col * (cell_w + gap)
            y = area[1] + row * (cell_h + gap)
            source = Image.open(path)
            card = fit_crop(source, (cell_w, cell_h))
            shadow = Image.new("RGBA", (cell_w + 28, cell_h + 28), (0, 0, 0, 0))
            ImageDraw.Draw(shadow).rounded_rectangle((14, 14, cell_w + 13, cell_h + 13), 24, fill=(0, 0, 0, 150))
            shadow = shadow.filter(ImageFilter.GaussianBlur(12))
            image.paste(shadow, (x - 14, y - 6), shadow)
            image.paste(card, (x, y), rounded_mask((cell_w, cell_h), 20))
            draw.rounded_rectangle((x, y, x + cell_w, y + cell_h), radius=20, outline=(56, 76, 91), width=2)
        draw.text((764, 850), scene.get("asset_label", "真实证据"), font=font(18, bold=True), fill=AMBER)
    elif scene.get("bullets"):
        title_end = draw_wrapped(draw, scene["title"], (80, 210), font(62, bold=True), INK, 1220, spacing=10)
        y = title_end + 54
        for index, bullet in enumerate(scene["bullets"], 1):
            draw.rounded_rectangle((90, y, 1500, y + 92), radius=26, fill=(20, 31, 42), outline=(42, 60, 73), width=2)
            draw.ellipse((116, y + 24, 160, y + 68), fill=CYAN if index == 1 else (AMBER if index == 2 else GREEN))
            draw.text((178, y + 21), bullet, font=font(36, bold=True), fill=INK)
            y += 112
    else:
        title_end = draw_wrapped(draw, scene["title"], (80, 264), font(66, bold=True), INK, 1500, spacing=10)
        if placeholder:
            draw.rounded_rectangle((82, title_end + 52, 650, title_end + 112), radius=18, fill=(54, 34, 20), outline=AMBER, width=2)
            draw.text((108, title_end + 68), "ANIMATIC · LOCAL H3 SHOT PENDING", font=font(20, bold=True), fill=AMBER)

    subtitle = scene.get("subtitle", "")
    draw.rounded_rectangle((72, 912, width - 72, 1014), radius=24, fill=(11, 17, 24), outline=(38, 54, 66), width=2)
    draw_wrapped(draw, subtitle, (102, 937), font(26, bold=True), INK, width - 204, spacing=6)
    return image


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease(value: float) -> float:
    value = clamp(value)
    return value * value * (3.0 - 2.0 * value)


def phase(seconds: float, start: float, duration: float) -> float:
    return ease((seconds - start) / duration)


def draw_motion_background(image: Image.Image, frame_index: int) -> ImageDraw.ImageDraw:
    draw = ImageDraw.Draw(image, "RGBA")
    width, height = image.size
    offset = (frame_index * 2) % 80
    for x in range(-80 + offset, width + 80, 80):
        draw.line((x, 0, x, height), fill=(62, 122, 132, 18), width=1)
    for y in range(-80 + offset // 2, height + 80, 80):
        draw.line((0, y, width, y), fill=(62, 122, 132, 14), width=1)
    for index in range(24):
        x = (index * 277 + frame_index * (1 + index % 4)) % width
        y = (index * 131 + int(18 * math.sin(frame_index / 28 + index))) % height
        radius = 2 + index % 3
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(68, 207, 214, 30 + index % 4 * 12))
    # A restrained scanner keeps every explanatory shot alive between major
    # state transitions. It is deliberately visible enough to survive video
    # freeze detection, while remaining subordinate to the diagram animation.
    scan_y = (frame_index * 7) % (height + 140) - 70
    draw.rectangle((0, scan_y - 24, width, scan_y + 24), fill=(45, 204, 214, 10))
    draw.line((0, scan_y, width, scan_y), fill=(89, 230, 232, 72), width=3)
    return draw


def draw_kinetic_header(draw: ImageDraw.ImageDraw, scene: dict[str, Any], seconds: float, width: int) -> None:
    intro = phase(seconds, 0.05, 0.85)
    x = int(-780 + intro * 860)
    draw.text((x, 64), scene.get("eyebrow", ""), font=font(21, bold=True), fill=CYAN)
    draw_wrapped(draw, scene["title"], (x, 112), font(48, bold=True), INK, min(1000, width - 160), spacing=6)


def draw_motion_subtitle(draw: ImageDraw.ImageDraw, scene: dict[str, Any], width: int, height: int) -> None:
    draw.rounded_rectangle((70, height - 124, width - 70, height - 34), radius=24, fill=(5, 10, 16, 222), outline=(52, 76, 89, 230), width=2)
    draw_wrapped(draw, scene.get("subtitle", ""), (102, height - 100), font(24, bold=True), INK, width - 204, spacing=5)


def draw_node(draw: ImageDraw.ImageDraw, center: tuple[int, int], label: str, progress: float, *, radius: int = 48, failed: bool = False) -> None:
    x, y = center
    color = (255, 92, 86) if failed else GREEN if progress >= 0.98 else CYAN
    glow = int(28 + 42 * (0.5 + 0.5 * math.sin(progress * math.pi * 2)))
    draw.ellipse((x - radius - 18, y - radius - 18, x + radius + 18, y + radius + 18), fill=(*color, glow))
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(12, 24, 32, 245), outline=(*color, 255), width=4)
    if progress >= 0.98 and not failed:
        draw.line((x - 18, y, x - 4, y + 14), fill=GREEN, width=7)
        draw.line((x - 4, y + 14, x + 24, y - 18), fill=GREEN, width=7)
    elif failed:
        draw.line((x - 18, y - 18, x + 18, y + 18), fill=color, width=6)
        draw.line((x + 18, y - 18, x - 18, y + 18), fill=color, width=6)
    else:
        draw.ellipse((x - 9, y - 9, x + 9, y + 9), fill=color)
    bbox = draw.textbbox((0, 0), label, font=font(21, bold=True))
    draw.text((x - (bbox[2] - bbox[0]) / 2, y + radius + 18), label, font=font(21, bold=True), fill=INK)


def paste_evidence(image: Image.Image, source: Image.Image, box: tuple[int, int, int, int], *, radius: int = 24, alpha: int = 255) -> None:
    x0, y0, x1, y1 = box
    if x1 <= x0 or y1 <= y0:
        return
    card = fit_crop(source, (x1 - x0, y1 - y0)).convert("RGBA")
    if alpha < 255:
        card.putalpha(alpha)
    mask = rounded_mask(card.size, radius)
    if alpha < 255:
        mask = mask.point(lambda value: value * alpha // 255)
    image.paste(card, (x0, y0), mask)
    ImageDraw.Draw(image).rounded_rectangle(box, radius=radius, outline=(77, 105, 119), width=3)


def draw_h3_placeholder(draw: ImageDraw.ImageDraw, seconds: float, width: int, height: int) -> None:
    points: list[tuple[int, int]] = []
    for index in range(13):
        angle = index * 0.72 + seconds * 0.16
        radius = 100 + index * 42
        x = int(width / 2 + math.cos(angle) * radius)
        y = int(height / 2 + math.sin(angle * 1.35) * radius * 0.46)
        points.append((x, y))
    for index in range(len(points) - 1):
        draw.line((*points[index], *points[index + 1]), fill=(64, 214, 216, 80 + index * 8), width=5)
    travel = (seconds * 0.22) % 1.0
    segment = min(len(points) - 2, int(travel * (len(points) - 1)))
    local = travel * (len(points) - 1) - segment
    x = int(points[segment][0] * (1 - local) + points[segment + 1][0] * local)
    y = int(points[segment][1] * (1 - local) + points[segment + 1][1] * local)
    draw.ellipse((x - 24, y - 24, x + 24, y + 24), fill=(250, 170, 64, 70))
    draw.ellipse((x - 10, y - 10, x + 10, y + 10), fill=AMBER)


def render_motion_scene(scene: dict[str, Any], storyboard: dict[str, Any], output: Path, output_video: Path, *, placeholder_h3: bool = False) -> None:
    width, height, fps = (storyboard["canvas"][key] for key in ("width", "height", "fps"))
    duration = float(scene["duration"])
    total_frames = round(duration * fps)
    sources = {name: Image.open(path).convert("RGB") for name, path in evidence_paths(output).items() if path.exists()}
    process = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "warning", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{width}x{height}", "-r", str(fps), "-i", "-", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(output_video)],
        stdin=subprocess.PIPE,
    )
    assert process.stdin is not None
    for frame_index in range(total_frames):
        seconds = frame_index / fps
        image = gradient_canvas(width, height)
        draw = draw_motion_background(image, frame_index)
        draw_kinetic_header(draw, scene, seconds, width)

        if placeholder_h3:
            draw_h3_placeholder(draw, seconds, width, height)
        elif scene["kind"] == "motion_pain":
            labels = ("进程中断", "证据丢失", "修正遗忘")
            rows = (430, 610, 790)
            for row_index, (label, y) in enumerate(zip(labels, rows, strict=True)):
                start_x, end_x = 260, 1690
                draw.line((start_x, y, end_x, y), fill=(54, 94, 108, 150), width=8)
                fail_x = 720 + row_index * 310
                reveal = phase(seconds, 1.1 + row_index * 2.7, 1.2)
                dot_x = int(start_x + reveal * (fail_x - start_x))
                draw.ellipse((dot_x - 15, y - 15, dot_x + 15, y + 15), fill=AMBER)
                if reveal > 0.96:
                    draw.line((fail_x - 24, y - 30, fail_x + 24, y + 30), fill=(255, 86, 80, 240), width=7)
                    draw.line((fail_x + 24, y - 30, fail_x - 24, y + 30), fill=(255, 86, 80, 240), width=7)
                    for spark in range(8):
                        angle = spark * math.pi / 4 + seconds
                        length = 26 + 18 * math.sin(seconds * 5 + spark)
                        draw.line((fail_x, y, fail_x + math.cos(angle) * length, y + math.sin(angle) * length), fill=(255, 112, 70, 170), width=3)
                draw.text((start_x, y - 62), f"0{row_index + 1}", font=font(20, bold=True), fill=CYAN)
                draw.text((start_x + 54, y - 67), label, font=font(28, bold=True), fill=INK)
                if reveal > 0.96:
                    draw.text((fail_x + 64, y - 17), "任务停在‘快完成’", font=font(22, bold=True), fill=(255, 120, 108))
        elif scene["kind"] == "motion_compare":
            draw.line((960, 320, 960, 860), fill=(91, 115, 128, 120), width=2)
            draw.text((210, 320), "单一会话", font=font(32, bold=True), fill=(255, 135, 112))
            draw.text((1120, 320), "MISSION", font=font(32, bold=True), fill=GREEN)
            fill = clamp((seconds - 1.0) / 5.5)
            draw.rounded_rectangle((190, 400, 790, 454), radius=18, fill=(25, 34, 43), outline=(75, 91, 102), width=2)
            draw.rounded_rectangle((190, 400, 190 + int(600 * fill), 454), radius=18, fill=(250, 121, 84, 210))
            draw.text((190, 472), "上下文持续膨胀", font=font(23, bold=True), fill=MUTED)
            for index in range(5):
                y = 552 + index * 48
                alpha = int(220 * (1 - phase(seconds, 5.8 + index * 0.12, 1.3)))
                draw.rounded_rectangle((210 + index * 20, y, 790 - index * 14, y + 34), radius=14, fill=(55, 70, 82, alpha))
            if seconds > 6.5:
                draw.text((300, 790), "STATE LOST", font=font(34, bold=True), fill=(255, 92, 86))
            mission_nodes = ((1150, 520, "Research"), (1435, 520, "Train"), (1710, 520, "Review"))
            for index, (x, y, label) in enumerate(mission_nodes):
                node_progress = phase(seconds, 1.4 + index * 2.0, 1.0)
                draw_node(draw, (x, y), label, node_progress, radius=43)
                if index < len(mission_nodes) - 1:
                    draw.line((x + 50, y, mission_nodes[index + 1][0] - 50, y), fill=(64, 214, 216, 150), width=5)
            travel = clamp((seconds - 2.0) / 6.0)
            artifact_x = int(1150 + travel * 560)
            draw.rounded_rectangle((artifact_x - 36, 690, artifact_x + 36, 746), radius=14, fill=(250, 170, 64, 230))
            draw.text((artifact_x - 13, 704), "A", font=font(20, bold=True), fill=BG)
            draw.text((1200, 790), "可恢复 · 可交接 · 可核对", font=font(25, bold=True), fill=GREEN)
        elif scene["kind"] == "motion_mission":
            labels = ("模型", "CUDA", "图表", "论文", "审校", "发布")
            positions = [(230 + index * 290, 600 + int(90 * math.sin(index * 1.2))) for index in range(6)]
            for index in range(5):
                draw.line((*positions[index], *positions[index + 1]), fill=(65, 124, 139, 170), width=7)
            task_progress = clamp((seconds - 1.2) / 8.0 * 6)
            for index, (position, label) in enumerate(zip(positions, labels, strict=True)):
                draw_node(draw, position, label, clamp(task_progress - index), radius=42)
            segment = min(4, int(clamp((seconds - 1.0) / 8.5) * 5))
            local = clamp((seconds - 1.0) / 8.5 * 5 - segment)
            artifact_x = int(positions[segment][0] * (1 - local) + positions[segment + 1][0] * local)
            artifact_y = int(positions[segment][1] * (1 - local) + positions[segment + 1][1] * local) - 100
            draw.rounded_rectangle((artifact_x - 30, artifact_y - 22, artifact_x + 30, artifact_y + 22), radius=11, fill=AMBER)
            draw.text((artifact_x - 9, artifact_y - 14), "A", font=font(18, bold=True), fill=BG)
            screenshot_reveal = phase(seconds, 9.0, 1.0)
            if screenshot_reveal > 0:
                x0 = int(width - 760 * screenshot_reveal)
                paste_evidence(image, sources["mission-overview-7884.png"], (x0, 230, x0 + 710, 820), alpha=int(245 * screenshot_reveal))
                draw.rounded_rectangle((x0 + 18, 248, x0 + 350, 290), radius=12, fill=(8, 16, 22, 220))
                draw.text((x0 + 34, 257), "真实 7884 · 6 个 Task", font=font(18, bold=True), fill=AMBER)
        elif scene["kind"] == "motion_execution":
            labels = ("Acquire", "Train", "Visualize", "Write", "Review", "Publish")
            y = 630
            positions = [(180 + index * 310, y) for index in range(6)]
            progress = clamp((seconds - 0.8) / 8.0 * 6)
            for index, position in enumerate(positions):
                if index < 5:
                    draw.line((position[0] + 48, y, positions[index + 1][0] - 48, y), fill=(63, 119, 132, 180), width=6)
                draw_node(draw, position, labels[index], clamp(progress - index), radius=40)
            window = phase(seconds, 8.6, 0.9)
            if window > 0:
                first_x = int(80 + (1 - window) * 900)
                second_x = int(1000 + (1 - window) * 900)
                paste_evidence(image, sources["cuda-task-7884.png"], (first_x, 260, first_x + 800, 780), alpha=int(255 * window))
                paste_evidence(image, sources["publication-task-7884.png"], (second_x, 260, second_x + 800, 780), alpha=int(255 * window))
                scan_x = int(first_x + (seconds * 180) % 800)
                draw.line((scan_x, 270, scan_x, 770), fill=(64, 214, 216, 130), width=5)
        elif scene["kind"] == "motion_monitor":
            wipe = phase(seconds, 0.8, 1.0)
            screen_x = int(width - wipe * 980)
            paste_evidence(image, sources["ready-desktop.png"], (screen_x, 210, screen_x + 930, 850), alpha=int(250 * wipe))
            chart = (110, 430, 840, 800)
            draw.rounded_rectangle(chart, radius=24, fill=(8, 17, 25, 232), outline=(60, 91, 106), width=2)
            draw.text((142, 458), "VALIDATION MACRO-F1", font=font(20, bold=True), fill=MUTED)
            values = (0.8196, 0.8340, 0.8343)
            names = ("BASE", "FREEZE", "SMOOTH")
            reveal = clamp((seconds - 2.0) / 6.0 * 3)
            points: list[tuple[int, int]] = []
            for index, value in enumerate(values):
                x = 180 + index * 275
                y_value = int(720 - (value - 0.81) / 0.03 * 230)
                if reveal >= index:
                    points.append((x, y_value))
                    draw.ellipse((x - 13, y_value - 13, x + 13, y_value + 13), fill=GREEN if index == 2 else CYAN)
                    draw.text((x - 48, 746), names[index], font=font(17, bold=True), fill=MUTED)
                    draw.text((x - 34, y_value - 44), f"{value:.4f}", font=font(18, bold=True), fill=INK)
            if len(points) > 1:
                draw.line(points, fill=GREEN, width=7)
            inference = phase(seconds, 9.0, 0.8)
            if inference > 0:
                y0 = int(880 - inference * 650)
                paste_evidence(image, sources["inference-success-desktop.png"], (940, y0, 1810, y0 + 600), alpha=int(250 * inference))
        elif scene["kind"] == "motion_results":
            artifact_names = ("best-model-architecture.png", "best-experiment-lifecycle.png", "paper-1.png", "paper-2.png")
            final_boxes = ((120, 350, 780, 790), (820, 350, 1480, 790), (1500, 310, 1800, 750), (1550, 360, 1850, 800))
            for index, (name, box) in enumerate(zip(artifact_names, final_boxes, strict=True)):
                enter = phase(seconds, 0.8 + index * 2.0, 1.2)
                x0, y0, x1, y1 = box
                start_x = -700 if index % 2 == 0 else width + 300
                start_y = 950 if index < 2 else -500
                current_x = int(start_x * (1 - enter) + x0 * enter)
                current_y = int(start_y * (1 - enter) + y0 * enter)
                paste_evidence(image, sources[name], (current_x, current_y, current_x + (x1 - x0), current_y + (y1 - y0)), alpha=int(255 * enter))
            assembly = phase(seconds, 10.0, 3.0)
            if assembly > 0:
                draw.line((420, 850, 960, 900, 1650, 850), fill=(250, 170, 64, int(220 * assembly)), width=8)
                draw.ellipse((940, 880, 980, 920), fill=AMBER)
                draw.text((685, 835), "MODEL", font=font(18, bold=True), fill=CYAN)
                draw.text((1010, 915), "REVIEWED DELIVERY", font=font(22, bold=True), fill=GREEN)

        draw_motion_subtitle(draw, scene, width, height)
        if frame_index < int(0.25 * fps):
            alpha = int(255 * (1 - frame_index / (0.25 * fps)))
            draw.rectangle((0, 0, width, height), fill=(0, 0, 0, alpha))
        remaining = total_frames - frame_index
        if remaining < int(0.3 * fps):
            alpha = int(255 * (1 - remaining / (0.3 * fps)))
            draw.rectangle((0, 0, width, height), fill=(0, 0, 0, alpha))
        process.stdin.write(image.convert("RGB").tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError(f"Motion scene encoding failed: {scene['id']}")


def render_typewriter(scene: dict[str, Any], storyboard: dict[str, Any], output_video: Path) -> None:
    width, height, fps = (storyboard["canvas"][key] for key in ("width", "height", "fps"))
    duration = float(scene["duration"])
    total_frames = round(duration * fps)
    command = "\n".join(scene["command"])
    typing_frames = max(1, total_frames - round(2.2 * fps))
    process = subprocess.Popen(
        ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{width}x{height}", "-r", str(fps), "-i", "-", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(output_video)],
        stdin=subprocess.PIPE,
    )
    assert process.stdin is not None
    for frame_index in range(total_frames):
        progress = min(1.0, frame_index / typing_frames)
        visible = command[: round(len(command) * progress)]
        image = gradient_canvas(width, height)
        draw = draw_motion_background(image, frame_index)
        draw_brand(draw, storyboard, width)
        draw.text((80, 154), scene["eyebrow"], font=font(22, bold=True), fill=CYAN)
        draw.text((80, 206), scene["title"], font=font(48, bold=True), fill=INK)
        draw.rounded_rectangle((76, 310, width - 76, 846), radius=28, fill=(7, 11, 16), outline=(39, 63, 76), width=2)
        draw.ellipse((106, 340, 126, 360), fill=(255, 95, 87))
        draw.ellipse((139, 340, 159, 360), fill=(254, 188, 46))
        draw.ellipse((172, 340, 192, 360), fill=(40, 200, 64))
        draw.text((218, 335), "mission / opencorvus", font=font(19, mono=True), fill=MUTED)
        draw.multiline_text((116, 398), visible + ("▌" if frame_index // 12 % 2 == 0 else ""), font=font(29, mono=True), fill=(197, 238, 222), spacing=18)
        draw.rounded_rectangle((72, 912, width - 72, 1014), radius=24, fill=(11, 17, 24), outline=(38, 54, 66), width=2)
        draw.text((102, 942), scene["subtitle"], font=font(24, bold=True), fill=INK)
        process.stdin.write(image.tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("FFmpeg typewriter encoding failed")


def encode_static(image_path: Path, output_video: Path, duration: float, fps: int) -> None:
    fade_out = max(0.0, duration - 0.35)
    frames = max(1, round(duration * fps))
    run([
        "ffmpeg", "-y", "-loop", "1", "-i", str(image_path), "-t", str(duration),
        "-vf", f"zoompan=z='min(zoom+0.00012,1.03)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps={fps},fade=t=in:st=0:d=0.25,fade=t=out:st={fade_out}:d=0.35,format=yuv420p",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", str(output_video),
    ])


def render_h3_overlay(scene: dict[str, Any], storyboard: dict[str, Any]) -> Image.Image:
    width = storyboard["canvas"]["width"]
    height = storyboard["canvas"]["height"]
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((64, 42, 344, 116), radius=22, fill=(9, 18, 26, 220), outline=CYAN, width=2)
    draw.text((92, 61), "OPEN", font=font(24, bold=True), fill=INK)
    draw.text((176, 61), "CORVUS", font=font(24, bold=True), fill=CYAN)
    draw.rounded_rectangle((64, 146, 1120, 430), radius=30, fill=(6, 12, 18, 184))
    draw.text((92, 174), scene.get("eyebrow", ""), font=font(21, bold=True), fill=CYAN)
    draw_wrapped(draw, scene["title"], (92, 222), font(56, bold=True), INK, 950, spacing=8)
    draw.rounded_rectangle((64, 910, width - 64, 1022), radius=25, fill=(6, 12, 18, 218), outline=(54, 74, 88), width=2)
    draw_wrapped(draw, scene.get("subtitle", ""), (96, 938), font(25, bold=True), INK, width - 192, spacing=6)
    return overlay


def encode_h3(scene: dict[str, Any], storyboard: dict[str, Any], h3_path: Path, overlay_path: Path, output_video: Path) -> None:
    width, height, fps = (storyboard["canvas"][key] for key in ("width", "height", "fps"))
    duration = scene["duration"]
    run([
        "ffmpeg", "-y", "-stream_loop", "-1", "-i", str(h3_path), "-loop", "1", "-i", str(overlay_path),
        "-filter_complex", f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},fps={fps},trim=duration={duration}[bg];[1:v]format=rgba[ov];[bg][ov]overlay=0:0:shortest=1,format=yuv420p[v]",
        "-map", "[v]", "-t", str(duration), "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", str(output_video),
    ])


def compose(output: Path, *, final: bool) -> Path:
    storyboard = load_storyboard(require_approved=True)
    prepare(output)
    work = output / ("work-final" if final else "work-animatic")
    scenes_dir = work / "scenes"
    stills = work / "stills"
    scenes_dir.mkdir(parents=True, exist_ok=True)
    stills.mkdir(parents=True, exist_ok=True)
    clips: list[Path] = []
    for index, scene in enumerate(storyboard["scenes"]):
        clip = scenes_dir / f"{index:02d}-{scene['id']}.mp4"
        still = stills / f"{index:02d}-{scene['id']}.png"
        if scene["kind"] == "typewriter":
            render_typewriter(scene, storyboard, clip)
        elif scene["kind"] == "h3" and final:
            h3 = output / "h3-local" / f"{scene['id']}.mp4"
            if not h3.exists():
                raise FileNotFoundError(f"Final composition requires real local H3 clip: {h3}")
            overlay = render_h3_overlay(scene, storyboard)
            overlay.save(still)
            encode_h3(scene, storyboard, h3, still, clip)
        elif scene["kind"].startswith("motion_") or (scene["kind"] == "h3" and not final):
            render_motion_scene(scene, storyboard, output, clip, placeholder_h3=scene["kind"] == "h3")
        else:
            render_scene(scene, storyboard, output, placeholder=scene["kind"] == "h3").save(still)
            encode_static(still, clip, float(scene["duration"]), storyboard["canvas"]["fps"])
        clips.append(clip)

    concat = work / "concat.txt"
    concat.write_text("".join(f"file '{path.as_posix()}'\n" for path in clips), encoding="utf-8")
    video_only = work / "video-only.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(video_only)])
    total_duration = sum(float(scene["duration"]) for scene in storyboard["scenes"])
    destination = output / ("final" if final else "draft") / ("opencorvus-long-mission-h3.mp4" if final else "opencorvus-long-mission-animatic.mp4")
    destination.parent.mkdir(parents=True, exist_ok=True)
    voiceover = output / "voice" / "voiceover.wav"
    if voiceover.exists():
        run([
            "ffmpeg", "-y", "-i", str(video_only), "-f", "lavfi", "-t", str(total_duration),
            "-i", "anoisesrc=color=pink:amplitude=0.009:sample_rate=48000", "-i", str(voiceover),
            "-filter_complex", "[1:a]volume=0.22[bed];[2:a]volume=1.0[voice];[bed][voice]amix=inputs=2:duration=first:normalize=0[a]",
            "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-shortest", str(destination),
        ])
    else:
        run([
            "ffmpeg", "-y", "-i", str(video_only), "-f", "lavfi", "-t", str(total_duration),
            "-i", "anoisesrc=color=pink:amplitude=0.012:sample_rate=48000",
            "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-shortest", str(destination),
        ])
    return destination


def media_duration(path: Path) -> float:
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)], capture=True).stdout.strip())


async def synthesize_voice(text: str, destination: Path, voice: str, rate: str) -> None:
    try:
        import edge_tts
    except ImportError as error:
        raise RuntimeError("Install script/video/minimax-h3-mission-promo/requirements.txt before generating voiceover") from error
    destination.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
    await communicate.save(str(destination))


def generate_voiceover(output: Path, *, voice: str, rate: str) -> Path:
    storyboard = load_storyboard(require_approved=True)
    voice_root = output / "voice"
    raw_root = voice_root / "raw"
    timed_root = voice_root / "timed"
    raw_root.mkdir(parents=True, exist_ok=True)
    timed_root.mkdir(parents=True, exist_ok=True)
    timed_files: list[Path] = []
    manifest: list[dict[str, Any]] = []
    for index, scene in enumerate(storyboard["scenes"]):
        raw = raw_root / f"{index:02d}-{scene['id']}.mp3"
        timed = timed_root / f"{index:02d}-{scene['id']}.wav"
        asyncio.run(synthesize_voice(scene["narration"], raw, voice, rate))
        raw_duration = media_duration(raw)
        target = float(scene["duration"])
        filters: list[str] = []
        if raw_duration > target - 0.6:
            tempo = raw_duration / max(0.5, target - 0.6)
            # atempo supports 0.5..100 in current FFmpeg; keep one explicit factor.
            filters.append(f"atempo={tempo:.6f}")
        filters.extend([f"apad=pad_dur={target}", f"atrim=0:{target}"])
        run(["ffmpeg", "-y", "-i", str(raw), "-af", ",".join(filters), "-ar", "48000", "-ac", "2", str(timed)])
        timed_files.append(timed)
        manifest.append({"scene": scene["id"], "text": scene["narration"], "target_seconds": target, "raw_seconds": raw_duration, "voice": voice, "rate": rate})
    concat = voice_root / "concat.txt"
    concat.write_text("".join(f"file '{path.as_posix()}'\n" for path in timed_files), encoding="utf-8")
    destination = voice_root / "voiceover.wav"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(destination)])
    (output / "reports").mkdir(parents=True, exist_ok=True)
    (output / "reports" / "voiceover-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return destination


def inspect_video(output: Path, *, final: bool) -> dict[str, Any]:
    storyboard = load_storyboard()
    video = output / ("final" if final else "draft") / ("opencorvus-long-mission-h3.mp4" if final else "opencorvus-long-mission-animatic.mp4")
    if not video.exists():
        raise FileNotFoundError(video)
    probe = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)], capture=True).stdout)
    video_stream = next(stream for stream in probe["streams"] if stream["codec_type"] == "video")
    audio_stream = next((stream for stream in probe["streams"] if stream["codec_type"] == "audio"), None)
    frames_dir = output / "frames" / ("final" if final else "animatic")
    frames_dir.mkdir(parents=True, exist_ok=True)
    checkpoints: list[dict[str, Any]] = []
    cursor = 0.0
    thumbs: list[tuple[str, Image.Image]] = []
    for scene in storyboard["scenes"]:
        duration = float(scene["duration"])
        offsets = {
            "start": min(0.8, duration * 0.12),
            "middle": duration / 2,
            "end": max(duration * 0.88, duration - 0.8),
        }
        scene_frames: list[Image.Image] = []
        frame_checks: list[dict[str, Any]] = []
        for label, offset in offsets.items():
            timestamp = cursor + offset
            path = frames_dir / f"{scene['id']}-{label}.png"
            run(["ffmpeg", "-y", "-ss", f"{timestamp:.3f}", "-i", str(video), "-frames:v", "1", "-update", "1", str(path)])
            frame = Image.open(path).convert("RGB")
            luminance = ImageStat.Stat(frame.convert("L")).mean[0]
            frame_checks.append({"phase": label, "timestamp": timestamp, "luminance": luminance, "black": luminance < 8})
            scene_frames.append(frame)
            thumbs.append((f"{scene['id']} · {label}", fit_crop(frame, (480, 270))))
        differences = [
            ImageStat.Stat(ImageChops.difference(scene_frames[index], scene_frames[index + 1]).convert("L")).mean[0]
            for index in range(len(scene_frames) - 1)
        ]
        checkpoints.append(
            {
                "scene": scene["id"],
                "kind": scene["kind"],
                "frames": frame_checks,
                "intra_scene_differences": differences,
                "motion_verified": all(value > 0.5 for value in differences),
            }
        )
        cursor += duration

    sheet = Image.new("RGB", (1440, len(storyboard["scenes"]) * 320), BG)
    sheet_draw = ImageDraw.Draw(sheet)
    for index, (label, thumb) in enumerate(thumbs):
        row, col = divmod(index, 3)
        x, y = col * 480, row * 320
        sheet.paste(thumb, (x, y))
        sheet_draw.rectangle((x, y + 270, x + 480, y + 320), fill=(13, 20, 29))
        sheet_draw.text((x + 18, y + 282), label, font=font(19, bold=True), fill=CYAN)
    sheet_path = frames_dir / "contact-sheet.jpg"
    sheet.save(sheet_path, quality=92)
    expected_duration = sum(float(scene["duration"]) for scene in storyboard["scenes"])
    report = {
        "video": str(video),
        "contact_sheet": str(sheet_path),
        "duration": float(probe["format"]["duration"]),
        "expected_duration": expected_duration,
        "width": int(video_stream["width"]),
        "height": int(video_stream["height"]),
        "video_codec": video_stream["codec_name"],
        "audio_codec": None if audio_stream is None else audio_stream["codec_name"],
        "checkpoints": checkpoints,
    }
    report["passed"] = (
        report["width"] == 1920
        and report["height"] == 1080
        and report["video_codec"] == "h264"
        and report["audio_codec"] == "aac"
        and abs(report["duration"] - expected_duration) <= 0.5
        and all(not frame["black"] for item in checkpoints for frame in item["frames"])
        and all(item["motion_verified"] for item in checkpoints)
    )
    reports = output / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    report_path = reports / ("frame-check-final.json" if final else "frame-check-animatic.json")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if not report["passed"]:
        raise RuntimeError(f"Video inspection failed; see {report_path}")
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("prepare", "voice", "animatic", "compose", "inspect"))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--final", action="store_true")
    parser.add_argument("--voice", default="zh-CN-YunxiNeural")
    parser.add_argument("--rate", default="+4%")
    args = parser.parse_args()
    if args.command == "prepare":
        prepare(args.output)
        print(args.output / "reports" / "evidence-manifest.json")
    elif args.command == "voice":
        print(generate_voiceover(args.output, voice=args.voice, rate=args.rate))
    elif args.command == "animatic":
        print(compose(args.output, final=False))
    elif args.command == "compose":
        print(compose(args.output, final=True))
    elif args.command == "inspect":
        print(json.dumps(inspect_video(args.output, final=args.final), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
