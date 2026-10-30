"""Independent raw SQLite/authority and request ledger audit, no author imports."""
from pathlib import Path
from decimal import Decimal
from fractions import Fraction
from datetime import datetime
import csv,json,sqlite3,re,time,itertools,sys
R=Path(__file__).parent;X=Path('D:/opencorvus-benchmark-runs/l04-full-case-20261031')
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def sql(p):
 c=sqlite3.connect(p.resolve().as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
 try:
  names=[r[0] for r in c.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%'")];return dict(tables={n:[dict(r) for r in c.execute('select * from "'+n+'"')] for n in names},integrity=c.execute('pragma integrity_check').fetchone()[0],foreign_keys=c.execute('pragma foreign_key_check').fetchall())
 finally:c.close()
def norm(rr):return sorted(json.dumps(r,sort_keys=True,ensure_ascii=False) for r in rr)
def instant(s):return datetime.fromisoformat(s.replace('Z','+00:00'))
fail=[];counts={};results={}
def ck(name,ok,at=None):
 counts[name]=counts.get(name,0)+1
 if not ok:fail.append(dict(check=name,at=at))
def classify(raw,pre):
 tables=sql(raw/'app-v1.sqlite')['tables'];a=load(raw/'identity-authority.json');es=tables['legacy_entries']+[pre];mapped={c['customer_id']:a['legacy_to_customer'].get(str(c['customer_id'])) for c in tables['legacy_customers']};base={};bad={}
 for e in es:
  key=e['entry_id'];v=e['amount'];why=None
  if mapped.get(e['customer_id']) is None:why='unmapped_customer'
  elif e['currency'] not in ['USD','CNY']:why='unsupported_currency'
  elif not isinstance(v,str) or re.fullmatch(r'-?[0-9]+(?:\.[0-9]{1,2})?',v) is None:why='amount_scale'
  else:
   exact=Decimal(v)*100
   if exact<-(2**63) or exact>=2**63:why='amount_range'
   else:base[key]=dict(entry_id=key,customer_key=mapped[e['customer_id']],currency=e['currency'],amount_minor=int(exact),reversal_of=e['reversal_of'],fee_minor=0,legacy_raw_json=e)
  if why:bad[key]=why
 for k,e in base.items():
  parent=base.get(e['reversal_of']);v=e['amount_minor']
  if e['reversal_of'] is None:
   if v<0:bad[k]='invalid_reversal'
  elif v>=0 or parent is None or parent['amount_minor']<=0 or parent['reversal_of'] is not None or parent['customer_key']!=e['customer_key'] or parent['currency']!=e['currency']:bad[k]='invalid_reversal'
 groups={}
 for k,e in base.items():
  if k not in bad and e['reversal_of'] is not None:groups.setdefault(e['reversal_of'],[]).append(k)
 for parent,keys in groups.items():
  if sum(-base[k]['amount_minor'] for k in keys)>base[parent]['amount_minor']:
   for k in keys:bad[k]='refund_group_exceeds'
 target={k:v for k,v in base.items() if k not in bad};q={('entry',e['entry_id']):dict(reason=bad[e['entry_id']],raw=e) for e in es if e['entry_id'] in bad}
 for c in tables['legacy_customers']:
  if mapped[c['customer_id']] is None:q[('customer',str(c['customer_id']))]=dict(reason='unmapped_customer',raw=c)
 return tables,a,mapped,target,q
def audit(variant,run):
 raw=X/('raw-'+variant);summary=[]
 for name in ['clean','before','after','cutover']:
  path=run/name;events=load(path/'events.json');pre=next(e['request']['write'] for e in events if e['legacy'] and e['request']['action']=='write');prerow={k:pre.get(k) for k in ['entry_id','customer_id','currency','amount','reversal_of']};original,authority,mapping,want,quarantine=classify(raw,prerow);actual=sql(path/'live.sqlite');tables=actual['tables'];snapshot=load(path/'final-sql.json')
  ck('actual_DB_integrity',actual['integrity']=='ok' and not actual['foreign_keys'],(variant,name));ck('actual_DB_snapshot_full_tables',set(tables)==set(snapshot['tables']) and all(norm(rows)==norm(snapshot['tables'][table]) for table,rows in tables.items()),(variant,name))
  ck('version_epoch',max(r['version'] for r in tables['schema_migrations'])==2 and tables['control']==[{'singleton':1,'epoch':4}],(variant,name));ck('published_version_history',next(r for r in tables['schema_migrations'] if r['version']==1)==original['schema_migrations'][0])
  converted={e['entry_id']:{**e,'legacy_raw_json':json.loads(e['legacy_raw_json'])} for e in tables['entries'] if e['legacy_raw_json'] is not None};ck('every_legacy_identity_raw_minor_parent',converted==want,(variant,name))
  aliases={r['legacy_id']:(r['customer_key'],json.loads(r['raw_json'])) for r in tables['customer_aliases']};ck('every_alias_and_raw',aliases=={c['customer_id']:(mapping[c['customer_id']],c) for c in original['legacy_customers'] if mapping[c['customer_id']] is not None},(variant,name))
  customers={r['customer_key']:{k:v for k,v in r.items() if k!='customer_key'} for r in tables['customers']};ck('authority_display_identity',customers=={k:authority['customers'][k] for k in set(mapping.values()) if k is not None},(variant,name))
  q={(r['kind'],r['legacy_key']):dict(reason=r['reason'],raw=json.loads(r['raw_json'])) for r in tables['quarantine']};ck('all_quarantine_reasons_original_raw',q==quarantine,(variant,name))
  ck('all_original_notes_bytes',all(r in tables['notes'] for r in original['notes']), (variant,name));ck('new_note_full_NUL',dict(note_id='POST-'+name,entry_id='V2-'+name,text='升级后原用户批注\n\x00尾部 / 追加不可丢') in tables['notes'])
  oldaudit=load(path/'pre-upgrade-sql.json')['tables']['audit_events'];audit={r['event_id']:r for r in tables['audit_events']};ck('all_old_audit_exact',all(audit[r['event_id']]==r for r in oldaudit),(variant,name))
  new={};expected_receipts={r['op_key']:r for r in load(path/'pre-upgrade-sql.json')['tables']['write_receipts']};actual_receipts={r['op_key']:r for r in tables['write_receipts']}
  for e in events:
   request=e['request'];response=e.get('response') or {}
   if request['action']=='write' and not e['legacy'] and response.get('status') in ['accepted','duplicate']:
    w=request['write'];accepted=response if response['status']=='accepted' else response['receipt'];ck('accepted_receipt_request_identity',accepted==dict(status='accepted',entry_id=w['entry_id'],epoch=w['epoch'],source_schema=2),(variant,name,w['op_key']));new[w['entry_id']]={k:w.get(k) for k in ['entry_id','customer_key','currency','amount_minor','reversal_of','fee_minor']};expected_receipts[w['op_key']]=dict(op_key=w['op_key'],command_json=json.dumps(w,sort_keys=True,ensure_ascii=False),result_json=json.dumps(accepted,sort_keys=True,ensure_ascii=False))
  actualnew={r['entry_id']:{k:v for k,v in r.items() if k!='legacy_raw_json'} for r in tables['entries'] if r['legacy_raw_json'] is None};ck('every_new_request_actual_fields',new==actualnew,(variant,name));ck('all_original_new_ack',actual_receipts==expected_receipts,(variant,name))
  audits=[r for r in tables['audit_events'] if r['source_schema']==2];ck('new_exact_once_audit',len(audits)==len(new) and {r['entry_id'] for r in audits}==set(new) and all(json.loads(r['payload'])=={k:v for k,v in new[r['entry_id']].items() if k!='entry_id'} for r in audits),(variant,name))
  for e in events:
   request=e['request'];answer=e.get('response') or {}
   if request['action']=='receipt':ck('original_receipt_API',answer==dict(status='ok',receipt=json.loads(actual_receipts[request['op_key']]['result_json'])))
   if e.get('intentional_process_fault'):
    line=json.loads(e['checkpoint_line']);ck('owned_fault_PID_handshake',line['pid']==e['pid'] and line['name']==e['pause'] and e['exit_code']!=0)
    at=e['at_checkpoint_sql']['tables'];after=e['after_fault_sql']['tables'];ck('fault_original_SQL_no_unfinished_effect',norm(at['schema_migrations'])==norm(after['schema_migrations']) and at['control']==after['control'])
    if request['action']=='upgrade':ck('upgrade_real_commit_side',max(r['version'] for r in at['schema_migrations'])==(1 if e['pause']=='before_commit' else 2) and at['control'][0]['epoch']==(3 if e['pause']=='before_commit' else 4) and ('entries' in at)==(e['pause']=='after_commit'))
    else:
     w=request['write'];present=e['pause']=='after_commit';ck('write_real_entry_receipt_atomic',any(r['entry_id']==w['entry_id'] for r in at['entries'])==present and any(r['op_key']==w['op_key'] for r in at['write_receipts'])==present)
  if name=='cutover':
   held=[e for e in events if e['legacy'] and e.get('pause')=='before_begin'];up=next(e for e in events if e['request']['action']=='upgrade');ck('two_distinct_old_writer_real_cutover',len(held)==2 and len({e['pid'] for e in held})==2 and all(e['response']==dict(status='stale_epoch',current_epoch=4) and instant(e['started_at'])<instant(up['started_at'])<instant(up['finished_at'])<instant(e['finished_at']) for e in held));ck('stale_effects_not_authorized',all(not r['entry_id'].startswith('STALE-') for r in tables['entries']))
  before=load(path/'pre-recover-sql.json')['tables'];recovered=load(path/'recovered-sql.json')['tables'];backup=sql(path/'backup.sqlite')['tables'];r=next(e['response'] for e in events if e['request']['action']=='recover');expected_missing=sorted({r['op_key'] for r in before['write_receipts']}-{r['op_key'] for r in backup['write_receipts']});ck('recovery_real_complete_ack_difference',r==dict(status='forward_repaired',decision='retain_v2',backup_missing_ack_keys=expected_missing,fee_minor=sum(v['fee_minor'] for v in before['entries']),integrity='ok'))
  ck('recovery_preserves_every_table',set(before)==set(recovered) and all(norm(before[t])==norm(recovered[t]) for t in before));ck('continued_new_write',new['CONTINUED-'+name]['amount_minor']==901 and new['CONTINUED-'+name]['fee_minor']==5)
  export=load(path/'export.json')['tables'];ck('nine_table_API_export_actual_DB',len(export)==9 and all(norm(export[t])==norm(tables[t]) for t in export));date=next(v['applied_at'] for v in tables['schema_migrations'] if v['version']==2);d=instant(date);ck('actual_migration_UTC_time',d.utcoffset().total_seconds()==0 and any(instant(e['started_at'])<=d<=instant(e['finished_at']) for e in events if e['request']['action']=='upgrade'))
  for currency in ['USD','CNY']:
   summary.append(dict(scenario=name,currency=currency,amount_minor=sum(r['amount_minor'] for r in tables['entries'] if r['currency']==currency),fee_minor=sum(r['fee_minor'] for r in tables['entries'] if r['currency']==currency)))
 for name in ['ambiguous_entry','ambiguous_receipt']:
  p=run/name;before=load(p/'ambiguous-before-sql.json');after=sql(p/'live.sqlite');ck('ambiguous_actual_DB_preserved',all(norm(before['tables'][t])==norm(after['tables'][t]) for t in before['tables']) and load(p/'scenario.json')['response']==dict(status='unresolved_entry_identity' if name=='ambiguous_entry' else 'unresolved_receipt_identity'))
 with (run/'delivery/reconciliation.csv').open(encoding='utf-8',newline='') as f:csvrows=list(csv.DictReader(f))
 for r in summary:
  row=next(v for v in csvrows if v['scenario']==r['scenario']);ck('report_true_actual_minor_currency',int(row['amount_minor_'+r['currency']])==r['amount_minor'] and int(row['fee_minor_'+r['currency']])==r['fee_minor'])
 return dict(summaries=summary,quarantine={str(k):v['reason'] for k,v in quarantine.items()},valid_old_count=len(want),quarantine_count=len(quarantine))
start=time.monotonic()
if '--cold' in sys.argv:results['base']=audit('base',R/'cold-native/results/run');filename='cold-sql-audit.json'
elif '--handover' in sys.argv:
 for v in ['base','money','identity']:results[v]=audit(v,X/f'handover-{v}/results/run')
 filename='handover-sql-audit.json'
else:
 for v in ['base','money','identity']:results[v]=audit(v,X/f'final-{v}/results/run')
 filename='whole-sql-audit.json'
(R/filename).write_text(json.dumps(dict(seconds=time.monotonic()-start,source='Independent actual readonly SQLite, Decimal/Fraction, raw authority and original request math; no author business imports',checks=counts,failures=fail,results=results),ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(dict(file=filename,seconds=time.monotonic()-start,checks=sum(counts.values()),failures=fail),ensure_ascii=False,indent=2))
