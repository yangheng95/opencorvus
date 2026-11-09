from pathlib import Path
import json,os,sqlite3
root=Path(os.environ["TEMP"])/"opencorvus-iteration-20261110-b158"
facts=json.loads((root/"before-wake-replays.json").read_text(encoding="utf-8"))
receipts=[facts["one"],facts["replay"],*facts["parallel"]]
db=root/"profile-before"/"data"/"opencorvus.db"
with sqlite3.connect(db.as_uri()+"?mode=ro",uri=True) as cx:
    cx.row_factory=sqlite3.Row
    result=[]
    for response in receipts:
        target=response["data"]["sessionID"]
        s=dict(cx.execute("select id,project_id,directory,title,json_extract(metadata,'$.mission.id') missionID from session where id=?",(target,)).fetchone())
        m=[dict(r) for r in cx.execute("""select id, json_extract(data,'$.model.providerID') provider,
          json_extract(data,'$.model.modelID') model, json_extract(data,'$.extra.wake_reason.requestID') requestID,
          json_extract(data,'$.extra.wake_reason.openedEventID') openedEventID
          from message where session_id=? and json_extract(data,'$.role')='user'""",(target,))]
        e=[dict(r) for r in cx.execute("""select id,type,source,correlation_id,json_extract(payload,'$.requestID') requestID
           from protocol_event where aggregate_type='session' and aggregate_id=? and type='mission.execution.opened'""",(target,))]
        assert len(m)==len(e)==1,(m,e)
        assert m[0]["openedEventID"]==e[0]["id"] and m[0]["requestID"]==e[0]["requestID"]
        assert (m[0]["provider"],m[0]["model"])==("b158-loopback","offline"),m
        result.append({"session":s,"userMessage":m[0],"opened":e[0]})
    assert len({s["session"]["id"] for s in result})==4
    assert len({s["session"]["project_id"] for s in result})==1
    assert result[0]["opened"]["requestID"]==result[1]["opened"]["requestID"]
    assert result[2]["opened"]["requestID"]==result[3]["opened"]["requestID"]
    usage=cx.execute("select count(*) from provider_usage_event").fetchone()[0]
    assert usage==0
    evidence={"version":cx.execute("pragma user_version").fetchone()[0],"integrity":cx.execute("pragma integrity_check").fetchone()[0],"providerUsageEvents":usage,"persistedLaunches":result}
(root/"before-database.json").write_text(json.dumps(evidence,indent=2)+"\n",encoding="utf-8")
print(json.dumps(evidence))
