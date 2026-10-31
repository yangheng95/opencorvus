from pathlib import Path
from fractions import Fraction as F
from contextlib import closing
import csv,json,sqlite3,shutil,datetime,collections,zipfile
R=Path('D:/opencorvus-benchmark-runs/l06-v03-opencorvus-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v03-opencorvus-native-20261031');A=X/'evaluation/assignment';D=A/'closed/delivery';N=A/'closed/run';I=N/'public/inputs'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'));canon=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'));csvread=lambda p:list(csv.DictReader(p.open(encoding='utf-8-sig',newline='')))
def indexed(name,key):return sorted(csvread(I/name),key=lambda v:int(v[key]))
r= indexed('raw_materials.csv','raw_index');p=indexed('products.csv','product_index');sp=indexed('supplier_terms.csv','supplier_index');pl=indexed('plants.csv','plant_index');sc=indexed('scenarios.csv','scenario_index');FCT=read(I/'facility.json');M=[v['raw_id'] for v in r];J=[v['product_id'] for v in p];S=[v['supplier_id'] for v in sp];P=[v['plant_id'] for v in pl];T=FCT['weeks'];lag=FCT['receipt_lag_weeks'];iv=lambda a,k:[int(v[k]) for v in a]
rv=iv(r,'volume');fv=iv(p,'volume');rh=iv(r,'holding_minor');fh=iv(p,'holding_minor');hours=iv(p,'hours');sales=iv(p,'sales_price_minor');quotes={(v['supplier_id'],v['raw_id']):(int(v['pack_units']),int(v['unit_price_minor'])) for v in csvread(I/'supplier_quotes.csv')};routes={(v['plant_id'],v['product_id']):(int(v['allowed']),int(v['production_cost_minor'])) for v in csvread(I/'routes.csv')};bom={(v['product_id'],v['raw_id']):int(v['units']) for v in csvread(I/'bom.csv')};dem={(v['scenario_id'],int(v['week']),v['product_id']):int(v['units']) for v in csvread(I/'demand.csv')};scap={(v['scenario_id'],int(v['week']),v['supplier_id']):int(v['volume']) for v in csvread(I/'supplier_capacity.csv')};pcap={(v['scenario_id'],int(v['week']),v['plant_id']):int(v['hours']) for v in csvread(I/'plant_capacity.csv')}
def event(s,t):return {'demand':[dem[s,t,j] for j in J],'supplier_capacity_volume':[scap[s,t,k] for k in S],'plant_capacity_hours':[pcap[s,t,k] for k in P]}
fail=[]
def ck(v,k,detail=None):
 if not v:fail.append({'check':k,'detail':detail})
