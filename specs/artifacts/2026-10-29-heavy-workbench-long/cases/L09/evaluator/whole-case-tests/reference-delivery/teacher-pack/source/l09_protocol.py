"""Fixed learning-task behavior contract and programme-driven work collection."""
from pathlib import Path
import csv,json,subprocess,time,shutil
from l09_lab import load,save,decode,current,access,canonical

def equal(a,b):
 def norm(x):
  if isinstance(x,dict):return {k:norm(v) for k,v in sorted(x.items())}
  if isinstance(x,tuple):return [norm(v) for v in x]
  if isinstance(x,list):return sorted((norm(v) for v in x),key=canonical)
  return x
 return canonical(norm(a))==canonical(norm(b))
def packet(source,lab,out):
 c=load(source/'course-contract.json');out.mkdir(parents=True)
 save(out/'packet.json',{'lab':lab,'request_id':'W'+str(lab),'as_of':c['as_of'][str(lab)],'principals':c['principals'],'queries':c['queries'] if lab==5 else []})
 name=c['week_sources'][str(lab)]
 if name:shutil.copy2(source/name,out/'events.csv')
def expected(source):
 c=load(source/'course-contract.json');journal={};rejected=[];receipts={};out={};audit=[]
 for lab in range(1,7):
  asof=c['as_of'][str(lab)];before,_=current(list(journal.values()),asof);incoming=[];name=c['week_sources'][str(lab)]
  if name:
   with (source/name).open(encoding='utf-8',newline='') as f:incoming=list(csv.DictReader(f))
  counts={'request_id':'W'+str(lab),'received':len(incoming),'new_records':0,'rejected':0,'equivalent_repeats':0}
  for i,row in enumerate(incoming):
   v,error=decode(row)
   if error:rejected.append({'request_id':'W'+str(lab),'row_index':i,'row_id':row.get('row_id'),'code':error});counts['rejected']+=1
   elif canonical(v) in journal:counts['equivalent_repeats']+=1
   else:journal[canonical(v)]=v;counts['new_records']+=1
  receipts[counts['request_id']]=counts;snapshot,_=current(list(journal.values()),asof)
  results=[]
  if lab==5:results,audit=access(snapshot,c['principals'],c['queries'])
  if lab==3:before=snapshot # the observed successful call is the same-key replay after a real commit/exit73.
  out[lab]={'lab':lab,'request_id':'W'+str(lab),'as_of':asof,'journal_count':len(journal),'receipt':dict(counts),'replayed':lab==3,'snapshot':snapshot,'before_snapshot':before,'rejected':list(rejected),'access':results,'audit':list(audit),'checkpoint':{'schema':1,'journal':list(journal.values()),'receipts':dict(receipts),'rejected':list(rejected),'audit':list(audit)}}
 return out
def invoke(argv,cwd,data,state,out,extra=()):
 command=[*argv,'--data',str(data),'--state',str(state),'--out',str(out),*extra];start=time.perf_counter();p=subprocess.run(command,cwd=cwd,capture_output=True)
 out.mkdir(parents=True,exist_ok=True);(out/'stdout.bin').write_bytes(p.stdout);(out/'stderr.bin').write_bytes(p.stderr);save(out/'native.json',{'argv':command,'exit_code':p.returncode,'wall_seconds':time.perf_counter()-start})
 return p.returncode
def collect(student,source,out,route='guided'):
 out.mkdir(parents=True,exist_ok=False);declaration=load(student/'student.json');argv=declaration['argv'];results={};state=out/'state';codes={}
 for lab in range(1,7):
  data=out/('packet'+str(lab));packet(source,lab,data)
  if lab==3:
   crash=out/'lab3-commit-exit';codes['crash']=invoke(argv,student,data,state,crash,['--route',route,'--crash-after-commit'])
  target=out/('lab'+str(lab));codes[str(lab)]=invoke(argv,student,data,state,target,['--route',route])
  try:results[lab]={'lab':load(target/'lab.json'),'checkpoint':load(target/'checkpoint.json')}
  except (OSError,ValueError):results[lab]={'lab':None,'checkpoint':None}
 restore=out/'restored-lab4';seed=out/'lab3-commit-exit/checkpoint.json'
 if seed.is_file():codes['restore']=invoke(argv,student,out/'packet4',out/'restored-state',restore,['--route',route,'--restore',str(seed)])
 else:codes['restore']=None
 save(out/'collection.json',{'native_codes':codes,'route':route,'scope':'actual subprocesses, planned commit-after-write exit73 and same-key retry; not human learning evidence'})
 return codes,results
