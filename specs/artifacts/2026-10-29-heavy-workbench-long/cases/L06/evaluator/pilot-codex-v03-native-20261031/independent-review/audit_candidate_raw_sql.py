from pathlib import Path
from fractions import Fraction as F
import csv,json,sqlite3,zipfile,datetime,collections
R=Path('D:/opencorvus-benchmark-runs/l06-v03-codex-fresh-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v03-codex-fresh-native-20261031');A=X/'evaluation/assignment/closed';D=A/'delivery';P=A/'run/public';I=P/'inputs'
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def csvs(n):return list(csv.DictReader((I/n).open(encoding='utf-8-sig',newline='')))
def ordered(n,k):return sorted(csvs(n),key=lambda r:int(r[k]))
def ints(rows,exclude):return [{k:(v if k in exclude else int(v)) for k,v in r.items()} for r in rows]
raw=ints(ordered('raw_materials.csv','raw_index'),{'raw_id'});prod=ints(ordered('products.csv','product_index'),{'product_id'});plant=ordered('plants.csv','plant_index');sup=ints(ordered('supplier_terms.csv','supplier_index'),{'supplier_id'});sc=ints(ordered('scenarios.csv','scenario_index'),{'scenario_id'});fac=load(I/'facility.json')
M=[r['raw_id'] for r in raw];J=[r['product_id'] for r in prod];S=[r['supplier_id'] for r in sup];PP=[r['plant_id'] for r in plant];W=fac['weeks'];lag=fac['receipt_lag_weeks'];pack={};price={};route={};bom={}
for r in csvs('supplier_quotes.csv'):pack[r['supplier_id'],r['raw_id']]=int(r['pack_units']);price[r['supplier_id'],r['raw_id']]=int(r['unit_price_minor'])
for r in csvs('routes.csv'):route[r['plant_id'],r['product_id']]=(int(r['allowed']),int(r['production_cost_minor']))
for r in csvs('bom.csv'):bom[r['product_id'],r['raw_id']]=int(r['units'])
demand={(r['scenario_id'],int(r['week']),r['product_id']):int(r['units']) for r in csvs('demand.csv')};cap={(r['scenario_id'],int(r['week']),r['supplier_id']):int(r['volume']) for r in csvs('supplier_capacity.csv')};pcap={(r['scenario_id'],int(r['week']),r['plant_id']):int(r['hours']) for r in csvs('plant_capacity.csv')}
policy=load(D/'policy.json');findings=[]
def check(v,label,detail=None):
 if not v:findings.append({'check':label,'detail':detail})
