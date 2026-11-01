"""Actual native SQLite API + executable CLI consumer for this complete task."""
from pathlib import Path
from datetime import datetime,timezone
import subprocess,os,json,sqlite3,sys,argparse,xml.etree.ElementTree as ET
R=Path(__file__).parent;PY=R/'runtime/Scripts/python.exe'
def measure(source,out):
    source=source.resolve();out=out.resolve();out.mkdir(parents=True,exist_ok=False)
    env=os.environ.copy();env.update(PYTHONPATH=str(source),PYTHONUTF8='1',PYTEST_DISABLE_PLUGIN_AUTOLOAD='1')
    commands=[];errors=[]
    def run(label,args,stdin=None,expected='committed'):
        started=datetime.now(timezone.utc).isoformat()
        child=subprocess.run([str(PY),*map(str,args)],cwd=source,env=env,input=stdin.encode() if stdin is not None else None,capture_output=True)
        (out/(label+'.stdout.log')).write_bytes(child.stdout);(out/(label+'.stderr.log')).write_bytes(child.stderr)
        status='committed' if child.returncode==0 else 'operation_error' if 1<=child.returncode<=255 else 'outside_process_code_domain'
        record=dict(label=label,argv=[str(PY),*map(str,args)],started_at=started,ended_at=datetime.now(timezone.utc).isoformat(),native_exit=child.returncode,status=status,expected_status=expected)
        commands.append(record)
        if expected and status!=expected:errors.append(dict(contract='NATIVE_PROCESS_OUTCOME',**record))
        print(json.dumps(record),flush=True)
        return child
    native=run('new-feature-contracts',['-m','pytest',str(R/'consumer/test_safe_bulk_import.py'),'-q','-p','no:cacheprovider','--rootdir',str(R/'consumer'),'--junitxml',str(out/'new.xml')],expected=None)
    junit=[]
    if (out/'new.xml').is_file():
        for node in ET.parse(out/'new.xml').getroot().iter('testcase'):
            failure=node.find('failure');error=node.find('error');skip=node.find('skipped')
            status='collection_error' if error is not None and node.get('classname','')=='' else 'failed' if failure is not None or error is not None else 'skipped' if skip is not None else 'passed'
            reason=failure if failure is not None else error
            junit.append(dict(name=node.get('name'),status=status,seconds=node.get('time'),reason=reason.text if reason is not None else None))
    dbfile=out/'actual.db'
    def cli(label,*args,stdin=None,expected='committed'):
        return run(label,['-m','sqlite_utils',*args],stdin,expected)
    def api(label,expression):
        code='import sys,json; from sqlite_utils import Database; d=Database(sys.argv[1]); print(json.dumps('+expression+',default=str)); d.close()'
        p=run(label,['-c',code,str(dbfile)])
        return json.loads(p.stdout) if p.returncode==0 else None
    def equal(contract,actual,expected):
        if actual!=expected:errors.append(dict(contract=contract,actual=actual,expected=expected))
    def state():
        with sqlite3.connect(dbfile) as conn:
            objects=conn.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE tbl_name IN ('people','contract_audit') ORDER BY type,name").fetchall()
            rows={name:conn.execute('SELECT * FROM "'+name+'" ORDER BY rowid').fetchall() for name in ['people','contract_audit']}
            return dict(objects=objects,rows=rows)
    cli('ordinary-insert','insert',dbfile,'people','-','--pk','id',stdin='[{"id":1,"name":"Alice","age":30}]')
    with sqlite3.connect(dbfile) as conn:
        conn.executescript('CREATE INDEX contract_name ON people(name); CREATE TABLE contract_audit(name TEXT); CREATE TRIGGER contract_trigger AFTER INSERT ON people BEGIN INSERT INTO contract_audit VALUES(new.name); END;')
    enabled=cli('enable-safe','enable-safe-import',dbfile)
    workflow=dict(started=True,completed=False)
    if enabled.returncode==0:
        cli('add-row-invariant','add-import-invariant',dbfile,'people','age >= 18')
        cli('add-count-invariant','add-import-invariant',dbfile,'people','COUNT(*) <= 3')
        invariants=api('read-persisted-invariants',"d.list_import_invariants('people')")
        equal('PERSISTED_INVARIANT_EXPRESSIONS',sorted(x['expression'] for x in invariants),['COUNT(*) <= 3','age >= 18'])
        listed=cli('list-invariants','list-import-invariants',dbfile,'people').stdout.decode()
        for item in invariants:
            equal('CLI_LISTED_ID_AND_SQL',str(item['id']) in listed and item['expression'] in listed,True)
        cli('safe-insert-commit','insert',dbfile,'people','-','--safe-mode',stdin='[{"id":2,"name":"Bob","age":40}]')
        equal('SAFE_INSERT_COMMITTED_ROWS',state()['rows'],{'people':[(1,'Alice',30),(2,'Bob',40)],'contract_audit':[('Bob',)]})
        before=state()
        cli('safe-insert-invariant-error','insert',dbfile,'people','-','--safe-mode',stdin='[{"id":3,"name":"Minor","age":15}]',expected='operation_error')
        equal('INSERT_ERROR_EXACT_USER_STATE',state(),before)
        cli('safe-upsert-commit','upsert',dbfile,'people','-','--pk','id','--safe-mode',stdin='[{"id":2,"name":"Bob Updated","age":41}]')
        equal('SAFE_UPSERT_COMMITTED_ROW',state()['rows']['people'],[(1,'Alice',30),(2,'Bob Updated',41)])
        before=state()
        cli('safe-upsert-invariant-error','upsert',dbfile,'people','-','--pk','id','--safe-mode',stdin='[{"id":4,"name":"Minor","age":12}]',expected='operation_error')
        equal('UPSERT_ERROR_EXACT_USER_STATE',state(),before)
        cli('bulk-update-commit','bulk',dbfile,'UPDATE people SET age = :age WHERE id = :id','-','--safe-mode',stdin='[{"id":1,"age":31}]')
        equal('BULK_UPDATE_COMMITTED_ROW',state()['rows']['people'],[(1,'Alice',31),(2,'Bob Updated',41)])
        before=state()
        cli('bulk-update-invariant-error','bulk',dbfile,'UPDATE people SET age = :age WHERE id = :id','-','--safe-mode',stdin='[{"id":1,"age":9}]',expected='operation_error')
        equal('UPDATE_ERROR_EXACT_USER_STATE',state(),before)
        cli('validate-success','validate-import-invariants',dbfile,'people')
        validation=api('validate-success-api',"d.validate_import_invariants('people')")
        equal('VALIDATION_SUCCESS_STATE',validation,{'valid':True,'failures':[]})
        cli('add-failing-invariant','add-import-invariant',dbfile,'people','COUNT(*) = 0')
        current=api('get-failing-invariant-id',"d.list_import_invariants('people')")
        failing_id=next(x['id'] for x in current if x['expression']=='COUNT(*) = 0')
        output=cli('validate-failure-native-zero','validate-import-invariants',dbfile,'people').stdout.decode()
        equal('CLI_VALIDATION_FAILURE_ID',str(failing_id) in output,True)
        validation=api('validate-failure-api',"d.validate_import_invariants('people')")
        equal('VALIDATION_FAILURE_EXACT_ID',{'valid':validation['valid'],'ids':[x['id'] for x in validation['failures']]},{'valid':False,'ids':[failing_id]})
        cli('remove-failing-invariant','remove-import-invariant',dbfile,'people',failing_id)
        current=api('remaining-invariants',"d.list_import_invariants('people')")
        equal('EXACT_REMAINING_INVARIANTS',sorted(current,key=lambda x:x['id']),sorted(invariants,key=lambda x:x['id']))
        cli('disable-safe','disable-safe-import',dbfile)
        code='''import sys,json
from sqlite_utils import Database
d=Database(sys.argv[1])
try:
 d.create_import_checkpoint()
 print(json.dumps({'outcome':'checkpoint_created'}))
except Exception as e:
 print(json.dumps({'error_family':[base.__name__ for base in type(e).__mro__]}))
d.close()
'''
        disabled=run('disabled-explicit-error',['-c',code,str(dbfile)])
        equal('DISABLED_CHECKPOINT_ERROR','SafeImportNotEnabledError' in json.loads(disabled.stdout).get('error_family',[]),True)
        workflow=dict(started=True,completed=True,final_user_state=state(),invariant_expressions=sorted(x['expression'] for x in current))
    else:workflow['remaining_steps']='Not executed: required enable command returned a recorded process outcome mismatch'
    result=dict(source=str(source),recorded_at=datetime.now(timezone.utc).isoformat(),new_feature_suite_native_exit=native.returncode,tests=junit,native_commands=commands,workflow=workflow,contract_errors=errors,complete_task_contracts_match=bool(junit) and all(x['status']=='passed' for x in junit) and not errors and workflow['completed'],aggregate_score=None,official_score=False,base_regression_suite='not run: original full base tests not reviewed for local hard constraints',scope='Original60 new-feature functions adapted prospectively to positive state/error contracts, plus actual subprocess CLI and independent sqlite3 consumer. No UI automation/mocks/expected-output caches. Source schema/state objects, not hashes, establish behavior.')
    (out/'assessment.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(dict(output=str(out),match=result['complete_task_contracts_match'],test_status={s:sum(x['status']==s for x in junit) for s in ['passed','failed','skipped']},errors=len(errors),workflow=workflow['completed'])),flush=True)
    return 0 if result['complete_task_contracts_match'] else 4
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();sys.exit(measure(a.source,a.output))
