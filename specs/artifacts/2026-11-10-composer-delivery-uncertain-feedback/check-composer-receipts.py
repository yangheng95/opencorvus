
from pathlib import Path
import json, sqlite3, subprocess, sys
root=Path(sys.argv[1])
load=lambda n:json.loads((root/n).read_text(encoding="utf-8-sig"))
cfg=load("fixture-config.json")
proxy=[json.loads(line) for line in (root/"desktop-receipts.jsonl").read_text(encoding="utf-8").splitlines()]
sends=[r for r in proxy if "attempt" in r]
assert len(sends)==5
chat=[r for r in sends if r["route"].startswith("/session/")]
assert len(chat)==1 and chat[0]["accepted"]["parentID"]==chat[0]["sent"]["key"]
mission={}
for lang,prefix in [("en","English receipt review:"),("zh","中文回执复核：")]:
    group=[r for r in sends if r["sent"]["text"].startswith(prefix)]
    assert [r["attempt"] for r in group]==[1,2]
    assert group[0]["sent"]==group[1]["sent"] and group[0]["accepted"]==group[1]["accepted"]
    assert group[0]["upstreamRequestID"] != group[1]["upstreamRequestID"]
    assert [r["browserResponse"] for r in group]==["truncated after 16 bytes","complete"]
    mission[lang]=group
assert chat[0]["browserResponse"]=="truncated after 16 bytes" and all(r["upstreamStatus"]==200 for r in sends)
assert len({chat[0]["accepted"]["sessionID"],*(r[0]["accepted"]["sessionID"] for r in mission.values())})==3
db=root/"profile"/"data"/"opencorvus.db"
facts={}
with sqlite3.connect(db.as_uri()+"?mode=ro",uri=True) as cx:
    cx.row_factory=sqlite3.Row
    for label,r in [("acceptedSession",chat[0]),*[(lang,group[0]) for lang,group in mission.items()]]:
        sid=r["accepted"]["sessionID"]
        session=dict(cx.execute("select id,project_id,directory,kind from session where id=?",(sid,)).fetchone())
        assert Path(session["directory"])==Path(cfg["directory"])
        users=[dict(v) for v in cx.execute("""select id,json_extract(data,'$.model.providerID') provider,
          json_extract(data,'$.model.modelID') model,json_extract(data,'$.extra.wake_reason.requestID') requestID,
          json_extract(data,'$.extra.wake_reason.openedEventID') openedEventID
          from message where session_id=? and json_extract(data,'$.role')='user'""",(sid,))]
        assert len(users)==1 and (users[0]["provider"],users[0]["model"])==("b160-review","offline")
        user=users[0]
        texts=[row[0] for row in cx.execute("select json_extract(data,'$.text') from part where message_id=? and json_extract(data,'$.type')='text'",(user["id"],))]
        assert texts==[r["sent"]["text"]]
        assistant=[dict(v) for v in cx.execute("""select id,json_extract(data,'$.parentID') parentID,
          json_extract(data,'$.error.name') error,json_extract(data,'$.time.completed') completed
          from message where session_id=? and json_extract(data,'$.role')='assistant'""",(sid,))]
        assert len(assistant)==1 and assistant[0]["parentID"]==user["id"] and assistant[0]["completed"]
        opened=[dict(v) for v in cx.execute("""select id,source from protocol_event where aggregate_type='session'
          and aggregate_id=? and type='mission.execution.opened'""",(sid,))]
        if label=="acceptedSession":
            assert assistant[0]["id"]==r["accepted"]["assistantMessageID"] and user["id"]==r["sent"]["key"]
        else:
            assert len(opened)==1 and opened[0]["id"]==user["openedEventID"]
            assert user["requestID"]==r["sent"]["key"]
        facts[label]={"session":session,"user":user,"text":texts[0],"assistant":assistant[0],"opened":opened}
    counts={t:cx.execute("select count(*) from "+t).fetchone()[0] for t in ("session","project","engine_task","automation_run","provider_usage_event")}
    assert counts["session"]==3 and counts["engine_task"]==counts["automation_run"]==counts["provider_usage_event"]==0
    version=cx.execute("pragma user_version").fetchone()[0]
    integrity=cx.execute("pragma integrity_check").fetchone()[0]
    foreign=len(cx.execute("pragma foreign_key_check").fetchall())
    assert version==12 and integrity=="ok" and foreign==0
head=subprocess.check_output(["git","-C",cfg["directory"],"rev-parse","HEAD"],text=True).strip()
assert head==cfg["head"] and (Path(cfg["directory"])/"notes.txt").read_text()=="Isolated B160 desktop receipt feedback"
out={"acceptedSession":chat[0],"missions":mission,"persisted":facts,"counts":counts,"version":version,
     "integrity":integrity,"foreignKeyIssues":foreign,"gitFixtureIntact":True}
(root/"desktop-acceptance.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"counts":counts,"facts":list(facts),"schemaVersion":version}))
