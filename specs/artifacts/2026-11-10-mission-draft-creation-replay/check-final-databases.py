from pathlib import Path
import os,sqlite3,json,subprocess
root=Path(os.environ["TEMP"])/"opencorvus-iteration-20261110-b156"
def read(name):
    return json.loads((root/name).read_text(encoding="utf-8-sig"))
facts={}
for profile in ("profile-after","profile-desktop-clean"):
    database=root/profile/"data"/"opencorvus.db"
    with sqlite3.connect(database.as_uri()+"?mode=ro",uri=True) as cx:
        cx.row_factory=sqlite3.Row
        version=cx.execute("pragma user_version").fetchone()[0]
        integrity=cx.execute("pragma integrity_check").fetchone()[0]
        foreign=len(cx.execute("pragma foreign_key_check").fetchall())
        tables=("session","project","message","engine_task","automation_run","provider_usage_event")
        counts={t:cx.execute("select count(*) from "+t).fetchone()[0] for t in tables}
        sessions=[dict(x) for x in cx.execute("""select s.id,s.title,s.project_id,s.directory,
          json_extract(s.metadata,'$.mission.id') missionID,
          json_extract(s.metadata,'$.mission.draftCreation.requestID') requestID,
          json_extract(s.metadata,'$.mission.pendingPrompt.text') prompt,
          exists(select 1 from protocol_event p where p.aggregate_type='session' and p.aggregate_id=s.id and p.type='session.deleted') deleted
          from session s where s.kind='mission' order by s.title,s.id""")]
        assert version==12 and integrity=="ok" and foreign==0
        assert all(counts[name]==0 for name in tables[2:])
        if profile=="profile-desktop-clean":
            assert counts["session"]==counts["project"]==len(sessions)==1
            assert sessions[0]["id"]=="ses_hZO6XUjrffujepRpKGhB"
            assert sessions[0]["prompt"]=="Keep one visible Mission draft with this exact request."
        else:
            assert counts["session"]==11 and counts["project"]==3 and len(sessions)==10,counts
            assert sum(s["deleted"] for s in sessions)==2
            data=read("after-initial.json")
            project=next(s for s in sessions if s["id"]==data["afterMove"]["data"]["sessionID"])
            assert project["directory"]==data["move"]["data"]["directory"]
            events={s["id"]:[dict(e) for e in cx.execute("select id,correlation_id,type,source from protocol_event where aggregate_type='session' and aggregate_id=? order by seq,id",(s["id"],))] for s in sessions if s["deleted"]}
            expected=["mission.execution.closing","mission.execution.closed","mission.retention.delete_requested","session.deleted"]
            for e in events.values():
                assert [x["type"] for x in e]==expected,e
            facts["retentionEvents"]=events
        facts[profile]={"version":version,"integrity":integrity,"foreignKeyIssues":foreign,"counts":counts,"sessions":sessions}
for seed_file in ("seed.json","seed-other.json"):
    seed=read(seed_file)
    project=Path(seed["directory"])
    sha=subprocess.check_output(["git","-C",str(project),"rev-parse","HEAD"],text=True).strip()
    assert sha==seed["head"] and (project/"notes.txt").read_text(encoding="utf-8")==seed["notes"]
facts["bothIsolationNotesAndGitHeadsPreserved"]=True
(root/"after-database.json").write_text(json.dumps(facts,indent=2)+"\n",encoding="utf-8")
print({k:v.get("counts") for k,v in facts.items() if k.startswith("profile")})
