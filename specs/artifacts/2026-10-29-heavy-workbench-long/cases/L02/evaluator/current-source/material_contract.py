"""Assigned evaluator material contract, separate from input declarations."""
import json
from datetime import date, datetime, time, timedelta, timezone
from asof_input import InputError


def read_json(path):
    def pairs(rows):
        result={}
        for key,value in rows:
            if key in result:raise InputError("duplicate_json_key")
            result[key]=value
        return result
    def constant(value):raise InputError("nonfinite_json")
    return json.loads(path.read_text(encoding="utf-8"),object_pairs_hook=pairs,parse_constant=constant)


def load_contract(path):
    contract=read_json(path)
    if type(contract) is not dict or set(contract)!={"format","clock","units","grid","schedule"} or contract["format"]!="l02-material-contract/1":raise InputError("assigned_contract")
    clock=contract["clock"]
    if type(clock) is not dict or set(clock)!={"format","epoch_utc","tick_unit","event_interval","development_cutoff_utc"} or any(type(v) is not str for v in clock.values()) or clock["format"]!="l02-clock/1" or clock["tick_unit"]!="hour":raise InputError("assigned_clock")
    units=contract["units"]
    if type(units) is not dict or not units:raise InputError("assigned_units")
    for name,value in units.items():
        if type(name) is not str or not name or type(value) is not dict or set(value)!={"canonical_unit","multiplier"} or value["canonical_unit"]!="L" or type(value["multiplier"]) is not int or not 1<=value["multiplier"]<=10**6:raise InputError("assigned_unit_definition")
    grid=contract["grid"]
    if type(grid) is not dict or set(grid)!={"cutoff_hour_utc","horizon_days","first_target_end_day_offset","target_step_hours","terminal_revision_id","terminal_release_lag_hours"} or any(type(v) is not int for v in grid.values()):raise InputError("assigned_grid")
    if not (0<=grid["cutoff_hour_utc"]<=23 and 1<=grid["horizon_days"]<=32 and grid["first_target_end_day_offset"]>=2 and grid["target_step_hours"]==24 and grid["terminal_revision_id"]>=0 and grid["terminal_release_lag_hours"]>=0):raise InputError("assigned_grid_range")
    schedule=contract["schedule"]
    if type(schedule) is not dict or set(schedule)!={"development_dates","outer_dates","inner_days_before"}:raise InputError("assigned_schedule")
    for key in ["development_dates","outer_dates"]:
        values=schedule[key]
        if type(values) is not list or not values or any(type(v) is not str for v in values) or len(set(values))!=len(values):raise InputError("assigned_schedule_dates")
        try:
            if any(date.fromisoformat(v).isoformat()!=v for v in values):raise ValueError()
        except ValueError as e:raise InputError("assigned_schedule_dates") from e
    offsets=schedule["inner_days_before"]
    if type(offsets) is not list or not offsets or any(type(v) is not int or not 1<=v<=3650 for v in offsets) or len(set(offsets))!=len(offsets):raise InputError("assigned_inner_offsets")
    return contract


def expected_origin_rows(contract):
    g=contract["grid"];result=[]
    def add(identifier,role,cutoff,parent=""):
        first=cutoff.replace(hour=0)+timedelta(days=g["first_target_end_day_offset"])
        result.append({"origin_id":identifier,"role":role,"outer_id":parent,"cutoff_utc":cutoff.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "horizon_days":str(g["horizon_days"]),"first_target_end_utc":first.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "target_step_hours":str(g["target_step_hours"]),"truth_lag_hours":str(g["terminal_release_lag_hours"])})
    for role,key in [("development","development_dates"),("outer","outer_dates")]:
        for day in contract["schedule"][key]:
            cutoff=datetime.combine(date.fromisoformat(day),time(g["cutoff_hour_utc"]),timezone.utc)
            identifier=("dev-" if role=="development" else "outer-")+day.replace("-","")
            add(identifier,role,cutoff)
            if role=="outer":
                for fold,offset in enumerate(contract["schedule"]["inner_days_before"],1):add(identifier+"-i"+str(fold),"inner",cutoff-timedelta(days=offset),identifier)
    return result
