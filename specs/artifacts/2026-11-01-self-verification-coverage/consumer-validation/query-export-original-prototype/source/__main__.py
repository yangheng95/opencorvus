import argparse,json,sqlite3
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();root=Path(a.input);c=sqlite3.connect(root/"source.db");results=[]
for r in json.loads((root/"export.json").read_text(encoding="utf-8"))["exports"]:
    sql="SELECT "+",".join(r["columns"])+" FROM "+r["table"]+" WHERE "+r["match"]["column"]+" = '"+r["match"]["value"]+"' ORDER BY "+",".join(r["order_by"])
    results.append(dict(name=r["name"],columns=r["columns"],rows=[list(row) for row in c.execute(sql)]))
c.close();Path(a.output).write_text(json.dumps(dict(exports=results),ensure_ascii=False),encoding="utf-8")
