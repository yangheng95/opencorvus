"""Evaluator-side publication projection for the small integer-tick qualification."""
import argparse
import json
from pathlib import Path


class InputError(ValueError):
    pass


def validate(raw):
    if not isinstance(raw, dict) or set(raw) != {"format", "series", "variables", "observations", "covariates"} or raw["format"] != "l02-vintages/1":
        raise InputError("raw_schema")
    if not isinstance(raw["series"], dict) or not raw["series"] or not isinstance(raw["variables"], dict):
        raise InputError("registry")
    for registry in (raw["series"], raw["variables"]):
        if any(not isinstance(k, str) or not k.strip() or not isinstance(v, dict) for k, v in registry.items()):
            raise InputError("registry_identity")
    for value in raw["series"].values():
        if set(value) != {"unit"} or not isinstance(value["unit"], str) or not value["unit"]:
            raise InputError("series_unit")
    for value in raw["variables"].values():
        if set(value) != {"unit", "availability"} or not isinstance(value["unit"], str) or not value["unit"] or value["availability"] not in ("observed", "known_future"):
            raise InputError("variable_availability")
    for table, identity, tick in [("observations", "series_id", "event_tick"), ("covariates", "variable_id", "valid_tick")]:
        rows, seen = raw[table], set()
        if not isinstance(rows, list):
            raise InputError("table_type:" + table)
        for r in rows:
            if not isinstance(r, dict) or set(r) != {identity, tick, "release_tick", "revision_id", "value", "quality_flag"}:
                raise InputError("row_fields:" + table)
            registry = raw["series"] if table == "observations" else raw["variables"]
            if type(r[identity]) is not str or r[identity] not in registry:
                raise InputError("row_identity:" + table)
            if any(type(r[k]) is not int or not 0 <= r[k] <= 10**6 for k in (tick, "release_tick", "revision_id")):
                raise InputError("row_tick:" + table)
            key = r[identity], r[tick], r["revision_id"]
            if key in seen:
                raise InputError("duplicate_vintage:" + table)
            seen.add(key)
            if r["quality_flag"] == "valid":
                if type(r["value"]) is not int or not -10**9 <= r["value"] <= 10**9:
                    raise InputError("valid_value:" + table)
            elif r["quality_flag"] != "missing" or r["value"] is not None:
                raise InputError("missing_value:" + table)
            observed = table == "observations" or registry[r[identity]]["availability"] == "observed"
            if observed and r["release_tick"] <= r[tick]:
                raise InputError("observed_release_before_period_end:" + table)
    return raw


def project(raw, origin, horizon):
    validate(raw)
    if type(origin) is not int or not 0 <= origin <= 10**6 or type(horizon) is not int or not 1 <= horizon <= 32:
        raise InputError("origin_horizon")
    observations = [r.copy() for r in raw["observations"] if r["release_tick"] <= origin and r["event_tick"] < origin]
    covariates = [r.copy() for r in raw["covariates"] if r["release_tick"] <= origin and
                  (raw["variables"][r["variable_id"]]["availability"] == "known_future" or r["valid_tick"] < origin)]
    return {"format": "l02-asof-snapshot/1", "origin": origin, "horizon": horizon,
            "series": raw["series"], "variables": raw["variables"],
            "observations": sorted(observations, key=lambda r: (r["series_id"], r["event_tick"], r["revision_id"])),
            "covariates": sorted(covariates, key=lambda r: (r["variable_id"], r["valid_tick"], r["revision_id"]))}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--raw", type=Path, required=True)
    p.add_argument("--origin", type=int, required=True)
    p.add_argument("--horizon", type=int, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()
    try:
        result = project(json.loads(a.raw.read_text(encoding="utf-8")), a.origin, a.horizon)
    except (InputError, OSError, ValueError) as e:
        print(json.dumps({"status": "input_invalid", "error": str(e)}), flush=True)
        raise SystemExit(2)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": "snapshot_created", "origin": a.origin, "observations": len(result["observations"]), "covariates": len(result["covariates"])}), flush=True)
