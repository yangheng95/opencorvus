"""Symmetric real SQLite observation of ordinary integration and a disclosed boundary."""
from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,os,sys
R=Path(__file__).parent
PROGRAM=r'''
import json,sqlite3,sys
from pathlib import Path
from sqlite_utils import Database
out=Path(sys.argv[1]);out.mkdir(exist_ok=False)
ordinary=out/'ordinary.db'
d=Database(ordinary)
d['items'].insert({'id':1,'name':'Alpha'},pk='id')
d['items'].create_index(['name'])
d['items'].enable_counts()
d['items'].upsert_all([{'id':1,'name':'Beta'},{'id':2,'name':'Gamma'}],pk='id')
counts=d.cached_counts(['items'])
rows_before=list(d.query('select id,name from items order by id'))
d['items'].transform(rename={'name':'label'})
d['items'].update(1,{'label':'Delta'})
d['items'].delete(2)
d.close()
with sqlite3.connect(ordinary) as c:
 rows=c.execute('select id,label from items order by id').fetchall()
 columns=[x[1] for x in c.execute('pragma table_info(items)')]
 integrity=c.execute('pragma integrity_check').fetchone()[0]
expected={'counts':{'items':2},'rows_before':[{'id':1,'name':'Beta'},{'id':2,'name':'Gamma'}],'rows':[(1,'Delta')],'columns':['id','label'],'integrity':'ok'}
observed={'counts':counts,'rows_before':rows_before,'rows':rows,'columns':columns,'integrity':integrity}
boundary=out/'nested-rollback.db'
d=Database(boundary);d.enable_safe_import()
d.executescript("CREATE TABLE items(id INTEGER PRIMARY KEY, quantity INTEGER); INSERT INTO items VALUES(1,5); CREATE TRIGGER reject_three BEFORE INSERT ON items WHEN new.id=3 BEGIN SELECT RAISE(ROLLBACK,'scope-probe'); END;")
outer=d.create_import_checkpoint();d['items'].insert({'id':2,'quantity':7})
def state():
 return {'schema':[list(x) for x in d.execute("select type,name,tbl_name,sql from sqlite_master where tbl_name='items' order by type,name")], 'rows':[list(x) for x in d.execute('select id,quantity from items order by id')]}
before=state();result=d.safe_bulk_insert('items',[{'id':3,'quantity':9}],strict=False);after=state()
try:
 d.commit_checkpoint(outer);outer_result={'outcome':'finalized'}
except Exception as e:
 outer_result={'error_family':[b.__name__ for b in type(e).__mro__],'error':str(e)}
d.close()
with sqlite3.connect(boundary) as c:reopened=[list(x) for x in c.execute('select id,quantity from items order by id')]
report={'ordinary':{'observed':observed,'expected':expected,'matches':observed==expected},'disclosed_nested_boundary':{'before_call':before,'expected_after_failure':before,'actual_after_failure':after,'result':result,'exact_user_state_restored':after==before,'outer_finalize':outer_result,'independently_reopened_rows':reopened},'scope':'Symmetric post-delivery observation; original frozen-consumer results unchanged. No patched candidate or new model trial.'}
(out/'assessment.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
'''
for name in ('codex','opencorvus'):
    source=R/'source-reproduction'/name/'source';out=R/'whole-product-review'/name
    out.parent.mkdir(exist_ok=True)
    env=dict(os.environ,PYTHONPATH=str(source),PYTHONUTF8='1',PYTHONDONTWRITEBYTECODE='1')
    argv=[str(R/'runtime/Scripts/python.exe'),'-X','utf8','-B','-c',PROGRAM,str(out)]
    started=datetime.now(timezone.utc).isoformat()
    p=subprocess.run(argv,cwd=source,env=env,capture_output=True)
    (out.parent/(name+'.stdout.log')).write_bytes(p.stdout);(out.parent/(name+'.stderr.log')).write_bytes(p.stderr)
    receipt=dict(candidate=name,native_exit=p.returncode,started_at=started,ended_at=datetime.now(timezone.utc).isoformat(),argv=argv,scope='Observation script exit is distinct from the reported functional state matches')
    (out.parent/(name+'.execution.json')).write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(json.dumps(dict(candidate=name,native_exit=p.returncode,output=str(out))),flush=True)
