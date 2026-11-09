from pathlib import Path
import json,os,sqlite3,subprocess
root=Path(os.environ["TEMP"])/"opencorvus-iteration-20261110-b158"
def read(name):return json.loads((root/name).read_text(encoding="utf-8-sig"))
initial=read("after-initial.json")
unkeyed=read("after-unkeyed.json")
desktop=read("desktop-wake-acceptance.json")
ids=[initial["first"]["data"],initial["parallel"][0]["data"],initial["other"]["data"],initial["separate"]["data"],
    *(r["data"] for r in unkeyed["launches"]),desktop["desktop"][0]["accepted"]]
expected_keys=["one-b158-first-launch","one-b158-parallel-launch","one-b158-first-launch","another-b158-first-launch",
    None,None,desktop["desktop"][0]["sent"]["requestID"]]
assert len({r["sessionID"] for r in ids})==7
db=root/"profile-after"/"data"/"opencorvus.db"
with sqlite3.connect(db.as_uri()+"?mode=ro",uri=True) as cx:
    cx.row_factory=sqlite3.Row
    facts=[]
    for response,key in zip(ids,expected_keys,strict=True):
        sid=response["sessionID"]
        session=dict(cx.execute("select id,project_id,directory,title,json_extract(metadata,'$.mission.id') missionID from session where id=?",(sid,)).fetchone())
        assert session["missionID"]==response["missionID"]
        user=[dict(r) for r in cx.execute("""select id,json_extract(data,'$.model.providerID') provider,
          json_extract(data,'$.model.modelID') model,json_extract(data,'$.extra.wake_reason.requestID') requestID,
          json_extract(data,'$.extra.wake_reason.openedEventID') openedEventID
          from message where session_id=? and json_extract(data,'$.role')='user'""",(sid,))]
        event=[dict(r) for r in cx.execute("""select id,type,source,seq,correlation_id,json_extract(payload,'$.requestID') requestID from protocol_event
          where aggregate_type='session' and aggregate_id=? and type in
          ('mission.execution.opened','mission.execution.closing','mission.execution.closed','session.deleted') order by seq,id""",(sid,))]
        opened=[e for e in event if e["type"]=="mission.execution.opened"]
        assert len(user)==len(opened)==1,(user,event)
        assert user[0]["requestID"]==opened[0]["requestID"] and user[0]["openedEventID"]==opened[0]["id"]
        assert (user[0]["provider"],user[0]["model"])==("b158-loopback","offline")
        if key is not None: assert user[0]["requestID"]==key
        else: assert len(user[0]["requestID"])==36
        facts.append({"session":session,"userMessage":user[0],"events":event})
    assert len({facts[0]["session"]["project_id"],facts[2]["session"]["project_id"]})==2
    assert facts[0]["events"][-1]["type"]=="mission.execution.closed"
    assert facts[3]["events"][-1]["type"]=="session.deleted"
    counts={t:cx.execute("select count(*) from "+t).fetchone()[0] for t in ("session","project","engine_task","automation_run","provider_usage_event")}
    assert counts=={"session":7,"project":2,"engine_task":0,"automation_run":0,"provider_usage_event":0},counts
    version=cx.execute("pragma user_version").fetchone()[0]
    integrity=cx.execute("pragma integrity_check").fetchone()[0]
    foreign=len(cx.execute("pragma foreign_key_check").fetchall())
    assert version==12 and integrity=="ok" and not foreign
for name in ("project-mission-wake","project-wake-sibling"):
    seed=read(name+"-seed.json")
    p=Path(seed["directory"])
    head=subprocess.check_output(["git","-C",str(p),"rev-parse","HEAD"],text=True).strip()
    assert head==seed["head"] and (p/"notes.txt").read_text(encoding="utf-8")==seed["notes"]
result={"version":version,"integrity":integrity,"foreignKeyIssues":foreign,"counts":counts,"isolatedGitNotesPreserved":True,"launches":facts}
(root/"after-database.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"counts":counts,"launches":len(facts),"version":version}))
