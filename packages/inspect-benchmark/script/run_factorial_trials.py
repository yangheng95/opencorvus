"""Run the frozen ten-case TS/TE/MS/ME matrix with four isolated arms per block."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import json5
from inspect_ai.log import read_eval_log

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "packages/opencorvus"
MANIFEST = ROOT / "specs/artifacts/2026-09-24-automationbench-self-evolution/probe-manifest.json"
PLAN = ROOT / "specs/records/2026-09/2026-09-24-luna-mission-task-factorial-trials.md"
MODEL = "openai/gpt-5.6-luna"
ARMS = ("TS", "TE", "MS", "ME")
STARTUP_SECONDS = 120
SOURCE_FREEZE_PATHS = (
    "expert-squads/builtin/automationbench",
    "packages/opencorvus/src",
    "packages/opencorvus/script/automationbench-factorial-host.ts",
    "packages/opencorvus/script/real-provider-audit.ts",
    "packages/inspect-benchmark/src",
    "packages/inspect-benchmark/script/run_factorial_trials.py",
    "specs/artifacts/2026-09-24-automationbench-self-evolution/probe-manifest.json",
)


class SourceRevisionDriftError(RuntimeError):
    pass


def current_source_revision(root: Path = ROOT) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=root, text=True
    ).strip()


def require_frozen_source(
    revision: str,
    root: Path = ROOT,
    source_paths: tuple[str, ...] = SOURCE_FREEZE_PATHS,
) -> None:
    current = current_source_revision(root)
    if current != revision:
        raise SourceRevisionDriftError(
            f"frozen source revision changed: expected {revision}, observed {current}"
        )
    changed = subprocess.check_output(
        ["git", "status", "--porcelain", "--", *source_paths], cwd=root, text=True
    ).strip()
    if changed:
        raise SourceRevisionDriftError(
            f"frozen source paths have uncommitted changes:\n{changed}"
        )


@dataclass(frozen=True)
class Block:
    index: int
    task: str
    example_id: int
    order: tuple[str, str, str, str]


def blocks_from_plan() -> list[Block]:
    """The reviewed Markdown schedule owns order; the official manifest owns case data."""
    text = PLAN.read_text(encoding="utf-8")
    pattern = re.compile(
        r"^\| (\d+) \| `([^`]+)` \| (\d+) \| "
        r"(TS|TE|MS|ME) → (TS|TE|MS|ME) → (TS|TE|MS|ME) → (TS|TE|MS|ME) \|$",
        re.MULTILINE,
    )
    blocks = [
        Block(int(number), task, int(example), (one, two, three, four))
        for number, task, example, one, two, three, four in pattern.findall(text)
    ]
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    expected = {(case["task"], case["example_id"]) for case in manifest["cases"]}
    assert len(blocks) == len(expected) == 10
    assert [block.index for block in blocks] == list(range(1, 11))
    assert {(block.task, block.example_id) for block in blocks} == expected
    assert all(set(block.order) == set(ARMS) for block in blocks)
    return blocks


def write_receipt(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".pending")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    temporary.replace(path)


def read_receipt(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
        return value if isinstance(value, dict) else None
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def paired_early_stop(blocks: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Apply the preregistered four-arm harm rule to completed paired blocks only."""
    latest_number = max(map(int, blocks))
    latest = blocks[str(latest_number)]["results"]
    missing = [
        arm for arm in ARMS
        if latest[arm].get("strict") is None or latest[arm].get("partial") is None
    ]
    if missing:
        return {"kind": "unscored", "block": latest_number, "arms": missing}

    for static, evolved in (("TS", "TE"), ("MS", "ME")):
        if (
            latest[static]["strict"] == 1.0
            and latest[static]["partial"] == 1.0
            and latest[evolved]["strict"] == 0.0
            and latest[evolved]["partial"] == 0.0
        ):
            return {
                "kind": "single_arm_complete_loss",
                "block": latest_number,
                "static_arm": static,
                "evolved_arm": evolved,
            }

    if all(
        latest[evolved]["strict"] < latest[static]["strict"]
        and latest[evolved]["partial"] < latest[static]["partial"]
        for static, evolved in (("TS", "TE"), ("MS", "ME"))
    ):
        return {"kind": "paired_regression", "block": latest_number}

    if len(blocks) == 3:
        first_three = [blocks[str(index)]["results"] for index in (1, 2, 3)]
        effects = {
            evolved: sum(
                row[evolved]["partial"] - row[static]["partial"] for row in first_three
            ) / 3
            for static, evolved in (("TS", "TE"), ("MS", "ME"))
        }
        strict_gains = {
            evolved: sum(row[evolved]["strict"] - row[static]["strict"] for row in first_three)
            for static, evolved in (("TS", "TE"), ("MS", "ME"))
        }
        if all(effects[arm] <= -0.10 and strict_gains[arm] <= 0 for arm in ("TE", "ME")):
            return {
                "kind": "three_block_regression",
                "block": latest_number,
                "partial_effects": effects,
                "strict_gains": strict_gains,
            }
    return {"kind": "continue", "block": latest_number}


