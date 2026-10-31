"""Positive full-node replay, all-instance row reorder and named rejection tests."""

from pathlib import Path
import argparse, copy, csv, json, os, shutil, subprocess, sys, tempfile, time


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--project", type=Path, required=True)
    p.add_argument("--public", type=Path, required=True)
    p.add_argument("--run", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()
    root = Path(__file__).resolve().parent
    os.environ.update(
        TEMP=str(root / "tmp"), TMP=str(root / "tmp"), PYTHONDONTWRITEBYTECODE="1"
    )
    records = []

    def invoke(instance, packets):
        argv = [
            sys.executable,
            "-X",
            "utf8",
            "-u",
            "-B",
            str(a.project.resolve() / "actor.py"),
            str(a.public.resolve()),
            str(instance),
        ]
        started = time.perf_counter()
        r = subprocess.run(
            argv,
            input="".join(json.dumps(x) + "\n" for x in packets),
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=30,
        )
        return r, time.perf_counter() - started

    with tempfile.TemporaryDirectory(
        dir=root / "tmp", prefix="actor-contract-"
    ) as temp:
        temp = Path(temp)
        for ident in ["base", "cash-tight", "shifted-prior"]:
            wires = [
                json.loads(x)
                for x in (a.run / ("discovery-" + ident) / "wire.jsonl")
                .read_text(encoding="utf-8")
                .splitlines()
            ]
            packets = [x["packet"] for x in wires]
            expected = [x["response"] for x in wires]
            original = a.public.resolve() / "instances" / ident
            r, elapsed = invoke(original, packets)
            assert r.returncode == 0, r.stderr
            assert [json.loads(x) for x in r.stdout.splitlines()] == expected
            again, _ = invoke(original, packets[:1])
            assert json.loads(again.stdout) == expected[0]
            reordered = temp / ident
            shutil.copytree(original, reordered)
            for file in reordered.glob("*.csv"):
                with file.open(encoding="utf-8", newline="") as f:
                    rows = list(csv.reader(f))
                with file.open("w", encoding="utf-8", newline="") as f:
                    csv.writer(f).writerows(rows[:1] + list(reversed(rows[1:])))
            rr, _ = invoke(reordered, packets)
            assert rr.returncode == 0, rr.stderr
            assert [json.loads(x) for x in rr.stdout.splitlines()] == expected
            records.append(
                {
                    "instance": ident,
                    "all_decision_packets": len(packets),
                    "exact_replays": True,
                    "all_node_row_reorder_exact": True,
                    "new_process_key_exact": True,
                    "batch_seconds": elapsed,
                }
            )
            sample = next(x for x in packets if len(x["committed"]) >= 2)
            cases = []
            bad = copy.deepcopy(sample)
            bad["state"]["cash"] += 1
            cases.append(("changed_state", bad, "complete_original_packet"))
            bad = copy.deepcopy(sample)
            bad["committed"].append(copy.deepcopy(bad["committed"][0]))
            cases.append(("duplicate", bad, "duplicate_original_key"))
            bad = copy.deepcopy(sample)
            bad["committed"][0]["post_state"]["cash"] += 1
            cases.append(("corrupt_receipt", bad, "original_receipt_state"))
            bad = copy.deepcopy(sample)
            bad["committed"][0]["request_id"] = "replacement-key"
            cases.append(("changed_key", bad, "changed_original_request_key"))
            bad = copy.deepcopy(sample)
            bad["committed"] = bad["committed"][1:]
            cases.append(("truncated_prefix", bad, "changed_original_request_key"))
            for name, bad, diagnosis in cases:
                result, _ = invoke(original, [bad])
                assert result.returncode != 0 and diagnosis in result.stderr, (
                    name,
                    result.stdout,
                    result.stderr,
                )
                records.append(
                    {
                        "instance": ident,
                        "negative": name,
                        "diagnosis": diagnosis,
                        "exit": result.returncode,
                        "stdout": result.stdout,
                        "stderr": result.stderr,
                    }
                )
            facts = json.loads((reordered / "profile.json").read_text(encoding="utf-8"))
            facts["initial_cash"] += 1
            (reordered / "profile.json").write_text(json.dumps(facts), encoding="utf-8")
            result, _ = invoke(reordered, packets[:1])
            assert result.returncode != 0 and "changed_original_facts" in result.stderr
            records.append(
                {
                    "instance": ident,
                    "negative": "changed_facts",
                    "exit": result.returncode,
                    "stderr": result.stderr,
                }
            )
    a.out.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(json.dumps([r for r in records if "all_decision_packets" in r], indent=2))
    print(
        "18 named negative tests rejected; all positive packets, restart and all-instance reorder verified"
    )


if __name__ == "__main__":
    main()
