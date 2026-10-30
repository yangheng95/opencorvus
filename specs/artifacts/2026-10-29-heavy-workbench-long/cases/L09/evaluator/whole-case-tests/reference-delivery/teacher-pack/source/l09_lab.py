"""Six actual learning experiments. One durable schema1 state, two real SQL routes."""
import argparse,csv,json,re,sqlite3,os
from pathlib import Path
from datetime import datetime
from fractions import Fraction

def load(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def save(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def decode(row):
 if any(not row.get(k) for k in ('row_id','tenant','event_id','order_id')):return None,'identity'
 if not re.fullmatch(r'0|[1-9][0-9]*',row.get('revision','')):return None,'revision'
 try:
  if not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ',row.get('released_at','')):raise ValueError()
  datetime.strptime(row['released_at'],'%Y-%m-%dT%H:%M:%SZ')
 except ValueError:return None,'clock'
 if row.get('currency')!='USD':return None,'currency'
 if row.get('status') not in ('active','cancelled','missing'):return None,'status'
 if row['status']=='missing':
  if row.get('amount')!='':return None,'missing_payload'
  amount=None
 else:
  if not re.fullmatch(r'[0-9]+(?:\.[0-9]+)?',row.get('amount','')):return None,'amount'
  amount=Fraction(row['amount'])*100
  if amount.denominator!=1:return None,'amount_grid'
  amount=int(amount)
  if row['status']=='cancelled' and amount!=0:return None,'cancel_payload'
 return {k:row[k] for k in ('row_id','tenant','event_id','order_id','released_at','status')}|{'revision':int(row['revision']),'amount_minor':amount},None
def current(journal,asof,route='guided',bug=''):
 published=[x for x in journal if x['released_at']<=asof];future=sorted(x['row_id'] for x in journal if x['released_at']>asof)
 wires={};bad={}
 for x in published:wires.setdefault((x['tenant'],x['event_id']),[]).append(x)
 for wire,rs in wires.items():
  values={canonical({k:v for k,v in r.items() if k!='row_id'}) for r in rs}
  if len(values)>1:
   for x in rs:bad.setdefault((x['tenant'],x['order_id']),[]).extend(r['row_id'] for r in rs)
 eligible=[x for x in published if (x['tenant'],x['order_id']) not in bad]
 if bug=='valid_first':eligible=[x for x in eligible if x['status']=='active' and x['amount_minor'] is not None]
 db=sqlite3.connect(':memory:');db.execute('create table observations(tenant text,order_id text,revision integer,payload text)')
 db.executemany('insert into observations values(?,?,?,?)',[(x['tenant'],x['order_id'],x['revision'],canonical(x)) for x in eligible])
 if bug=='joint':sql='select payload from observations where revision=(select max(b.revision) from observations b where b.order_id=observations.order_id)'
 elif bug=='sum_revisions':sql='select payload from observations'
 elif route=='challenge':sql='select payload from (select payload,dense_rank() over(partition by tenant,order_id order by revision desc) rank from observations) where rank=1'
 else:sql='select a.payload from observations a join (select tenant,order_id,max(revision) revision from observations group by tenant,order_id) b using(tenant,order_id,revision)'
 selected=[json.loads(x[0]) for x in db.execute(sql)];db.close();groups={}
 for x in selected:groups.setdefault(x['order_id'] if bug=='joint' else (x['tenant'],x['order_id']),[]).append(x)
 states=[]
 for rs in groups.values():
  first=sorted(rs,key=lambda x:(x['tenant'],x['row_id']))[0];payloads={(x['status'],x['amount_minor']) for x in rs}
  if bug=='sum_revisions':status='ready';amount=sum(x['amount_minor'] or 0 for x in rs if x['status']=='active')
  elif len(payloads)>1:status='conflict';amount=None
  else:
   (state,value),=payloads;status={'active':'ready','cancelled':'cancelled','missing':'missing'}[state];amount=value if state=='active' else (0 if state=='cancelled' else None)
  states.append({'tenant':first['tenant'],'order_id':first['order_id'],'revision':max(x['revision'] for x in rs),'status':status,'amount_minor':amount,'source_ids':sorted(x['row_id'] for x in rs)})
 for (tenant,order),refs in bad.items():states.append({'tenant':tenant,'order_id':order,'revision':max(x['revision'] for x in published if x['tenant']==tenant and x['order_id']==order),'status':'wire_conflict','amount_minor':None,'source_ids':sorted(set(refs))})
 totals={t:0 for t in {x['tenant'] for x in published}}
 for x in states:
  if x['status']=='ready':totals[x['tenant']]+=x['amount_minor']
 return {'states':sorted(states,key=lambda x:(x['tenant'],x['order_id'])),'totals_minor':dict(sorted(totals.items())),'future_rows':future},sql
def connect(state,restore=None):
 state.mkdir(parents=True,exist_ok=True);db=sqlite3.connect(state/'ledger.sqlite3');db.execute('pragma journal_mode=WAL');db.execute('pragma synchronous=FULL')
 version=db.execute('pragma user_version').fetchone()[0]
 if version not in (0,1):raise ValueError('state_schema_unsupported')
 db.executescript('create table if not exists journal(row_key text primary key,payload text not null);create table if not exists receipt(request_id text primary key,payload text not null);create table if not exists rejected(request_id text,row_index integer,payload text,primary key(request_id,row_index));create table if not exists audit(query_id text primary key,payload text not null);pragma user_version=1;')
 if restore:
  if db.execute('select count(*) from journal').fetchone()[0] or db.execute('select count(*) from receipt').fetchone()[0]:raise ValueError('restore_target_not_empty')
  seed=load(restore)
  if seed['schema']!=1:raise ValueError('checkpoint_schema')
  with db:
   for x in seed['journal']:db.execute('insert into journal values(?,?)',(canonical(x),canonical(x)))
   for k,v in seed['receipts'].items():db.execute('insert into receipt values(?,?)',(k,canonical(v)))
   for x in seed['rejected']:db.execute('insert into rejected values(?,?,?)',(x['request_id'],x['row_index'],canonical(x)))
   for x in seed['audit']:db.execute('insert into audit values(?,?)',(x['query_id'],canonical(x)))
 return db
def export(db):
 return {'schema':1,'journal':sorted((json.loads(x[0]) for x in db.execute('select payload from journal')),key=canonical),'receipts':{x[0]:json.loads(x[1]) for x in db.execute('select request_id,payload from receipt order by request_id')},'rejected':[json.loads(x[0]) for x in db.execute('select payload from rejected order by request_id,row_index')],'audit':[json.loads(x[0]) for x in db.execute('select payload from audit order by query_id')]}
def apply(db,packet,data,bug=''):
 request=packet['request_id'];old=db.execute('select payload from receipt where request_id=?',(request,)).fetchone()
 if old and bug=='reset_on_retry' and packet['lab']==3:
  with db:db.execute('delete from journal');db.execute('delete from receipt');db.execute('delete from rejected')
  old=None
 if old:return json.loads(old[0]),True
 incoming=[]
 if (data/'events.csv').is_file():
  with (data/'events.csv').open(encoding='utf-8',newline='') as f:incoming=list(csv.DictReader(f))
 admitted=0;rejected=0;repeats=0
 with db:
  for i,r in enumerate(incoming):
   v,error=decode(r)
   if error:db.execute('insert into rejected values(?,?,?)',(request,i,canonical({'request_id':request,'row_index':i,'row_id':r.get('row_id'),'code':error})));rejected+=1;continue
   n=db.execute('insert or ignore into journal values(?,?)',(canonical(v),canonical(v))).rowcount
   admitted+=n;repeats+=1-n
  receipt={'request_id':request,'received':len(incoming),'new_records':admitted,'rejected':rejected,'equivalent_repeats':repeats}
  db.execute('insert into receipt values(?,?)',(request,canonical(receipt)))
 return receipt,False
def access(snapshot,principals,queries,bug=''):
 results=[];audits=[]
 for q in queries:
  actor=principals.get(q['principal']);allowed=actor is not None and (actor['role']=='admin' or q['tenant']==actor.get('tenant'))
  if bug=='auth_leak':allowed=True
  if allowed:
   states=[x for x in snapshot['states'] if q['tenant']=='*' or x['tenant']==q['tenant']]
   totals={t:v for t,v in snapshot['totals_minor'].items() if q['tenant']=='*' or t==q['tenant']}
   result={'id':q['id'],'status':'allowed','states':states,'totals_minor':totals}
  else:result={'id':q['id'],'status':'denied','error':'permission_denied','states':[],'totals_minor':{}}
  results.append(result);audits.append({'query_id':q['id'],'principal':q['principal'],'requested_tenant':q['tenant'],'decision':result['status']})
 return results,audits
def run(data,state,out,route='guided',crash=False,restore=None,bug=''):
 packet=load(data/'packet.json');out.mkdir(parents=True,exist_ok=False);db=connect(state,restore);before=export(db);before_snapshot,_=current(before['journal'],packet['as_of'],route,bug)
 receipt,replayed=apply(db,packet,data,bug);saved=export(db);save(out/'checkpoint.json',saved)
 if crash:
  save(out/'committed.json',{'request_id':packet['request_id'],'receipt':receipt,'journal_count':len(saved['journal']),'exit_contract':'committed before os._exit73; no native success or ACK claimed'})
  os._exit(73)
 snapshot,sql=current(saved['journal'],packet['as_of'],route,bug);results=[]
 if packet['lab']==5:
  results,audits=access(snapshot,packet['principals'],packet['queries'],bug)
  with db:
   for a in audits:db.execute('insert or ignore into audit values(?,?)',(a['query_id'],canonical(a)))
 saved=export(db);save(out/'checkpoint.json',saved)
 save(out/'lab.json',{'lab':packet['lab'],'request_id':packet['request_id'],'as_of':packet['as_of'],'journal_count':len(saved['journal']),'receipt':receipt,'replayed':replayed,'snapshot':snapshot,'before_snapshot':before_snapshot,'rejected':saved['rejected'],'access':results,'audit':saved['audit']})
 (out/'queries.sql').write_text(sql+';\n',encoding='utf-8');db.close()
def main(bug='',route_override=None):
 p=argparse.ArgumentParser();p.add_argument('--data',type=Path,required=True);p.add_argument('--state',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--route',choices=['guided','challenge'],default='guided');p.add_argument('--crash-after-commit',action='store_true');p.add_argument('--restore',type=Path);a=p.parse_args();run(a.data,a.state,a.out,route_override or a.route,a.crash_after_commit,a.restore,bug)
if __name__=='__main__':main()
