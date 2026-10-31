from pathlib import Path
from fractions import Fraction as F
from contextlib import closing
import csv,json,sqlite3,shutil,datetime,collections
R=Path('D:/opencorvus-benchmark-runs/l06-v04-whole-case-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-full-case-20261031');read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'));canon=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'));fail=[]
def ck(v,label,detail=None):
 if not v:fail.append({'check':label,'detail':detail})
def exact(v):
 if type(v) not in (int,str):raise ValueError('typed_exact_scalar')
 return F(v)
def table(p):return list(csv.DictReader(p.open(encoding='utf-8-sig',newline='')))
def raw(folder):
 d=read(folder/'profile.json');d['weeks_table']={int(v['week']):{k:int(x) for k,x in v.items() if k!='week'} for v in table(folder/'weeks.csv')};d['supplier_table']={v['supplier']:{k:int(x) for k,x in v.items() if k!='supplier'} for v in table(folder/'suppliers.csv')};d['laws']={v['latent_id']:{'prior':F(int(v['prior_num']),int(v['prior_den'])),'A':F(int(v['A_good_num']),int(v['A_good_den'])),'B':F(int(v['B_good_num']),int(v['B_good_den']))} for v in table(folder/'latent-law.csv')};d['opening']=[{'receipt_id':v['receipt_id'],'amount':int(v['amount']),'due_week':int(v['due_week'])} for v in table(folder/'opening-receivables.csv')];return d
def copy(v):return json.loads(canon(v))
def initial(d):
 s={'week':0,'phase':'laboratory','good':0,'quarantine':{'A':0,'B':0},'incoming':[],'cash':d['initial_cash'],'receivables':copy(d['opening']),'cumulative_cost':0,'costs':{k:0 for k in ['normal','certified','production','laboratory','holding','disposal']},'minimum_cash':d['initial_cash'],'terminal':False};return roll(d,s)
def roll(d,s):
 t=s['week'];s['cash']+=sum(v['amount'] for v in s['receivables'] if v['due_week']==t);s['receivables']=[v for v in s['receivables'] if v['due_week']>t]
 for v in s['incoming']:
  if v['due_week']==t:s['quarantine'][v['supplier']]+=v['packs']
 s['incoming']=[v for v in s['incoming'] if v['due_week']>t];return s
def posterior(d,paid):
 w={k:v['prior'] for k,v in d['laws'].items()}
 for t,vendor,obs in paid:
  for k,law in d['laws'].items():w[k]*=law[vendor] if obs=='good' else 1-law[vendor]
 z=sum(w.values());return {k:v/z for k,v in w.items()},z
