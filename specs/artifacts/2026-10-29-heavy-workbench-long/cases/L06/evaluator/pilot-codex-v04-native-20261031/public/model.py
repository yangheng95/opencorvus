"""The single case-specific exact law, Bayesian filter and operational primitive.

This helper contains no planner, private selected outcome, grade or reference.
The synthetic originals, complete prefix and observed receipts are authoritative.
"""
from pathlib import Path
from fractions import Fraction as F
import csv, json

class ContractError(ValueError):
    def __init__(self, code): self.code=code; super().__init__(code)

def require(ok, code):
    if not ok: raise ContractError(code)

def canonical(x): return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def exact(x):
    require(type(x) in (int,str),'exact_number_type')
    return F(x)
def integer(x):
    require(type(x) is int,'integer_quantity_required'); return x
def rows(p):
    with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))

def load(folder):
    folder=Path(folder); data=json.loads((folder/'profile.json').read_text(encoding='utf-8-sig'))
    require(data['format']=='l06-inspection-input/1','input_version')
    data['calendar']={int(r['week']):{k:int(v) for k,v in r.items() if k!='week'} for r in rows(folder/'weeks.csv')}
    require(set(data['calendar'])==set(range(data['weeks'])),'complete_calendar')
    data['suppliers']={r['supplier']:{k:int(v) for k,v in r.items() if k!='supplier'} for r in rows(folder/'suppliers.csv')}
    require(set(data['suppliers'])=={'A','B'},'supplier_roster')
    data['modes']={r['latent_id']:{'prior':F(int(r['prior_num']),int(r['prior_den'])),
                  'A':F(int(r['A_good_num']),int(r['A_good_den'])),
                  'B':F(int(r['B_good_num']),int(r['B_good_den']))} for r in rows(folder/'latent-law.csv')}
    require(sum(v['prior'] for v in data['modes'].values())==1,'prior_mass')
    require(all(v['prior']>0 and 0<v['A']<1 and 0<v['B']<1 for v in data['modes'].values()),'positive_supported_law')
    data['opening']=[{'receipt_id':r['receipt_id'],'amount':int(r['amount']),'due_week':int(r['due_week'])} for r in rows(folder/'opening-receivables.csv')]
    return data

def posterior(data, history):
    weights={m:r['prior'] for m,r in data['modes'].items()}
    for item in history:
        if item['phase']=='laboratory' and item['action']['test'] is not None:
            vendor=item['action']['test']; result=item['observation']
            require(result in ('good','reject'),'observed_lab_result_required')
            for m,r in data['modes'].items():weights[m]*=r[vendor] if result=='good' else 1-r[vendor]
    mass=sum(weights.values()); require(mass>0,'supported_observation_history')
    return {m:w/mass for m,w in weights.items()}

def belief_wire(weights): return {m:str(v) for m,v in weights.items()}
def predictive(data, weights, vendor):return sum(weights[m]*r[vendor] for m,r in data['modes'].items())
def equivalence(data):
    groups={}
    for m,r in data['modes'].items():groups.setdefault((r['A'],r['B']),[]).append(m)
    return [sorted(v) for _,v in sorted(groups.items())]

def initial(data):
    return {'week':0,'phase':'laboratory','good':0,'quarantine':{'A':0,'B':0},
            'incoming':[],'cash':data['initial_cash'],'receivables':list(data['opening']),
            'cumulative_cost':0,'costs':{'normal':0,'certified':0,'production':0,'laboratory':0,'holding':0,'disposal':0},
            'minimum_cash':data['initial_cash'],'terminal':False}

