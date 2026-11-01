import argparse,json,sqlite3
from pathlib import Path
def q(x):return '"'+x.replace('"','""')+'"'
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();root=Path(a.input);result=[]
with sqlite3.connect((root/"source.db").resolve().as_uri()+"?mode=ro",uri=True) as c:
    for r in json.loads((root/"export.json").read_text(encoding="utf-8"))["exports"]:
        sql="SELECT "+",".join(map(q,r["columns"]))+" FROM "+q(r["table"])+" WHERE "+q(r["match"]["column"])+" COLLATE BINARY = ? ORDER BY "+",".join(map(q,r["order_by"]))
        result.append(dict(name=r["name"],columns=r["columns"],rows=[list(v) for v in c.execute(sql,(r["match"]["value"],))]))
Path(a.output).write_text(json.dumps(dict(exports=result),ensure_ascii=False),encoding="utf-8")
