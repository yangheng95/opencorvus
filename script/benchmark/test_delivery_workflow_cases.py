"""Actual packaged programmes exercise the file/SQLite external consumer contracts."""
from pathlib import Path
import tempfile
import unittest
import zipapp
from delivery_workflow_cases import PROTOTYPES, grade

CORRECT = {
    "bundle": '''import argparse,json,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();root=Path(a.input);index=[]
with zipfile.ZipFile(a.output,"w") as z:
    for r in json.loads((root/"manifest.json").read_text(encoding="utf-8"))["files"]:
        raw=(root/r["source"]).read_bytes();z.writestr(r["target"],raw);index.append(dict(path=r["target"],bytes=len(raw)))
    z.writestr("_bundle_index.json",json.dumps(dict(files=sorted(index,key=lambda r:r["path"])),ensure_ascii=False))
''',
    "stock": '''import argparse,csv,json,sqlite3
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--db",required=True);p.add_argument("--output",required=True);a=p.parse_args();c=sqlite3.connect(a.db);done=0;result=None
c.execute("BEGIN")
with open(a.input,encoding="utf-8",newline="") as f:
    for i,r in enumerate(csv.DictReader(f),1):
        old=c.execute("select quantity from stock where item=?",(r["item"],)).fetchone();qty=(old[0] if old else 0)+int(r["delta"])
        if qty<0:
            c.rollback();result=dict(success=False,error=dict(code="INSUFFICIENT_STOCK",record=i,item=r["item"]));break
        if old:c.execute("update stock set quantity=?,unit_cost_cents=? where item=?",(qty,int(r["unit_cost_cents"]),r["item"]))
        else:c.execute("insert into stock values(?,?,?)",(r["item"],qty,int(r["unit_cost_cents"])))
        done+=1
if result is None:c.commit();result=dict(success=True,processed=done)
c.close();Path(a.output).write_text(json.dumps(result),encoding="utf-8");raise SystemExit(0 if result["success"] else 2)
''',
}

def validate(output):
    results={}
    for kind in ["bundle","stock"]:
        for variant, source in [("correct",CORRECT[kind]),("original-prototype",PROTOTYPES[kind])]:
            project=output/(kind+"-"+variant);app=project/"source";app.mkdir(parents=True)
            (app/"__main__.py").write_text(source,encoding="utf-8");zipapp.create_archive(app,project/"deliverable.pyz")
            results[kind+"/"+variant]=grade(kind,project,project/"consumer")
    return results

class WorkflowConsumerTest(unittest.TestCase):
    def test_complete_correct_and_real_error_programmes(self):
        with tempfile.TemporaryDirectory() as directory:
            results=validate(Path(directory))
            self.assertEqual({k:v["passed"] for k,v in results.items()},{"bundle/correct":True,"bundle/original-prototype":False,"stock/correct":True,"stock/original-prototype":False})
            atomic=results["stock/correct"]["results"][2]
            self.assertEqual(atomic["exit"],2)
            self.assertEqual(atomic["actual"]["database"],atomic["expected"]["database"])

if __name__=="__main__":
    import argparse,json
    p=argparse.ArgumentParser();p.add_argument("--output",type=Path);a=p.parse_args()
    if a.output:
        reports=validate(a.output);print(json.dumps({k:v["passed"] for k,v in reports.items()}))
        raise SystemExit(0 if [v["passed"] for v in reports.values()]==[True,False,True,False] else 1)
    unittest.main(argv=[__file__])
