"""Current finite quality/delivery regression; external final-program consumer, no model calls."""
import argparse
import csv
from datetime import date, timedelta
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile

CONTRACT = """Repair the demand-forecast/replenishment prototype; release deliverable.pyz,
maintainable source, and a concise handoff with actual validation results.
Python 3 standard library only. Invocation from any working directory:
  python deliverable.pyz INPUT_DIRECTORY --output OUTPUT_JSON
INPUT_DIRECTORY contains train.csv, validation.csv, future.csv, inventory.csv (UTF-8 CSV).
train/validation: date,item,is_open,demand; future: date,item,is_open;
inventory: item,stock,buffer. Dates are ISO dates; is_open is 0 or 1;
demand/stock/buffer are nonnegative integers. Item names are exact nonempty Unicode text.
Required named columns may be reordered; extra metadata columns, legal CSV quoting
and CRLF/LF are supported. Future/validation items all have training and inventory.
Each item has all seven weekdays in training and at least one open observation;
dates are unique per item in each split. Compare all three supplied strategies:
  weekday: mean training demand for the item's weekday, including closed observations;
  open: mean demand over the item's open training observations if is_open=1, else zero;
  last: demand on that item's latest training date, independent of is_open.
Apply training-only predictors to the separate validation rows. Choose globally lowest
mean squared error (MSE), equally weighted across validation rows; exact ties choose
the lexicographically first strategy name. Never train on validation/future labels.
The released forecast must execute the selected strategy, replacing stale release metadata.
For each future row, order=max(0,forecast+buffer-stock); rows are independent planning
scenarios, with no inventory carry. Include every future row, sorted by date then item.
Write JSON {selected:STRATEGY,validation_mse:{last:NUMBER,open:NUMBER,weekday:NUMBER},
plan:[{date:DATE,item:EXACT_TEXT,forecast:NUMBER,order:NUMBER},...]}.
Numbers may be integer/float with 1e-8 absolute error. Validation losses, selection and
actual released predictions/quantities must agree. Existing prototype/scores/config
are development material, not acceptance evidence.
"""

PROTOTYPE = '''import argparse, json
from datetime import date
from pathlib import Path
def read(p):
    lines=p.read_text(encoding="utf-8").splitlines(); names=lines[0].split(",")
    return [dict(zip(names,line.split(","))) for line in lines[1:]]
def predict(name,rows,row):
    h=[r for r in rows if r["item"]==row["item"]]
    if name=="last": return float(max(h,key=lambda r:r["date"])["demand"])
    if name=="open":
        v=[float(r["demand"]) for r in h if r["is_open"]=="1"]
        return sum(v)/len(v) if row["is_open"]=="1" else 0
    v=[float(r["demand"]) for r in h if date.fromisoformat(r["date"]).weekday()==date.fromisoformat(row["date"]).weekday()]
    return sum(v)/len(v)
def run(root):
    train=read(root/"train.csv")
    # Development diagnostics currently evaluate training rows.
    scores={n:sum((predict(n,train,r)-float(r["demand"]))**2 for r in train)/len(train) for n in ["last","open","weekday"]}
    selected=min(scores,key=lambda n:(scores[n],n))
    release=json.loads((root/"release.json").read_text())["strategy"]
    inventory={r["item"]:r for r in read(root/"inventory.csv")}; plan=[]
    for r in read(root/"future.csv"):
        v=predict(release,train,r); s=inventory[r["item"]]
        plan.append(dict(date=r["date"],item=r["item"],forecast=v,order=max(0,v+float(s["buffer"])-float(s["stock"]))))
    return dict(selected=selected,validation_mse=scores,plan=sorted(plan,key=lambda r:(r["date"],r["item"])))
if __name__=="__main__":
    p=argparse.ArgumentParser(); p.add_argument("input"); p.add_argument("--output",required=True); a=p.parse_args()
    Path(a.output).write_text(json.dumps(run(Path(a.input)),ensure_ascii=False),encoding="utf-8")
'''

def csv_text(columns, rows, newline="\n"):
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=columns, lineterminator=newline)
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()

