from __future__ import annotations

import argparse
import json
import os
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageOps, ImageStat


DEFAULT_INSTALL = Path(r"D:\myhexin-local\demos\minimax-h3-local-5090")
DEFAULT_OUTPUT = Path(r"D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824")
TERMINAL_HISTORY = {"success", "error"}


def request_json(url: str, *, method: str = "GET", payload: dict[str, Any] | None = None, timeout: int = 30) -> dict[str, Any]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"ComfyUI HTTP {error.code}: {body[:2000]}") from error


def wait_ready(base_url: str, timeout: int = 180) -> None:
    deadline = time.monotonic() + timeout
    last_error = "not contacted"
    while time.monotonic() < deadline:
        try:
            stats = request_json(f"{base_url}/system_stats", timeout=5)
            if stats:
                return
        except Exception as error:  # server startup is expected to refuse briefly
            last_error = str(error)
        time.sleep(2)
    raise TimeoutError(f"ComfyUI did not become ready: {last_error}")


def start_comfy(install: Path, base_url: str) -> subprocess.Popen[bytes] | None:
    try:
        request_json(f"{base_url}/system_stats", timeout=3)
        return None
    except Exception:
        pass
    parsed = urllib.parse.urlparse(base_url)
    if parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("Automatic start is restricted to localhost.")
    comfy = install / "runtime" / "ComfyUI"
    python = install / "runtime" / "venv" / "Scripts" / "python.exe"
    if not python.exists() or not (comfy / "main.py").exists():
        raise FileNotFoundError("Local H3 runtime is not installed. Run install-local-h3.ps1 first.")
    log_dir = install / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    stdout = (log_dir / "comfy.stdout.log").open("ab")
    stderr = (log_dir / "comfy.stderr.log").open("ab")
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    process = subprocess.Popen(
        [str(python), "main.py", "--listen", "127.0.0.1", "--port", str(parsed.port or 8188)],
        cwd=comfy,
        stdout=stdout,
        stderr=stderr,
        creationflags=flags,
    )
    wait_ready(base_url)
    return process


class ResourceMonitor:
    def __init__(self) -> None:
        self.samples: list[dict[str, Any]] = []
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True)

    def _run(self) -> None:
        while not self.stop_event.is_set():
            sample: dict[str, Any] = {"at": time.time()}
            try:
                output = subprocess.check_output(
                    ["nvidia-smi", "--query-gpu=memory.used,utilization.gpu,power.draw,temperature.gpu", "--format=csv,noheader,nounits"],
                    text=True,
                    timeout=5,
                ).strip().split(",")
                sample.update(
                    vram_mib=float(output[0]),
                    gpu_util_percent=float(output[1]),
                    power_w=float(output[2]),
                    temperature_c=float(output[3]),
                )
            except Exception:
                pass
            try:
                script = "(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory"
                free_kib = float(subprocess.check_output(["powershell", "-NoProfile", "-Command", script], text=True, timeout=8).strip())
                sample["free_ram_gib"] = free_kib / (1024 * 1024)
            except Exception:
                pass
            self.samples.append(sample)
            self.stop_event.wait(2)

    def __enter__(self) -> "ResourceMonitor":
        self.thread.start()
        return self

    def __exit__(self, *_: object) -> None:
        self.stop_event.set()
        self.thread.join(timeout=5)


def find_media(outputs: dict[str, Any]) -> dict[str, str]:
    for node in outputs.values():
        for key in ("videos", "gifs", "images"):
            for item in node.get(key, []):
                filename = item.get("filename", "")
                if filename.lower().endswith((".mp4", ".webm", ".mov")):
                    return item
    raise RuntimeError(f"No video output found in history nodes: {list(outputs)}")


def download_output(base_url: str, media: dict[str, str], destination: Path) -> None:
    query = urllib.parse.urlencode(
        {"filename": media["filename"], "subfolder": media.get("subfolder", ""), "type": media.get("type", "output")}
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(f"{base_url}/view?{query}", timeout=120) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)


