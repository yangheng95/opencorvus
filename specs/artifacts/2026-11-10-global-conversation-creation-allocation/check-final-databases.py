import json, os, pathlib, sqlite3, subprocess
root=pathlib.Path(os.environ["TEMP"])/"opencorvus-iteration-20261110-b155"
def read(name):
    return json.loads((root/name).read_text(encoding="utf-8-sig"))
def project_session(entry):
    body=entry["body"]
    return body.get("session",body)
initial=read("after-initial-acceptance.json")
restart=read("after-restart-acceptance.json")
prepared=read("prepared-v11-global-work.json")
old=read("before-rows-private.json")
fresh=read("fresh-creation.json")
tables=("session","project","global_creation_allocation","message","engine_task","provider_usage_event")
def facts(profile,counts):
    db=root/profile/"data"/"opencorvus.db"
    cx=sqlite3.connect(db.as_uri()+"?mode=ro",uri=True)
    cx.row_factory=sqlite3.Row
    version=cx.execute("pragma user_version").fetchone()[0]
    integrity=cx.execute("pragma integrity_check").fetchone()[0]
    errors=cx.execute("pragma foreign_key_check").fetchall()
    actual={t:cx.execute("select count(*) from "+t).fetchone()[0] for t in tables}
    assert version==11 and integrity=="ok" and not errors and list(actual.values())==counts,actual
    return cx,{"version":version,"integrity":integrity,"foreignKeyIssues":len(errors),"counts":actual}
def identity(cx,kind,request,target):
    row=cx.execute("select * from global_creation_allocation where kind=? and request_id=?",(kind,request)).fetchone()
    assert row and row["time_accepted"] and row["materialized_project_id"]==row["accepted_project_id"]==target["projectID"]
    assert row["accepted_target_id"]==target["id"]
    session=cx.execute("select * from session where id=?",(target["id"],)).fetchone()
    if row["time_project_retained"] is None:
        project=cx.execute("select * from project where id=?",(target["projectID"],)).fetchone()
        assert session["project_id"]==target["projectID"] and session["directory"]==row["directory"]
        assert row["materialized_project_generation"]==project["generation"]
        m=json.loads(session["metadata"])
        assert m["globalConversationCreation"]["requestID"]==request
        assert m["conversation"]["experience"]==kind.split("_")[1]
        if "metadata" in target:
            assert m["configOverlay"]==target["metadata"]["configOverlay"]
    else:
        assert cx.execute("select count(*) from project where id=?",(target["projectID"],)).fetchone()[0]==0
        assert session is None
    return {"kind":kind,"requestID":request,"allocationID":row["id"],"sessionID":target["id"],"projectID":target["projectID"],"projectGeneration":row["materialized_project_generation"],"projectRemoved":row["time_project_retained"] is not None}
upgraded,result=facts("profile-before-ready",[7,7,7,0,0,0])
with upgraded:
    for table, rows in old.items():
        for oldrow in rows:
            new=dict(upgraded.execute("select rowid as physicalRowID,* from "+table+" where id=?",(oldrow["id"],)).fetchone())
            # Project last-activity fields may advance when the isolated desktop opens the project.
            if table=="project":
                for key in ("physicalRowID","id","generation","worktree"):
                    assert oldrow[key]==new[key],(table,key)
            else:
                assert new==oldrow,table
    result["preservedLegacyRows"]={t:len(rows) for t,rows in old.items()}
    result["accepted"]=[identity(upgraded,"global_"+experience+"_create",req,project_session(entry)) for experience,req,entry in [
        ("chat","isolated-global-conversation-shared",restart["chat"]),
        ("work","isolated-global-conversation-shared",restart["work"]),
        ("chat","isolated-independent-global-chat",initial["independent"]),
        ("work","isolated-deleted-global-work",initial["owned"]),
        ("work",prepared["requestID"],restart["prepared"]),
    ]]
    assert result["accepted"][-1]["allocationID"]==prepared["allocationID"]
    assert result["accepted"][-2]["projectRemoved"]
fresh_db,fresh_result=facts("profile-fresh-ready",[1,1,1,0,0,0])
with fresh_db:
    fresh_result["accepted"]=identity(fresh_db,"global_chat_create",fresh["creationRequestID"],{"id":fresh["sessionID"],"projectID":fresh["projectID"]})
fresh_db.close()
seed=read("seed.json")
project=pathlib.Path(seed["directory"])
head=subprocess.check_output(["git","-C",str(project),"rev-parse","HEAD"],text=True).strip()
assert head==seed["head"] and (project/"notes.txt").read_text(encoding="utf-8")==seed["notes"]
result["isolatedProjectGitHead"]=head
result["isolatedProjectNotePreserved"]=True
for name,value in [("after-database.json",result),("fresh-database.json",fresh_result)]:
    (root/name).write_text(json.dumps(value,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(value))
