"""A real old HTTP request straddles pause, same-key recovery and resume."""
import argparse
import json
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time
import urllib.parse

import scene_app as app
from check_scene import assess
from run_scene import backup, event, save, start_receiver


def registered_sender(db, url, tenant, key):
    result = app.deliver_one(db, url, tenant, key)
    print(json.dumps(result), flush=True)


def run(inputs, output):
    output.mkdir(parents=True)
    local, remote = output / "local.sqlite", output / "remote.sqlite"
    backup(inputs / "original-local.sqlite", local)
    backup(inputs / "original-remote.sqlite", remote)
    authority = json.loads((inputs / "initial-authority.json").read_text(encoding="utf-8"))
    with app.connect(local) as c:
        pending = c.execute("SELECT * FROM postings WHERE tenant='A' AND source_kind='business' AND source_id='Z'").fetchone()
    assert pending["receipt_id"] is None
    tenant, key = pending["tenant"], pending["event_id"]
    receiver, receiver_stderr, url = start_receiver(remote, output, hold=tenant + "/" + key)
    events, notifications = [], queue.Queue()
    def capture():
        for line in receiver.stdout:
            value = json.loads(line)
            events.append(value)
            notifications.put(value)
    pump = threading.Thread(target=capture)
    pump.start()
    sender = None
    try:
        receiver.stdin.write("release\n")
        receiver.stdin.flush()
        invalid_control = notifications.get(timeout=10)
        assert invalid_control == {"status": "invalid_control", "allowed": ["release", "stop"]}
        command = [sys.executable, "-X", "utf8", str(Path(__file__).resolve()), "--sender", "--local", str(local),
                   "--url", url, "--tenant", tenant, "--key", key]
        sender = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
        held = notifications.get(timeout=10)
        assert held["status"] == "held_before_apply" and held["pid"] == receiver.pid and held["identity"] == [tenant, key]
        code, unknown = app.request(url + "/effects?" + urllib.parse.urlencode({"tenant": tenant, "event_id": key}))
        assert (code, unknown) == (404, {"status": "unknown"})
        paused = app.pause(local, 1)
        assert paused["status"] == "paused" and paused["accepted_boundary"] == 7
        with app.connect(local) as c:
            keys = [dict(r) for r in c.execute("SELECT tenant,event_id,payload FROM postings ORDER BY seq")]
            assert paused["intent_keys"] == keys
            assert dict(c.execute("SELECT * FROM control").fetchone()) == {"id": 1, "epoch": 1, "active": 0}
        denied = app.ingest(local, event("A", "paused-new", "new", 1, 1), 1)
        duplicate = app.ingest(local, event("A", "q1", "X", 1, 100), 1)
        unresolved = app.resume(local, 1)
        assert denied == {"status": "paused", "epoch": 1}
        assert app.pause(local, 1) == {"status": "already_paused", "epoch": 1}
        assert duplicate == {"status": "duplicate", "seq": 1}
        assert unresolved["status"] == "unsettled_intents" and unresolved["count"] == 2
        # The original HTTP is still physically waiting before apply. Recovery
        # obtains this very key's receipt, rather than waiting for that socket.
        app.reconcile(local, url)
        resumed = app.resume(local, 1)
        assert resumed == {"status": "resumed", "epoch": 2}
        before_release = assess(authority, inputs / "original-local.sqlite", inputs / "original-remote.sqlite", local, remote)
        assert before_release["status"] == "business_success" and before_release["accounts"] == {"A": 1015, "B": 710}
        with app.connect(remote) as c:
            receipt = dict(c.execute("SELECT * FROM effects WHERE tenant=? AND event_id=?", (tenant, key)).fetchone())
            requests_before = [dict(r) for r in c.execute("SELECT * FROM requests WHERE tenant=? AND event_id=? ORDER BY seq", (tenant, key))]
        assert [r["status"] for r in requests_before if r["method"] == "POST"] == ["applied"]
        receiver.stdin.write("release\n")
        receiver.stdin.flush()
        sender_stdout, sender_stderr = sender.communicate(timeout=20)
        assert sender.returncode == 0
        confirmed = json.loads(sender_stdout)
        assert confirmed == {"status": "confirmed", "event_id": key, "receipt": {k: receipt[k] for k in ("receipt_id", "tenant", "event_id", "kind", "amount_minor", "reverses")}}
        released, settled = notifications.get(timeout=10), notifications.get(timeout=10)
        assert released["status"] == "hold_released"
        assert settled["status"] == "held_request_settled" and settled["http_code"] == 200 and settled["response"]["status"] == "replayed"
        assert settled["response"]["receipt"] == confirmed["receipt"]
        stale = app.ingest(local, event("A", "after-resume-old", "new", 1, 1), 1)
        assert stale == {"status": "stale_epoch", "epoch": 2}
        final = assess(authority, inputs / "original-local.sqlite", inputs / "original-remote.sqlite", local, remote)
        assert final["status"] == "business_success"
        with app.connect(remote) as c:
            requests_after = [dict(r) for r in c.execute("SELECT * FROM requests WHERE tenant=? AND event_id=? ORDER BY seq", (tenant, key))]
            assert [r["status"] for r in requests_after if r["method"] == "POST"] == ["applied", "replayed"]
            assert c.execute("SELECT COUNT(*) FROM effects WHERE tenant=? AND event_id=?", (tenant, key)).fetchone()[0] == 1
        save(output / "authority.json", authority)
        save(output / "interleaving.json", {"invalid_control": invalid_control, "held": held, "unknown": unknown, "pause": paused, "new_request": denied,
             "accepted_retry": duplicate, "unresolved_resume": unresolved, "resume": resumed, "before_release": before_release,
             "old_sender": {"command": command, "pid": sender.pid, "exitcode": sender.returncode, "stdout": sender_stdout, "stderr": sender_stderr},
             "released": released, "settled": settled, "old_epoch_after_resume": stale, "requests_before": requests_before, "requests_after": requests_after})
        return final
    finally:
        # Always release the owned held request before joining receiver/client.
        if receiver.poll() is None:
            receiver.stdin.write("stop\n")
            receiver.stdin.flush()
        receiver.wait(timeout=20)
        pump.join(timeout=20)
        if pump.is_alive():
            raise RuntimeError("receiver_event_reader_unsettled")
        receiver_stderr.close()
        save(output / "receiver-events.json", events)
        save(output / "receiver-exit.json", {"pid": receiver.pid, "exitcode": receiver.returncode})
        if sender is not None and sender.poll() is None:
            stdout, stderr = sender.communicate(timeout=20)
            save(output / "sender-failure-receipt.json", {"pid": sender.pid, "exitcode": sender.returncode, "stdout": stdout, "stderr": stderr})
        if receiver.returncode != 0:
            raise RuntimeError("receiver_exit")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--sender", action="store_true")
    for name in ("input", "output", "local"):
        p.add_argument("--" + name, type=Path)
    for name in ("url", "tenant", "key"):
        p.add_argument("--" + name)
    a = p.parse_args()
    if a.sender:
        registered_sender(a.local, a.url, a.tenant, a.key)
    else:
        if a.input is None or a.output is None:
            p.error("--input and --output are required")
        start = time.perf_counter()
        result = run(a.input, a.output)
        result["elapsed_seconds"] = time.perf_counter() - start
        result["scope"] = "one controlled real before-apply HTTP crossing a sequential pause/recovery/resume; not all concurrent failures"
        save(a.output / "result.json", result)
        print(json.dumps(result), flush=True)
