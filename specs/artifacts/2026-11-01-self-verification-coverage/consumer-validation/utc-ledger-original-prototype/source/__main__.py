import argparse,csv,json
from datetime import datetime
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();rows=[];daily={}
with open(Path(a.input)/"sessions.csv",encoding="utf-8",newline="") as f:
    for r in csv.DictReader(f):
        start=datetime.fromisoformat(r["started_at"][:19]);end=datetime.fromisoformat(r["ended_at"][:19]);seconds=(end-start).total_seconds()
        if seconds<0:Path(a.output).write_text(json.dumps(dict(error=dict(code="NEGATIVE_INTERVAL",session=r["session"]))),encoding="utf-8");raise SystemExit(2)
        day=start.date().isoformat();rows.append(dict(session=r["session"],start_utc=start.isoformat(timespec="microseconds")+"Z",end_utc=end.isoformat(timespec="microseconds")+"Z",seconds=seconds,start_utc_date=day));bucket=daily.setdefault(day,dict(date=day,sessions=0,seconds=0));bucket["sessions"]+=1;bucket["seconds"]+=seconds
Path(a.output).write_text(json.dumps(dict(sessions=rows,daily=[daily[k] for k in sorted(daily)],total_seconds=sum(r["seconds"] for r in rows)),ensure_ascii=False),encoding="utf-8")
