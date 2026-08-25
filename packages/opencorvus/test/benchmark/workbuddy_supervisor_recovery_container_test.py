from __future__ import annotations

import io
import json
import os
from pathlib import Path
import signal
import subprocess
import tarfile
import tempfile
import uuid

import fcntl


DOCKER_HOST = "unix:///mnt/wsl/docker-desktop/shared-sockets/host-services/docker.proxy.sock"
UTILITY_IMAGE = "python:3.12-slim@sha256:3ecf5ebe01fef4b6e81be34511fb40bf378ea7fd81ab215ba15b2775ef85413d"
RUNTIME_IMAGE = "workbuddy-bench/harness/opencorvus:chain-proof-r1"
SUPERVISOR = Path(__file__).parents[2] / "script/benchmark/workbuddy/run-chain-proof.sh"


def docker(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["docker", *args],
        check=check,
        env={**os.environ, "DOCKER_HOST": DOCKER_HOST},
        text=True,
        capture_output=True,
    )


def add_volume_files(volume: str, files: dict[str, bytes]) -> None:
    payload = io.BytesIO()
    with tarfile.open(fileobj=payload, mode="w") as archive:
        for name, data in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            info.mode = 0o600 if name == "auth.json" else 0o644
            archive.addfile(info, io.BytesIO(data))
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-i",
            "--mount",
            f"type=volume,source={volume},target=/target",
            UTILITY_IMAGE,
            "tar",
            "-C",
            "/target",
            "-xf",
            "-",
        ],
        input=payload.getvalue(),
        check=True,
        env={**os.environ, "DOCKER_HOST": DOCKER_HOST},
        capture_output=True,
    )


def create_trial_container(volume: str, owner_id: str, secret: str, *, leaking: bool) -> tuple[str, str]:
    mountpoint = docker("volume", "inspect", "--format", "{{.Mountpoint}}", volume).stdout.strip()
    name = f"workbuddy-recovery-{uuid.uuid4()}"
    container_id = docker(
        "create",
        "--name",
        name,
        "--mount",
        f"type=bind,source={mountpoint}/auth.json,target=/run/secrets/opencorvus-provider/auth.json,readonly",
        "--mount",
        f"type=bind,source={mountpoint}/attempt-owner.json,target=/run/evidence/attempt-owner.json,readonly",
        "--mount",
        f"type=image,source={RUNTIME_IMAGE},target=/opt/opencorvus",
        UTILITY_IMAGE,
        "sleep",
        "infinity",
    ).stdout.strip()
    docker("start", container_id)
    setup = """
mkdir -p /logs/agent /tmp/opencorvus-workbuddy-home/data
cp /run/secrets/opencorvus-provider/auth.json /tmp/opencorvus-workbuddy-home/data/auth.json
chmod 600 /tmp/opencorvus-workbuddy-home/data/auth.json
printf '%s\n' "$RECOVERY_TEST_LOG" > /logs/agent/server.log
"""
    subprocess.run(
        ["docker", "exec", "--user", "root", "--env", f"RECOVERY_TEST_LOG={secret if leaking else 'safe recovery evidence'}", container_id, "sh", "-ceu", setup],
        check=True,
        env={**os.environ, "DOCKER_HOST": DOCKER_HOST},
        capture_output=True,
    )
    return container_id, mountpoint


def run_recovery(root: Path, run_id: str, volume: str, mountpoint: str) -> subprocess.CompletedProcess[str]:
    control = root / "control"
    evidence = root / "evidence"
    attempt = evidence / "attempts" / run_id
    return subprocess.run(
        ["bash", str(SUPERVISOR), "--recover-containers-only"],
        env={
            **os.environ,
            "DOCKER_HOST": DOCKER_HOST,
            "OPENCORVUS_RECOVERY_CONTROL_ROOT": str(control),
            "OPENCORVUS_RECOVERY_EVIDENCE_ROOT": str(evidence),
            "OPENCORVUS_RECOVERY_RUN_ID": run_id,
            "OPENCORVUS_RECOVERY_ATTEMPT_ROOT": str(attempt),
            "OPENCORVUS_RECOVERY_PROVIDER_VOLUME": volume,
            "OPENCORVUS_RECOVERY_PROVIDER_MOUNTPOINT": mountpoint,
        },
        text=True,
        capture_output=True,
    )


