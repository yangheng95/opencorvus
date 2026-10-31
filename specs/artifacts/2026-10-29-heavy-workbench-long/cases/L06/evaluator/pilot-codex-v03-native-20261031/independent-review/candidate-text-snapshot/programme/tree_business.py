"""L06/0.3 authoritative complete-event histories and committed-prefix replay.

Physical equations and raw CSV parsing remain the existing single implementations.
Policy schema is new and explicit; no old plan is accepted as a tree policy.
"""
from copy import deepcopy
from fractions import Fraction
import json

from l06_packet import read_packet
from l06_physics import initial_state,begin_week,propose_week
from check_l06 import inspect_plan,integer_tensor,PlanError
from l06_input import read_json,InputError

EVENT_FIELDS=('demand','supplier_capacity_volume','plant_capacity_hours')
ACTION_FIELDS=('order_lots','truck_on','production')

class BusinessError(ValueError):
    def __init__(self,code,week=None,detail=None):
        self.code,self.week,self.detail=code,week,detail
        super().__init__(code+(':'+str(week) if week is not None else ''))

def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False)

def event(path,week):return {key:deepcopy(path[key][week]) for key in EVENT_FIELDS}

def histories(data):
    return {s['id']:[canonical([event(s,k) for k in range(t+1)]) for t in range(data['weeks'])] for s in data['scenarios']}

def load_data(public):
    declaration=read_json(public/'tree-contract.json','tree_contract_invalid')
    if declaration.get('format')!='l06-tree-contract/1' or declaration.get('observation')!='complete_current_event_and_perfect_recall' or declaration.get('weeks')!=16:
        raise InputError('tree_contract_invalid',str(public),'explicit 16-week current tree contract required')
    data=read_packet(public/'inputs')
    if data['common_weeks']!=0 or data['weeks']!=declaration['weeks']:
        raise InputError('tree_contract_invalid',str(public),'tree histories, not a K-week common plan')
    return data,declaration

def action_at(policy,path_id,week):
    return {key:deepcopy(policy['decisions'][path_id][key][week]) for key in ACTION_FIELDS}

def validate_action(data,action,week):
    if type(action) is not dict or set(action)!=set(ACTION_FIELDS):raise BusinessError('action_schema_invalid',week)
    dims={'order_lots':[len(data['suppliers']),len(data['raw_materials'])],
          'truck_on':[len(data['suppliers'])],'production':[len(data['plants']),len(data['products'])]}
    try:
        for key,shape in dims.items():integer_tensor(action[key],shape,'week'+str(week)+'.'+key)
    except PlanError as e:raise BusinessError(e.code,week,e.required) from e

def advance(data,state,current_event,action):
    t=state['next_week'];validate_action(data,action,t)
    # Neutral localization is intentional: even malformed actions cannot query
    # a private selected future path via a diagnostic/receipt channel.
    proposal=propose_week(data,state,current_event,action,'operation')
    failed=[v for v in proposal['observations'] if not v['passed']]
    if failed:
        first=failed[0];raise BusinessError(first['code'],t,{'actual':first['actual'],'required':first['required']})
    if t==data['weeks']-1 and any(proposal['tentative_state']['finished']):raise BusinessError('terminal_finished',t)
    return proposal['tentative_state'],proposal['week_row']

def packet(data,committed,current_event):
    state,rows=replay(data,committed)
    if state['next_week']>=data['weeks']:raise BusinessError('episode_complete')
    prefix=[v['event'] for v in committed]+[current_event]
    supported=[s for s in data['scenarios'] if canonical([event(s,k) for k in range(len(prefix))])==canonical(prefix)]
    if not supported:raise BusinessError('observation_not_supported',state['next_week'])
    return {'format':'l06-current-operation/1','week':state['next_week'],
            'committed':deepcopy(committed),'history':deepcopy(prefix),
            'post_week_state':state,'decision_view':begin_week(data,state,current_event)}

def replay(data,committed):
    if type(committed) is not list:raise BusinessError('committed_prefix_invalid')
    state=initial_state(data);rows=[];seen=set();prefix=[]
    for t,item in enumerate(committed):
        if type(item) is not dict or set(item)!={'request_id','week','event','action','receipt'} or item['week']!=t or type(item['week']) is not int:
            raise BusinessError('committed_prefix_invalid',t)
        key=item['request_id']
        if type(key) is not str or not key.strip() or key in seen:raise BusinessError('commit_identity_invalid',t)
        seen.add(key);prefix.append(item['event'])
        if not any(canonical([event(s,k) for k in range(t+1)])==canonical(prefix) for s in data['scenarios']):raise BusinessError('observation_not_supported',t)
        state,row=advance(data,state,item['event'],item['action'])
        receipt={'request_id':key,'committed_week':t,'next_week':t+1,'cost_minor':row['cost'],'cash_minor':row['cash']}
        if canonical(item['receipt'])!=canonical(receipt):raise BusinessError('receipt_state_mismatch',t)
        rows.append(row)
    return state,rows

