"""Readonly per-identity mini checker; explicit complete tenant partition."""
import argparse
from contextlib import closing
from collections import Counter
import json
import pathlib
import sqlite3


def read(db, table):
    uri = pathlib.Path(db).resolve().as_uri() + "?mode=ro"
    with closing(sqlite3.connect(uri, uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        return [dict(row) for row in connection.execute("SELECT * FROM " + table)]


def assess(events, local, remote):
    expected = {(item["tenant"], item["event_id"]): item for item in events}
    tenants = {item["tenant"] for item in events}
    findings = []
    if len(expected) != len(events) or not events:
        return {"status": "run_invalid", "error": "expected_events_invalid"}
    groups = [read(local, "entries"), read(remote, "effects"), read(local, "outbox")]
    for name, group in zip(("entries", "effects", "outbox"), groups):
        counts = Counter((row["tenant"], row["event_id"]) for row in group if row["tenant"] in tenants)
        findings.extend({"identity": list(key), "error": name + "_duplicate_identity", "count": count} for key, count in counts.items() if count != 1)
    local_rows = {(row["tenant"], row["event_id"]): row for row in groups[0] if row["tenant"] in tenants}
    remote_rows = {(row["tenant"], row["event_id"]): row for row in groups[1] if row["tenant"] in tenants}
    confirmations = {(row["tenant"], row["event_id"]): row["receipt_id"] for row in groups[2] if row["tenant"] in tenants}
    for key in sorted(set(expected) | set(local_rows) | set(remote_rows) | set(confirmations)):
        wanted, entry, effect = expected.get(key), local_rows.get(key), remote_rows.get(key)
        if wanted is None:
            findings.append({"identity": list(key), "error": "unexpected_business_identity"})
            continue
        if entry is None:
            findings.append({"identity": list(key), "error": "local_entry_missing"})
        else:
            if json.loads(entry["payload"]) != wanted or entry["amount_minor"] != wanted["amount_minor"]:
                findings.append({"identity": list(key), "error": "local_entry_payload_mismatch"})
        if effect is None:
            findings.append({"identity": list(key), "error": "remote_effect_missing"})
        else:
            if any(effect.get(field) != value for field, value in wanted.items()):
                findings.append({"identity": list(key), "error": "remote_effect_payload_mismatch"})
            if not effect["receipt_id"] or confirmations.get(key) != effect["receipt_id"]:
                findings.append({"identity": list(key), "error": "receipt_binding_mismatch"})
    return {"status": "business_mismatch" if findings else "business_success", "scope": "mini_complete_declared_tenant_partition", "tenants": sorted(tenants), "expected_identities": len(expected), "findings": findings, "candidate_score": None}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--events", type=pathlib.Path, required=True)
    parser.add_argument("--local", type=pathlib.Path, required=True)
    parser.add_argument("--remote", type=pathlib.Path, required=True)
    parser.add_argument("--out", type=pathlib.Path, required=True)
    args = parser.parse_args()
    try:
        result = assess(json.loads(args.events.read_text(encoding="utf-8")), args.local, args.remote)
    except (OSError, sqlite3.Error, ValueError, KeyError, TypeError) as error:
        result = {"status": "run_invalid", "error_type": type(error).__name__, "error": str(error)}
    args.out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result), flush=True)
    sys_code = 0 if result["status"] == "business_success" else 2
    raise SystemExit(sys_code)
