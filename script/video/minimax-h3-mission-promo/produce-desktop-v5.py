from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import math
import os
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable

from PIL import Image, ImageDraw, ImageFilter, ImageFont


HERE = Path(__file__).resolve().parent
STORYBOARD = HERE / "desktop-storyboard-v5.zh-CN.json"
DEFAULT_OUTPUT = Path(r"D:\myhexin-local\demos\opencorvus-desktop-promo-v5-20260824")
EVIDENCE = Path(r"D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824")
PROJECT = Path(r"D:\myhexin-local\demos\deberta-absa-builtins-mission-rerun2-20260823")
LOGO = HERE.parents[2] / "packages/overlay/src-tauri/icons/Square284x284Logo.png"

W, H, FPS = 1280, 720, 25
TASKBAR = 48
BG = (238, 244, 245)
PANEL = (250, 252, 252)
WHITE = (255, 255, 255)
INK = (26, 38, 43)
MUTED = (91, 111, 119)
LINE = (202, 215, 219)
CYAN = (30, 174, 178)
CYAN_DARK = (17, 112, 118)
CORAL = (233, 113, 82)
GREEN = (45, 154, 105)
AMBER = (221, 158, 54)
RED = (210, 75, 69)
PURPLE = (126, 91, 190)
BLUE = (63, 120, 205)

FONT_REG = Path(r"C:\Windows\Fonts\msyh.ttc")
FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_MONO = Path(r"C:\Windows\Fonts\consola.ttf")


def font(size: int, *, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_MONO if mono else FONT_BOLD if bold else FONT_REG), size)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease(value: float) -> float:
    value = clamp(value)
    return value * value * (3 - 2 * value)


def phase(t: float, start: float, duration: float) -> float:
    return ease((t - start) / max(0.001, duration))


def run(command: list[str], *, capture: bool = False, timeout: int | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, text=True, capture_output=capture, timeout=timeout)


def media_duration(path: Path) -> float:
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)], capture=True).stdout.strip())


def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.splitlines() or [""]:
        line = ""
        for char in paragraph:
            candidate = line + char
            if line and draw.textbbox((0, 0), candidate, font=f)[2] > width:
                lines.append(line)
                line = char
            else:
                line = candidate
        lines.append(line)
    return lines


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int], f: ImageFont.FreeTypeFont, fill: tuple[int, ...], width: int, spacing: int = 6) -> int:
    x, y = xy
    for line in wrap(draw, text, f, width):
        draw.text((x, y), line, font=f, fill=fill)
        y += f.size + spacing
    return y


