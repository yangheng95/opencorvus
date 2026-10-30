"""Actual unique-projector/checker contracts over the full material; no forecasting."""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import time

from asof_input import project
from check_projection import assess


def audit(decoded, output, origin_ids=None):
    output.mkdir(parents=True,exist_ok=False)
    raw=json.loads((decoded/"canonical.json").read_text(encoding="utf-8"))
    grid=json.loads((decoded/"origin-grid.json").read_text(encoding="utf-8"))
    if origin_ids is not None and not set(origin_ids)<={r["origin_id"] for r in grid["origins"]}:raise ValueError("unknown_registered_origin")
    epoch=datetime.fromisoformat(grid["clock"]["epoch_utc"].replace("Z","+00:00"))
    def tick(value):return int((datetime.fromisoformat(value.replace("Z","+00:00"))-epoch).total_seconds())//3600
    start=time.perf_counter();results=[]
    for origin in grid["origins"]:
        if origin_ids is not None and origin["origin_id"] not in origin_ids:continue
        snapshot=project(raw,origin["origin_tick"],len(origin["target_ticks"]))
        result=assess(raw,snapshot,origin["origin_tick"],len(origin["target_ticks"]))
        assert result["status"]=="projection_verified",(origin["origin_id"],result)
        first_start=datetime.fromisoformat(origin["target_end_utc"][0].replace("Z","+00:00"))-timedelta(days=1)
        actual_cut=datetime.fromisoformat(origin["cutoff_utc"].replace("Z","+00:00"))
        assert first_start-actual_cut==timedelta(hours=15)
        assert [b-a for a,b in zip(origin["target_ticks"],origin["target_ticks"][1:])]==[24]*13
        results.append({"origin_id":origin["origin_id"],"status":result["status"],"observations":len(snapshot["observations"]),
            "covariates":len(snapshot["covariates"]),"all_actual_findings":result["findings"],"first_full_day_starts_hours_after_cutoff":15})
        if origin["origin_id"] in ["outer-20250115","outer-20250715"]:
            (output/(origin["origin_id"]+"-snapshot.json")).write_text(json.dumps(snapshot,indent=2),encoding="utf-8")
    # Specific publication mechanisms are real data effects, not desired model-policy changes.
    before=project(raw,tick("2025-06-15T09:00:00Z"),14)
    after=project(raw,tick("2025-06-15T12:00:00Z"),14)
    target=tick("2025-07-02T00:00:00Z")
    def current(snapshot,variable):
        return max((r for r in snapshot["covariates"] if r["variable_id"]==variable and r["valid_tick"]==target),key=lambda r:r["revision_id"])["value"]
    operating={v:[current(before,v),current(after,v)] for v in ["A2.open","A1.transfer_in"]}
    assert operating=={"A2.open":[1,0],"A1.transfer_in":[0,1]}
    origin=next(x for x in grid["origins"] if x["origin_id"]=="outer-20250115")
    valid=project(raw,origin["origin_tick"],14)
    future_actual=next(r for r in raw["covariates"] if r["variable_id"]=="ZA.temperature_actual" and r["valid_tick"]==origin["target_ticks"][0])
    leaky={**valid,"covariates":[*valid["covariates"],future_actual]}
    actual_error=assess(raw,leaky,origin["origin_tick"],14)
    assert actual_error["status"]=="availability_violation" and any(r["error"]=="availability_violation" for r in actual_error["findings"])
    future_revision=next(r for r in raw["observations"] if r["revision_id"]==2 and r["event_tick"]<origin["origin_tick"]<r["release_tick"])
    revision_error=assess(raw,{**valid,"observations":[*valid["observations"],future_revision]},origin["origin_tick"],14)
    assert revision_error["status"]=="availability_violation" and any(r["error"]=="availability_violation" for r in revision_error["findings"])
    late=next(r for r in raw["observations"] if r["revision_id"]==0 and r["release_tick"]-r["event_tick"]==50)
    earlier=project(raw,late["release_tick"]-1,14);at=project(raw,late["release_tick"],14)
    late_error=assess(raw,{**earlier,"observations":[*earlier["observations"],late]},late["release_tick"]-1,14)
    assert late_error["status"]=="availability_violation"
    assert assess(raw,at,late["release_tick"],14)["status"]=="projection_verified"
    assert next(r for r in at["observations"] if (r["series_id"],r["event_tick"],r["revision_id"])==(late["series_id"],late["event_tick"],0))==late
    changed={**raw}
    for table in ["observations","covariates"]:
        changed[table]=[{**r,"value":r["value"]+1 if r["value"] is not None else None,"release_tick":r["release_tick"]+1} if r["release_tick"]>origin["origin_tick"] else dict(r) for r in raw[table]]
    changed_snapshot=project(changed,origin["origin_tick"],14)
    assert valid==changed_snapshot
    summary={"status":"material_projection_qualified","origins_checked":len(results),"origin_findings":results,
        "operating_publication_values_before_after":operating,"leaky_actual_error":actual_error,"leaky_revision_error":revision_error,
        "late_initial_before_release_error":late_error,"late_initial_at_release":"projection_verified",
        "future_only_mutation_same_authorized_snapshot":True,"seconds":time.perf_counter()-start,
        "scope":"data publication/projection and complete-future grid only; no worker forecast/model selection/scientific quality or hours claim",
        "candidate_score":None,"frozen":False}
    (output/"assessment.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
    print(json.dumps({k:v for k,v in summary.items() if k!="origin_findings"}),flush=True)


if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--decoded",type=Path,required=True);p.add_argument("--out",type=Path,required=True)
    p.add_argument("--origin-id",action="append");a=p.parse_args();audit(a.decoded,a.out,a.origin_id)
