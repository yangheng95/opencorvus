from __future__ import annotations

import argparse
import asyncio
import hashlib
import importlib.util
import json
import math
import re
import subprocess
from pathlib import Path
from typing import Any, Callable

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageStat


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
STORYBOARD = HERE / "desktop-storyboard-v5r.zh-CN.json"
DEFAULT_OUTPUT = Path(r"D:\myhexin-local\demos\opencorvus-desktop-promo-v5r-20260825")
V5C_MANIFEST = HERE / "v5c-cartoon-task-metaphor-trials.json"
V5C_GATES = HERE / "v5c-cartoon-take-gates.json"
ICON_PATH = REPO / "packages" / "web" / "public" / "web-app-manifest-512x512.png"
WORDMARK_PATH = HERE / "assets" / "live-type-runtime-v9-post" / "official-logo-light-4x.png"

BASE_PATH = HERE / "produce-desktop-v5.py"
SPEC = importlib.util.spec_from_file_location("desktop_v5_base", BASE_PATH)
assert SPEC and SPEC.loader
BASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BASE)

W, H, FPS = BASE.W, BASE.H, BASE.FPS
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
    draw.rounded_rectangle(box, radius=16, fill=(*fill, 248), outline=(*accent, 110), width=2)


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
    icon.thumbnail((54, 54), Image.Resampling.LANCZOS)
    wordmark = Image.open(WORDMARK_PATH).convert("RGBA")
    box = wordmark.getbbox()
    assert box is not None
    wordmark = wordmark.crop(box)
    wordmark = wordmark.resize((188, round(wordmark.height * 188 / wordmark.width)), Image.Resampling.LANCZOS)
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
    group.alpha_composite(ICON, (12, 7))
    group.alpha_composite(WORDMARK, (78, 16))
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
        ("01", "下载 DeBERTa V3 Base ABSA 模型与训练数据", False),
        ("02", "调研并完成 baseline + 两次创新实验", False),
        ("HARD", "RTX 5090 · CUDA ONLY · 禁止 CPU 训练", True),
        ("04", "记录 train / validation / test 指标", False),
        ("05", "交付监控、推理、图表、论文与测试", False),
        ("HARD", "验收通过，并经我确认后再发布", True),
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
        slogan = "一个需要跨越调研、实现、测试、修改和发布的项目"
        slogan_progress = min(1.0, (t - 14.0) / 2.5)
        visible_slogan = slogan[: max(1, math.ceil(len(slogan) * slogan_progress))]
        draw.text((230, 602), visible_slogan, font=font(20), fill=BLUE)
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
    return camera(image, t, duration, (650, 360), 0.018)


