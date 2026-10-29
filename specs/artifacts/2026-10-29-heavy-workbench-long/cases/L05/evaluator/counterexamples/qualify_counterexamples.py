"""Execute wrong controls through the same real receiver and readonly checker."""
import argparse
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


def run(source, out, events):
    out.mkdir(parents=True, exist_ok=False)
    receipts, commands, owned, logs = [], [], [], []
    started = time.perf_counter()

    def command(cmd):
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=20)
        commands.append({"command": cmd, "exitcode": result.returncode, "stdout": result.stdout, "stderr": result.stderr})
        return result

    def start(cmd, stderr):
        handle = stderr.open("w", encoding="utf-8")
        logs.append(handle)
        process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=handle, text=True, encoding="utf-8")
        owned.append(process)
        channel = queue.Queue()
        threading.Thread(target=lambda: channel.put(process.stdout.readline()), daemon=True).start()
        ready = json.loads(channel.get(timeout=15))
        commands.append({"command": cmd, "pid": process.pid, "first_line": ready})
        if ready["pid"] != process.pid:
            raise AssertionError("owned_pid_binding")
        return process, ready

    py = [sys.executable, "-X", "utf8"]
    try:
        for fault in ("global_event_id", "early_sent"):
            root = out / fault
            root.mkdir()
            local, remote = root / "business.sqlite", root / "remote.sqlite"
            server, ready = start(py + [str(source / "l05_effects.py"), "--db", str(remote)], root / "server.stderr.txt")
            url = ready["url"]
            bad_cmd = py + [str(source / "bad_worker.py"), "--db", str(local), "--events", str(events), "--fault", fault]
            if fault == "global_event_id":
                bad = command(bad_cmd)
                if bad.returncode != 0:
                    raise AssertionError("wrong_control_did_not_execute")
                for event_id in ("E1", "R1"):
                    delivery = command(py + [str(source / "l05_worker.py"), "--db", str(local), "drain", "--url", url, "--tenant", "A", "--event-id", event_id])
                    if delivery.returncode or json.loads(delivery.stdout)["status"] != "confirmed":
                        raise AssertionError("control_delivery_failed")
            else:
                bad, point = start(bad_cmd, root / "bad.stderr.txt")
                if point["stage"] != "early_confirm_before_remote_request":
                    raise AssertionError("wrong_stage")
                with sqlite3.connect(local) as connection:
                    state = connection.execute("SELECT tenant,event_id,receipt_id FROM outbox ORDER BY tenant,event_id").fetchall()
                commands.append({"observed_before_termination": state})
                bad.kill()
                stdout, stderr = bad.communicate(timeout=15)
                commands.append({"action": "terminate_owned_bad_control", "pid": bad.pid, "exitcode": bad.returncode, "stdout": stdout, "stderr": stderr})
                resumed = command(bad_cmd + ["--resume"])
                if resumed.returncode or json.loads(resumed.stdout)["status"] != "already_sent":
                    raise AssertionError("wrong_control_resume_failed")
                query = url + "/effects?" + urllib.parse.urlencode({"tenant": "A", "event_id": "E1"})
                try:
                    urllib.request.urlopen(query, timeout=15)
                    raise AssertionError("expected_known_unknown_response")
                except urllib.error.HTTPError as error:
                    observed = {"code": error.code, "body": json.load(error)}
                commands.append({"query": query, "actual_response": observed})
                if observed != {"code": 404, "body": {"status": "unknown"}}:
                    raise AssertionError(observed)
            scored = command(py + [str(source / "check_l05_state.py"), "--events", str(events), "--local", str(local), "--remote", str(remote), "--out", str(root / "assessment.json")])
            assessment = json.loads(scored.stdout)
            if scored.returncode != 2 or assessment["status"] != "business_mismatch":
                raise AssertionError("checker_contract")
            expected_findings = [{"identity": ["B", "E1"], "error": "local_entry_missing"}, {"identity": ["B", "E1"], "error": "remote_effect_missing"}] if fault == "global_event_id" else [{"identity": key, "error": "remote_effect_missing"} for key in [["A", "E1"], ["A", "R1"], ["B", "E1"]]]
            if assessment["findings"] != expected_findings:
                raise AssertionError(assessment)
            receipts.append({"fault": fault, "actual_assessment": assessment, "positive_error_contract": "passed"})
            server.stdin.write("stop\n")
            server.stdin.flush()
            server.wait(timeout=15)
            if server.returncode != 0:
                raise AssertionError("server_exit")
    finally:
        for process in owned:
            if process.poll() is None:
                process.kill()
                process.communicate(timeout=15)
        for handle in logs:
            handle.close()
        (out / "commands.json").write_text(json.dumps(commands, indent=2), encoding="utf-8")
        (out / "receipt.json").write_text(json.dumps({"controls": receipts, "seconds": time.perf_counter() - started, "scope": "two_real_wrong_controls_only", "candidate_score": None}, indent=2), encoding="utf-8")
    return receipts


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=pathlib.Path, required=True)
    parser.add_argument("--events", type=pathlib.Path, required=True)
    parser.add_argument("--out", type=pathlib.Path, required=True)
    args = parser.parse_args()
    print(json.dumps(run(args.source.resolve(), args.out.resolve(), args.events.resolve())), flush=True)
