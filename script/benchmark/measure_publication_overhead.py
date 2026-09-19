"""Measure removable publication-selection calls from sealed real transcripts."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)


def measurement_inputs(directory, manifest, names=("result.json", "opencorvus-transcript.json", "runtime-database-snapshot.json")):
    directory = directory.resolve()
    sealed = {}
    for entry in manifest["files"]:
        if entry["path"] in sealed:
            raise ValueError("duplicate_sealed_file_identity")
        sealed[entry["path"]] = entry
    verified = {}
    for name in names:
        path = (directory / name).resolve()
        if not path.is_relative_to(directory):
            raise ValueError("measurement_input_outside_evidence_directory")
        data = path.read_bytes()
        if name not in sealed or sealed[name]["bytes"] != len(data) or sealed[name]["sha256"] != hashlib.sha256(data).hexdigest():
            raise ValueError(f"measurement_input_seal_mismatch:{name}")
        verified[name] = data
    return verified


def measure(messages):
    calls = {}
    for message in messages:
        for part in message.get("parts", []):
            if part.get("type") != "tool":
                continue
            call = {"session": message["info"]["sessionID"], "part": part}
            if part["id"] in calls and calls[part["id"]] != call:
                raise ValueError("conflicting_tool_part_identity")
            calls[part["id"]] = call
    publishers = {row["session"] for row in calls.values() if row["part"]["tool"] == "artifact_publish"}
    other_consumed = set()
    for row in calls.values():
        part = row["part"]
        if part["tool"] != "artifact_publish":
            other_consumed.update((row["session"], value) for value in strings(part["state"].get("input", {})))
    eligible, other, direct = [], [], 0
    for part_id, row in calls.items():
        part, session = row["part"], row["session"]
        if part["state"]["status"] != "completed":
            continue
        if part["tool"] == "artifact_publish":
            direct += bool(part["state"].get("input", {}).get("source_read_refs"))
        if part["tool"] != "artifact_select" or session not in publishers:
            continue
        output = json.loads(part["state"]["output"])
        reference = output.get("artifact_selection_ref")
        if not isinstance(reference, str):
            raise ValueError("selection_receipt_missing_reference")
        (other if (session, reference) in other_consumed else eligible).append(part_id)
    counts = Counter(row["part"]["tool"] for row in calls.values())
    return {"tool_calls": len(calls), "calls_by_tool": dict(sorted(counts.items())),
            "publication_selection_calls": len(eligible), "publication_selection_part_ids": sorted(eligible),
            "publisher_selections_used_by_other_consumers": len(other),
            "direct_read_source_publications": direct,
            "failed_tool_calls": sum(row["part"]["state"]["status"] == "error" for row in calls.values())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--cases", required=True, help="Exact preregistered case indices, comma separated")
    parser.add_argument("--runtime-commit", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    indices = [int(value) for value in args.cases.split(",")]
    if len(set(indices)) != len(indices):
        raise ValueError("duplicate_case_index")
    catalog = json.loads((root / "evidence-catalog.json").read_text())
    rows = []
    for index in indices:
        candidates = [r for r in catalog["candidates"] if r["benchmark"]["case_index"] == index]
        if len(candidates) != 1:
            raise ValueError(f"one_sealed_candidate_required:{index}")
        candidate = candidates[0]
        directory = (root / candidate["evidence_directory"]).resolve()
        if not directory.is_relative_to(root):
            raise ValueError("evidence_directory_outside_root")
        manifest = json.loads((directory / "evidence-manifest.json").read_text())
        verified_bytes = measurement_inputs(directory, manifest)
        result = json.loads(verified_bytes["result.json"])
        if (result["opencorvus"]["commit"] != args.runtime_commit or result["run"]["status"] != "scored"
                or result["run"]["id"] != candidate["run_id"] or result["run"]["id"] != manifest["run_id"]
                or result["benchmark"]["case_index"] != index or result["opencorvus"]["profile"] != "base"
                or result["opencorvus"]["model"] != "openai/gpt-5.6-luna"):
            raise ValueError("scored_runtime_identity_mismatch")
        transcript = verified_bytes["opencorvus-transcript.json"]
        database = json.loads(verified_bytes["runtime-database-snapshot.json"])
        metrics = result["benchmark"]["metrics"]
        rows.append({"case_index": index, "run_id": result["run"]["id"],
                     "domain": result["benchmark"]["domain"], "task": result["benchmark"]["task"],
                     "task_contract_sha256": result["benchmark"]["task_contract_sha256"],
                     "runtime_commit": args.runtime_commit, "duration_ms": result["run"]["duration_ms"],
                     "strict": metrics["task_completed_correctly"], "partial": metrics["partial_credit"],
                     "recorded_official_replay": result["benchmark"]["scorer_replay_audit"]["passed"],
                     "provider_requests": len(database["rows"]["provider_activity_request"]),
                     "transcript_sha256": hashlib.sha256(transcript).hexdigest(),
                     **measure(json.loads(transcript))})
    report = {"schema_version": 1, "case_indices": indices, "runtime_commit": args.runtime_commit,
              "metric": "Standalone selections in generic-publishing Sessions, excluding references consumed by other Tools; counts unused selections too.",
              "limitation": "This measures a specific transport overhead, not all calls or overall speedup. Independent verification remains required.",
              "cases": rows,
              "publication_selection_calls": sum(row["publication_selection_calls"] for row in rows),
              "provider_requests": sum(row["provider_requests"] for row in rows),
              "tool_calls": sum(row["tool_calls"] for row in rows)}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as output:
        output.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in ["case_indices", "publication_selection_calls", "provider_requests", "tool_calls"]}))


if __name__ == "__main__":
    main()
