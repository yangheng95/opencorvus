from __future__ import annotations

import argparse
import asyncio
import hashlib
import importlib.util
import json
import math
import re
import subprocess
import wave
from contextvars import ContextVar
from pathlib import Path
from typing import Any, Callable

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageStat


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
STORYBOARD = HERE / "desktop-storyboard-v5r.zh-CN.json"
EN_STORYBOARD = HERE / "desktop-storyboard-v5r.en-US.json"
STORYBOARDS = {"zh-CN": STORYBOARD, "en-US": EN_STORYBOARD}
DEFAULT_OUTPUT = Path(r"D:\myhexin-local\demos\opencorvus-desktop-promo-v5r-20260825")
V5C_MANIFEST = HERE / "v5c-cartoon-task-metaphor-trials.json"
V5C_GATES = HERE / "v5c-cartoon-take-gates.json"
ICON_PATH = REPO / "packages" / "web" / "public" / "web-app-manifest-512x512.png"
WORDMARK_PATH = REPO / "packages" / "web" / "src" / "assets" / "logo-light.svg"
BENCHMARK_RESULT_PATH = Path(r"D:\myhexin-local\opencorvus-benchmark-results\luna-mission-base-v20260822-r3\index.html")
AUTOMATIONBENCH_CLAIMS = {
    "model": "openai/gpt-5.6-luna",
    "raw_strict_percent": 8.07,
    "mission_verified_cases": 100,
    "public_target_cases": 600,
    "mission_strict_percent": 34.00,
    "claim_source": "user-provided latest update",
}

BASE_PATH = HERE / "produce-desktop-v5.py"
SPEC = importlib.util.spec_from_file_location("desktop_v5_base", BASE_PATH)
assert SPEC and SPEC.loader
BASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BASE)

W, H, FPS = BASE.W, BASE.H, BASE.FPS
NARRATION_RATE = "+25%"
NARRATION_VOICES = {"zh-CN": "zh-CN-YunxiNeural", "en-US": "en-US-BrianNeural"}
INK = (28, 32, 40)
MUTED = (94, 98, 106)
PAPER = (249, 248, 248)
BLUE = (23, 43, 143)
COBALT = (41, 70, 211)
PALE_BLUE = (228, 233, 250)
ORANGE = (224, 75, 34)
GREEN = (29, 151, 86)
RED = (188, 54, 54)
AMBER = (202, 133, 30)
LINE = (203, 210, 220)
MONO = r"C:\Windows\Fonts\consola.ttf"
SANS = r"C:\Windows\Fonts\msyh.ttc"
BOLD = r"C:\Windows\Fonts\msyhbd.ttc"

ACTIVE_LOCALE: ContextVar[str] = ContextVar("desktop_v5r_locale", default="zh-CN")
EN_SCREEN_TEXT = {
    "下载 DeBERTa V3 Base ABSA 模型与训练数据": "Download DeBERTa V3 Base ABSA and training data",
    "调研并完成 baseline + 两次创新实验": "Research, establish a baseline, then run two innovations",
    "RTX 5090 · CUDA ONLY · 禁止 CPU 训练": "RTX 5090 · CUDA ONLY · no CPU training",
    "记录 train / validation / test 指标": "Record train / validation / test metrics",
    "交付监控、推理、图表、论文与测试": "Deliver monitoring, inference, figures, paper and tests",
    "验收通过，并经我确认后再发布": "Pass acceptance; release only after my approval",
    "一个需要跨越调研、实现、测试、修改和发布的项目": "One project spanning research, implementation, testing, revision and release",
    "完成可复验的 DeBERTa ABSA 项目": "Deliver a reproducible DeBERTa ABSA project",
    "不保证成功；保证诚实收敛和可检查证据。": "Success is not guaranteed; honest convergence and checkable evidence are.",
    "“训练前先核对 CUDA 环境”": "Verify the CUDA environment before training",
    "不是排名：编码、办公、runtime 与 Mission orchestration 解决不同层次。": "Not a ranking: coding, office work, runtimes and Mission orchestration solve different layers.",
    "AUTOMATIONBENCH · 同模型对照": "AUTOMATIONBENCH · SAME-MODEL CONTROL",
    "用户提供最新更新 · 本地旧仪表盘仅作历史快照": "User-provided latest update · local dashboard is a historical snapshot",
    "公开案例核验进度": "PUBLIC CASE VERIFICATION",
    "同一个 Luna 模型": "THE SAME LUNA MODEL",
    "原始对照": "Raw control",
    "严格通过率": "Strict pass rate",
    "严格通过案例": "Strictly passed cases",
    "全部最终状态断言通过": "Final-state assertions passed",
    "最新部分得分未并入": "Partial score excluded",
    "官方保留集参照标尺": "OFFICIAL HELD-OUT REFERENCE SCALE",
    "不同样本上下文 · 仅作参照 · 不做跨样本排名": "Different sample context · reference only · no cross-sample ranking",
    "毕业论文": "Thesis",
    "课程项目": "Course project",
    "个人 OSS": "Personal OSS",
    "副业应用": "Side project",
    "作品集": "Portfolio",
    "独立研究": "Independent study",
    "别再替 Agent 维持每一次交接。": "Stop maintaining every agent handoff yourself.",
}


def localize(text: str) -> str:
    return EN_SCREEN_TEXT.get(text, text) if ACTIVE_LOCALE.get() == "en-US" else text


def load_storyboard(locale: str) -> tuple[Path, dict[str, Any]]:
    path = STORYBOARDS[locale]
    storyboard = json.loads(path.read_text(encoding="utf-8"))
    if storyboard.get("locale") != locale:
        raise RuntimeError(f"Storyboard locale mismatch: {path}")
    return path, storyboard


def font(size: int, *, mono: bool = False, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(MONO if mono else BOLD if bold else SANS, size=max(18, size))


def run(command: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, text=True, capture_output=capture)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def phase(t: float, start: float, duration: float = 1.0) -> float:
    return ease((t - start) / max(0.001, duration))


def desktop(clock: str = "10:24") -> Image.Image:
    image = BASE.desktop_base(clock).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((0, 0, W, H - BASE.TASKBAR), fill=(247, 249, 249, 78))
    return image


def rounded_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], *, fill: tuple[int, int, int] = PAPER, accent: tuple[int, int, int] = BLUE) -> None:
    x0, y0, x1, y1 = box
    draw.rounded_rectangle((x0 + 9, y0 + 11, x1 + 9, y1 + 11), radius=18, fill=(35, 48, 77, 18))
    draw.rounded_rectangle(box, radius=16, fill=(*fill, 248), outline=(*accent, 110), width=2)
    draw.line((x0 + 28, y0, min(x1 - 28, x0 + 170), y0), fill=(*accent, 220), width=5)
    for offset, color in ((0, accent), (18, COBALT), (36, GREEN)):
        draw.ellipse((x1 - 76 + offset, y0 + 18, x1 - 66 + offset, y0 + 28), fill=(*color, 150))


def motion_geometry(image: Image.Image, t: float, duration: float, motif: str) -> None:
    """Scene-bound motion language in safe margins; every shape represents flow or state."""
    draw = ImageDraw.Draw(image, "RGBA")
    progress = max(0.0, min(1.0, t / max(duration, 0.01)))
    accent = {
        "input": ORANGE, "context": COBALT, "branches": RED, "anchor": BLUE,
        "frontier": GREEN, "recovery": GREEN, "artifact": COBALT, "review": GREEN,
        "evolution": ORANGE, "stack": BLUE, "evidence": GREEN, "workflow": COBALT,
    }[motif]
    # A persistent animated runtime rail makes time and scene progress visible.
    rail_x0, rail_x1, rail_y = 356, 930, 34
    draw.line((rail_x0, rail_y, rail_x1, rail_y), fill=(*BLUE, 38), width=2)
    for index in range(9):
        x = rail_x0 + index * (rail_x1 - rail_x0) / 8
        radius = 4 if index / 8 <= progress else 2
        draw.ellipse((x - radius, rail_y - radius, x + radius, rail_y + radius), fill=(*accent, 205 if radius == 4 else 65))
    head = rail_x0 + (rail_x1 - rail_x0) * progress
    draw.ellipse((head - 8, rail_y - 8, head + 8, rail_y + 8), fill=(*accent, 235), outline=(*PAPER, 255), width=2)

    # Side telemetry uses moving diamonds and connective traces, never text cards.
    for index in range(7):
        y = 112 + index * 73
        offset = 12 * math.sin(t * 1.2 + index * 0.8)
        x = 1242 + offset
        color = (accent, COBALT, GREEN, ORANGE)[index % 4]
        draw.line((1219, y, x - 9, y), fill=(*color, 48), width=2)
        draw.polygon([(x, y - 8), (x + 8, y), (x, y + 8), (x - 8, y)], fill=(*color, 118))

    # The lower flow line changes topology per scene and remains above the taskbar.
    base_y = 666
    if motif in {"branches", "recovery", "review", "evolution"}:
        origin = (84, base_y)
        branches = [(260, base_y - 16), (430, base_y + 4), (600, base_y - 12)]
        for index, destination in enumerate(branches):
            reveal = phase(t, index * 0.35, 0.7)
            end = (origin[0] + (destination[0] - origin[0]) * reveal, origin[1] + (destination[1] - origin[1]) * reveal)
            draw.line((origin, end), fill=(*accent, 115), width=3)
            draw.ellipse((end[0] - 5, end[1] - 5, end[0] + 5, end[1] + 5), fill=(*accent, 190))
    else:
        points = [(80 + index * 82, base_y + 8 * math.sin(t * 1.5 + index * 0.65)) for index in range(8)]
        draw.line(points, fill=(*accent, 105), width=3)
        for index, (x, y) in enumerate(points):
            radius = 5 + (2 if (index + int(t * 2)) % 4 == 0 else 0)
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*accent, 175))

    # Scene-specific focal geometry strengthens causality without adding labels.
    if motif == "context":
        center = (1120, 350)
        for radius, alpha in ((54, 70), (72, 42), (90, 25)):
            start = int((t * 72 + radius) % 360)
            draw.arc((center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius), start, start + int(220 * progress + 40), fill=(*accent, alpha + 55), width=5)
    elif motif in {"frontier", "artifact", "workflow"}:
        for index in range(5):
            travel = (progress * 1.7 + index / 5) % 1
            x = 74 + travel * 1125
            y = 635 - 10 * math.sin(travel * math.pi)
            draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill=(*accent, 190))
    elif motif == "anchor":
        center = (1170, 606)
        for radius in (18, 32, 46):
            draw.ellipse((center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius), outline=(*accent, 115 - radius), width=3)