def state(t,raw,fg,cash,total,arr,ar):return {'format':'l06-week-state/1','phase':'post_week','next_week':t,'raw':raw.copy(),'finished':fg.copy(),'cash':cash,'total_cost_minor':total,'arrivals_by_week':[a.copy() for a in arr],'receipts_by_week':ar.copy()}
policy=read(D/'policy.json')
def derive(policy=None):
 states={};rows={};summary={};components={k:F() for k in ['purchase_cost','freight_cost','production_cost','holding_cost']};made_policy={'format':'l06-tree-policy/1','decisions':{}};nodes={}
 for path in sc:
  s=path['scenario_id'];prob=F(int(path['probability_numerator']),FCT['probability_denominator']);raw=iv(r,'initial_units');fg=iv(p,'initial_units');cash=FCT['initial_cash_minor'];total=0;arr=[[0]*len(M) for _ in range(T)];ar=[0]*(T+lag);ss=[state(0,raw,fg,cash,total,arr,ar)];rr=[];out={k:[] for k in ['order_lots','truck_on','production']}
  for t in range(T):
   e=event(s,t);arrivals=arr[t].copy();arr[t]=[0]*len(M);receipts=ar[t];ar[t]=0
   if policy is None:
    made=[max(0,d-f) for d,f in zip(e['demand'],fg)];y=[[0]*len(J) for _ in P];rem=e['plant_capacity_hours'].copy()
    for j in [0,3,1,2]:
     for k in range(len(P)):
      if routes[P[k],J[j]][0]:
       n=min(made[j]-sum(v[j] for v in y),rem[k]//hours[j]);y[k][j]+=n;rem[k]-=n*hours[j]
    need=[sum(made[j]*bom[J[j],m] for j in range(len(J))) for m in M];lots=[[0]*len(M) for _ in S];on=[0]*len(S);spot=len(S)-1;lots[spot]=[max(0,n-a-b) for n,a,b in zip(need,raw,arrivals)];on[spot]=int(any(lots[spot]));vol=sum(n*v for n,v in zip(lots[spot],rv));minimum=int(sp[spot]['minimum_volume'])
    if on[spot] and vol<minimum:lots[spot][0]+=minimum-vol
    action={'order_lots':lots,'truck_on':on,'production':y}
   else:action={k:policy['decisions'][s][k][t] for k in out}
   key=canon([event(s,k) for k in range(t+1)])
   if key in nodes:ck(action==nodes[key],'same_information_action',(s,t))
   else:nodes[key]=action
   for k in out:out[k].append(action[k])
   ck(all(type(v) is int and v>=0 for k in action for v in (action[k] if k=='truck_on' else [q for row in action[k] for q in row])),'strict_integer_actions',(s,t));purchase=freight=0;vols=[]
   for k,supplier in enumerate(sp):
    units=[action['order_lots'][k][m]*quotes[S[k],item][0] for m,item in enumerate(M)];volume=sum(q*v for q,v in zip(units,rv));on=action['truck_on'][k];due=t+int(supplier['lead_weeks']);ck(type(on) is int and on in (0,1),'truck_binary',(s,t,k));ck(int(supplier['minimum_volume'])*on<=volume<=e['supplier_capacity_volume'][k]*on,'supplier_capacity_MOQ',(s,t,k));ck(due<T or not sum(units),'positive_terminal_order',(s,t,k))
    if due<T:
     if due==t:arrivals=[a+b for a,b in zip(arrivals,units)]
     else:arr[due]=[a+b for a,b in zip(arr[due],units)]
    purchase+=sum(q*quotes[S[k],item][1] for q,item in zip(units,M));freight+=on*int(supplier['freight_minor']);vols.append(volume)
   y=action['production'];made=[sum(v[j] for v in y) for j in range(len(J))];labor=0;usedhours=[]
   for k in range(len(P)):
    h=sum(q*v for q,v in zip(y[k],hours));usedhours.append(h);ck(h<=e['plant_capacity_hours'][k],'shared_hours',(s,t,k))
    for j in range(len(J)):ck(routes[P[k],J[j]][0] or y[k][j]==0,'allowed_route',(s,t,k,j));labor+=y[k][j]*routes[P[k],J[j]][1]
   consumed=[sum(made[j]*bom[J[j],m] for j in range(len(J))) for m in M];rp=[a+b for a,b in zip(raw,arrivals)];fp=[a+b for a,b in zip(fg,made)];rvol=sum(a*b for a,b in zip(rp,rv));fvol=sum(a*b for a,b in zip(fp,fv));raw=[a-b for a,b in zip(rp,consumed)];fg=[a-b for a,b in zip(fp,e['demand'])];ck(rvol<=FCT['raw_storage_volume'] and min(raw)>=0,'raw_peak_availability',(s,t));ck(fvol<=FCT['product_storage_volume'] and min(fg)>=0,'finished_peak_fulfilment',(s,t));holding=sum(a*b for a,b in zip(raw,rh))+sum(a*b for a,b in zip(fg,fh));cost=purchase+freight+labor+holding;cash+=receipts-cost;total+=cost;ck(cash>=(0 if t==T-1 else -FCT['credit_limit_minor']),'settled_cash_floor',(s,t));ar[t+lag]+=sum(a*b for a,b in zip(e['demand'],sales));row={'week':t,'raw_inventory':raw.copy(),'finished_inventory':fg.copy(),'arrivals':arrivals,'consumption':consumed,'made':made,'hours':usedhours,'raw_stage_peak_volume':rvol,'product_stage_peak_volume':fvol,'supplier_volume':vols,'purchase_cost':purchase,'freight_cost':freight,'production_cost':labor,'holding_cost':holding,'cost':cost,'receipts':receipts,'cash':cash};rr.append(row);ss.append(state(t+1,raw,fg,cash,total,arr,ar))
   for k in components:components[k]+=prob*row[k]
  ck(not any(fg) and not any(sum(v) for v in arr),'terminal_stock_pipeline',s);states[s]=ss;rows[s]=rr;made_policy['decisions'][s]=out;summary[s]={'cost':total,'minimum_cash':min(v['cash'] for v in rr),'final_cash':cash,'final_receivable':sum(ar[T:]),'max_raw':max(v['raw_stage_peak_volume'] for v in rr),'max_finished':max(v['product_stage_peak_volume'] for v in rr)}
 return states,rows,summary,components,made_policy,len(nodes)
states,rows,summary,components,_,nodes=derive(policy);bs,br,bsummary,bcomp,bpolicy,bnodes=derive();expected=sum(components.values());baseline=sum(bcomp.values());ck(expected==F('197049/4'),'report_expected');ck(baseline==70640,'canonical_expected');saved_summary=read(D/'results/summary.json');ck(F(saved_summary['expected_cost_exact'])==expected and {k:F(str(v)) for k,v in saved_summary['components_exact'].items()}==components,'summary_components');ck(F(saved_summary['saving_exact'])==baseline-expected and saved_summary['minimum_cash']==min(v['minimum_cash'] for v in summary.values()),'summary_saving_cash')
# Copy sealed DB/WAL/SHM first. mode=ro can create sidecars; all such IO is owned here.
copied={}
def dbrows(path):
 rel=path.relative_to(X);dest=R/'sql-read-copies'/rel;dest.parent.mkdir(parents=True,exist_ok=True)
 if str(path) not in copied:
  for ext in ['', '-wal','-shm']:
   p=Path(str(path)+ext)
   if p.exists():shutil.copy2(p,Path(str(dest)+ext))
  copied[str(path)]=str(dest)
 with closing(sqlite3.connect('file:'+dest.resolve().as_posix()+'?mode=ro',uri=True)) as con:return con.execute('SELECT week,request_id,item_json FROM commits ORDER BY week').fetchall()
episodes=read(N/'episodes.json');actual_items={};wirecount=0
for ep in episodes:
 s=ep['path'];folder=N/ep['directory'];actual=dbrows(folder/'journal.sqlite3');items=[json.loads(v[2]) for v in actual];actual_items[s]=items;ck(len(items)==T,'private_commit_count',s)
 for t,it in enumerate(items):
  receipt={'request_id':it['request_id'],'committed_week':t,'next_week':t+1,'cost_minor':rows[s][t]['cost'],'cash_minor':rows[s][t]['cash']};ck(actual[t][0]==t and actual[t][1]==it['request_id'] and it=={'request_id':it['request_id'],'week':t,'event':event(s,t),'action':{k:policy['decisions'][s][k][t] for k in ['order_lots','truck_on','production']},'receipt':receipt},'private_SQL_complete_item',(s,t))
 ex=read(folder/'completed/journal-export.json');ck(ex['committed']==items and ex['weeks']==rows[s] and ex['state']==states[s][-1],'private_full_derived_export',s)
 for ph in ep['phases']:
  out=N/ph['out'];tr=[json.loads(v) for v in (out/'visible-exchange.jsonl').read_text().splitlines()];start=0 if out.name=='before-loss' or not ep['has_real_commit_loss'] else 8;end=8 if out.name=='before-loss' else T;ck(len(tr)==2*(end-start),'private_wire_count',s)
  active=read(out/'active.json');terminal=read(out/'worker-terminal.json');ck(active['worker_pid']==terminal['pid'] and active['argv']==terminal['argv'] and terminal['native_exit']==0,'private_worker_identity',s)
  for t in range(start,end):
   st=states[s][t];e=event(s,t);view={'week':t,'historical_arrivals':st['arrivals_by_week'][t],'historical_receipts':st['receipts_by_week'][t],'raw_before_new_orders':[a+b for a,b in zip(st['raw'],st['arrivals_by_week'][t])],'finished_before_production':st['finished'],'cash_after_historical_receipts':st['cash']+st['receipts_by_week'][t],'external':e};pkt={'format':'l06-current-operation/1','week':t,'committed':items[:t],'history':[event(s,k) for k in range(t+1)],'post_week_state':st,'decision_view':view};ck(tr[2*(t-start)]=={'direction':'to_actor','packet':pkt},'private_full_packet',(s,t));ck(tr[2*(t-start)+1]=={'direction':'from_actor','response':{'format':'l06-action-response/1','request_id':items[t]['request_id'],'action':items[t]['action']}},'private_actual_response',(s,t));wirecount+=1
 if ep['has_real_commit_loss']:
  prior=dbrows(folder/'after-commit-original.sqlite3');ck(prior==actual[:8],'original_prefix_after73',s);ck(read(folder/'completed/resume-receipt.json')=={'replayed':True,'receipt':items[7]['receipt'],'next_week':8,'committed_count':8} and [v['native_exit'] for v in ep['phases']]==[73,0],'original_receipt_after73',s)
fields={'purchase':'purchase_cost','freight':'freight_cost','production':'production_cost','holding':'holding_cost','cost':'cost','receipts':'receipts','cash':'cash','raw_peak':'raw_stage_peak_volume','finished_peak':'product_stage_peak_volume'}
ledger=csvread(D/'results/weekly-ledger.csv');ck(len(ledger)==128,'delivered128rows')
for v in ledger:
 for a,b in fields.items():ck(F(v[a])==rows[v['path']][int(v['week'])][b],'delivered_ledger_cell',(v['path'],v['week'],a))
expected_actions={}
for s in [v['scenario_id'] for v in sc]:
 for t in range(T):
  a={k:policy['decisions'][s][k][t] for k in ['order_lots','truck_on','production']}
  for k,sup in enumerate(S):
   expected_actions[s,t,'truck',sup,'']=a['truck_on'][k]
   for m,item in enumerate(M):expected_actions[s,t,'order_lots',sup,item]=a['order_lots'][k][m]
  for k,plant in enumerate(P):
   for j,item in enumerate(J):expected_actions[s,t,'production',plant,item]=a['production'][k][j]
seen=set()
for v in csvread(D/'results/commitment-policy.csv'):
 key=(v['path'],int(v['week']),v['kind'],v['entity'],v['item']);ck(key in expected_actions and key not in seen and F(v['quantity'])==expected_actions.get(key),'all_action_coordinate',key);seen.add(key)
ck(seen==set(expected_actions),'action_coordinate_coverage')
finance=read(D/'results/receivables.json')
for s,ss in states.items():
 st=ss[-1];ex={'final_cash':st['cash'],'minimum_cash':summary[s]['minimum_cash'],'final_receivable':sum(st['receipts_by_week'][T:]),'due_after_horizon':{str(t):v for t,v in enumerate(st['receipts_by_week']) if t>=T and v}};ck(finance[s]==ex,'receivable_exact',s)
lower=F();lower_paths=[]
for path in sc:
 s=path['scenario_id'];n=[sum(dem[s,t,j] for t in range(T))-int(p[k]['initial_units']) for k,j in enumerate(J)];use=[sum(n[j]*bom[J[j],m] for j in range(len(J))) for m in M];buy=sum(max(0,use[k]-int(r[k]['initial_units']))*min(quotes[sup,m][1] for sup in S) for k,m in enumerate(M));labor=sum(n[j]*min(routes[plant,J[j]][1] for plant in P if routes[plant,J[j]][0]) for j in range(len(J)));cost=buy+labor;lower+=F(int(path['probability_numerator']),FCT['probability_denominator'])*cost;lower_paths.append({'path':s,'product_total':n,'raw_consumption':use,'purchase_lower':buy,'production_lower':labor,'cost_lower':cost})
ck(lower==39714 and saved_summary['exact_analytic_lower_bound']==39714,'analytic_lower_bound')
control_record=read(N/'owner-terminal.json');control=N/control_record['row_order_control'];path=control_record['control_path_after_terminal'];it=[json.loads(v[2]) for v in dbrows(control/'journal.sqlite3')];ex=read(control/'completed/journal-export.json');ck(it==actual_items[path] and ex['weeks']==rows[path] and ex['state']==states[path][-1],'private_row_control_exact')
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'fresh independent standard-library raw CSV/Fraction recurrence; original SQLite copied with WAL/SHM before opening; no author/candidate imports or execution','failures':fail,'expected_cost_exact':str(expected),'components_exact':{k:str(v) for k,v in components.items()},'canonical_spot_exact':str(baseline),'canonical_components':{k:str(v) for k,v in bcomp.items()},'saving_exact':str(baseline-expected),'information_nodes':nodes,'private_wire_weeks':wirecount,'paths':summary,'analytic_lower_bound_exact':str(lower),'analytic_paths':lower_paths,'read_only_database_copies':copied,'private_native_owner_seconds':control_record['seconds'],'scope':'original candidate scientific/content support only, no new actor/LP/solver/grader/task or other project reads'}
(R/'raw-sql-scientific-audit.json').write_text(json.dumps(result,indent=2));(R/'independent-derived-values.json').write_text(json.dumps({'states':states,'rows':rows,'canonical_policy':bpolicy},indent=2));print(json.dumps({k:result[k] for k in ['failures','expected_cost_exact','components_exact','canonical_spot_exact','saving_exact','information_nodes','private_wire_weeks','paths','analytic_lower_bound_exact']},indent=2));raise SystemExit(bool(fail))
