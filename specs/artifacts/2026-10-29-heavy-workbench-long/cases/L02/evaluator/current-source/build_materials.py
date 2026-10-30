"""Author-only synthetic publication archive. No forecast quality claim is made here."""
import argparse
import csv
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import json
import math
from pathlib import Path
import random
from material_contract import load_contract, expected_origin_rows

UTC = timezone.utc
LEAVES = {"A1": "ZA", "A2": "ZA", "B1": "ZB", "B2": "ZB"}
OBS_FIELDS = ["series_id", "event_date", "event_end_utc", "release_time_utc", "revision_id", "value", "unit", "quality_flag"]
COV_FIELDS = ["variable_id", "valid_date", "valid_end_utc", "release_time_utc", "revision_id", "value", "unit", "quality_flag"]
ORIGIN_FIELDS = ["origin_id", "role", "outer_id", "cutoff_utc", "horizon_days", "first_target_end_utc", "target_step_hours", "truth_lag_hours"]


def stamp(value):
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def midnight(day):
    return datetime.combine(day, time(), UTC)


def write_csv(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader();writer.writerows(rows)


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def build(root,contract):
    root.mkdir(parents=True, exist_ok=False)
    full = root/"full-private";full.mkdir()
    development = root/"development-public";development.mkdir()
    rng = random.Random(20261030)
    start, finish = date(2023,1,1), date(2025,12,31)
    days = [start+timedelta(days=i) for i in range((finish-start).days+1)]
    catalogue = [{"series_id":s,"parent_zone":z,"kind":"leaf","canonical_unit":"L"} for s,z in LEAVES.items()]
    catalogue += [{"series_id":z,"parent_zone":"","kind":"aggregate","canonical_unit":"L"} for z in ["ZA","ZB"]]
    write_csv(full/"series.csv", list(catalogue[0]), catalogue)
    write_csv(full/"hierarchy.csv", ["parent","child","weight"], [{"parent":z,"child":s,"weight":1} for s,z in LEAVES.items()])
    availability = {"weekday":{"unit":"index","availability":"known_future"},"holiday":{"unit":"binary","availability":"known_future"},
        "A2.open":{"unit":"binary","availability":"known_future"},"A1.transfer_in":{"unit":"binary","availability":"known_future"}}
    for zone in ["ZA","ZB"]:
        for mode in ["forecast","actual"]:
            availability[zone+".temperature_"+mode] = {"unit":"C_tenth","availability":"known_future" if mode=="forecast" else "observed"}
    write_json(full/"availability.json",availability)
    write_json(full/"units.json",contract["units"])
    write_json(full/"time-axis.json",contract["clock"])
    weather = {}
    common = 0.0
    for i,day in enumerate(days):
        common = .65*common+rng.gauss(0, .8)
        for zi,zone in enumerate(["ZA","ZB"]):
            weather[zone,day] = round(120+100*math.sin(2*math.pi*(i-80)/365.25)+zi*12+common*10+rng.gauss(0,5))
    observations, covariates = [], []
    # Operational revisions are ordinary known-future publications, not static future truth in the catalogue.
    initial_plan = datetime(2022,12,1,tzinfo=UTC)
    announce = datetime(2025,6,15,12,tzinfo=UTC)
    change = date(2025,7,1)
    for i,day in enumerate(days):
        end = midnight(day+timedelta(days=1))
        for var,value,unit in [("weekday",day.weekday(),"index"),("holiday",int((day.month,day.day) in [(1,1),(12,25)]),"binary"),
                               ("A2.open",1,"binary"),("A1.transfer_in",0,"binary")]:
            covariates.append(dict(zip(COV_FIELDS,[var,day.isoformat(),stamp(end),stamp(initial_plan),0,value,unit,"valid"])))
        if day >= change:
            for var,value in [("A2.open",0),("A1.transfer_in",1)]:
                covariates.append(dict(zip(COV_FIELDS,[var,day.isoformat(),stamp(end),stamp(announce),1,value,"binary","valid"])))
        for zone in ["ZA","ZB"]:
            actual=weather[zone,day]
            covariates.append(dict(zip(COV_FIELDS,[zone+".temperature_actual",day.isoformat(),stamp(end),stamp(end+timedelta(hours=8)),0,actual,"C_tenth","valid"])))
            for lead in range(14):
                issue=midnight(day-timedelta(days=lead))+timedelta(hours=6)
                value=round(actual+3*lead+rng.gauss(0,3+2*lead))
                covariates.append(dict(zip(COV_FIELDS,[zone+".temperature_forecast",day.isoformat(),stamp(end),stamp(issue),13-lead,value,"C_tenth","valid"])))
        base = {}
        for si,(series,zone) in enumerate(LEAVES.items()):
            temp=weather[zone,day]/10
            value=[8000,6500,7000,6000][si]+[85,50,100,65][si]*(temp-12)
            value += (450 if day.weekday()<5 else -850)+(200 if si%2 else -150)*math.sin(2*math.pi*i/7)
            value += rng.gauss(0,120)+si*30
            if series=="B1" and day>=date(2025,4,17):value+=1100+65*max(0,temp-14)
            base[series]=max(500,round(value))
        if day>=change:
            base["A1"]+=round(.6*base["A2"]);base["A2"]=0
        for si,series in enumerate(LEAVES):
            truth=base[series]
            for revision,lag in [(0,timedelta(hours=2+(48 if (i+si*7)%31==9 else 0))),
                (1,timedelta(days=7,hours=4)),(contract["grid"]["terminal_revision_id"],timedelta(hours=contract["grid"]["terminal_release_lag_hours"]))]:
                release=end+lag
                missing=(revision==0 and (i+si*13)%53==17) or (revision==1 and (i+si*17)%97==10)
                value=truth if revision==contract["grid"]["terminal_revision_id"] else max(0,truth+round((220+si*30)*math.sin(i/9)+rng.gauss(0,80))) if revision==0 else max(0,truth+round(rng.gauss(0,25)))
                if truth==0:value=0
                unit="m3" if series in ["A1","B1"] and release>=datetime(2024,9,1,tzinfo=UTC) else "L"
                encoded="" if missing else str(value) if unit=="L" else format(Decimal(value)/contract["units"][unit]["multiplier"],".3f")
                observations.append(dict(zip(OBS_FIELDS,[series,day.isoformat(),stamp(end),stamp(release),revision,encoded,unit,"missing" if missing else "valid"])))
    write_csv(full/"observations.csv",OBS_FIELDS,observations)
    write_csv(full/"covariate-vintages.csv",COV_FIELDS,covariates)
    origins=expected_origin_rows(contract)
    write_csv(full/"origins.csv",ORIGIN_FIELDS,origins)
    cutoff=contract["clock"]["development_cutoff_utc"]
    for name in ["series.csv","hierarchy.csv","availability.json","units.json","time-axis.json","origins.csv"]:
        (development/name).write_bytes((full/name).read_bytes())
    write_csv(development/"observations.csv",OBS_FIELDS,[r for r in observations if r["release_time_utc"]<=cutoff])
    write_csv(development/"covariate-vintages.csv",COV_FIELDS,[r for r in covariates if r["release_time_utc"]<=cutoff])
    receipt={"format":"l02-material-construction/1","source":"original synthetic author construction, not real utility records",
        "day_count":len(days),"leaf_count":4,"aggregate_count":2,"observations":len(observations),"covariates":len(covariates),
        "origins":len(origins),"development_cutoff":cutoff,"scope":"materials only; no full forecasting/research qualification or candidate score","frozen":False}
    write_json(root/"construction.json",receipt)
    print(json.dumps(receipt),flush=True)


if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--out",type=Path,required=True);p.add_argument("--contract",type=Path,required=True);a=p.parse_args();build(a.out.resolve(),load_contract(a.contract))