def ev(s,t):return {'demand':[demand[s,t,j] for j in J],'supplier_capacity_volume':[cap[s,t,k] for k in S],'plant_capacity_hours':[pcap[s,t,p] for p in PP]}
def action(s,t):return {k:policy['decisions'][s][k][t] for k in ['order_lots','truck_on','production']}
def canon(v):return json.dumps(v,sort_keys=True,separators=(',',':'))
allstates={};allrows={};summaries={};comps={k:F() for k in ['purchase_cost','freight_cost','production_cost','holding_cost']};nodes={};activity=collections.Counter();arvalues={}
def state(t,r,fg,cash,total,arr,ar):return {'format':'l06-week-state/1','phase':'post_week','next_week':t,'raw':r.copy(),'finished':fg.copy(),'cash':cash,'total_cost_minor':total,'arrivals_by_week':[v.copy() for v in arr],'receipts_by_week':ar.copy()}
for scen in sc:
 s=scen['scenario_id'];r=[v['initial_units'] for v in raw];fg=[v['initial_units'] for v in prod];cash=fac['initial_cash_minor'];total=0;arr=[[0]*len(M) for _ in range(W)];ar=[0]*(W+lag);states=[state(0,r,fg,cash,total,arr,ar)];rows=[];prob=F(scen['probability_numerator'],fac['probability_denominator'])
 for t in range(W):
  e=ev(s,t);a=action(s,t);history=canon([ev(s,k) for k in range(t+1)]);nk=(t,history)
  if nk in nodes:check(a==nodes[nk]['action'],'information_prefix_action',(s,t,nodes[nk]['path']))
  else:nodes[nk]={'path':s,'action':a}
  check(all(type(v) is int and v>=0 for k in a for v in ([x for row in a[k] for x in row] if k!='truck_on' else a[k])),'strict_action_domain',(s,t))
  arrivals=arr[t].copy();arr[t]=[0]*len(M);receipts=ar[t];ar[t]=0;purchase=freight=0;volumes=[]
  for k,sp in enumerate(sup):
   units=[a['order_lots'][k][m]*pack[S[k],v] for m,v in enumerate(M)];vol=sum(u*v['volume'] for u,v in zip(units,raw));on=a['truck_on'][k];due=t+sp['lead_weeks']
   check(type(on) is int and on in (0,1),'truck_binary',(s,t,k));check(sp['minimum_volume']*on<=vol<=cap[s,t,S[k]]*on,'supplier_minmax',(s,t,k,vol));check(due<W or not sum(units),'terminal_pipeline',(s,t,k,due))
   if due<W:
    if due==t:arrivals=[x+y for x,y in zip(arrivals,units)]
    else:arr[due]=[x+y for x,y in zip(arr[due],units)]
   purchase+=sum(u*price[S[k],v] for u,v in zip(units,M));freight+=on*sp['freight_minor'];volumes.append(vol)
   activity['positive_lead'+str(sp['lead_weeks'])]+=int(any(units))
  made=[sum(v[j] for v in a['production']) for j in range(len(J))];labor=0;hours=[]
  for p in range(len(PP)):
   hour=sum(v*j['hours'] for v,j in zip(a['production'][p],prod));check(hour<=pcap[s,t,PP[p]],'plant_hours',(s,t,p,hour));hours.append(hour)
   for j in range(len(J)):
    allowed,cost=route[PP[p],J[j]];check(allowed or a['production'][p][j]==0,'route',(s,t,p,j));labor+=cost*a['production'][p][j]
  consume=[sum(made[j]*bom[J[j],m] for j in range(len(J))) for m in M];rp=[x+y for x,y in zip(r,arrivals)];fp=[x+y for x,y in zip(fg,made)];rvol=sum(x*v['volume'] for x,v in zip(rp,raw));fvol=sum(x*v['volume'] for x,v in zip(fp,prod));r=[x-y for x,y in zip(rp,consume)];fg=[x-y for x,y in zip(fp,e['demand'])]
  check(rvol<=fac['raw_storage_volume'] and min(r)>=0,'raw_peak_available',(s,t,rvol,r));check(fvol<=fac['product_storage_volume'] and min(fg)>=0,'product_peak_fulfilment',(s,t,fvol,fg));holding=sum(v*x['holding_minor'] for v,x in zip(r,raw))+sum(v*x['holding_minor'] for v,x in zip(fg,prod));cost=purchase+freight+labor+holding;cash+=receipts-cost;total+=cost;check(cash>=(0 if t==W-1 else -fac['credit_limit_minor']),'cash_floor',(s,t,cash));ar[t+lag]+=sum(n*v['sales_price_minor'] for n,v in zip(e['demand'],prod))
  row={'week':t,'raw_inventory':r.copy(),'finished_inventory':fg.copy(),'arrivals':arrivals,'consumption':consume,'made':made,'hours':hours,'raw_stage_peak_volume':rvol,'product_stage_peak_volume':fvol,'supplier_volume':volumes,'purchase_cost':purchase,'freight_cost':freight,'production_cost':labor,'holding_cost':holding,'cost':cost,'receipts':receipts,'cash':cash};rows.append(row);states.append(state(t+1,r,fg,cash,total,arr,ar))
  for key in comps:comps[key]+=prob*row[key]
 check(not any(fg),'final_finished',s);check(not any(sum(v) for v in arr),'final_pipeline',s);allrows[s]=rows;allstates[s]=states;summaries[s]={'cost':total,'mincash':min(v['cash'] for v in rows),'finalcash':cash,'AR':sum(ar),'maxraw':max(v['raw_stage_peak_volume'] for v in rows),'maxFG':max(v['product_stage_peak_volume'] for v in rows)}
