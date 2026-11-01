"""Actual packaged-program consumer contracts for the two new workflow domains."""
import json
from pathlib import Path
import tempfile
import unittest
import zipapp

from delivery_selfcheck_cases import PROTOTYPES,grade,sql_cases,utc_cases

CORRECT={
    'query-export': '''import argparse,json,sqlite3
from pathlib import Path
def q(x):return '"'+x.replace('"','""')+'"'
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();root=Path(a.input);result=[]
with sqlite3.connect((root/"source.db").resolve().as_uri()+"?mode=ro",uri=True) as c:
    for r in json.loads((root/"export.json").read_text(encoding="utf-8"))["exports"]:
        sql="SELECT "+",".join(map(q,r["columns"]))+" FROM "+q(r["table"])+" WHERE "+q(r["match"]["column"])+" COLLATE BINARY = ? ORDER BY "+",".join(map(q,r["order_by"]))
        result.append(dict(name=r["name"],columns=r["columns"],rows=[list(v) for v in c.execute(sql,(r["match"]["value"],))]))
Path(a.output).write_text(json.dumps(dict(exports=result),ensure_ascii=False),encoding="utf-8")
''',
    'utc-ledger': '''import argparse,csv,json
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
''',
}

def validate(root):
    results={}
    for kind in ['query-export','utc-ledger']:
        for variant,source in [('correct',CORRECT[kind]),('original-prototype',PROTOTYPES[kind])]:
            project=root/(kind+'-'+variant);code=project/'source';code.mkdir(parents=True)
            (code/'__main__.py').write_text(source,encoding='utf-8');zipapp.create_archive(code,project/'deliverable.pyz')
            results[kind+'/'+variant]=grade(kind,project,project/'consumer')
    return results

class SelfcheckConsumerTest(unittest.TestCase):
    def test_explicit_expected_instants_and_literal_data(self):
        self.assertEqual(utc_cases()[1]['expected']['total_seconds'],600)
        self.assertEqual(utc_cases()[2]['expected']['daily'],[dict(date='2026-04-01',sessions=1,seconds=.75),dict(date='2026-04-02',sessions=1,seconds=2)])
        self.assertEqual(sql_cases()[2]['expected']['exports'][1]['rows'],[['002',"' OR 1=1 --"]])

    def test_original_complete_programmes_and_physical_source_state(self):
        with tempfile.TemporaryDirectory() as directory:
            reports=validate(Path(directory))
            self.assertEqual({k:r['passed'] for k,r in reports.items()},{'query-export/correct':True,'query-export/original-prototype':False,'utc-ledger/correct':True,'utc-ledger/original-prototype':False})
            self.assertEqual([r['source_preserved'] for r in reports['query-export/correct']['results']],[True,True,True])
            self.assertEqual(reports['utc-ledger/correct']['results'][3]['actual'],dict(error=dict(code='NEGATIVE_INTERVAL',session='bad')))
            self.assertEqual(reports['utc-ledger/correct']['results'][3]['exit'],2)

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path);a=p.parse_args()
    if a.output:
        reports=validate(a.output);print(json.dumps({k:r['passed'] for k,r in reports.items()}));raise SystemExit(0 if [r['passed'] for r in reports.values()]==[True,False,True,False] else 1)
    unittest.main(argv=[__file__])
