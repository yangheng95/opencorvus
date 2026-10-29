"""Real local HTTP/subprocess/SQL qualification; no model or production access."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import http.client
import json
import pathlib
import queue
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request


def event(tenant, event_id, amount, reverses=None):
    return {"tenant": tenant, "event_id": event_id, "kind": "reversal" if amount < 0 else "post", "amount_minor": amount, "reverses": reverses}


def qualify(source, output):
    output.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    checks, commands, http = [], [], []
    owned = []
    server_logs = []

    def write(name, value):
        (output / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")

    def check(label, actual, expected):
        row = {"label": label, "actual": actual, "expected": expected, "passed": actual == expected}
        checks.append(row)
        write("checks.json", checks)
        if not row["passed"]:
            raise AssertionError(row)

    def line(process):
        channel = queue.Queue()
        threading.Thread(target=lambda: channel.put(process.stdout.readline()), daemon=True).start()
        raw = channel.get(timeout=15)
        return json.loads(raw)

    def start_server(db, drop=None):
        cmd = [sys.executable, "-X", "utf8", str(source / "l05_effects.py"), "--db", str(db)]
        if drop:
            cmd += ["--drop-once", drop]
        err = (output / f"server-{len(server_logs)}.stderr.txt").open("w", encoding="utf-8")
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=err, text=True, encoding="utf-8")
        owned.append(p)
        ready = line(p)
        check("server_ready_pid", ready["pid"], p.pid)
        server_logs.append({"command": cmd, "ready": ready, "process": p, "stderr_handle": err})
        return p, ready["url"]

    def stop_server(p):
        p.stdin.write("stop\n")
        p.stdin.flush()
        p.wait(timeout=15)
        check("server_normal_exit", p.returncode, 0)

    def call(url, data=None, raw=None, query=None):
        target = url + "/effects"
        if query is not None:
            target += "?" + urllib.parse.urlencode(query)
        body = raw if raw is not None else json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(target, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                result = {"code": response.status, "body": json.load(response)}
        except urllib.error.HTTPError as error:
            result = {"code": error.code, "body": json.load(error)}
        http.append({"url": target, "data": data, "raw": raw.decode("utf-8") if raw else None, "result": result})
        return result

    def rows(db, sql, args=()):
        with closing(sqlite3.connect(db)) as connection:
            return [list(row) for row in connection.execute(sql, args)]

    def worker(db, *args, probe=False):
        cmd = [sys.executable, "-X", "utf8", str(source / "l05_worker.py"), "--db", str(db), *args]
        if probe:
            cmd += ["--probe"]
            p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
            owned.append(p)
            checkpoint = line(p)
            commands.append({"command": cmd, "pid": p.pid, "checkpoint": checkpoint})
            return p, checkpoint
        before = time.perf_counter()
        completed = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=20)
        commands.append({"command": cmd, "returncode": completed.returncode, "stdout": completed.stdout, "stderr": completed.stderr, "seconds": time.perf_counter() - before})
        if completed.returncode:
            raise AssertionError(commands[-1])
        return json.loads(completed.stdout)

    try:
        remote, local = output / "remote.sqlite", output / "business.sqlite"
        a, b, reversal = event("A", "E1", 100), event("B", "E1", 200), event("A", "R1", -30, "E1")
        p, url = start_server(remote, "A/E1")
        check("local_accept_A", worker(local, "ingest", "--event", json.dumps(a))["status"], "accepted")
        args = ("drain", "--url", url, "--tenant", "A", "--event-id", "E1")
        unknown = worker(local, *args)
        check("first_post_lost_response", unknown["status"], "transport_unknown")
        check("remote_commit_and_fault_consumed", rows(remote, "SELECT e.amount_minor,r.status,r.dropped,d.consumed FROM effects e JOIN requests r USING(tenant,event_id) JOIN drop_once d USING(tenant,event_id) WHERE r.method='POST'"), [[100, "applied", 1, 1]])
        check("local_pending_after_unknown", rows(local, "SELECT amount_minor,receipt_id FROM entries JOIN outbox USING(tenant,event_id)"), [[100, None]])
        crash, point = worker(local, *args, probe=True)
        check("worker_checkpoint_pid", point["pid"], crash.pid)
        check("worker_checkpoint_stage", point["stage"], "after_remote_receipt_before_local_commit")
        original_receipt = point["receipt"]
        check("receipt_matches_remote_commit", rows(remote, "SELECT receipt_id FROM effects WHERE tenant='A' AND event_id='E1'"), [[original_receipt["receipt_id"]]])
        crash.kill()
        stdout, stderr = crash.communicate(timeout=15)
        commands.append({"action": "terminate_owned_checkpoint_process", "pid": crash.pid, "returncode": crash.returncode, "stdout": stdout, "stderr": stderr})
        check("pending_after_worker_exit", rows(local, "SELECT receipt_id FROM outbox WHERE tenant='A' AND event_id='E1'"), [[None]])
        stop_server(p)
        p, url = start_server(remote, "A/E1")
        check("query_receipt_after_server_restart", call(url, query={"tenant": "A", "event_id": "E1"})["body"], {"status": "found", "receipt": original_receipt})
        check("same_key_post_after_server_restart", call(url, a), {"code": 200, "body": {"status": "replayed", "receipt": original_receipt}})
        check("confirmed_after_restart", worker(local, "drain", "--url", url, "--tenant", "A", "--event-id", "E1")["receipt"], original_receipt)
        for accepted in (b, reversal):
            check("local_accept_" + accepted["tenant"] + accepted["event_id"], worker(local, "ingest", "--event", json.dumps(accepted))["status"], "accepted")
        with ThreadPoolExecutor(max_workers=8) as executor:
            posts = list(executor.map(lambda _: call(url, b), range(8)))
        check("parallel_post_states", sorted(item["body"]["status"] for item in posts), ["applied"] + ["replayed"] * 7)
        check("parallel_receipt_identity", len({item["body"]["receipt"]["receipt_id"] for item in posts}), 1)
        with ThreadPoolExecutor(max_workers=6) as executor:
            recovered = list(executor.map(lambda i: worker(local, "drain", "--url", url, "--tenant", "B" if i % 2 else "A", "--event-id", "E1" if i % 2 else "R1"), range(6)))
        check("all_recovered", [item["status"] for item in recovered], ["confirmed"] * 6)
        write("accepted-events.json", [a, b, reversal])
        check("core_remote_individual_effects", rows(remote, "SELECT tenant,event_id,amount_minor FROM effects ORDER BY tenant,event_id"), [["A", "E1", 100], ["A", "R1", -30], ["B", "E1", 200]])
        check("core_local_individual_effects", rows(local, "SELECT tenant,event_id,amount_minor FROM entries ORDER BY tenant,event_id"), [["A", "E1", 100], ["A", "R1", -30], ["B", "E1", 200]])
        check("core_receipt_bindings", rows(local, "SELECT tenant,event_id,receipt_id FROM outbox ORDER BY tenant,event_id"), rows(remote, "SELECT tenant,event_id,receipt_id FROM effects ORDER BY tenant,event_id"))
        conflict = call(url, event("A", "E1", 101))
        check("same_key_payload_conflict", [conflict["code"], conflict["body"]["status"]], [409, "idempotency_conflict"])
        late = event("T", "R", -5, "P")
        check("dependency_pending", call(url, late), {"code": 409, "body": {"status": "dependency_pending"}})
        check("dependency_arrival", call(url, event("T", "P", 5))["body"]["status"], "applied")
        full = call(url, late)
        check("same_key_after_dependency", full["body"]["status"], "applied")
        check("full_reversal_replay", call(url, late), {"code": 200, "body": {"status": "replayed", "receipt": full["body"]["receipt"]}})
        check("concurrency_parent", call(url, event("X", "P", 100))["body"]["status"], "applied")
        with ThreadPoolExecutor(max_workers=2) as executor:
            over = list(executor.map(lambda key: call(url, event("X", key, -60, "P")), ["R1", "R2"]))
        check("serialized_over_reversal", sorted(item["body"]["status"] for item in over), ["applied", "reversal_exceeds_original"])
        check("concurrent_actual_effects", rows(remote, "SELECT amount_minor FROM effects WHERE tenant='X' ORDER BY kind"), [[100], [-60]])
        for label, malformed in [("bool_amount", {**a, "amount_minor": True}), ("empty_identity", {**a, "event_id": ""}), ("post_parent", {**a, "reverses": "E1"}), ("extra_field", {**a, "extra": 1})]:
            result = call(url, malformed)
            check(label, [result["code"], result["body"]["status"]], [422, "invalid_request"])
        duplicate = call(url, raw=b'{"tenant":"A","tenant":"B"}')
        check("duplicate_json_key", duplicate, {"code": 422, "body": {"status": "invalid_request", "field": "duplicate_json_key"}})
        p2, url2 = start_server(output / "isolated.sqlite")
        check("independent_instance_same_identity", call(url2, event("A", "E1", 101))["body"]["status"], "applied")
        check("original_instance_payload", call(url, query={"tenant": "A", "event_id": "E1"})["body"]["receipt"], original_receipt)
        stop_server(p2)
        stop_server(p)
        result = {"status": "passed", "scope": "local_protocol_qualification_only", "seconds": time.perf_counter() - started, "checks": len(checks), "candidate_score": None, "full_L05_frozen": False}
    except BaseException as error:
        result = {"status": "failed", "error_type": type(error).__name__, "error": str(error), "seconds": time.perf_counter() - started, "checks": len(checks)}
        raise
    finally:
        for process in owned:
            if process.poll() is None:
                process.kill()
                process.communicate(timeout=15)
        for item in server_logs:
            item["stderr_handle"].close()
        write("commands.json", commands)
        write("http.json", http)
        write("servers.json", [{"command": item["command"], "ready": item["ready"], "returncode": item["process"].returncode} for item in server_logs])
        write("receipt.json", result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=pathlib.Path, required=True)
    parser.add_argument("--out", type=pathlib.Path, required=True)
    args = parser.parse_args()
    print(json.dumps(qualify(args.source.resolve(), args.out.resolve())), flush=True)