def header(draw: ImageDraw.ImageDraw, title: str, subtitle: str = "") -> None:
    draw.text((112, 72), title, font=font(25, mono=True, bold=True), fill=BLUE)
    if subtitle:
        draw.text((112, 108), subtitle, font=font(18, mono=True), fill=MUTED)


def tag(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, color: tuple[int, int, int]) -> int:
    face = font(18, mono=True, bold=True)
    width = draw.textbbox((0, 0), text, font=face)[2] + 24
    draw.rounded_rectangle((x, y, x + width, y + 32), radius=8, fill=(*color, 238), outline=(*color, 255), width=1)
    draw.text((x + 12, y + 5), text, font=face, fill=(255, 255, 255))
    return width


def official_brand() -> tuple[Image.Image, Image.Image]:
    icon = Image.open(ICON_PATH).convert("RGBA")
    pixels = icon.load()
    for y in range(icon.height):
        for x in range(icon.width):
            red, green, blue, _ = pixels[x, y]
            distance = max(abs(red - 249), abs(green - 248), abs(blue - 248))
            pixels[x, y] = (red, green, blue, 0 if distance < 16 else min(255, distance * 16))
    box = icon.getbbox()
    assert box is not None
    icon = icon.crop(box)
    wordmark = Image.new("RGBA", (936, 168), (0, 0, 0, 0))
    ImageDraw.Draw(wordmark).text((0, 16), "OpenCorvus", font=ImageFont.truetype(MONO, 112), fill=(*INK, 255))
    box = wordmark.getbbox()
    assert box is not None
    wordmark = wordmark.crop(box)
    return icon, wordmark


ICON, WORDMARK = official_brand()


