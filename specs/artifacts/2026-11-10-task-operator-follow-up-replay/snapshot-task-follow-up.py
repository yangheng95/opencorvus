
from pathlib import Path
import json, sqlite3, sys
root=Path(sys.argv[1])
def get(n):return json.loads((root/(n+".json")).read_text(encoding="utf-8-sig"))
base=get("before-task-follow-up")
terminal=get("before-terminal-replay")
main=base["task"]["data"]["task_id"]; peer=base["sibling"]["data"]["task_id"]
expected={main:{x["data"]["user"]["id"] for x in [base["first"],base["replay"],*base["concurrent"]]}|{terminal[k]["userMessageID"] for k in ("reopened","repeated")},
          peer:{base["peer"]["data"]["user"]["id"]}}
db=root/"profile"/"data"/"opencorvus.db"
with sqlite3.connect(db.as_uri()+"?mode=ro",uri=True) as cx:
    cx.row_factory=sqlite3.Row
    facts={}
    for task in (main,peer):
        root_row=dict(cx.execute("select t.id,t.project_id,t.session_id,s.directory from engine_task t join session s on s.id=t.session_id where t.id=?",(task,)).fetchone())
        rows=[dict(r) for r in cx.execute("""select i.id,i.source_id messageID,i.execution_epoch,i.sequence,i.project_id,m.session_id messageSessionID,s.parent_id messageParentID,s.kind messageSessionKind,
          json_extract(m.data,'$.extra.task_root_message.kind') kind,json_extract(m.data,'$.extra.task_root_message.source') source,
          json_extract(m.data,'$.model.providerID') provider,json_extract(m.data,'$.model.modelID') model,
          (select json_extract(p.data,'$.text') from part p where p.message_id=m.id and json_extract(p.data,'$.type')='text' limit 1) text
          from engine_task_root_ingress i join message m on m.id=i.source_id join session s on s.id=m.session_id
          where i.task_id=? and i.source='message' and (m.session_id=? or (s.parent_id=? and s.kind='orchestrator')) and json_extract(m.data,'$.extra.task_root_message.kind')='operator'
          order by i.execution_epoch,i.sequence""",(task,root_row["session_id"],root_row["session_id"]))]
        assert {r["messageID"] for r in rows}==expected[task],rows
        assert len({r["id"] for r in rows})==len(rows)
        assert all(r["source"]=="panel" and (r["provider"],r["model"])==("b161-review","offline") for r in rows),rows
        events=[dict(r) for r in cx.execute("""select id,type,seq,source,json_extract(payload,'$.execution_epoch') epoch from protocol_event
          where aggregate_type='task' and aggregate_id=? and type in ('task.execution.opened','task.execution.reopened','task.failed','task.cancelled','task.completed')
          order by seq,id""",(task,))]
        facts[task]={"task":root_row,"ingress":rows,"lifecycleEvents":events}
    assert [r["execution_epoch"] for r in facts[main]["ingress"]]==[1,1,1,1,2,3]
    assert facts[main]["task"]["project_id"]!=facts[peer]["task"]["project_id"]
    assert terminal["reopened"]["ingressID"]==facts[main]["ingress"][-2]["id"]
    assert terminal["repeated"]["ingressID"]==facts[main]["ingress"][-1]["id"]
    counts={t:cx.execute("select count(*) from "+t).fetchone()[0] for t in ("session","project","engine_task","automation_run","provider_usage_event")}
    assert counts["engine_task"]==2 and counts["automation_run"]==counts["provider_usage_event"]==0
    version=cx.execute("pragma user_version").fetchone()[0]
    integrity=cx.execute("pragma integrity_check").fetchone()[0]
    foreign=len(cx.execute("pragma foreign_key_check").fetchall())
    assert version==12 and integrity=="ok" and foreign==0
(root/"before-database.json").write_text(json.dumps({"facts":facts,"counts":counts,"version":version,"integrity":integrity,"foreignKeyIssues":foreign},indent=2)+"\n",encoding="utf-8")
print(json.dumps({"ingresses":{key:len(v["ingress"]) for key,v in facts.items()},"counts":counts,"schemaVersion":version}))
