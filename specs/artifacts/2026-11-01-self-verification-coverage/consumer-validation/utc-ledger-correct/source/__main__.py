import argparse,csv,json
from datetime import datetime,timezone
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();emitted=[];daily={};error=None
with open(Path(a.input)/"sessions.csv",encoding="utf-8",newline="") as f:
    for r in csv.DictReader(f):
        start=datetime.fromisoformat(r["started_at"]).astimezone(timezone.utc);end=datetime.fromisoformat(r["ended_at"]).astimezone(timezone.utc);seconds=(end-start).total_seconds()
        if seconds<0:error=dict(error=dict(code="NEGATIVE_INTERVAL",session=r["session"]));break
        day=start.date().isoformat();bucket=daily.setdefault(day,dict(date=day,sessions=0,seconds=0));bucket["sessions"]+=1;bucket["seconds"]+=seconds
        emitted.append(dict(session=r["session"],start_utc=start.isoformat(timespec="microseconds").replace("+00:00","Z"),end_utc=end.isoformat(timespec="microseconds").replace("+00:00","Z"),seconds=seconds,start_utc_date=day))
result=error if error else dict(sessions=emitted,daily=[daily[k] for k in sorted(daily)],total_seconds=sum(r["seconds"] for r in emitted))
Path(a.output).write_text(json.dumps(result,ensure_ascii=False),encoding="utf-8");raise SystemExit(2 if error else 0)
