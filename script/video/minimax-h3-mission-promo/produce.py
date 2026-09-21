from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import math
import os
import shutil
import subprocess
from functools import lru_cache
from importlib.metadata import PackageNotFoundError, version as package_version
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageStat


HERE = Path(__file__).resolve().parent
STORYBOARD_PATH = HERE / "storyboard.zh-CN.json"
DEFAULT_OUTPUT = Path(r"D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824")
MISSION_ROOT = Path(r"D:\myhexin-local\demos\deberta-absa-builtins-mission-rerun2-20260823")
PROMO_ASSET_ROOT = HERE / "assets" / "promo-redraw"
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


def load_storyboard_source(*, require_approved: bool = False) -> tuple[dict[str, Any], str]:
    source = STORYBOARD_PATH.read_bytes()
    storyboard = json.loads(source.decode("utf-8"))
    if require_approved and storyboard.get("production_status") != "approved":
        raise RuntimeError(
            "The current storyboard was rejected and is blocked from production. "
            "Approve creative-brief-v2.zh-CN.md, rewrite the storyboard, and set production_status to approved first."
        )
    return storyboard, hashlib.sha256(source).hexdigest()


def load_storyboard(*, require_approved: bool = False) -> dict[str, Any]:
    storyboard, _ = load_storyboard_source(require_approved=require_approved)
    return storyboard


def storyboard_digest() -> str:
    return hashlib.sha256(STORYBOARD_PATH.read_bytes()).hexdigest()


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
        "agent-dock-overview-7884.png": screenshots / "agent-dock-overview-7884.png",
        "agent-implementation-loaded-7884.png": screenshots / "agent-implementation-loaded-7884.png",
        "agent-test-review-7884.png": screenshots / "agent-test-review-7884.png",
        "agent-system-review-7884.png": screenshots / "agent-system-review-7884.png",
        "agent-research-squad-7884.png": screenshots / "agent-research-squad-7884.png",
        "ready-desktop.png": assets / "ready-desktop.png",
        "inference-success-desktop.png": assets / "inference-success-desktop.png",
        "best-model-architecture.png": assets / "best-model-architecture.png",
        "best-experiment-lifecycle.png": assets / "best-experiment-lifecycle.png",
        "paper-1.png": assets / "paper-1.png",
        "paper-2.png": assets / "paper-2.png",
        "architecture-promo-v1.png": assets / "architecture-promo-v1.png",
        "lifecycle-promo-v1.png": assets / "lifecycle-promo-v1.png",
        "brand-opener-v1.png": assets / "brand-opener-v1.png",
        "brand-outro-v1.png": assets / "brand-outro-v1.png",
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
        PROMO_ASSET_ROOT / "architecture-promo-v1.png": assets / "architecture-promo-v1.png",
        PROMO_ASSET_ROOT / "lifecycle-promo-v1.png": assets / "lifecycle-promo-v1.png",
        PROMO_ASSET_ROOT / "brand-opener-v1.png": assets / "brand-opener-v1.png",
        PROMO_ASSET_ROOT / "brand-outro-v1.png": assets / "brand-outro-v1.png",
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


def camera_frame(
    source: Image.Image,
    size: tuple[int, int],
    *,
    zoom: float = 1.0,
    pan_x: float = 0.5,
    pan_y: float = 0.5,
) -> Image.Image:
    """Return one full-bleed camera frame without fabricating source content."""
    fitted = fit_crop(source, size)
    zoom = max(1.0, zoom)
    crop_w = max(1, round(size[0] / zoom))
    crop_h = max(1, round(size[1] / zoom))
    left = round(clamp(pan_x) * (size[0] - crop_w))
    top = round(clamp(pan_y) * (size[1] - crop_h))
    return fitted.crop((left, top, left + crop_w, top + crop_h)).resize(size, Image.Resampling.LANCZOS)


