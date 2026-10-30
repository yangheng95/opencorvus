"""L08 only: original source decoding, relaxed bound and project replay."""
import csv,json,re
from pathlib import Path
from fractions import Fraction
from datetime import datetime,timezone

class Facility(ValueError):pass
class Candidate(ValueError):pass
def load(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def save(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
def integer(x,where):
 if type(x) is not int:raise Candidate('integer_required:'+where)
 return x
def nat(x):
 if not re.fullmatch(r'0|[1-9][0-9]*',x):raise Facility('source_integer:'+str(x))
 return int(x)
def rows(p):
 with Path(p).open(encoding='utf-8',newline='') as f:return list(csv.DictReader(f))
def utc(s):
 if not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ',s):raise Facility('source_utc:'+s)
 return datetime.strptime(s,'%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
def manifest(source):
 source=Path(source);cut=utc(load(source/'release-clock.json')['as_of']);groups={};invalid=[];future=[];seen=set()
 for x in rows(source/'release-lines.csv'):
  sid=x['source_id']
  if not sid or sid in seen:raise Facility('source_id:'+sid)
  seen.add(sid)
  if not x['tenant'] or not x['item']:
   invalid.append({'source_id':sid,'code':'identity'});continue
  release=utc(x['released_at'])
  if release>cut:future.append(sid);continue
  rev=nat(x['revision']);status=x['status']
  if status not in ('active','withdrawn'):raise Facility('source_status:'+sid)
  valid=bool(re.fullmatch(r'(0|[1-9][0-9]*)(\.[0-9]+)?',x['units']))
  number=Fraction(x['units']) if valid else Fraction(-1)
  valid=valid and number.denominator==1 and number>=0
  payload=(status,int(number) if valid else None)
  groups.setdefault((x['tenant'],x['item']),[]).append((rev,payload,sid))
 states=[];totals={}
 for (tenant,item),g in sorted(groups.items()):
  rank=max(x[0] for x in g);top=[x for x in g if x[0]==rank];payloads={x[1] for x in top}
  if len(payloads)>1:status,units='conflict',None
  else:
   (s,n),=payloads
   status='invalid_units' if n is None else ('withdrawn' if s=='withdrawn' else 'ready')
   units=n if status=='ready' else (0 if status=='withdrawn' else None)
  states.append({'tenant':tenant,'item':item,'revision':rank,'status':status,'units':units,'source_ids':sorted(x[2] for x in top)})
  totals.setdefault(tenant,0)
  if status=='ready':totals[tenant]+=units
 return {'states':states,'invalid_rows':sorted(invalid,key=lambda x:x['source_id']),'excluded_future':sorted(future),'totals_by_tenant':totals}
def world(source):
 source=Path(source);w={'rates':{},'off':set(),'tasks':{},'modes':{},'history':{},'payments':rows(source/'paid-ledger.csv'),'treasury':load(source/'treasury.json'),'events':load(source/'events.json')}
 for x in rows(source/'rates.csv'):
  if x['resource'] in w['rates']:raise Facility('resource_duplicate')
  w['rates'][x['resource']]=nat(x['daily_cost'])
 for x in rows(source/'calendar.csv'):w['off'].add((x['resource'],nat(x['day'])))
 for x in rows(source/'progress.csv'):
  t=x['task'];w['history'][t]={'task':t,'start':nat(x['start']),'end':nat(x['end']),'resources':x['resources'].split(';'),'cost':nat(x['cost']),'status':x['status']}
 for x in rows(source/'scope.csv'):
  t=x['task']
  if t in w['tasks'] or t in w['history']:raise Facility('task_duplicate')
  if x['mandatory'] not in ('0','1'):raise Facility('mandatory')
  w['tasks'][t]={'task':t,'title':x['title'],'deps':x['dependencies'].split(';') if x['dependencies'] else [],'mandatory':x['mandatory']=='1'}
 for x in rows(source/'quotes.csv'):
  t=x['task'];m=x['mode'];res=x['resources'].split(';')
  if t not in w['tasks'] or m in w['modes'].get(t,{}):raise Facility('mode_identity')
  if any(r not in w['rates'] for r in res) or len(res)!=len(set(res)):raise Facility('mode_resource')
  a={k:nat(x[k]) for k in ('duration','commit_fee','start_fee','lead','earliest')}
  if a['duration']<1:raise Facility('mode_duration')
  a.update(task=t,mode=m,resources=res,daily=sum(w['rates'][r] for r in res))
  a['cost']=a['duration']*a['daily']+a['commit_fee']+a['start_fee'];w['modes'].setdefault(t,{})[m]=a
 for t in w['tasks']:
  if not w['modes'].get(t):raise Facility('modes_missing:'+t)
  for d in w['tasks'][t]['deps']:
   if d not in w['tasks'] and d not in w['history']:raise Facility('dependency:'+d)
 for x in w['payments']:x['day']=nat(x['day']);x['amount']=nat(x['amount'])
 if len({x['payment_id'] for x in w['payments']})!=len(w['payments']):raise Facility('payment_duplicate')
 w['past_cost']=sum(x['amount'] for x in w['payments']);w['cash']=w['treasury']['initial_cash']-w['past_cost']
 if w['cash']<0:raise Facility('checkpoint_cash')
 if {x['id'] for x in w['events']}!={'base','supplier_delay','certification_hold','trainer_loss'}:raise Facility('events')
 return w
def scenario(w,event):
 off=w['off']|{(x[0],x[1]) for x in event['extra_absence']};modes={t:{m:dict(a) for m,a in ms.items()} for t,ms in w['modes'].items()}
 modes['A08']['reserved']['earliest']=max(modes['A08']['reserved']['earliest'],event['supplier_earliest'])
 modes['CERT']['certify']['earliest']=max(modes['CERT']['certify']['earliest'],event['cert_release'])
 return off,modes
def starts(w,a,off):
 first=max(w['treasury']['handover_day']+a['lead'],a['earliest']);h=w['treasury']['horizon']
 return [s for s in range(first,h-a['duration']+1) if all((r,d) not in off for r in a['resources'] for d in range(s,s+a['duration']))]
def bound(w,event):
 """Cost pruning with a relaxed critical/calendar lower bound, no solver oracle."""
 off,modes=scenario(w,event);active={t:set(ms) for t,ms in modes.items()};removed=[]
 def earliest():
  ends={t:a['end'] for t,a in w['history'].items()};pending={t for t,a in w['tasks'].items() if a['mandatory']}
  while pending:
   ready=[t for t in sorted(pending) if all(d in ends for d in w['tasks'][t]['deps'])]
   if not ready:raise Facility('dependency_cycle')
   for t in ready:
    release=max((ends[d] for d in w['tasks'][t]['deps']),default=12)
    possible=[s+modes[t][m]['duration'] for m in active[t] for s in starts(w,modes[t][m],off) if s>=release]
    if not possible:raise Facility('relaxed_infeasible:'+t)
    ends[t]=min(possible);pending.remove(t)
  return ends
 while True:
  ends=earliest();lb=ends['HANDOFF'];minimum=w['past_cost']+sum(min(modes[t][m]['cost'] for m in active[t]) for t,a in w['tasks'].items() if a['mandatory'])
  kills=[]
  for t,a in w['tasks'].items():
   for m in active[t]:
    conditioned=minimum+modes[t][m]['cost']-(min(modes[t][k]['cost'] for k in active[t]) if a['mandatory'] else 0)
    cost_lb=conditioned+w['treasury']['overhead_per_day']*(lb-w['treasury']['handover_day'])
    if cost_lb>w['treasury']['budget_total']:kills.append((t,m,cost_lb))
  if not kills:break
  for t,m,v in kills:
   active[t].remove(m);removed.append({'task':t,'mode':m,'conditional_cost_lower_bound':v,'finish_lower_bound':lb})
   if w['tasks'][t]['mandatory'] and not active[t]:raise Facility('budget_infeasible:'+t)
 return {'finish_lower_bound':lb,'minimum_fixed_cost':minimum,'relaxed_earliest_ends':ends,'removed_modes':removed,'optional_possible':bool(active.get('F01'))},active
def replay(w,event,plan,component_ok):
 off,modes=scenario(w,event);errors=[];records={};occupied={};flow={};t=w['treasury'];start=t['handover_day']
 def add(code,**data):errors.append(dict(code=code,**data))
 if type(plan) is not dict or type(plan.get('tasks')) is not list:raise Candidate('plan_schema')
 for a in plan['tasks']:
  if type(a) is not dict or type(a.get('task')) is not str or type(a.get('mode')) is not str:raise Candidate('task_schema')
  name=a['task'];s=integer(a.get('start'),name+'.start');e=integer(a.get('end'),name+'.end')
  if name in records:add('duplicate_task',task=name);continue
  if name not in modes or a['mode'] not in modes[name]:add('mode_identity',task=name);continue
  m=modes[name][a['mode']];records[name]={'task':name,'mode':a['mode'],'start':s,'end':e,'resources':m['resources'],'mode_cost':m['cost']}
  if e!=s+m['duration']:add('duration',task=name)
  if s not in starts(w,m,off):add('calendar_or_release',task=name,start=s)
  if s<start or e>t['horizon'] or e<=s:continue
  flow[start]=flow.get(start,0)+m['commit_fee'];flow[s]=flow.get(s,0)+m['start_fee']
  for day in range(s,e):
   flow[day]=flow.get(day,0)+m['daily']
   for r in m['resources']:
    key=(r,day)
    if key in occupied:add('resource_overlap',resource=r,day=day,tasks=[occupied[key],name])
    occupied[key]=name
 for name,a in w['tasks'].items():
  if a['mandatory'] and name not in records:add('mandatory_missing',task=name)
 for name,a in records.items():
  for d in w['tasks'][name]['deps']:
   parent=records.get(d,w['history'].get(d))
   if parent is None or parent['end']>a['start']:add('dependency',task=name,parent=d)
 if 'F01' in records and ('C00' not in records or records['F01']['end']>records['C00']['start']):add('optional_dependency')
 finish=records.get('HANDOFF',{}).get('end');ledger=[];cost=None
 if finish is not None and start<finish<=t['horizon']:
  cash=w['cash'];cost=w['past_cost'];receipt_day=records.get('R02',{}).get('end',t['horizon'])+t['client_milestone']['delay']
  for day in range(start,finish):
   inflow=(t['funding']['amount'] if day==t['funding']['day'] else 0)+(t['client_milestone']['amount'] if component_ok and day==receipt_day else 0)
   expense=flow.get(day,0)+t['overhead_per_day'];cash+=inflow-expense;cost+=expense
   ledger.append({'day':day,'inflow':inflow,'expense':expense,'cash_end':cash,'cumulative_cost':cost})
   if cash<0:add('cash_negative',day=day,cash=cash)
  if any(x['end']>finish for x in records.values()):add('work_after_handoff')
  if cost>t['budget_total']:add('budget',cost=cost,budget=t['budget_total'])
 if not component_ok:add('component_acceptance_failed')
 return {'scenario':event['id'],'errors':errors,'tasks':sorted(records.values(),key=lambda a:a['task']),'cash_ledger':ledger,'finish':finish,'extension_requested':max(0,finish-t['original_due']) if finish is not None else None,'extension_approved':event['extension_approved'],'optional_retained':'F01' in records,'total_cost':cost,'history':list(w['history'].values()),'paid_ledger':w['payments'],'checkpoint_cash':w['cash'],'component_accepted':component_ok}
