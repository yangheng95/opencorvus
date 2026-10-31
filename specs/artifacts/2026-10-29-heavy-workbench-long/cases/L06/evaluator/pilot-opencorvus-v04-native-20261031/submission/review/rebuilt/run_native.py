"""Execute the unmodified public exercise and export its original journals."""

from pathlib import Path
import argparse, csv, json, os, subprocess, sys, time


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--project", type=Path, required=True)
    p.add_argument("--public", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--export", type=Path, required=True)
    a = p.parse_args()
    root = Path(__file__).resolve().parent
    os.environ.update(
        PYTHONDONTWRITEBYTECODE="1", TEMP=str(root / "tmp"), TMP=str(root / "tmp")
    )
    argv = [
        sys.executable,
        "-X",
        "utf8",
        "-u",
        "-B",
        str(a.public.resolve() / "exercise.py"),
        "--project",
        str(a.project.resolve()),
        "--public",
        str(a.public.resolve()),
        "--out",
        str(a.out.resolve()),
        "--python",
        sys.executable,
    ]
    a.export.mkdir(parents=True, exist_ok=True)
    started = time.time()
    result = subprocess.run(argv, capture_output=True, text=True, encoding="utf-8")
    (a.export / "exercise-process.json").write_text(
        json.dumps(
            {
                "argv": argv,
                "exit": result.returncode,
                "started": started,
                "seconds": time.time() - started,
                "stdout": result.stdout,
                "stderr": result.stderr,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(
        "exercise exit", result.returncode, "seconds", time.time() - started, flush=True
    )
    if result.returncode:
        print(result.stderr, flush=True)
        sys.exit(result.returncode)
    sys.path.insert(0, str(a.public.resolve()))
    import audit

    result = audit.analyze(a.out.resolve())
    (a.export / "audit.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    summary = {"format": "l06-inspection-summary/1", "instances": result["instances"]}
    (a.export / "summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    with (a.export / "stage-ledger.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(result["ledger"][0]))
        writer.writeheader()
        writer.writerows(result["ledger"])
    print(
        json.dumps(
            {
                "cuts": result["controller_cuts"],
                "row_order_rows": result["row_order_control_rows"],
                "instances": {
                    k: {
                        f: v[f]
                        for f in [
                            "expected_cost_exact",
                            "minimum_cash",
                            "minimum_final_cash",
                            "maximum_raw_peak",
                            "terminal_histories",
                            "decision_histories",
                            "probability_mass_exact",
                        ]
                    }
                    for k, v in result["instances"].items()
                },
            },
            indent=2,
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
