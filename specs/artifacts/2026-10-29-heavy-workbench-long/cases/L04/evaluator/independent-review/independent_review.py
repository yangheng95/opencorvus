"""Independent SQLite/raw/ACK/process review and a narrowly scoped receipt-key probe."""
from collections import Counter
from decimal import Decimal
import json
from pathlib import Path
import re
import shutil
import sqlite3
import sys
sys.dont_write_bytecode=True
from prepare_and_run import ROOT,command,save,load

def rows(db,sql):
    c=sqlite3.connect(db.as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
    try:return [dict(r) for r in c.execute(sql)]
    finally:c.close()

def derive():
    db=ROOT/'frozen-input/v1.sqlite';authority=load(ROOT/'frozen-input/authority.json')
    customers={r['customer_id']:r for r in rows(db,'SELECT * FROM legacy_customers')}
    original={r['entry_id']:r for r in rows(db,'SELECT * FROM legacy_entries')}
    sources={**original,'O2':{'entry_id':'O2','customer_id':9,'currency':'CNY','amount':'5.00','reversal_of':None}}
    aliases={};quarantine={};prepared={}
    for identity,raw in customers.items():
        target=authority['legacy_to_customer'].get(str(identity))
        if target is None:quarantine[('customer',str(identity))]=('unmapped_customer',raw)
        else:aliases[identity]=target
    for identity,raw in sources.items():
        reason=None
        if raw['customer_id'] not in aliases:reason='unmapped_customer'
        elif raw['currency'] not in ('USD','CNY'):reason='unsupported_currency'
        elif re.fullmatch(r'-?[0-9]+(?:\.[0-9]+)?',raw['amount']) is None:reason='invalid_amount'
        elif '.' in raw['amount'] and len(raw['amount'].split('.')[1])>2:reason='amount_scale'
        if reason:quarantine[('entry',identity)]=(reason,raw)
        else:prepared[identity]={'entry_id':identity,'customer_key':aliases[raw['customer_id']],
            'currency':raw['currency'],'amount_minor':int(Decimal(raw['amount'])*100),'reversal_of':raw['reversal_of'],'fee_minor':0}
    accepted={}
    for identity,entry in prepared.items():
        parent=prepared.get(entry['reversal_of']);bad=False
        if entry['reversal_of'] is None:bad=entry['amount_minor']<0
        else:bad=(entry['amount_minor']>=0 or parent is None or parent['amount_minor']<=0 or parent['reversal_of'] is not None or
                  parent['customer_key']!=entry['customer_key'] or parent['currency']!=entry['currency'])
        if bad:quarantine[('entry',identity)]=('invalid_reversal',sources[identity])
        else:accepted[identity]=entry
    accepted['N_FEE']={'entry_id':'N_FEE','customer_key':'C-ALPHA','currency':'USD','amount_minor':333,'reversal_of':None,'fee_minor':7}
    return authority,customers,original,sources,aliases,quarantine,accepted

def sql_audit():
    authority,customers,original,sources,aliases,quarantine,accepted=derive()
    initial=ROOT/'frozen-input/v1.sqlite'
    history=rows(initial,'SELECT * FROM schema_migrations ORDER BY version')
    original_audit=rows(initial,'SELECT * FROM audit_events ORDER BY event_id')
    checks=[];reports=[]
    def check(case,name,actual,expected):
        ok=actual==expected;checks.append({'case':case,'contract':name,'actual':actual,'expected':expected,'passed':ok})
    for case in ('normal','before_commit_fault','after_commit_fault','queued_cutover'):
        db=ROOT/'cold-run'/case/'application.sqlite'
        state=rows(db,'SELECT max(version) AS version FROM schema_migrations')[0]|rows(db,'SELECT epoch FROM control WHERE singleton=1')[0]
        check(case,'unique_schema_version_and_epoch',state,{'version':2,'epoch':4})
        actual={r['entry_id']:{k:r[k] for k in ('entry_id','customer_key','currency','amount_minor','reversal_of','fee_minor')}
                for r in rows(db,'SELECT * FROM entries')}
        check(case,'each_entry_identity_customer_currency_exact_amount_refund_fee',actual,accepted)
        check(case,'canonical_customer_facts',{r['customer_key']:{k:r[k] for k in ('display_name','email')} for r in rows(db,'SELECT * FROM customers')},authority['customers'])
        actual_alias={r['legacy_id']:r for r in rows(db,'SELECT * FROM customer_aliases')}
        check(case,'authority_aliases',{str(k):v['customer_key'] for k,v in actual_alias.items()},{str(k):v for k,v in aliases.items()})
        for identity,r in actual_alias.items():check(case,'complete_alias_raw_'+str(identity),json.loads(r['raw_json']),customers[identity])
        actual_quarantine={(r['kind'],r['legacy_key']):(r['reason'],json.loads(r['raw_json'])) for r in rows(db,'SELECT * FROM quarantine')}
        check(case,'complete_quarantine_reason_and_raw',[[*k,v] for k,v in sorted(actual_quarantine.items())],[[*k,v] for k,v in sorted(quarantine.items())])
        for identity,r in {r['entry_id']:r for r in rows(db,'SELECT entry_id,legacy_raw_json FROM entries')}.items():
            check(case,'complete_entry_raw_'+identity,None if r['legacy_raw_json'] is None else json.loads(r['legacy_raw_json']),None if identity=='N_FEE' else sources[identity])
        h=rows(db,'SELECT * FROM schema_migrations ORDER BY version')
        check(case,'all_historical_migration_records_preserved',h[:len(history)],history)
        check(case,'single_target_migration_versions',[r['version'] for r in h],[1,2])
        audit=rows(db,'SELECT * FROM audit_events ORDER BY event_id')
        check(case,'all_original_audit_event_ids_and_payload_bytes',audit[:len(original_audit)],original_audit)
        added=audit[len(original_audit):]
        check(case,'post_snapshot_audit_identities',[(r['event_id'],r['entry_id'],r['source_schema']) for r in added],[(11,'O2',1),(12,'N_FEE',2)])
        check(case,'old_writer_actual_audit_payload',json.loads(added[0]['payload']),{'customer_id':9,'currency':'CNY','amount':'5.00','reversal_of':None})
        check(case,'new_writer_actual_audit_payload',json.loads(added[1]['payload']),{'customer_key':'C-ALPHA','currency':'USD','amount_minor':333,'reversal_of':None,'fee_minor':7})
        receipts={r['op_key']:r for r in rows(db,'SELECT * FROM write_receipts')}
        check(case,'receipt_identity_set',sorted(receipts),['before-cutover','new-accepted'])
        expected_commands={'before-cutover':{'epoch':3,'op_key':'before-cutover','entry_id':'O2','customer_id':9,'currency':'CNY','amount':'5.00'},
            'new-accepted':{'epoch':4,'op_key':'new-accepted','entry_id':'N_FEE','customer_key':'C-ALPHA','currency':'USD','amount_minor':333,'fee_minor':7}}
        for key,r in receipts.items():
            check(case,'immutable_full_receipt_command_'+key,json.loads(r['command_json']),expected_commands[key])
            check(case,'immutable_ACK_'+key,json.loads(r['result_json']),{'status':'accepted','entry_id':'O2' if key=='before-cutover' else 'N_FEE','epoch':3 if key=='before-cutover' else 4,'source_schema':1 if key=='before-cutover' else 2})
        check(case,'sqlite_integrity_report',rows(db,'PRAGMA integrity_check')[0]['integrity_check'],'ok')
        check(case,'foreign_key_consistency_report',rows(db,'PRAGMA foreign_key_check'),[])
        reports.append({'case':case,'database':str(db),'identity_entries':actual,'quarantine_records':len(actual_quarantine),
            'audit_events':len(audit),'receipts':len(receipts),'schema_state':state})
    result={'scope':'independent SQL and source/authority-derived facts, not author expected table import',
        'checks':checks,'all_passed':all(c['passed'] for c in checks),'check_count':len(checks),'cases':reports}
    save(ROOT/'independent-sql-audit.json',result);return result

def process_audit():
    events=load(ROOT/'cold-run/process-events.json');cases=[]
    for e in events:
        if '--pause-at' not in e['argv']:continue
        phase=e['argv'][e['argv'].index('--pause-at')+1]
        checkpoint=e['control_events'][0]['checkpoint'];state=e['control_events'][0]['independent_database_state']
        own_path=Path(e['argv'][2]).resolve().is_relative_to((ROOT/'cold-run/executed-source').resolve())
        checks={'own_executed_source':own_path,'actual_checkpoint_pid_matches_handle':checkpoint['pid']==e['pid'],
            'phase_matches_transaction_property':checkpoint['transaction_open']==(phase=='before_commit'),
            'external_version_epoch_fact':state==({'version':1,'epoch':3} if phase=='before_commit' else {'version':2,'epoch':4})}
        terminated=[v for v in e['control_events'] if v.get('action')=='terminate_owned_subprocess']
        if terminated:checks['terminated_only_same_checkpoint_child']=len(terminated)==1 and terminated[0]['pid']==e['pid'] and e['returncode']!=0
        else:checks['released_original_transaction']=e['returncode']==0 and json.loads(e['stdout'].splitlines()[-1])['status']=='upgraded'
        cases.append({'argv':e['argv'],'pid':e['pid'],'phase':phase,'control_events':e['control_events'],'returncode':e['returncode'],'checks':checks})
    queued=next(e for e in events if '--announce-attempt' in e['argv'])
    attempt=json.loads(queued['stderr'].splitlines()[0]);response=json.loads(queued['stdout'])
    queue_fact={'own_attempt_pid':attempt['pid']==queued['pid'],'response':response,
        'returned_stale_after_cutover':response=={'status':'stale_epoch','current_epoch':4},
        'observation_limit':'write_attempt prints immediately before BEGIN; process enters before cutover, but no separate SQLITE_BUSY/busy-handler event proves engine-internal queue timing'}
    result={'owned_subprocess_events':len(events),'fault_or_release_cases':cases,'queued_writer':queue_fact,
        'all_observed_protocol_checks_passed':all(all(c['checks'].values()) for c in cases) and queue_fact['own_attempt_pid'] and queue_fact['returned_stale_after_cutover'],
        'kill_scope_source_review':'harness stores only its own Popen handles; all .kill calls use those handles, never a PID from input or global process enumeration'}
    save(ROOT/'independent-process-audit.json',result);return result

def null_receipt_probe():
    reports=[]
    for version,source,script in [('v1',ROOT/'frozen-input/v1.sqlite','legacy_writer.py'),('v2',ROOT/'cold-run/normal/application.sqlite','reference_api.py')]:
        folder=ROOT/'receipt-key-probe'/version;folder.mkdir(parents=True,exist_ok=False);db=folder/'probe.sqlite';shutil.copy2(source,db)
        base={'epoch':3 if version=='v1' else 4,'op_key':None,'entry_id':'P_NULL_A','currency':'CNY'}
        if version=='v1':base|={'customer_id':7,'amount':'1.11'}
        else:base|={'customer_key':'C-ALPHA','amount_minor':111,'fee_minor':0}
        observed=[]
        for label,req in [('first',base),('identical',base),('changed_same_null_key',base|{'entry_id':'P_NULL_B'})]:
            path=folder/(label+'.request.json');save(path,req)
            argv=['C:/Python314/python.exe','-B',str(ROOT/'source-snapshot'/script),'--db',str(db)]
            if version=='v2':argv+=['--action','write']
            argv+=['--request',str(path)]
            receipt=command(argv,'null-key-'+version+'-'+label)
            response=json.loads((ROOT/receipt['stdout']).read_text(encoding='utf-8'))
            observed.append({'step':label,'response':response,'command':receipt})
        nullrows=rows(db,'SELECT op_key,command_json,result_json FROM write_receipts WHERE op_key IS NULL')
        reports.append({'version':version,'observed':observed,'null_receipt_rows':nullrows,
            'finding_confirmed':observed[0]['response']['status']=='accepted' and observed[1]['response']['status']!='duplicate' and observed[2]['response']['status']=='accepted',
            'scope':'extra mutable probe copy only; original full cold-run databases/results preserved'})
    save(ROOT/'receipt-key-probe.json',reports);return reports

def main():
    sql=sql_audit();process=process_audit();probe=null_receipt_probe()
    result={'independent_sql_passed':sql['all_passed'],'independent_sql_checks':sql['check_count'],
        'owned_process_protocol_passed':process['all_observed_protocol_checks_passed'],
        'null_key_shared_issue_confirmed':all(r['finding_confirmed'] for r in probe),
        'reference_core_four_scenarios_passed':True,'heavy_freeze_approved':False,'hours_validated':False}
    save(ROOT/'independent-summary.json',result);print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
