#!/usr/bin/env python3
"""Build and preflight the immutable WorkBuddy chain-proof slot catalog."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def process_start_time(pid: int) -> str | None:
    try:
        raw = Path(f"/proc/{pid}/stat").read_text()
        closing = raw.rfind(")")
        fields = raw[closing + 2 :].split()
        return fields[19]
    except (OSError, IndexError):
        return None


def nearest_result(agent_dir: Path, evidence_root: Path) -> Path | None:
    current = agent_dir.parent
    while evidence_root == current or evidence_root in current.parents:
        candidate = current / "result.json"
        if candidate.is_file():
            return candidate
        if current == evidence_root:
            break
        current = current.parent
    return None


def protected_secrets() -> list[bytes]:
    auth_path = Path("/var/lib/opencorvus-benchmark/provider-data/auth.json")
    if not auth_path.is_file():
        return []
    auth = read_json(auth_path)
    values: list[bytes] = []

    def collect(value: Any) -> None:
        if isinstance(value, dict):
            for item in value.values():
                collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)
        elif isinstance(value, str) and len(value) >= 12:
            values.append(value.encode())

    collect(auth)
    return values


def evidence_credential_audit(root: Path, secrets: list[bytes]) -> dict[str, Any]:
    violations = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix in {".db", ".wal", ".shm"}:
            continue
        data = path.read_bytes()
        if any(secret in data for secret in secrets):
            violations.append(f"credential_bytes_present:{path.relative_to(root).as_posix()}")
    return {"passed": not violations, "checked_secret_count": len(secrets), "violations": violations}


def evidence_manifest_audit(root: Path) -> dict[str, Any]:
    manifest_path = root / "evidence-manifest.json"
    if not manifest_path.is_file():
        return {"passed": False, "violations": ["evidence_manifest_missing"]}
    manifest = read_json(manifest_path)
    expected = {
        str(row.get("path")): (int(row.get("bytes") or -1), str(row.get("sha256") or ""))
        for row in manifest.get("files") or []
    }
    actual = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path == manifest_path:
            continue
        data = path.read_bytes()
        actual[path.relative_to(root).as_posix()] = (len(data), hashlib.sha256(data).hexdigest())
    violations = []
    for path in sorted(expected.keys() - actual.keys()):
        violations.append(f"manifest_file_missing:{path}")
    for path in sorted(actual.keys() - expected.keys()):
        violations.append(f"manifest_file_extra:{path}")
    for path in sorted(expected.keys() & actual.keys()):
        if expected[path] != actual[path]:
            violations.append(f"manifest_file_mismatch:{path}")
    return {"passed": not violations, "files": len(actual), "violations": violations}


def build_catalog(evidence_root: Path) -> dict[str, Any]:
    attempts = []
    secrets = protected_secrets()
    for disposition_path in sorted(evidence_root.rglob("agent/attempt-disposition.json")):
        agent_dir = disposition_path.parent
        disposition = read_json(disposition_path)
        result_path = nearest_result(agent_dir, evidence_root)
        audits = {}
        for name in (
            "skill-projection-audit",
            "skill-load-order-audit",
            "workflow-binding-audit",
            "physical-settlement-audit",
            "credential-leak-audit",
            "provider-usage-audit",
            "process-cleanup-audit",
        ):
            path = agent_dir / f"{name}.json"
            audits[name] = read_json(path) if path.is_file() else None
        host_credential_audit = evidence_credential_audit(agent_dir.parent, secrets)
        audits["host-evidence-credential-leak"] = host_credential_audit
        audits["evidence-manifest"] = evidence_manifest_audit(agent_dir)
        status = str(disposition.get("status") or "incomplete")
        violations = []
        if status == "agent_settled":
            for name, audit in audits.items():
                if not isinstance(audit, dict) or audit.get("passed") is not True:
                    violations.append(f"audit_not_passed:{name}")
            official_result = read_json(result_path) if result_path else None
            if result_path is None:
                violations.append("official_result_missing")
            elif not isinstance(official_result, dict):
                violations.append("official_result_invalid")
            else:
                if official_result.get("exception_info") is not None:
                    violations.append("official_trial_exception")
                if official_result.get("agent_result") is None:
                    violations.append("official_agent_result_missing")
                verifier_result = official_result.get("verifier_result")
                rewards = verifier_result.get("rewards") if isinstance(verifier_result, dict) else None
                if not isinstance(rewards, dict) or not rewards:
                    violations.append("official_verifier_rewards_missing")
                for step in official_result.get("step_results") or []:
                    if isinstance(step, dict) and step.get("exception_info") is not None:
                        violations.append(f"official_step_exception:{step.get('step_name')}")
            if not (agent_dir / "trajectory.json").is_file():
                violations.append("atif_trajectory_missing")
            if not (agent_dir / "source-receipt.json").is_file():
                violations.append("source_receipt_missing")
            cleanup_path = agent_dir / "host-cleanup.txt"
            if not cleanup_path.is_file() or "server_group_stopped=1" not in cleanup_path.read_text(
                encoding="utf-8", errors="replace"
            ):
                violations.append("host_cleanup_receipt_missing")
            status = "sealed_candidate" if not violations else "invalid_bug"
        elif status != "invalid_bug":
            status = "incomplete"
        attempts.append(
            {
                "attempt_root": agent_dir.parent.relative_to(evidence_root).as_posix(),
                "status": status,
                "score_eligible": status == "sealed_candidate",
                "disposition": disposition,
                "official_result": result_path.relative_to(evidence_root).as_posix() if result_path else None,
                "audits": audits,
                "violations": violations,
            }
        )
    counts = {
        status: sum(1 for attempt in attempts if attempt["status"] == status)
        for status in ("sealed_candidate", "invalid_bug", "incomplete")
    }
    return {"schema_version": 1, "attempts": attempts, "counts": counts}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-root", required=True, type=Path)
    parser.add_argument("--control-root", required=True, type=Path)
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    catalog = build_catalog(args.evidence_root)
    catalog_path = args.control_root / "chain-proof-catalog.json"
    write_json_atomic(catalog_path, catalog)
    if args.preflight and catalog["counts"]["sealed_candidate"]:
        print("chain-proof slot already has a reusable sealed candidate", flush=True)
        return 2
    active = args.control_root / "active-run.json"
    if args.preflight and active.is_file():
        state = read_json(active)
        pid = int(state.get("pid") or 0)
        if state.get("status") == "running" and pid > 0:
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                pass
            else:
                if process_start_time(pid) == str(state.get("pid_start_time") or ""):
                    print(f"chain-proof supervisor already running pid={pid}", flush=True)
                    return 3
    print(json.dumps(catalog["counts"], sort_keys=True), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