def composite_camera(
    image: Image.Image,
    source: Image.Image,
    *,
    zoom: float = 1.0,
    pan_x: float = 0.5,
    pan_y: float = 0.5,
    alpha: int = 255,
) -> None:
    frame = camera_frame(source, image.size, zoom=zoom, pan_x=pan_x, pan_y=pan_y).convert("RGBA")
    if alpha < 255:
        frame.putalpha(alpha)
    image.paste(frame, (0, 0), frame)


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
                reveal = phase(seconds, duration * (0.12 + row_index * 0.24), max(0.8, duration * 0.08))
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
        elif scene["kind"] == "motion_user_pain":
            is_gap = scene["id"] == "multi-agent-gap"
            cards = (
                ("你", "请把这个项目完整做完", CYAN),
                ("Agent", "已完成。", GREEN),
                ("你", "测试呢？网页为什么打不开？", AMBER),
                ("新会话", "请重新提供项目背景。", (255, 103, 91)),
            ) if not is_gap else (
                ("Agent A", "我负责调研……大概。", CYAN),
                ("Agent B", "上个 Agent 交了什么？", AMBER),
                ("Agent C", "失败前运行到哪里？", (255, 103, 91)),
                ("你", "等等，我再整理一次上下文。", (225, 230, 235)),
            )
            for index, (speaker, message, color) in enumerate(cards):
                reveal = phase(seconds, 0.8 + index * (duration - 3.0) / len(cards), 0.65)
                side = index % 2
                x = int((-720 + reveal * 850) if side == 0 else (width + 80 - reveal * 850))
                y = 330 + index * 130
                draw.rounded_rectangle((x, y, x + 690, y + 98), radius=26, fill=(12, 23, 32, 240), outline=(*color, 230), width=3)
                draw.text((x + 26, y + 18), speaker, font=font(18, bold=True), fill=color)
                draw.text((x + 134, y + 16), message, font=font(25, bold=True), fill=INK)
            checklist = ("资料", "测试", "网页", "论文") if not is_gap else ("责任", "恢复点", "产物来源", "独立验收")
            reveal_start = duration * 0.55
            for index, label in enumerate(checklist):
                reveal = phase(seconds, reveal_start + index * 0.85, 0.5)
                x = 280 + index * 360
                y = 850
                draw.rounded_rectangle((x, y, x + 260, y + 58), radius=16, fill=(31, 17, 19, int(220 * reveal)), outline=(255, 103, 91, int(240 * reveal)), width=2)
                draw.text((x + 24, y + 14), f"×  {label}", font=font(20, bold=True), fill=(255, 135, 123, int(255 * reveal)))
        elif scene["kind"] in ("motion_workflow", "motion_personal_chain"):
            stages = (
                ("调研", "EVIDENCE", CYAN),
                ("设计", "ARCHITECTURE", (111, 174, 232)),
                ("实现", "BUILD", AMBER),
                ("测试", "VERIFY", (198, 214, 220)),
                ("部署", "DELIVER", GREEN),
            )
            stage_float = clamp((seconds - 0.8) / max(1.0, duration - 2.0)) * len(stages)
            stage_index = min(len(stages) - 1, int(stage_float))
            local = stage_float - stage_index
            artifact_x = int(330 + (stage_index + ease(local)) * 315)
            baseline_y = 650
            draw.line((230, baseline_y, 1710, baseline_y), fill=(54, 102, 116, 170), width=7)
            draw.line((230, baseline_y, artifact_x, baseline_y), fill=(*stages[stage_index][2], 230), width=9)
            for index, (label, english, color) in enumerate(stages):
                x = 290 + index * 315
                completed = stage_float >= index + 0.86
                current = index == stage_index
                draw.text((x - 56, 760), f"0{index + 1}", font=font(18, bold=True), fill=color if current else MUTED)
                draw.text((x - 56, 800), label, font=font(30, bold=True), fill=INK if completed or current else MUTED)
                draw.text((x - 56, 842), english, font=font(14, bold=True), fill=color if current else (85, 105, 116))
            # One artifact changes form as it crosses the continuous workflow.
            glow = 34 + int(24 * (0.5 + 0.5 * math.sin(seconds * 3.0)))
            draw.ellipse((artifact_x - 92, baseline_y - 152, artifact_x + 92, baseline_y + 32), fill=(*stages[stage_index][2], glow))
            draw.rounded_rectangle((artifact_x - 72, baseline_y - 132, artifact_x + 72, baseline_y + 12), radius=18, fill=(8, 15, 22, 245), outline=stages[stage_index][2], width=4)
            if stage_index == 0:
                for line in range(5):
                    draw.line((artifact_x - 44, baseline_y - 98 + line * 18, artifact_x + 36, baseline_y - 98 + line * 18), fill=(178, 211, 220), width=4)
                draw.ellipse((artifact_x + 16, baseline_y - 76, artifact_x + 50, baseline_y - 42), outline=CYAN, width=4)
                draw.line((artifact_x + 42, baseline_y - 49, artifact_x + 61, baseline_y - 30), fill=CYAN, width=5)
            elif stage_index == 1:
                for step in range(-44, 45, 22):
                    draw.line((artifact_x + step, baseline_y - 112, artifact_x + step, baseline_y - 8), fill=(83, 125, 152), width=2)
                for step in range(-108, 0, 22):
                    draw.line((artifact_x - 58, baseline_y + step, artifact_x + 58, baseline_y + step), fill=(83, 125, 152), width=2)
                draw.rectangle((artifact_x - 34, baseline_y - 84, artifact_x + 34, baseline_y - 34), outline=(111, 174, 232), width=4)
            elif stage_index == 2:
                draw.text((artifact_x - 50, baseline_y - 102), "</>", font=font(38, bold=True, mono=True), fill=AMBER)
                draw.line((artifact_x - 48, baseline_y - 36, artifact_x + 48, baseline_y - 36), fill=(173, 126, 52), width=4)
            elif stage_index == 3:
                for row in range(3):
                    y = baseline_y - 101 + row * 31
                    draw.line((artifact_x - 42, y, artifact_x - 30, y + 12), fill=GREEN, width=5)
                    draw.line((artifact_x - 30, y + 12, artifact_x - 10, y - 12), fill=GREEN, width=5)
                    draw.line((artifact_x + 2, y, artifact_x + 48, y), fill=(188, 204, 211), width=4)
            else:
                draw.rectangle((artifact_x - 42, baseline_y - 102, artifact_x + 42, baseline_y - 28), outline=GREEN, width=5)
                draw.line((artifact_x - 42, baseline_y - 78, artifact_x, baseline_y - 52), fill=GREEN, width=5)
                draw.line((artifact_x, baseline_y - 52, artifact_x + 42, baseline_y - 78), fill=GREEN, width=5)
                draw.ellipse((artifact_x - 14, baseline_y - 12, artifact_x + 14, baseline_y + 16), fill=GREEN)
            if stage_index < len(stages) - 1 and local > 0.7:
                draw.text((artifact_x + 104, baseline_y - 92), "HANDOFF", font=font(18, bold=True), fill=AMBER)
        elif scene["kind"] == "motion_comparison":
            products = (
                ("WorkBuddy", "商业云端办公 Agent", "一句话交付 · Expert Group", (167, 203, 255)),
                ("DeepSeek Harness", "开发者可组合运行时", "插件化 · 运行可追踪", (188, 168, 255)),
                ("Codex", "软件工程 Agent", "隔离环境 · 并行任务", (164, 236, 206)),
                ("Claude Code", "编码与并行协作", "Subagent · Agent Teams", (245, 176, 122)),
                ("OpenCorvus", "开源长程 Mission", "专家团接力 · 自托管 · 验收", CYAN),
            )
            focus_float = clamp((seconds - 0.8) / max(1.0, duration - 2.0)) * len(products)
            focus_index = min(len(products) - 1, int(focus_float))
            for index, (name, role, ability, color) in enumerate(products):
                y = 300 + index * 118
                focused = index == focus_index
                reveal = phase(seconds, 0.45 + index * 0.4, 0.55)
                x = int(-900 + reveal * 1020)
                right = 1800 if focused else 1680
                fill = (13, 30, 39, 245) if focused else (10, 19, 27, 210)
                draw.rounded_rectangle((x, y, right, y + 92), radius=22, fill=fill, outline=(*color, 245 if focused else 110), width=4 if focused else 2)
                draw.text((x + 28, y + 18), name, font=font(24, bold=True), fill=color if focused else INK)
                draw.text((x + 350, y + 18), role, font=font(22, bold=True), fill=INK if focused else MUTED)
                draw.text((x + 930, y + 20), ability, font=font(19, bold=True), fill=color if focused else MUTED)
                if focused:
                    scan_x = int(x + 10 + ((seconds * 180) % max(20, right - x - 20)))
                    draw.line((scan_x, y + 8, scan_x, y + 84), fill=(*color, 120), width=3)
            draw.text((130, 888), "不是同一张能力榜：它们解决的是不同层的问题。", font=font(22, bold=True), fill=(197, 211, 219))
        elif scene["kind"] == "motion_compare":
            normalized = clamp(seconds / max(1.0, duration))
            draw.line((960, 288, 960, 850), fill=(91, 115, 128, 120), width=2)
            draw.text((160, 300), "ONLY CURRENT CONTEXT", font=font(22, bold=True), fill=(255, 135, 112))
            draw.text((1070, 300), "DURABLE MISSION LAYER", font=font(22, bold=True), fill=GREEN)
            # Left: early constraints are physically displaced as the buffer fills.
            draw.rounded_rectangle((150, 380, 830, 468), radius=20, fill=(15, 23, 31), outline=(83, 97, 106), width=2)
            fill_ratio = clamp(normalized * 1.55)
            draw.rounded_rectangle((154, 384, 154 + int(672 * fill_ratio), 464), radius=18, fill=(215, 97, 70, 210))
            draw.text((172, 402), "CONTEXT BUFFER", font=font(19, bold=True), fill=INK)
            constraints = ("目标", "约束", "计划", "证据", "修正")
            for index, label in enumerate(constraints):
                y = 540 + index * 58
                fade_start = 0.28 + index * 0.08
                alpha = int(230 * (1 - clamp((normalized - fade_start) / 0.28)))
                draw.text((180, y), label, font=font(23, bold=True), fill=(185, 201, 208, alpha))
                draw.line((300, y + 17, 760, y + 17), fill=(74, 91, 102, alpha), width=3)
            lost = phase(normalized, 0.67, 0.18)
            if lost > 0:
                draw.text((260, 808), "EARLY STATE EVICTED", font=font(30, bold=True), fill=(255, 103, 91, int(255 * lost)))
            # Right: the missing capabilities become explicit, durable surfaces.
            facts = (
                ("01", "PERSIST RESPONSIBILITY", "责任与状态跨会话保存"),
                ("02", "RESUME FROM FACTS", "中断后从正确位置恢复"),
                ("03", "TRACE ARTIFACTS", "下游消费带来源产物"),
                ("04", "INDEPENDENT ACCEPT", "由独立角色判断完成"),
            )
            for index, (number, title, detail) in enumerate(facts):
                y = 388 + index * 112
                reveal = phase(normalized, 0.1 + index * 0.17, 0.12)
                x = int(1880 - reveal * 790)
                draw.line((x, y + 72, x + 700, y + 72), fill=(57, 113, 103, int(180 * reveal)), width=2)
                draw.text((x, y), number, font=font(17, bold=True), fill=GREEN)
                draw.text((x + 52, y - 5), title, font=font(24, bold=True), fill=INK)
                draw.text((x + 52, y + 34), detail, font=font(18, bold=True), fill=(167, 188, 197))
            pulse = 0.5 + 0.5 * math.sin(seconds * 2.1)
            draw.rounded_rectangle((1090, 806, 1780, 858), radius=16, fill=(5, 20, 16), outline=GREEN, width=2)
            draw.rectangle((1094, 810, 1094 + int(682 * normalized), 854), fill=(48, 170, 116, int(80 + 60 * pulse)))
            draw.text((1300, 820), "RECOVERABLE · TRACEABLE · REVIEWED", font=font(18, bold=True), fill=(225, 255, 241))
        elif scene["kind"] == "motion_mission":
            progress = clamp(seconds / max(1.0, duration))
            zoom = 1.03 + 0.75 * progress
            pan_x = 0.1 + 0.18 * progress
            pan_y = 0.5
            composite_camera(image, sources["mission-overview-7884.png"], zoom=zoom, pan_x=pan_x, pan_y=pan_y)
            veil = Image.new("RGBA", image.size, (0, 0, 0, 0))
            veil_draw = ImageDraw.Draw(veil)
            veil_draw.rectangle((0, 0, width, height), fill=(3, 8, 13, 72))
            veil_draw.rectangle((990, 185, 1870, 866), fill=(3, 10, 16, 205))
            image.paste(veil, (0, 0), veil)
            draw = ImageDraw.Draw(image, "RGBA")
            scan_y = int(335 + ((seconds * 72) % 470))
            draw.rectangle((70, scan_y - 12, 720, scan_y + 12), fill=(70, 220, 224, 26))
            draw.line((70, scan_y, 720, scan_y), fill=(87, 226, 230, 150), width=3)
            facts = (
                ("01", "TASK LOCK", "精确专家团版本 + 工作流"),
                ("02", "DURABLE STATE", "中断后从正确位置恢复"),
                ("03", "ARTIFACT LINEAGE", "带来源的团队交接"),
                ("04", "INDEPENDENT REVIEW", "完成必须经过验收"),
            )
            for index, (number, label, detail) in enumerate(facts):
                reveal = phase(seconds, 2.0 + index * 5.4, 0.9)
                y = 305 + index * 132
                x = int(1940 - reveal * 900)
                color = CYAN if index < 2 else (AMBER if index == 2 else GREEN)
                draw.text((x, y), number, font=font(18, bold=True), fill=color)
                draw.text((x + 58, y - 4), label, font=font(25, bold=True), fill=INK)
                draw.text((x + 58, y + 38), detail, font=font(18, bold=True), fill=(170, 190, 200))
                draw.line((x + 58, y + 76, x + 730, y + 76), fill=(*color, 110), width=2)
            draw.rounded_rectangle((72, 180, 510, 226), radius=14, fill=(5, 13, 19, 220), outline=CYAN, width=2)
            draw.text((94, 191), "REAL MISSION UI · 6 COMPLETED TASKS", font=font(17, bold=True), fill=CYAN)
        elif scene["kind"] == "motion_execution":
            thirds = duration / 3.0
            phase_index = min(2, int(seconds / thirds))
            local = (seconds - phase_index * thirds) / thirds
            source_names = ("mission-overview-7884.png", "cuda-task-7884.png", "publication-task-7884.png")
            labels = ("MISSION DISPATCH", "CUDA TASK COMPLETED", "PUBLICATION TASK COMPLETED")
            colors = (CYAN, AMBER, GREEN)
            composite_camera(
                image,
                sources[source_names[phase_index]],
                zoom=1.06 + 0.34 * ease(local),
                pan_x=(0.08, 0.18, 0.15)[phase_index],
                pan_y=0.46,
            )
            dark = Image.new("RGBA", image.size, (0, 0, 0, 0))
            dark_draw = ImageDraw.Draw(dark)
            dark_draw.rectangle((0, 0, width, 170), fill=(2, 7, 11, 224))
            dark_draw.rectangle((0, 802, width, height), fill=(2, 7, 11, 220))
            image.paste(dark, (0, 0), dark)
            draw = ImageDraw.Draw(image, "RGBA")
            draw.text((72, 54), labels[phase_index], font=font(25, bold=True), fill=colors[phase_index])
            draw.text((72, 95), "REAL OPEN CORVUS SESSION", font=font(15, bold=True), fill=(176, 194, 202))
            scan_x = int((seconds * 210) % width)
            draw.rectangle((scan_x - 25, 170, scan_x + 25, 802), fill=(*colors[phase_index], 24))
            draw.line((scan_x, 170, scan_x, 802), fill=(*colors[phase_index], 150), width=3)
            stats = (
                ("12 H 45 MIN", "WALL CLOCK"),
                ("6", "HEAVY TASKS"),
                ("3", "BUILT-IN SQUADS"),
                ("46", "AGENT SESSIONS"),
                ("20", "AGENT ROLES"),
            )
            for index, (value, label) in enumerate(stats):
                x = 82 + index * 358
                draw.text((x, 835), value, font=font(34, bold=True), fill=INK)
                draw.text((x, 883), label, font=font(15, bold=True), fill=colors[min(index, 2)])
            draw.text((1660, 95), f"{phase_index + 1}/3", font=font(18, bold=True), fill=MUTED)
        elif scene["kind"] == "motion_open_source_pillars":
            center_x, center_y = 960, 520
            core = phase(seconds, 0.4, 0.8)
            core_radius = int(118 * core)
            draw.ellipse((center_x - core_radius - 28, center_y - core_radius - 28, center_x + core_radius + 28, center_y + core_radius + 28), fill=(64, 214, 216, int(34 * core)))
            draw.ellipse((center_x - core_radius, center_y - core_radius, center_x + core_radius, center_y + core_radius), fill=(8, 22, 29, int(245 * core)), outline=(*CYAN, int(255 * core)), width=5)
            if core > 0.6:
                draw.text((center_x - 64, center_y - 52), "MIT", font=font(48, bold=True), fill=INK)
                draw.text((center_x - 86, center_y + 15), "SOURCE", font=font(19, bold=True), fill=CYAN)
            pillars = (
                ("开源", "源码公开 · 自托管 · 可审计 · 可 fork", (280, 330), CYAN),
                ("定制", "换模型 · 改工具 · 调权限 · 装专家团", (1190, 330), (167, 203, 255)),
                ("可控", "本机运行 · 不可逆操作先确认", (280, 690), AMBER),
                ("透明", "工具调用 · 参数 · 结果全程可回看", (1190, 690), GREEN),
            )
            for index, (title, detail, (x, y), color) in enumerate(pillars):
                reveal = phase(seconds, 1.8 + index * 2.7, 0.75)
                anchor_x = center_x + (x - center_x) * reveal
                anchor_y = center_y + (y - center_y) * reveal
                draw.line((center_x, center_y, anchor_x + 200, anchor_y + 58), fill=(*color, int(130 * reveal)), width=3)
                alpha = int(245 * reveal)
                draw.rounded_rectangle((anchor_x, anchor_y, anchor_x + 450, anchor_y + 116), radius=24, fill=(10, 24, 32, alpha), outline=(*color, alpha), width=3)
                draw.text((anchor_x + 28, anchor_y + 20), title, font=font(28, bold=True), fill=(*color, int(255 * reveal)))
                draw.text((anchor_x + 28, anchor_y + 68), detail, font=font(17, bold=True), fill=(224, 234, 239, int(255 * reveal)))
            source_reveal = phase(seconds, 13.0, 1.0)
            if source_reveal > 0:
                draw.rounded_rectangle((548, 814, 1372, 874), radius=18, fill=(6, 17, 23, int(235 * source_reveal)), outline=(*CYAN, int(220 * source_reveal)), width=2)
                draw.text((592, 829), "github.com/yangheng95/opencorvus", font=font(20, bold=True, mono=True), fill=(224, 247, 247, int(255 * source_reveal)))
            revision_reveal = phase(seconds, 17.0, 0.9)
            if revision_reveal > 0:
                draw.rounded_rectangle((520, 885, 1400, 936), radius=16, fill=(16, 28, 22, int(238 * revision_reveal)), outline=(*GREEN, int(220 * revision_reveal)), width=2)
                draw.text((566, 897), "反馈 → 可回退修订 → 只有你确认才安装", font=font(19, bold=True), fill=(225, 255, 239, int(255 * revision_reveal)))
        elif scene["kind"] == "motion_agent_activity":
            segments = (
                ("agent-research-squad-7884.png", "research-studio-writer", CYAN, 0.52),
                ("agent-implementation-loaded-7884.png", "implementation-engineer", AMBER, 0.78),
                ("agent-test-review-7884.png", "test-engineer", (167, 203, 255), 0.82),
                ("agent-system-review-7884.png", "system-integrity-reviewer", GREEN, 0.82),
            )
            segment_duration = duration / len(segments)
            segment_index = min(len(segments) - 1, int(seconds / segment_duration))
            local = (seconds - segment_index * segment_duration) / segment_duration
            source_name, role, color, pan_x = segments[segment_index]
            composite_camera(
                image,
                sources[source_name],
                zoom=1.0 + 0.30 * ease(local),
                pan_x=pan_x,
                pan_y=0.5,
            )
            shade = Image.new("RGBA", image.size, (0, 0, 0, 0))
            shade_draw = ImageDraw.Draw(shade)
            shade_draw.rectangle((0, 0, width, 154), fill=(2, 7, 11, 228))
            shade_draw.rectangle((0, 802, width, height), fill=(2, 7, 11, 226))
            image.paste(shade, (0, 0), shade)
            draw = ImageDraw.Draw(image, "RGBA")
            draw.text((72, 45), role, font=font(28, bold=True), fill=color)
            draw.text((72, 90), "REAL 7884 AGENT SESSION · CLICKABLE CONVERSATION", font=font(15, bold=True), fill=(190, 205, 212))
            draw.text((1740, 54), f"{segment_index + 1}/4", font=font(18, bold=True), fill=INK)
            progress_x = int(72 + (width - 144) * ((segment_index + local) / len(segments)))
            draw.line((72, 835, width - 72, 835), fill=(65, 82, 91), width=4)
            draw.line((72, 835, progress_x, 835), fill=color, width=7)
            if scene["id"] == "case-agents":
                stats = (("6", "TASK"), ("3", "SQUAD"), ("46", "SESSION"), ("20", "ROLE"))
                for index, (value, label) in enumerate(stats):
                    x = 790 + index * 250
                    draw.text((x, 864), value, font=font(30, bold=True), fill=INK)
                    draw.text((x + 58, 875), label, font=font(15, bold=True), fill=color)
        elif scene["kind"] == "motion_personal_scenarios":
            scenarios = (
                ("毕业论文", "文献 → 实验 → 论文", CYAN),
                ("课程项目", "需求 → 实现 → 演示", (167, 203, 255)),
                ("开源软件", "调研 → 测试 → 发布", AMBER),
                ("副业应用", "原型 → 网页 → 上线", (245, 176, 122)),
                ("求职作品集", "项目 → 证据 → 展示", GREEN),
                ("独立研究", "假设 → 数据 → 复验", (188, 168, 255)),
            )
            for index, (name, route, color) in enumerate(scenarios):
                col, row = index % 3, index // 3
                reveal = phase(seconds, 0.7 + index * 0.65, 0.65)
                x = 110 + col * 590
                target_y = 330 + row * 260
                y = int(height + 80 - reveal * (height + 80 - target_y))
                draw.rounded_rectangle((x, y, x + 520, y + 190), radius=28, fill=(11, 24, 33, 235), outline=(*color, 220), width=3)
                draw.text((x + 30, y + 30), name, font=font(30, bold=True), fill=color)
                draw.text((x + 30, y + 91), route, font=font(21, bold=True), fill=INK)
                progress = clamp((seconds - (1.0 + index * 0.65)) / 2.8)
                draw.line((x + 30, y + 151, x + 480, y + 151), fill=(55, 73, 84), width=5)
                draw.line((x + 30, y + 151, x + 30 + int(450 * progress), y + 151), fill=color, width=7)
        elif scene["kind"] == "motion_monitor":
            wipe = phase(seconds, duration * 0.04, max(0.8, duration * 0.06))
            screen_x = int(width - wipe * 980)
            paste_evidence(image, sources["ready-desktop.png"], (screen_x, 210, screen_x + 930, 850), alpha=int(250 * wipe))
            chart = (110, 430, 840, 800)
            draw.rounded_rectangle(chart, radius=24, fill=(8, 17, 25, 232), outline=(60, 91, 106), width=2)
            draw.text((142, 458), "VALIDATION MACRO-F1", font=font(20, bold=True), fill=MUTED)
            values = (0.8196, 0.8340, 0.8343)
            names = ("BASE", "FREEZE", "SMOOTH")
            reveal = clamp((seconds - duration * 0.16) / max(1.0, duration * 0.46) * 3)
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
            inference = phase(seconds, duration * 0.67, max(0.8, duration * 0.06))
            if inference > 0:
                y0 = int(880 - inference * 650)
                paste_evidence(image, sources["inference-success-desktop.png"], (940, y0, 1810, y0 + 600), alpha=int(250 * inference))
        elif scene["kind"] == "motion_results":
            segments = (
                ("architecture-promo-v1.png", "MODEL ARCHITECTURE", CYAN),
                ("lifecycle-promo-v1.png", "EXPERIMENT LIFECYCLE", AMBER),
                ("paper-1.png", "FIVE-PAGE ACL PAPER", (211, 219, 224)),
                ("publication-task-7884.png", "PUBLIC GITHUB DELIVERY", GREEN),
            )
            segment_duration = duration / len(segments)
            segment_index = min(len(segments) - 1, int(seconds / segment_duration))
            local = (seconds - segment_index * segment_duration) / segment_duration
            name, label, color = segments[segment_index]
            if segment_index < 2:
                composite_camera(
                    image,
                    sources[name],
                    zoom=1.0 + 0.28 * ease(local),
                    pan_x=0.32 + 0.36 * local,
                    pan_y=0.5,
                )
            elif segment_index == 2:
                composite_camera(image, sources[name], zoom=1.08 + 0.22 * ease(local), pan_x=0.5, pan_y=0.08 + 0.32 * local)
            else:
                composite_camera(image, sources[name], zoom=1.04 + 0.32 * ease(local), pan_x=0.16, pan_y=0.46)
            shade = Image.new("RGBA", image.size, (0, 0, 0, 0))
            shade_draw = ImageDraw.Draw(shade)
            shade_draw.rectangle((0, 0, width, 142), fill=(2, 7, 11, 226))
            shade_draw.rectangle((0, 796, width, height), fill=(2, 7, 11, 222))
            image.paste(shade, (0, 0), shade)
            draw = ImageDraw.Draw(image, "RGBA")
            draw.text((72, 50), label, font=font(28, bold=True), fill=color)
            draw.text((72, 92), f"ARTIFACT {segment_index + 1}/4 · REAL CASE OUTPUT", font=font(15, bold=True), fill=(178, 195, 203))
            progress_x = int(72 + (width - 144) * ((segment_index + local) / len(segments)))
            draw.line((72, 830, width - 72, 830), fill=(53, 74, 85), width=4)
            draw.line((72, 830, progress_x, 830), fill=color, width=7)
            if segment_index == 3:
                draw.rounded_rectangle((1060, 675, 1842, 780), radius=18, fill=(3, 14, 10, 230), outline=GREEN, width=2)
                draw.text((1090, 699), "github.com/yangheng95/", font=font(22, bold=True), fill=(222, 255, 239))
                draw.text((1090, 735), "deberta-v3-absa-public-evidence", font=font(22, bold=True), fill=(222, 255, 239))
        elif scene["kind"] == "motion_quality":
            thirds = duration / 3.0
            phase_index = min(2, int(seconds / thirds))
            local = (seconds - phase_index * thirds) / thirds
            source_names = ("ready-desktop.png", "paper-1.png", "publication-task-7884.png")
            labels = (
                ("114 FILES", "PUBLICATION SAFETY AUDIT"),
                ("RECOMPUTED", "PAPER METRICS + VISUAL REVIEW"),
                ("READBACK", "ANONYMOUS GITHUB VERIFICATION"),
            )
            colors = (CYAN, AMBER, GREEN)
            composite_camera(
                image,
                sources[source_names[phase_index]],
                zoom=1.16 + 0.25 * ease(local),
                pan_x=(0.18, 0.5, 0.14)[phase_index],
                pan_y=(0.3, 0.18, 0.48)[phase_index],
            )
            shade = Image.new("RGBA", image.size, (0, 0, 0, 0))
            shade_draw = ImageDraw.Draw(shade)
            shade_draw.rectangle((0, 0, width, height), fill=(1, 6, 9, 102))
            shade_draw.rectangle((80, 230, 860, 710), fill=(3, 10, 15, 220))
            image.paste(shade, (0, 0), shade)
            draw = ImageDraw.Draw(image, "RGBA")
            value, label = labels[phase_index]
            draw.text((126, 304), f"0{phase_index + 1}", font=font(19, bold=True), fill=colors[phase_index])
            draw.text((126, 365), value, font=font(64, bold=True), fill=INK)
            draw.text((126, 452), label, font=font(21, bold=True), fill=colors[phase_index])
            draw.line((126, 502, 780, 502), fill=(*colors[phase_index], 150), width=3)
            check_progress = phase(seconds, phase_index * thirds + 1.4, 1.0)
            draw.ellipse((126, 548, 174, 596), outline=GREEN, width=4)
            if check_progress > 0.7:
                draw.line((138, 570, 150, 582), fill=GREEN, width=6)
                draw.line((150, 582, 169, 557), fill=GREEN, width=6)
            draw.text((202, 552), "INDEPENDENT CHECK PASSED", font=font(22, bold=True), fill=GREEN if check_progress > 0.7 else MUTED)

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
        # The mission starts as an ordinary user message, not a terminal command.
        # This keeps the interaction legible to a consumer audience while the
        # deterministic post-production preserves every required character.
        draw.rounded_rectangle((76, 310, width - 76, 846), radius=28, fill=(7, 11, 16), outline=(39, 63, 76), width=2)
        draw.rounded_rectangle((112, 348, 330, 402), radius=18, fill=(16, 37, 45), outline=CYAN, width=2)
        draw.text((140, 361), "NEW MISSION", font=font(18, bold=True), fill=CYAN)
        draw.rounded_rectangle((230, 430, width - 142, 760), radius=32, fill=(19, 29, 39), outline=(59, 86, 99), width=2)
        draw.ellipse((151, 440, 211, 500), fill=(25, 53, 62), outline=CYAN, width=2)
        draw.text((169, 451), "你", font=font(24, bold=True), fill=CYAN)
        draw.multiline_text((274, 470), visible + ("▌" if frame_index // 12 % 2 == 0 else ""), font=font(27, bold=True), fill=INK, spacing=17)
        draw.rounded_rectangle((width - 286, 782, width - 142, 830), radius=16, fill=(24, 92, 96), outline=CYAN, width=2)
        draw.text((width - 244, 793), "提交", font=font(19, bold=True), fill=INK)
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
    source_duration = media_duration(h3_path)
    stretch = float(duration) / source_duration
    optical_blur = ",gblur=sigma=0.65" if scene["id"] == "long-work" else ""
    run([
        "ffmpeg", "-y", "-i", str(h3_path), "-loop", "1", "-i", str(overlay_path),
        "-filter_complex", f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}{optical_blur},setpts=PTS*{stretch:.8f},fps={fps},trim=duration={duration}[bg];[1:v]format=rgba[ov];[bg][ov]overlay=0:0:shortest=1,format=yuv420p[v]",
        "-map", "[v]", "-t", str(duration), "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", str(output_video),
    ])


def compose(output: Path, *, final: bool) -> Path:
    storyboard, frozen_storyboard_digest = load_storyboard_source(require_approved=True)
    prepare(output)
    media_kind = "final" if final else "animatic"
    work = output / f"work-{media_kind}-{frozen_storyboard_digest[:12]}-{os.getpid()}"
    scenes_dir = work / "scenes"
    stills = work / "stills"
    scenes_dir.mkdir(parents=True, exist_ok=True)
    stills.mkdir(parents=True, exist_ok=True)
    clips: list[Path] = []
    for index, scene in enumerate(storyboard["scenes"]):
        clip = scenes_dir / f"{index:02d}-{scene['id']}.mp4"
        still = stills / f"{index:02d}-{scene['id']}.png"
        if scene["kind"] == "brand_card":
            source = evidence_paths(output)[scene["asset"]]
            encode_static(source, clip, float(scene["duration"]), storyboard["canvas"]["fps"])
        elif scene["kind"] == "typewriter":
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
    media_stem = "opencorvus-long-mission-h3" if final else "opencorvus-long-mission-animatic"
    destination = output / ("final" if final else "draft") / f"{media_stem}-{frozen_storyboard_digest[:12]}.mp4"
    destination.parent.mkdir(parents=True, exist_ok=True)
    candidate = destination.with_name(f".{destination.stem}.{os.getpid()}.partial.mp4")
    candidate.unlink(missing_ok=True)
    voiceover = output / "voice" / "voiceover.wav"
    if voiceover.exists():
        state_path = output / "reports" / "voiceover-state.json"
        if not state_path.exists():
            raise RuntimeError("Voiceover exists without a storyboard-bound state receipt; regenerate it with the voice command")
        state = json.loads(state_path.read_text(encoding="utf-8"))
        if state.get("storyboard_sha256") != frozen_storyboard_digest:
            raise RuntimeError("Voiceover was generated from a different storyboard; regenerate it with the voice command")
        if state.get("voiceover_sha256") != hashlib.sha256(voiceover.read_bytes()).hexdigest():
            raise RuntimeError("Voiceover bytes do not match their generation receipt; regenerate them with the voice command")
        run([
            "ffmpeg", "-y", "-i", str(video_only), "-i", str(voiceover),
            "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-shortest", str(candidate),
        ])
    else:
        run([
            "ffmpeg", "-y", "-i", str(video_only), "-f", "lavfi", "-t", str(total_duration),
            "-i", "anullsrc=r=48000:cl=stereo",
            "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-shortest", str(candidate),
        ])
    if storyboard_digest() != frozen_storyboard_digest:
        candidate.unlink(missing_ok=True)
        raise RuntimeError("Storyboard changed while composing; discarded the mixed-version output")
    candidate.replace(destination)
    shutil.rmtree(work)
    return destination


def media_duration(path: Path) -> float:
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)], capture=True).stdout.strip())