def append(data,committed,current_event,action,request_id):
    # Idempotency is defined over the original complete event and action.
    for item in committed:
        if item['request_id']==request_id:
            if canonical(item['event'])!=canonical(current_event) or canonical(item['action'])!=canonical(action):
                raise BusinessError('idempotency_payload_conflict',item['week'])
            replay(data,committed)
            return deepcopy(committed),deepcopy(item['receipt']),True
    state,_=replay(data,committed);t=state['next_week'];packet(data,committed,current_event)
    if type(request_id) is not str or not request_id.strip():raise BusinessError('commit_identity_invalid',t)
    state,row=advance(data,state,current_event,action)
    receipt={'request_id':request_id,'committed_week':t,'next_week':t+1,'cost_minor':row['cost'],'cash_minor':row['cash']}
    return deepcopy(committed)+[{'request_id':request_id,'week':t,'event':deepcopy(current_event),'action':deepcopy(action),'receipt':receipt}],receipt,False

def audit_policy(data,policy):
    if type(policy) is not dict or set(policy)!={'format','decisions'} or policy['format']!='l06-tree-policy/1':raise BusinessError('policy_schema_invalid')
    # The old exact plan collector is used solely as the one physical algebra.
    physical=inspect_plan(data,{'format':'l06-plan/1','decisions':policy['decisions']})
    visible=histories(data);violations=[];nodes=0
    for t in range(data['weeks']):
        representatives={}
        for path in data['scenarios']:
            key=visible[path['id']][t];action=action_at(policy,path['id'],t)
            if key not in representatives:representatives[key]=(path['id'],action);nodes+=1
            elif canonical(action)!=canonical(representatives[key][1]):
                violations.append({'code':'nonanticipativity_violation','week':t,'paths':[representatives[key][0],path['id']]})
    valid=physical['business_feasible'] and not violations
    return {'format':'l06-tree-policy-audit/1','business_feasible':physical['business_feasible'],
            'information_legal':not violations,'policy_valid':valid,'information_nodes':nodes,
            'information_violations':violations,'physical_violations':physical['violations'],
            'expected_cost_exact':physical['expected_cost_exact'] if valid else None,
            'paths':physical['scenarios'] if valid else None,'constraint_checks':physical['constraint_checks']}

def contingency(data):
    """Legal costly alternative: current needs, spot supply, no invented future."""
    decisions={}
    for s in data['scenarios']:
        state=initial_state(data);out={k:[] for k in ACTION_FIELDS}
        for t in range(data['weeks']):
            e=event(s,t);made=[max(0,d-f) for d,f in zip(e['demand'],state['finished'])]
            production=[[0]*len(data['products']) for _ in data['plants']];remaining=e['plant_capacity_hours'].copy()
            for j in [0,3,1,2]:
                for p in range(len(data['plants'])):
                    if data['allowed'][p][j]:
                        n=min(made[j]-sum(row[j] for row in production),remaining[p]//data['production_hours'][j])
                        production[p][j]+=n;remaining[p]-=n*data['production_hours'][j]
            if any(sum(row[j] for row in production)!=made[j] for j in range(len(made))):raise BusinessError('contingency_production_unavailable',t)
            raw=begin_week(data,state,e)['raw_before_new_orders'];need=[sum(made[j]*data['bom'][j][m] for j in range(len(made))) for m in range(len(raw))]
            lots=[[0]*len(raw) for _ in data['suppliers']];on=[0]*len(data['suppliers']);spot=len(data['suppliers'])-1
            rule=data['suppliers'][spot]
            if rule['lead_weeks']!=0 or any(v!=1 for v in rule['pack_units']):raise BusinessError('contingency_spot_contract')
            lots[spot]=[max(0,n-a) for n,a in zip(need,raw)];on[spot]=int(any(lots[spot]))
            volume=sum(n*v for n,v in zip(lots[spot],data['raw_volume']))
            if on[spot] and volume<rule['minimum_volume']:lots[spot][0]+=rule['minimum_volume']-volume
            a={'order_lots':lots,'truck_on':on,'production':production};state,_=advance(data,state,e,a)
            for key in ACTION_FIELDS:out[key].append(a[key])
        decisions[s['id']]=out
    result={'format':'l06-tree-policy/1','decisions':decisions}
    audit=audit_policy(data,result)
    if not audit['policy_valid']:raise BusinessError('contingency_invalid',detail=audit)
    return result,audit
