"""Independent relational reconstruction for this author's scene schema, not a full candidate grader."""
import argparse
from collections import Counter
import json
from pathlib import Path
import sqlite3
import sys
from contextlib import closing

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "public"))
from l05_effects import decode as decode_wire, Invalid


def read(db, table):
    with closing(sqlite3.connect(Path(db).resolve().as_uri() + "?mode=ro", uri=True)) as c:
        c.row_factory = sqlite3.Row
        return [dict(r) for r in c.execute("SELECT * FROM " + table)]


def business_target(journal):
    # No import of scene_app.fold. Group accepted facts by highest revision in SQL.
    with closing(sqlite3.connect(":memory:")) as c:
        c.execute("CREATE TABLE j(tenant TEXT,event_id TEXT,revision INTEGER,kind TEXT,amount INTEGER)")
        c.executemany("INSERT INTO j VALUES(?,?,?,?,?)", [(r["tenant"], r["event_id"], r["revision"], r["kind"], r["amount_minor"]) for r in journal])
        rows = c.execute("""
          WITH maxrev AS (SELECT tenant,event_id,MAX(revision) rev FROM j GROUP BY tenant,event_id),
          payloads AS (SELECT DISTINCT j.tenant,j.event_id,j.revision,j.kind,j.amount FROM j JOIN maxrev m
             ON j.tenant=m.tenant AND j.event_id=m.event_id AND j.revision=m.rev)
          SELECT tenant,event_id,revision,COUNT(*) n,MIN(kind),MIN(amount)
          FROM payloads GROUP BY tenant,event_id,revision ORDER BY tenant,event_id
        """).fetchall()
    return {(t, e): (rev, kind if count == 1 else "quarantined", amount if count == 1 else 0)
            for t, e, rev, count, kind, amount in rows}


def capture_authority(db):
    return {table: read(db, table) for table in ("journal", "opening", "adjustments", "notes")}