def inspect_clip(video: Path, frames_root: Path) -> dict[str, Any]:
    probe = json.loads(
        subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)],
            text=True,
            timeout=30,
        )
    )
    video_stream = next(stream for stream in probe["streams"] if stream["codec_type"] == "video")
    audio_stream = next((stream for stream in probe["streams"] if stream["codec_type"] == "audio"), None)
    duration = float(probe["format"]["duration"])
    frames_root.mkdir(parents=True, exist_ok=True)
    times = [max(0.05, min(duration - 0.05, value)) for value in (0.2, duration / 2, duration - 0.2)]
    inspections: list[dict[str, Any]] = []
    previous: Image.Image | None = None
    for label, timestamp in zip(("start", "middle", "end"), times, strict=True):
        path = frames_root / f"{label}.png"
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-ss", f"{timestamp:.3f}", "-i", str(video), "-frames:v", "1", "-update", "1", str(path)],
            check=True,
            timeout=60,
        )
        frame = Image.open(path).convert("RGB")
        luminance = ImageStat.Stat(frame.convert("L")).mean[0]
        difference = None if previous is None else ImageStat.Stat(ImageChops.difference(frame, previous).convert("L")).mean[0]
        inspections.append({"label": label, "timestamp": timestamp, "path": str(path), "luminance": luminance, "difference": difference})
        previous = frame
    result = {
        "duration": duration,
        "width": int(video_stream["width"]),
        "height": int(video_stream["height"]),
        "fps": video_stream.get("avg_frame_rate"),
        "video_codec": video_stream["codec_name"],
        "audio_codec": None if audio_stream is None else audio_stream["codec_name"],
        "audio_channels": None if audio_stream is None else int(audio_stream.get("channels", 0)),
        "audio_sample_rate": None if audio_stream is None else int(audio_stream.get("sample_rate", 0)),
        "frames": inspections,
    }
    result["passed"] = (
        result["video_codec"] == "h264"
        and result["audio_codec"] == "aac"
        and result["audio_channels"] == 2
        and result["audio_sample_rate"] == 32000
        and all(item["luminance"] >= 8 for item in inspections)
        and all(item["difference"] is None or item["difference"] >= 0.75 for item in inspections)
    )
    return result


