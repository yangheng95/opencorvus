"""Independent SQL authorization reconstruction; consumes original raw only on evaluation side."""
import argparse
from collections import Counter
from contextlib import closing
import json
from pathlib import Path
import sqlite3
from asof_input import validate


def assess(raw, snapshot, origin, horizon):
    validate(raw)
    if type(origin) is not int or not 0 <= origin <= 10**6 or type(horizon) is not int or not 1 <= horizon <= 32:
        return {"status": "input_invalid", "error": "assigned_origin_horizon"}
    if not isinstance(snapshot, dict) or set(snapshot) != {"format", "origin", "horizon", "series", "variables", "observations", "covariates"}:
        return {"status": "input_invalid", "error": "snapshot_metadata"}
    if snapshot["format"] != "l02-asof-snapshot/1" or type(snapshot["origin"]) is not int or type(snapshot["horizon"]) is not int or snapshot["origin"] != origin or snapshot["horizon"] != horizon:
        return {"status": "input_invalid", "error": "assigned_origin_horizon_mismatch"}
    validate({"format": "l02-vintages/1", **{key: snapshot[key] for key in ("series", "variables", "observations", "covariates")}})
    findings = []
    for table, identity, tick in [("observations", "series_id", "event_tick"), ("covariates", "variable_id", "valid_tick")]:
        with closing(sqlite3.connect(":memory:")) as c:
            c.execute("CREATE TABLE rows(identity TEXT,tick INTEGER,release INTEGER,revision INTEGER,known_future INTEGER)")
            c.executemany("INSERT INTO rows VALUES(?,?,?,?,?)", [(r[identity],r[tick],r["release_tick"],r["revision_id"],
                int(table == "covariates" and raw["variables"][r[identity]]["availability"] == "known_future")) for r in raw[table]])
            allowed = set(c.execute("SELECT identity,tick,revision FROM rows WHERE release<=? AND (known_future=1 OR tick<?)", (origin, origin)))
        originals = {(r[identity],r[tick],r["revision_id"]): r for r in raw[table]}
        actual = snapshot.get(table)
        if not isinstance(actual, list):
            findings.append({"error": "projection_table_missing", "table": table});continue
        counts = Counter((r[identity],r[tick],r["revision_id"]) for r in actual)
        for r in actual:
            key = r[identity],r[tick],r["revision_id"]
            if key not in allowed:
                findings.append({"error": "availability_violation", "table": table, "identity": list(key), "release_tick": r["release_tick"], "origin": origin})
            elif originals.get(key) != r:
                findings.append({"error": "projection_fact_mismatch", "table": table, "identity": list(key)})
        for key in allowed:
            if counts[key] != 1:
                findings.append({"error": "projection_authorized_coverage", "table": table, "identity": list(key), "count": counts[key]})
    if snapshot.get("series") != raw["series"] or snapshot.get("variables") != raw["variables"]:
        findings.append({"error": "projection_registry_mismatch"})
    return {"status": "availability_violation" if findings else "projection_verified", "findings": findings,
            "scope": "exact published integer-tick rows and registered availability classes only", "candidate_score": None}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    for name in ("raw", "snapshot", "out"):p.add_argument("--"+name, type=Path, required=True)
    p.add_argument("--origin", type=int, required=True)
    p.add_argument("--horizon", type=int, required=True)
    a = p.parse_args()
    try:
        result = assess(json.loads(a.raw.read_text(encoding="utf-8")), json.loads(a.snapshot.read_text(encoding="utf-8")), a.origin, a.horizon)
    except (OSError, ValueError, KeyError, TypeError, sqlite3.Error) as e:
        result = {"status": "input_invalid", "error": str(e)}
    a.out.write_text(json.dumps(result, indent=2), encoding="utf-8");print(json.dumps(result), flush=True)
    raise SystemExit(0 if result["status"] == "projection_verified" else 2)
