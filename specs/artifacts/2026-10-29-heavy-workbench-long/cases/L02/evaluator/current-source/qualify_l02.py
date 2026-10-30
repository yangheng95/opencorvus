"""Small actual-process qualification, not a complete L02 candidate evaluation."""
import argparse
import copy
from datetime import datetime, timezone
from fractions import Fraction
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time
import uuid

SOURCE = Path(__file__).resolve().parent
IMAGE = "sha256:23ff8bfbf8055caa0b9fa5745ddb27cceea2f31d7d15b7a900c81112cdfe8ddf"


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def command(argv, root, name, expected=0):
    start = time.monotonic()
    p = subprocess.run([str(x) for x in argv], capture_output=True, text=True, encoding="utf-8")
    write(root/(name+".json"), {"argv": [str(x) for x in argv], "exitcode": p.returncode,
        "stdout": p.stdout, "stderr": p.stderr, "elapsed_seconds": time.monotonic()-start})
    if p.returncode != expected:
        raise RuntimeError(name+":"+str(p.returncode)+":"+p.stderr)
    return p


def fixture():
    raw = {"format": "l02-vintages/1", "series": {"S": {"unit": "count"}},
        "variables": {"calendar": {"unit": "index", "availability": "known_future"},
            "temp_forecast": {"unit": "celsius", "availability": "known_future"},
            "temp_actual": {"unit": "celsius", "availability": "observed"}},
        "observations": [{"series_id": "S", "event_tick": t, "release_tick": t+1,
            "revision_id": 0, "value": 10+2*t, "quality_flag": "valid"} for t in range(9)], "covariates": []}
    raw["observations"].append({"series_id": "S", "event_tick": 3, "release_tick": 9,
        "revision_id": 1, "value": 999, "quality_flag": "valid"})
    for identity, tick, release, revision, value in [("calendar",7,0,0,1), ("calendar",8,0,0,2),
        ("temp_forecast",7,6,0,20), ("temp_forecast",7,8,1,24),
        ("temp_actual",6,7,0,21), ("temp_actual",7,8,0,23)]:
        raw["covariates"].append({"variable_id":identity,"valid_tick":tick,"release_tick":release,
            "revision_id":revision,"value":value,"quality_flag":"valid"})
    return raw