def begin_week(data, state):
    s=json.loads(canonical(state));t=s['week']; require(t<data['weeks'],'week_in_horizon')
    require(s['phase']=='laboratory','laboratory_start_phase')
    for arrival in s['incoming']:
        require(arrival['due_week']>=t,'unconsumed_old_arrival')
        if arrival['due_week']==t:s['quarantine'][arrival['supplier']]+=1
    s['incoming']=[v for v in s['incoming'] if v['due_week']>t]
    require(all(0<=s['quarantine'][v]<=data['suppliers'][v]['quarantine_pack_limit'] for v in ['A','B']),'quarantine_capacity')
    s['cash']+=sum(v['amount'] for v in s['receivables'] if v['due_week']==t)
    require(all(v['due_week']>=t for v in s['receivables']),'unconsumed_old_receipt')
    s['receivables']=[v for v in s['receivables'] if v['due_week']>t]
    return s

def pay(data,s,kind,amount):
    require(type(amount) is int and amount>=0,'nonnegative_payment')
    s['cash']-=amount;s['costs'][kind]+=amount;s['cumulative_cost']+=amount
    s['minimum_cash']=min(s['minimum_cash'],s['cash'])
    require(s['cash']>=data['cash_floor'],'settled_cash_floor')

def advance(data,state,action,observation=None):
    s=json.loads(canonical(state));t=s['week'];require(not s['terminal'],'terminal_business')
    require(type(action) is dict,'action_object')
    if s['phase']=='laboratory':
        require(set(action)=={'test'},'laboratory_action_shape');v=action['test']
        require(v is None or v in data['suppliers'],'laboratory_supplier')
        if v is None:require(observation is None,'skip_has_no_sample')
        else:
            require(s['quarantine'][v]==1,'available_quarantine_pack')
            require(s['good']+data['pack_good_units']<=data['raw_capacity'],'preconsumption_raw_peak')
            require(observation in ('good','reject'),'observed_lab_result_required')
            pay(data,s,'laboratory',data['lab_fee']);s['quarantine'][v]-=1
            if observation=='good':s['good']+=data['pack_good_units']
        s['phase']='operations';return s
    require(s['phase']=='operations','operations_phase')
    require(set(action)=={'certified_units','order'},'operations_action_shape')
    e=integer(action['certified_units']);v=action['order'];demand=data['calendar'][t]['demand']
    require(e>=0 and s['good']+e<=data['raw_capacity'],'certified_raw_peak')
    require(s['good']+e>=demand,'complete_current_demand')
    require(v is None or v in data['suppliers'],'order_supplier')
    if v is not None:
        due=t+data['suppliers'][v]['lead'];require(due<data['weeks'],'order_arrives_in_horizon')
        require(s['quarantine'][v]==0 and all(x['supplier']!=v for x in s['incoming']),'irrevocable_quarantine_capacity')
        pay(data,s,'normal',data['suppliers'][v]['pack_cost'])
        s['incoming'].append({'supplier':v,'due_week':due,'packs':1})
    pay(data,s,'certified',e*data['calendar'][t]['certified_unit_cost'])
    pay(data,s,'production',demand*data['production_cost']);s['good']+=e-demand
    s['receivables'].append({'receipt_id':f'sale-week-{t}','amount':demand*data['revenue'],'due_week':t+data['sales_receipt_lag']})
    if t==data['weeks']-1:
        require(not s['incoming'],'no_terminal_incoming')
        pay(data,s,'disposal',s['good']*data['terminal_good_disposal']+sum(s['quarantine'].values())*data['terminal_pack_disposal'])
        s['good']=0;s['quarantine']={'A':0,'B':0};require(s['cash']>=0,'terminal_settled_cash')
        s['terminal']=True;s['phase']='terminal';return s
    pay(data,s,'holding',s['good']*data['holding']);s['week']+=1;s['phase']='laboratory'
    return begin_week(data,s)

def packet(data, history):
    s=begin_week(data,initial(data))
    for i,item in enumerate(history):
        require(item['seq']==i and item['week']==s['week'] and item['phase']==s['phase'],'complete_original_prefix')
        s=advance(data,s,item['action'],item['observation'])
        require(canonical(s)==canonical(item['post_state']),'original_receipt_state')
    return {'format':'l06-inspection-packet/1','instance_id':data['id'],'seq':len(history),'state':s,'committed':history}
