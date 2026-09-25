"""One preregistered development episode; existing host/Inspect/cleanup primitives."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages/inspect-benchmark/script"))
import run_factorial_trials as driver  # noqa: E402


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


async def main(run_directory: Path) -> None:
    run = await asyncio.to_thread(run_directory.resolve, strict=True)
    frozen = json.loads((run / "freeze.json").read_text(encoding="utf-8"))
    episode_directory = await asyncio.to_thread(Path(frozen["episode_directory"]).resolve)
    if not episode_directory.is_relative_to(run):
        raise ValueError("Episode directory must be inside its registered run directory")
    if frozen["sample_count"] != 1 or frozen["model"] != "openai/gpt-5.6-luna":
        raise ValueError("This controller requires the registered single Luna occurrence")
    for name in ("fixture", "controller", "input_probes"):
        if digest(Path(frozen[name]["path"])) != frozen[name]["sha256"]:
            raise ValueError(f"Frozen {name} identity changed")
    driver.require_frozen_source(frozen["source_revision"])
    os.environ["AUTOMATIONBENCH_FACTORIAL_INPUT_PROBES"] = frozen["input_probes"]["path"]
    os.environ["AUTOMATIONBENCH_STRICT_ASSERTIONS"] = "1"
    episode = driver.Episode(
        "MR",
        driver.Block(1, frozen["fixture_id"], 0, ("MR",)),
        Path(frozen["episode_directory"]),
        Path(frozen["package"]["source"]),
    )
    state = {
        "pid": os.getpid(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "starting",
        "source_revision": frozen["source_revision"],
        "kind": "operator-derived-business-repair",
        "fixture_id": frozen["fixture_id"],
        "model": frozen["model"],
        "result": None,
        "failure": None,
        "cleanup": None,
        "host": None,
    }
    with (run / "controller.json").open("x", encoding="utf-8") as output:
        json.dump(state, output, ensure_ascii=False, indent=2)

    def save() -> None:
        state["updated_at"] = datetime.now(timezone.utc).isoformat()
        driver.write_receipt(run / "controller.json", state)

    def snapshot() -> None:
        audit = driver.read_receipt(episode.directory / "provider-audit.json") or {}
        requests = audit.get("requests", [])
        now = datetime.now(timezone.utc)
        driver.write_receipt(
            run / "snapshots" / f"{now.strftime('%Y%m%dT%H%M%S%fZ')}.json",
            {
                "at": now.isoformat(),
                "host": driver.read_receipt(episode.directory / "host.json"),
                "preflight": driver.read_receipt(episode.directory / "preflight.json"),
                "result": driver.read_receipt(episode.directory / "result.json"),
                "provider": {
                    "requests": len(requests),
                    "models": sorted({r["model"] for r in requests}),
                    "http200": sum(r.get("status") == 200 for r in requests),
                    "pending": sum(r.get("status") is None for r in requests),
                },
            },
        )

    async def observe() -> dict:
        command = [
            sys.executable,
            "-m",
            "inspect_ai",
            "eval",
            "opencorvus_inspect/opencorvus_business_repair",
            "--model",
            "none",
            "--ctl-server",
            "false",
            "--max-samples",
            "1",
            "--epochs",
            "1",
            "--sample-id",
            frozen["fixture_id"],
            "--no-fail-on-error",
            "--display",
            "plain",
            "-T",
            f"fixture={frozen['fixture']['path']}",
            "-T",
            f"squad={episode.source}",
            "-T",
            f"project_dir={episode.directory / 'projects'}",
            "-T",
            f"model={frozen['model']}",
            "-T",
            f"base_url={episode.url}",
            "-T",
            "timeout_seconds=300",
            "-T",
            "poll_seconds=2",
            "--log-dir",
            str(episode.directory / "eval"),
        ]
        with (
            (episode.directory / "inspect.stdout.log").open("wb") as stdout,
            (episode.directory / "inspect.stderr.log").open("wb") as stderr,
        ):
            process = await asyncio.to_thread(
                subprocess.Popen,
                command,
                cwd=ROOT / "packages/inspect-benchmark",
                stdin=subprocess.DEVNULL,
                stdout=stdout,
                stderr=stderr,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        driver.write_receipt(
            episode.directory / "inspect-process.json",
            {
                "pid": process.pid,
                "args": command,
            },
        )
        waiting = asyncio.create_task(asyncio.to_thread(process.wait))
        snapshot()
        while True:
            done, _ = await asyncio.wait({waiting}, timeout=300)
            snapshot()
            if done:
                code = await waiting
                break
        paths = list((episode.directory / "eval").glob("*.eval"))
        if len(paths) != 1:
            return {
                "status": "log_unavailable",
                "log_count": len(paths),
                "inspect_exit_code": code,
                "assessment": None,
            }
        log = driver.read_eval_log(str(paths[0]))
        samples = log.samples or []
        if len(samples) != 1:
            return {
                "status": "sample_unavailable",
                "log": str(paths[0]),
                "inspect_exit_code": code,
                "assessment": None,
            }
        sample = samples[0]
        if sample.id != frozen["fixture_id"]:
            raise ValueError("Development sample differs from the frozen input")
        native = sample.metadata.get("opencorvus_result") or {}
        binding = native.get("package_revision_binding") or {}
        if native and (
            binding.get("version") != frozen["package"]["version"]
            or binding.get("package_digest") != frozen["package"]["digest"]
        ):
            raise ValueError("Actual package binding differs from the frozen revision")
        status = sample.metadata.get("development_execution", {}).get("status", "unknown")
        return {
            "status": status,
            "log": str(paths[0]),
            "inspect_exit_code": code,
            "inspect_log_status": log.status,
            "native_result": native,
            "observation": sample.metadata.get("opencorvus_observation"),
            "assessment": "pending_external_review" if status == "closed" else None,
            "strict": None,
            "partial": None,
            "source_version": frozen["package"]["version"],
            "source_digest": frozen["package"]["digest"],
        }

    try:
        await driver.launch_host(
            episode,
            Path(os.environ["LOCALAPPDATA"]) / "opencorvus/data/auth.json",
            frozen["source_revision"],
            frozen["model"],
        )
        driver.require_frozen_source(frozen["source_revision"])
        state.update(status="observing", url=episode.url, host_pid=episode.process.pid)
        save()
        state["result"] = await observe()
        driver.write_receipt(episode.directory / "result.json", state["result"])
    except BaseException as error:
        state["failure"] = {"type": type(error).__name__, "message": str(error)}
    finally:
        if episode.url:
            try:
                state["cleanup"] = await driver.settle_owned_activity(episode)
            except Exception as error:
                state["cleanup"] = {"error_type": type(error).__name__, "message": str(error)}
        if episode.process:
            try:
                state["host"] = await driver.stop_host(episode)
            except Exception as error:
                state["host"] = {"error_type": type(error).__name__, "message": str(error)}
        state["cleanup_verified"] = bool(
            state["cleanup"]
            and state["cleanup"].get("active_after_cleanup") == []
            and state["host"]
            and state["host"].get("status") == "stopped"
            and state["host"].get("credentialCopiesRemoved") is True
            and episode.process
            and episode.process.poll() is not None
            and all(
                not (episode.directory / "runtime-root/data" / name).exists()
                for name in ("auth.json", "models.json")
            )
        )
        result = state["result"] or {}
        settled = (
            result.get("status") == "closed"
            and result.get("inspect_log_status") == "success"
            and result.get("inspect_exit_code") == 0
            and result.get("native_result", {}).get("mission_outcome_kind")
            in {"accepted", "blocked"}
        )
        state["status"] = (
            "finished"
            if state["failure"] is None and state["cleanup_verified"] and settled
            else "stopped_on_runtime_boundary"
        )
        snapshot()
        save()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    asyncio.run(main(parser.parse_args().run_dir))
