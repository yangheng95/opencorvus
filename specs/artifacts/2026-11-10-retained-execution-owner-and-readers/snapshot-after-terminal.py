from pathlib import Path
import json,os,sqlite3,subprocess
root=Path(os.environ["TEMP"])/"opencorvus-iteration-20261110-b157"
def read(name): return json.loads((root/name).read_text(encoding="utf-8-sig"))
original=read("before-terminal-facts.json")
after=read("after-initial.json")
other=read("after-other-project.json")
new_missions={k:after[k]["data"]["sessionID"] for k in ("m2","archivedGone","concurrentTarget")}
new_missions["siblingAfterRestart"]=other["target"]["data"]["sessionID"]
path=root/"profile-final"/"data"/"opencorvus.db"
with sqlite3.connect(path.as_uri()+"?mode=ro",uri=True) as cx:
    cx.row_factory=sqlite3.Row
    version=cx.execute("pragma user_version").fetchone()[0]
    integrity=cx.execute("pragma integrity_check").fetchone()[0]
    foreign=len(cx.execute("pragma foreign_key_check").fetchall())
    counts={k:cx.execute("select count(*) from "+k).fetchone()[0] for k in ("project","session","engine_task","message","provider_usage_event")}
    assert version==12 and integrity=="ok" and foreign==0 and counts["provider_usage_event"]==0
    def events(kind,ident):
        return [dict(x) for x in cx.execute("select type,correlation_id,seq,source from protocol_event where aggregate_type=? and aggregate_id=? order by seq,id",(kind,ident))]
    def session(id):
        return cx.execute("select id,project_id,title,time_archived from session where id=?",(id,)).fetchone()
    mission_facts={}
    for name,ident in new_missions.items():
        kept=session(ident)
        assert kept is not None
        history=events("session",ident)
        assert [e["type"] for e in history]==["mission.execution.closing","mission.execution.closed","mission.retention.delete_requested","session.deleted"] or name=="archivedGone",history
        assert sum(e["type"]=="mission.retention.delete_requested" for e in history)==1
        assert sum(e["type"]=="session.deleted" for e in history)==1
        assert history[0]["correlation_id"]==history[1]["correlation_id"]
        mission_facts[name]={"row":dict(kept),"history":history}
    visible=[dict(session(after[k]["data"]["sessionID"])) for k in ("m1","archivedLive")]
    assert visible[0]["time_archived"] is None and visible[1]["time_archived"] is not None
    task_facts={}
    task_ids={"newDirect":after["activeTask"]["data"]["task_id"],"newRoot":after["activeRoot"]["data"]["task_id"],
        "oldDirect":original["tasks"][0]["owner"]["id"],"oldRoot":original["tasks"][1]["owner"]["id"]}
    for name,ident in task_ids.items():
        row=dict(cx.execute("select id,project_id,session_id from engine_task where id=?",(ident,)).fetchone())
        history=[e for e in events("task",ident) if e["type"] in {"task.execution.opened","task.cancellation.requested","task.cancelled","task.deleted"}]
        assert [e["type"] for e in history]==["task.execution.opened","task.cancellation.requested","task.cancelled","task.deleted"],history
        assert history[1]["correlation_id"]==history[2]["correlation_id"]
        if name=="oldDirect":
            assert history[1]["correlation_id"]==read("before-task-stop.json")["gone"]["requestID"]
        if name=="oldRoot":
            assert history[1]["correlation_id"]==read("before-session-stop.json")["taskOwned"]["requestID"]
        session_history=events("session",row["session_id"])
        if name.endswith("Root"):
            assert any(e["type"]=="session.deleted" for e in session_history)
            assert session(row["session_id"])
        task_facts[name]={"task":row,"history":history,"sessionHistory":session_history}
    physical=after["createdSession"]["data"]["id"]
    physical_receipt=events("session",physical)
    assert physical_receipt[-1]["type"]=="session.deleted"
    assert session(physical) is None
    counts["sessionTombstones"]=cx.execute("select count(*) from protocol_event where type='session.deleted'").fetchone()[0]
    facts={"version":version,"integrity":integrity,"foreignKeyIssues":foreign,"counts":counts,"missions":mission_facts,"visible":visible,"tasks":task_facts,"standalone":{"sessionID":physical,"receipt":physical_receipt,"disposition":after["removed"]["data"]["status"]}}
seed=read("seed.json")
work=Path(seed["directory"])
head=subprocess.check_output(["git","-C",str(work),"rev-parse","HEAD"],text=True).strip()
assert head==seed["head"] and (work/"notes.txt").read_text(encoding="utf-8")==seed["notes"]
facts["isolatedGitNotePreserved"]=True
(root/"after-terminal-facts.json").write_text(json.dumps(facts,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"counts":counts,"missions":list(mission_facts),"tasks":list(task_facts),"standalone":facts["standalone"]["disposition"]}))