def main(root):
    root.mkdir(parents=True, exist_ok=False)
    for filename in ("asof_input.py", "check_projection.py", "forecast_reference.py", "qualify_l02.py"):
        shutil.copy2(SOURCE/filename, root/filename)
    raw = fixture()
    changed = copy.deepcopy(raw)
    for table in ("observations", "covariates"):
        for row in changed[table]:
            if row["release_tick"] > 7:
                row["value"] = -777-row["revision_id"]
    facts, predictions, mounts = {}, {}, {}
    for label, data in (("base", raw), ("future-mutated", changed)):
        run = root/label
        write(run/"raw.json", data)
        command([sys.executable, root/"asof_input.py", "--raw", run/"raw.json", "--origin", 7,
            "--horizon", 2, "--out", run/"input/snapshot.json"], run, "projection")
        command([sys.executable, root/"check_projection.py", "--raw", run/"raw.json", "--origin", 7,
            "--horizon", 2, "--snapshot", run/"input/snapshot.json", "--out", run/"check.json"], run, "check")
        facts[label] = json.loads((run/"input/snapshot.json").read_text(encoding="utf-8"))
        program, output = run/"program", run/"output"
        program.mkdir();output.mkdir()
        shutil.copy2(root/"forecast_reference.py", program/"forecast_reference.py")
        name = "oc-l02-asof-"+label+"-"+uuid.uuid4().hex[:10]
        p = command(["docker", "create", "--name", name, "--network", "none", "--cpus", "1", "--read-only",
            "-e", "PYTHONDONTWRITEBYTECODE=1", "--mount", "type=bind,src="+str(program)+",dst=/program,readonly",
            "--mount", "type=bind,src="+str(run/"input")+",dst=/input,readonly",
            "--mount", "type=bind,src="+str(output)+",dst=/output", IMAGE,
            "/opt/cpsat/bin/python", "/program/forecast_reference.py", "--input", "/input/snapshot.json",
            "--out", "/output/predictions.json"], run, "create")
        cid = p.stdout.strip()
        command(["docker", "start", "-a", cid], run, "execution")
        inspected = command(["docker", "inspect", cid], run, "inspect")
        state = json.loads(inspected.stdout)[0]
        write(run/"inspect-full.json", state)
        mounts[label] = state["Mounts"]
        assert state["State"]["Status"] == "exited" and state["State"]["ExitCode"] == 0
        assert state["HostConfig"]["NetworkMode"] == "none" and state["HostConfig"]["NanoCpus"] == 10**9
        assert state["HostConfig"]["ReadonlyRootfs"] is True
        assert {(x["Destination"], x["RW"]) for x in mounts[label]} == {("/program",False),("/input",False),("/output",True)}
        predictions[label] = json.loads((output/"predictions.json").read_text(encoding="utf-8"))
        command(["docker", "rm", cid], run, "cleanup")
    assert facts["base"] == facts["future-mutated"]
    assert predictions["base"] == predictions["future-mutated"]
    actual = [Fraction(r["value"]["numerator"], r["value"]["denominator"]) for r in predictions["base"]["forecasts"]]
    assert actual == [24,26]
    assert sum(abs(x-y) for x,y in zip(actual,[24,26]))/2 == 0
    assert sum(abs(22-y) for y in [24,26])/2 == 3
    control = root/"controls";control.mkdir()
    def probe(name, snapshot, status, error):
        write(control/(name+".json"), snapshot)
        command([sys.executable,root/"check_projection.py","--raw",root/"base/raw.json","--origin",7,
            "--horizon",2,"--snapshot",control/(name+".json"),"--out",control/(name+"-result.json")],control,name+"-cli",2)
        result=json.loads((control/(name+"-result.json")).read_text(encoding="utf-8"))
        assert result["status"] == status
        assert result.get("error") == error or any(f["error"]==error for f in result.get("findings",[]))
    late=copy.deepcopy(facts["base"]);late["observations"].append(raw["observations"][-1])
    probe("late-revision",late,"availability_violation","availability_violation")
    ex_post=copy.deepcopy(facts["base"]);ex_post["covariates"].append(raw["covariates"][-1])
    probe("ex-post-covariate",ex_post,"availability_violation","availability_violation")
    forged=copy.deepcopy(facts["base"]);forged["origin"]=9
    probe("forged-origin",forged,"input_invalid","assigned_origin_horizon_mismatch")
    command([sys.executable,root/"asof_input.py","--raw",root/"base/raw.json","--origin",9,"--horizon",2,
        "--out",root/"origin9.json"],root,"origin9-projection")
    command([sys.executable,root/"check_projection.py","--raw",root/"base/raw.json","--origin",9,"--horizon",2,
        "--snapshot",root/"origin9.json","--out",root/"origin9-check.json"],root,"origin9-check")
    assert raw["observations"][-1] in json.loads((root/"origin9.json").read_text(encoding="utf-8"))["observations"]
    result={"status":"local_asof_qualification_passed","at":datetime.now(timezone.utc).isoformat(),
        "worker_executions":2,"exact_predictions":[24,26],"base_mae":0,"last_value_mae":3,
        "controlled_errors":["late_revision","ex_post_covariate","forged_origin"],
        "late_revision_available_at_origin9":True,"candidate_score":None,"frozen":False,
        "limitations":"single synthetic integer-tick series, point reference, not full L02 or hours or statistical reliability"}
    write(root/"result.json",result)
    print(json.dumps(result),flush=True)


if __name__ == "__main__":
    p=argparse.ArgumentParser();p.add_argument("--out",type=Path,required=True);a=p.parse_args();main(a.out.resolve())