@dataclass
class Episode:
    arm: str
    block: Block
    directory: Path
    source: Path
    process: subprocess.Popen[bytes] | None = None
    url: str | None = None

    @property
    def entrypoint(self) -> str:
        return "mission" if self.arm.startswith("M") else "task"


async def launch_host(
    episode: Episode, auth_source: Path, source_revision: str
) -> None:
    episode.directory.mkdir(parents=True, exist_ok=False)
    stdout = (episode.directory / "host.stdout.log").open("wb")
    stderr = (episode.directory / "host.stderr.log").open("wb")
    environment = os.environ.copy()
    environment.update(
        AUTOMATIONBENCH_FACTORIAL_RUN_DIR=str(episode.directory),
        AUTOMATIONBENCH_FACTORIAL_AUTH_SOURCE=str(auth_source),
        AUTOMATIONBENCH_FACTORIAL_MODEL=MODEL,
    )
    try:
        episode.process = await asyncio.to_thread(
            subprocess.Popen,
            [shutil.which("bun") or "bun", "script/automationbench-factorial-host.ts"],
            cwd=PACKAGE,
            env=environment,
            stdin=subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    finally:
        stdout.close()
        stderr.close()
    write_receipt(
        episode.directory / "host-process.json",
        {"pid": episode.process.pid, "arm": episode.arm, "case": episode.block.task},
    )
    deadline = time.monotonic() + STARTUP_SECONDS
    while time.monotonic() < deadline:
        state = read_receipt(episode.directory / "host.json")
        if state and state.get("status") == "running":
            if state.get("sourceSHA") != source_revision:
                raise SourceRevisionDriftError(
                    f"{episode.arm} host source differs from frozen revision: "
                    f"{state.get('sourceSHA')} != {source_revision}"
                )
            episode.url = state["url"]
            assert isinstance(episode.url, str) and episode.url.startswith("http://127.0.0.1:")
            preflight = read_receipt(episode.directory / "preflight.json")
            assert preflight and preflight.get("actualModel") == "gpt-5.6-luna"
            return
        if state and state.get("status") == "failed":
            raise RuntimeError(f"host startup failed: {state.get('error', 'unknown')}")
        if episode.process.poll() is not None:
            raise RuntimeError(f"host exited during startup: {episode.process.returncode}")
        await asyncio.sleep(1)
    raise TimeoutError(f"host startup took more than {STARTUP_SECONDS}s")


def score_summary(
    directory: Path, block: Block, arm: str, expected_version: str, expected_digest: str | None
) -> dict[str, Any]:
    paths = list((directory / "eval").glob("*.eval"))
    if len(paths) != 1:
        return {
            "status": "log_unavailable",
            "log_count": len(paths),
            "strict": None,
            "partial": None,
        }
    log = read_eval_log(str(paths[0]))
    samples = log.samples or []
    if len(samples) != 1:
        return {
            "status": "sample_unavailable",
            "log": str(paths[0]),
            "sample_count": len(samples),
            "strict": None,
            "partial": None,
        }
    sample = samples[0]
    if (
        sample.id != block.task
        or sample.metadata.get("automationbench_example_id") != block.example_id
    ):
        raise RuntimeError("Inspect sample identity differs from frozen case manifest")
    raw = sample.metadata.get("opencorvus_result")
    result: dict[str, Any] = raw if isinstance(raw, dict) else {}
    binding = result.get("package_revision_binding")
    if isinstance(binding, dict) and (
        binding.get("version") != expected_version
        or (expected_digest and binding.get("package_digest") != expected_digest)
    ):
        raise RuntimeError("Bound Task package revision differs from frozen arm package")
    scores = sample.scores or {}

    def numeric(name: str) -> float | None:
        score = scores.get(name)
        return float(score.value) if score and isinstance(score.value, (float, int)) else None

    return {
        "status": sample.metadata.get("automationbench_execution", {}).get("status", "unknown"),
        "log": str(paths[0]),
        "strict": numeric("automationbench_strict"),
        "partial": numeric("automationbench_partial"),
        "native_result": result,
        "observation": sample.metadata.get("opencorvus_observation"),
        "inspect_log_status": log.status,
        "source_version": expected_version,
        "source_digest": expected_digest,
        "arm": arm,
    }


async def run_inspect(
    episode: Episode, expected_version: str, expected_digest: str | None
) -> dict[str, Any]:
    assert episode.url is not None
    command = [
        sys.executable,
        "-m",
        "inspect_ai",
        "eval",
        "opencorvus_inspect/opencorvus_automationbench",
        "--model",
        "none",
        "--ctl-server",
        "false",
        "--max-samples",
        "1",
        "--sample-id",
        episode.block.task,
        "--no-fail-on-error",
        "--display",
        "plain",
        "-T",
        f"manifest={MANIFEST}",
        "-T",
        f"squad={episode.source}",
        "-T",
        f"project_dir={episode.directory / 'projects'}",
        "-T",
        f"model={MODEL}",
        "-T",
        f"base_url={episode.url}",
        "-T",
        "timeout_seconds=300",
        "-T",
        "poll_seconds=2",
        "-T",
        f"entrypoint={episode.entrypoint}",
        "--log-dir",
        str(episode.directory / "eval"),
    ]
    stdout = (episode.directory / "inspect.stdout.log").open("wb")
    stderr = (episode.directory / "inspect.stderr.log").open("wb")
    try:
        process = await asyncio.to_thread(
            subprocess.Popen,
            command,
            cwd=ROOT / "packages/inspect-benchmark",
            stdin=subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    finally:
        stdout.close()
        stderr.close()
    write_receipt(episode.directory / "inspect-process.json", {"pid": process.pid, "args": command})
    code = await asyncio.to_thread(process.wait)
    try:
        result = score_summary(
            episode.directory, episode.block, episode.arm, expected_version, expected_digest
        )
    except Exception as error:
        result = {
            "status": "result_read_error",
            "type": type(error).__name__,
            "message": str(error),
            "strict": None,
            "partial": None,
        }
    result["inspect_exit_code"] = code
    write_receipt(episode.directory / "result.json", result)
    return result


def in_episode_directory(directory: str, episode: Episode) -> bool:
    return Path(directory).resolve().is_relative_to(episode.directory)


async def settle_owned_activity(episode: Episode) -> dict[str, Any]:
    assert episode.url is not None
    receipts: list[dict[str, Any]] = []
    async with httpx.AsyncClient(base_url=episode.url, trust_env=False, timeout=30) as client:
        if episode.entrypoint == "mission":
            response = await client.get("/mission")
            response.raise_for_status()
            missions = response.json()
            for mission in missions:
                directory = mission.get("directory")
                if not isinstance(directory, str) or not in_episode_directory(directory, episode):
                    continue
                outcome = mission.get("outcome")
                if isinstance(outcome, dict) and outcome.get("kind") in {"accepted", "blocked"}:
                    receipts.append({
                        "mission_id": mission["missionID"],
                        "state": outcome["kind"],
                    })
                    continue
                request_id = f"trial:{episode.block.index}:{episode.arm}:cleanup"
                stopped = await client.post(
                    f"/mission/{mission['missionID']}/abort",
                    params={"directory": directory},
                    json={
                        "surface": "api",
                        "reason": "Trial observation ended without Mission completion",
                    },
                    headers={"x-opencorvus-request-id": request_id},
                )
                receipts.append(
                    {
                        "mission_id": mission["missionID"],
                        "state": "abort_requested",
                        "http_status": stopped.status_code,
                        "request_id": request_id,
                    }
                )
        else:
            response = await client.get("/global/tasks")
            response.raise_for_status()
            board = response.json()
            for item in board.get("tasks", []):
                task = item.get("task", {})
                directory = task.get("directory")
                if task.get("source") != "inspect-ai" or not isinstance(directory, str):
                    continue
                if not in_episode_directory(directory, episode):
                    continue
                if task.get("status") != "active":
                    receipts.append({"task_id": task["id"], "state": task.get("status")})
                    continue
                request_id = f"trial:{episode.block.index}:{episode.arm}:cleanup"
                stopped = await client.post(
                    f"/task/{task['id']}/cancel",
                    params={"directory": directory},
                    json={
                        "surface": "api",
                        "reason": "Trial observation ended without Task completion",
                    },
                    headers={"x-opencorvus-request-id": request_id},
                )
                receipts.append(
                    {
                        "task_id": task["id"],
                        "state": "cancel_requested",
                        "http_status": stopped.status_code,
                        "request_id": request_id,
                    }
                )
        deadline = time.monotonic() + 60
        active: list[str] = []
        while time.monotonic() < deadline:
            board_response = await client.get("/global/tasks")
            board_response.raise_for_status()
            board = board_response.json()
            active = [
                task["id"]
                for item in board.get("tasks", [])
                if isinstance(task := item.get("task"), dict)
                and isinstance(directory := task.get("directory"), str)
                and in_episode_directory(directory, episode)
                and task.get("status") == "active"
            ]
            if not active:
                break
            await asyncio.sleep(2)
    return {"owned_actions": receipts, "active_after_cleanup": active}


async def stop_host(episode: Episode) -> dict[str, Any]:
    state = read_receipt(episode.directory / "host.json")
    if state and state.get("status") in {"failed", "stopped"}:
        return state
    (episode.directory / "stop-host").write_text("Trial episode finished", encoding="utf-8")
    assert episode.process is not None
    try:
        await asyncio.wait_for(asyncio.to_thread(episode.process.wait), timeout=60)
    except asyncio.TimeoutError:
        return {"status": "stop_pending", "pid": episode.process.pid}
    return read_receipt(episode.directory / "host.json") or {"status": "receipt_missing"}


async def execute_block(
    block: Block,
    root: Path,
    auth: Path,
    static: Path,
    evolved: Path,
    versions: dict[str, tuple[str, str | None]],
    source_revision: str,
) -> dict[str, Any]:
    episodes = {
        arm: Episode(
            arm,
            block,
            root / f"block-{block.index:02d}" / arm,
            evolved if arm.endswith("E") else static,
        )
        for arm in block.order
    }
    launches = []
    for arm in block.order:
        launches.append(asyncio.create_task(launch_host(episodes[arm], auth, source_revision)))
        await asyncio.sleep(0.25)
    attempts = await asyncio.gather(*launches, return_exceptions=True)
    startup_errors = {
        arm: str(outcome)
        for arm, outcome in zip(block.order, attempts, strict=True)
        if isinstance(outcome, BaseException)
    }
    if startup_errors:
        stopped = await asyncio.gather(
            *(stop_host(episodes[arm]) for arm in block.order if episodes[arm].process),
            return_exceptions=True,
        )
        return {
            "status": "host_startup_failed",
            "errors": startup_errors,
            "stopped": [str(item) for item in stopped],
        }
    try:
        require_frozen_source(source_revision)
    except SourceRevisionDriftError as error:
        stopped = await asyncio.gather(
            *(stop_host(episodes[arm]) for arm in block.order), return_exceptions=True
        )
        return {
            "status": "source_revision_drift",
            "error": str(error),
            "stopped": [str(item) for item in stopped],
        }
    try:
        results = await asyncio.gather(
            *(run_inspect(episodes[arm], *versions[arm]) for arm in block.order),
            return_exceptions=True,
        )
        out = {}
        for arm, result in zip(block.order, results, strict=True):
            out[arm] = (
                result
                if isinstance(result, dict)
                else {
                    "status": "inspect_driver_error",
                    "error": str(result),
                    "strict": None,
                    "partial": None,
                }
            )
        return {"status": "observed", "results": out}
    finally:
        for arm in block.order:
            episode = episodes[arm]
            try:
                cleanup = await settle_owned_activity(episode)
            except Exception as error:
                cleanup = {"error_type": type(error).__name__, "error": str(error)}
            write_receipt(episode.directory / "cleanup.json", cleanup)
        stopped = await asyncio.gather(
            *(stop_host(episodes[arm]) for arm in block.order), return_exceptions=True
        )
        for arm, outcome in zip(block.order, stopped, strict=True):
            write_receipt(
                episodes[arm].directory / "closure.json",
                outcome if isinstance(outcome, dict) else {"error": str(outcome)},
            )


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--auth-source", type=Path, required=True)
    parser.add_argument("--evolved-squad", type=Path, required=True)
    parser.add_argument("--static-version", required=True)
    parser.add_argument("--plan-only", action="store_true")
    args = parser.parse_args()
    blocks = blocks_from_plan()
    if args.plan_only:
        print(json.dumps([block.__dict__ for block in blocks], ensure_ascii=False, indent=2))
        return
    run_root = args.run_root.resolve()
    if not run_root.is_relative_to(ROOT / ".tmp") or run_root.exists():
        raise ValueError("run-root must be a new directory under this workspace's .tmp")
    static = ROOT / "expert-squads/builtin/automationbench"
    evolved = args.evolved_squad.resolve(strict=True)
    static_manifest = json5.loads((static / "expert-squad.jsonc").read_text(encoding="utf-8"))
    evolved_manifest = json5.loads((evolved / "expert-squad.jsonc").read_text(encoding="utf-8"))
    if (
        static_manifest["version"] != args.static_version
        or evolved_manifest["version"] == static_manifest["version"]
    ):
        raise ValueError(
            "Static and evolved package versions do not match the registered trial identity"
        )
    for package in (static_manifest, evolved_manifest):
        if (package["namespace"], package["id"]) != ("builtin", "automationbench"):
            raise ValueError("Both arms must use canonical builtin/automationbench")
    digest = evolved.name if re.fullmatch(r"[a-f0-9]{64}", evolved.name) else None
    versions = {
        "TS": (static_manifest["version"], None),
        "TE": (evolved_manifest["version"], digest),
        "MS": (static_manifest["version"], None),
        "ME": (evolved_manifest["version"], digest),
    }
    if args.auth_source.name != "auth.json" or not args.auth_source.is_file():
        raise ValueError("Paired local auth.json must be an existing regular file")
    if not (args.auth_source.parent / "models.json").is_file():
        raise ValueError("The matching models.json catalog is required")
    source_revision = current_source_revision()
    require_frozen_source(source_revision)
    run_root.mkdir(parents=True)
    write_receipt(
        run_root / "matrix.json",
        {
            "status": "running",
            "source_revision": source_revision,
            "model": MODEL,
            "manifest": str(MANIFEST),
            "static_version": static_manifest["version"],
            "evolved_version": evolved_manifest["version"],
            "evolved_digest": digest,
            "schedule": [block.__dict__ for block in blocks],
            "blocks": {},
        },
    )
    snapshot = read_receipt(run_root / "matrix.json")
    assert snapshot is not None
    for block in blocks:
        try:
            require_frozen_source(source_revision)
        except SourceRevisionDriftError as error:
            snapshot["status"] = "source_revision_drift"
            snapshot["source_revision_drift"] = {
                "before_block": block.index,
                "error": str(error),
            }
            break
        outcome = await execute_block(
            block, run_root, args.auth_source, static, evolved, versions, source_revision
        )
        snapshot["blocks"][str(block.index)] = outcome
        write_receipt(run_root / "matrix.json", snapshot)
        print(f"block {block.index}/10: {outcome['status']}", flush=True)
        if outcome["status"] != "observed":
            snapshot["status"] = (
                "source_revision_drift"
                if outcome["status"] == "source_revision_drift"
                else "failed"
            )
            break
        decision = paired_early_stop(snapshot["blocks"])
        if decision["kind"] != "continue":
            snapshot["status"] = (
                "stopped_for_unscored" if decision["kind"] == "unscored"
                else "stopped_for_regression"
            )
            snapshot["early_stop"] = decision
            break
    else:
        snapshot["status"] = (
            "completed"
            if all(
                result.get("strict") is not None and result.get("partial") is not None
                for block in snapshot["blocks"].values()
                for result in block["results"].values()
            )
            else "completed_with_unscored"
        )
    write_receipt(run_root / "matrix.json", snapshot)


if __name__ == "__main__":
    asyncio.run(main())
