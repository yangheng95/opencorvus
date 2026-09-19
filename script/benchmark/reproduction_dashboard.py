"""Read-only localhost view over the native results and Base catalog authorities."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import threading
import time


MODEL = "openai/gpt-5.6-luna"


class SnapshotError(ValueError):
    pass


def scored_cell(run_id, strict, partial, duration_ms, tokens):
    if type(strict) not in (int, float) or strict not in (0, 1):
        raise SnapshotError("invalid_strict_score")
    if type(partial) not in (int, float) or not math.isfinite(partial) or not 0 <= partial <= 1:
        raise SnapshotError("invalid_partial_score")
    return {"state": "scored", "run_id": run_id, "strict": strict, "partial": partial,
            "duration_ms": duration_ms, "tokens": tokens}


def summarize(cells):
    counts = Counter(cell["state"] for cell in cells)
    scored = [cell for cell in cells if cell["state"] == "scored"]
    passed = sum(cell["strict"] for cell in scored)
    return {"total": len(cells), "scored": len(scored), "passed": passed,
            "strict_rate": passed / len(scored) if scored else None,
            "running": counts["running"], "awaiting": counts["awaiting"],
            "invalid": counts["invalid"] + counts["conflict"] + counts["interrupted"],
            "pending": counts["pending"]}


def paired_summary(rows):
    paired = [row for row in rows if row["native"]["state"] == row["base"]["state"] == "scored"]
    return {"count": len(paired),
            "native_only_pass": sum(row["native"]["strict"] == 1 and row["base"]["strict"] == 0 for row in paired),
            "base_only_pass": sum(row["base"]["strict"] == 1 and row["native"]["strict"] == 0 for row in paired),
            "both_pass": sum(row["base"]["strict"] == row["native"]["strict"] == 1 for row in paired),
            "both_fail": sum(row["base"]["strict"] == row["native"]["strict"] == 0 for row in paired)}


def command_value(argv, option):
    try:
        return argv[argv.index(option) + 1]
    except (ValueError, IndexError):
        return None


def native_live_outputs():
    outputs = set()
    for proc in Path("/proc").glob("[0-9]*/cmdline"):
        try:
            argv = proc.read_bytes().decode().split("\0")
        except (OSError, UnicodeError):
            continue
        if any(Path(arg).name == "run-native-automationbench.ts" for arg in argv):
            output = command_value(argv, "--output")
            if output:
                outputs.add(str(Path(output).resolve()))
    return outputs


def base_command_state(argv, lease, case, evidence_root):
    output = command_value(argv, "--output")
    matches = (any(Path(arg).name == "run-automationbench.ts" for arg in argv)
               and command_value(argv, "--batch-run-id") == lease.get("batch_run_id")
               and bool(lease.get("batch_run_id"))
               and command_value(argv, "--domain") == case["domain"]
               and command_value(argv, "--task") == case["task"]
               and command_value(argv, "--profile") == lease.get("profile") == "base"
               and output is not None and Path(output).resolve() == evidence_root.resolve())
    return "running" if matches else "interrupted"


def base_lease_state(lease, case, evidence_root):
    try:
        argv = Path(f"/proc/{int(lease['pid'])}/cmdline").read_bytes().decode().split("\0")
    except (OSError, ValueError, UnicodeError, KeyError):
        return "interrupted"
    return base_command_state(argv, lease, case, evidence_root)


def base_record_index(record, by_identity, cases):
    bench = record.get("benchmark", {})
    index = by_identity.get((bench.get("domain"), bench.get("task")))
    declared = bench.get("case_index")
    if declared is not None and (index is not None or declared in cases) and declared != index:
        raise SnapshotError("base_case_identity_mismatch")
    return index


def resolve_base_scores(records):
    first = records[0]
    if any(record != first for record in records[1:]):
        return {"state": "conflict"}
    metrics = first["benchmark"]["metrics"]
    return scored_cell(first["run_id"], metrics["task_completed_correctly"], metrics["partial_credit"],
                       first.get("duration_ms"), first["opencorvus"].get("tokens", {}).get("total"))


class Snapshot:
    def __init__(self, native_root: Path, base_root: Path, manifest: Path):
        self.native_root = native_root.resolve()
        self.base_root = base_root.resolve()
        self.manifest = manifest.resolve()
        self.cache = {}
        self.lock = threading.Lock()

    def read(self, path: Path):
        resolved = path.resolve()
        if not (resolved == self.manifest or resolved.is_relative_to(self.native_root)
                or resolved.is_relative_to(self.base_root)):
            raise SnapshotError("snapshot_path_outside_evidence")
        try:
            stat = path.stat()
        except FileNotFoundError:
            return None
        identity = (stat.st_mtime_ns, stat.st_size)
        if resolved not in self.cache or self.cache[resolved][0] != identity:
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (UnicodeError, json.JSONDecodeError) as error:
                raise SnapshotError("snapshot_file_incomplete") from error
            self.cache[resolved] = (identity, data)
        return self.cache[resolved][1]

    def build(self):
        with self.lock:
            return self._build()

    def _build(self):
        manifest = self.read(self.manifest)
        if manifest is None:
            raise SnapshotError("manifest_unavailable")
        manifest_hash = hashlib.sha256(self.manifest.read_bytes()).hexdigest()
        cases = {case["case_index"]: case for case in manifest["cases"]}
        by_identity = {(case["domain"], case["task"]): index for index, case in cases.items()}
        if len(cases) != manifest["selection"]["count"] or len(by_identity) != len(cases):
            raise SnapshotError("manifest_identity_conflict")
        rows = {index: {"index": index, "task": case["task"], "domain": case["domain"],
                        "native": {"state": "pending"}, "base": {"state": "pending"}}
                for index, case in cases.items()}
        native = defaultdict(list)
        live = native_live_outputs()
        for directory in sorted(self.native_root.glob("case-*")):
            start = self.read(directory / "run-start.json")
            if not start or start.get("case_index") not in cases:
                continue
            index = start["case_index"]
            result = self.read(directory / "result.json")
            state = {"state": "running" if str(directory.resolve()) in live else "interrupted",
                     "run_id": start["run_id"]}
            if result:
                inp = self.read(directory / "input.json")
                match = (inp is not None and inp.get("manifest_sha256") == manifest_hash
                         and result.get("run_id") == start["run_id"]
                         and result.get("case_index") == index and result.get("model") == MODEL
                         and all(inp.get("case", {}).get(key) == cases[index][key]
                                 for key in ("domain", "task", "example_id", "task_contract_sha256")))
                if result.get("status") == "scored" and result.get("replay", {}).get("passed") is True and match:
                    score = result["score"]
                    state = scored_cell(result["run_id"], score["task_completed_correctly"], score["partial_credit"],
                                        result["finished_at"] - result["started_at"], result.get("usage", {}).get("totalTokens"))
                else:
                    state = {"state": "invalid", "run_id": start["run_id"]}
            native[index].append(state)
        for index, attempts in native.items():
            accepted = [cell for cell in attempts if cell["state"] == "scored"]
            rows[index]["native"] = ({"state": "conflict"} if len(accepted) > 1
                                     else accepted[0] if accepted else attempts[-1])

        catalog = self.read(self.base_root / "evidence-catalog.json")
        if catalog is None:
            raise SnapshotError("base_catalog_unavailable")
        accepted = defaultdict(list)
        for record in catalog.get("leaderboard", []):
            bench = record.get("benchmark", {})
            index = base_record_index(record, by_identity, cases)
            system = record.get("opencorvus", {})
            if index not in cases:
                continue
            if (system.get("model") != MODEL or system.get("profile") != "base"
                    or any(bench.get(key) != cases[index][key] for key in ("domain", "task", "example_id", "task_contract_sha256"))):
                raise SnapshotError("base_case_identity_mismatch")
            accepted[index].append(record)
        for index, values in accepted.items():
            rows[index]["base"] = resolve_base_scores(values)
        for record in catalog.get("candidates", []):
            index = base_record_index(record, by_identity, cases)
            if index in rows and rows[index]["base"]["state"] == "pending":
                rows[index]["base"] = {"state": "awaiting", "run_id": record["run_id"]}
        for record in catalog.get("attempts", []):
            index = base_record_index(record, by_identity, cases)
            if index in rows and rows[index]["base"]["state"] == "pending":
                rows[index]["base"] = {"state": "invalid", "run_id": record["run_id"]}
        leases = self.read(self.base_root / ".automationbench-active-leases.json")
        if leases is None:
            raise SnapshotError("base_lease_snapshot_unavailable")
        by_task = {f"{case['domain']}:{case['task']}": index for index, case in cases.items()}
        for lease in leases.get("active", []):
            index = by_task.get(lease.get("case_id"))
            if index in rows and rows[index]["base"]["state"] in ("pending", "invalid"):
                rows[index]["base"] = {"state": base_lease_state(lease, cases[index], self.base_root),
                                       "run_id": lease["run_id"]}
        values = [rows[index] for index in sorted(rows)]
        return {"generated_at": int(time.time() * 1000), "model": MODEL,
                "manifest_sha256": manifest_hash, "rows": values,
                "native": summarize([row["native"] for row in values]),
                "base": summarize([row["base"] for row in values]), "paired": paired_summary(values)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--native-root", type=Path, required=True)
    parser.add_argument("--base-root", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    snapshot = Snapshot(args.native_root, args.base_root, args.manifest)
    page = Path(__file__).with_name("reproduction-dashboard.html").read_bytes()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            if self.headers.get("Host") not in (f"localhost:{args.port}", f"127.0.0.1:{args.port}"):
                self.send_error(403)
                return
            if self.path in ("/", "/ui"):
                payload, content_type, status = page, "text/html; charset=utf-8", 200
            elif self.path == "/api/status":
                try:
                    data, status = snapshot.build(), 200
                except (OSError, ValueError, KeyError, TypeError):
                    data, status = {"error": "snapshot_unavailable"}, 503
                payload, content_type = json.dumps(data, ensure_ascii=False).encode(), "application/json; charset=utf-8"
            else:
                self.send_error(404)
                return
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Reproduction dashboard: http://localhost:{args.port}/ui", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