def brand_signature(image: Image.Image, *, full: bool = False) -> None:
    if full:
        group = Image.new("RGBA", (780, 300), (249, 248, 248, 242))
        icon = ICON.resize((130, 130), Image.Resampling.LANCZOS)
        wordmark = WORDMARK.resize((430, round(WORDMARK.height * 430 / WORDMARK.width)), Image.Resampling.LANCZOS)
        group.alpha_composite(icon, (64, 48))
        group.alpha_composite(wordmark, (225, 70))
        d = ImageDraw.Draw(group)
        d.text((226, 160), "opencorvus.com", font=font(25, mono=True), fill=BLUE)
        d.text((226, 204), "github.com/yangheng95/opencorvus", font=font(21, mono=True), fill=INK)
        d.text((226, 244), "Heng Yang · @yangheng95", font=font(20), fill=MUTED)
        image.alpha_composite(group, ((W - group.width) // 2, 132))
        return
    group = Image.new("RGBA", (300, 68), (249, 248, 248, 210))
    icon = ICON.resize((54, 54), Image.Resampling.LANCZOS)
    wordmark = WORDMARK.resize((188, round(WORDMARK.height * 188 / WORDMARK.width)), Image.Resampling.LANCZOS)
    group.alpha_composite(icon, (12, 7))
    group.alpha_composite(wordmark, (78, 16))
    d = ImageDraw.Draw(group)
    d.text((79, 43), "opencorvus.com", font=font(18, mono=True), fill=BLUE)
    image.alpha_composite(group, (18, 14))


def mechanism(draw: ImageDraw.ImageDraw, text: str = "MECHANISM RECONSTRUCTION") -> None:
    tag(draw, 970, 18, text, AMBER)


def evidence_mark(draw: ImageDraw.ImageDraw) -> None:
    tag(draw, 880, 18, "CAPTURED EVIDENCE · NOT LIVE", GREEN)


def camera(image: Image.Image, t: float, duration: float, focus: tuple[int, int] = (760, 340), amount: float = 0.026) -> Image.Image:
    if image.mode == "RGBA":
        flattened = Image.new("RGBA", image.size, (*PAPER, 255))
        flattened.alpha_composite(image)
        image = flattened.convert("RGB")
    progress = ease(t / max(0.01, duration))
    zoom = 1.0 + amount * progress
    crop_w = round(W / zoom)
    crop_h = round(H / zoom)
    cx = W / 2 + (focus[0] - W / 2) * progress * 0.2
    cy = H / 2 + (focus[1] - H / 2) * progress * 0.2
    left = max(0, min(W - crop_w, round(cx - crop_w / 2)))
    top = max(0, min(H - crop_h, round(cy - crop_h / 2)))
    return image.crop((left, top, left + crop_w, top + crop_h)).resize((W, H), Image.Resampling.LANCZOS)


def render_project(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("09:12")
    brand_signature(image)
    draw = ImageDraw.Draw(image, "RGBA")
    rounded_panel(draw, (180, 62, 1228, 646))
    draw.text((230, 92), "New project request", font=font(24, mono=True, bold=True), fill=BLUE)
    draw.line((230, 135, 1175, 135), fill=(*BLUE, 90), width=2)
    items = [
        ("01", localize("下载 DeBERTa V3 Base ABSA 模型与训练数据"), False),
        ("02", localize("调研并完成 baseline + 两次创新实验"), False),
        ("HARD", localize("RTX 5090 · CUDA ONLY · 禁止 CPU 训练"), True),
        ("04", localize("记录 train / validation / test 指标"), False),
        ("05", localize("交付监控、推理、图表、论文与测试"), False),
        ("HARD", localize("验收通过，并经我确认后再发布"), True),
    ]
    active_row = min(len(items) - 1, int(t / 2.2))
    for i, (number, text, hard) in enumerate(items):
        row_start = i * 2.2
        if t < row_start:
            continue
        y = 170 + i * 72
        if hard:
            tag(draw, 230, y - 4, number, ORANGE)
        else:
            draw.text((236, y), number, font=font(18, mono=True), fill=MUTED)
        progress = min(1.0, (t - row_start) / 1.75)
        visible_text = text[: max(1, math.ceil(len(text) * progress))]
        face = font(22, bold=hard)
        draw.text((340, y - 1), visible_text, font=face, fill=ORANGE if hard else INK)
        if i == active_row and progress < 1.0 and int(t * 3) % 2 == 0:
            cursor_x = 340 + draw.textbbox((0, 0), visible_text, font=face)[2] + 4
            draw.rectangle((cursor_x, y - 2, cursor_x + 4, y + 29), fill=ORANGE)
    if t >= 14.0:
        slogan = localize("一个需要跨越调研、实现、测试、修改和发布的项目")
        slogan_progress = min(1.0, (t - 14.0) / 2.5)
        visible_slogan = slogan[: max(1, math.ceil(len(slogan) * slogan_progress))]
        draw.text((230, 602), visible_slogan, font=font(20), fill=BLUE)
    motion_geometry(image, t, duration, "input")
    return camera(image, t, duration, (810, 350), 0.018)


def render_failure(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("09:31")
    brand_signature(image)
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism(draw)
    rounded_panel(draw, (70, 58, 1218, 650))
    header(draw, "AGENT SESSION · session_01", "context, plan and acceptance must agree")
    compacted = t >= 7.0
    drift = t >= 13.0
    done = t >= 18.0
    fade = 70 if compacted else 255
    draw.text((112, 150), "early constraints", font=font(18, mono=True), fill=MUTED)
    for i, text in enumerate(("CUDA ONLY", "RUN TESTS", "CONFIRM BEFORE PUBLISH")):
        y = 196 + i * 58
        draw.line((112, y + 14, 140, y + 14), fill=(*ORANGE, fade), width=5)
        draw.text((160, y), text, font=font(21, mono=True), fill=(*ORANGE, fade))
    if compacted:
        draw.text((108, 396), "07.000  Context compaction #3", font=font(20, mono=True), fill=BLUE)
        draw.text((108, 434), "older turns → summarized", font=font(18, mono=True), fill=MUTED)
    draw.line((500, 96, 500, 606), fill=(*BLUE, 70), width=2)
    draw.text((540, 110), "plan.yml", font=font(18, mono=True), fill=MUTED)
    steps = [
        ("01", "download model + data", "DONE", INK),
        ("02", "run CUDA experiments", "SKIPPED" if drift else "NEXT", RED if drift else BLUE),
        ("03", "run focused tests", "SKIPPED" if drift else "WAIT", RED if drift else MUTED),
        ("04", "draft report", "RUNNING" if drift else "WAIT", COBALT if drift else MUTED),
    ]
    for i, (num, text, state, color) in enumerate(steps):
        y = 154 + i * 72
        draw.text((540, y), num, font=font(19, mono=True), fill=MUTED)
        draw.text((596, y), text, font=font(21, mono=True), fill=color)
        draw.text((1016, y), state, font=font(18, mono=True, bold=True), fill=color)
    if drift:
        draw.line((522, 222, 522, 354), fill=COBALT, width=5)
        draw.polygon([(512, 348), (532, 348), (522, 366)], fill=COBALT)
        draw.text((540, 468), "$ python train.py", font=font(18, mono=True), fill=MUTED)
        draw.text((540, 504), "device: cpu", font=font(23, mono=True, bold=True), fill=RED)
        draw.text((770, 504), "tests: not run", font=font(23, mono=True, bold=True), fill=RED)
    if done:
        draw.rounded_rectangle((910, 544, 1145, 613), radius=12, fill=(*GREEN, 24), outline=GREEN, width=2)
        draw.text((981, 556), "DONE", font=font(30, mono=True, bold=True), fill=GREEN)
        draw.text((108, 548), "ACCEPTANCE  ☐ CUDA  ☐ TESTS  ☐ PUBLISH CONFIRMATION", font=font(19, mono=True, bold=True), fill=RED)
    occupancy = min(0.98, 0.54 + t * 0.022)
    draw.rectangle((1170, 130, 1192, 510), outline=(*BLUE, 120), width=2)
    fill_y = 505 - int(370 * occupancy)
    draw.rectangle((1175, fill_y, 1187, 505), fill=COBALT)
    draw.text((1142, 526), f"{round(occupancy * 100)}%", font=font(18, mono=True), fill=BLUE)
    motion_geometry(image, t, duration, "context")
    return camera(image, t, duration, (760, 350), 0.022)


def render_fragmentation(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("09:47")
    brand_signature(image)
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism(draw)
    header(draw, "THREE CHAT SESSIONS", "more windows do not create shared durable state")
    boxes = [(90, 150, 470, 430), (485, 150, 865, 430), (880, 150, 1210, 430)]
    titles = ["session_A", "session_B", "session_C"]
    states = [
        ("editing src/inference.py", "checkpoint: local-A", RED),
        ("editing src/inference.py", "checkpoint: local-B", RED),
        ("WAITING", "validated checkpoint path?", AMBER),
    ]
    for i, (box, title, state) in enumerate(zip(boxes, titles, states)):
        x0, y0, x1, y1 = box
        rounded_panel(draw, box, fill=(252, 252, 252), accent=COBALT if i < 2 else AMBER)
        draw.text((x0 + 24, y0 + 20), title, font=font(20, mono=True, bold=True), fill=BLUE)
        draw.text((x0 + 24, y0 + 82), state[0], font=font(20, mono=True), fill=state[2])
        draw.text((x0 + 24, y0 + 130), state[1], font=font(18, mono=True), fill=MUTED)
        if i < 2:
            draw.text((x0 + 24, y0 + 200), "same file · different state", font=font(18, mono=True), fill=RED)
    if t > 5:
        draw.line((280, 450, 680, 520), fill=RED, width=4)
        draw.line((680, 520, 1045, 450), fill=AMBER, width=4)
        tag(draw, 500, 494, "duplicated work", RED)
        tag(draw, 810, 494, "orphaned dependency", AMBER)
    clipboard = min(1.0, phase(t, 9, 2))
    if clipboard:
        draw.rounded_rectangle((220, 555, 1080, 625), radius=14, fill=(30, 35, 43, round(235 * clipboard)))
        draw.text((252, 573), "clipboard history: project-context-v1 / v2 / v3", font=font(20, mono=True), fill=(245, 248, 250, round(255 * clipboard)))
    motion_geometry(image, t, duration, "branches")
    return camera(image, t, duration, (650, 360), 0.018)


def render_mission(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("10:02")
    brand_signature(image)
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism(draw)
    rounded_panel(draw, (120, 58, 1215, 650))
    header(draw, "NEW MISSION", "persistent record outside any one chat context")
    rows = [
        ("GOAL", localize("完成可复验的 DeBERTa ABSA 项目"), BLUE),
        ("CONSTRAINTS", "RTX 5090 · CUDA only · test split not used for tuning", ORANGE),
        ("ACCEPTANCE", "3 runs · monitor · inference · figures · paper · tests", GREEN),
        ("DEPENDENCIES", "data → CUDA experiments → web/paper → publication", COBALT),
    ]
    visible = min(4, 1 + int(t / 4.0))
    for i, (label, value, color) in enumerate(rows[:visible]):
        y = 154 + i * 95
        tag(draw, 170, y, label, color)
        draw.text((390, y + 2), value, font=font(21), fill=INK)
        draw.line((390, y + 48, 1120, y + 48), fill=(*color, 60), width=2)
    if t > 17:
        tag(draw, 820, 558, "Mission record committed", GREEN)
        draw.text((170, 566), "revision: 1 · durable facts: 4", font=font(19, mono=True), fill=BLUE)
    motion_geometry(image, t, duration, "anchor")
    return camera(image, t, duration, (720, 350), 0.021)


def render_scheduler(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("10:18")
    brand_signature(image)
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism(draw)
    rounded_panel(draw, (72, 58, 1218, 650))
    header(draw, "TASK FRONTIER", "durable facts are state; queue is only a hint")
    ready = t >= 6
    running = t >= 18
    task2 = "RUNNING" if running else "READY" if ready else "WAITING"
    task2_color = GREEN if running else COBALT if ready else MUTED
    tasks = [
        ("T1 · Model & Data", "COMPLETED" if ready else "RUNNING", GREEN if ready else BLUE),
        ("T2 · CUDA Experiments", task2, task2_color),
        ("T3 · Monitor & Inference", "WAITING", MUTED),
    ]
    for i, (label, state, color) in enumerate(tasks):
        y = 150 + i * 88
        draw.rounded_rectangle((112, y, 522, y + 62), radius=12, fill=(252, 252, 252), outline=(*color, 160), width=2)
        draw.text((134, y + 15), label, font=font(20, mono=True, bold=True), fill=INK)
        state_face = font(18, mono=True, bold=True)
        state_width = draw.textbbox((0, 0), state, font=state_face)[2]
        draw.text((500 - state_width, y + 17), state, font=state_face, fill=color)
    draw.line((318, 212, 318, 238), fill=BLUE, width=4)
    draw.polygon([(309, 232), (327, 232), (318, 246)], fill=BLUE)
    draw.line((318, 300, 318, 326), fill=BLUE, width=4)
    draw.polygon([(309, 320), (327, 320), (318, 334)], fill=BLUE)
    draw.line((560, 122, 560, 596), fill=(*BLUE, 75), width=2)
    draw.text((600, 128), "scheduler event trace", font=font(18, mono=True), fill=MUTED)
    events = [
        (4, "dependency satisfied", "T1 Artifact committed", BLUE),
        (9, "reconcile durable facts", "T2 is the next frontier", BLUE),
        (13, "model judgement", "dispatch T2 with frozen squad revision", COBALT),
        (16, "dispatch_agent(...)", "occurrence + squad_revision", COBALT),
        (19, "accepted receipt", "T2 → RUNNING", GREEN),
    ]
    yy = 178
    for start, title, sub, color in events:
        if t >= start:
            draw.ellipse((612, yy + 5, 624, yy + 17), fill=color)
            draw.text((642, yy), title, font=font(20, mono=True, bold=True), fill=color)
            draw.text((642, yy + 34), sub, font=font(18, mono=True), fill=MUTED)
            yy += 82
    if ready and not running:
        tag(draw, 112, 470, "queue hint emitted", AMBER)
    if running:
        tag(draw, 112, 470, "activation lease acquired", GREEN)
        draw.text((112, 530), "occurrence: occ_03 · squad revision: frozen", font=font(19, mono=True), fill=BLUE)
    motion_geometry(image, t, duration, "frontier")
    return camera(image, t, duration, (760, 360), 0.024)


def render_recovery(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("10:41")
    brand_signature(image)
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism(draw)
    rounded_panel(draw, (72, 58, 1218, 650))
    header(draw, "TASK T2 · PHYSICAL RECOVERY", "a process loss is a real attempt boundary")
    stages = [
        (0, "01 · activation a17", "RUNNING\nstep 3 / 6", BLUE),
        (8, "02 · lease expires", "old physical attempt\nTERMINALIZED", RED),
        (12, "03 · activation a18", "new attempt reads facts\nTask T2 continues", GREEN),
    ]
    for i, (start, title, sub, color) in enumerate(stages):
        x = 130 + i * 345
        if t >= start:
            draw.rounded_rectangle((x, 174, x + 286, 346), radius=14, fill=(252, 252, 252), outline=(*color, 170), width=2)
            draw.text((x + 22, 198), title, font=font(20, mono=True, bold=True), fill=color)
            draw.multiline_text((x + 22, 252), sub, font=font(19, mono=True), fill=INK, spacing=10)
            if i < len(stages) - 1:
                draw.line((x + 286, 260, x + 329, 260), fill=(*color, 150), width=4)
                draw.polygon([(x + 321, 251), (x + 339, 260), (x + 321, 269)], fill=color)
    draw.rounded_rectangle((130, 430, 1120, 590), radius=14, fill=(24, 30, 38), outline=(80, 100, 115), width=2)
    terminal_lines = [
        ("10:41:04  physical attempt a17 lost", (235, 120, 110)),
        ("10:41:10  abandoned assistant terminalized @ lease expiry", (235, 120, 110)),
        ("10:41:14  successor a18 acquired new lease", (125, 175, 255)),
        ("10:41:17  read durable facts + selected artifact", (155, 205, 255)),
        ("10:41:19  Task T2 running · task_count unchanged", (95, 220, 160)),
    ]
    yy = 458
    for i, line in enumerate(terminal_lines):
        reveal_at = (4, 8, 12, 15, 18)[i]
        if t >= reveal_at:
            draw.text((160, yy), line[0], font=font(18, mono=True), fill=line[1])
            yy += 27
    motion_geometry(image, t, duration, "recovery")
    return camera(image, t, duration, (720, 360), 0.02)


def render_artifact(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("11:02")
    brand_signature(image)
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism(draw)
    rounded_panel(draw, (72, 58, 1218, 650))
    header(draw, "ARTIFACT HANDOFF", "a typed, traceable reference replaces “done”")
    fields = [
        ("type", "experiment-comparison"),
        ("source", "task/T2 · CUDA Experiments"),
        ("locator", "artifact_locator_ref: alr_7f31"),
        ("digest", "sha256: 5d8c…e291"),
        ("path", "reports/experiments/comparison.json  (resource)")
    ]
    visible = min(len(fields), 1 + int(t / 2.2))
    for i, (key, value) in enumerate(fields[:visible]):
        y = 150 + i * 64
        draw.text((124, y), key.upper(), font=font(18, mono=True, bold=True), fill=BLUE)
        draw.text((294, y), value, font=font(20, mono=True), fill=INK)
        draw.line((294, y + 36, 785, y + 36), fill=(*BLUE, 45), width=1)
    draw.line((830, 126, 830, 570), fill=(*BLUE, 75), width=2)
    draw.text((866, 144), "downstream consumer", font=font(18, mono=True), fill=MUTED)
    actions = [
        (8, "artifact_search", "experiment-comparison"),
        (11, "artifact_read", "alr_7f31 → read_ref arr_09"),
        (14, "artifact_select", "selected as semantic source"),
    ]
    yy = 205
    for start, action, result in actions:
        if t >= start:
            draw.text((866, yy), action, font=font(20, mono=True, bold=True), fill=COBALT)
            draw.text((866, yy + 36), result, font=font(18, mono=True), fill=GREEN if action.endswith("select") else MUTED)
            yy += 100
    if t >= 14:
        tag(draw, 866, 506, "source accepted", GREEN)
    motion_geometry(image, t, duration, "artifact")
    return camera(image, t, duration, (720, 350), 0.021)


def render_review(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("11:21")
    brand_signature(image)
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism(draw)
    rounded_panel(draw, (72, 58, 1218, 650))
    header(draw, "INDEPENDENT REVIEW", "reviewer does not participate in implementation")
    stages = [
        (0, "1 · reproduce", "empty input\ncrashes inference", BLUE),
        (4, "2 · rejected", "evidence + locator\nreturned to owner", RED),
        (8, "3 · fix + test", "input validation\n27 / 27 PASS", COBALT),
        (13, "4 · review again", "same reproduction\nstep", BLUE),
        (16, "5 · accepted", "evidence\ncomplete", GREEN),
    ]
    x = 116
    for index, (start, title, sub, color) in enumerate(stages):
        if t >= start:
            draw.rounded_rectangle((x, 178, x + 194, 348), radius=12, fill=(252, 252, 252), outline=(*color, 160), width=2)
            draw.text((x + 16, 202), title, font=font(19, mono=True, bold=True), fill=color)
            draw.multiline_text((x + 16, 254), sub, font=font(18, mono=True), fill=INK, spacing=8)
            if index < len(stages) - 1:
                draw.line((x + 194, 262, x + 216, 262), fill=(*color, 140), width=4)
        x += 216
    if t > 16:
        draw.text((116, 438), "Mission convergence", font=font(18, mono=True), fill=MUTED)
        tag(draw, 116, 480, "accepted", GREEN)
        draw.text((300, 486), "or", font=font(20, mono=True), fill=MUTED)
        tag(draw, 348, 480, "blocked with evidence", AMBER)
        draw.text((116, 556), localize("不保证成功；保证诚实收敛和可检查证据。"), font=font(21), fill=BLUE)
    motion_geometry(image, t, duration, "review")
    return camera(image, t, duration, (660, 340), 0.022)


def render_evolution(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("11:43")
    brand_signature(image)
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism(draw)
    rounded_panel(draw, (72, 58, 1218, 650))
    header(draw, "EXPERT SQUAD EVOLUTION", "candidate revisions are explicit, reviewable and reversible")
    draw.line((642, 132, 642, 580), fill=(*BLUE, 70), width=2)
    draw.text((116, 148), "PATH A · USER FEEDBACK", font=font(19, mono=True, bold=True), fill=ORANGE)
    draw.text((688, 148), "PATH B · METRIC CAMPAIGN", font=font(19, mono=True, bold=True), fill=COBALT)
    if t >= 2:
        draw.text((116, 202), localize("“训练前先核对 CUDA 环境”"), font=font(20), fill=INK)
        tag(draw, 116, 252, "candidate revision v4.2", ORANGE)
    if t >= 6:
        draw.text((116, 318), "+ verify CUDA_VISIBLE_DEVICES", font=font(18, mono=True), fill=GREEN)
        draw.text((116, 352), "+ stop with evidence when unavailable", font=font(18, mono=True), fill=GREEN)
        tag(draw, 116, 408, "user accepts", ORANGE)
    if t >= 4:
        frozen = ["package", "cases", "scorer", "environment", "budget", "mutation scope"]
        for i, text in enumerate(frozen):
            x = 688 + (i % 2) * 235
            y = 202 + (i // 2) * 54
            tag(draw, x, y, text, BLUE)
    if t >= 10:
        draw.text((688, 390), "baseline  0.842", font=font(20, mono=True), fill=INK)
        draw.text((688, 432), "candidate 0.817", font=font(20, mono=True), fill=RED)
        tag(draw, 688, 484, "regression rejected", RED)
    if t >= 17:
        draw.line((116, 548, 1100, 548), fill=(*BLUE, 70), width=2)
        draw.text((116, 574), "mutation receipt · before v4.1 → after v4.2 · rollback ref · restore requires confirmation", font=font(18, mono=True), fill=BLUE)
    motion_geometry(image, t, duration, "evolution")
    return camera(image, t, duration, (710, 360), 0.02)


def render_open_ecosystem(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("12:06")
    brand_signature(image)
    draw = ImageDraw.Draw(image, "RGBA")
    rounded_panel(draw, (72, 58, 1218, 650))
    header(draw, "OPEN SOURCE · COMPOSABLE STACK", "different tools can work at different layers")
    tag(draw, 112, 142, "MIT License", GREEN)
    tag(draw, 282, 142, "self-hosted", BLUE)
    tag(draw, 455, 142, "audit + fork", COBALT)
    layers = [
        ("Long-horizon Mission", "OpenCorvus · goals / tasks / recovery / acceptance", BLUE),
        ("Runtime harness", "DeepSeek Harness and other composable runtimes", COBALT),
        ("Coding sessions", "Codex · Claude Code", GREEN),
        ("Office deliverables", "WorkBuddy and office-product agents", ORANGE),
    ]
    for i, (title, desc, color) in enumerate(layers):
        if t >= 2 + i * 2:
            y = 220 + i * 82
            draw.rounded_rectangle((112 + i * 36, y, 1120 - i * 36, y + 62), radius=12, fill=(*color, 18), outline=(*color, 130), width=2)
            draw.text((142 + i * 36, y + 15), title, font=font(20, mono=True, bold=True), fill=color)
            draw.text((480, y + 16), desc, font=font(19), fill=INK)
    draw.text((112, 574), localize("不是排名：编码、办公、runtime 与 Mission orchestration 解决不同层次。"), font=font(20), fill=BLUE)
    motion_geometry(image, t, duration, "stack")
    return camera(image, t, duration, (690, 360), 0.018)


def fit(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    return BASE.fit_image(source, size)


def render_automationbench(draw: ImageDraw.ImageDraw, t: float) -> None:
    raw_strict = float(AUTOMATIONBENCH_CLAIMS["raw_strict_percent"])
    mission_strict = float(AUTOMATIONBENCH_CLAIMS["mission_strict_percent"])
    verified_cases = int(AUTOMATIONBENCH_CLAIMS["mission_verified_cases"])
    target_cases = int(AUTOMATIONBENCH_CLAIMS["public_target_cases"])
    draw.text((112, 92), localize("AUTOMATIONBENCH · 同模型对照"), font=font(24, bold=True), fill=BLUE)
    draw.text((112, 128), f"OpenCorvus Mission base · {AUTOMATIONBENCH_CLAIMS['model']}", font=font(18, mono=True), fill=MUTED)
    draw.text((112, 156), localize("用户提供最新更新 · 本地旧仪表盘仅作历史快照"), font=font(18), fill=ORANGE)

    coverage = phase(t, 0.2, 1.7)
    draw.text((112, 188), localize("公开案例核验进度"), font=font(19, bold=True), fill=INK)
    draw.text((1004, 184), f"{verified_cases} / {target_cases}", font=font(24, mono=True, bold=True), fill=COBALT)
    cells = 60
    x0, y0, gap, cell_w = 112, 226, 3, 15
    lit_units = cells * verified_cases / target_cases * coverage
    for index in range(cells):
        x = x0 + index * (cell_w + gap)
        amount = max(0.0, min(1.0, lit_units - index))
        color = COBALT if amount else (205, 211, 222)
        draw.rounded_rectangle((x, y0, x + cell_w, y0 + 16), radius=4, fill=(*color, round(80 + 150 * amount)))
        if 0 < amount < 1:
            draw.rectangle((x, y0, x + round(cell_w * amount), y0 + 16), fill=(*COBALT, 230))

    gain = phase(t, 1.2, 1.8)
    draw.rounded_rectangle((112, 266, 548, 490), radius=20, fill=(*PALE_BLUE, 145), outline=(*COBALT, 105), width=2)
    draw.text((142, 292), localize("同一个 Luna 模型"), font=font(20, bold=True), fill=INK)
    draw.text((142, 342), localize("原始对照"), font=font(18), fill=MUTED)
    draw.text((142, 376), f"{raw_strict:.2f}%", font=font(40, mono=True, bold=True), fill=MUTED)
    arrow_start, arrow_end = 318, 420
    arrow_x = arrow_start + (arrow_end - arrow_start) * gain
    draw.line((302, 430, arrow_x, 430), fill=(*ORANGE, 220), width=6)
    draw.polygon([(arrow_x, 420), (arrow_x + 18, 430), (arrow_x, 440)], fill=(*ORANGE, 235))
    draw.text((338, 342), "Mission base", font=font(18, bold=True), fill=BLUE)
    draw.text((338, 376), f"{raw_strict + (mission_strict - raw_strict) * gain:.2f}%", font=font(40, mono=True, bold=True), fill=COBALT)
    gain_label = (
        f"User update · +{mission_strict - raw_strict:.2f} points · n={verified_cases}"
        if ACTIVE_LOCALE.get() == "en-US"
        else f"用户更新 · +{mission_strict - raw_strict:.2f} 个百分点 · n={verified_cases}"
    )
    draw.text((142, 454), gain_label, font=font(18), fill=ORANGE)

    metrics = phase(t, 2.8, 1.2)
    draw.rounded_rectangle((584, 266, 1168, 490), radius=20, fill=(252, 252, 252, 246), outline=(*GREEN, 105), width=2)
    strict_value = mission_strict * metrics
    passed_value = round(verified_cases * mission_strict / 100) * metrics
    draw.text((620, 294), localize("严格通过率"), font=font(19, bold=True), fill=INK)
    draw.text((620, 334), f"{strict_value:.2f}%", font=font(38, mono=True, bold=True), fill=COBALT)
    draw.text((888, 294), localize("严格通过案例"), font=font(19, bold=True), fill=INK)
    draw.text((888, 334), f"{passed_value:.0f} / {verified_cases}", font=font(38, mono=True, bold=True), fill=GREEN)
    draw.text((620, 416), localize("全部最终状态断言通过"), font=font(18), fill=MUTED)
    draw.text((888, 416), localize("最新部分得分未并入"), font=font(18), fill=MUTED)

    reference = phase(t, 6.4, 2.2)
    axis_x0, axis_x1, axis_y = 112, 1168, 548
    draw.text((112, 510), localize("官方保留集参照标尺"), font=font(18, bold=True), fill=MUTED)
    draw.line((axis_x0, axis_y, axis_x1, axis_y), fill=(128, 139, 160, round(130 * reference)), width=3)
    official = [("Sol", 19.63), ("Terra", 21.00), ("Claude", 26.94), ("Gemini", 30.44)]
    for index, (label, value) in enumerate(official):
        x = axis_x0 + (axis_x1 - axis_x0) * value / 35
        reveal = phase(t, 6.6 + index * 0.35, 0.55)
        draw.line((x, axis_y - 13 * reveal, x, axis_y + 13 * reveal), fill=(110, 122, 145, round(210 * reveal)), width=3)
        draw.ellipse((x - 6, axis_y - 6, x + 6, axis_y + 6), fill=(125, 138, 165, round(220 * reveal)))
        label_y = axis_y + (16 if index % 2 == 0 else 38)
        draw.text((x - 42, label_y), f"{label} {value:.2f}", font=font(16, mono=True), fill=(92, 101, 120, round(235 * reveal)))

    boundary = phase(t, 8.8, 1.0)
    draw.rounded_rectangle((112, 610, 1168, 654), radius=12, fill=(*ORANGE, round(24 + 20 * boundary)), outline=(*ORANGE, round(130 * boundary)), width=2)
    draw.text((248, 619), localize("不同样本上下文 · 仅作参照 · 不做跨样本排名"), font=font(20, bold=True), fill=(*ORANGE, round(255 * boundary)))


def render_proof(t: float, duration: float, assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop("12:20")
    draw = ImageDraw.Draw(image, "RGBA")
    phase_index = min(3, int(t / 7))
    if phase_index < 3:
        evidence_mark(draw)
    box = (80, 58, 1200, 652)
    rounded_panel(draw, box, accent=GREEN)
    if phase_index == 0:
        source = assets["mission"]
        image.paste(fit(source, (1040, 500)), (120, 112))
        draw.rectangle((120, 112, 1160, 190), fill=(249, 248, 248, 235))
        draw.text((152, 130), "6 Tasks · ~12h45m · 3 built-in Expert Squads · 46 Agent sessions · 20 roles", font=font(21, mono=True, bold=True), fill=BLUE)
    elif phase_index == 1:
        source = assets["cuda"]
        image.paste(fit(source, (620, 500)), (100, 112))
        draw.rounded_rectangle((742, 112, 1168, 612), radius=14, fill=(249, 248, 248, 242), outline=(*GREEN, 150), width=2)
        draw.text((780, 150), "RTX 5090", font=font(28, mono=True, bold=True), fill=BLUE)
        draw.text((780, 206), "3 CUDA experiments", font=font(22, mono=True), fill=INK)
        draw.text((780, 296), "validation Macro-F1", font=font(19, mono=True), fill=MUTED)
        draw.text((780, 330), "83.43%", font=font(38, mono=True, bold=True), fill=GREEN)
        draw.text((780, 408), "selected test", font=font(19, mono=True), fill=MUTED)
        draw.text((780, 442), "83.61%", font=font(38, mono=True, bold=True), fill=GREEN)
        draw.text((780, 526), "single seed 42 · 1,800 examples", font=font(18, mono=True), fill=ORANGE)
        draw.text((780, 560), "fixed-run evidence only", font=font(18, mono=True, bold=True), fill=ORANGE)
    elif phase_index == 2:
        image.paste(fit(assets["web"], (570, 430)), (100, 112))
        image.paste(fit(assets["paper1"], (350, 430)), (700, 112))
        draw.rounded_rectangle((100, 548, 1168, 620), radius=12, fill=(249, 248, 248, 244), outline=(*GREEN, 140), width=2)
        draw.text((128, 558), "monitor + inference · figures · 5-page paper · tests · public repository", font=font(20, mono=True), fill=INK)
        draw.text((128, 588), "github.com/yangheng95/deberta-v3-absa-public-evidence", font=font(18, mono=True, bold=True), fill=BLUE)
    else:
        render_automationbench(draw, t - 21)
    motion_geometry(image, t, duration, "evidence")
    local_duration = 13 if phase_index == 3 else 7
    local_t = t - 21 if phase_index == 3 else t % 7
    return camera(image, local_t, local_duration, (650, 350), 0.014)


def render_personal_cta(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    workflow = desktop("12:41")
    draw = ImageDraw.Draw(workflow, "RGBA")
    header(draw, "YOUR NEXT LONG WORKFLOW", "research → implementation → test → revision → release")
    folders = [localize(label) for label in ("毕业论文", "课程项目", "个人 OSS", "副业应用", "作品集", "独立研究")]
    centers: list[tuple[int, int]] = []
    for i, label in enumerate(folders):
        x = 100 + (i % 3) * 365
        y = 180 + (i // 3) * 180
        centers.append((x + 150, y + 59))
        if t >= i * 1.1:
            reveal = phase(t, i * 1.1, 0.55)
            outline = (COBALT, GREEN, ORANGE)[i % 3]
            draw.rounded_rectangle((x + 7, y + 9, x + 307, y + 127), radius=18, fill=(35, 48, 77, 17))
            draw.rounded_rectangle((x, y, x + 300, y + 118), radius=16, fill=(249, 248, 248), outline=(*outline, 155), width=2)
            size = round(24 + 32 * reveal)
            draw.regular_polygon((x + 54, y + 58, size), n_sides=6, rotation=30 + i * 15, fill=(*outline, 42), outline=(*outline, 190))
            draw.ellipse((x + 48, y + 52, x + 60, y + 64), fill=(*outline, 230))
            draw.text((x + 112, y + 43), label, font=font(22, bold=True), fill=INK)
            if i:
                previous = centers[i - 1]
                line_progress = phase(t, i * 1.1 + 0.2, 0.5)
                endpoint = (previous[0] + (centers[i][0] - previous[0]) * line_progress, previous[1] + (centers[i][1] - previous[1]) * line_progress)
                draw.line((previous, endpoint), fill=(*outline, 95), width=3)
    if t > 7:
        tag(draw, 450, 558, "Create Mission", GREEN)
    brand_signature(workflow)
    motion_geometry(workflow, min(t, 10), 10, "workflow")
    workflow = camera(workflow, min(t, 9.2), 9.2, (650, 360), 0.012)

    closing = desktop("12:41")
    closing_draw = ImageDraw.Draw(closing, "RGBA")
    for x in range(48, W, 64):
        closing_draw.line((x, 54, x, 642), fill=(*BLUE, 12), width=1)
    for y in range(66, 642, 64):
        closing_draw.line((44, y, 1236, y), fill=(*BLUE, 12), width=1)
    closing_draw.rounded_rectangle((76, 82, 1204, 636), radius=28, fill=(249, 248, 248, 247), outline=(*BLUE, 62), width=2)
    closing_draw.line((410, 120, 410, 438), fill=(*BLUE, 65), width=2)
    orbit = 38 * math.sin(min(1.0, max(0.0, (t - 9.2) / 1.3)) * math.pi / 2)
    center = (242, 270)
    for radius, start, color in ((126, 205, BLUE), (96, 25, COBALT), (66, 128, GREEN)):
        closing_draw.arc((center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius), start, start + 235 + orbit, fill=(*color, 145), width=4)
    closing.alpha_composite(ICON.resize((176, 176), Image.Resampling.LANCZOS), (154, 182))
    wordmark = WORDMARK.resize((465, round(WORDMARK.height * 465 / WORDMARK.width)), Image.Resampling.LANCZOS)
    closing.alpha_composite(wordmark, (486, 138))
    identities = [
        ("WEBSITE", "opencorvus.com", BLUE),
        ("PROJECT", "github.com/yangheng95/opencorvus", COBALT),
        ("AUTHOR", "Heng Yang · @yangheng95", GREEN),
    ]
    for index, (label, value, color) in enumerate(identities):
        y = 244 + index * 66
        closing_draw.regular_polygon((498, y + 13, 10), n_sides=6, rotation=30, fill=(*color, 210))
        closing_draw.text((524, y), label, font=font(18, mono=True, bold=True), fill=color)
        closing_draw.text((668, y - 2), value, font=font(20, mono=True), fill=INK)
    closing_draw.rounded_rectangle((132, 466, 1148, 532), radius=18, fill=(*PALE_BLUE, 210), outline=(*COBALT, 100), width=2)
    closing_draw.ellipse((160, 488, 174, 502), fill=ORANGE)
    closing_draw.text((196, 479), localize("别再替 Agent 维持每一次交接。"), font=font(28, bold=True), fill=BLUE)
    closing_draw.line((196, 520, 1110, 520), fill=(*COBALT, 70), width=2)
    closing_draw.rounded_rectangle((132, 558, 1148, 608), radius=13, fill=(255, 255, 255, 242), outline=(*GREEN, 90), width=2)
    closing_draw.text((160, 571), "CASE", font=font(18, mono=True, bold=True), fill=GREEN)
    closing_draw.text((250, 570), "github.com/yangheng95/deberta-v3-absa-public-evidence", font=font(18, mono=True), fill=INK)
    for index, color in enumerate((COBALT, BLUE, GREEN, ORANGE, COBALT)):
        x = 1000 + index * 28
        closing_draw.regular_polygon((x, 108, 9), n_sides=6, rotation=30, fill=(*color, 175))

    blend = phase(t, 9.2, 0.9)
    return Image.blend(workflow.convert("RGB"), closing.convert("RGB"), blend)


RENDERERS: dict[str, Callable[[float, float, dict[str, Image.Image]], Image.Image]] = {
    "project-input": render_project,
    "context-failure": render_failure,
    "fragmentation": render_fragmentation,
    "mission-record": render_mission,
    "scheduler": render_scheduler,
    "recovery": render_recovery,
    "artifact": render_artifact,
    "review": render_review,
    "evolution": render_evolution,
    "open-ecosystem": render_open_ecosystem,
    "case-proof": render_proof,
    "personal-cta": render_personal_cta,
}


def evidence() -> dict[str, Image.Image]:
    return BASE.load_evidence()


def accepted_cartoon_sources() -> dict[str, Path]:
    gates = json.loads(V5C_GATES.read_text(encoding="utf-8"))
    if gates.get("manifest_sha256") != sha256_file(V5C_MANIFEST):
        raise RuntimeError("The cartoon B-roll gate ledger does not bind the current manifest")
    sources = {}
    for shot in ("C01", "C02", "C03"):
        gate = gates.get("shots", {}).get(shot, {})
        accepted = gate.get("accepted")
        if gate.get("status") != "accepted" or not accepted:
            raise RuntimeError(f"Cartoon B-roll is not manually accepted: {shot}")
        path = Path(accepted["path"])
        if not path.is_file() or sha256_file(path) != accepted["sha256"]:
            raise RuntimeError(f"Cartoon B-roll digest mismatch: {shot}")
        sources[shot] = path
    return sources


def build_inputs(storyboard: dict[str, Any], storyboard_path: Path | None = None) -> dict[str, Any]:
    locale = str(storyboard.get("locale", "zh-CN"))
    storyboard_path = storyboard_path or STORYBOARDS[locale]
    sources = {}
    for name, path in BASE.evidence_paths().items():
        if path.exists():
            sources[name] = {"path": str(path), "sha256": sha256_file(path)}
    cartoon = accepted_cartoon_sources()
    if not BENCHMARK_RESULT_PATH.is_file():
        raise FileNotFoundError(f"Missing AutomationBench evidence: {BENCHMARK_RESULT_PATH}")
    return {
        "locale": locale,
        "storyboard_sha256": sha256_file(storyboard_path),
        "renderer_sha256": sha256_file(Path(__file__).resolve()),
        "base_renderer_sha256": sha256_file(BASE_PATH),
        "icon_sha256": sha256_file(ICON_PATH),
        "wordmark_sha256": sha256_file(WORDMARK_PATH),
        "cartoon_manifest_sha256": sha256_file(V5C_MANIFEST),
        "cartoon_gates_sha256": sha256_file(V5C_GATES),
        "cartoon_sources": {shot: {"path": str(path), "sha256": sha256_file(path)} for shot, path in cartoon.items()},
        "automationbench_evidence": {"path": str(BENCHMARK_RESULT_PATH), "sha256": sha256_file(BENCHMARK_RESULT_PATH)},
        "automationbench_claims": AUTOMATIONBENCH_CLAIMS,
        "duration": sum(float(scene["duration"]) for scene in storyboard["scenes"]),
        "evidence": sources,
    }


def render_scene(scene: dict[str, Any], destination: Path, assets: dict[str, Image.Image], locale: str = "zh-CN") -> None:
    duration = float(scene["duration"])
    renderer = RENDERERS[scene["mode"]]
    command = [
        "ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", f"{W}x{H}",
        "-framerate", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(destination),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    locale_token = ACTIVE_LOCALE.set(locale)
    try:
        for frame in range(round(duration * FPS)):
            image = renderer(frame / FPS, duration, assets).convert("RGB")
            process.stdin.write(image.tobytes())
    finally:
        ACTIVE_LOCALE.reset(locale_token)
        process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError(f"Scene encoder failed: {scene['id']}")


def scene_motion(path: Path) -> dict[str, float]:
    binary = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(path), "-vf", "fps=2,scale=160:90", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ])
    frames = np.frombuffer(binary, np.uint8).reshape(-1, 90, 160, 3)
    diffs = np.abs(frames[1:].astype(np.int16) - frames[:-1].astype(np.int16)).mean(axis=(1, 2, 3))
    return {
        "median": float(np.median(diffs)),
        "static_ratio_lt_0_1": float((diffs < .1).sum() / max(1, len(diffs))),
        "minimum": float(diffs.min()),
        "maximum": float(diffs.max()),
    }


def gate_paths(output: Path, storyboard: dict[str, Any], storyboard_path: Path | None = None) -> tuple[str, Path, Path, Path]:
    digest = canonical_sha256(build_inputs(storyboard, storyboard_path))
    root = output / "gates" / digest[:12]
    return digest, root, root / "gate-report.json", root / "gate-acceptance.json"


def render_gates(output: Path, locale: str = "zh-CN") -> dict[str, Any]:
    storyboard_path, storyboard = load_storyboard(locale)
    digest, root, report_path, _ = gate_paths(output, storyboard, storyboard_path)
    scenes_root = root / "candidates"
    frames_root = root / "frames"
    scenes_root.mkdir(parents=True, exist_ok=True)
    frames_root.mkdir(parents=True, exist_ok=True)
    assets = evidence()
    scene_reports = []
    strips = []
    for index, scene in enumerate(storyboard["scenes"]):
        candidate = scenes_root / f"{index:02d}-{scene['id']}.mp4"
        if not candidate.is_file():
            print(f"gate render {scene['id']}", flush=True)
            render_scene(scene, candidate, assets, locale)
        duration = media_duration(candidate)
        scene_frames = []
        thumbnails = []
        scene_root = frames_root / scene["id"]
        scene_root.mkdir(exist_ok=True)
        for label, ratio in (("start", .08), ("quarter", .25), ("middle", .5), ("three_quarter", .75), ("end", .94)):
            timestamp = min(duration - .08, max(.08, duration * ratio))
            frame_path = scene_root / f"{label}.png"
            run(["ffmpeg", "-y", "-v", "error", "-ss", f"{timestamp:.3f}", "-i", str(candidate), "-frames:v", "1", "-update", "1", str(frame_path)])
            frame = Image.open(frame_path).convert("RGB")
            thumbnails.append(frame.resize((320, 180), Image.Resampling.LANCZOS))
            scene_frames.append({"label": label, "timestamp": timestamp, "path": str(frame_path), "sha256": sha256_file(frame_path)})
        strip = Image.new("RGB", (1600, 180), PAPER)
        for position, thumb in enumerate(thumbnails):
            strip.paste(thumb, (position * 320, 0))
        strips.append(strip)
        motion = scene_motion(candidate)
        scene_reports.append({
            "scene": scene["id"], "candidate": str(candidate), "candidate_sha256": sha256_file(candidate),
            "duration": duration, "expected_duration": float(scene["duration"]), "motion": motion, "frames": scene_frames,
            "automated_passed": abs(duration - float(scene["duration"])) < .08 and motion["static_ratio_lt_0_1"] < .65,
        })
    sheet = Image.new("RGB", (1600, 180 * len(strips)), PAPER)
    draw = ImageDraw.Draw(sheet)
    for index, strip in enumerate(strips):
        y = index * 180
        sheet.paste(strip, (0, y))
        draw.rectangle((0, y, 260, y + 28), fill=PAPER)
        draw.text((8, y + 4), storyboard["scenes"][index]["id"], font=font(18, mono=True), fill=BLUE)
    contact_sheet = root / "gate-contact-sheet.jpg"
    sheet.save(contact_sheet, quality=94)
    report = {
        "build_digest": digest, "locale": locale, "storyboard": str(storyboard_path), "renderer": str(Path(__file__).resolve()),
        "contact_sheet": str(contact_sheet), "scenes": scene_reports,
        "automated_passed": all(scene["automated_passed"] for scene in scene_reports),
        "manual_review_required": [
            "five-frame continuity and purposeful motion", "mobile-readable primary type", "no clipping or overlap",
            "one observable technical cause per scene", "current scheduler/recovery/artifact/evolution semantics",
            "evidence labels, numerical boundaries and brand assets",
        ],
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"passed": report["automated_passed"], "report": str(report_path), "contact_sheet": str(contact_sheet)}, ensure_ascii=False))
    return report


def accept_gates(output: Path, reason: str, locale: str = "zh-CN") -> Path:
    storyboard_path, storyboard = load_storyboard(locale)
    digest, _, report_path, acceptance_path = gate_paths(output, storyboard, storyboard_path)
    if not report_path.is_file():
        raise FileNotFoundError("Render and inspect the current gate candidates before acceptance")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if report.get("build_digest") != digest or not report.get("automated_passed"):
        raise RuntimeError("Current gate candidates have not passed structural/motion checks")
    if len(report.get("scenes", [])) != len(storyboard["scenes"]):
        raise RuntimeError("Gate report does not cover every scene")
    accepted = []
    for scene in report["scenes"]:
        candidate = Path(scene["candidate"])
        physical = sha256_file(candidate)
        if physical != scene["candidate_sha256"]:
            raise RuntimeError(f"Gate candidate changed after inspection: {candidate}")
        accepted.append({"scene": scene["scene"], "candidate": str(candidate), "sha256": physical})
    payload = {"build_digest": digest, "locale": locale, "manual_reviewer": "primary-agent", "reason": reason, "accepted": accepted}
    acceptance_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"acceptance": str(acceptance_path), "scenes": len(accepted)}, ensure_ascii=False))
    return acceptance_path


def accepted_scene_files(output: Path, storyboard: dict[str, Any]) -> list[Path]:
    digest, _, _, acceptance_path = gate_paths(output, storyboard)
    if not acceptance_path.is_file():
        raise RuntimeError("Composition is locked until all current scene gates receive a manual SHA-bound acceptance")
    payload = json.loads(acceptance_path.read_text(encoding="utf-8"))
    if payload.get("build_digest") != digest:
        raise RuntimeError("Gate acceptance belongs to a different renderer/storyboard build")
    accepted = payload.get("accepted", [])
    if [item.get("scene") for item in accepted] != [scene["id"] for scene in storyboard["scenes"]]:
        raise RuntimeError("Gate acceptance does not cover the ordered current storyboard")
    files = []
    for item in accepted:
        path = Path(item["candidate"])
        if not path.is_file() or sha256_file(path) != item["sha256"]:
            raise RuntimeError(f"Accepted scene digest mismatch: {path}")
        files.append(path)
    return files


async def synthesize(text: str, destination: Path, locale: str = "zh-CN") -> None:
    import edge_tts

    for attempt in range(3):
        try:
            await asyncio.wait_for(
                edge_tts.Communicate(text=text, voice=NARRATION_VOICES[locale], rate=NARRATION_RATE).save(str(destination)),
                timeout=30,
            )
            return
        except (edge_tts.exceptions.NoAudioReceived, asyncio.TimeoutError):
            destination.unlink(missing_ok=True)
            if attempt == 2:
                raise
            await asyncio.sleep(0.6 * (attempt + 1))


def media_duration(path: Path) -> float:
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)], capture=True).stdout.strip())


def voice_scene(scene: dict[str, Any], destination: Path, raw: Path, locale: str = "zh-CN") -> dict[str, Any]:
    asyncio.run(synthesize(scene["narration"], raw, locale))
    target = float(scene["duration"])
    raw_duration = media_duration(raw)
    if raw_duration > target - 0.45:
        raise RuntimeError(f"Narration exceeds the scene after fixed 1.25x delivery for {scene['id']}: {raw_duration:.3f}s > {target - 0.45:.3f}s")
    tempo = 1.0
    filters = [f"apad=pad_dur={target}", f"atrim=duration={target}"]
    run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", ",".join(filters), "-ar", "48000", "-ac", "2", str(destination)])
    return {"raw_duration": raw_duration, "tempo": tempo, "spoken_duration": raw_duration / tempo}


def ass_time(seconds: float) -> str:
    centis = round(seconds * 100)
    hours, remainder = divmod(centis, 360000)
    minutes, remainder = divmod(remainder, 6000)
    whole, cents = divmod(remainder, 100)
    return f"{hours}:{minutes:02d}:{whole:02d}.{cents:02d}"


def split_sentences(text: str) -> list[str]:
    boundary = r"(?<=[。！？；])|(?<=[.!?;])(?=\s|$)"
    return [part.strip() for part in re.split(boundary, text) if part.strip()]


def wrap_subtitle(text: str, line_units: int = 46) -> str:
    text = re.sub(r"(?<=\d)\s*/\s*(?=\d)", "/", text)
    tokens = re.findall(r"[A-Za-z0-9_./:+%\-]+|\s+|.", text)
    lines: list[str] = []
    current = ""
    units = 0
    prohibited_line_start = set("；，。！？、,.;:/!?%")
    for token in tokens:
        token_units = sum(2 if "\u4e00" <= char <= "\u9fff" else 1 for char in token)
        if current.strip() and units + token_units > line_units and token.strip() not in prohibited_line_start:
            lines.append(current.strip())
            current = token.lstrip()
            units = sum(2 if "\u4e00" <= char <= "\u9fff" else 1 for char in current)
        else:
            current += token
            units += token_units
    if current.strip():
        lines.append(current.strip())
    return r"\N".join(lines)


def subtitles(storyboard: dict[str, Any], voice_report: list[dict[str, Any]], destination: Path) -> None:
    header_text = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Narration,Microsoft YaHei,40,&H00FFFFFF,&H000000FF,&H701E232C,&HC01E232C,0,0,0,0,100,100,0,0,3,2,0,2,120,120,38,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    cursor = 0.0
    by_scene = {item["scene"]: item for item in voice_report}
    line_units = 68 if storyboard.get("locale") == "en-US" else 46
    for scene in storyboard["scenes"]:
        duration = float(scene["duration"])
        spoken_duration = min(duration - 0.18, float(by_scene[scene["id"]]["spoken_duration"]) + 0.12)
        parts = split_sentences(scene["narration"])
        weights = [max(1, len(part)) for part in parts]
        total = sum(weights)
        offset = cursor + 0.12
        for part, weight in zip(parts, weights):
            span = (spoken_duration - 0.16) * weight / total
            events.append(f"Dialogue: 0,{ass_time(offset)},{ass_time(offset + span - 0.04)},Narration,,0,0,0,,{wrap_subtitle(part, line_units)}")
            offset += span
        cursor += duration
    destination.write_text(header_text + "\n".join(events) + "\n", encoding="utf-8-sig")


def sound_cue_schedule(storyboard: dict[str, Any] | None = None) -> list[tuple[str, float, str]]:
    """Sparse action-bound foley; narration, not synthetic beeps, carries the film."""
    relative = {
        "R01-project": [(0.7, "typing"), (3.6, "paper"), (5.65, "transition"), (7.0, "typing"), (11.4, "click"), (15.6, "confirm")],
        "R02-failure": [(6.8, "warning"), (9.0, "compaction"), (11.15, "transition"), (12.8, "constraint-drop"), (16.3, "transition"), (20.5, "false-done")],
        "R03-fragmentation": [(0.4, "session"), (4.0, "duplicate"), (7.7, "conflict"), (9.5, "orphan"), (11.3, "paper")],
        "R04-mission-record": [(0.4, "write"), (2.9, "stamp"), (10.4, "write"), (18.0, "commit")],
        "R05-scheduler": [(0.4, "queue"), (10.2, "dispatch"), (12.7, "call"), (15.1, "receipt"), (22.5, "running")],
        "R06-recovery": [(0.4, "process"), (5.0, "dropout"), (7.1, "lease"), (11.5, "terminal"), (13.7, "successor"), (15.8, "recovery")],
        "R07-artifact": [(0.4, "artifact"), (4.6, "checksum"), (6.7, "read"), (11.15, "transition"), (12.8, "handoff"), (14.8, "transition"), (16.3, "receipt")],
        "R08-review": [(0.4, "review"), (5.1, "reject"), (7.5, "patch"), (9.9, "test"), (14.7, "accept")],
        "R09-evolution": [(0.4, "candidate"), (2.8, "feedback"), (7.6, "compare"), (14.8, "regression"), (17.2, "reject"), (19.6, "receipt")],
        "R10-open-ecosystem": [(0.4, "layer"), (5.5, "open"), (7.2, "selfhost"), (8.9, "audit"), (10.6, "fork")],
        "R11-proof": [(0.4, "server"), (7.3, "cuda"), (9.6, "gpu"), (14.2, "metric"), (16.5, "result"), (21.0, "paper"), (27.0, "click")],
        "R12-personal-cta": [(0.4, "option"), (4.0, "option"), (7.6, "option"), (11.2, "new-mission"), (15.3, "resolve")],
    }
    starts: dict[str, float] = {}
    cursor = 0.0
    storyboard = storyboard or load_storyboard("zh-CN")[1]
    for scene in storyboard["scenes"]:
        starts[scene["id"]] = cursor
        cursor += float(scene["duration"])
    return [(scene, starts[scene] + offset, kind) for scene, cues in relative.items() for offset, kind in cues]


POSITIVE_CUES = {"confirm", "commit", "receipt", "ready", "running", "recovery", "accept", "result", "new-mission", "resolve"}
NEGATIVE_CUES = {"warning", "constraint-drop", "skip", "false-done", "duplicate", "conflict", "orphan", "dropout", "lease", "terminal", "reject", "regression"}
MATERIAL_CUES = {"paper", "stamp", "artifact", "handoff", "evidence"}
DATA_CUES = {"data", "session", "write", "dependency", "queue", "waiting", "read", "judge", "dispatch", "call", "process", "clock", "successor", "reread", "checksum", "select", "review", "reproduce", "patch", "test", "retest", "candidate", "feedback", "proposal", "compare", "metric", "layer", "open", "selfhost", "audit", "fork", "mission", "server", "task", "agent", "cuda", "experiment", "boundary", "option"}


def cue_wave(kind: str, x: np.ndarray) -> tuple[np.ndarray, float]:
    active = (x >= 0).astype(np.float64)
    if kind == "typing":
        gate = (np.mod(x, 0.115) < 0.018) * (x < 0.82) * active
        return gate * (0.030 * np.sin(2 * np.pi * 1780 * x) + 0.018 * np.sin(2 * np.pi * 2960 * x)), -0.25
    if kind in {"transition", "compaction"}:
        envelope = np.sin(np.pi * np.clip(x / 0.72, 0, 1)) ** 2 * (x < 0.72) * active
        texture = np.sin(2 * np.pi * (180 * x + 620 * x * x)) + 0.38 * np.sin(2 * np.pi * 3371 * x)
        return 0.055 * envelope * texture, 0.0
    if kind in NEGATIVE_CUES:
        envelope = np.exp(-3.8 * x) * (x < 0.9) * active
        phase_value = 2 * np.pi * (330 * x - 125 * x * x)
        glitch = (np.mod(x, 0.095) < 0.045).astype(np.float64)
        return envelope * (0.050 * np.sin(phase_value) + 0.016 * glitch * np.sin(2 * np.pi * 890 * x)), -0.18
    if kind in POSITIVE_CUES:
        first = np.exp(-7 * x) * np.sin(2 * np.pi * 620 * x) * (x < 0.65) * active
        y = x - 0.16
        second = np.exp(-6 * y) * np.sin(2 * np.pi * 930 * y) * (y >= 0) * (y < 0.7)
        return 0.050 * first + 0.042 * second, 0.22
    if kind in MATERIAL_CUES:
        envelope = np.exp(-8 * x) * (x < 0.65) * active
        knock = 0.055 * np.sin(2 * np.pi * 145 * x) + 0.026 * np.sin(2 * np.pi * 1850 * x)
        rustle = 0.012 * np.sin(2 * np.pi * (1150 * x + 950 * x * x)) * (x < 0.45)
        return envelope * knock + rustle, -0.08
    if kind == "gpu":
        envelope = np.sin(np.pi * np.clip(x / 2.0, 0, 1)) ** 2 * (x < 2.0) * active
        fan = 0.028 * np.sin(2 * np.pi * 118 * x) + 0.013 * np.sin(2 * np.pi * 236 * x)
        return envelope * fan, 0.05
    if kind == "scene":
        envelope = np.exp(-5.5 * x) * (x < 0.6) * active
        return 0.030 * envelope * (np.sin(2 * np.pi * 110 * x) + 0.4 * np.sin(2 * np.pi * 220 * x)), 0.0
    if kind == "click":
        envelope = np.exp(-32 * x) * (x < 0.18) * active
        return 0.065 * envelope * (np.sin(2 * np.pi * 1250 * x) + 0.35 * np.sin(2 * np.pi * 2800 * x)), 0.25
    if kind in DATA_CUES:
        offsets = (0.0, 0.14, 0.37)
        impacts = np.zeros_like(x)
        base = 500 + 37 * (sum(ord(char) for char in kind) % 9)
        for index, offset in enumerate(offsets):
            local = x - offset
            impacts += (0.026 / (index + 1)) * np.exp(-34 * local) * (local >= 0) * (local < 0.16) * (
                np.sin(2 * np.pi * base * 1.7 * local) + 0.45 * np.sin(2 * np.pi * 2650 * local)
            )
        return impacts, 0.12
    raise ValueError(f"Unknown sound cue: {kind}")


def build_sound(duration: float, destination: Path, storyboard: dict[str, Any] | None = None) -> None:
    sample_rate = 48000
    cues = sound_cue_schedule(storyboard)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destination), "wb") as target:
        target.setnchannels(2)
        target.setsampwidth(2)
        target.setframerate(sample_rate)
        chunk_samples = sample_rate
        written = 0
        total_samples = int(round(duration * sample_rate))
        while written < total_samples:
            count = min(chunk_samples, total_samples - written)
            t = (written + np.arange(count, dtype=np.float64)) / sample_rate
            room = 0.76 + 0.24 * np.sin(2 * np.pi * 0.027 * t)
            left = room * (0.0032 * np.sin(2 * np.pi * 61 * t) + 0.0018 * np.sin(2 * np.pi * 103 * t + 0.3))
            right = room * (0.0032 * np.sin(2 * np.pi * 63 * t + 0.2) + 0.0018 * np.sin(2 * np.pi * 101 * t))
            chunk_start = written / sample_rate
            chunk_end = (written + count) / sample_rate
            for _, start, kind in cues:
                if start + 2.1 < chunk_start or start >= chunk_end:
                    continue
                mono, pan = cue_wave(kind, t - start)
                left += mono * math.sqrt((1 - pan) / 2)
                right += mono * math.sqrt((1 + pan) / 2)
            fade_in = np.clip(t / 1.0, 0, 1)
            fade_out = np.clip((duration - t) / 2.5, 0, 1)
            left *= fade_in * fade_out
            right *= fade_in * fade_out
            stereo = np.column_stack((left, right))
            peak = max(1.0, float(np.max(np.abs(stereo))) / 0.82)
            pcm = np.asarray(np.clip(stereo / peak, -1, 1) * 32767, dtype="<i2")
            target.writeframes(pcm.tobytes())
            written += count


def opening_brand_overlay(root: Path) -> Path:
    destination = root / "opening-brand-overlay.png"
    if destination.is_file():
        return destination
    image = Image.new("RGBA", (560, 108), (*PAPER, 238))
    icon = ICON.resize((62, 62), Image.Resampling.LANCZOS)
    wordmark = WORDMARK.resize((210, round(WORDMARK.height * 210 / WORDMARK.width)), Image.Resampling.LANCZOS)
    image.alpha_composite(icon, (12, 10))
    image.alpha_composite(wordmark, (86, 12))
    draw = ImageDraw.Draw(image)
    draw.text((86, 48), "opencorvus.com · Heng Yang @yangheng95", font=font(18, mono=True), fill=BLUE)
    draw.text((86, 76), "github.com/yangheng95/opencorvus", font=font(18, mono=True), fill=INK)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination)
    return destination


def hybrid_scene_files(scene_files: list[Path], storyboard: dict[str, Any], root: Path) -> list[Path]:
    cartoon = accepted_cartoon_sources()
    hybrid_root = root / "hybrid-scenes"
    hybrid_root.mkdir(parents=True, exist_ok=True)
    by_id = {scene["id"]: (index, scene) for index, scene in enumerate(storyboard["scenes"])}
    outputs = list(scene_files)

    def h3_filter(index: int, start: float, label: str) -> str:
        return (
            f"[{index}:v]trim=start={start:.6f},setpts=PTS-STARTPTS,"
            f"scale=1280:741:flags=lanczos,crop=1280:720,fps={FPS},settb=AVTB,setsar=1,format=yuv420p[{label}]"
        )

    def raw_filter(index: int, start: float, end: float, label: str) -> str:
        return (
            f"[{index}:v]trim=start={start:.6f}:end={end:.6f},setpts=PTS-STARTPTS,"
            f"fps={FPS},settb=AVTB,setsar=1,format=yuv420p[{label}]"
        )

    def render(scene_id: str, command_inputs: list[Path], filter_complex: str, *, looped_inputs: set[int] | None = None) -> None:
        index, _ = by_id[scene_id]
        destination = hybrid_root / f"{index:02d}-{scene_id}.mp4"
        if not destination.is_file():
            command = ["ffmpeg", "-y", "-v", "error"]
            for input_index, source in enumerate(command_inputs):
                if looped_inputs and input_index in looped_inputs:
                    command += ["-loop", "1"]
                command += ["-i", str(source)]
            command += [
                "-filter_complex", filter_complex, "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "medium",
                "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(destination),
            ]
            run(command)
        outputs[index] = destination

    index, scene = by_id["R01-project"]
    brand = opening_brand_overlay(root)
    render(
        scene["id"], [scene_files[index], cartoon["C01"], brand],
        h3_filter(1, 0.0, "cartoon")
        + ";[cartoon]trim=duration=6,setpts=PTS-STARTPTS[c0];[2:v]format=rgba,fade=t=out:st=5.15:d=0.5:alpha=1[brand];"
        + "[c0][brand]overlay=20:18:shortest=1:format=auto[c];"
        + raw_filter(0, 5.65, float(scene["duration"]), "r")
        + ";[c][r]xfade=transition=fade:duration=0.35:offset=5.65[out]",
        looped_inputs={2},
    )

    index, scene = by_id["R02-failure"]
    c02_start = max(0.0, media_duration(cartoon["C02"]) - 5.5)
    render(
        scene["id"], [scene_files[index], cartoon["C02"]],
        raw_filter(0, 0.0, 11.5, "r1") + ";"
        + h3_filter(1, c02_start, "context")
        + ";[context]trim=duration=5.5,setpts=PTS-STARTPTS[c];"
        + raw_filter(0, 16.3, float(scene["duration"]), "r2")
        + ";[r1][c]xfade=transition=fade:duration=0.35:offset=11.15[x];"
        + "[x][r2]xfade=transition=fade:duration=0.35:offset=16.30[out]",
    )

    index, scene = by_id["R07-artifact"]
    c03_start = max(0.0, media_duration(cartoon["C03"]) - 4.0)
    render(
        scene["id"], [scene_files[index], cartoon["C03"]],
        raw_filter(0, 0.0, 11.5, "r1") + ";"
        + h3_filter(1, c03_start, "handoff")
        + ";[handoff]trim=duration=4,setpts=PTS-STARTPTS[h];"
        + raw_filter(0, 14.8, float(scene["duration"]), "r2")
        + ";[r1][h]xfade=transition=fade:duration=0.35:offset=11.15[x];"
        + "[x][r2]xfade=transition=fade:duration=0.35:offset=14.80[out]",
    )
    return outputs


def compose(output: Path, locale: str = "zh-CN") -> Path:
    storyboard_path, storyboard = load_storyboard(locale)
    inputs = build_inputs(storyboard, storyboard_path)
    digest = canonical_sha256(inputs)
    root = output / "builds" / digest[:12]
    voice_root = root / "voice"
    raw_root = voice_root / "raw"
    for directory in (voice_root, raw_root):
        directory.mkdir(parents=True, exist_ok=True)
    scene_files = accepted_scene_files(output, storyboard)
    voice_files = []
    voice_report = []
    for index, scene in enumerate(storyboard["scenes"]):
        voice_file = voice_root / f"{index:02d}-{scene['id']}.wav"
        raw_file = raw_root / f"{index:02d}-{scene['id']}.mp3"
        if not voice_file.is_file():
            print(f"voice {scene['id']}", flush=True)
            report = voice_scene(scene, voice_file, raw_file, locale)
        else:
            raw_duration = media_duration(raw_file)
            target = float(scene["duration"])
            if raw_duration > target - 0.45:
                raise RuntimeError(f"Cached narration exceeds the scene after fixed 1.25x delivery for {scene['id']}: {raw_duration:.3f}s > {target - 0.45:.3f}s")
            report = {"cached": True, "raw_duration": raw_duration, "tempo": 1.0, "spoken_duration": raw_duration}
        report.update(scene=scene["id"], target=float(scene["duration"]))
        voice_report.append(report)
        voice_files.append(voice_file)
    scene_files = hybrid_scene_files(scene_files, storyboard, root)
    video_list = root / "video.txt"
    voice_list = root / "voice.txt"
    video_list.write_text("".join(f"file '{path.as_posix()}'\n" for path in scene_files), encoding="utf-8")
    voice_list.write_text("".join(f"file '{path.as_posix()}'\n" for path in voice_files), encoding="utf-8")
    video = root / "video-720p.mp4"
    voice = root / "voice.wav"
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(video_list), "-c", "copy", str(video)])
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(voice_list), "-c", "copy", str(voice)])
    total = sum(float(scene["duration"]) for scene in storyboard["scenes"])
    sound = root / "sound.wav"
    build_sound(total, sound, storyboard)
    ass = root / "subtitles.ass"
    subtitles(storyboard, voice_report, ass)
    ass_filter = ass.as_posix().replace(":", r"\:")
    final = output / f"opencorvus-desktop-v5r-{locale}-{digest[:12]}.mp4"
    run([
        "ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(voice), "-i", str(sound),
        "-filter_complex",
        f"[0:v]scale=1920:1080:flags=lanczos,cas=0.30,ass='{ass_filter}'[v];"
        "[1:a]volume=1.0,asplit=2[vo][sidechain];"
        "[2:a]volume=0.92[fx];"
        "[fx][sidechain]sidechaincompress=threshold=0.018:ratio=7:attack=10:release=280:makeup=1[ducked];"
        "[vo][ducked]amix=inputs=2:duration=first:dropout_transition=0,"
        "loudnorm=I=-16:TP=-1.5:LRA=9[a]",
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(final),
    ])
    receipt = {**inputs, "build_digest": digest, "final": str(final), "final_sha256": sha256_file(final), "voice": voice_report}
    (root / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"final": str(final), "receipt": str(root / "receipt.json")}, ensure_ascii=False))
    return final