async def synthesize_voice(text: str, destination: Path, voice: str, rate: str) -> None:
    try:
        import edge_tts
    except ImportError as error:
        raise RuntimeError("Install script/video/minimax-h3-mission-promo/requirements.txt before generating voiceover") from error
    destination.parent.mkdir(parents=True, exist_ok=True)
    last_error: Exception | None = None
    for attempt in range(4):
        destination.unlink(missing_ok=True)
        try:
            communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
            await asyncio.wait_for(communicate.save(str(destination)), timeout=45)
            if destination.exists() and destination.stat().st_size > 0:
                return
            raise RuntimeError("Edge TTS returned an empty audio file")
        except Exception as error:  # transient upstream empty responses are retryable
            last_error = error
            await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Voice synthesis failed after 4 attempts: {last_error}") from last_error


def generate_voiceover(output: Path, *, voice: str, rate: str) -> Path:
    storyboard, frozen_storyboard_digest = load_storyboard_source(require_approved=True)
    voice_root = output / "voice"
    raw_root = voice_root / "raw"
    timed_root = voice_root / "timed"
    raw_root.mkdir(parents=True, exist_ok=True)
    timed_root.mkdir(parents=True, exist_ok=True)
    timed_files: list[Path] = []
    manifest: list[dict[str, Any]] = []
    try:
        synthesizer_version = package_version("edge-tts")
    except PackageNotFoundError:
        synthesizer_version = "missing"
    for index, scene in enumerate(storyboard["scenes"]):
        target = float(scene["duration"])
        narration = scene.get("narration", "").strip()
        scene_voice = scene.get("voice", voice)
        cache_identity = json.dumps(
            {
                "schema_version": 2,
                "text": narration,
                "voice": scene_voice,
                "rate": rate,
                "synthesizer": "edge-tts",
                "synthesizer_version": synthesizer_version,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
        narration_key = hashlib.sha256(cache_identity.encode("utf-8")).hexdigest()[:12]
        raw = raw_root / f"{index:02d}-{scene['id']}-{narration_key}.mp3"
        timed = timed_root / f"{index:02d}-{scene['id']}.wav"
        if not narration:
            run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", str(target), str(timed)])
            timed_files.append(timed)
            manifest.append({"scene": scene["id"], "text": "", "target_seconds": target, "raw_seconds": 0.0, "voice": None, "rate": None})
            continue
        if not raw.exists() or raw.stat().st_size == 0:
            asyncio.run(synthesize_voice(narration, raw, scene_voice, rate))
        raw_duration = media_duration(raw)
        filters: list[str] = []
        tempo = 1.0
        if raw_duration > target - 0.6:
            tempo = raw_duration / max(0.5, target - 0.6)
            if tempo > 1.15:
                raise RuntimeError(
                    f"Narration for {scene['id']} requires {tempo:.3f}x tempo; "
                    "rewrite the narration or extend the scene instead of forcing unnatural speech"
                )
            filters.append(f"atempo={tempo:.6f}")
        filters.extend([f"apad=pad_dur={target}", f"atrim=0:{target}"])
        run(["ffmpeg", "-y", "-i", str(raw), "-af", ",".join(filters), "-ar", "48000", "-ac", "2", str(timed)])
        timed_files.append(timed)
        manifest.append({"scene": scene["id"], "text": narration, "target_seconds": target, "raw_seconds": raw_duration, "tempo": tempo, "voice": scene_voice, "rate": rate})
    concat = voice_root / "concat.txt"
    concat.write_text("".join(f"file '{path.as_posix()}'\n" for path in timed_files), encoding="utf-8")
    destination = voice_root / "voiceover.wav"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(destination)])
    (output / "reports").mkdir(parents=True, exist_ok=True)
    (output / "reports" / "voiceover-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / "reports" / "voiceover-state.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "storyboard_sha256": frozen_storyboard_digest,
                "voiceover_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                "duration_seconds": media_duration(destination),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    if storyboard_digest() != frozen_storyboard_digest:
        destination.unlink(missing_ok=True)
        (output / "reports" / "voiceover-state.json").unlink(missing_ok=True)
        raise RuntimeError("Storyboard changed while generating voiceover; discarded the mixed-version output")
    return destination


def inspect_video(output: Path, *, final: bool) -> dict[str, Any]:
    storyboard, frozen_storyboard_digest = load_storyboard_source()
    media_stem = "opencorvus-long-mission-h3" if final else "opencorvus-long-mission-animatic"
    video = output / ("final" if final else "draft") / f"{media_stem}-{frozen_storyboard_digest[:12]}.mp4"
    if not video.exists():
        raise FileNotFoundError(video)
    probe = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)], capture=True).stdout)
    video_stream = next(stream for stream in probe["streams"] if stream["codec_type"] == "video")
    audio_stream = next((stream for stream in probe["streams"] if stream["codec_type"] == "audio"), None)
    media_kind = "final" if final else "animatic"
    frames_dir = output / "frames" / f"{media_kind}-{frozen_storyboard_digest[:12]}"
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
                "frame_change_observed": all(value > 0.5 for value in differences),
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
        and all(item["frame_change_observed"] for item in checkpoints)
    )
    reports = output / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    report_path = reports / f"frame-check-{media_kind}-{frozen_storyboard_digest[:12]}.json"
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
