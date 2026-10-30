"""Independent raw SQL/Fraction source ledger, no author fold/targets imports."""
from pathlib import Path
from fractions import Fraction
import sqlite3,json,csv,re,time,sys
R=Path(__file__).parent;X=Path('D:/opencorvus-benchmark-runs/l05-full-case-20261031')
FIELDS={'journal':'seq tenant request_id event_id revision kind amount_minor payload','opening':'tenant amount_minor','adjustments':'tenant adjustment_id amount_minor approval','notes':'tenant note_id body','projection':'tenant event_id revision status amount_minor','postings':'seq tenant event_id payload source_kind source_id boundary_seq epoch receipt_id','control':'id epoch active','repair_cuts':'repair_id epoch boundary_seq snapshot_json phase completed_epoch','samples':'window_id pending total pending_ratio conflicts mismatched_sources active_json','alerts':'window_id alarm status'}
def j(p):return json.loads(p.read_text(encoding='utf-8'))
def norm(v):return sorted(json.dumps(x,sort_keys=True,ensure_ascii=False) for x in v)
def quote(v):return '"'+v.replace('"','""')+'"'
def read(db,mapping=None,original=False):
 c=sqlite3.connect(db.resolve().as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
 try:
  out={}
  for table,fields in FIELDS.items():
   if original and table in ['repair_cuts','samples','alerts']:continue
   cols=fields.split();spec=mapping[table] if mapping else dict(table=table,columns={k:k for k in cols});out[table]=[dict(r) for r in c.execute('select '+','.join(quote(spec['columns'][k])+' as '+quote(k) for k in cols)+' from '+quote(spec['table']))]
  return out
 finally:c.close()
def remote(db):
 c=sqlite3.connect(db.resolve().as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
 try:return {t:[dict(r) for r in c.execute('select * from '+t)] for t in ['effects','requests','drop_once']}
 finally:c.close()
count={};fail=[]
def ck(key,ok,at=None):
 count[key]=count.get(key,0)+1
 if not ok:fail.append(dict(check=key,at=at))
def fold(journal):
 out={}
 for row in journal:
  key=(row['tenant'],row['event_id']);out.setdefault(key,[]).append(row)
 result={}
 for key,rr in out.items():
  rev=max(x['revision'] for x in rr);payload={(x['kind'],x['amount_minor']) for x in rr if x['revision']==rev}
  result[key]=(rev,*next(iter(payload))) if len(payload)==1 else (rev,'quarantined',0)
 return result
def sources(facts):
 wanted={(x['tenant'],'opening','opening'):x['amount_minor'] for x in facts['opening']};wanted.update({(x['tenant'],'adjustment',x['adjustment_id']):x['amount_minor'] for x in facts['adjustments']});wanted.update({(t,'business',e):v[2] for (t,e),v in fold(facts['journal']).items()});return wanted
def expected_facts(orig,events):
 journal={(r['tenant'],r['request_id']):dict(r) for r in orig['journal']};adjust={(r['tenant'],r['adjustment_id']):dict(r) for r in orig['adjustments']};notes={(r['tenant'],r['note_id']):dict(r) for r in orig['notes']};seq=max([x['seq'] for x in orig['journal']]+[0]);epoch=1;active=True
 for event in events:
  if event.get('kind')!='application' or event.get('legacy'):continue
  request=event['request'];answer=event.get('response') or {};action=request['action']
  if action=='pause' and answer.get('status')=='paused':active=False
  if action=='repair' and answer.get('status') in ['resumed','repair_complete']:active=True;epoch=2
  if action=='ingest':
   row=request['event'];key=(row['tenant'],row['request_id']);payload=json.dumps(row,sort_keys=True,ensure_ascii=False,separators=(',',':'))
   if key in journal:expected='duplicate' if json.loads(journal[key]['payload'])==row else 'transport_conflict';expected_seq=journal[key]['seq']
   elif request['epoch']!=epoch:expected='stale_epoch';expected_seq=None
   elif not active:expected='paused';expected_seq=None
   elif row['tenant'] not in {r['tenant'] for r in orig['opening']}:expected='unknown_tenant';expected_seq=None
   else:
    expected='accepted';seq+=1;expected_seq=seq;journal[key]=dict(seq=seq,**row,payload=payload)
   if event.get('intentional_process_fault'):
    ck('accepted_fault_actual_journal',expected=='accepted' and event['pause']=='after_accept_commit' and any(x==journal[key] for x in event['checkpoint_sql']['local']['journal']))
   else:ck('real_request_transport_and_epoch',answer.get('status')==expected and (expected not in ['accepted','duplicate'] or type(answer.get('seq')) is int and answer['seq']==expected_seq),(request,answer,expected))
  if action=='adjustment':
   key=(request['tenant'],request['adjustment_id']);row={k:request[k] for k in ['tenant','adjustment_id','amount_minor','approval']};ck('adjustment_real_domain',next(x['amount_minor'] for x in orig['opening'] if x['tenant']==row['tenant'])+sum(min(0,x['amount_minor']) for x in adjust.values() if x['tenant']==row['tenant'])+min(0,row['amount_minor'])>=0);adjust[key]=row;ck('adjustment_real_ACK',answer.get('status')=='approved')
  if action=='note':
   row={k:request[k] for k in ['tenant','note_id','body']};notes[(row['tenant'],row['note_id'])]=row;ck('new_note_real_ACK',answer.get('status')=='accepted')
 return dict(journal=list(journal.values()),opening=orig['opening'],adjustments=list(adjust.values()),notes=list(notes.values()))
def stage_check(local,rem,wanted,orig,oldrem,plan_keys,where):
 for table in ['journal','opening','adjustments','notes']:
  def n(rr):return [{**x,'payload':json.loads(x['payload'])} if table=='journal' else x for x in rr]
  ck('all_original_and_new_accepted_facts',norm(n(local[table]))==norm(n(wanted[table])),(where,table))
 businesses=fold(wanted['journal']);ck('highest_revision_all_businesses',{(r['tenant'],r['event_id']):(r['revision'],r['status'],r['amount_minor']) for r in local['projection']}==businesses,where)
 lm={(p['tenant'],p['event_id']):p for p in local['postings']};rm={(p['tenant'],p['event_id']):p for p in rem['effects']};ck('complete_unique_effect_catalogue',len(lm)==len(local['postings']) and len(rm)==len(rem['effects']) and set(lm)==set(rm),where);contribution={};wire={}
 for key,p in lm.items():
  w=json.loads(p['payload']);wire[key]=w;ck('actual_immutable_wire_receipt',set(w)=={'tenant','event_id','kind','amount_minor','reverses'} and w['tenant']==key[0] and w['event_id']==key[1] and type(w['amount_minor']) is int and 0<abs(w['amount_minor'])<=10**12 and all(rm[key][k]==v for k,v in w.items()) and rm[key]['receipt_id']==p['receipt_id'],(where,key));source=(p['tenant'],p['source_kind'],p['source_id']);contribution[source]=contribution.get(source,0)+rm[key]['amount_minor'];ck('posting_acceptance_boundary',type(p['boundary_seq']) is int and 0<=p['boundary_seq']<=max(r['seq'] for r in wanted['journal']) and p['epoch']==(1 if key in plan_keys else 2),(where,key))
  if p['source_kind']=='business':ck('source_existed_before_registration',any(r['tenant']==p['tenant'] and r['event_id']==p['source_id'] and r['seq']<=p['boundary_seq'] for r in wanted['journal']))
 for key,w in wire.items():
  if w['kind']=='post':ck('same_tenant_funding_capacity',w['amount_minor']>0 and w['reverses'] is None and w['amount_minor']+sum(u['amount_minor'] for k,u in wire.items() if k[0]==key[0] and u['kind']=='reversal' and u['reverses']==key[1])>=0)
  else:ck('reversal_real_parent',w['kind']=='reversal' and w['amount_minor']<0 and (key[0],w['reverses']) in wire and wire[(key[0],w['reverses'])]['kind']=='post')
 target=sources(wanted);ck('every_logical_source_exact',all(contribution.get(k,0)==target.get(k,0) for k in set(contribution)|set(target)),where)
 for old in orig['postings']:
  actual=lm[(old['tenant'],old['event_id'])];ck('old_registration_full_fields',all(actual[k]==v for k,v in old.items() if k!='receipt_id') and (old['receipt_id'] is None or actual['receipt_id']==old['receipt_id']))
 for old in oldrem['effects']:ck('old_remote_receipt_immutable',rm[(old['tenant'],old['event_id'])]==old)
 return {tenant:sum(v for k,v in target.items() if k[0]==tenant) for tenant in sorted({k[0] for k in target})}
def audit(role,run):
 raw=X/('raw-closed-'+role);orig=read(raw/'original-local.sqlite',original=True);oldrem=remote(raw/'original-remote.sqlite');reg=j(run/'registration.json');mapping=reg['logical_map'];events=j(run/'events.json');expected=expected_facts(orig,events);plan=next(e for e in events if e.get('pause')=='after_plan_commit');planned=plan['checkpoint_sql']['local']['postings'];plan_keys={(p['tenant'],p['event_id']) for p in planned};summary={}
 for stage,facts in [('repaired-incident',orig),('repaired-current',expected),('final',expected)]:
  folder=run/stage;local=read(folder/'local.sqlite',mapping);rem=remote(folder/'remote.sqlite');summary[stage]=stage_check(local,rem,facts,orig,oldrem,plan_keys,(role,stage));capt=j(folder/'facts.json');ck('stage_actual_SQL_capture',all(norm(local[t])==norm(capt['local'][t]) for t in local) and all(norm(rem[t])==norm(capt['remote'][t]) for t in rem))
 final=read(run/'local.sqlite',mapping);finalrem=remote(run/'remote.sqlite');stage_check(final,finalrem,expected,orig,oldrem,plan_keys,(role,'live final'));cut=next(r for r in final['repair_cuts'] if r['repair_id']=='incident');snap=json.loads(cut['snapshot_json']);ck('durable_original_cut_prefix',cut['phase']=='complete' and cut['completed_epoch']==2 and cut['boundary_seq']==max(r['seq'] for r in orig['journal']) and all(norm(snap[t])==norm(orig[t]) for t in ['journal','opening','adjustments','notes']) and norm(snap['intent_keys'])==norm([{k:r[k] for k in ['tenant','event_id','payload']} for r in orig['postings']]) and final['control']==[dict(id=1,epoch=2,active=1)])
 incident=read(run/'repaired-incident/local.sqlite',mapping);lm={(p['tenant'],p['event_id']):p for p in incident['postings']}
 for p in planned:ck('durable_full_planned_registration',all(lm[(p['tenant'],p['event_id'])][k]==v for k,v in p.items() if k!='receipt_id') and (p['receipt_id'] is None or lm[(p['tenant'],p['event_id'])]['receipt_id']==p['receipt_id']))
 apps=[e for e in events if e.get('kind')=='application'];identities=[]
 for e in apps:
  identity=json.loads(e['stderr'].splitlines()[0]);ck('actual_actor_uid_PID_native',identity['pid']==e['pid'] and identity['uid']==10001 and (e['exit_code']==0 or e.get('intentional_process_fault') and e['exit_code']!=0));identities.append(identity)
  if e.get('pause'):
   ck('actual_owned_checkpoint_PID',e['checkpoint']['pid']==e['pid'] and e['checkpoint']['name']==e['pause'])
 receipt_fault=next(e for e in apps if e.get('pause')=='after_remote_receipt_before_confirm');d=receipt_fault['checkpoint']['detail'];cp=receipt_fault['checkpoint_sql'];lp=next(p for p in cp['local']['postings'] if p['tenant']==d['tenant'] and p['event_id']==d['event_id']);rr=next(p for p in cp['remote']['effects'] if p['tenant']==d['tenant'] and p['event_id']==d['event_id']);ck('remote_commit_before_local_confirm',lp['receipt_id'] is None and all(rr[k]==v for k,v in json.loads(lp['payload']).items()) and rr['receipt_id']==d['receipt']['receipt_id'])
 services=[e for e in events if e.get('kind')=='service_start'];ends=[e for e in events if e.get('kind')=='service_terminal'];ck('three_actual_receivers_natural_terminal',len(services)==len(ends)==3 and {e['pid'] for e in services}=={e['pid'] for e in ends} and all(e['exit_code']==0 for e in ends))
 late=next(e for e in apps if e.get('legacy'))
 if late['request']['action']=='send_registered_wire':historical_identity=(late['request']['wire']['tenant'],late['request']['wire']['event_id'])
 else:historical_identity=(late['request']['tenant'],late['request']['event_id'])
 ck('real_late_HTTP_original_receipt',late['response']['result']['status']=='replayed' and late['response']['result']['receipt']['receipt_id']==next(p['receipt_id'] for p in incident['postings'] if (p['tenant'],p['event_id'])==historical_identity))
 old_active=set();windows=[]
 for e in apps:
  if e['request']['action']!='monitor':continue
  w=e['request']['window_id'];before=e['monitor_before'];after=e['monitor_after'];local=before['local'];effects={(r['tenant'],r['event_id']):r for r in before['remote']['effects']};desired=sources(local);contrib={}
  for p in local['postings']:
   row=effects.get((p['tenant'],p['event_id']))
   if row:
    k=(p['tenant'],p['source_kind'],p['source_id']);contrib[k]=contrib.get(k,0)+row['amount_minor']
  pending=sum(p['receipt_id'] is None for p in local['postings']);total=len(local['postings']);conflicts=sum(p[1]=='quarantined' for p in fold(local['journal']).values());mismatch=sum(desired.get(k,0)!=contrib.get(k,0) for k in set(desired)|set(contrib));active={k for k,v in [('pending',pending),('business_conflict',conflicts),('source_mismatch',mismatch)] if v};sample=e['response']['sample'];ck('real_monitor_counts_fraction_array',sample['pending']==pending and sample['total']==total and Fraction(sample['pending_ratio'])==(Fraction(pending,total) if total else 0) and sample['conflicts']==conflicts and sample['mismatched_sources']==mismatch and type(json.loads(sample['active_json'])) is list and set(json.loads(sample['active_json']))==active)
  previous=set() if w=='empty' else old_active;trans=[dict(window_id=w,alarm=k,status='still_active' if k in active and k in previous else 'opened' if k in active else 'resolved' if k in previous else 'clear') for k in ['pending','business_conflict','source_mismatch']];ck('real_alert_transition',norm(e['response']['transitions'])==norm(trans));store=read(run/'empty-monitor.sqlite',mapping) if w=='empty' else final;ck('durable_sample_alerts',sample in store['samples'] and norm([r for r in store['alerts'] if r['window_id']==w])==norm(trans));ck('monitor_only_observes_business_effects',all(norm(local[t])==norm(after['local'][t]) for t in ['journal','opening','adjustments','notes','projection','postings','control','repair_cuts']) and norm(before['remote']['effects'])==norm(after['remote']['effects']));old_active=active if w!='empty' else old_active;windows.append(sample)
 return dict(accounts=summary,postings=len(final['postings']),receipts=len(finalrem['effects']),accepted=len(final['journal']),samples=windows,actor_identities=identities)
start=time.monotonic();results={}
if '--cold' in sys.argv:results['base']=audit('base',R/'cold-native/results/run');filename='cold-sql-audit.json'
elif '--alternative' in sys.argv:results['base']=audit('base',X/'closed-alternative-base/results/run');filename='alternative-sql-audit.json'
elif '--compatible' in sys.argv:results['base']=audit('base',X/'closed-compatible-compat/results/run');filename='compatible-sql-audit.json'
elif '--schema' in sys.argv:results['base']=audit('base',X/'closed-schema-compat/results/run');filename='schema-sql-audit.json'
elif '--finalbase' in sys.argv:results['base']=audit('base',X/'closed-main-final-base/results/run');filename='final-base-sql-audit.json'
else:
 for role in ['base','amount','tenant']:results[role]=audit(role,X/f'closed-main-{role}/results/run')
 filename='whole-sql-audit.json'
(R/filename).write_text(json.dumps(dict(source='Independent readonly SQLite, Python integers/Fraction, original request/state and complete source ledger. No author app/fold/targets imports.',seconds=time.monotonic()-start,checks=count,failures=fail,results=results),ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(dict(seconds=time.monotonic()-start,failures=fail,accounts={k:v['accounts'] for k,v in results.items()}),ensure_ascii=False,indent=2))