def generate(
    *,
    base_url: str,
    workflow_path: Path,
    output_path: Path,
    prompt: str,
    width: int,
    height: int,
    duration: float,
    steps: int,
    seed: int,
    inactivity_timeout: int,
) -> dict[str, Any]:
    workflow = json.loads(workflow_path.read_text(encoding="utf-8"))
    length = max(5, round(duration * 24))
    length += (5 - (length % 17)) % 17
    workflow["104"]["inputs"].update(prompt=prompt, width=width, height=height, length=length)
    workflow["9"]["inputs"]["steps"] = steps
    workflow["15"]["inputs"]["noise_seed"] = seed
    workflow["92"]["inputs"]["filename_prefix"] = f"video/opencorvus_h3_{output_path.stem}"
    # This exact stack is the single-5090 contract; refuse accidental BF16 expansion.
    workflow["6"]["inputs"]["unet_name"] = "minimax_h3_fl2va_pruned_int8_convrot.safetensors"
    workflow["13"]["inputs"]["clip_name"] = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"

    started = time.time()
    client_id = str(uuid.uuid4())
    response = request_json(f"{base_url}/prompt", method="POST", payload={"prompt": workflow, "client_id": client_id})
    prompt_id = response.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"ComfyUI rejected prompt: {response}")
    last_activity = time.monotonic()
    last_queue: tuple[int, int] | None = None
    record: dict[str, Any] | None = None
    with ResourceMonitor() as monitor:
        while time.monotonic() - last_activity < inactivity_timeout:
            history = request_json(f"{base_url}/history/{prompt_id}", timeout=15)
            if prompt_id in history:
                record = history[prompt_id]
                break
            queue = request_json(f"{base_url}/queue", timeout=15)
            state = (len(queue.get("queue_running", [])), len(queue.get("queue_pending", [])))
            if state != last_queue:
                print(f"queue running={state[0]} pending={state[1]}", flush=True)
                last_queue = state
                last_activity = time.monotonic()
            time.sleep(5)
    if record is None:
        raise TimeoutError(f"No ComfyUI activity for {inactivity_timeout}s (prompt {prompt_id})")
    status = record.get("status", {})
    if status.get("status_str") != "success":
        raise RuntimeError(f"Generation failed: {json.dumps(status, ensure_ascii=False)[:3000]}")
    media = find_media(record.get("outputs", {}))
    download_output(base_url, media, output_path)
    report = {
        "prompt_id": prompt_id,
        "started_at": started,
        "completed_at": time.time(),
        "elapsed_seconds": time.time() - started,
        "output": str(output_path),
        "width": width,
        "height": height,
        "requested_duration": duration,
        "frames": length,
        "steps": steps,
        "seed": seed,
        "diffusion": workflow["6"]["inputs"]["unet_name"],
        "text_encoder": workflow["13"]["inputs"]["clip_name"],
        "peak_vram_mib": max((item.get("vram_mib", 0) for item in monitor.samples), default=0),
        "minimum_free_ram_gib": min((item.get("free_ram_gib", 9999) for item in monitor.samples), default=0),
        "resource_samples": monitor.samples,
    }
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a real local MiniMax H3 clip on one RTX 5090 through ComfyUI.")
    parser.add_argument("--install", type=Path, default=DEFAULT_INSTALL)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--base-url", default="http://127.0.0.1:8188")
    parser.add_argument("--scene", default="smoke")
    parser.add_argument("--prompt")
    parser.add_argument("--width", type=int, default=608)
    parser.add_argument("--height", type=int, default=352)
    parser.add_argument("--duration", type=float, default=3)
    parser.add_argument("--steps", type=int, default=10)
    parser.add_argument("--seed", type=int, default=20260824)
    parser.add_argument("--inactivity-timeout", type=int, default=3600)
    args = parser.parse_args()

    storyboard_path = Path(__file__).with_name("storyboard.zh-CN.json")
    storyboard = json.loads(storyboard_path.read_text(encoding="utf-8"))
    if args.prompt:
        prompt = args.prompt
    elif args.scene == "smoke":
        prompt = "Cinematic macro view of a luminous workflow path continuing through durable checkpoints toward a polished artifact, graphite background, cyan and amber light, precise physical motion, no text, no logos, no software interface. [background_audio] subtle machine room ambience, soft confirmation tones, restrained stereo movement."
    else:
        if storyboard.get("production_status") != "approved":
            raise RuntimeError(
                "The current storyboard was rejected and is blocked from production. "
                "Approve creative-brief-v2.zh-CN.md and rewrite the storyboard first."
            )
        scene = next((item for item in storyboard["scenes"] if item["id"] == args.scene), None)
        if not scene or not scene.get("h3_prompt"):
            raise ValueError(f"Scene {args.scene!r} has no H3 prompt")
        prompt = scene["h3_prompt"]

    process = start_comfy(args.install, args.base_url)
    output = args.output_root / "h3-local" / f"{args.scene}.mp4"
    workflow = args.install / "api-client" / "resources" / "workflows_api" / "video_minimax_h3_t2v.api.json"
    report = generate(
        base_url=args.base_url,
        workflow_path=workflow,
        output_path=output,
        prompt=prompt,
        width=args.width,
        height=args.height,
        duration=args.duration,
        steps=args.steps,
        seed=args.seed,
        inactivity_timeout=args.inactivity_timeout,
    )
    report["frame_inspection"] = inspect_clip(output, args.output_root / "h3-local" / "frames" / args.scene)
    reports = args.output_root / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    report_path = reports / f"local-h3-{args.scene}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if not report["frame_inspection"]["passed"]:
        raise RuntimeError(f"Local H3 clip failed frame/media inspection; see {report_path}")
    print(json.dumps({"output": str(output), "report": str(report_path), "server_started": process is not None}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
