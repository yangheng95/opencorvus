from pathlib import Path
import json,os,sqlite3
root=Path(os.environ["TEMP"])/"opencorvus-iteration-20261110-b157"
def read(name): return json.loads((root/name).read_text(encoding="utf-8-sig"))
m=read("before-baseline.json")
t=read("before-task-stop.json")
s=read("before-session-stop.json")
ids={m["deletion"]["requestID"],t["gone"]["requestID"],s["taskOwned"]["requestID"]}
logged=[]
for line in (root/"profile-before"/"log"/"dev.log").read_text(encoding="utf-8").splitlines():
    r=json.loads(line); d=r.get("data",{})
    if d.get("requestID") not in ids or r.get("message")!="request failed":continue
    e=d["error"]
    logged.append({"time":r["time"],"requestID":d["requestID"],"method":d["method"],"path":d["path"],"error":e["message"],"stackFunctions":[x.strip().split(" (")[0] for x in e["stack"].splitlines()[1:12]]})
assert {x["requestID"] for x in logged}==ids and all(x["error"]=="No context found for instance" for x in logged)
f=root/"profile-before"/"data"/"opencorvus.db"
with sqlite3.connect(f.as_uri()+"?mode=ro",uri=True) as db:
    db.row_factory=sqlite3.Row
    def task(id):
        return dict(db.execute("select id,session_id,project_id from engine_task where id=?",(id,)).fetchone())
    def events(aggregate_type,aggregate_id):
        return [dict(x) for x in db.execute("select type,correlation_id,seq,source from protocol_event where aggregate_type=? and aggregate_id=? order by seq,id",(aggregate_type,aggregate_id))]
    t1=task(t["created"]["body"]["task_id"]); t2=task(s["task"]["body"]["task_id"])
    mission=events("session",m["disposable"]["body"]["sessionID"])
    standalone=events("session",s["create"]["body"]["id"])
    model_usage=db.execute("select count(*) from provider_usage_event").fetchone()[0]
    counts={name:db.execute("select count(*) from "+name).fetchone()[0] for name in ("session","project","message","engine_task","provider_usage_event")}
    result={"httpFailureDiagnostics":logged,"missionEvents":mission,
        "tasks":[{"owner":row,"taskEvents":events("task",row["id"]),"sessionEvents":events("session",row["session_id"])} for row in (t1,t2)],
        "standaloneSessionEvents":standalone,"counts":counts,"integrity":db.execute("pragma integrity_check").fetchone()[0]}
(root/"before-terminal-facts.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result))