def render_mission(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("10:02")
    brand_signature(image)
    draw = ImageDraw.Draw(image, "RGBA")
    mechanism(draw)
    rounded_panel(draw, (120, 58, 1215, 650))
    header(draw, "NEW MISSION", "persistent record outside any one chat context")
    rows = [
        ("GOAL", "完成可复验的 DeBERTa ABSA 项目", BLUE),
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
        draw.text((116, 556), "不保证成功；保证诚实收敛和可检查证据。", font=font(21), fill=BLUE)
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
        draw.text((116, 202), "“训练前先核对 CUDA 环境”", font=font(20), fill=INK)
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
    draw.text((112, 574), "不是排名：编码、办公、runtime 与 Mission orchestration 解决不同层次。", font=font(20), fill=BLUE)
    return camera(image, t, duration, (690, 360), 0.018)


def fit(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    return BASE.fit_image(source, size)


def render_proof(t: float, duration: float, assets: dict[str, Image.Image]) -> Image.Image:
    image = desktop("12:20")
    draw = ImageDraw.Draw(image, "RGBA")
    evidence_mark(draw)
    phase_index = min(2, int(t / 7))
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
    else:
        image.paste(fit(assets["web"], (570, 430)), (100, 112))
        image.paste(fit(assets["paper1"], (350, 430)), (700, 112))
        draw.rounded_rectangle((100, 548, 1168, 620), radius=12, fill=(249, 248, 248, 244), outline=(*GREEN, 140), width=2)
        draw.text((128, 558), "monitor + inference · figures · 5-page paper · tests · public repository", font=font(20, mono=True), fill=INK)
        draw.text((128, 588), "github.com/yangheng95/deberta-v3-absa-public-evidence", font=font(18, mono=True, bold=True), fill=BLUE)
    return camera(image, t % 7, 7, (650, 350), 0.014)


def render_personal_cta(t: float, duration: float, _: dict[str, Image.Image]) -> Image.Image:
    image = desktop("12:41")
    draw = ImageDraw.Draw(image, "RGBA")
    if t < 10:
        header(draw, "YOUR NEXT LONG WORKFLOW", "research → implementation → test → revision → release")
        folders = ["毕业论文", "课程项目", "个人 OSS", "副业应用", "作品集", "独立研究"]
        for i, label in enumerate(folders):
            if t >= i * 1.1:
                x = 100 + (i % 3) * 365
                y = 180 + (i // 3) * 180
                draw.rounded_rectangle((x, y, x + 300, y + 118), radius=16, fill=(249, 248, 248), outline=(*BLUE, 110), width=2)
                draw.rectangle((x + 24, y + 30, x + 84, y + 80), fill=PALE_BLUE, outline=COBALT, width=2)
                draw.text((x + 112, y + 43), label, font=font(22, bold=True), fill=INK)
        if t > 7:
            tag(draw, 450, 558, "Create Mission", GREEN)
        brand_signature(image)
    else:
        brand_signature(image, full=True)
        draw.text((360, 476), "别再替 Agent 维持每一次交接。", font=font(27, bold=True), fill=BLUE)
        draw.text((400, 530), "Case · github.com/yangheng95/deberta-v3-absa-public-evidence", font=font(18, mono=True), fill=MUTED)
    return camera(image, min(t, 10), 10, (650, 360), 0.012)


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


def build_inputs(storyboard: dict[str, Any]) -> dict[str, Any]:
    sources = {}
    for name, path in BASE.evidence_paths().items():
        if path.exists():
            sources[name] = {"path": str(path), "sha256": sha256_file(path)}
    cartoon = accepted_cartoon_sources()
    return {
        "storyboard_sha256": sha256_file(STORYBOARD),
        "renderer_sha256": sha256_file(Path(__file__).resolve()),
        "base_renderer_sha256": sha256_file(BASE_PATH),
        "icon_sha256": sha256_file(ICON_PATH),
        "wordmark_sha256": sha256_file(WORDMARK_PATH),
        "cartoon_manifest_sha256": sha256_file(V5C_MANIFEST),
        "cartoon_gates_sha256": sha256_file(V5C_GATES),
        "cartoon_sources": {shot: {"path": str(path), "sha256": sha256_file(path)} for shot, path in cartoon.items()},
        "duration": sum(float(scene["duration"]) for scene in storyboard["scenes"]),
        "evidence": sources,
    }


def render_scene(scene: dict[str, Any], destination: Path, assets: dict[str, Image.Image]) -> None:
    duration = float(scene["duration"])
    renderer = RENDERERS[scene["mode"]]
    command = [
        "ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", f"{W}x{H}",
        "-framerate", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(destination),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    try:
        for frame in range(round(duration * FPS)):
            image = renderer(frame / FPS, duration, assets).convert("RGB")
            process.stdin.write(image.tobytes())
    finally:
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


def gate_paths(output: Path, storyboard: dict[str, Any]) -> tuple[str, Path, Path, Path]:
    digest = canonical_sha256(build_inputs(storyboard))
    root = output / "gates" / digest[:12]
    return digest, root, root / "gate-report.json", root / "gate-acceptance.json"


def render_gates(output: Path) -> dict[str, Any]:
    storyboard = json.loads(STORYBOARD.read_text(encoding="utf-8"))
    digest, root, report_path, _ = gate_paths(output, storyboard)
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
            render_scene(scene, candidate, assets)
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
        "build_digest": digest, "storyboard": str(STORYBOARD), "renderer": str(Path(__file__).resolve()),
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


def accept_gates(output: Path, reason: str) -> Path:
    storyboard = json.loads(STORYBOARD.read_text(encoding="utf-8"))
    digest, _, report_path, acceptance_path = gate_paths(output, storyboard)
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
    payload = {"build_digest": digest, "manual_reviewer": "primary-agent", "reason": reason, "accepted": accepted}
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


async def synthesize(text: str, destination: Path) -> None:
    import edge_tts

    await edge_tts.Communicate(text=text, voice="zh-CN-YunxiNeural", rate="+8%").save(str(destination))


def media_duration(path: Path) -> float:
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)], capture=True).stdout.strip())


def voice_scene(scene: dict[str, Any], destination: Path, raw: Path) -> dict[str, Any]:
    asyncio.run(synthesize(scene["narration"], raw))
    target = float(scene["duration"])
    raw_duration = media_duration(raw)
    tempo = max(1.0, raw_duration / max(0.5, target - 0.7))
    if tempo > 1.14:
        raise RuntimeError(f"Narration too dense for {scene['id']}: {tempo:.3f}x")
    filters = []
    if tempo > 1:
        filters.append(f"atempo={tempo:.6f}")
    filters += [f"apad=pad_dur={target}", f"atrim=duration={target}"]
    run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", ",".join(filters), "-ar", "48000", "-ac", "2", str(destination)])
    return {"raw_duration": raw_duration, "tempo": tempo, "spoken_duration": raw_duration / tempo}


def ass_time(seconds: float) -> str:
    centis = round(seconds * 100)
    hours, remainder = divmod(centis, 360000)
    minutes, remainder = divmod(remainder, 6000)
    whole, cents = divmod(remainder, 100)
    return f"{hours}:{minutes:02d}:{whole:02d}.{cents:02d}"


def split_sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[。！？；])", text) if part.strip()]