def step(d,before,a,obs,tag):
 s=copy(before);t=s['week'];raw_peak=s['good']
 def pay(k,v):
  ck(type(v) is int and v>=0,'integer_nonnegative_payment',tag);s['cash']-=v;s['costs'][k]+=v;s['cumulative_cost']+=v;s['minimum_cash']=min(s['minimum_cash'],s['cash']);ck(s['cash']>=d['cash_floor'],'each_payment_cash_floor',tag)
 if s['phase']=='laboratory':
  ck(set(a)=={'test'},'laboratory_action_keys',tag);vendor=a['test'];ck(vendor is None or vendor in d['supplier_table'],'laboratory_supplier',tag)
  if vendor:
   ck(s['quarantine'][vendor]==1,'available_real_pack',tag);ck(s['good']+d['pack_good_units']<=d['raw_capacity'],'successful_outcome_admission_peak',tag);ck(obs in ['good','reject'],'actual_paid_observation',tag);pay('laboratory',d['lab_fee']);s['quarantine'][vendor]-=1
   if obs=='good':s['good']+=d['pack_good_units']
  else:ck(obs is None,'skip_not_sample',tag)
  raw_peak=s['good'];s['phase']='operations';closing=s['cash']
 else:
  ck(set(a)=={'certified_units','order'},'operations_action_keys',tag);e=a['certified_units'];vendor=a['order'];demand=d['weeks_table'][t]['demand'];ck(type(e) is int and e>=0,'integer_certified_real_units',tag);raw_peak=s['good']+e;ck(raw_peak<=d['raw_capacity'],'certified_peak',tag);ck(raw_peak>=demand,'complete_current_demand',tag)
  if vendor:
   ck(vendor in d['supplier_table'],'order_supplier',tag);due=t+d['supplier_table'][vendor]['lead'];ck(due<d['weeks'],'positive_order_horizon',tag);ck(s['quarantine'][vendor]==0 and all(v['supplier']!=vendor for v in s['incoming']),'original_slot_commitment',tag);pay('normal',d['supplier_table'][vendor]['pack_cost']);s['incoming'].append({'supplier':vendor,'due_week':due,'packs':1})
  pay('certified',e*d['weeks_table'][t]['certified_unit_cost']);pay('production',demand*d['production_cost']);s['good']+=e-demand;s['receivables'].append({'receipt_id':f'sale-week-{t}','amount':demand*d['revenue'],'due_week':t+d['sales_receipt_lag']})
  if t==d['weeks']-1:
   ck(not s['incoming'],'terminal_incoming',tag);pay('disposal',s['good']*d['terminal_good_disposal']+sum(s['quarantine'].values())*d['terminal_pack_disposal']);s['good']=0;s['quarantine']={'A':0,'B':0};ck(s['cash']>=0,'terminal_nonnegative_cash',tag);s['terminal']=True;s['phase']='terminal';closing=s['cash']
  else:pay('holding',s['good']*d['holding']);closing=s['cash'];s['week']+=1;s['phase']='laboratory';roll(d,s)
 return s,raw_peak,closing
copied={}
def sql(db):
 if db.is_relative_to(X):rel=Path('main')/db.relative_to(X)
 else:rel=Path('own')/db.relative_to(R)
 dest=R/'sql-read-copies'/rel;dest.parent.mkdir(parents=True,exist_ok=True)
 if str(db) not in copied:
  for suf in ['', '-wal','-shm']:
   p=Path(str(db)+suf)
   if p.exists():shutil.copy2(p,Path(str(dest)+suf))
  copied[str(db)]=str(dest)
 with closing(sqlite3.connect(dest.resolve().as_uri()+'?mode=ro',uri=True)) as con:return con.execute('SELECT seq,request_id,payload,receipt,packet,response FROM commits ORDER BY seq').fetchall()
