"""Source-only replay of an existing accident snapshot, plus named real error controls."""
import argparse
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import time
import uuid
from contextlib import closing

import scene_app as app
from check_scene import assess, capture_authority


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def backup(source, target):
    with closing(sqlite3.connect(source)) as src, closing(sqlite3.connect(target)) as dst:
        src.backup(dst)


def start_receiver(db, output, drop=None):
    source = Path(__file__).resolve().parents[2] / "public/l05_effects.py"
    command = [sys.executable, "-X", "utf8", str(source), "--db", str(db)]
    if drop:
        command += ["--drop-once", drop]
    stderr = (output / "receiver.stderr.txt").open("w", encoding="utf-8")
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=stderr, text=True, encoding="utf-8")
    line = process.stdout.readline()
    ready = json.loads(line)
    if ready["status"] != "ready" or ready["pid"] != process.pid:
        raise ValueError("receiver_startup_identity")
    save(output / "receiver-start.json", {"command": command, "ready": ready})
    return process, stderr, ready["url"]


def stop_receiver(process, stderr, output):
    process.stdin.write("stop\n")
    process.stdin.flush()
    stdout, _ = process.communicate(timeout=20)
    stderr.close()
    save(output / "receiver-exit.json", {"pid": process.pid, "exitcode": process.returncode, "stdout": stdout})
    if process.returncode != 0:
        raise ValueError("receiver_exit")


def event(tenant, request_id, business, revision, amount, kind="settle"):
    return {"tenant": tenant, "request_id": request_id, "event_id": business,
            "revision": revision, "kind": kind, "amount_minor": amount}


def make_input(output):
    output.mkdir(parents=True)
    local, remote = output / "original-local.sqlite", output / "original-remote.sqlite"
    app.initialize(local)
    opening_a = app.add_opening(local, "A", 1000)
    opening_b = app.add_opening(local, "B", 500)
    assert app.add_adjustment(local, "A", "approved-1", -25, "approval-A1", 1)["status"] == "approved"
    assert app.add_adjustment(local, "B", "approved-1", 10, "approval-B1", 1)["status"] == "approved"
    with app.connect(local) as c:
        c.execute("INSERT INTO notes VALUES('A','original-note',?)", ("核对原收据\u0000保留原文",))
    events = [event("A", "q1", "X", 1, 100), event("B", "q2", "X", 1, 200),
              event("A", "q3", "X", 2, 120), event("A", "q4", "X", 2, 90),
              event("B", "q5", "Y", 1, 70), event("B", "q6", "Y", 2, 0, "cancel"),
              event("A", "q7", "Z", 1, 40)]
    acks = [app.ingest(local, e, 1, legacy_fixture=True) for e in events]
    assert all(r["status"] == "accepted" for r in acks)
    with app.connect(local) as c:
        keys = {(r["tenant"], r["source_id"]): r["event_id"] for r in c.execute("SELECT * FROM postings")}
    process, stderr, url = start_receiver(remote, output, "A/" + keys["A", "X"])
    try:
        deliveries = [app.deliver_one(local, url, "A", opening_a), app.deliver_one(local, url, "B", opening_b),
                      app.deliver_one(local, url, "A", keys["A", "X"]), app.deliver_one(local, url, "B", keys["B", "Y"])]
        assert [r["status"] for r in deliveries] == ["confirmed", "confirmed", "transport_unknown", "confirmed"]
        save(output / "legacy-delivery.json", {"events": events, "acks": acks, "deliveries": deliveries,
             "accepted_undelivered": {"tenant": "A", "event_id": keys["A", "Z"]}})
    finally:
        stop_receiver(process, stderr, output)
    save(output / "initial-authority.json", capture_authority(local))
    future = [event("A", "q8", "X", 3, 110), event("A", "q9", "X", 4, 140), event("A", "q10", "X", 5, 110),
              event("A", "q11", "X", 1, 100), event("B", "q12", "X", 2, 0, "cancel"), event("A", "q13", "Z", 2, 50)]
    save(output / "future-events.json", future)
    return {"status": "original_scene_created_by_real_http", "accepted": len(events), "original_remote_effects": 4}


def first_at_highest(c):
    """Deliberately wrong business implementation, used only as a named control."""
    result = {}
    for r in c.execute("SELECT * FROM journal ORDER BY revision DESC,seq"):
        result.setdefault((r["tenant"], r["event_id"]), (r["revision"], r["kind"], r["amount_minor"]))
    return result


