"""Execute the registered raw-generation -> model -> cold plan -> class-pair -> operating-ledger study."""
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import traceback

from build_group2_model import build
from make_rate_validation_input import make
from run_original_baseline import run_instance


CASES = [
    ("LR1_DR02_VC05_V8a", "native_rate_validation_vc05", 20261031),
    ("LR1_DR03_VC03_V16a", "native_rate_validation_vc03", 20261032),
]


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write(path, data):
    path.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def command(argv, prefix):
    record = {"started_at": now(), "argv": argv}
    with prefix.with_suffix(".stdout.txt").open("w", encoding="utf-8") as out, prefix.with_suffix(".stderr.txt").open("w", encoding="utf-8") as err:
        process = subprocess.Popen(argv, stdout=out, stderr=err, creationflags=subprocess.CREATE_NO_WINDOW)
        record["launcher_pid"] = process.pid
        write(prefix.with_suffix(".started.json"), record)
        code = process.wait()
    record.update(finished_at=now(), native_exit=code)
    write(prefix.with_suffix(".terminal.json"), record)
    if code:
        raise RuntimeError(f"native_study_step_failed:{prefix.name}:{code}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-raw", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    write(args.out / "owner-started.json", {"at": now(), "actual_python_pid": os.getpid(), "argv": sys.argv,
          "registered_cases": CASES, "periods": 120, "cold_solver_seconds": 60, "method_nominal_wall_seconds": 120,
          "scope": "Synthetic construction validation, not official instances, a new score, private heldout or human-hours evidence"})
    results = []
    try:
        for base, label, seed in CASES:
            root = args.out / label
            root.mkdir()
            recipe = make(args.original_raw, base, label, seed, 120, root / "input")
            raw = Path(recipe["raw_archive"])
            construction = build(raw, label, 120, root / "model")
            mps = Path(construction["model"])
            cold_root = root / "cold"
            cold_root.mkdir()
            cold = run_instance(mps.read_bytes(), label, cold_root, mps.name)
            cold_plan = cold_root / label
            result = {"label": label, "base_instance": base, "seed": seed, "raw_archive": str(raw),
                      "model": str(mps), "construction": construction, "cold": cold, "class_pair": None,
                      "method_dependency": "pending_initial_plan", "operational_exports": [], "benchmark_score": None}
            if cold["independent_validation"] is None:
                result["method_dependency"] = "not_executed_no_cold_feasible_plan"
            else:
                method_root = root / "class-pair"
                command([sys.executable, "-u", "-X", "utf8", "-B", str(Path(__file__).with_name("run_class_pair_study.py")),
                         "--closed-plan", str(cold_plan), "--strategy", "class-pairs", "--method-wall-seconds", "120", "--out", str(method_root)],
                        root / "class-pair-command")
                method = json.loads((method_root / "execution-terminal.json").read_text(encoding="utf-8"))
                result["class_pair"], result["method_dependency"] = method, "executed_from_actual_new_cold_plan"
                for role, source, status, scope, bound in [
                    ("cold", cold_plan, cold["status"], "original_model", cold["dual_bound"]),
                    ("class-pair", method_root, "class_pair_pass_complete" if method["complete_single_pass"] else "class_pair_wall_end", "conditional_pass", None),
                ]:
                    check = json.loads((source / "independent-original-model-check.json").read_text(encoding="utf-8"))
                    target = root / ("operations-" + role)
                    argv = [sys.executable, "-u", "-X", "utf8", "-B", str(Path(__file__).with_name("export_operational_plan.py")),
                            "--original-mps", str(mps), "--values", str(source / "final-values.json"),
                            "--reported-objective", str(check["reported_objective"]), "--computation-status", status,
                            "--computation-scope", scope, "--raw-archive", str(raw), "--instance", label, "--out", str(target)]
                    if bound is not None:
                        argv += ["--original-model-bound", str(bound)]
                    command(argv, root / ("export-" + role))
                    result["operational_exports"].append({"role": role, "directory": str(target)})
            results.append(result)
            write(args.out / "results.partial.json", results)
            print(json.dumps({"label": label, "cold_cost": cold.get("primal_bound"),
                              "class_pair_cost": result["class_pair"]["final_original_cost"] if result["class_pair"] else None,
                              "method_dependency": result["method_dependency"]}), flush=True)
        write(args.out / "owner-terminal.json", {"at": now(), "native_exit": 0, "results": results,
              "construction_study_complete": True, "all_new_plans_executed": all(x["class_pair"] is not None for x in results),
              "benchmark_frozen": False, "model_score": None})
    except BaseException as error:
        write(args.out / "owner-error.json", {"at": now(), "type": type(error).__name__, "error": str(error),
              "traceback": traceback.format_exc(), "completed_results": results})
        raise


if __name__ == "__main__":
    main()
