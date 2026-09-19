"""Read-only historical score recovery; delegates scoring to the retained replay checker.

This is a scoring/evidence audit, not a replacement for the harness's eligibility
verifier. It never launches an agent, reads Provider credentials, or changes a run.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
from pathlib import Path
import subprocess
import sys


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def contained(root: Path, relative: str) -> Path:
    target = (root / relative).resolve()
    if target == root.resolve() or not target.is_relative_to(root.resolve()):
        raise ValueError("evidence_path_outside_root")
    return target


def check_seal(directory: Path, manifest: dict) -> dict:
    files = manifest["files"]
    seen: set[str] = set()
    violations = []
    for entry in files:
        name = entry["path"]
        if name in seen:
            violations.append({"path": name, "contract": "unique_file_identity"})
        seen.add(name)
        path = contained(directory, name)
        if not path.is_file():
            violations.append({"path": name, "contract": "sealed_file_available"})
        elif path.stat().st_size != entry["bytes"] or digest(path) != entry["sha256"]:
            violations.append({"path": name, "contract": "sealed_bytes_match"})
    required = {"result.json", "automationbench-events.jsonl", "automationbench-initial-world.json", "automationbench-final-world.json"}
    for name in sorted(required - seen):
        violations.append({"path": name, "contract": "required_score_input_sealed"})
    return {"passed": len(violations) == 0, "files_checked": len(files), "violations": violations}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, help="Explicit frozen case manifest; defaults to the evidence root case set")
    parser.add_argument("--harness", type=Path, required=True)
    parser.add_argument("--harness-revision", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    output = args.output.resolve()
    if output.is_relative_to(root):
        raise ValueError("audit_output_must_be_outside_original_evidence")
    output.mkdir(parents=True, exist_ok=False)
    catalog_path = root / "evidence-catalog.json"
    catalog = json.loads(catalog_path.read_text())
    manifest_path = args.manifest.resolve() if args.manifest else root / "automationbench-case-set-600.json"
    manifest = json.loads(manifest_path.read_text())
    cases = {row["case_index"]: row for row in manifest["cases"]}
    sys.path.insert(0, str(args.harness.resolve()))
    from automationbench_bridge import _load_task, _package_tree_sha256
    from automationbench.task_contract import task_contract_sha256
    package_hash = _package_tree_sha256()
    if package_hash != manifest["package_tree_sha256"]:
        raise ValueError("official_package_tree_mismatch")
    replay = args.harness.resolve() / "verify_automationbench_replay.py"
    leaderboard = {row["run_id"] for row in catalog["leaderboard"]}
    candidate_ids = [row["run_id"] for row in catalog["candidates"]]
    if len(set(candidate_ids)) != len(candidate_ids):
        raise ValueError("duplicate_catalog_candidate_run_identity")
    rows = []
    for candidate in catalog["candidates"]:
        directory = contained(root, candidate["evidence_directory"])
        sealed_manifest = json.loads((directory / "evidence-manifest.json").read_text())
        seal = check_seal(directory, sealed_manifest)
        result = json.loads((directory / "result.json").read_text())
        bench = result["benchmark"]
        official_row, info = _load_task(bench["domain"], bench["task"])
        task_hash = task_contract_sha256(example_id=official_row.get("example_id"), prompt=official_row.get("prompt"), info=info)
        frozen = cases[bench["case_index"]]
        identity = {
            "run": result["run"]["id"] == candidate["run_id"] == sealed_manifest["run_id"],
            "task": all(bench[key] == frozen[key] for key in ("domain", "task", "example_id", "task_contract_sha256")),
            "official_task": task_hash == frozen["task_contract_sha256"],
            "package": bench["package_tree_sha256"] == package_hash,
            "model": result["opencorvus"]["model"] == "openai/gpt-5.6-luna",
            "profile": result["opencorvus"]["profile"] == "base",
        }
        events_path = directory / "automationbench-events.jsonl"
        events = [json.loads(line) for line in events_path.read_text().splitlines() if line.strip()]
        scores = [event for event in events if event.get("kind") == "score"]
        if len(scores) != 1:
            raise ValueError("unique_sealed_score_event_required")
        score = scores[0]
        identity["recorded_metrics"] = all(score[key] == bench["metrics"][key] for key in ("partial_credit", "task_completed_correctly"))
        process = subprocess.run(
            [sys.executable, str(replay), "--domain", bench["domain"], "--task", bench["task"],
             "--events", str(events_path), "--initial-world", str(directory / "automationbench-initial-world.json"),
             "--final-world", str(directory / "automationbench-final-world.json")],
            input=json.dumps({**bench, **bench["metrics"]}), text=True, capture_output=True,
        )
        replay_result = json.loads(process.stdout) if process.returncode == 0 else {"passed": False, "exit_code": process.returncode}
        # Checker diagnostics remain local to the explicitly chosen audit output.
        if process.returncode:
            (output / f"{candidate['run_id']}.checker-error.txt").write_text(process.stderr)
        row = {
            "run_id": candidate["run_id"], "case_index": bench["case_index"], "domain": bench["domain"],
            "task": bench["task"], "example_id": bench["example_id"], "task_contract_sha256": task_hash,
            "source_commit": result["opencorvus"]["commit"], "evidence_directory": candidate["evidence_directory"],
            "manifest_sha256": digest(directory / "evidence-manifest.json"),
            "recorded_leaderboard_member": candidate["run_id"] in leaderboard,
            "seal": seal, "identity_checks": identity, "replay": replay_result,
            "strict": score["task_completed_correctly"], "partial": score["partial_credit"],
            "score_audit_passed": seal["passed"] and all(identity.values()) and replay_result["passed"],
        }
        rows.append(row)
        with (output / "cases.jsonl").open("a") as target:
            target.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(json.dumps({"checked": len(rows), "case_index": row["case_index"], "passed": row["score_audit_passed"]}), flush=True)
    verified = [row for row in rows if row["score_audit_passed"]]
    verified_board = [row for row in verified if row["recorded_leaderboard_member"]]
    summary = {
        "schema_version": 1, "audit_kind": "historical_seal_identity_and_official_score_recomputation",
        "original_root": str(root), "original_catalog_sha256": digest(catalog_path),
        "case_manifest_sha256": digest(manifest_path), "official_package_tree_sha256": package_hash,
        "harness_revision": args.harness_revision,
        "checker_sha256": digest(replay), "bridge_sha256": digest(args.harness / "automationbench_bridge.py"),
        "attempts_recorded": len(catalog["attempts"]), "candidates_checked": len(rows),
        "score_audits_passed": len(verified), "recorded_leaderboard_rows_verified": len(verified_board),
        "recorded_leaderboard_strict_passes_verified": sum(row["strict"] for row in verified_board),
        "source_commit_counts": dict(collections.Counter(row["source_commit"] for row in verified)),
        "failed_case_indices": [row["case_index"] for row in rows if not row["score_audit_passed"]],
        "limitations": ["No new model execution", "Does not revalidate full runtime eligibility or raw Provider identity",
                        "Stateful tool calls verified by retained hash chain, not re-executed", "Historical mixed source revisions",
                        "Historical native Luna comparison identity remains unknown"],
    }
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    if len(verified) != len(rows):
        sys.exit(1)


if __name__ == "__main__":
    main()