def replay(inputs, output, policy, style, control):
    output.mkdir(parents=True)
    local, remote = output / "local.sqlite", output / "remote.sqlite"
    backup(inputs / "original-local.sqlite", local)
    backup(inputs / "original-remote.sqlite", remote)
    process, stderr, url = start_receiver(remote, output)
    initial = json.loads((inputs / "initial-authority.json").read_text(encoding="utf-8"))
    original_fold = app.fold
    try:
        if control == "conflict_first":
            app.fold = first_at_highest
        if control == "ack_new_key":
            with app.connect(local) as c:
                old = c.execute("SELECT * FROM postings WHERE tenant='A' AND source_kind='business' AND source_id='X'").fetchone()
            wire = json.loads(old["payload"])
            wire["event_id"] = "wrong" + uuid.uuid4().hex
            code, result = app.request(url + "/effects", wire)
            save(output / "wrong-new-key-http.json", {"wire": wire, "http_code": code, "result": result})
            assert result["status"] == "applied"
            with app.connect(local) as c:
                c.execute("UPDATE postings SET receipt_id=? WHERE tenant=? AND event_id=?", (result["receipt"]["receipt_id"], old["tenant"], old["event_id"]))
        resumed = app.repair(local, url, parent_policy=policy)
        assert resumed == {"status": "resumed", "epoch": 2}
        initial_grade = assess(initial, inputs / "original-local.sqlite", inputs / "original-remote.sqlite", local, remote)
        save(output / "initial-grade.json", initial_grade)
        if control in ("conflict_first", "ack_new_key"):
            save(output / "authority.json", initial)
            return initial_grade
        if initial_grade["status"] != "business_success":
            return initial_grade
        future = json.loads((inputs / "future-events.json").read_text(encoding="utf-8"))
        probes = {"old_new_request": app.ingest(local, event("A", "old-unaccepted", "unaccepted", 1, 1), 1),
                  "old_accepted_retry": app.ingest(local, event("A", "q1", "X", 1, 100), 1),
                  "same_transport_different_payload": app.ingest(local, event("A", "q1", "X", 1, 101), 2),
                  "invalid_revision": app.ingest(local, event("A", "invalid", "X", True, 1), 2),
                  "funding_domain": app.add_adjustment(local, "A", "overfunded", -1000, "approval-invalid", 2)}
        assert [r["status"] for r in probes.values()] == ["stale_epoch", "duplicate", "transport_conflict", "invalid_request", "adjustment_out_of_domain"]
        save(output / "protocol-probes.json", probes)
        accepted = []
        for e in future:
            result = app.ingest(local, e, 2)
            assert result["status"] == "accepted"
            accepted.append({"event": e, "result": result})
            if style == "incremental":
                app.reconcile(local, url, parent_policy=policy)
        adjustment = app.add_adjustment(local, "A", "approved-2", -5, "approval-A2", 2)
        assert adjustment["status"] == "approved"
        with app.connect(local) as c:
            c.execute("INSERT INTO notes VALUES('B','new-note','After repair: retain evidence')")
        # Reconstruct injection authority from evaluator-issued payloads and actual ACKs,
        # rather than trusting a post-repair candidate database to define its own expected facts.
        authority = json.loads(json.dumps(initial))
        authority["journal"].extend({"seq": item["result"]["seq"], **item["event"], "payload": app.canonical(item["event"])} for item in accepted)
        authority["adjustments"].append({"tenant": "A", "adjustment_id": "approved-2", "amount_minor": -5, "approval": "approval-A2"})
        authority["notes"].append({"tenant": "B", "note_id": "new-note", "body": "After repair: retain evidence"})
        save(output / "accepted-injections.json", {"accepted": accepted, "adjustment": adjustment})
        save(output / "authority.json", authority)
        app.reconcile(local, url, parent_policy=policy)
        if control == "restore_backup":
            backup(inputs / "original-local.sqlite", local)
        grade = assess(authority, inputs / "original-local.sqlite", inputs / "original-remote.sqlite", local, remote)
        return grade
    finally:
        app.fold = original_fold
        stop_receiver(process, stderr, output)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--prepare", action="store_true")
    p.add_argument("--policy", choices=("oldest", "newest"), default="oldest")
    p.add_argument("--style", choices=("deferred", "incremental"), default="deferred")
    p.add_argument("--control", choices=("correct", "conflict_first", "ack_new_key", "restore_backup"), default="correct")
    a = p.parse_args()
    started = time.perf_counter()
    if a.prepare:
        result = make_input(a.output)
    else:
        if a.input is None:
            p.error("--input is required for source-only replay")
        result = replay(a.input, a.output, a.policy, a.style, a.control)
    result["elapsed_seconds"] = time.perf_counter() - started
    save(a.output / "result.json", result)
    print(json.dumps(result, ensure_ascii=False), flush=True)
    raise SystemExit(0 if result["status"] in ("business_success", "original_scene_created_by_real_http") else 2)


if __name__ == "__main__":
    main()
