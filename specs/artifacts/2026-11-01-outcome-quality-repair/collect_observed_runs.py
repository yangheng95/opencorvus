import collections
import json
from pathlib import Path

root = Path(__file__).resolve().parent
summary = {"runs": []}
for phase in ("baseline", "after"):
    report_path = root / phase / "result.json"
    if not report_path.is_file():
        continue
    report = json.loads(report_path.read_text(encoding="utf-8"))
    requests = report.get("requests", [])
    summary[phase] = {
        "status": report.get("status"), "error": report.get("error"),
        "cleanup": report.get("cleanup"), "requests": len(requests),
        "models": dict(collections.Counter(r.get("model") for r in requests)),
        "streaming": dict(collections.Counter(str(r.get("streaming")) for r in requests)),
        "http": dict(collections.Counter(str(r.get("status")) for r in requests)),
        "probes": {probe: sum(bool(p.get("matches")) for r in requests for p in r.get("input_evidence", {}).get("probes", []) if p.get("id") == probe) for probe in ("shared-verification-policy", "completion-summary-schema", "patch-operation-contract")},
    }
    for run in report.get("cases", []):
        kind = run["kind"]
        trace_path = root / phase / (kind + "-trace.json")
        trace = json.loads(trace_path.read_text(encoding="utf-8")) if trace_path.is_file() else {}
        parts = trace.get("tools")
        if parts is None:
            parts = [p for m in trace.get("messages", []) if isinstance(m, dict) for p in m.get("parts", []) if p.get("type") == "tool"]
        issues = []
        for part in parts:
            state = part.get("state", {})
            code = state.get("metadata", {}).get("exit")
            if state.get("status") == "error" or (type(code) is int and code != 0):
                issues.append({"part_id": part["id"], "tool": part["tool"], "input": state.get("input"), "failure": state.get("failure"), "exit": code, "output": state.get("output"), "time": state.get("time")})
        grade = run.get("grade")
        artifact_diagnostic = False
        if grade is None and phase == "baseline" and kind == "task":
            grade = json.loads((root / phase / "task-interrupted-artifact-diagnostic/grade.json").read_text(encoding="utf-8"))
            artifact_diagnostic = True
        row = {
            "phase": phase, "kind": kind, "entry": run["entry"], "sessionID": run.get("sessionID"), "taskID": run.get("taskID"),
            "startedAt": run.get("startedAt"), "settledAt": run.get("settledAt"), "lifecycle": run.get("lifecycle"),
            "requestsBefore": run.get("requestsBefore"), "requestsAfter": run.get("requestsAfter"),
            "tool_count": len(parts), "tool_states": dict(collections.Counter(p.get("state", {}).get("status") for p in parts)),
            "issues": issues, "artifact_diagnostic_only": artifact_diagnostic,
            "consumer": {"passed": grade.get("passed"), "results": [{k: r.get(k) for k in ("name", "exit", "passed", "execution", "selection", "quality_measurement", "released_plan", "error")} for r in grade.get("results", [])]} if grade else None,
        }
        summary["runs"].append(row)
(root / "observed-runs.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"phases": {k: v for k, v in summary.items() if k != "runs"}, "runs": [{k: v for k, v in r.items() if k != "issues"} | {"faults": len(r["issues"])} for r in summary["runs"]]}, ensure_ascii=False, indent=2))