def assess(authority, original_local, original_remote, local, remote):
    findings = []
    def finding(error, **details):
        findings.append({"error": error, **details})
    for table, keys in (("journal", ("tenant", "request_id")), ("opening", ("tenant",)),
                        ("adjustments", ("tenant", "adjustment_id")), ("notes", ("tenant", "note_id"))):
        actual = read(local, table)
        counts = Counter(tuple(r[k] for k in keys) for r in actual)
        expected = {tuple(r[k] for k in keys): r for r in authority[table]}
        if len(expected) != len(authority[table]):
            return {"status": "run_invalid", "error": "authority_duplicate", "table": table}
        actual_map = {tuple(r[k] for k in keys): r for r in actual}
        for key in expected.keys() | actual_map.keys():
            if counts.get(key) != 1 or expected.get(key) != actual_map.get(key):
                finding("accepted_fact_mismatch", table=table, identity=list(key))
    target = business_target(authority["journal"])
    projected = {(r["tenant"], r["event_id"]): (r["revision"], r["status"], r["amount_minor"]) for r in read(local, "projection")}
    for key in target.keys() | projected.keys():
        if projected.get(key) != target.get(key):
            finding("business_projection_mismatch", identity=list(key), expected=target.get(key), actual=projected.get(key))
    desired = {(r["tenant"], "opening", "opening"): r["amount_minor"] for r in authority["opening"]}
    desired.update({(t, "business", e): v[2] for (t, e), v in target.items()})
    desired.update({(r["tenant"], "adjustment", r["adjustment_id"]): r["amount_minor"] for r in authority["adjustments"]})
    postings, effects = read(local, "postings"), read(remote, "effects")
    initial_epoch = read(original_local, "control")[0]["epoch"]
    controls = read(local, "control")
    final_epoch = controls[0]["epoch"] if len(controls) == 1 else None
    if len(controls) != 1 or controls[0]["id"] != 1 or controls[0]["active"] != 1 or type(final_epoch) is not int or final_epoch <= initial_epoch:
        finding("control_state_mismatch", actual=controls)
    initial_boundary = max((r["seq"] for r in read(original_local, "journal")), default=0)
    final_boundary = max((r["seq"] for r in authority["journal"]), default=0)
    wires = {(r["tenant"], r["event_id"]): r for r in effects}
    local_map = {(r["tenant"], r["event_id"]): r for r in postings}
    for group, name in ((postings, "local_posting"), (effects, "remote_effect")):
        for key, count in Counter((r["tenant"], r["event_id"]) for r in group).items():
            if count != 1:
                finding(name + "_identity_count", identity=list(key), count=count)
    for row in read(original_remote, "effects"):
        if wires.get((row["tenant"], row["event_id"])) != row:
            finding("original_remote_effect_changed", identity=[row["tenant"], row["event_id"]])
    for old in read(original_local, "postings"):
        now = local_map.get((old["tenant"], old["event_id"]))
        if now is None or any(now[k] != v for k, v in old.items() if k != "receipt_id") or (old["receipt_id"] is not None and now["receipt_id"] != old["receipt_id"]):
            finding("original_posting_changed", identity=[old["tenant"], old["event_id"]])
    contributions = {}
    for row in postings:
        key = row["tenant"], row["event_id"]
        boundary, epoch = row["boundary_seq"], row["epoch"]
        boundary_valid = (type(boundary) is int and 0 <= boundary <= final_boundary and
                          type(epoch) is int and epoch in (initial_epoch, final_epoch) and
                          (boundary <= initial_boundary if epoch == initial_epoch else boundary >= initial_boundary))
        if not boundary_valid:
            finding("posting_epoch_boundary_invalid", identity=list(key), epoch=epoch, boundary_seq=boundary)
        if row["source_kind"] == "business" and boundary_valid and not any(r["tenant"] == row["tenant"] and r["event_id"] == row["source_id"] and r["seq"] <= boundary for r in authority["journal"]):
            finding("posting_business_source_not_accepted_at_boundary", identity=list(key), boundary_seq=boundary)
        try:
            payload = decode_wire(row["payload"])
        except Invalid as error:
            finding("posting_wire_invalid", identity=list(key), field=str(error))
            continue
        source = row["tenant"], row["source_kind"], row["source_id"]
        if payload["tenant"] != row["tenant"] or payload["event_id"] != row["event_id"]:
            finding("posting_wire_identity_mismatch", identity=list(key))
        if source not in desired:
            finding("posting_source_unknown", identity=list(key), source=list(source))
        contributions[source] = contributions.get(source, 0) + payload["amount_minor"]
        actual = wires.get(key)
        if actual is None:
            finding("remote_effect_missing", identity=list(key))
        elif any(actual[k] != v for k, v in payload.items()) or actual["receipt_id"] != row["receipt_id"]:
            finding("receipt_binding_mismatch", identity=list(key))
    for key in wires.keys() - local_map.keys():
        finding("remote_effect_unaccounted", identity=list(key))
    for source in desired.keys() | contributions.keys():
        if contributions.get(source, 0) != desired.get(source, 0):
            finding("source_contribution_mismatch", source=list(source), expected=desired.get(source, 0), actual=contributions.get(source, 0))
    for key, row in wires.items():
        if row["kind"] == "reversal":
            parent = wires.get((row["tenant"], row["reverses"]))
            if parent is None or parent["kind"] != "post" or row["amount_minor"] >= 0:
                finding("reversal_parent_invalid", identity=list(key))
        elif row["kind"] != "post" or row["amount_minor"] <= 0 or row["reverses"] is not None:
            finding("post_invalid", identity=list(key))
    for key, parent in wires.items():
        if parent["kind"] == "post":
            remaining = parent["amount_minor"] + sum(r["amount_minor"] for r in effects if r["tenant"] == key[0] and r["kind"] == "reversal" and r["reverses"] == key[1])
            if remaining < 0:
                finding("reversal_parent_exhausted", identity=list(key), remaining=remaining)
    accounts = {t: sum(r["amount_minor"] for r in effects if r["tenant"] == t) for t, _, _ in desired}
    for tenant, actual in accounts.items():
        expected = sum(amount for (t, _, _), amount in desired.items() if t == tenant)
        if actual != expected:
            finding("account_mismatch", tenant=tenant, expected=expected, actual=actual)
    return {"status": "business_mismatch" if findings else "business_success", "scope": "author_scene_schema_sequential_qualification",
            "candidate_score": None, "epoch_evidence_scope": "one sequential cut and accepted business boundary ranges; not concurrent fencing or approval-time causality", "accounts": accounts, "business": [{"tenant": t, "event_id": e, "revision": v[0], "status": v[1], "amount_minor": v[2]} for (t, e), v in sorted(target.items())],
            "posting_count": len(postings), "findings": findings}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    for name in ("authority", "original-local", "original-remote", "local", "remote", "out"):
        p.add_argument("--" + name, type=Path, required=True)
    a = p.parse_args()
    try:
        result = assess(json.loads(a.authority.read_text(encoding="utf-8")), a.original_local, a.original_remote, a.local, a.remote)
    except (OSError, ValueError, KeyError, TypeError, sqlite3.Error) as error:
        result = {"status": "run_invalid", "error_type": type(error).__name__, "error": str(error)}
    a.out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False), flush=True)
    raise SystemExit(0 if result["status"] == "business_success" else 2)