def fit_image(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    sw, sh = source.size
    tw, th = size
    scale = max(tw / sw, th / sh)
    resized = source.resize((round(sw * scale), round(sh * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - tw) // 2
    top = (resized.height - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def paste_fit(canvas: Image.Image, source: Image.Image, box: tuple[int, int, int, int], alpha: int = 255) -> None:
    x0, y0, x1, y1 = box
    fitted = fit_image(source.convert("RGB"), (x1 - x0, y1 - y0)).convert("RGBA")
    if alpha < 255:
        fitted.putalpha(alpha)
    canvas.paste(fitted, (x0, y0), fitted)


@lru_cache(maxsize=8)
def _desktop_template(clock: str = "10:24") -> Image.Image:
    image = Image.new("RGB", (W, H), BG)
    px = image.load()
    for y in range(H - TASKBAR):
        mix = y / (H - TASKBAR)
        color = (int(239 - 18 * mix), int(247 - 8 * mix), int(248 - 5 * mix))
        for x in range(W):
            px[x, y] = color
    draw = ImageDraw.Draw(image)
    for x, y, r in ((930, 140, 240), (1050, 280, 190), (760, 430, 260)):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(219, 239, 237))
    icons = [("Projects", 28, 48), ("Research", 28, 132), ("OpenCorvus", 28, 216)]
    for label, x, y in icons:
        draw.rounded_rectangle((x, y, x + 44, y + 38), radius=8, fill=WHITE, outline=LINE, width=2)
        draw.rectangle((x + 8, y + 11, x + 35, y + 29), fill=(125, 204, 199))
        draw.text((x - 4, y + 45), label, font=font(13), fill=INK)
    draw.rectangle((0, H - TASKBAR, W, H), fill=(247, 249, 249))
    draw.line((0, H - TASKBAR, W, H - TASKBAR), fill=LINE, width=1)
    draw.rounded_rectangle((W // 2 - 130, H - 39, W // 2 + 130, H - 8), radius=12, fill=(231, 238, 239))
    for index, color in enumerate((CYAN, BLUE, PURPLE, CORAL, GREEN)):
        x = W // 2 - 98 + index * 49
        draw.rounded_rectangle((x, H - 34, x + 27, H - 13), radius=6, fill=color)
    draw.text((W - 82, H - 36), clock, font=font(14, bold=True), fill=INK)
    return image


def desktop_base(clock: str = "10:24") -> Image.Image:
    return _desktop_template(clock).copy()


def window(image: Image.Image, box: tuple[int, int, int, int], title: str, accent: tuple[int, int, int] = CYAN, active: bool = True) -> tuple[ImageDraw.ImageDraw, tuple[int, int, int, int]]:
    x0, y0, x1, y1 = box
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((x0 + 8, y0 + 10, x1 + 8, y1 + 10), radius=18, fill=(25, 45, 48, 50))
    image.paste(shadow, (0, 0), shadow)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(box, radius=16, fill=(*WHITE, 252), outline=(*accent, 230 if active else 90), width=2)
    draw.rounded_rectangle((x0, y0, x1, y0 + 42), radius=16, fill=(245, 249, 249, 255))
    draw.rectangle((x0, y0 + 26, x1, y0 + 42), fill=(245, 249, 249, 255))
    draw.ellipse((x0 + 14, y0 + 15, x0 + 26, y0 + 27), fill=CORAL)
    draw.ellipse((x0 + 34, y0 + 15, x0 + 46, y0 + 27), fill=AMBER)
    draw.ellipse((x0 + 54, y0 + 15, x0 + 66, y0 + 27), fill=GREEN)
    draw.text((x0 + 82, y0 + 10), title, font=font(16, bold=True), fill=INK)
    return draw, (x0 + 12, y0 + 50, x1 - 12, y1 - 12)


def pill(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, color: tuple[int, int, int], *, small: bool = False) -> tuple[int, int, int, int]:
    f = font(13 if small else 15, bold=True)
    x, y = xy
    bb = draw.textbbox((0, 0), text, font=f)
    width = bb[2] + 24
    height = 26 if small else 31
    draw.rounded_rectangle((x, y, x + width, y + height), radius=height // 2, fill=(*color, 34), outline=(*color, 190), width=1)
    draw.text((x + 12, y + (5 if small else 6)), text, font=f, fill=color)
    return x, y, x + width, y + height


def cursor(draw: ImageDraw.ImageDraw, x: int, y: int, click: float = 0.0) -> None:
    if click > 0:
        r = int(10 + 18 * click)
        draw.ellipse((x - r, y - r, x + r, y + r), outline=(*CYAN, int(180 * (1 - click))), width=3)
    points = [(x, y), (x + 4, y + 22), (x + 10, y + 15), (x + 16, y + 27), (x + 21, y + 24), (x + 15, y + 13), (x + 24, y + 10)]
    draw.polygon(points, fill=WHITE, outline=INK)


def mechanism_label(draw: ImageDraw.ImageDraw, evidence: bool = False) -> None:
    text = "CAPTURED EVIDENCE · 2026-08-24 · NOT LIVE" if evidence else "MECHANISM RECONSTRUCTION · 机制重建"
    color = GREEN if evidence else AMBER
    pill(draw, (W - 392, 14), text, color, small=True)


def app_shell(image: Image.Image, title: str = "OpenCorvus", box: tuple[int, int, int, int] = (142, 62, 1138, 645)) -> tuple[ImageDraw.ImageDraw, tuple[int, int, int, int]]:
    draw, content = window(image, box, title, CYAN)
    x0, y0, x1, y1 = content
    draw.rectangle((x0, y0, x0 + 166, y1), fill=(242, 247, 247))
    draw.text((x0 + 18, y0 + 18), "OpenCorvus", font=font(21, bold=True), fill=CYAN_DARK)
    for i, label in enumerate(("Chat", "Mission", "Tasks", "Artifacts", "Agents", "Activity")):
        yy = y0 + 70 + i * 48
        active = label in title
        if active:
            draw.rounded_rectangle((x0 + 8, yy - 8, x0 + 154, yy + 28), radius=10, fill=(217, 241, 239))
        draw.text((x0 + 24, yy), label, font=font(16, bold=active), fill=CYAN_DARK if active else MUTED)
    return draw, (x0 + 182, y0 + 10, x1 - 12, y1 - 12)


def terminal(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], lines: list[tuple[str, tuple[int, int, int]]], title: str = "Terminal") -> None:
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=12, fill=(20, 27, 30), outline=(70, 91, 97), width=2)
    draw.text((x0 + 16, y0 + 10), title, font=font(14, bold=True), fill=(195, 216, 221))
    yy = y0 + 40
    for line, color in lines[-10:]:
        draw.text((x0 + 16, yy), line, font=font(14, mono=True), fill=color)
        yy += 24
        if yy > y1 - 20:
            break


def list_row(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], label: str, status: str, color: tuple[int, int, int], sub: str = "") -> None:
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=10, fill=(248, 251, 251), outline=LINE, width=1)
    draw.text((x0 + 14, y0 + 10), label, font=font(15, bold=True), fill=INK)
    if sub:
        draw.text((x0 + 14, y0 + 34), sub, font=font(12), fill=MUTED)
    bb = draw.textbbox((0, 0), status, font=font(12, bold=True))
    pill(draw, (x1 - (bb[2] + 40), y0 + 13), status, color, small=True)


def evidence_paths() -> dict[str, Path]:
    return {
        "mission": EVIDENCE / "assets/screenshots/mission-overview-7884.png",
        "agents": EVIDENCE / "assets/screenshots/agent-dock-overview-7884.png",
        "research": EVIDENCE / "assets/screenshots/agent-research-squad-7884.png",
        "cuda": EVIDENCE / "assets/screenshots/cuda-task-7884.png",
        "web": EVIDENCE / "assets/evidence/inference-success-desktop.png",
        "architecture": EVIDENCE / "assets/evidence/best-model-architecture.png",
        "lifecycle": EVIDENCE / "assets/evidence/best-experiment-lifecycle.png",
        "paper1": EVIDENCE / "assets/evidence/paper-1.png",
        "paper2": EVIDENCE / "assets/evidence/paper-2.png",
        "logo": LOGO,
    }


def load_evidence() -> dict[str, Image.Image]:
    paths = evidence_paths()
    return {name: Image.open(path).convert("RGB") for name, path in paths.items() if path.exists()}


def build_digest() -> str:
    digest = hashlib.sha256()
    for path in [Path(__file__), STORYBOARD, *evidence_paths().values()]:
        if path.exists():
            digest.update(path.name.encode("utf-8"))
            digest.update(path.read_bytes())
    return digest.hexdigest()


def render_brand(scene_t: float, duration: float, assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw = ImageDraw.Draw(image, "RGBA")
    p = phase(scene_t, 0.3, 0.7)
    _, content = app_shell(image, "OpenCorvus")
    x0, y0, x1, y1 = content
    if "logo" in assets:
        logo = assets["logo"].resize((82, 82), Image.Resampling.LANCZOS).convert("RGBA")
        image.paste(logo, (x0 + 66, y0 + 57), logo)
    draw.text((x0 + 170, y0 + 80), "OpenCorvus", font=font(48, bold=True), fill=CYAN_DARK)
    draw.text((x0 + 72, y0 + 158), "Open-source Agent Harness for long-horizon work", font=font(22), fill=INK)
    draw.text((x0 + 72, y0 + 205), "跑得久的工作 · 能核对的结果 · 会按反馈修订的专家团", font=font(19), fill=MUTED)
    draw.text((x0 + 72, y0 + 310), "opencorvus.com", font=font(18, bold=True, mono=True), fill=CYAN_DARK)
    draw.text((x0 + 72, y0 + 344), "github.com/yangheng95/opencorvus", font=font(17, mono=True), fill=INK)
    draw.text((x0 + 72, y0 + 382), "Heng Yang · @yangheng95", font=font(16), fill=MUTED)
    cursor(draw, int(110 + p * 175), int(245 - p * 15), click=max(0.0, 1 - abs(scene_t - 1.1) * 4))
    return image


def render_typewriter(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw, content = app_shell(image, "Chat · single Agent")
    x0, y0, x1, y1 = content
    command = "\n".join(scene["command"])
    ratio = clamp(scene_t / 13.0)
    typed = command[: round(len(command) * ratio)]
    draw.rounded_rectangle((x0 + 26, y0 + 42, x1 - 290, y1 - 82), radius=16, fill=(248, 251, 251), outline=LINE)
    draw.text((x0 + 48, y0 + 62), "你的长项目", font=font(20, bold=True), fill=INK)
    draw_wrapped(draw, typed + ("▍" if ratio < 1 else ""), (x0 + 48, y0 + 105), font(17), INK, x1 - x0 - 390, 9)
    yy = y0 + 60
    terminal_lines = [
        ("$ agent run --stream", (184, 216, 220)),
        ("→ researching model and dataset", (104, 211, 203)),
        ("→ writing train.py", (116, 170, 237)),
        ("→ creating demo/", (245, 184, 94)),
        ("status: working", (117, 219, 155)),
    ]
    terminal(draw, (x1 - 270, y0 + 36, x1 - 18, y1 - 82), terminal_lines, "Agent stream")
    for i, (label, color) in enumerate((("CUDA ONLY", CORAL), ("RUN TESTS", AMBER), ("PUBLISH AFTER CONFIRMATION", PURPLE))):
        pill(draw, (x0 + 46 + i * 180, y1 - 58), label, color, small=True)
    cursor(draw, x1 - 55, y1 - 35, click=phase(scene_t, 13.6, 0.5) * (1 - phase(scene_t, 14.4, 0.5)))
    return image


def render_context(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw, content = app_shell(image, "Chat · context inspection")
    mechanism_label(draw)
    x0, y0, x1, y1 = content
    split = x1 - 330
    draw.rounded_rectangle((x0 + 18, y0 + 20, split - 16, y1 - 20), radius=14, fill=WHITE, outline=LINE)
    draw.text((x0 + 38, y0 + 42), "Original requirements", font=font(18, bold=True), fill=INK)
    constraints = ["CUDA only", "Run tests before release", "Publish after confirmation"]
    fade = clamp((scene_t - 5.0) / 5.0)
    for i, label in enumerate(constraints):
        color = tuple(int(INK[j] * (1 - fade) + 196 * fade) for j in range(3))
        draw.text((x0 + 48, y0 + 88 + i * 46), "✓ " + label, font=font(17), fill=color)
    draw.line((x0 + 38, y0 + 244, split - 38, y0 + 244), fill=LINE, width=2)
    logs = ["tool result × 18", "code diff × 9", "new messages × 27", "older turns summarized"]
    for i, line in enumerate(logs):
        draw.text((x0 + 48, y0 + 270 + i * 34), line, font=font(15, mono=True), fill=MUTED)
    if scene_t > 9:
        draw.rounded_rectangle((x0 + 42, y1 - 124, split - 36, y1 - 40), radius=12, fill=(250, 239, 237), outline=CORAL)
        draw.text((x0 + 60, y1 - 104), "Done — implementation completed", font=font(17, bold=True), fill=RED)
        draw.text((x0 + 60, y1 - 73), "tests ✕   paper ✕   publish ✕", font=font(15, mono=True), fill=RED)
    draw.rounded_rectangle((split, y0 + 20, x1 - 18, y1 - 20), radius=14, fill=(246, 249, 249), outline=AMBER, width=2)
    draw.text((split + 18, y0 + 42), "Context Inspector", font=font(18, bold=True), fill=INK)
    usage = min(98, 63 + int(scene_t * 2.4))
    draw.text((split + 18, y0 + 84), f"Context Window {usage}%", font=font(16, bold=True), fill=RED if usage > 92 else AMBER)
    draw.rounded_rectangle((split + 18, y0 + 116, x1 - 40, y0 + 138), radius=10, fill=(223, 230, 231))
    draw.rounded_rectangle((split + 18, y0 + 116, split + 18 + int((x1 - split - 58) * usage / 100), y0 + 138), radius=10, fill=RED if usage > 92 else AMBER)
    terms = [
        ("Context Compaction", 4.5, AMBER),
        ("Instruction Loss", 7.0, RED),
        ("Plan Drift", 9.5, PURPLE),
        ("Premature Termination", 12.0, CORAL),
    ]
    for i, (term, at, color) in enumerate(terms):
        if scene_t >= at:
            pill(draw, (split + 18, y0 + 175 + i * 52), term, color, small=True)
    terminal(draw, (split + 18, y1 - 170, x1 - 38, y1 - 36), [
        ("device: cpu fallback", (244, 133, 121)),
        ("tests: skipped", (244, 133, 121)),
        ("publish: later", (244, 133, 121)),
    ], "Observed path")
    cursor(draw, split - 40, y1 - 92)
    return image


def render_multi(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism_label(draw)
    boxes = [(110, 70, 620, 345), (650, 70, 1160, 345), (275, 370, 1005, 645)]
    titles = ["Agent A · implementation", "Agent B · implementation", "Agent C · waiting"]
    for i, box in enumerate(boxes):
        d, content = window(image, box, titles[i], (CYAN, BLUE, PURPLE)[i])
        x0, y0, x1, y1 = content
        if i < 2:
            d.text((x0 + 20, y0 + 20), "Editing src/inference.py", font=font(16, bold=True), fill=INK)
            d.text((x0 + 20, y0 + 62), "inference-final.py" if i == 0 else "inference-final-2.py", font=font(16, mono=True), fill=(CYAN_DARK if i == 0 else BLUE))
            pill(d, (x0 + 20, y1 - 54), "Duplicated Work", RED, small=True)
        else:
            d.text((x0 + 24, y0 + 22), "Waiting for validated checkpoint path…", font=font(17, bold=True), fill=INK)
            d.text((x0 + 24, y0 + 62), "checkpoints/selected/  <empty>", font=font(16, mono=True), fill=RED)
            pill(d, (x0 + 24, y1 - 54), "Orphaned Dependency", PURPLE, small=True)
    if scene_t > 5:
        pill(draw, (520, 345), "State Fragmentation", AMBER)
    cx = int(250 + (scene_t * 160) % 740)
    cy = 335 if int(scene_t / 2) % 2 == 0 else 530
    cursor(draw, cx, cy, click=(scene_t * 2) % 1)
    return image


def render_tabs(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw, content = window(image, (110, 65, 1170, 650), "Browser · product notes", BLUE)
    x0, y0, x1, y1 = content
    tabs = scene["tabs"]
    index = min(len(tabs) - 1, int(scene_t / (duration / len(tabs))))
    for i, (name, _) in enumerate(tabs):
        xx = x0 + i * 170
        active = i == index
        draw.rounded_rectangle((xx, y0, xx + 160, y0 + 36), radius=9, fill=(222, 237, 245) if active else (243, 247, 248), outline=BLUE if active else LINE)
        draw.text((xx + 12, y0 + 9), name, font=font(14, bold=active), fill=INK)
    name, note = tabs[index]
    colors = {"WorkBuddy": (120, 157, 231), "DeepSeek Harness": (131, 105, 219), "Codex": (40, 157, 119), "Claude Code": (221, 136, 78), "OpenCorvus": CYAN}
    color = colors[name]
    draw.rounded_rectangle((x0 + 48, y0 + 90, x1 - 48, y1 - 55), radius=18, fill=(249, 251, 251), outline=color, width=2)
    draw.text((x0 + 84, y0 + 140), name, font=font(38, bold=True), fill=color)
    draw.text((x0 + 84, y0 + 210), note, font=font(24, bold=True), fill=INK)
    draw.text((x0 + 84, y0 + 275), "不同工作重心 · 不作质量排名", font=font(17), fill=MUTED)
    draw.line((x0 + 84, y0 + 330, x1 - 84, y0 + 330), fill=LINE, width=2)
    draw.text((x0 + 84, y0 + 360), "同一个用户项目 · 同一台 Desktop", font=font(18, mono=True), fill=MUTED)
    cursor(draw, x0 + 80 + index * 170, y0 + 18, click=(scene_t * 1.8) % 1)
    return image


def render_mission_create(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw, content = app_shell(image, "Mission · New Mission")
    x0, y0, x1, y1 = content
    draw.text((x0 + 24, y0 + 18), "New Mission", font=font(28, bold=True), fill=INK)
    fields = [
        ("Final Goal", "完成可复验的 DeBERTa ABSA 项目并交付公开、可检查成果。", CYAN),
        ("Hard Constraints", "RTX 5090 · CUDA only · seed 42 · tests before release", CORAL),
        ("Acceptance Contract", "3 runs · monitor + inference · figures + paper · review + repository", PURPLE),
    ]
    for i, (label, value, color) in enumerate(fields):
        yy = y0 + 74 + i * 125
        draw.text((x0 + 28, yy), label, font=font(16, bold=True), fill=color)
        draw.rounded_rectangle((x0 + 24, yy + 30, x1 - 220, yy + 94), radius=10, fill=WHITE, outline=color)
        reveal = clamp((scene_t - i * 3) / 4)
        shown = value[: round(len(value) * reveal)]
        draw.text((x0 + 40, yy + 49), shown, font=font(15), fill=INK)
    draw.rounded_rectangle((x1 - 190, y0 + 80, x1 - 24, y0 + 280), radius=14, fill=(241, 248, 247), outline=CYAN)
    draw.text((x1 - 170, y0 + 101), "Persistent\nMission Record", font=font(18, bold=True), fill=CYAN_DARK, spacing=4)
    if scene_t > 12:
        receipt = ["Mission record committed", "goal revision: 1", "constraints: 4", "acceptance items: 4"]
        for i, line in enumerate(receipt):
            draw.text((x1 - 170, y0 + 170 + i * 25), line, font=font(12, mono=True), fill=GREEN)
    draw.rounded_rectangle((x1 - 188, y1 - 62, x1 - 28, y1 - 20), radius=10, fill=CYAN)
    draw.text((x1 - 152, y1 - 50), "Create Mission", font=font(16, bold=True), fill=WHITE)
    cursor(draw, x1 - 102, y1 - 39, click=phase(scene_t, 11.0, 0.5) * (1 - phase(scene_t, 12.0, 0.5)))
    return image


def render_scheduler(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw, content = app_shell(image, "Mission · Overview")
    mechanism_label(draw)
    x0, y0, x1, y1 = content
    draw.text((x0 + 16, y0 + 12), "Mission ae773cbff6362f19", font=font(19, bold=True), fill=INK)
    labels = ["Model & Data", "CUDA Experiments", "Monitor & Inference", "Figures", "Paper & Review", "Publish"]
    p = scene_t / duration
    for i, label in enumerate(labels):
        yy = y0 + 55 + i * 58
        if i == 0:
            status, color = "completed", GREEN
        elif i == 1:
            if p < .35:
                status, color = "waiting", MUTED
            elif p < .52:
                status, color = "ready", AMBER
            elif p < .68:
                status, color = "queued", BLUE
            else:
                status, color = "running", CYAN
        else:
            status, color = "waiting", MUTED
        list_row(draw, (x0 + 12, yy, x0 + 485, yy + 50), f"Task {i+1} · {label}", status, color, "depends on upstream Artifact" if i else "research-studio · revision locked")
    ix0 = x0 + 510
    draw.rounded_rectangle((ix0, y0 + 48, x1 - 10, y1 - 16), radius=14, fill=(245, 249, 249), outline=CYAN)
    draw.text((ix0 + 18, y0 + 68), "Scheduler Inspector", font=font(18, bold=True), fill=INK)
    lines = [
        ("depends_on", "Task 1 Artifact", CORAL),
        ("squad", "advanced · revision frozen", PURPLE),
        ("queue", "hint emitted", BLUE),
        ("facts", "reconciled", GREEN),
        ("lease", "activation acquired", GREEN),
        ("occurrence", "occ-T2-01 admitted", CYAN),
    ]
    for i, (key, value, color) in enumerate(lines):
        yy = y0 + 120 + i * 50
        visible = p > .18 + i * .1
        draw.text((ix0 + 20, yy), key, font=font(13, mono=True), fill=MUTED)
        draw.text((ix0 + 125, yy), value if visible else "—", font=font(14, bold=True, mono=True), fill=color if visible else MUTED)
    cursor(draw, x0 + 370, y0 + 140 + int(clamp(p * 2) * 70))
    return image


def render_resume(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism_label(draw)
    d, content = window(image, (92, 55, 1188, 400), "OpenCorvus · Task 2 occurrence", CYAN)
    x0, y0, x1, y1 = content
    disconnected = 4.0 < scene_t < 9.0
    status = "Local service disconnected" if disconnected else "running"
    pill(d, (x1 - 225, y0 + 8), status, RED if disconnected else GREEN, small=True)
    rows = [
        ("Mission", "ae773cbff6362f19"),
        ("Task", "task-2-cuda"),
        ("Occurrence", "occ-T2-01"),
        ("Step", "3 / 6" if scene_t < 12 else "4 / 6"),
        ("Dispatch count", "1"),
    ]
    for i, (key, value) in enumerate(rows):
        d.text((x0 + 24, y0 + 35 + i * 42), key, font=font(14, mono=True), fill=MUTED)
        d.text((x0 + 190, y0 + 35 + i * 42), value, font=font(16, bold=True, mono=True), fill=INK)
    for i, term in enumerate(("Durable State", "Same Occurrence", "Resume Cursor · Step 3/6", "No Duplicate Dispatch")):
        if scene_t > 8 + i * 1.4:
            pill(d, (x0 + 430, y0 + 36 + i * 48), term, (GREEN, CYAN, BLUE, PURPLE)[i], small=True)
    terminal_lines = [("$ bun run dev", (202, 219, 223))]
    if scene_t > 6:
        terminal_lines += [("listener ready", (117, 219, 155)), ("durable recovery started", (104, 211, 203))]
    if scene_t > 9:
        terminal_lines += [("matched occurrence occ-T2-01", (104, 211, 203)), ("resume cursor step-3", (117, 219, 155)), ("existing dispatch retained", (117, 219, 155))]
    terminal(d, (92, 425, 1188, 650), terminal_lines, "PowerShell · local service")
    cursor(d, 355 if scene_t < 8 else 1040, 525 if scene_t < 8 else 210, click=(scene_t * 1.4) % 1)
    return image


def render_artifact(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism_label(draw)
    boxes = [(72, 65, 605, 650), (625, 65, 1208, 650)]
    d, content = window(image, boxes[0], "OpenCorvus · Artifact", CYAN)
    x0, y0, x1, y1 = content
    art = scene["artifact"]
    d.text((x0 + 20, y0 + 20), "Artifact lineage", font=font(22, bold=True), fill=INK)
    for i, (key, value) in enumerate(art.items()):
        yy = y0 + 78 + i * 68
        d.text((x0 + 20, yy), key, font=font(13, mono=True), fill=MUTED)
        d.rounded_rectangle((x0 + 20, yy + 24, x1 - 18, yy + 58), radius=8, fill=(245, 249, 249), outline=LINE)
        d.text((x0 + 32, yy + 32), value, font=font(13, mono=True), fill=INK)
    if scene_t > 8:
        pill(d, (x0 + 22, y1 - 55), "artifact_read → artifact_select", GREEN, small=True)
    vd, vc = window(image, boxes[1], "VS Code · comparison.json", BLUE)
    vx0, vy0, vx1, vy1 = vc
    code = [
        '{',
        '  "selectedRunId": "innovation-smoothing-seed42",',
        '  "runs": [',
        '    { "validation": { "macroF1": 0.8343229869545659 } },',
        '    { "test": { "macroF1": 0.8361 } }',
        '  ]',
        '}',
    ]
    for i, line in enumerate(code):
        color = GREEN if "0.834" in line else (CYAN if "selectedRun" in line else INK)
        vd.text((vx0 + 20, vy0 + 28 + i * 34), line, font=font(14, mono=True), fill=color)
    line_y = vy0 + 28 + 3 * 34
    vd.rounded_rectangle((vx0 + 8, line_y - 4, vx1 - 14, line_y + 26), radius=6, fill=(214, 242, 237, 120), outline=GREEN)
    cursor(vd, vx0 + 410, line_y + 9, click=(scene_t * 1.2) % 1)
    return image


def render_review(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw, content = app_shell(image, "Mission · Independent Review")
    mechanism_label(draw)
    x0, y0, x1, y1 = content
    p = scene_t / duration
    draw.text((x0 + 18, y0 + 18), "Independent Reviewer", font=font(22, bold=True), fill=PURPLE)
    draw.text((x0 + 18, y0 + 52), "not an implementer · reads Acceptance Contract", font=font(14), fill=MUTED)
    steps = [
        ("Reproduce empty input failure", "rejected", RED, .12),
        ("Return evidence + locator", "returned", AMBER, .30),
        ("Fix input validation", "running", BLUE, .45),
        ("Focused verification", "PASS", GREEN, .63),
        ("Review same locator again", "accepted", GREEN, .78),
        ("Mission convergence", "accepted", CYAN, .90),
    ]
    for i, (label, status, color, at) in enumerate(steps):
        yy = y0 + 95 + i * 54
        visible = p >= at
        list_row(draw, (x0 + 14, yy, x1 - 275, yy + 46), label, status if visible else "pending", color if visible else MUTED)
    draw.rounded_rectangle((x1 - 248, y0 + 95, x1 - 16, y0 + 300), radius=14, fill=(248, 251, 251), outline=PURPLE)
    draw.text((x1 - 226, y0 + 118), "Terminal states", font=font(17, bold=True), fill=INK)
    pill(draw, (x1 - 226, y0 + 163), "accepted", GREEN, small=True)
    pill(draw, (x1 - 226, y0 + 207), "blocked with evidence", AMBER, small=True)
    terminal(draw, (x1 - 248, y0 + 325, x1 - 16, y1 - 20), [
        ("pytest tests/test_inference.py", (194, 214, 220)),
        ("1 passed in 2.18s", (117, 219, 155) if p > .62 else (148, 160, 165)),
        ("acceptance evidence present", (117, 219, 155) if p > .82 else (148, 160, 165)),
    ], "Focused verification")
    cursor(draw, x1 - 118, y0 + 170 + int(p * 120), click=(scene_t * 1.5) % 1)
    return image


def render_open_source(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism_label(draw)
    d, content = window(image, (74, 54, 1206, 650), "VS Code · opencorvus", BLUE)
    x0, y0, x1, y1 = content
    d.rectangle((x0, y0, x0 + 210, y1), fill=(238, 243, 245))
    files = ["packages/", "expert-squads/", "specs/", "script/", "LICENSE", "README.md"]
    for i, name in enumerate(files):
        d.text((x0 + 18, y0 + 22 + i * 34), name, font=font(14, mono=True), fill=CYAN_DARK if name == "LICENSE" else INK)
    ex0 = x0 + 228
    d.text((ex0, y0 + 18), "MIT License", font=font(22, bold=True), fill=INK)
    d.text((ex0, y0 + 58), "Copyright (c) OpenCorvus contributors", font=font(14, mono=True), fill=MUTED)
    d.text((ex0, y0 + 84), "self-hosted · swap models/tools · permission rules", font=font(12, mono=True), fill=CYAN_DARK)
    if scene_t > 3:
        d.line((ex0, y0 + 112, x1 - 20, y0 + 112), fill=LINE, width=2)
        d.text((ex0, y0 + 124), "Expert Squad Self-Evolution", font=font(19, bold=True), fill=PURPLE)
        d.text((ex0, y0 + 156), "failure evidence → candidate revision → verify", font=font(13, mono=True), fill=CYAN_DARK)
    diff = [
        ("  current: squad v4.1 · frozen", MUTED),
        ("+ preflight: verify CUDA_VISIBLE_DEVICES", GREEN),
        ("+ verify torch.cuda.is_available()", GREEN),
        ("+ blocked with evidence if CUDA unavailable", GREEN),
        ("  focused verification: PASS", GREEN),
        ("  rollback: squad/v4.1", AMBER),
    ]
    for i, (line, color) in enumerate(diff):
            d.text((ex0, y0 + 188 + i * 28), line, font=font(13, mono=True), fill=color)
    if scene_t > 9:
        mx0, my0, mx1, my1 = ex0 + 170, y0 + 340, x1 - 40, y1 - 30
        d.rounded_rectangle((mx0, my0, mx1, my1), radius=14, fill=WHITE, outline=PURPLE, width=2)
        d.text((mx0 + 18, my0 + 16), "Confirm install", font=font(18, bold=True), fill=INK)
        d.text((mx0 + 18, my0 + 50), "new Tasks → v4.2 · running Tasks → v4.1", font=font(12, mono=True), fill=MUTED)
        d.text((mx0 + 18, my0 + 78), "compare-and-swap · rollback available", font=font(13), fill=AMBER)
        d.rounded_rectangle((mx1 - 150, my1 - 48, mx1 - 18, my1 - 12), radius=9, fill=PURPLE)
        d.text((mx1 - 130, my1 - 40), "Confirm install", font=font(13, bold=True), fill=WHITE)
        cursor(d, mx1 - 75, my1 - 30, click=phase(scene_t, 11.0, .6) * (1 - phase(scene_t, 12.0, .6)))
    return image


def render_evidence(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism_label(draw, evidence=True)
    sequence = ["mission", "agents", "cuda", "web", "architecture", "paper1", "repository"]
    index = min(len(sequence) - 1, int(scene_t / (duration / len(sequence))))
    name = sequence[index]
    display_names = {
        "mission": "Mission record",
        "agents": "Agent sessions",
        "cuda": "CUDA experiments",
        "web": "Inference web",
        "architecture": "Model architecture",
        "paper1": "ACL paper",
        "repository": "Public GitHub repository",
    }
    d, content = window(image, (75, 58, 1205, 650), f"Evidence · {display_names[name]}", GREEN)
    x0, y0, x1, y1 = content
    if name in assets:
        paste_fit(image, assets[name], (x0, y0, x1 - 300, y1))
    elif name == "repository":
        rx0, ry0, rx1, ry1 = x0, y0, x1 - 300, y1
        d.rectangle((rx0, ry0, rx1, ry1), fill=(246, 248, 250))
        d.rounded_rectangle((rx0 + 22, ry0 + 18, rx1 - 22, ry0 + 55), radius=9, fill=WHITE, outline=LINE)
        d.text((rx0 + 42, ry0 + 29), "github.com/yangheng95/deberta-v3-absa-public-evidence", font=font(13, mono=True), fill=INK)
        d.text((rx0 + 28, ry0 + 82), "yangheng95 /", font=font(17, bold=True), fill=CYAN_DARK)
        d.text((rx0 + 150, ry0 + 82), "deberta-v3-absa-public-evidence", font=font(17, bold=True), fill=BLUE)
        pill(d, (rx1 - 105, ry0 + 78), "Public", GREEN, small=True)
        d.line((rx0 + 28, ry0 + 120, rx1 - 28, ry0 + 120), fill=LINE, width=2)
        d.text((rx0 + 28, ry0 + 142), "Code", font=font(15, bold=True), fill=INK)
        d.text((rx0 + 104, ry0 + 142), "Issues", font=font(15), fill=MUTED)
        d.text((rx0 + 172, ry0 + 142), "Actions", font=font(15), fill=MUTED)
        files = ["artifacts/", "configs/", "reports/", "src/", "tests/", "README.md"]
        for i, item in enumerate(files):
            yy = ry0 + 190 + i * 44
            d.rounded_rectangle((rx0 + 28, yy, rx1 - 28, yy + 35), radius=6, fill=WHITE, outline=LINE)
            d.text((rx0 + 45, yy + 9), item, font=font(13, mono=True), fill=BLUE if item.endswith("/") else INK)
        d.rounded_rectangle((rx0 + 28, ry1 - 72, rx1 - 28, ry1 - 24), radius=8, fill=(226, 244, 236), outline=GREEN)
        d.text((rx0 + 44, ry1 - 58), "GITHUB API VERIFIED · public · main · 2026-08-24", font=font(12, bold=True, mono=True), fill=GREEN)
    d.rounded_rectangle((x1 - 285, y0, x1, y1), radius=12, fill=(245, 249, 248), outline=GREEN)
    d.text((x1 - 262, y0 + 20), "Verified case facts", font=font(18, bold=True), fill=INK)
    facts = [
        ("Mission", "ae773cbff6362f19"),
        ("Wall clock", "12h 45m"),
        ("Scale", "6 Tasks · 3 squads"),
        ("Sessions", "46 · 20 roles"),
        ("Runtime", "RTX 5090 · 3 CUDA runs"),
        ("Validation", "Macro-F1 83.43%"),
        ("Test", "Macro-F1 83.61%"),
    ]
    for i, (key, value) in enumerate(facts):
        yy = y0 + 70 + i * 45
        d.text((x1 - 260, yy), key, font=font(12, mono=True), fill=MUTED)
        d.text((x1 - 154, yy), value, font=font(10 if key == "Runtime" else 11, bold=True), fill=INK)
    d.line((x1 - 262, y0 + 400, x1 - 24, y0 + 400), fill=LINE, width=2)
    d.text((x1 - 262, y0 + 420), "single seed 42", font=font(13, bold=True), fill=AMBER)
    d.text((x1 - 262, y0 + 447), "1,800 training examples", font=font(13, bold=True), fill=AMBER)
    d.text((x1 - 262, y0 + 474), "fixed-run evidence", font=font(13), fill=MUTED)
    cursor(d, x0 + 140 + int((scene_t * 95) % max(200, x1 - x0 - 500)), y1 - 55, click=(scene_t * 1.2) % 1)
    return image


def render_folders(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw = ImageDraw.Draw(image, "RGBA")
    folders = scene["folders"]
    positions = [(150, 150), (360, 150), (570, 150), (780, 150), (990, 150), (570, 340)]
    active = min(len(folders) - 1, int(scene_t / (duration / len(folders))))
    for i, (label, (x, y)) in enumerate(zip(folders, positions, strict=True)):
        color = CYAN if i == active else (173, 197, 200)
        draw.rounded_rectangle((x, y + 16, x + 120, y + 88), radius=12, fill=(240, 248, 247), outline=color, width=3 if i == active else 1)
        draw.rectangle((x + 12, y, x + 62, y + 25), fill=color)
        draw.text((x + 4, y + 101), label, font=font(16, bold=i == active), fill=INK)
    if scene_t > 8:
        d, content = window(image, (335, 390, 1040, 640), "OpenCorvus · New Mission", CYAN)
        x0, y0, x1, y1 = content
        d.text((x0 + 24, y0 + 18), "把这项独立研究推进到可检查交付。", font=font(19, bold=True), fill=INK)
        d.text((x0 + 24, y0 + 62), "Files: sources · prototype · tests · paper · release", font=font(14, mono=True), fill=MUTED)
        d.rounded_rectangle((x1 - 170, y1 - 52, x1 - 20, y1 - 12), radius=9, fill=CYAN)
        d.text((x1 - 137, y1 - 42), "Create Mission", font=font(14, bold=True), fill=WHITE)
        cursor(d, x1 - 90, y1 - 32)
    else:
        x, y = positions[active]
        cursor(draw, x + 60, y + 55, click=(scene_t * 1.7) % 1)
    return image


def render_outro(scene_t: float, duration: float, scene: dict[str, Any], assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop_base()
    draw, content = app_shell(image, "Mission · Created")
    x0, y0, x1, y1 = content
    if "logo" in assets:
        logo = assets["logo"].resize((64, 64), Image.Resampling.LANCZOS).convert("RGBA")
        image.paste(logo, (x0 + 38, y0 + 18), logo)
    draw.text((x0 + 120, y0 + 35), "OpenCorvus", font=font(40, bold=True), fill=CYAN_DARK)
    pill(draw, (x0 + 42, y0 + 105), "Goal Persisted", GREEN)
    pill(draw, (x0 + 215, y0 + 105), "Waiting for Task Plan", AMBER)
    draw.text((x0 + 42, y0 + 175), "别再给 Agent 当项目经理", font=font(27, bold=True), fill=INK)
    draw.text((x0 + 42, y0 + 235), "opencorvus.com", font=font(19, bold=True, mono=True), fill=CYAN_DARK)
    draw.text((x0 + 42, y0 + 273), "github.com/yangheng95/opencorvus", font=font(17, mono=True), fill=INK)
    draw.text((x0 + 42, y0 + 311), "Heng Yang · @yangheng95", font=font(16), fill=MUTED)
    draw.text((x0 + 42, y0 + 365), "Case: github.com/yangheng95/deberta-v3-absa-public-evidence", font=font(14, mono=True), fill=INK)
    draw.text((x0 + 42, y0 + 405), "OpenCorvus project · MIT License", font=font(14, bold=True), fill=PURPLE)
    cursor(draw, x1 - 80, y1 - 48, click=max(0.0, 1 - scene_t * 2))
    return image


RENDERERS: dict[str, Callable[..., Image.Image]] = {
    "desktop-brand": render_brand,
    "desktop-typewriter": render_typewriter,
    "desktop-context": render_context,
    "desktop-multi-window": render_multi,
    "desktop-tabs": render_tabs,
    "desktop-mission-create": render_mission_create,
    "desktop-scheduler": render_scheduler,
    "desktop-resume": render_resume,
    "desktop-artifact": render_artifact,
    "desktop-review": render_review,
    "desktop-open-source": render_open_source,
    "desktop-evidence": render_evidence,
    "desktop-folders": render_folders,
    "desktop-outro": render_outro,
}


def render_scene(scene: dict[str, Any], destination: Path, assets: dict[str, Image.Image]) -> None:
    duration = float(scene["duration"])
    renderer = RENDERERS[scene["mode"]]
    process = subprocess.Popen([
        "ffmpeg", "-y", "-v", "warning", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(destination),
    ], stdin=subprocess.PIPE)
    assert process.stdin is not None
    total = round(duration * FPS)
    for frame_index in range(total):
        t = frame_index / FPS
        image = renderer(t, duration, scene, assets) if renderer in {render_typewriter, render_context, render_multi, render_tabs, render_mission_create, render_scheduler, render_resume, render_artifact, render_review, render_open_source, render_evidence, render_folders, render_outro} else renderer(t, duration, assets)
        process.stdin.write(image.convert("RGB").tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError(f"Failed to encode {scene['id']}")


async def synthesize(text: str, destination: Path) -> None:
    import edge_tts
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text=text, voice="zh-CN-YunxiNeural", rate="+3%").save(str(destination))
            return
        except Exception as error:
            last_error = error
            if destination.exists():
                destination.unlink()
            await asyncio.sleep(1.5 * (attempt + 1))
    assert last_error is not None
    raise last_error


def voice_scene(scene: dict[str, Any], destination: Path, raw: Path) -> None:
    duration = float(scene["duration"])
    asyncio.run(synthesize(scene["narration"], raw))
    raw_duration = media_duration(raw)
    filters: list[str] = []
    if raw_duration > duration - .6:
        tempo = raw_duration / max(.5, duration - .6)
        if tempo > 1.18:
            raise RuntimeError(f"Narration too long for {scene['id']}: {tempo:.3f}x")
        filters.append(f"atempo={tempo:.6f}")
    filters += [f"apad=pad_dur={duration}", f"atrim=0:{duration}"]
    run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", ",".join(filters), "-ar", "48000", "-ac", "2", str(destination)])


def compose(output: Path, storyboard: dict[str, Any]) -> Path:
    scenes_dir = output / "scenes"
    voice_dir = output / "voice"
    raw_voice = voice_dir / "raw"
    scenes_dir.mkdir(parents=True, exist_ok=True)
    raw_voice.mkdir(parents=True, exist_ok=True)
    assets = load_evidence()
    digest = build_digest()
    suffix = digest[:12]
    videos: list[Path] = []
    audios: list[Path] = []
    for index, scene in enumerate(storyboard["scenes"]):
        video = scenes_dir / f"{index:02d}-{scene['id']}-{suffix}.mp4"
        audio = voice_dir / f"{index:02d}-{scene['id']}-{suffix}.wav"
        raw = raw_voice / f"{index:02d}-{scene['id']}-{suffix}.mp3"
        if not video.exists():
            print(f"render {scene['id']}", flush=True)
            render_scene(scene, video, assets)
        if not audio.exists():
            print(f"voice {scene['id']}", flush=True)
            voice_scene(scene, audio, raw)
        videos.append(video)
        audios.append(audio)
    video_list = output / "video-concat.txt"
    audio_list = output / "audio-concat.txt"
    video_list.write_text("".join(f"file '{p.as_posix()}'\n" for p in videos), encoding="utf-8")
    audio_list.write_text("".join(f"file '{p.as_posix()}'\n" for p in audios), encoding="utf-8")
    video_720 = output / "desktop-v5-video-720p.mp4"
    voice = output / "desktop-v5-voice.wav"
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(video_list), "-c", "copy", str(video_720)])
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(audio_list), "-c", "copy", str(voice)])
    duration = sum(float(s["duration"]) for s in storyboard["scenes"])
    music = output / "desktop-v5-music.wav"
    expr = "0.035*(sin(2*PI*110*t)+0.55*sin(2*PI*165*t)+0.35*sin(2*PI*220*t))*(0.68+0.32*sin(2*PI*0.1*t))"
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"aevalsrc={expr}:s=48000", "-t", str(duration), "-af", "afade=t=in:st=0:d=2,afade=t=out:st=214:d=4", "-ac", "2", str(music)])
    final = output / "opencorvus-mission-desktop-v5.mp4"
    run([
        "ffmpeg", "-y", "-v", "error", "-i", str(video_720), "-i", str(voice), "-i", str(music),
        "-filter_complex", "[0:v]scale=1920:1080:flags=lanczos[v];[1:a]volume=1.0[vo];[2:a]volume=0.16[bg];[vo][bg]amix=inputs=2:duration=first:dropout_transition=0[a]",
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(final),
    ])
    manifest = {
        "build_digest": digest,
        "storyboard": str(STORYBOARD),
        "renderer": str(Path(__file__)),
        "evidence": {name: str(path) for name, path in evidence_paths().items() if path.exists()},
        "scenes": [str(path) for path in videos],
        "voice": [str(path) for path in audios],
        "final": str(final),
    }
    (output / "desktop-v5-build-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return final


def inspect(video: Path, storyboard: dict[str, Any], output: Path) -> dict[str, Any]:
    probe = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)], capture=True).stdout)
    vs = next(s for s in probe["streams"] if s["codec_type"] == "video")
    audio = next(s for s in probe["streams"] if s["codec_type"] == "audio")
    frames = output / "frames"
    frames.mkdir(exist_ok=True)
    checks: list[dict[str, Any]] = []
    cursor_t = 0.0
    thumbs: list[Image.Image] = []
    labels: list[str] = []
    for scene in storyboard["scenes"]:
        duration = float(scene["duration"])
        points = [("start", .6), ("middle", duration / 2), ("end", max(.6, duration - .6))]
        if scene["id"] == "D11-open-source":
            points.append(("confirm", 12.0))
        if scene["id"] == "D12-case-proof":
            points += [("mission", 2.0), ("cuda", 8.0), ("paper", 19.0), ("repository", 23.4)]
        for label, relative_t in points:
            t = cursor_t + relative_t
            path = frames / f"{scene['id']}-{label}.png"
            run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", str(video), "-frames:v", "1", "-update", "1", str(path)])
            frame = Image.open(path).convert("RGB")
            lum = frame.convert("L").resize((1, 1)).getpixel((0, 0))
            checks.append({"scene": scene["id"], "checkpoint": label, "time": t, "frame": str(path), "luminance": lum})
            thumbs.append(fit_image(frame, (320, 180)))
            labels.append(f"{scene['id']} · {label}")
        cursor_t += float(scene["duration"])
    columns, cell_w, cell_h = 6, 320, 214
    sheet = Image.new("RGB", (columns * cell_w, math.ceil(len(thumbs) / columns) * cell_h), (234, 240, 241))
    sd = ImageDraw.Draw(sheet)
    for i, thumb in enumerate(thumbs):
        row, col = divmod(i, columns)
        x, y = col * cell_w, row * cell_h
        sheet.paste(thumb, (x, y))
        sd.text((x + 10, y + 186), labels[i], font=font(13, bold=True), fill=INK)
    sheet_path = frames / "contact-sheet.jpg"
    sheet.save(sheet_path, quality=92)
    expected = sum(float(s["duration"]) for s in storyboard["scenes"])
    report = {
        "video": str(video),
        "contact_sheet": str(sheet_path),
        "duration": float(probe["format"]["duration"]),
        "expected_duration": expected,
        "width": int(vs["width"]),
        "height": int(vs["height"]),
        "video_codec": vs["codec_name"],
        "audio_codec": audio["codec_name"],
        "checks": checks,
        "automated_scope": "media structure, duration, codecs, and non-black sampled frames",
        "manual_visual_review_required": [
            "desktop continuity and absence of full-screen slides",
            "text clipping and evidence labels",
            "D11 self-evolution diff and confirmation",
            "D12 repository and metric evidence",
            "opening and closing brand/logo/addresses",
        ],
    }
    report["structural_passed"] = report["width"] == 1920 and report["height"] == 1080 and report["video_codec"] == "h264" and report["audio_codec"] == "aac" and abs(report["duration"] - expected) <= .6 and all(item["luminance"] > 8 for item in checks)
    report_path = output / "desktop-v5-inspection.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if not report["structural_passed"]:
        raise RuntimeError(f"Inspection failed: {report_path}")
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("compose", "inspect", "scene"))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--scene-id")
    args = parser.parse_args()
    storyboard = json.loads(STORYBOARD.read_text(encoding="utf-8"))
    args.output.mkdir(parents=True, exist_ok=True)
    final = args.output / "opencorvus-mission-desktop-v5.mp4"
    if args.command == "compose":
        final = compose(args.output, storyboard)
        print(final)
    elif args.command == "inspect":
        print(json.dumps(inspect(final, storyboard, args.output), ensure_ascii=False, indent=2))
    else:
        if not args.scene_id:
            parser.error("scene requires --scene-id")
        scene = next((item for item in storyboard["scenes"] if item["id"] == args.scene_id), None)
        if scene is None:
            parser.error(f"unknown scene: {args.scene_id}")
        destination = args.output / f"{args.scene_id}.mp4"
        render_scene(scene, destination, load_evidence())
        print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