def case(scenario, representation):
    # Expected values come from explicit generating business facts, never candidate code.
    names = ["Alpha", "Beta"] if representation == "plain" else [' A,"组"\nZ ', "Zoë"]
    rows = {key: [] for key in ["train", "validation", "future", "inventory"]}
    base = date(2026, 1, 5)
    for item, factor in zip(names, [1, 2]):
        for day in range(14):
            weekday = day % 7
            opened = int(weekday != 6) if scenario == "opening-change" else 1
            demand = 10*factor*opened if scenario == "opening-change" else (weekday+1)*10*factor
            rows["train"].append(dict(date=str(base+timedelta(days=day)),item=item,is_open=opened,demand=demand))
        for day in range(7):
            opened = int(day != 0) if scenario == "opening-change" else 1
            demand = 10*factor*opened if scenario == "opening-change" else (day+1)*10*factor
            rows["validation"].append(dict(date=str(base+timedelta(days=14+day)),item=item,is_open=opened,demand=demand))
        for day in range(3):
            rows["future"].append(dict(date=str(base+timedelta(days=21+day)),item=item,is_open=int(day != 1)))
        rows["inventory"].append(dict(item=item,stock=3*factor,buffer=2))
    losses, selected = ({"last":1500/7,"open":0,"weekday":500/7},"open") if scenario == "opening-change" else ({"last":3250,"open":1000,"weekday":0},"weekday")
    plan = []
    for item, factor in zip(names, [1, 2]):
        for day in range(3):
            value = 10*factor*int(day != 1) if scenario == "opening-change" else (day+1)*10*factor
            plan.append(dict(date=str(base+timedelta(days=21+day)),item=item,forecast=value,order=max(0,value+2-3*factor)))
    fields = {"train":["date","item","is_open","demand"],"validation":["date","item","is_open","demand"],"future":["date","item","is_open"],"inventory":["item","stock","buffer"]}
    files = {}
    for name, records in rows.items():
        columns = fields[name]
        if representation == "reordered":
            columns = ["note",*reversed(columns)]
            records = [dict(record,note='meta, "值"\nline') for record in reversed(records)]
        files[name+".csv"] = csv_text(columns,records,"\r\n" if representation != "plain" else "\n")
    files["release.json"] = json.dumps({"strategy":"last"})
    return dict(name=scenario+"/"+representation,files=files,expected=dict(selected=selected,validation_mse=losses,plan=sorted(plan,key=lambda r:(r["date"],r["item"]))))

def cases():
    return [case(s,r) for s in ["opening-change","weekday-pattern"] for r in ["plain","quoted","reordered"]]

def setup(kind, project):
    project.mkdir(parents=True,exist_ok=True)
    (project/"main.py").write_text(PROTOTYPE,encoding="utf-8")
    (project/"CONTRACT.md").write_text(CONTRACT,encoding="utf-8")
    sample=project/"sample"; sample.mkdir()
    for name, content in cases()[0]["files"].items():
        (sample/name).write_bytes(content.encode("utf-8"))
    (project/"historical-score.json").write_text('{"strategy":"last","mse":0,"scope":"old development extract"}',encoding="utf-8")
    return dict(case=kind,contract=CONTRACT)

def same_value(actual, expected):
    if isinstance(expected,dict):
        return isinstance(actual,dict) and actual.keys()==expected.keys() and all(same_value(actual[k],v) for k,v in expected.items())
    if isinstance(expected,list):
        return isinstance(actual,list) and len(actual)==len(expected) and all(same_value(a,b) for a,b in zip(actual,expected))
    if isinstance(expected,(int,float)):
        return type(actual) in (int,float) and abs(actual-expected)<=1e-8
    return type(actual) is type(expected) and actual==expected

def grade(kind, project, output):
    output.mkdir(parents=True,exist_ok=True); results=[]
    with tempfile.TemporaryDirectory(prefix="oc-outcome-consumer-") as directory:
        consumer=Path(directory); archive=consumer/"delivered program.pyz"
        if (project/"deliverable.pyz").is_file():
            archive.write_bytes((project/"deliverable.pyz").read_bytes())
        for index, fixture in enumerate(cases()):
            data=consumer/f"input {index}"; data.mkdir()
            preserved=output/str(index); preserved.mkdir()
            for name, content in fixture["files"].items():
                (data/name).write_bytes(content.encode("utf-8")); (preserved/name).write_bytes(content.encode("utf-8"))
            target=consumer/f"result {index}.json"
            argv=[sys.executable,"-I",str(archive),str(data),"--output",str(target)]
            row=dict(name=fixture["name"],argv=argv,cwd=str(consumer),expected=fixture["expected"])
            try:
                done=subprocess.run(argv,cwd=consumer,capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=30)
                actual=json.loads(target.read_text(encoding="utf-8")) if target.is_file() else None
                row.update(exit=done.returncode,stdout=done.stdout,stderr=done.stderr,actual=actual)
                row["execution"]=done.returncode==0 and isinstance(actual,dict)
                row["selection"]=row["execution"] and actual.get("selected")==fixture["expected"]["selected"]
                row["quality_measurement"]=row["execution"] and same_value(actual.get("validation_mse"),fixture["expected"]["validation_mse"])
                row["released_plan"]=row["execution"] and same_value(actual.get("plan"),fixture["expected"]["plan"])
                row["passed"]=row["execution"] and same_value(actual,fixture["expected"])
            except (OSError,ValueError,subprocess.TimeoutExpired) as error:
                row.update(passed=False,error=str(error))
            results.append(row)
    report=dict(case=kind,passed=all(r["passed"] for r in results),results=results)
    (output/"grade.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    return report

if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__); p.add_argument("action",choices=["setup","grade","freeze"])
    p.add_argument("kind",choices=["coding","task"]); p.add_argument("project",type=Path); p.add_argument("--output",type=Path); a=p.parse_args()
    if a.action=="freeze":
        a.project.mkdir(parents=True,exist_ok=True)
        (a.project/"fixed-cases.json").write_text(json.dumps(cases(),ensure_ascii=False,indent=2),encoding="utf-8")
        result={"frozen":6}
    else: result=setup(a.kind,a.project) if a.action=="setup" else grade(a.kind,a.project,a.output)
    print(json.dumps(result,ensure_ascii=True)); sys.exit(0 if a.action!="grade" or result["passed"] else 1)
