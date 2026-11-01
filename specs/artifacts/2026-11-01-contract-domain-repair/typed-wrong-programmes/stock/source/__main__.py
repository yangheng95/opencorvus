import argparse,csv,json,sqlite3
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--db",required=True);p.add_argument("--output",required=True);a=p.parse_args();c=sqlite3.connect(a.db);done=0;result=None
c.execute("BEGIN")
with open(a.input,encoding="utf-8",newline="") as f:
    for i,r in enumerate(csv.DictReader(f),1):
        old=c.execute("select quantity from stock where item=?",(r["item"],)).fetchone();qty=(old[0] if old else 0)+int(r["delta"])
        if qty<0:
            c.rollback();result=dict(success=0,error=dict(code="INSUFFICIENT_STOCK",record=i,item=r["item"]));break
        if old:c.execute("update stock set quantity=?,unit_cost_cents=? where item=?",(qty,int(r["unit_cost_cents"]),r["item"]))
        else:c.execute("insert into stock values(?,?,?)",(r["item"],qty,int(r["unit_cost_cents"])))
        done+=1
if result is None:c.commit();result=dict(success=True,processed=done)
c.close();Path(a.output).write_text(json.dumps(result),encoding="utf-8");raise SystemExit(0 if result["success"] else 2)