def audit(run):
 terminal=read(run/'owner-terminal.json');summaries={};allrecords={};histories={};cuts={k:0 for k in ['order','laboratory']};wire_lines=0
 for ident,part in terminal['instances'].items():
  d=raw(run/'public/instances'/ident);prefixes={};seen=set();results=[];histories[ident]={}
  for cell in part['episodes']:
   folder=run/cell['directory'];stored=sql(folder/'journal.sqlite3');s=initial(d);h=[];paid=[];records=[];orig_packets=[]
   ck(len(stored)==d['weeks']*2,'complete_stage_count',(ident,cell['directory']))
   for index,row in enumerate(stored):
    seq,key,payload,receipt_txt,pkt_txt,resp_txt=row;receipt= json.loads(receipt_txt);pkt=json.loads(pkt_txt);resp=json.loads(resp_txt);w,nodeprob=posterior(d,paid);before=copy(s);tag=(ident,cell['directory'],index);expected_pkt={'format':'l06-inspection-packet/1','instance_id':d['id'],'seq':index,'state':before,'committed':h};ck(seq==index and pkt==expected_pkt,'SQL_full_actual_packet',tag);ck(set(resp)=={'format','request_id','belief','action'} and resp['format']=='l06-inspection-response/1' and resp['request_id']==key,'actual_response_identity',tag);ck(set(resp['belief'])==set(w) and all(exact(resp['belief'][m])==v for m,v in w.items()),'exact_full_history_posterior',tag);ck(json.loads(payload)=={'action':resp['action'],'belief':resp['belief']},'original_payload',tag);obs=receipt['observation'];a=resp['action'];after,peak,closing=step(d,before,a,obs,tag);expected_receipt={'seq':index,'week':before['week'],'phase':before['phase'],'request_id':key,'action':a,'observation':obs,'post_state':after};ck(receipt==expected_receipt,'original_physical_receipt',tag)
    # Independent complete observable/action prefix excludes transport spelling.
    info=canon([(v['week'],v['phase'],v['action'],v['observation']) for v in h]);group=prefixes.setdefault(info,{'action':a,'belief':w,'observed':set(),'phase':before['phase']});ck(group['action']==a and group['belief']==w,'same_observable_policy',tag);group['observed'].add(obs)
    records.append({'instance':ident,'seq':index,'week':before['week'],'phase':before['phase'],'request_id':key,'test':a.get('test') or '', 'observation':obs or '', 'certified_units':a.get('certified_units',0),'order':a.get('order') or '', 'good_before':before['good'],'good_after':after['good'],'raw_peak':peak,'cash_before':before['cash'],'cash_after':after['cash'],'closing_cash':closing,'cumulative_cost':after['cumulative_cost'],'belief_json':{m:str(v) for m,v in w.items()},'receivables_json':after['receivables'],'node_probability_exact':str(nodeprob)})
    if before['phase']=='laboratory' and a['test']:
     paid.append((before['week'],a['test'],obs))
    s=after;h=h+[expected_receipt];orig_packets.append((expected_pkt,resp))
   weights,prob=posterior(d,paid);logical='|'.join(f'w{t}:{vendor}:{obs}' for t,vendor,obs in paid) or 'no-paid-tests';ck(logical not in seen,'unique_logical_path',(ident,logical));seen.add(logical);ck(s['terminal'] and prob==F(cell['probability']) and s['cumulative_cost']==cell['discovered_cost'],'actual_terminal_probability_cost',(ident,logical))
   for v in records:v.update(path=logical,probability_exact=str(prob))
   allrecords.update({(ident,logical,v['seq']):v for v in records});histories[ident][logical]=h
   for wire in folder.glob('*/worker/wire.jsonl'):
    for line in wire.read_text(encoding='utf-8').splitlines():
     v=json.loads(line);seq=v['packet']['seq'];ck((v['packet'],v['response'])==orig_packets[seq],'actual_worker_full_wire',(ident,logical,seq));wire_lines+=1
   for kind in cuts:
    cut=folder/('cut-'+kind)
    if cut.exists():
     prior=read(cut/'original-prefix.json');ck([list(v) for v in stored[:len(prior)]]==prior,'all_cut_SQL_values_retained',(ident,kind));resume=folder/('cut-laboratory' if kind=='order' else 'completed');rr=read(resume/'resume-receipt.json');old=json.loads(prior[-1][3]);ck(rr['request_id']==prior[-1][1] and rr['original_receipt']==old and rr['next_seq']==len(prior) and rr['new_sample_drawn'] is False,'original_result_key_recovered',(ident,kind));crash=read(cut/'crash-after-commit.json');ck(crash['controller_actual_exit']==73 and crash['worker_exit_before_cut']==0,'real_controller_not_worker_loss',(ident,kind));ck((old['action'].get('order') is not None) if kind=='order' else old['action'].get('test') is not None and old['observation'] in ['good','reject'],'correct_actual_cut_stage',(ident,kind));cuts[kind]+=1
   ar={}
   for v in s['receivables']:ar[str(v['due_week'])]=ar.get(str(v['due_week']),0)+v['amount']
   results.append({'path':logical,'prob':prob,'state':s,'records':records,'ar':ar})
  for info,g in prefixes.items():ck(g['observed']==({'good','reject'} if g['phase']=='laboratory' and g['action'].get('test') else {None}),'complete_positive_child_support',ident)
  mass=sum(v['prob'] for v in results);ck(mass==1,'exact_probability_mass',ident);cost=sum(v['prob']*v['state']['cumulative_cost'] for v in results);components={k:sum(v['prob']*v['state']['costs'][k] for v in results) for k in results[0]['state']['costs']};ck(sum(components.values())==cost,'expected_components',ident)
  summaries[ident]={'expected_cost_exact':str(cost),'components_exact':{k:str(v) for k,v in components.items()},'minimum_cash':min(v['state']['minimum_cash'] for v in results),'minimum_final_cash':min(v['state']['cash'] for v in results),'maximum_raw_peak':max(r['raw_peak'] for v in results for r in v['records']),'terminal_histories':len(results),'decision_histories':len(prefixes),'probability_mass_exact':'1','receivables_by_path':{v['path']:v['ar'] for v in results}}
 ck(cuts=={'order':1,'laboratory':1},'two_actual_cut_kinds',str(run));return summaries,allrecords,histories,wire_lines
