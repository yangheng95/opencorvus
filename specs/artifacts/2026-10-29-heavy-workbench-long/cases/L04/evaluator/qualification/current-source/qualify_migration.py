"""Actual owned subprocess/SQLite migration qualification, no UI or model calls."""
import argparse
from datetime import datetime,timezone
import json
from pathlib import Path
import queue
import shutil
import sqlite3
import subprocess
import sys
import threading
import time

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--input',type=Path,required=True);args=parser.parse_args()
    root=args.output.resolve();root.mkdir(parents=True,exist_ok=False)
    scripts=root/'executed-source';scripts.mkdir()
    for name in ('legacy_writer.py','reference_api.py','l04_request.py','qualify_migration.py'):
        shutil.copy2(Path(__file__).parent/name,scripts/name)
    base=root/'original-input';base.mkdir()
    for name in ('v1.sqlite','authority.json','provenance.json'):shutil.copy2(args.input/name,base/name)
    authority=base/'authority.json'
    python=sys.executable
    before={'epoch':3,'op_key':'before-cutover','entry_id':'O2','customer_id':9,'currency':'CNY','amount':'5.00'}
    fresh={'epoch':4,'op_key':'new-accepted','entry_id':'N_FEE','customer_key':'C-ALPHA','currency':'USD','amount_minor':333,'fee_minor':7}
    events=[];children=[];checks=[]
    def dump(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    def need(actual,expected,kind):
        if actual!=expected:raise AssertionError(json.dumps({'contract':kind,'actual':actual,'expected':expected},ensure_ascii=False))
        checks.append({'contract':kind,'actual':actual,'expected':expected,'passed':True})
    def run(argv):
        start=time.perf_counter();started=datetime.now(timezone.utc).isoformat()
        process=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8');children.append(process)
        try:out,err=process.communicate(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill();out,err=process.communicate();raise AssertionError('owned_process_timeout')
        events.append({'argv':argv,'pid':process.pid,'started_utc':started,'seconds':time.perf_counter()-start,'returncode':process.returncode,'stdout':out,'stderr':err})
        need(process.returncode,0,'subprocess_exit')
        return json.loads(out)
    def async_start(argv):
        process=subprocess.Popen(argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8');children.append(process)
        return process,{'argv':argv,'pid':process.pid,'started_utc':datetime.now(timezone.utc).isoformat(),'control_events':[]}
    def line(process,stream):
        messages=queue.Queue()
        threading.Thread(target=lambda:messages.put(stream.readline()),daemon=True).start()
        try:return messages.get(timeout=10)
        except queue.Empty:
            process.kill();process.wait(timeout=5);raise AssertionError('owned_checkpoint_timeout')
    def finish(process,event,out_prefix='',err_prefix=''):
        out,err=process.communicate(timeout=15)
        event.update(returncode=process.returncode,stdout=out_prefix+out,stderr=err_prefix+err)
        events.append(event)
        return out
    def observed(db):
        with sqlite3.connect(db) as connection:
            return {'version':connection.execute('SELECT max(version) FROM schema_migrations').fetchone()[0],
                    'epoch':connection.execute('SELECT epoch FROM control WHERE singleton=1').fetchone()[0]}
    def invalid_cases(command,template,folder,label):
        for index,(field,value) in enumerate([('op_key',None),('op_key','  '),('entry_id',None),('epoch',True)]):
            path=folder/('invalid-'+label+'-'+str(index)+'.json');dump(path,{**template,field:value})
            need(run(command[:-1]+[str(path)]),{'status':'invalid_request','field':field},label+'.typed_identity_error')
    def source_snapshot(db):
        connection=sqlite3.connect(db)
        try:return {table:[list(r) for r in connection.execute('SELECT * FROM '+table+' ORDER BY rowid')]
                    for table in ('control','schema_migrations','legacy_customers','legacy_entries','write_receipts','audit_events')}
        finally:connection.close()
    with sqlite3.connect(base/'v1.sqlite') as original:
        original.row_factory=sqlite3.Row
        old_entries={r['entry_id']:dict(r) for r in original.execute('SELECT * FROM legacy_entries')}
        old_customers={str(r['customer_id']):dict(r) for r in original.execute('SELECT * FROM legacy_customers')}
        old_history=tuple(original.execute('SELECT * FROM schema_migrations').fetchone())
    expected={'O1':('C-ALPHA','USD',1234,None,0),'R1':('C-ALPHA','USD',-234,'O1',0),
              'O_ALIAS':('C-ALPHA','CNY',250,None,0),'O_BETA':('C-BETA','USD',700,None,0),
              'O_ZERO':('C-ALPHA','CNY',0,None,0),'O2':('C-ALPHA','CNY',500,None,0),
              'N_FEE':('C-ALPHA','USD',333,None,7)}
    reason_expected={'customer:11':'unmapped_customer','entry:O_SCALE':'amount_scale','entry:O_TEXT':'invalid_amount',
                     'entry:O_UNKNOWN':'unmapped_customer','entry:O_ORPHAN':'unmapped_customer','entry:R_BAD':'invalid_reversal'}
    summaries=[];start=time.perf_counter()
    try:
        for name in ('normal','before_commit_fault','after_commit_fault','queued_cutover'):
            case=root/name;case.mkdir();db=case/'application.sqlite';shutil.copy2(base/'v1.sqlite',db)
            req=case/'legacy-request.json';dump(req,before)
            oldcmd=[python,'-B',str(scripts/'legacy_writer.py'),'--db',str(db),'--request',str(req)]
            need(run(oldcmd)['status'],'accepted',name+'.v1_ack')
            need(run(oldcmd)['status'],'duplicate',name+'.v1_retry')
            if name=='normal':invalid_cases(oldcmd,before,case,'v1')
            upgrade=[python,'-B',str(scripts/'reference_api.py'),'--db',str(db),'--action','upgrade','--authority',str(authority)]
            if name=='normal':need(run(upgrade)['status'],'upgraded',name+'.upgrade')
            else:
                phase='after_commit' if name=='after_commit_fault' else 'before_commit'
                process,event=async_start(upgrade+['--pause-at',phase]);checkpoint_line=line(process,process.stdout);checkpoint=json.loads(checkpoint_line)
                need(checkpoint,{'event':'checkpoint','name':phase,'pid':process.pid,'transaction_open':phase=='before_commit'},name+'.real_checkpoint')
                state=observed(db);event['control_events'].append({'checkpoint':checkpoint,'independent_database_state':state})
                need(state,{'version':2 if phase=='after_commit' else 1,'epoch':4 if phase=='after_commit' else 3},name+'.visible_commit_state')
                if name=='queued_cutover':
                    queued_req=case/'queued-request.json';dump(queued_req,{**before,'op_key':'queued-op','entry_id':'O_QUEUED','amount':'1.00'})
                    queued_cmd=[python,'-B',str(scripts/'legacy_writer.py'),'--db',str(db),'--request',str(queued_req),'--announce-attempt']
                    waiting,waiting_event=async_start(queued_cmd)
                    attempt_line=line(waiting,waiting.stderr)
                    need(json.loads(attempt_line),{'event':'write_attempt','pid':waiting.pid},name+'.old_writer_entry')
                    process.stdin.write('\n');process.stdin.flush();process.stdin.close();process.stdin=None
                    remaining=finish(process,event,out_prefix=checkpoint_line)
                    need(json.loads(remaining)['status'],'upgraded',name+'.cutover')
                    old_response=finish(waiting,waiting_event,err_prefix=attempt_line)
                    need(json.loads(old_response),{'status':'stale_epoch','current_epoch':4},name+'.old_writer_fence')
                else:
                    process.kill();finish(process,event,out_prefix=checkpoint_line)
                    event['control_events'].append({'action':'terminate_owned_subprocess','pid':process.pid,'checkpoint':phase})
                    need(observed(db),state,name+'.durable_state_after_interruption')
                    need(run(upgrade)['status'],'already_current' if phase=='after_commit' else 'upgraded',name+'.recover')
            need(observed(db),{'version':2,'epoch':4},name+'.current_state')
            need(run(oldcmd),{'status':'stale_epoch','current_epoch':4},name+'.stale_contract')
            new_req=case/'new-request.json';dump(new_req,fresh)
            newcmd=[python,'-B',str(scripts/'reference_api.py'),'--db',str(db),'--action','write','--request',str(new_req)]
            need(run(newcmd)['status'],'accepted',name+'.v2_ack')
            need(run(newcmd)['status'],'duplicate',name+'.v2_retry')
            if name=='normal':invalid_cases(newcmd,fresh,case,'v2')
            changed={**fresh,'amount_minor':334};dump(new_req,changed)
            need(run(newcmd)['status'],'operation_conflict',name+'.op_conflict')
            need(run(upgrade)['status'],'already_current',name+'.upgrade_retry')
            receipt=run([python,'-B',str(scripts/'reference_api.py'),'--db',str(db),'--action','receipt','--id','before-cutover'])
            need(receipt['receipt'],{'status':'accepted','entry_id':'O2','epoch':3,'source_schema':1},name+'.preserved_ack_receipt')
            with sqlite3.connect(db,isolation_level=None) as connection:
                connection.execute('PRAGMA foreign_keys=ON')
                actual={r[0]:tuple(r[1:]) for r in connection.execute('SELECT entry_id,customer_key,currency,amount_minor,reversal_of,fee_minor FROM entries')}
                need(actual,expected,name+'.every_business_identity')
                need(dict(connection.execute('SELECT customer_key,email FROM customers')),{'C-ALPHA':'same@example.test','C-BETA':'same@example.test'},name+'.authoritative_identity')
                need(dict(connection.execute('SELECT legacy_id,customer_key FROM customer_aliases')),{7:'C-ALPHA',9:'C-ALPHA',12:'C-BETA'},name+'.aliases')
                for legacy_id,raw in connection.execute('SELECT legacy_id,raw_json FROM customer_aliases'):
                    need(json.loads(raw),old_customers[str(legacy_id)],name+'.alias_source_preserved')
                reasons={}
                for kind,key,reason,raw in connection.execute('SELECT * FROM quarantine'):
                    reasons[kind+':'+key]=reason
                    need(json.loads(raw),(old_customers if kind=='customer' else old_entries)[key],name+'.quarantine_source_preserved')
                need(reasons,reason_expected,name+'.explicit_quarantine')
                rows=[tuple(r) for r in connection.execute('SELECT * FROM schema_migrations ORDER BY version')]
                need(rows[0],old_history,name+'.migration_history_preserved');need([r[0] for r in rows],[1,2],name+'.one_current_version')
                need(dict(connection.execute('SELECT source_schema,count(*) FROM audit_events GROUP BY source_schema')),{1:11,2:1},name+'.audit_identity_counts')
                audit={r[0]:(r[1],json.loads(r[2])) for r in connection.execute('SELECT entry_id,source_schema,payload FROM audit_events')}
                for identity,row in {**old_entries,'O2':{'customer_id':9,'currency':'CNY','amount':'5.00','reversal_of':None}}.items():
                    need(audit[identity],(1,{k:row[k] for k in ('customer_id','currency','amount','reversal_of')}),name+'.historical_audit_payload')
                need(audit['N_FEE'],(2,{k:fresh.get(k) for k in ('customer_key','currency','amount_minor','reversal_of','fee_minor')}),name+'.new_audit_payload')
                for clause,expected_error in [("'C-ALPHA','USD',1,NULL,-1",'SQLITE_CONSTRAINT_CHECK'),("'MISSING','USD',1,NULL,0",'SQLITE_CONSTRAINT_FOREIGNKEY')]:
                    connection.execute('BEGIN IMMEDIATE')
                    try:connection.execute('INSERT INTO entries(entry_id,customer_key,currency,amount_minor,reversal_of,fee_minor) VALUES(\'CHECK_CONTRACT\','+clause+')')
                    except sqlite3.IntegrityError as error:need(error.sqlite_errorname,expected_error,name+'.database_constraint')
                    else:raise AssertionError('expected database error contract')
                    finally:connection.rollback()
                if name=='normal':
                    for sql,expected_error in [
                        ("INSERT INTO write_receipts VALUES(NULL,'{}','{}')",'SQLITE_CONSTRAINT_NOTNULL'),
                        ("INSERT INTO write_receipts VALUES('  ','{}','{}')",'SQLITE_CONSTRAINT_CHECK'),
                        ("INSERT INTO customers VALUES(NULL,'unknown','unknown@example.test')",'SQLITE_CONSTRAINT_NOTNULL'),
                        ("INSERT INTO entries(entry_id,customer_key,currency,amount_minor,reversal_of,fee_minor) VALUES(NULL,'C-ALPHA','USD',1,NULL,0)",'SQLITE_CONSTRAINT_NOTNULL')]:
                        connection.execute('BEGIN IMMEDIATE')
                        try:connection.execute(sql)
                        except sqlite3.IntegrityError as error:need(error.sqlite_errorname,expected_error,name+'.identity_storage_contract')
                        else:raise AssertionError('expected identity storage error contract')
                        finally:connection.rollback()
                need(connection.execute('PRAGMA integrity_check').fetchone()[0],'ok',name+'.sqlite_integrity')
            query=run([python,'-B',str(scripts/'reference_api.py'),'--db',str(db),'--action','get','--id','N_FEE'])
            need(query,{'status':'ok','entry':{'entry_id':'N_FEE','customer_key':'C-ALPHA','currency':'USD','amount_minor':333,'reversal_of':None,'fee_minor':7}},name+'.new_process_read')
            summaries.append({'case':name,'status':'passed','database':str(db),'version':2,'epoch':4,'canonical_entries':7,'quarantined_records':6})
        for name,sql,parameters,status in [
            ('unresolved_receipt',"INSERT INTO write_receipts VALUES(NULL,?,?)",('{}','{"status":"accepted"}'),'unresolved_receipt_identity'),
            ('unresolved_entry',"INSERT INTO legacy_entries VALUES(?,?,?,?,?)",('',7,'USD','1.00',None),'unresolved_entry_identity')]:
            case=root/name;case.mkdir();db=case/'application.sqlite';shutil.copy2(base/'v1.sqlite',db)
            connection=sqlite3.connect(db)
            connection.execute(sql,parameters);connection.commit();connection.close()
            original=source_snapshot(db)
            upgrade=[python,'-B',str(scripts/'reference_api.py'),'--db',str(db),'--action','upgrade','--authority',str(authority)]
            need(run(upgrade),{'status':status},name+'.operator_reconciliation_required')
            need(source_snapshot(db),original,name+'.original_state_preserved')
            need(observed(db),{'version':1,'epoch':3},name+'.version_and_epoch')
            summaries.append({'case':name,'status':'aborted_as_specified','database':str(db),'version':1,'epoch':3,'error':status})
        dump(root/'receipt.json',{'status':'passed','scope':'synthetic tiny SQLite migration/epoch/process qualification only; not frozen heavy case or hours',
                                 'cases':summaries,'seconds':time.perf_counter()-start,'check_count':len(checks),'subprocess_count':len(events),
                                 'sqlite_version':sqlite3.sqlite_version,'journal_mode':'DELETE','physical_power_loss_tested':False,'heavy_case_count_increment':0})
    finally:
        for process in children:
            if process.poll() is None:process.kill();process.wait(timeout=5)
        dump(root/'process-events.json',events);dump(root/'checks.json',checks)
    print(json.dumps({'status':'passed','cases':len(summaries),'seconds':time.perf_counter()-start}),flush=True)


if __name__=='__main__':main()
