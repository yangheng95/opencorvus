
from pathlib import Path
import json, sqlite3, sys
root=Path(sys.argv[1])
get=lambda n:json.loads((root/n).read_text(encoding="utf-8-sig"))
after=get("after-initial.json");before=get("before-task-follow-up.json");desktop_before=get("desktop-before-retry.json")
desktop=[json.loads(line) for line in (root/"desktop-task-receipts.jsonl").read_text().splitlines()]
sends=[r for r in desktop if "attempt" in r]
assert [r["attempt"] for r in sends]==[1,2]
a,b=sends
assert a["sent"]==b["sent"] and a["upstreamRequestID"]!=b["upstreamRequestID"]
assert [r["upstreamStatus"] for r in sends]==[202,202]
assert [r["browserResponse"] for r in sends]==["truncated after 16 bytes","complete"]
for k in ("taskID","userMessageID","ingressID","wakeStatus"):assert a["accepted"][k]==b["accepted"][k]
assert a["accepted"]["sessionID"]==desktop_before["rootSessionID"] and b["accepted"]["sessionID"]!=a["accepted"]["sessionID"]
assert desktop_before["lifecycle"]["epoch"]==2 and desktop_before["lifecycle"]["status"]=="failed"
desktop_after=get("desktop-after-retry.json")
assert desktop_after==desktop_before
loc=root/"profile"/"data"
backup,=list((loc/"migration-backups").glob("*.v12-to-v13.*.sqlite"))
def open_db(p):
    cx=sqlite3.connect(p.as_uri()+"?mode=ro",uri=True)
    cx.row_factory=sqlite3.Row
    return cx
def version(cx):return cx.execute("pragma user_version").fetchone()[0]
def read_all(cx,t):return [tuple(x) for x in cx.execute("select rowid,* from "+t+" order by rowid")]
def integrity(cx):return {"version":version(cx),"integrity":cx.execute("pragma integrity_check").fetchone()[0],
    "foreignKeyIssues":len(cx.execute("pragma foreign_key_check").fetchall())}
def facts(cx, task, ingress, msg):
    exact=dict(cx.execute("""select i.id,i.task_id,i.project_id,i.execution_epoch,i.sequence,i.source_id,
      m.session_id,s.kind,s.parent_id,json_extract(m.data,'$.extra.task_root_message.operatorRequest.requestID') requestID,
      json_extract(m.data,'$.model.providerID') provider,json_extract(m.data,'$.model.modelID') model
      from engine_task_root_ingress i join message m on m.id=i.source_id join session s on s.id=m.session_id
      where i.task_id=? and i.id=? and i.source_id=?""",(task,ingress,msg)).fetchone())
    exact["parts"]=[dict(r) for r in cx.execute("""select id,json_extract(data,'$.type') type,json_extract(data,'$.text') text,
      json_extract(data,'$.filename') filename from part where message_id=? order by id""",(msg,))]
    exact["moves"]=[dict(r) for r in cx.execute("""select occurrence_id,json_extract(properties,'$.sourceSessionID') sourceSessionID,
      json_extract(properties,'$.info.sessionID') targetSessionID from bus_publication_outbox
      where event_type='message.moved' and json_extract(properties,'$.info.id')=?""",(msg,))]
    return exact
counts={}
with open_db(root/"before-v12.db") as original, open_db(backup) as protected, open_db(loc/"opencorvus.db") as live:
    assert integrity(original)==integrity(protected)=={"version":12,"integrity":"ok","foreignKeyIssues":0}
    assert integrity(live)=={"version":13,"integrity":"ok","foreignKeyIssues":0}
    for table in ("project","session","engine_task","message","part","engine_task_root_ingress","protocol_event"):
        orig=read_all(original,table)
        assert orig==read_all(protected,table),table
        counts[table]=len(orig)
    old_ingress=[tuple(r) for r in protected.execute("select rowid,* from engine_task_root_ingress order by rowid")]
    assert set(old_ingress).issubset(set(read_all(live,"engine_task_root_ingress")))
    old_msg=[tuple(r) for r in protected.execute("select rowid,id,json_remove(data,'$.time','$.orderKey') from message order by rowid")]
    assert set(old_msg).issubset({tuple(r) for r in live.execute("select rowid,id,json_remove(data,'$.time','$.orderKey') from message")})
    old_parts=[tuple(r) for r in protected.execute("select rowid,id,message_id,data from part order by rowid")]
    assert set(old_parts).issubset({tuple(r) for r in live.execute("select rowid,id,message_id,data from part")})
    old_task=[tuple(r) for r in protected.execute("select rowid,id,project_id,session_id from engine_task order by rowid")]
    assert set(old_task).issubset({tuple(r) for r in live.execute("select rowid,id,project_id,session_id from engine_task")})
    old_sessions=[tuple(r) for r in protected.execute("select rowid,id,project_id,parent_id,kind from session order by rowid")]
    assert set(old_sessions).issubset({tuple(r) for r in live.execute("select rowid,id,project_id,parent_id,kind from session")})
    main=before["task"]["data"]["task_id"]; stable=after["moved"]
    primary=facts(live,main,stable["ingressID"],stable["user"]["id"])
    trial=b["accepted"]
    desktop_facts=facts(live,trial["taskID"],trial["ingressID"],trial["userMessageID"])
    assert primary["execution_epoch"]==4 and primary["kind"]=="orchestrator"
    assert desktop_facts["execution_epoch"]==2 and desktop_facts["kind"]=="orchestrator"
    assert desktop_facts["requestID"]==a["sent"]["key"] and desktop_facts["parts"][0]["text"]==a["sent"]["text"]
    assert desktop_facts["parent_id"]==a["accepted"]["sessionID"] and desktop_facts["session_id"]==b["accepted"]["sessionID"]
    assert len(desktop_facts["moves"])==1
    assert live.execute("select count(*) from message where json_extract(data,'$.extra.task_root_message.operatorRequest.requestID')=?",(a["sent"]["key"],)).fetchone()[0]==1
    assert live.execute("select count(*) from provider_usage_event").fetchone()[0]==0
out={"backup":backup.name,"oldBusinessRowsAndRowIDs":counts,"migrated":integrity(live),"preservedAcceptedOlderIngresses":len(old_ingress),
     "primary":primary,"desktop":{"sends":sends,"beforeRetry":desktop_before,"afterRetry":desktop_after,"facts":desktop_facts}}
(root/"after-database.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"previousRows":counts,"desktopIngress":desktop_facts["id"],"terminalEpoch":desktop_after["lifecycle"]["epoch"]}))
