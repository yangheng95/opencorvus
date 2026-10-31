"""Export completed method results using their genuine recorded native objective claims."""
import argparse
import datetime
import json
from pathlib import Path
import subprocess
import sys
import traceback


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--study", type=Path, required=True)
    parser.add_argument("--raw-archive", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    write(args.out / "execution-started.json", {"at": now(), "argv": sys.argv,
          "scope": "Artifact export, not a new solve or synthetic native objective"})
    exports = []
    try:
        study = load(args.study / "owner-terminal.json")
        for result in study["results"]:
            name = result["instance"] + "--" + result["strategy"]
            source = args.study / name
            original_check = load(source / "independent-original-model-check.json")
            target = args.out / name
            is_global = result["strategy"] == "global"
            status = result["stages"][-1]["status"] if is_global else (
                "class_pair_pass_complete" if result["complete_single_pass"] else "class_pair_wall_end")
            mps = args.study / "inputs" / result["instance"] / (result["instance"] + "_t120.mps")
            argv = [sys.executable, "-u", "-X", "utf8", "-B", str(Path(__file__).with_name("export_operational_plan.py")),
                    "--original-mps", str(mps), "--values", str(source / "final-values.json"),
                    "--raw-archive", str(args.raw_archive), "--instance", result["instance"],
                    "--computation-status", status, "--computation-scope", "original_model" if is_global else "conditional_pass",
                    "--out", str(target)]
            if original_check["reported_objective"] is not None:
                argv += ["--reported-objective", str(original_check["reported_objective"])]
            if is_global and result["original_model_bound"] is not None:
                argv += ["--original-model-bound", str(result["original_model_bound"])]
            record = {"started_at": now(), "argv": argv,
                      "objective_claim_source": str(source / "independent-original-model-check.json"),
                      "objective_claim_field": "reported_objective, actual model.getSolObjVal supplied by the native run"}
            write(args.out / (name + ".command-started.json"), record)
            with (args.out / (name + ".stdout.txt")).open("w", encoding="utf-8") as out, (
                args.out / (name + ".stderr.txt")
            ).open("w", encoding="utf-8") as err:
                process = subprocess.Popen(argv, stdout=out, stderr=err, creationflags=subprocess.CREATE_NO_WINDOW)
                record["launcher_pid"] = process.pid
                code = process.wait()
            record.update(finished_at=now(), native_exit=code)
            write(args.out / (name + ".command-terminal.json"), record)
            if code:
                raise RuntimeError(f"operational_export_native_exit:{name}:{code}")
            exports.append({"instance": result["instance"], "strategy": result["strategy"],
                            "directory": str(target), "objective_claim_source": record["objective_claim_source"]})
            write(args.out / "exports.partial.json", exports)
        write(args.out / "operations-index.json", {"at": now(), "exports": exports,
              "scope": "Actual completed export records, not a benchmark score"})
        write(args.out / "execution-terminal.json", {"at": now(), "native_code": 0,
              "exports_completed": len(exports), "new_optimization": False})
        print(json.dumps({"exports_completed": len(exports), "new_optimization": False}), flush=True)
    except BaseException as error:
        write(args.out / "execution-error.json", {"at": now(), "type": type(error).__name__,
              "error": str(error), "traceback": traceback.format_exc(), "completed_exports": exports})
        raise


if __name__ == "__main__":
    main()