def inspect(video: Path, output: Path, locale: str = "zh-CN") -> dict[str, Any]:
    _, storyboard = load_storyboard(locale)
    probe = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)], capture=True).stdout)
    vs = next(stream for stream in probe["streams"] if stream["codec_type"] == "video")
    audio = next(stream for stream in probe["streams"] if stream["codec_type"] == "audio")
    duration = float(probe["format"]["duration"])
    root = output / "inspection" / video.stem
    root.mkdir(parents=True, exist_ok=True)
    checks = []
    representatives = []
    cursor = 0.0
    for scene in storyboard["scenes"]:
        scene_duration = float(scene["duration"])
        scene_root = root / scene["id"]
        scene_root.mkdir(exist_ok=True)
        points = {"start": .15, "quarter": .25, "middle": .5, "three_quarter": .75, "end": .98}
        frames = []
        for label, ratio in points.items():
            timestamp = cursor + min(scene_duration - .08, max(.08, scene_duration * ratio))
            path = scene_root / f"{label}.png"
            run(["ffmpeg", "-y", "-v", "error", "-ss", f"{timestamp:.3f}", "-i", str(video), "-frames:v", "1", "-update", "1", str(path)])
            image = Image.open(path).convert("RGB")
            frames.append({"label": label, "timestamp": timestamp, "path": str(path), "luminance": ImageStat.Stat(image.convert("L")).mean[0]})
            if label == "middle":
                representatives.append(path)
        checks.append({"scene": scene["id"], "start": cursor, "duration": scene_duration, "frames": frames})
        cursor += scene_duration
    sheet = Image.new("RGB", (640 * 3, 360 * 4), PAPER)
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(representatives):
        thumb = Image.open(path).convert("RGB").resize((640, 360), Image.Resampling.LANCZOS)
        x = (index % 3) * 640
        y = (index // 3) * 360
        sheet.paste(thumb, (x, y))
        draw.rectangle((x, y, x + 225, y + 30), fill=PAPER)
        draw.text((x + 8, y + 4), storyboard["scenes"][index]["id"], font=font(18, mono=True), fill=BLUE)
    contact = root / "12-scene-contact-sheet.jpg"
    sheet.save(contact, quality=94)
    binary = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(video), "-vf", "fps=1,scale=320:180", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    frames = np.frombuffer(binary, np.uint8).reshape(-1, 180, 320, 3)
    diffs = np.abs(frames[1:].astype(np.int16) - frames[:-1].astype(np.int16)).mean(axis=(1, 2, 3))
    static_ratio = float((diffs < .1).sum() / max(1, len(diffs)))
    result = {
        "video": str(video), "sha256": sha256_file(video), "locale": locale, "duration": duration, "expected_duration": cursor,
        "width": int(vs["width"]), "height": int(vs["height"]), "video_codec": vs["codec_name"],
        "audio_codec": audio["codec_name"], "sample_rate": int(audio["sample_rate"]), "channels": int(audio["channels"]),
        "contact_sheet": str(contact), "static_one_second_ratio": static_ratio, "motion_median": float(np.median(diffs)), "scenes": checks,
        "structural_passed": abs(duration - cursor) < .08 and int(vs["width"]) == 1920 and int(vs["height"]) == 1080 and static_ratio < .45,
    }
    (root / "inspection.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"passed": result["structural_passed"], "report": str(root / "inspection.json"), "contact_sheet": str(contact)}, ensure_ascii=False))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Produce the regenerated OpenCorvus Desktop V5R film.")
    parser.add_argument("command", choices=["gates", "accept-gates", "compose", "inspect"])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--video", type=Path)
    parser.add_argument("--reason", default="Five-frame manual review passed for all current scenes")
    parser.add_argument("--locale", choices=sorted(STORYBOARDS), default="zh-CN")
    args = parser.parse_args()
    if args.command == "gates":
        render_gates(args.output.resolve(), args.locale)
    elif args.command == "accept-gates":
        accept_gates(args.output.resolve(), args.reason, args.locale)
    elif args.command == "compose":
        compose(args.output.resolve(), args.locale)
    else:
        video = args.video.resolve() if args.video else max(args.output.glob(f"opencorvus-desktop-v5r-{args.locale}-*.mp4"), key=lambda path: path.stat().st_mtime)
        inspect(video, args.output.resolve(), args.locale)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
