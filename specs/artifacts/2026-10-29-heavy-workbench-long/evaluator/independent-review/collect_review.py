"""Independent reviewer evidence collector; writes only beside this file."""

from __future__ import annotations

import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent
REPO = Path(r"D:/myhexin-local/opencorvus")
CACHE = ROOT.parent
IMAGE = "pytorch/pytorch@sha256:c16f4c749e2d9e96878875cdf6cc45cddda1d1a36fddd371dd6f2360f1b6e2a2"


def put(relative, text):
    path = (ROOT / relative).resolve()
    path.relative_to(ROOT)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def save_json(relative, value):
    put(relative, json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n")


def capture(label, command):
    before = datetime.datetime.now(datetime.timezone.utc).isoformat()
    start = time.perf_counter()
    environment = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")
    run = subprocess.run(command, cwd=ROOT, env=environment, capture_output=True, text=True, encoding="utf-8", errors="replace")
    elapsed = time.perf_counter() - start
    put(f"receipts/{label}.stdout.txt", run.stdout)
    put(f"receipts/{label}.stderr.txt", run.stderr)
    receipt = {
        "label": label, "started_at_utc": before, "elapsed_seconds": elapsed,
        "command_argv": command, "cwd": str(ROOT), "exit_code": run.returncode,
        "stdout": f"receipts/{label}.stdout.txt", "stderr": f"receipts/{label}.stderr.txt",
        "provenance": "fresh execution by independent reviewer, not candidate execution",
    }
    save_json(f"receipts/{label}.json", receipt)
    print(json.dumps({"label": label, "exit_code": run.returncode, "seconds": elapsed}))
    return receipt, run


def main():
    expected = Path(r"D:/opencorvus-benchmark-runs/paperbench-discovery-20261029/independent-review").resolve()
    if ROOT != expected:
        raise RuntimeError("This collector is limited to its explicitly authorized external directory")
    files = [
        "script/benchmark/pinn_numeric_check.py", "script/benchmark/test_pinn_numeric_check.py",
        "script/benchmark/pinn_torch_check.py", "script/benchmark/test_pinn_torch_check.py",
        "specs/artifacts/2026-10-29-heavy-workbench-long/public/TASK.md",
        "specs/artifacts/2026-10-29-heavy-workbench-long/public/profile.json",
        "specs/records/2026-10/2026-10-29-heavy-workbench-long.md",
    ]
    copies = []
    for name in files:
        source = REPO / name
        target = ROOT / "reviewed-source" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        raw = source.read_bytes()
        target.write_bytes(raw)
        copies.append({"source": str(source), "snapshot": str(target.relative_to(ROOT)), "bytes": len(raw),
                       "copy_is_byte_equal_at_capture": target.read_bytes() == raw})
    save_json("reviewed-source/manifest.json", {"captured_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                                               "purpose": "auditable reviewed-source snapshot; no digest used as a functional correctness gate", "files": copies})

    snapshot = ROOT / "reviewed-source/script/benchmark"
    numpy_receipt, numpy_run = capture("numpy-tests", [sys.executable, "-B", str(snapshot / "test_pinn_numeric_check.py")])
    torch_receipt, torch_run = capture("torch-cpu-tests-and-boundaries", [
        "docker", "run", "--rm", "--network", "none", "--cpus", "1", "-e", "PYTHONDONTWRITEBYTECODE=1",
        "--mount", f"type=bind,source={ROOT},target=/review,readonly", IMAGE,
        "python", "-B", "/review/reproduce_torch_cpu.py",
    ])
    numeric_receipt, numeric_run = capture("numpy-boundaries-and-deep-jets", [sys.executable, "-B", str(ROOT / "reproduce_numpy_boundaries.py")])

    external = CACHE / "qualification/independent-component-check.json"
    observed = json.loads(external.read_text(encoding="utf-8"))
    put("observed-main-agent-receipts/independent-component-check.json", external.read_text(encoding="utf-8"))
    component_summary = []
    for item in observed:
        directional_error = abs(item["directional_gradient"] - item["finite_difference_directional_gradient"])
        directional_limit = 1e-7 * max(1, abs(item["directional_gradient"]), abs(item["finite_difference_directional_gradient"]))
        hvp_absolute_error = item["finite_difference_hvp_relative_error"] * max(item["hvp_l2"], 1e-12)
        hvp_limit = 1e-7 + 1e-4 * item["hvp_l2"]
        largest = sorted(item.get("spectrum", {}).get("pairs", []), key=lambda p: p["value"])[-5:]
        component_summary.append({
            "problem": item["problem"], "component": item["component"],
            "directional_error": directional_error, "directional_limit": directional_limit,
            "directional_check_pass": directional_error <= directional_limit,
            "hvp_absolute_error": hvp_absolute_error, "hvp_limit": hvp_limit,
            "hvp_check_pass": hvp_absolute_error <= hvp_limit,
            "largest_five_ritz_count_passing_1e_3": sum(p["explicit_ritz_residual"] / max(1, abs(p["value"])) <= 1e-3 for p in largest),
            "largest_five_ritz_observed": largest,
        })
    save_json("component-receipt-independent-arithmetic.json", {
        "provenance": "reviewer rechecked arithmetic of main-agent GPU receipt; reviewer did not rerun GPU or claim authorship of those executions",
        "source": str(external), "cases": component_summary,
    })
    selection = json.loads((REPO / files[5]).read_text(encoding="utf-8"))["selection"]
    save_json("stage-assessment.json", {
        "reviewer": "/root/benchmark_review", "created_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "scope": "independent design/tool review; no candidate implementation; no delegation; no secrets/author code; no main-repository writes",
        "fresh_executions": [numpy_receipt, torch_receipt, numeric_receipt],
        "unit_and_boundary_execution_ok": all(x["exit_code"] == 0 for x in [numpy_receipt, torch_receipt, numeric_receipt]),
        "gpu_receipt_rows_reviewed": len(component_summary),
        "all_gpu_receipt_parameter_fd_checks_pass": all(x["directional_check_pass"] and x["hvp_check_pass"] for x in component_summary),
        "gpu_receipt_is_qualification_not_candidate": True,
        "profile_selection_observed": selection,
        "prior_blockers_resolved": ["candidate-controlled CLI points", "L-BFGS finite zero-step terminal", "exact 11k Adam switch", "continuation failure termination", "eligible parent selection/dependency_incomplete", "component exact-zero parameter derivatives", "explicit numerical tolerances and symmetric preconditioned operator contract"],
        "formal_freeze_approved": False,
        "still_required": ["R9 result anchors remain unfrozen", "late-checkpoint NNCG/stabilization/Armijo/spectrum qualification remains pending", "no complete 19-run candidate rollout and clean re-training evidence", "actual useful hours-scale work not yet empirically established", "no expert calibration or mature-benchmark empirical certification"],
        "historical_observations": "historical/ contains verbatim command/output transcriptions from this reviewer's prior actual tool calls; original UTC was not recorded; never relabeled as fresh runs",
    })
    if not all(x["exit_code"] == 0 for x in [numpy_receipt, torch_receipt, numeric_receipt]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
