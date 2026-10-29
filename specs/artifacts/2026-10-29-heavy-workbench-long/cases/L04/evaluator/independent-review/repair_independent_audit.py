"""Independent SQL derivation, old counterexample replay and repaired abort/storage checks."""
import importlib.util
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
sys.dont_write_bytecode=True
from review_repair import HOME, ROOT, REPO, PYTHON, save, command

def load(path):return json.loads(path.read_text(encoding='utf-8'))

def image(connection):
    schema=[list(r) for r in connection.execute("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name")]
    tables=[r[0] for r in connection.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    return {'schema':schema,'tables':{t:[list(r) for r in connection.execute('SELECT * FROM "'+t+'" ORDER BY rowid')] for t in tables}}

def disk_image(db):
    with sqlite3.connect(db.as_uri()+'?mode=ro',uri=True) as c:return image(c)

def main():
    spec=importlib.util.spec_from_file_location('historical_independent_reader',HOME/'independent_review.py')
    reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
    reader.ROOT=ROOT
    sql=reader.sql_audit();process=reader.process_audit()
    # Only the pure SQL/PID readers are reused; historical main/null-finding runner is not invoked.
    checks=[]
    def check(label,actual,expected):
        checks.append({'contract':label,'actual':actual,'expected':expected,'passed':actual==expected})
    probes=[]
    for version in ('v1','v2'):
        folder=ROOT/'repaired-null-probe'/version;folder.mkdir(parents=True,exist_ok=False)
        db=folder/'probe.sqlite'
        shutil.copy2(ROOT/('frozen-input/v1.sqlite' if version=='v1' else 'cold-run/normal/application.sqlite'),db)
        before=disk_image(db)
        for label in ('first','identical','changed_same_null_key'):
            old=HOME/'receipt-key-probe'/version/(label+'.request.json')
            request=folder/(label+'.request.json');shutil.copy2(old,request)
            script='legacy_writer.py' if version=='v1' else 'reference_api.py'
            argv=[PYTHON,'-B',str(ROOT/'source-snapshot'/script),'--db',str(db)]
            if version=='v2':argv+=['--action','write']
            argv+=['--request',str(request)]
            receipt=command(argv,'repaired-null-'+version+'-'+label)
            response=load(Path(receipt['stdout']))
            check(version+'.'+label+'.exact_historical_request',request.read_bytes(),old.read_bytes())
            # Bytes are represented as explicit equality below to keep JSON a machine-readable contract.
            checks[-1]['actual']=request.read_bytes()==old.read_bytes();checks[-1]['expected']=True
            check(version+'.'+label+'.typed_error',response,{'status':'invalid_request','field':'op_key'})
            probes.append({'version':version,'step':label,'request':load(request),'response':response,'command_receipt':receipt})
        check(version+'.all_request_failures_preserve_entire_database',disk_image(db),before)
    save(ROOT/'repaired-null-probe.json',{'observations':probes,'scope':'same historical request files on fresh reviewer-owned copies; real CLI'})
    events=load(ROOT/'cold-run/process-events.json')
    abort=[]
    for case,statement,parameters,expected in [
        ('unresolved_receipt','INSERT INTO write_receipts VALUES(NULL,?,?)',('{}','{"status":"accepted"}'),'unresolved_receipt_identity'),
        ('unresolved_entry','INSERT INTO legacy_entries VALUES(?,?,?,?,?)',('',7,'USD','1.00',None),'unresolved_entry_identity')]:
        reference=sqlite3.connect(':memory:')
        original=sqlite3.connect((ROOT/'frozen-input/v1.sqlite').as_uri()+'?mode=ro',uri=True)
        original.backup(reference);original.close()
        reference.execute(statement,parameters);reference.commit();expected_image=image(reference);reference.close()
        observed=disk_image(ROOT/'cold-run'/case/'application.sqlite')
        check(case+'.all_tables_and_schema_exactly_preserved',observed,expected_image)
        event=next(e for e in events if case in Path(e['argv'][e['argv'].index('--db')+1]).parts)
        check(case+'.explicit_error_response',json.loads(event['stdout']),{'status':expected})
        abort.append({'case':case,'reference_construction':'frozen input copied to in-memory SQLite, same explicit boundary injection; independently compare all sqlite_master rows and every table row',
                      'all_table_counts':{k:len(v) for k,v in observed['tables'].items()},'response':json.loads(event['stdout'])})
    save(ROOT/'independent-abort-audit.json',abort)
    db=ROOT/'storage-contracts.sqlite';shutil.copy2(ROOT/'cold-run/normal/application.sqlite',db)
    baseline=disk_image(db);storage=[]
    with sqlite3.connect(db,isolation_level=None) as c:
        c.execute('PRAGMA foreign_keys=ON')
        for label,statement,expected in [
            ('receipt_null',"INSERT INTO write_receipts VALUES(NULL,'{}','{}')",'SQLITE_CONSTRAINT_NOTNULL'),
            ('receipt_blank',"INSERT INTO write_receipts VALUES('  ','{}','{}')",'SQLITE_CONSTRAINT_CHECK'),
            ('customer_null',"INSERT INTO customers VALUES(NULL,'x','x')",'SQLITE_CONSTRAINT_NOTNULL'),
            ('customer_blank',"INSERT INTO customers VALUES('  ','x','x')",'SQLITE_CONSTRAINT_CHECK'),
            ('entry_null',"INSERT INTO entries(entry_id,customer_key,currency,amount_minor,reversal_of,fee_minor) VALUES(NULL,'C-ALPHA','USD',1,NULL,0)",'SQLITE_CONSTRAINT_NOTNULL'),
            ('entry_blank',"INSERT INTO entries(entry_id,customer_key,currency,amount_minor,reversal_of,fee_minor) VALUES('  ','C-ALPHA','USD',1,NULL,0)",'SQLITE_CONSTRAINT_CHECK'),
            ('quarantine_kind_null',"INSERT INTO quarantine VALUES(NULL,'x','x','{}')",'SQLITE_CONSTRAINT_NOTNULL'),
            ('quarantine_key_null',"INSERT INTO quarantine VALUES('entry',NULL,'x','{}')",'SQLITE_CONSTRAINT_NOTNULL')]:
            c.execute('BEGIN IMMEDIATE')
            try:c.execute(statement);actual='accepted'
            except sqlite3.IntegrityError as error:actual=error.sqlite_errorname
            finally:c.rollback()
            check('storage.'+label,actual,expected)
            storage.append({'contract':label,'sql':statement,'actual':actual,'expected':expected})
    check('storage_error_contracts_leave_entire_copy_unchanged',disk_image(db),baseline)
    save(ROOT/'independent-storage-audit.json',storage)
    save(ROOT/'independent-repair-checks.json',checks)
    status=subprocess.run(['git','status','--short'],cwd=REPO,capture_output=True,text=True,encoding='utf-8')
    (ROOT/'git-status-after.txt').write_text(status.stdout,encoding='utf-8')
    summary={'reference_cold_scenarios':load(ROOT/'cold-run/receipt.json'),'independent_sql_passed':sql['all_passed'],
      'independent_sql_check_count':sql['check_count'],'independent_owned_process_protocol_passed':process['all_observed_protocol_checks_passed'],
      'additional_repair_check_count':len(checks),'additional_repair_checks_passed':all(v['passed'] for v in checks),
      'old_null_cli_calls':len(probes),'storage_error_contracts':len(storage),'historical_failure_evidence_preserved':True,
      'heavy_case_freeze_approved':False,'hours_validated':False,'provider_calls':0,'gpu_work':False,
      'queue_observation_limit':process['queued_writer']['observation_limit']}
    save(ROOT/'independent-summary.json',summary)
    print(json.dumps({k:v for k,v in summary.items() if k not in ('reference_cold_scenarios','queue_observation_limit')},ensure_ascii=False,indent=2))
    if not(sql['all_passed'] and process['all_observed_protocol_checks_passed'] and summary['additional_repair_checks_passed']):raise SystemExit(1)

if __name__=='__main__':main()
