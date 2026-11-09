
from pathlib import Path
import json, sqlite3, sys
root=Path(sys.argv[1])
phase=sys.argv[2]
db=root/"profile"/"data"/"opencorvus.db"
def read(name):
    return json.loads((root/(name+".json")).read_text(encoding="utf-8-sig"))
seed=read("seed")
observed=read(phase)
sids={k:seed[k]["data"]["sessionID"] for k in ("first","implicit","dispatch","terminal","sibling")}
sids["currentFresh"]=observed["currentFresh"]["data"]["sessionID"]
with sqlite3.connect(db.as_uri()+"?mode=ro",uri=True) as cx:
    cx.row_factory=sqlite3.Row
    facts={}
    for name,sid in sids.items():
        session=dict(cx.execute("""select id,project_id,directory,title,json_extract(metadata,'$.mission.id') missionID,
            json_extract(metadata,'$.configOverlay.model') overlayModel from session where id=?""",(sid,)).fetchone())
        users=[dict(r) for r in cx.execute("""select id,json_extract(data,'$.model.providerID') provider,
          json_extract(data,'$.model.modelID') model,json_extract(data,'$.extra.wake_reason.requestID') requestID,
          json_extract(data,'$.extra.wake_reason.openedEventID') openedEventID
          from message where session_id=? and json_extract(data,'$.role')='user' order by id""",(sid,))]
        events=[dict(r) for r in cx.execute("""select id,type,source,seq,correlation_id from protocol_event where
          aggregate_type='session' and aggregate_id=? and type in
          ('mission.execution.opened','mission.execution.closing','mission.execution.closed','session.deleted') order by seq,id""",(sid,))]
        assistant=[dict(r) for r in cx.execute("""select id,json_extract(data,'$.parentID') parentID,
          json_extract(data,'$.error.name') error,json_extract(data,'$.time.completed') completed
          from message where session_id=? and json_extract(data,'$.role')='assistant' order by id""",(sid,))]
        assert len(users)==1 and len([e for e in events if e["type"]=="mission.execution.opened"])==1
        assert users[0]["openedEventID"]==events[0]["id"]
        facts[name]={"session":session,"users":users,"events":events,"assistant":assistant}
    assert facts["terminal"]["events"][-1]["type"]=="mission.execution.closed"
    assert facts["first"]["session"]["project_id"] != facts["sibling"]["session"]["project_id"]
    counts={t:cx.execute("select count(*) from "+t).fetchone()[0] for t in ("session","project","engine_task","automation_run","provider_usage_event")}
    version=cx.execute("pragma user_version").fetchone()[0]
    integrity=cx.execute("pragma integrity_check").fetchone()[0]
    foreign=len(cx.execute("pragma foreign_key_check").fetchall())
    assert version==12 and integrity=="ok" and foreign==0
out={"version":version,"integrity":integrity,"foreignKeyIssues":foreign,"counts":counts,"facts":facts}
(root/(phase+"-database.json")).write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"facts":list(facts),"counts":counts,"version":version,"assistantReplies":{k:len(v["assistant"]) for k,v in facts.items()}}))
