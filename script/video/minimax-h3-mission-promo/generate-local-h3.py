from __future__ import annotations

import argparse
import hashlib
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
DEFAULT_MANIFEST = Path(__file__).with_name("v9-live-type-runtime-manifest.json")
TERMINAL_HISTORY = {"success", "error"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def canonical_sha256(value: Any) -> str:
    return sha256_text(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def model_identities(install: Path, workflow: dict[str, Any]) -> list[dict[str, Any]]:
    inventory_path = install / "installer" / "assets" / "hf_model_inventory.json"
    inventory = {
        item["path"]: item
        for item in json.loads(inventory_path.read_text(encoding="utf-8"))
        if isinstance(item, dict) and isinstance(item.get("path"), str)
    }
    requested: list[tuple[str, str, str]] = []
    vae_index = 0
    for node in workflow.values():
        node_type = node.get("class_type")
        inputs = node.get("inputs", {})
        if node_type == "UNETLoader":
            requested.append(("diffusion", "diffusion_models", inputs["unet_name"]))
        elif node_type == "CLIPLoader":
            requested.append(("text_encoder", "text_encoders", inputs["clip_name"]))
        elif node_type == "VAELoader":
            role = "video_vae" if vae_index == 0 else "audio_vae"
            requested.append((role, "vae", inputs["vae_name"]))
            vae_index += 1
    role_order = {"diffusion": 0, "text_encoder": 1, "video_vae": 2, "audio_vae": 3}
    requested.sort(key=lambda item: role_order[item[0]])
    if [item[0] for item in requested] != ["diffusion", "text_encoder", "video_vae", "audio_vae"]:
        raise RuntimeError(f"Workflow model contract is incomplete: {[item[0] for item in requested]}")
    models_root = install / "runtime" / "ComfyUI" / "models"
    identities: list[dict[str, Any]] = []
    for role, directory, name in requested:
        relative = f"{directory}/{name}"
        source = models_root / directory / name
        if not source.is_file():
            raise FileNotFoundError(f"H3 model not found: {source}")
        expected = inventory.get(relative)
        if not expected:
            raise RuntimeError(f"H3 model is missing installer inventory identity: {relative}")
        size = source.stat().st_size
        if size != int(expected["size"]):
            raise RuntimeError(f"H3 model size differs from verified inventory: {relative}")
        physical_sha256 = sha256_file(source)
        if physical_sha256 != expected["sha256"]:
            raise RuntimeError(f"H3 model digest differs from verified inventory: {relative}")
        identities.append(
            {
                "role": role,
                "path": str(source.resolve()),
                "bytes": size,
                "inventory_sha256": expected["sha256"],
                "physical_sha256": physical_sha256,
            }
        )
    return identities


def find_node(workflow: dict[str, Any], class_type: str) -> tuple[str, dict[str, Any]]:
    matches = [(node_id, node) for node_id, node in workflow.items() if node.get("class_type") == class_type]
    if len(matches) != 1:
        raise RuntimeError(f"Expected exactly one {class_type} node, found {len(matches)}")
    return matches[0]


def load_shot(manifest_path: Path, shot_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != 1 or manifest.get("manifest_kind") != "h3-video-production":
        raise RuntimeError(f"Unsupported H3 production manifest: {manifest_path}")
    if manifest.get("production_status") != "prompt-locked":
        raise RuntimeError(f"H3 manifest is not prompt-locked: {manifest.get('production_status')!r}")
    shot_pool = [*manifest.get("bootstrap_shots", []), *manifest.get("shots", [])]
    shot = next((item for item in shot_pool if item.get("id") == shot_id), None)
    if shot is None:
        raise ValueError(f"Shot {shot_id!r} is absent from the H3 manifest")
    required = {
        "mode",
        "duration_seconds",
        "integrated_multimodal_description",
        "overall_soundscape",
        "non_diegetic_music",
        "references",
    }
    missing = sorted(required - shot.keys())
    if missing:
        raise RuntimeError(f"Shot {shot_id} is missing production fields: {missing}")
    return manifest, shot


def resolve_references(manifest_path: Path, manifest: dict[str, Any], shot: dict[str, Any]) -> list[dict[str, Any]]:
    references: list[dict[str, Any]] = []
    for index, item in enumerate(shot["references"]):
        if isinstance(item, str):
            item = manifest.get("reference_assets", {}).get(item)
        if not isinstance(item, dict) or not item.get("path") or not item.get("sha256"):
            raise RuntimeError(f"Shot {shot['id']} reference {index} is not hash-locked")
        source = (manifest_path.parent / item["path"]).resolve()
        if not source.is_file():
            raise FileNotFoundError(f"Shot {shot['id']} reference is missing: {source}")
        physical_sha256 = sha256_file(source)
        if physical_sha256 != item["sha256"]:
            raise RuntimeError(f"Shot {shot['id']} reference digest mismatch: {source}")
        references.append(
            {
                "role": item.get("role", f"reference_{index}"),
                "path": source,
                "sha256": physical_sha256,
            }
        )
    return references


def workflow_for_mode(install: Path, mode: str) -> Path:
    names = {
        "T2VA": "video_minimax_h3_t2v.api.json",
        "I2VA": "video_minimax_h3_i2v.api.json",
        "FL2VA": "video_minimax_h3_i2v.api.json",
        "Ref2VA": "video_minimax_h3_r2v.api.json",
    }
    if mode not in names:
        raise RuntimeError(f"Shot mode {mode!r} is not locally generatable")
    workflow = install / "api-client" / "resources" / "workflows_api" / names[mode]
    if not workflow.is_file():
        raise FileNotFoundError(f"H3 workflow for {mode} is missing: {workflow}")
    return workflow


def validate_reference_count(mode: str, references: list[dict[str, Any]]) -> None:
    expected = {"T2VA": (0, 0), "I2VA": (1, 1), "FL2VA": (2, 2), "Ref2VA": (2, 2)}
    minimum, maximum = expected[mode]
    if not minimum <= len(references) <= maximum:
        raise RuntimeError(f"{mode} requires {minimum}..{maximum} hash-locked references, got {len(references)}")


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


def upload_input_image(base_url: str, source: Path) -> str:
    if not source.is_file():
        raise FileNotFoundError(f"Reference image not found: {source}")
    boundary = f"----opencorvus-{uuid.uuid4().hex}"
    chunks = [
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="image"; filename="{source.name}"\r\n'.encode(),
        b"Content-Type: image/png\r\n\r\n",
        source.read_bytes(),
        f"\r\n--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="subfolder"\r\n\r\nopencorvus\r\n',
        f"--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="type"\r\n\r\ninput\r\n',
        f"--{boundary}--\r\n".encode(),
    ]
    request = urllib.request.Request(f"{base_url}/upload/image", data=b"".join(chunks), method="POST")
    request.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.loads(response.read().decode("utf-8"))
    name = payload.get("name")
    subfolder = payload.get("subfolder", "")
    if not name:
        raise RuntimeError(f"ComfyUI did not return an uploaded image name: {payload}")
    uploaded = f"{subfolder}/{name}" if subfolder else name
    return uploaded.replace("\\", "/")


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
    labels = ("start", "quarter", "middle", "three_quarter", "end")
    times = [
        max(0.05, min(duration - 0.05, value))
        for value in (0.2, duration * 0.25, duration * 0.5, duration * 0.75, duration - 0.2)
    ]
    inspections: list[dict[str, Any]] = []
    previous: Image.Image | None = None
    for label, timestamp in zip(labels, times, strict=True):
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
    motion_checkpoint_count = sum(
        item["difference"] is not None and item["difference"] >= 0.75 for item in inspections
    )
    result["motion_checkpoint_count"] = motion_checkpoint_count
    result["passed"] = (
        result["video_codec"] == "h264"
        and result["audio_codec"] == "aac"
        and result["audio_channels"] == 2
        and result["audio_sample_rate"] == 32000
        and all(item["luminance"] >= 8 for item in inspections)
        and motion_checkpoint_count >= 2
    )
    return result


def prepare_workflow(
    workflow_path: Path,
    *,
    mode: str,
    prompt: str,
    width: int,
    height: int,
    duration: float,
    steps: int,
    seed: int,
    output_stem: str,
    reference_image_names: list[str],
) -> tuple[dict[str, Any], int]:
    workflow = json.loads(workflow_path.read_text(encoding="utf-8"))
    length = max(5, round(duration * 24))
    length += (5 - (length % 17)) % 17
    if mode == "Ref2VA":
        _, generation_node = find_node(workflow, "MiniMaxH3ReferenceToVideo")
        generation_node["inputs"].update(prompt=prompt, width=width, height=height, length=length)
        load_nodes = [(node_id, node) for node_id, node in workflow.items() if node.get("class_type") == "LoadImage"]
        load_nodes.sort(key=lambda item: int(item[0]))
        for (_, node), image_name in zip(load_nodes, reference_image_names, strict=True):
            node["inputs"]["image"] = image_name
    else:
        _, generation_node = find_node(workflow, "MiniMaxH3ImageToVideo")
        generation_node["inputs"].update(prompt=prompt, width=width, height=height, length=length)
        if mode in {"I2VA", "FL2VA"}:
            first_id, first_node = find_node(workflow, "LoadImage")
            first_node["inputs"]["image"] = reference_image_names[0]
            generation_node["inputs"]["first_frame"] = [first_id, 0]
        if mode == "FL2VA":
            last_id = str(max(int(node_id) for node_id in workflow) + 1)
            workflow[last_id] = {
                "class_type": "LoadImage",
                "inputs": {"image": reference_image_names[1]},
                "_meta": {"title": "Hash-locked last frame"},
            }
            generation_node["inputs"]["last_frame"] = [last_id, 0]
    _, scheduler = find_node(workflow, "BasicScheduler")
    scheduler["inputs"]["steps"] = steps
    _, noise = find_node(workflow, "RandomNoise")
    noise["inputs"]["noise_seed"] = seed
    _, save = find_node(workflow, "SaveVideo")
    save["inputs"]["filename_prefix"] = f"video/opencorvus_h3_{output_stem}"

    _, unet = find_node(workflow, "UNETLoader")
    _, clip = find_node(workflow, "CLIPLoader")
    unet["inputs"]["unet_name"] = {
        "T2VA": "minimax_h3_fl2va_pruned_int8_convrot.safetensors",
        "I2VA": "minimax_h3_fl2va_pruned_int8_convrot.safetensors",
        "FL2VA": "minimax_h3_fl2va_pruned_int8_convrot.safetensors",
        "Ref2VA": "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
    }[mode]
    clip["inputs"]["clip_name"] = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
    return workflow, length


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
    mode: str,
    reference_image_names: list[str],
) -> dict[str, Any]:
    workflow, length = prepare_workflow(
        workflow_path,
        mode=mode,
        prompt=prompt,
        width=width,
        height=height,
        duration=duration,
        steps=steps,
        seed=seed,
        output_stem=output_path.stem,
        reference_image_names=reference_image_names,
    )

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
    _, report_unet = find_node(workflow, "UNETLoader")
    _, report_clip = find_node(workflow, "CLIPLoader")
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
        "diffusion": report_unet["inputs"]["unet_name"],
        "text_encoder": report_clip["inputs"]["clip_name"],
        "mode": mode,
        "uploaded_reference_images": reference_image_names,
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
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--shot", required=True, help="Manifest shot id, for example S03.")
    parser.add_argument("--take", required=True, help="Immutable take label, for example take-001.")
    parser.add_argument("--width", type=int, default=608)
    parser.add_argument("--height", type=int, default=352)
    parser.add_argument("--steps", type=int, default=10)
    parser.add_argument("--seed", type=int, default=20260824)
    parser.add_argument("--inactivity-timeout", type=int, default=3600)
    args = parser.parse_args()

    manifest_path = args.manifest.resolve()
    manifest, shot = load_shot(manifest_path, args.shot)
    if not args.take.replace("-", "").replace("_", "").isalnum():
        raise ValueError("--take may contain only letters, numbers, '-' and '_'")
    mode = shot["mode"]
    if mode == "POST":
        raise RuntimeError(f"Shot {args.shot} is deterministic post-production and must not be sent to H3")
    references = resolve_references(manifest_path, manifest, shot)
    validate_reference_count(mode, references)
    workflow = workflow_for_mode(args.install, mode)
    workflow_payload = json.loads(workflow.read_text(encoding="utf-8"))
    identities = model_identities(args.install, workflow_payload)
    visual_contract = manifest["global_visual_contract"]
    if shot.get("runtime_elements", True):
        visual_contract = f"{visual_contract}\n\n{manifest['runtime_visual_contract']}"
    prompt = (
        f"{visual_contract}\n\n"
        f"{shot['integrated_multimodal_description']}\n\n"
        f"Overall soundscape: {shot['overall_soundscape']}\n\n"
        f"Non-diegetic music: {shot['non_diegetic_music']}\n\n"
        "No generated text, letters, numbers, subtitles, logos, watermarks, UI cards, presentation slides, "
        "talking heads, live-action humans, bird or corvid imagery."
    )
    build_inputs = {
        "manifest_sha256": sha256_file(manifest_path),
        "generator_script_sha256": sha256_file(Path(__file__).resolve()),
        "workflow_sha256": sha256_file(workflow),
        "prompt_sha256": sha256_text(prompt),
        "references": [{"role": item["role"], "sha256": item["sha256"]} for item in references],
        "model_identities": identities,
        "shot": args.shot,
        "mode": mode,
        "width": args.width,
        "height": args.height,
        "duration": shot["duration_seconds"],
        "steps": args.steps,
        "seed": args.seed,
    }
    build_digest = canonical_sha256(build_inputs)
    take_root = args.output_root / "h3-local" / args.shot / f"{args.take}-{build_digest[:12]}"
    output = take_root / f"{args.shot}.mp4"
    report_path = args.output_root / "reports" / args.shot / f"{args.take}-{build_digest[:12]}.json"
    if output.exists() or report_path.exists():
        raise FileExistsError(f"Immutable take already exists: {take_root}")

    process = start_comfy(args.install, args.base_url)
    uploaded_names = [upload_input_image(args.base_url, item["path"]) for item in references]
    report = generate(
        base_url=args.base_url,
        workflow_path=workflow,
        output_path=output,
        prompt=prompt,
        width=args.width,
        height=args.height,
        duration=float(shot["duration_seconds"]),
        steps=args.steps,
        seed=args.seed,
        inactivity_timeout=args.inactivity_timeout,
        mode=mode,
        reference_image_names=uploaded_names,
    )
    report.update(build_inputs)
    report["build_digest"] = build_digest
    report["manifest_path"] = str(manifest_path)
    report["creative_source_url"] = manifest["creative_source_url"]
    report["workflow_path"] = str(workflow.resolve())
    report["reference_sources"] = [
        {"role": item["role"], "path": str(item["path"]), "sha256": item["sha256"]} for item in references
    ]
    report["frame_inspection"] = inspect_clip(output, take_root / "frames")
    report["output_sha256"] = sha256_file(output)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if not report["frame_inspection"]["passed"]:
        raise RuntimeError(f"Local H3 clip failed frame/media inspection; see {report_path}")
    print(json.dumps({"output": str(output), "report": str(report_path), "server_started": process is not None}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
