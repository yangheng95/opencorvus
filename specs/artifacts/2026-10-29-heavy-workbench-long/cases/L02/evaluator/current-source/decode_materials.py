"""One UTC/CSV/unit decoder into the existing asof_input facts; never projects itself."""
import argparse
import csv
from datetime import datetime, timedelta, timezone
from fractions import Fraction
import json
from pathlib import Path
import re

from asof_input import InputError, validate
from material_contract import load_contract, read_json, expected_origin_rows

OBS = {"series_id","event_date","event_end_utc","release_time_utc","revision_id","value","unit","quality_flag"}
COV = {"variable_id","valid_date","valid_end_utc","release_time_utc","revision_id","value","unit","quality_flag"}
ORIGIN = {"origin_id","role","outer_id","cutoff_utc","horizon_days","first_target_end_utc","target_step_hours","truth_lag_hours"}


def utc(value):
    if type(value) is not str:
        raise InputError("utc_timestamp")
    try:result=datetime.strptime(value,"%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError as e:raise InputError("utc_timestamp") from e
    if result.strftime("%Y-%m-%dT%H:%M:%SZ")!=value or result.minute or result.second:
        raise InputError("utc_whole_hour")
    return result


def integer(text,field,minimum=0,maximum=10**6):
    try:value=int(text)
    except (TypeError,ValueError) as e:raise InputError(field) from e
    if str(value)!=text or not minimum<=value<=maximum:raise InputError(field)
    return value


def hour_tick(text,epoch):
    seconds=int((utc(text)-epoch).total_seconds())
    if seconds<0 or seconds%3600 or seconds//3600>10**6:raise InputError("tick_range")
    return seconds//3600


def rows(path,fields):
    with path.open(newline="",encoding="utf-8") as f:
        reader=csv.DictReader(f)
        if not reader.fieldnames or len(reader.fieldnames)!=len(fields) or set(reader.fieldnames)!=fields:
            raise InputError("csv_header:"+path.name)
        result=list(reader)
    if any(set(r)!=fields or any(v is None for v in r.values()) for r in result):raise InputError("csv_row:"+path.name)
    return result


def quantity(text,quality,multiplier):
    if quality=="missing":
        if text!="":raise InputError("missing_value")
        return None
    if quality!="valid" or not text or len(text)>64 or re.fullmatch(r"[0-9]+(?:\.[0-9]+)?",text) is None:raise InputError("quantity_plain_decimal")
    number=Fraction(text)*multiplier
    if number.denominator!=1 or not 0<=number.numerator<=10**9:raise InputError("quantity_integer_range")
    return number.numerator


def read_fact_tables(root,clock,units,catalogue,variables):
    """The sole CSV/UTC/quantity decoder, shared by full archives and permitted packets."""
    epoch=utc(clock["epoch_utc"])
    def tick(text):return hour_tick(text,epoch)
    leaves={r["series_id"] for r in catalogue if r["kind"]=="leaf"}
    raw={"format":"l02-vintages/1","series":{r["series_id"]:{"unit":r["canonical_unit"]} for r in catalogue},
        "variables":variables,"observations":[],"covariates":[]}
    for filename,table,identity,date_key,end_key,canonical_tick in [
        ("observations.csv","observations","series_id","event_date","event_end_utc","event_tick"),
        ("covariate-vintages.csv","covariates","variable_id","valid_date","valid_end_utc","valid_tick")]:
        for r in rows(root/filename,OBS if table=="observations" else COV):
            end=utc(r[end_key])
            try:day=datetime.strptime(r[date_key],"%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError as e:raise InputError("event_date") from e
            if day.strftime("%Y-%m-%d")!=r[date_key] or end!=day+timedelta(days=1):raise InputError("event_interval")
            if table=="observations":
                if r[identity] not in leaves or r["unit"] not in units:raise InputError("observation_identity_unit")
                value=quantity(r["value"],r["quality_flag"],units[r["unit"]]["multiplier"])
            else:
                if r[identity] not in raw["variables"] or r["unit"]!=raw["variables"][r[identity]]["unit"]:raise InputError("covariate_identity_unit")
                if r["quality_flag"]=="missing" and r["value"]=="":value=None
                elif r["quality_flag"]=="valid":value=integer(r["value"],"covariate_integer",-10**9,10**9)
                else:raise InputError("covariate_quality")
            raw[table].append({identity:r[identity],canonical_tick:tick(r[end_key]),"release_tick":tick(r["release_time_utc"]),
                "revision_id":integer(r["revision_id"],"revision_id"),"value":value,"quality_flag":r["quality_flag"]})
    return validate(raw)


def validate_catalogue(catalogue,hierarchy):
    if type(catalogue) is not list or type(hierarchy) is not list:raise InputError("series_registry")
    for row in catalogue:
        if type(row) is not dict or set(row)!={"series_id","parent_zone","kind","canonical_unit"} or any(type(v) is not str for v in row.values()):raise InputError("series_registry")
    for row in hierarchy:
        if type(row) is not dict or set(row)!={"parent","child","weight"} or any(type(v) is not str for v in row.values()):raise InputError("hierarchy_parent")
    ids=[r["series_id"] for r in catalogue]
    if not catalogue or len(set(ids))!=len(ids) or any(not r["series_id"].strip() or r["kind"] not in ["leaf","aggregate"] or r["canonical_unit"]!="L" for r in catalogue):raise InputError("series_registry")
    leaves={r["series_id"] for r in catalogue if r["kind"]=="leaf"};aggregates={r["series_id"] for r in catalogue if r["kind"]=="aggregate"}
    if len({(r["parent"],r["child"]) for r in hierarchy})!=len(hierarchy):raise InputError("hierarchy_duplicate")
    if {r["child"] for r in hierarchy}!=leaves or len(hierarchy)!=len(leaves):raise InputError("hierarchy_leaf_coverage")
    for r in hierarchy:
        if r["parent"] not in aggregates or integer(r["weight"],"hierarchy_weight",1,1)!=1 or next(s for s in catalogue if s["series_id"]==r["child"])["parent_zone"]!=r["parent"]:raise InputError("hierarchy_parent")
    if {r["parent"] for r in hierarchy}!=aggregates:raise InputError("hierarchy_aggregate_coverage")


def validate_units(units):
    if type(units) is not dict or not units:raise InputError("unit_registry")
    for key,value in units.items():
        if type(key) is not str or not key or type(value) is not dict or set(value)!={"canonical_unit","multiplier"} or value["canonical_unit"]!="L" or type(value["multiplier"]) is not int or not 1<=value["multiplier"]<=10**6:raise InputError("unit_definition")


def decode(root,role,contract):
    if role not in ["archive","development"]:raise InputError("assigned_archive_role")
    clock=read_json(root/"time-axis.json")
    if clock!=contract["clock"]:raise InputError("registered_clock_mismatch")
    epoch=utc(clock["epoch_utc"]);development_cutoff=utc(clock["development_cutoff_utc"])
    def tick(text):return hour_tick(text,epoch)
    catalogue=rows(root/"series.csv",{"series_id","parent_zone","kind","canonical_unit"})
    hierarchy=rows(root/"hierarchy.csv",{"parent","child","weight"});validate_catalogue(catalogue,hierarchy)
    leaves={r["series_id"] for r in catalogue if r["kind"]=="leaf"}
    units=read_json(root/"units.json");validate_units(units)
    if units!=contract["units"]:raise InputError("registered_units_mismatch")
    raw=read_fact_tables(root,clock,units,catalogue,read_json(root/"availability.json"))
    if role=="development" and any(r["release_tick"]>tick(clock["development_cutoff_utc"]) for table in ["observations","covariates"] for r in raw[table]):
        raise InputError("development_unpublished_fact")
    declared_origins=rows(root/"origins.csv",ORIGIN)
    expected={r["origin_id"]:r for r in expected_origin_rows(contract)}
    if len(declared_origins)!=len(expected) or {r["origin_id"]:r for r in declared_origins}!=expected:raise InputError("registered_origins_mismatch")
    grid=[];origin_ids=set()
    for r in declared_origins:
        if not r["origin_id"].strip() or r["origin_id"] in origin_ids or r["role"] not in ["development","outer","inner"]:raise InputError("origin_identity")
        origin_ids.add(r["origin_id"])
        cutoff=utc(r["cutoff_utc"]);first=utc(r["first_target_end_utc"])
        horizon=integer(r["horizon_days"],"horizon_days",1,32)
        g=contract["grid"]
        if (cutoff.hour!=g["cutoff_hour_utc"] or first!=cutoff.replace(hour=0)+timedelta(days=g["first_target_end_day_offset"]) or integer(r["target_step_hours"],"target_step_hours",24,24)!=g["target_step_hours"] or horizon!=g["horizon_days"]):raise InputError("registered_grid_mismatch")
        lag=integer(r["truth_lag_hours"],"truth_lag_hours",0,24*365)
        if lag!=g["terminal_release_lag_hours"]:raise InputError("registered_truth_lag_mismatch")
        ends=[first+timedelta(days=i) for i in range(horizon)]
        grid.append({"origin_id":r["origin_id"],"role":r["role"],"outer_id":r["outer_id"],"cutoff_utc":r["cutoff_utc"],"origin_tick":tick(r["cutoff_utc"]),
            "target_ticks":[tick(x.strftime("%Y-%m-%dT%H:%M:%SZ")) for x in ends],"target_end_utc":[x.strftime("%Y-%m-%dT%H:%M:%SZ") for x in ends],"latest_label_release_utc":(ends[-1]+timedelta(hours=lag)).strftime("%Y-%m-%dT%H:%M:%SZ")})
    by_id={r["origin_id"]:r for r in grid}
    terminal={(r["series_id"],r["event_tick"]):r for r in raw["observations"] if r["revision_id"]==contract["grid"]["terminal_revision_id"]}
    for r in grid:
        if r["role"]=="inner":
            outer=by_id.get(r["outer_id"])
            if outer is None or outer["role"]!="outer" or utc(r["latest_label_release_utc"])>utc(outer["cutoff_utc"]):raise InputError("inner_labels_unpublished")
        elif r["outer_id"]:raise InputError("origin_parent")
        if r["role"]=="development" and utc(r["latest_label_release_utc"])>development_cutoff:raise InputError("development_labels_unpublished")
        if role=="archive" or r["role"]=="development":
            releases=[]
            for series in leaves:
                for target in r["target_ticks"]:
                    label=terminal.get((series,target))
                    if label is None or label["quality_flag"]!="valid":raise InputError("terminal_label_missing")
                    if label["release_tick"]>tick(r["latest_label_release_utc"]):raise InputError("truth_release_bound")
                    if r["role"]=="inner" and label["release_tick"]>by_id[r["outer_id"]]["origin_tick"]:raise InputError("inner_actual_label_unpublished")
                    releases.append(label["release_tick"])
            r["actual_last_label_release_tick"]=max(releases)
    return raw,{"format":"l02-origin-grid/1","clock":clock,"series_catalogue":catalogue,"hierarchy":hierarchy,"origins":grid}


if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--input",type=Path,required=True);p.add_argument("--out",type=Path,required=True)
    p.add_argument("--role",choices=["archive","development"],required=True)
    p.add_argument("--contract",type=Path,required=True);a=p.parse_args()
    try:
        raw,grid=decode(a.input,a.role,load_contract(a.contract))
        a.out.mkdir(parents=True,exist_ok=False)
        (a.out/"canonical.json").write_text(json.dumps(raw,ensure_ascii=False,indent=2),encoding="utf-8")
        (a.out/"origin-grid.json").write_text(json.dumps(grid,ensure_ascii=False,indent=2),encoding="utf-8")
        print(json.dumps({"status":"materials_decoded","observations":len(raw["observations"]),"covariates":len(raw["covariates"]),"origins":len(grid["origins"]),"scope":"no full forecast executed"}),flush=True)
    except (InputError,OSError,ValueError,KeyError,TypeError,csv.Error) as e:
        print(json.dumps({"status":"input_invalid","error":str(e)}),flush=True);raise SystemExit(2)
