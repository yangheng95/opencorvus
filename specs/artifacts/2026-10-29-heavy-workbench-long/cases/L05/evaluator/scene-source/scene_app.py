"""Constructive scene witness. Legacy entry is a fixture producer, not a fallback."""
import json
import http.client
from pathlib import Path
import sqlite3
import sys
import urllib.parse
import uuid
from contextlib import contextmanager

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "current-source"))
from l05_worker import request
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "public"))
from l05_effects import identity, decode as decode_wire, Invalid


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


@contextmanager
def connect(db):
    c = sqlite3.connect(db, timeout=20, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA synchronous=FULL")
    try:
        yield c
    finally:
        c.close()


def initialize(db):
    with connect(db) as c:
        c.executescript("""
        CREATE TABLE control(id INTEGER PRIMARY KEY CHECK(id=1), epoch INTEGER NOT NULL, active INTEGER NOT NULL);
        INSERT INTO control VALUES(1,1,1);
        CREATE TABLE journal(seq INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT NOT NULL, request_id TEXT NOT NULL,
          event_id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, amount_minor INTEGER NOT NULL,
          payload TEXT NOT NULL, UNIQUE(tenant,request_id));
        CREATE TABLE opening(tenant TEXT NOT NULL PRIMARY KEY, amount_minor INTEGER NOT NULL);
        CREATE TABLE adjustments(tenant TEXT NOT NULL, adjustment_id TEXT NOT NULL, amount_minor INTEGER NOT NULL,
          approval TEXT NOT NULL, PRIMARY KEY(tenant,adjustment_id));
        CREATE TABLE notes(tenant TEXT NOT NULL, note_id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(tenant,note_id));
        CREATE TABLE projection(tenant TEXT NOT NULL,event_id TEXT NOT NULL,revision INTEGER NOT NULL,
          status TEXT NOT NULL,amount_minor INTEGER NOT NULL,PRIMARY KEY(tenant,event_id));
        CREATE TABLE legacy_seen(event_id TEXT NOT NULL PRIMARY KEY);
        CREATE TABLE postings(seq INTEGER PRIMARY KEY AUTOINCREMENT,tenant TEXT NOT NULL,event_id TEXT NOT NULL,
          payload TEXT NOT NULL,source_kind TEXT NOT NULL,source_id TEXT NOT NULL,boundary_seq INTEGER NOT NULL,
          epoch INTEGER NOT NULL,receipt_id TEXT,UNIQUE(tenant,event_id));
        """)


def validate_event(e):
    if not isinstance(e, dict) or set(e) != {"tenant", "request_id", "event_id", "revision", "kind", "amount_minor"}:
        return "fields"
    for key in ("tenant", "request_id", "event_id"):
        if not identity(e[key]):
            return key
    if type(e["revision"]) is not int or not 1 <= e["revision"] <= 10**6:
        return "revision"
    if type(e["amount_minor"]) is not int or not 0 <= e["amount_minor"] <= 10**9:
        return "amount_minor"
    if e["kind"] not in ("settle", "cancel") or (e["kind"] == "cancel" and e["amount_minor"] != 0):
        return "kind"


def control_error(c, epoch):
    row = c.execute("SELECT epoch,active FROM control WHERE id=1").fetchone()
    if type(epoch) is not int or epoch != row["epoch"]:
        return {"status": "stale_epoch", "epoch": row["epoch"]}
    if row["active"] != 1:
        return {"status": "paused", "epoch": row["epoch"]}


def append_posting(c, tenant, source_kind, source_id, amount, parent=None):
    if amount == 0:
        raise ValueError("zero_posting")
    key = "p" + uuid.uuid4().hex
    wire = {"tenant": tenant, "event_id": key, "kind": "post" if amount > 0 else "reversal",
            "amount_minor": amount, "reverses": parent}
    boundary = c.execute("SELECT COALESCE(MAX(seq),0) FROM journal").fetchone()[0]
    epoch = c.execute("SELECT epoch FROM control WHERE id=1").fetchone()[0]
    c.execute("INSERT INTO postings(tenant,event_id,payload,source_kind,source_id,boundary_seq,epoch) VALUES(?,?,?,?,?,?,?)",
              (tenant, key, canonical(wire), source_kind, source_id, boundary, epoch))
    return key


def fold(c):
    """Reference implementation; checker uses a separate relational reconstruction."""
    versions = {}
    for row in c.execute("SELECT tenant,event_id,revision,kind,amount_minor FROM journal"):
        key = row["tenant"], row["event_id"]
        revs = versions.setdefault(key, {})
        revs.setdefault(row["revision"], set()).add((row["kind"], row["amount_minor"]))
    result = {}
    for key, versions_for_key in versions.items():
        revision = max(versions_for_key)
        payloads = versions_for_key[revision]
        if len(payloads) != 1:
            result[key] = (revision, "quarantined", 0)
        else:
            kind, amount = next(iter(payloads))
            result[key] = (revision, kind, amount)
    return result


def replace_projection(c):
    values = fold(c)
    c.execute("DELETE FROM projection")
    c.executemany("INSERT INTO projection VALUES(?,?,?,?,?)", [(t, e, *v) for (t, e), v in values.items()])


def ingest(db, e, epoch, *, legacy_fixture=False):
    error = validate_event(e)
    if error:
        return {"status": "invalid_request", "field": error}
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        old = c.execute("SELECT seq,payload FROM journal WHERE tenant=? AND request_id=?", (e["tenant"], e["request_id"])).fetchone()
        if old:
            return {"status": "duplicate" if old["payload"] == canonical(e) else "transport_conflict", "seq": old["seq"]}
        error = control_error(c, epoch)
        if error:
            return error
        if c.execute("SELECT tenant FROM opening WHERE tenant=?", (e["tenant"],)).fetchone() is None:
            return {"status": "unknown_tenant"}
        seq = c.execute("INSERT INTO journal(tenant,request_id,event_id,revision,kind,amount_minor,payload) VALUES(?,?,?,?,?,?,?)",
                        (e["tenant"], e["request_id"], e["event_id"], e["revision"], e["kind"], e["amount_minor"], canonical(e))).lastrowid
        if legacy_fixture:
            # Actual historical behavior intentionally retained as scene input.
            seen = c.execute("SELECT event_id FROM legacy_seen WHERE event_id=?", (e["event_id"],)).fetchone()
            if seen is None:
                c.execute("INSERT INTO legacy_seen VALUES(?)", (e["event_id"],))
                c.execute("INSERT INTO projection VALUES(?,?,?,?,?)", (e["tenant"], e["event_id"], e["revision"], e["kind"], e["amount_minor"]))
                if e["amount_minor"]:
                    append_posting(c, e["tenant"], "business", e["event_id"], e["amount_minor"])
        else:
            replace_projection(c)
        c.commit()
    return {"status": "accepted", "seq": seq}


def add_opening(db, tenant, amount):
    if not identity(tenant) or type(amount) is not int or not 1 <= amount <= 10**9:
        raise ValueError("opening_amount")
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        c.execute("INSERT INTO opening VALUES(?,?)", (tenant, amount))
        key = append_posting(c, tenant, "opening", "opening", amount)
        c.commit()
        return key


def add_adjustment(db, tenant, adjustment_id, amount, approval, epoch):
    if not identity(tenant) or not identity(adjustment_id) or type(amount) is not int or not -10**9 <= amount <= 10**9 or not isinstance(approval, str) or not approval:
        return {"status": "invalid_adjustment"}
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        old = c.execute("SELECT amount_minor,approval FROM adjustments WHERE tenant=? AND adjustment_id=?", (tenant, adjustment_id)).fetchone()
        if old:
            return {"status": "duplicate" if tuple(old) == (amount, approval) else "adjustment_conflict"}
        error = control_error(c, epoch)
        if error:
            return error
        opening = c.execute("SELECT amount_minor FROM opening WHERE tenant=?", (tenant,)).fetchone()
        negative = sum(r[0] for r in c.execute("SELECT amount_minor FROM adjustments WHERE tenant=? AND amount_minor<0", (tenant,)))
        if opening is None or opening[0] + negative + min(0, amount) < 0:
            return {"status": "adjustment_out_of_domain"}
        c.execute("INSERT INTO adjustments VALUES(?,?,?,?)", (tenant, adjustment_id, amount, approval))
        c.commit()
    return {"status": "approved"}


def deliver_one(db, url, tenant, key):
    with connect(db) as c:
        row = c.execute("SELECT * FROM postings WHERE tenant=? AND event_id=?", (tenant, key)).fetchone()
        try:
            wire = decode_wire(row["payload"])
        except Invalid as error:
            raise ValueError("local_posting_wire_invalid:" + str(error)) from error
        if wire["tenant"] != tenant or wire["event_id"] != key:
            raise ValueError("local_posting_identity_mismatch")
    try:
        code, result = request(url + "/effects?" + urllib.parse.urlencode({"tenant": wire["tenant"], "event_id": key}))
        if code == 404 and result["status"] == "unknown":
            code, result = request(url + "/effects", wire)
    except (OSError, ConnectionError, http.client.RemoteDisconnected):
        return {"status": "transport_unknown", "event_id": key}
    if result.get("status") not in ("applied", "replayed", "found"):
        raise ValueError("remote_rejected:" + canonical(result))
    receipt = result["receipt"]
    if not receipt.get("receipt_id") or any(receipt.get(k) != v for k, v in wire.items()):
        raise ValueError("receipt_conflict")
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        c.execute("UPDATE postings SET receipt_id=? WHERE tenant=? AND event_id=?", (receipt["receipt_id"], wire["tenant"], key))
        c.commit()
    return {"status": "confirmed", "event_id": key, "receipt": receipt}


def settle_all(db, url):
    with connect(db) as c:
        keys = [tuple(r) for r in c.execute("SELECT tenant,event_id FROM postings ORDER BY seq")]
    for tenant, key in keys:
        result = deliver_one(db, url, tenant, key)
        if result["status"] != "confirmed":
            raise ValueError("old_intent_unresolved:" + key)


def targets(c):
    result = {(r["tenant"], "opening", "opening"): r["amount_minor"] for r in c.execute("SELECT * FROM opening")}
    result.update({(t, "business", e): v[2] for (t, e), v in fold(c).items()})
    result.update({(r["tenant"], "adjustment", r["adjustment_id"]): r["amount_minor"] for r in c.execute("SELECT * FROM adjustments")})
    return result


def reconcile(db, url, *, parent_policy="oldest"):
    settle_all(db, url)
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        desired, contributed, wires = targets(c), {}, []
        for row in c.execute("SELECT * FROM postings ORDER BY seq"):
            wire = json.loads(row["payload"])
            source = row["tenant"], row["source_kind"], row["source_id"]
            contributed[source] = contributed.get(source, 0) + wire["amount_minor"]
            wires.append(wire)
        deltas = {k: desired.get(k, 0) - contributed.get(k, 0) for k in desired.keys() | contributed.keys()}
        for (tenant, kind, identity), difference in sorted(deltas.items()):
            if difference > 0:
                remaining = difference
                while remaining:
                    piece = min(remaining, 10**12)
                    key = append_posting(c, tenant, kind, identity, piece)
                    wires.append({"tenant": tenant, "event_id": key, "amount_minor": piece, "kind": "post", "reverses": None})
                    remaining -= piece
        residual = {(w["tenant"], w["event_id"]): w["amount_minor"] for w in wires if w["kind"] == "post"}
        for w in wires:
            if w["kind"] == "reversal":
                residual[w["tenant"], w["reverses"]] += w["amount_minor"]
        parents = list(residual)
        if parent_policy == "newest":
            parents.reverse()
        elif parent_policy != "oldest":
            raise ValueError("parent_policy")
        for (tenant, kind, identity), difference in sorted(deltas.items()):
            remaining = max(0, -difference)
            for parent in parents:
                if parent[0] != tenant or remaining == 0:
                    continue
                piece = min(remaining, residual[parent])
                if piece:
                    append_posting(c, tenant, kind, identity, -piece, parent[1])
                    residual[parent] -= piece
                    remaining -= piece
            if remaining:
                raise ValueError("unreachable_account_domain")
        replace_projection(c)
        c.commit()
    settle_all(db, url)


def repair(db, url, *, parent_policy="oldest"):
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        c.execute("UPDATE control SET active=0 WHERE id=1")
        c.commit()
    reconcile(db, url, parent_policy=parent_policy)
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        c.execute("UPDATE control SET active=1,epoch=epoch+1 WHERE id=1")
        epoch = c.execute("SELECT epoch FROM control WHERE id=1").fetchone()[0]
        c.commit()
    return {"status": "resumed", "epoch": epoch}