def container_exists(container_id: str) -> bool:
    return docker("inspect", container_id, check=False).returncode == 0


def remove_resources(container_id: str, volume: str) -> None:
    docker("rm", "-f", container_id, check=False)
    docker("volume", "rm", "-f", volume, check=False)


def prepare_scenario(owner_id: str, *, leaking: bool = False) -> tuple[str, str, str, str]:
    volume = f"workbuddy-recovery-{uuid.uuid4()}"
    secret = f"fake-recovery-secret-{uuid.uuid4()}"
    docker("volume", "create", volume)
    add_volume_files(
        volume,
        {
            "auth.json": json.dumps({"openai": {"access": secret}}).encode(),
            "attempt-owner.json": json.dumps({"schema_version": 1, "run_id": owner_id}).encode(),
        },
    )
    container_id, mountpoint = create_trial_container(volume, owner_id, secret, leaking=leaking)
    return container_id, volume, mountpoint, secret


def test_supervisor_recovers_only_owned_containers_and_preserves_failed_evidence() -> None:
    docker("version")
    docker("image", "inspect", UTILITY_IMAGE)
    docker("image", "inspect", RUNTIME_IMAGE)
    with tempfile.TemporaryDirectory(prefix="workbuddy-recovery-") as temp:
        root = Path(temp)

        running_id = running_volume = ""
        run_id = str(uuid.uuid4())
        try:
            running_id, running_volume, mountpoint, _ = prepare_scenario(run_id)
            result = run_recovery(root / "running", run_id, running_volume, mountpoint)
            assert result.returncode == 0, result.stderr
            assert not container_exists(running_id)
            recovered = root / "running/evidence/attempts" / run_id / "orphan-recovery" / running_id / "agent"
            assert json.loads((recovered / "credential-leak-audit.json").read_text())["passed"] is True
            assert (recovered / "attempt-disposition.json").is_file()
        finally:
            if running_id and running_volume:
                remove_resources(running_id, running_volume)

        stopped_id = stopped_volume = ""
        run_id = str(uuid.uuid4())
        try:
            stopped_id, stopped_volume, mountpoint, _ = prepare_scenario(run_id)
            finalize = docker(
                "exec",
                "--user",
                "root",
                "--env",
                "OPENCORVUS_HOME=/tmp/opencorvus-workbuddy-home",
                stopped_id,
                "/opt/opencorvus/bin/run-opencorvus-workbuddy.py",
                "--finalize-host-cancelled",
            )
            assert finalize.returncode == 0
            docker("stop", "--timeout", "10", stopped_id)
            result = run_recovery(root / "stopped", run_id, stopped_volume, mountpoint)
            assert result.returncode == 0, result.stderr
            assert not container_exists(stopped_id)
            recovered = root / "stopped/evidence/attempts" / run_id / "orphan-recovery" / stopped_id / "agent"
            assert json.loads((recovered / "credential-leak-audit.json").read_text())["passed"] is True
        finally:
            if stopped_id and stopped_volume:
                remove_resources(stopped_id, stopped_volume)

        unowned_id = unowned_volume = ""
        owner_id = str(uuid.uuid4())
        recovery_id = str(uuid.uuid4())
        try:
            unowned_id, unowned_volume, mountpoint, _ = prepare_scenario(owner_id)
            result = run_recovery(root / "unowned", recovery_id, unowned_volume, mountpoint)
            assert result.returncode == 0, result.stderr
            assert container_exists(unowned_id)
            assert docker("inspect", "--format", "{{.State.Running}}", unowned_id).stdout.strip() == "true"
        finally:
            if unowned_id and unowned_volume:
                remove_resources(unowned_id, unowned_volume)

        failed_id = failed_volume = ""
        run_id = str(uuid.uuid4())
        try:
            failed_id, failed_volume, mountpoint, _ = prepare_scenario(run_id, leaking=True)
            result = run_recovery(root / "failed", run_id, failed_volume, mountpoint)
            assert result.returncode == 8
            assert container_exists(failed_id)
            assert docker("inspect", "--format", "{{.State.Running}}", failed_id).stdout.strip() == "false"
            assert docker("volume", "inspect", failed_volume).returncode == 0
            pending = root / "failed/control/orphan-recovery-pending.json"
            assert json.loads(pending.read_text())["run_id"] == run_id
        finally:
            if failed_id and failed_volume:
                remove_resources(failed_id, failed_volume)