def wrap_subtitle(text: str, line_units: int = 46) -> str:
    tokens = re.findall(r"[A-Za-z0-9_./:+%\-]+|\s+|.", text)
    lines: list[str] = []
    current = ""
    units = 0
    for token in tokens:
        token_units = sum(2 if "\u4e00" <= char <= "\u9fff" else 1 for char in token)
        if current.strip() and units + token_units > line_units:
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
    for scene in storyboard["scenes"]:
        duration = float(scene["duration"])
        spoken_duration = min(duration - 0.18, float(by_scene[scene["id"]]["spoken_duration"]) + 0.12)
        parts = split_sentences(scene["narration"])
        weights = [max(1, len(part)) for part in parts]
        total = sum(weights)
        offset = cursor + 0.12
        for part, weight in zip(parts, weights):
            span = (spoken_duration - 0.16) * weight / total
            events.append(f"Dialogue: 0,{ass_time(offset)},{ass_time(offset + span - 0.04)},Narration,,0,0,0,,{wrap_subtitle(part)}")
            offset += span
        cursor += duration
    destination.write_text(header_text + "\n".join(events) + "\n", encoding="utf-8-sig")


def build_sound(duration: float, destination: Path) -> None:
    typing = "0.022*sin(2*PI*1450*t)*between(mod(t,0.18),0,0.012)*between(t,0.4,15.5)"
    events = [
        (5.65, 760, 0.11), (18, 520, 0.16), (25, 420, 0.22), (29.15, 650, 0.12), (34.30, 980, 0.16),
        (47, 730, 0.12), (58, 880, 0.14), (78, 1040, 0.18), (86, 620, 0.12), (93, 760, 0.12),
        (98, 920, 0.14), (103, 1100, 0.18), (110, 260, 0.32), (116, 360, 0.22), (121, 880, 0.18),
        (132, 720, 0.12), (137.15, 980, 0.18), (140.80, 820, 0.14), (151, 340, 0.25), (160, 1080, 0.2), (181, 920, 0.18),
        (201, 720, 0.12), (208, 840, 0.12), (215, 960, 0.15), (232, 1040, 0.18),
    ]
    pulses = []
    for start, frequency, amplitude in events:
        dt = f"(t-{start})"
        pulses.append(f"{amplitude}*sin(2*PI*{frequency}*{dt})*exp(-18*abs({dt}))*between(t,{start},{start + .35})")
    ambience = "0.010*(sin(2*PI*92*t)+0.45*sin(2*PI*138*t))*(0.72+0.28*sin(2*PI*0.07*t))"
    expression = typing + "+" + ambience + "+" + "+".join(pulses)
    lavfi_expression = expression.replace(",", r"\,")
    run([
        "ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"aevalsrc={lavfi_expression}:s=48000:d={duration}",
        "-af", f"afade=t=in:st=0:d=1.2,afade=t=out:st={max(0, duration - 3)}:d=3", "-ac", "2", str(destination),
    ])


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


def compose(output: Path) -> Path:
    storyboard = json.loads(STORYBOARD.read_text(encoding="utf-8"))
    inputs = build_inputs(storyboard)
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
            report = voice_scene(scene, voice_file, raw_file)
        else:
            raw_duration = media_duration(raw_file)
            target = float(scene["duration"])
            tempo = max(1.0, raw_duration / max(0.5, target - 0.7))
            report = {"cached": True, "raw_duration": raw_duration, "tempo": tempo, "spoken_duration": raw_duration / tempo}
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
    build_sound(total, sound)
    ass = root / "subtitles.ass"
    subtitles(storyboard, voice_report, ass)
    ass_filter = ass.as_posix().replace(":", r"\:")
    final = output / f"opencorvus-desktop-v5r-{digest[:12]}.mp4"
    run([
        "ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(voice), "-i", str(sound),
        "-filter_complex",
        f"[0:v]scale=1920:1080:flags=lanczos,cas=0.30,ass='{ass_filter}'[v];[1:a]volume=1.0[vo];[2:a]volume=0.62[fx];[vo][fx]amix=inputs=2:duration=first:dropout_transition=0[a]",
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(final),
    ])
    receipt = {**inputs, "build_digest": digest, "final": str(final), "final_sha256": sha256_file(final), "voice": voice_report}
    (root / "receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"final": str(final), "receipt": str(root / "receipt.json")}, ensure_ascii=False))
    return final


def inspect(video: Path, output: Path) -> dict[str, Any]:
    storyboard = json.loads(STORYBOARD.read_text(encoding="utf-8"))
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
        "video": str(video), "sha256": sha256_file(video), "duration": duration, "expected_duration": cursor,
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
    args = parser.parse_args()
    if args.command == "gates":
        render_gates(args.output.resolve())
    elif args.command == "accept-gates":
        accept_gates(args.output.resolve(), args.reason)
    elif args.command == "compose":
        compose(args.output.resolve())
    else:
        video = args.video.resolve() if args.video else max(args.output.glob("opencorvus-desktop-v5r-*.mp4"), key=lambda path: path.stat().st_mtime)
        inspect(video, args.output.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