def evaluate(source,collection):
 wanted=expected(source);codes=load(collection/'collection.json')['native_codes']
 def observed_file(name):
  try:return load(collection/name)
  except (OSError,ValueError):return None
 actual={n:observed_file(f'lab{n}/lab.json') for n in range(1,7)}
 for n,v in actual.items():
  if not isinstance(v,dict):actual[n]={}
 def cp(n):
  v=observed_file(f'lab{n}/checkpoint.json');return v if isinstance(v,dict) else {}
 def snap(n):
  v=actual[n].get('snapshot');return v if isinstance(v,dict) else {}
 def states(n):
  v=snap(n).get('states');return [x for x in v if isinstance(x,dict)] if isinstance(v,list) else []
 def select(n,orders):return [x for x in states(n) if x.get('order_id') in orders]
 def target(n,orders):return [x for x in wanted[n]['snapshot']['states'] if x['order_id'] in orders]
 cases={d+str(i):[] for d in ('D','S','R','A') for i in range(1,6)}
 def add(key,path,got,want):cases[key].append({'object':'actual-work/'+path,'observed':got,'expected':want})
 add('D1','lab1/checkpoint.json#/journal',cp(1).get('journal'),wanted[1]['checkpoint']['journal'])
 add('D2','lab1/lab.json#/rejected',actual[1].get('rejected'),wanted[1]['rejected'])
 for n in (2,4,6):
  add('D3',f'lab{n}/lab.json#/snapshot/future_rows',snap(n).get('future_rows'),wanted[n]['snapshot']['future_rows'])
  add('D5',f'lab{n}/lab.json#/snapshot/states joint identities',[(x.get('tenant'),x.get('order_id')) for x in states(n)],[(x['tenant'],x['order_id']) for x in wanted[n]['snapshot']['states']])
 for n in (1,3):add('D4',f'lab{n}/lab.json#/receipt',actual[n].get('receipt'),wanted[n]['receipt'])
 for key,orders,ns in [('S1',['O3'],(3,6)),('S2',['O2'],(3,6)),('S3',['O4','O8'],(4,6))]:
  for n in ns:add(key,f'lab{n}/lab.json#/snapshot/states order_id='+','.join(orders),select(n,orders),target(n,orders))
 for n in (2,3,4,6):add('S4',f'lab{n}/lab.json#/snapshot/totals_minor',snap(n).get('totals_minor'),wanted[n]['snapshot']['totals_minor'])
 for n in (4,6):add('S5',f'lab{n}/lab.json#/snapshot/states selected source_ids',[(x.get('tenant'),x.get('order_id'),x.get('source_ids')) for x in states(n)],[(x['tenant'],x['order_id'],x['source_ids']) for x in wanted[n]['snapshot']['states']])
 crashed=observed_file('lab3-commit-exit/checkpoint.json');crashed=crashed if isinstance(crashed,dict) else {}
 add('R1','collection.json#/native_codes/crash',codes.get('crash'),73)
 add('R1','lab3-commit-exit/checkpoint.json#/journal',crashed.get('journal'),wanted[3]['checkpoint']['journal'])
 crash_receipts=crashed.get('receipts');crash_receipts=crash_receipts if isinstance(crash_receipts,dict) else {}
 add('R1','lab3-commit-exit/checkpoint.json#/receipts/W3',crash_receipts.get('W3'),wanted[3]['receipt'])
 add('R2','lab3/lab.json#/replayed',actual[3].get('replayed'),True)
 add('R2','lab3/checkpoint.json',cp(3),wanted[3]['checkpoint'])
 add('R2','lab3/lab.json#/receipt',actual[3].get('receipt'),wanted[3]['receipt'])
 add('R3','lab4/lab.json#/snapshot/states order_id=O5',select(4,['O5']),target(4,['O5']))
 add('R3','lab4/checkpoint.json#/journal',cp(4).get('journal'),wanted[4]['checkpoint']['journal'])
 restored=observed_file('restored-lab4/lab.json');restored=restored if isinstance(restored,dict) else {}
 add('R4','collection.json#/native_codes/restore',codes.get('restore'),0)
 add('R4','restored-lab4/lab.json#/snapshot',restored.get('snapshot'),wanted[4]['snapshot'])
 add('R4','restored-lab4/checkpoint.json',observed_file('restored-lab4/checkpoint.json'),wanted[4]['checkpoint'])
 add('R5','collection.json#/native_codes normal labs',{str(n):codes.get(str(n)) for n in range(1,7)},{str(n):0 for n in range(1,7)})
 add('R5','lab*/lab.json#/lab assigned identity',{f'lab{n}':actual[n].get('lab') for n in range(1,7)},{f'lab{n}':n for n in range(1,7)})
 access_rows=actual[5].get('access');access_rows=access_rows if isinstance(access_rows,list) else []
 actual_access={x.get('id'):x for x in access_rows if isinstance(x,dict) and isinstance(x.get('id'),str)};target_access={x['id']:x for x in wanted[5]['access']}
 for i,q in enumerate(('own','cross','unknown','admin'),1):
  add('A'+str(i),'lab5/lab.json#/access complete query identities',[x.get('id') if isinstance(x,dict) else None for x in access_rows],list(target_access))
  add('A'+str(i),'lab5/lab.json#/access[id='+q+']',actual_access.get(q),target_access[q])
 add('A5','lab5/lab.json#/audit',actual[5].get('audit'),wanted[5]['audit'])
 add('A5','lab5/checkpoint.json#/audit',cp(5).get('audit'),wanted[5]['checkpoint']['audit'])
 items={}
 for key,comparisons in cases.items():
  failure=next((x for x in comparisons if not equal(x['observed'],x['expected'])),None)
  items[key]={'points':int(failure is None),'maximum':1,'evidence':{'criterion':key,'status':'contract_matched' if failure is None else 'behavior_mismatch','objects':[x['object'] for x in comparisons],'first_counterexample':failure,'note':'Score and explanation derive from this single original-object comparison set.'}}
 scores={d:sum(v['points'] for k,v in items.items() if k.startswith(d)) for d in ('D','S','R','A')}
 return {'items':items,'domains':scores,'total':sum(scores.values()),'maximum':20,'scope':'functional coursework behaviors only; conceptual feedback and human learning outcomes are not inferred'}