def test_recovery_mode_uses_the_supervisor_lock() -> None:
    with tempfile.TemporaryDirectory(prefix="workbuddy-recovery-lock-") as temp:
        root = Path(temp)
        control = root / "control"
        control.mkdir()
        with (control / "chain-proof.lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = run_recovery(root, str(uuid.uuid4()), "unused-volume", "/unused-mount")
        assert result.returncode == 4
        assert "supervisor lock is already held" in result.stderr


def test_runner_group_cleanup_stops_child_after_leader_exit() -> None:
    with tempfile.TemporaryDirectory(prefix="workbuddy-runner-group-") as temp:
        child_file = Path(temp) / "child.pid"
        result = subprocess.run(
            ["bash", str(SUPERVISOR), "--exercise-runner-group-cleanup"],
            env={**os.environ, "OPENCORVUS_RUNNER_GROUP_CHILD_FILE": str(child_file)},
            text=True,
            capture_output=True,
            timeout=45,
        )
        assert result.returncode == 0, result.stderr


def test_runner_group_survivor_blocks_container_and_volume_cleanup() -> None:
    with tempfile.TemporaryDirectory(prefix="workbuddy-runner-failure-") as temp:
        root = Path(temp)
        result = subprocess.run(
            ["bash", str(SUPERVISOR), "--exercise-runner-group-failure"],
            env={
                **os.environ,
                "OPENCORVUS_RUNNER_FAILURE_CONTROL_ROOT": str(root / "control"),
                "OPENCORVUS_RUNNER_FAILURE_ATTEMPT_ROOT": str(root / "attempt"),
            },
            text=True,
            capture_output=True,
        )
        assert result.returncode == 0, result.stderr


def test_recovery_refuses_to_clear_a_live_runner_group_pending_receipt() -> None:
    with tempfile.TemporaryDirectory(prefix="workbuddy-live-runner-pending-") as temp:
        root = Path(temp)
        run_id = str(uuid.uuid4())
        control = root / "control"
        control.mkdir()
        process = subprocess.Popen(["setsid", "sleep", "60"])
        try:
            (control / "orphan-recovery-pending.json").write_text(
                json.dumps(
                    {
                        "schema_version": 1,
                        "run_id": run_id,
                        "provider_volume": "preserved-volume",
                        "reason": f"runner_group_live_survivor:{process.pid}",
                        "runner_pgid": process.pid,
                    }
                )
            )
            result = run_recovery(root, run_id, "preserved-volume", "/preserved-mount")
            assert result.returncode == 8
            assert process.poll() is None
            assert (control / "orphan-recovery-pending.json").is_file()
        finally:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()


def test_runner_observation_errors_preserve_later_resources() -> None:
    for kind in ("group", "leader"):
        with tempfile.TemporaryDirectory(prefix=f"workbuddy-runner-{kind}-error-") as temp:
            root = Path(temp)
            result = subprocess.run(
                ["bash", str(SUPERVISOR), "--exercise-runner-observation-failure"],
                env={
                    **os.environ,
                    "OPENCORVUS_RUNNER_FAILURE_CONTROL_ROOT": str(root / "control"),
                    "OPENCORVUS_RUNNER_FAILURE_ATTEMPT_ROOT": str(root / "attempt"),
                    "OPENCORVUS_RUNNER_FAILURE_KIND": kind,
                },
                text=True,
                capture_output=True,
            )
            assert result.returncode == 0, result.stderr