main= X/'native-whole-first';summaries,records,histories,wire=audit(main);ownsummary,ownrecords,ownh,ownwire=audit(R/'cold-rebuild/native');ck(summaries==ownsummary,'cold_new_episodes_identical_business_summaries');numerical=lambda v:{k:x for k,x in v.items() if k!='request_id'};ck({k:numerical(v) for k,v in records.items()}=={k:numerical(v) for k,v in ownrecords.items()},'cold_logical_stage_identity_same_all_values');D=X/'reference-delivery-final';claim=read(D/'data/summary.json')['instances']
for ident,s in summaries.items():
 for k,v in s.items():ck(claim[ident][k]==v,'delivered_summary_exact',(ident,k))
rows=table(D/'data/stage-ledger.csv');ck(len(rows)==len(records),'delivered_stage_coverage');seen=set()
for row in rows:
 key=(row['instance'],row['path'],int(row['seq']));ck(key in records and key not in seen,'delivered_logical_identity',key);seen.add(key);ex=records[key]
 for k,v in ex.items():
  if k=='request_id':continue
  if k=='belief_json':ck({m:exact(q) for m,q in json.loads(row[k]).items()}=={m:F(q) for m,q in v.items()},'delivered_belief',key)
  elif k=='receivables_json':ck(json.loads(row[k])==v,'delivered_absolute_AR',key)
  elif type(v) is int:ck(int(row[k])==v,'delivered_stage_integer',(key,k))
  else:ck(row[k]==v,'delivered_stage_value',(key,k))
# Exact inability to identify aliases; a first paid A-good observation remains positive on all4 labels.
d=raw(main/'public/instances/base');first,_=posterior(d,[(1,'A','good')]);ck(all(v>0 for v in first.values()) and first['A1']/first['A2']==d['laws']['A1']['prior']/d['laws']['A2']['prior'],'first_paid_alias_nonidentification')
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'independent raw CSV/Fraction Bayes and physical/cash recurrence; no author-model/planner/audit import; source SQLite copied with WAL/SHM before observation','failures':fail,'instances':summaries,'actual_SQL_stage_rows_main':len(records),'actual_wire_lines_main':wire,'actual_SQL_stage_rows_own':len(ownrecords),'actual_wire_lines_own':ownwire,'exact_first_paid_A_good_base_posterior':{k:str(v) for k,v in first.items()},'new_episode_logical_export_all_numbers_same':summaries==ownsummary and {k:numerical(v) for k,v in records.items()}=={k:numerical(v) for k,v in ownrecords.items()},'scope':'one wholecase source-only cold plus independent read audit of both actual runs; not extra planner/solver/cold or statistical independent samples'};(R/'whole-raw-SQL-audit.json').write_text(json.dumps(result,indent=2));(R/'independent-logical-stage-values.json').write_text(json.dumps([v for v in records.values()],indent=2));print(json.dumps({'failures':fail,'instances':{k:{n:v for n,v in s.items() if n!='receivables_by_path'} for k,s in summaries.items()},'rows':len(records),'own_rows':len(ownrecords),'logical_all_equal':result['new_episode_logical_export_all_numbers_same']},indent=2));raise SystemExit(bool(fail))