# Original actual SQL, wire and idempotency recovery; no author business module imported.
episodes=load(A/'run/episodes.json');seen=set();wire_count=0;identity=[]
for ep in episodes:
 s=ep['path'];seen.add(s);directory=A/'run'/ep['directory']
 with sqlite3.connect('file:'+str(directory/'journal.sqlite3')+'?mode=ro',uri=True) as con:
  check(con.execute('PRAGMA user_version').fetchone()==(2,),'sqlite_schema',s);dbrows=con.execute('SELECT week,request_id,item_json FROM commits ORDER BY week').fetchall();meta=json.loads(con.execute('SELECT public_facts_json FROM meta').fetchone()[0])
 items=[json.loads(v[2]) for v in dbrows];check(len(items)==W and len({v[1] for v in dbrows})==W,'db_commit_identity',s)
 for t,((week,key,text),it) in enumerate(zip(dbrows,items)):
  receipt={'request_id':key,'committed_week':t,'next_week':t+1,'cost_minor':allrows[s][t]['cost'],'cash_minor':allrows[s][t]['cash']}
  check(it=={'request_id':key,'week':t,'event':ev(s,t),'action':action(s,t),'receipt':receipt} and week==t,'sqlite_original_complete_row',(s,t))
 export=load(directory/'completed/journal-export.json');check(export=={'format':'l06-committed-journal/1','committed':items,'state':allstates[s][-1],'weeks':allrows[s]},'complete_journal_export',s)
 for phase in ep['phases']:
  out=A/'run'/phase['out'];trace=[json.loads(v) for v in (out/'visible-exchange.jsonl').read_text().splitlines()];t0=0 if out.name=='before-loss' or not ep['has_real_commit_loss'] else 8;t1=8 if out.name=='before-loss' else 16;check(len(trace)==2*(t1-t0),'wire_cardinality',str(out))
  active=load(out/'active.json');term=load(out/'worker-terminal.json');check(active['worker_pid']==term['pid'] and active['argv']==term['argv'] and term['native_exit']==0,'worker_identity',str(out));identity.append({'pid':term['pid'],'exit':term['native_exit'],'argv':term['argv'],'environment':active['environment'],'controller_exit':phase['native_exit']})
  for t in range(t0,t1):
   packet=trace[2*(t-t0)]['packet'];st=allstates[s][t];view={'week':t,'historical_arrivals':st['arrivals_by_week'][t],'historical_receipts':st['receipts_by_week'][t],'raw_before_new_orders':[v+x for v,x in zip(st['raw'],st['arrivals_by_week'][t])],'finished_before_production':st['finished'],'cash_after_historical_receipts':st['cash']+st['receipts_by_week'][t],'external':ev(s,t)}
   expected={'format':'l06-current-operation/1','week':t,'committed':items[:t],'history':[ev(s,k) for k in range(t+1)],'post_week_state':st,'decision_view':view};check(packet==expected,'original_current_packet',(s,t));check(trace[2*(t-t0)+1]['response']=={'format':'l06-action-response/1','request_id':items[t]['request_id'],'action':action(s,t)},'original_actor_response',(s,t));wire_count+=1
 if ep['has_real_commit_loss']:
  with sqlite3.connect('file:'+str(directory/'after-commit-original.sqlite3')+'?mode=ro',uri=True) as con:prior=con.execute('SELECT week,request_id,item_json FROM commits ORDER BY week').fetchall()
  check(prior==dbrows[:8],'realcut_original_prefix',s);check(load(directory/'completed/resume-receipt.json')=={'replayed':True,'receipt':items[7]['receipt'],'next_week':8,'committed_count':8},'original_receipt_resume',s);check([v['native_exit'] for v in ep['phases']]==[73,0],'realcut_process_exit',s)
check(seen=={v['scenario_id'] for v in sc},'eight_actual_paths')
# Export ledger every cell.
fields={'purchase':'purchase_cost','freight':'freight_cost','production':'production_cost','holding':'holding_cost','cost':'cost','receipts':'receipts','cash':'cash','raw_peak':'raw_stage_peak_volume','finished_peak':'product_stage_peak_volume'}
ledger=list(csv.DictReader((D/'outputs/weekly-ledger.csv').open(newline='')));check(len(ledger)==W*len(sc),'ledger_count')
for r in ledger:
 ex=allrows[r['path']][int(r['week'])]
 for a,b in fields.items():check(F(r[a])==ex[b],'ledger_exact',(r['path'],r['week'],a))
expected=sum(F(v['probability_numerator'],fac['probability_denominator'])*summaries[v['scenario_id']]['cost'] for v in sc);summary=load(D/'outputs/summary.json');check(F(summary['expected_cost_exact'])==expected==sum(comps.values()),'expected_total',str(expected));check({k:F(v) for k,v in summary['components_exact'].items()}==comps,'expected_components');check(summary['minimum_cash']==min(v['mincash'] for v in summaries.values()),'minimumcash')
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'independent raw CSV exact int/Fraction recurrence and actual original SQLite+full wire; no author math imports','failures':findings,'expected_cost_exact':str(expected),'components_exact':{k:str(v) for k,v in comps.items()},'paths':summaries,'information_nodes':len(nodes),'actual_wire_weeks':wire_count,'actual_worker_identities':identity,'activity':dict(activity),'scope':'all8 fixed raw paths, all128 physical weeks/current packets/SQL rows and exact ledger; not optimization proof/OS confinement/hour maturity'}
(R/'whole-business-audit.json').write_text(json.dumps(result,indent=2));(R/'independent-recurrence.json').write_text(json.dumps({'rows':allrows,'states':allstates},indent=2));print(json.dumps({'failures':result['failures'],'expected_cost_exact':result['expected_cost_exact'],'components_exact':result['components_exact'],'information_nodes':result['information_nodes'],'paths':result['paths']},indent=2));raise SystemExit(bool(findings))
