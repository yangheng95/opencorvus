"""One weekly physical/cash recurrence, with tentative diagnostic results.

The caller validates dimensions and input domains. A returned proposal is not a
committed business state: all observations must pass before online publication.
Legacy full-plan inspection can continue tentative algebra to expose all errors.
"""
from copy import deepcopy


class StateError(ValueError):
    code = 'week_state_phase_invalid'


def initial_state(data):
    return {'format':'l06-week-state/1','phase':'post_week','next_week':0,
        'raw':data['initial_raw'].copy(),'finished':data['initial_products'].copy(),
        'cash':data['initial_cash_minor'],'total_cost_minor':0,
        'arrivals_by_week':[[0]*len(data['raw_materials']) for _ in range(data['weeks'])],
        'receipts_by_week':[0]*(data['weeks']+data['receipt_lag_weeks'])}


def begin_week(data,state,event):
    """Pure repeatable view; does not consume queues or turn into a checkpoint."""
    t=state.get('next_week')
    if (state.get('format')!='l06-week-state/1' or state.get('phase')!='post_week'
            or type(t) is not int or not 0<=t<data['weeks']):
        raise StateError('original post_week state with an unfinished next_week required')
    return {'week':t,'historical_arrivals':state['arrivals_by_week'][t].copy(),
        'historical_receipts':state['receipts_by_week'][t],
        'raw_before_new_orders':[a+b for a,b in zip(state['raw'],state['arrivals_by_week'][t])],
        'finished_before_production':state['finished'].copy(),
        'cash_after_historical_receipts':state['cash']+state['receipts_by_week'][t],
        'external':{key:deepcopy(event[key]) for key in ('demand','supplier_capacity_volume','plant_capacity_hours')}}


def propose_week(data,state,event,action,scenario_id,declared=None):
    """Compute once from the original post_week state, preserving exact integers.

    Observation stage labels let the legacy collector retain its established
    order-all-weeks-before-physics first-error contract without another equation.
    """
    view=begin_week(data,state,event);t=view['week'];T=data['weeks']
    M=len(data['raw_materials']);J=len(data['products']);P=len(data['plants'])
    lots,trucks,production=action['order_lots'],action['truck_on'],action['production']
    tentative=deepcopy(state);tentative['arrivals_by_week'][t]=[0]*M;tentative['receipts_by_week'][t]=0
    observations=[]
    def check(passed,code,where,actual=None,required=None,context=None,stage='physical'):
        observations.append({'passed':bool(passed),'code':code,'where':where,'actual':actual,
            'required':required,'context':{} if context is None else context,'stage':stage})
    hits={name:0 for name in ('supplier_capacity','shipment_minimum','plant_capacity','raw_storage','product_storage','credit_limit')}
    purchase=0;freight=0;arrivals=view['historical_arrivals'].copy();volumes=[]
    for s,rule in enumerate(data['suppliers']):
        on=trucks[s];units=[lots[s][m]*rule['pack_units'][m] for m in range(M)]
        volume=sum(u*v for u,v in zip(units,data['raw_volume']));capacity=event['supplier_capacity_volume'][s]
        where=f'{scenario_id}.week{t}.{rule["id"]}'
        check(on in (0,1),'shipment_binary',where,on,'0 or 1',stage='order')
        check(volume<=capacity*on,'supplier_capacity',where,volume,capacity*on,stage='order')
        check(volume>=rule['minimum_volume']*on,'shipment_minimum',where,volume,rule['minimum_volume']*on,stage='order')
        due=t+rule['lead_weeks']
        check(due<T or sum(units)==0,'terminal_pipeline',where,due,f'<{T} for a positive order',stage='order')
        if due<T:
            if due==t:arrivals=[a+b for a,b in zip(arrivals,units)]
            else:tentative['arrivals_by_week'][due]=[a+b for a,b in zip(tentative['arrivals_by_week'][due],units)]
        purchase+=sum(u*p for u,p in zip(units,rule['price_minor']));freight+=on*rule['freight_minor']
        hits['supplier_capacity']+=int(on==1 and volume==capacity)
        hits['shipment_minimum']+=int(on==1 and volume==rule['minimum_volume']);volumes.append(volume)
    made=[sum(production[p][j] for p in range(P)) for j in range(J)]
    labor=0;hours_used=[]
    for p in range(P):
        for j in range(J):
            check(data['allowed'][p][j]==1 or production[p][j]==0,'product_assignment',f'{scenario_id}.week{t}.{p}.{j}')
            labor+=production[p][j]*data['production_cost_minor'][p][j]
        hours=sum(count*h for count,h in zip(production[p],data['production_hours']));cap=event['plant_capacity_hours'][p]
        check(hours<=cap,'plant_capacity',f'{scenario_id}.week{t}.{p}',hours,cap)
        hits['plant_capacity']+=int(cap>0 and hours==cap);hours_used.append(hours)
    used=[sum(made[j]*data['bom'][j][m] for j in range(J)) for m in range(M)]
    raw_peak_units=[a+b for a,b in zip(state['raw'],arrivals)]
    finished_peak_units=[a+b for a,b in zip(state['finished'],made)]
    raw_peak=sum(c*v for c,v in zip(raw_peak_units,data['raw_volume']))
    finished_peak=sum(c*v for c,v in zip(finished_peak_units,data['product_volume']))
    check(raw_peak<=data['raw_storage_volume'],'raw_storage_peak',f'{scenario_id}.week{t}',raw_peak,data['raw_storage_volume'])
    check(finished_peak<=data['product_storage_volume'],'product_storage_peak',f'{scenario_id}.week{t}',finished_peak,data['product_storage_volume'])
    raw=[a-b for a,b in zip(raw_peak_units,used)];finished=[a-b for a,b in zip(finished_peak_units,event['demand'])]
    check(min(raw)>=0,'raw_availability',f'{scenario_id}.week{t}',raw,'all >=0 after BOM consumption')
    check(min(finished)>=0,'fulfilment',f'{scenario_id}.week{t}',finished,'all >=0 after all demand is delivered')
    hits['raw_storage']+=int(raw_peak==data['raw_storage_volume']);hits['product_storage']+=int(finished_peak==data['product_storage_volume'])
    if declared is not None:
        if 'raw_inventory' in declared:check(declared['raw_inventory']==raw,'declared_raw',f'{scenario_id}.week{t}',declared['raw_inventory'],raw)
        if 'finished_inventory' in declared:check(declared['finished_inventory']==finished,'declared_finished',f'{scenario_id}.week{t}',declared['finished_inventory'],finished)
    holding=sum(c*h for c,h in zip(raw,data['raw_holding_minor']))+sum(c*h for c,h in zip(finished,data['product_holding_minor']))
    cost=purchase+freight+labor+holding;cash=view['cash_after_historical_receipts']-cost
    floor=0 if t==T-1 else -data['credit_limit_minor']
    check(cash>=floor,'cash_limit',f'{scenario_id}.week{t}',cash,floor,{'week':t,'terminal':t==T-1})
    hits['credit_limit']+=int(t<T-1 and cash==floor)
    # For an invalid proposal this remains hypothetical algebra, not a receivable
    # that an online controller is permitted to commit or use for quality credit.
    tentative['receipts_by_week'][t+data['receipt_lag_weeks']]+=sum(c*p for c,p in zip(event['demand'],data['sales_price_minor']))
    tentative.update(next_week=t+1,raw=raw,finished=finished,cash=cash,total_cost_minor=state['total_cost_minor']+cost)
    row={'week':t,'raw_inventory':raw.copy(),'finished_inventory':finished.copy(),'arrivals':arrivals,
        'consumption':used,'made':made,'hours':hours_used,'raw_stage_peak_volume':raw_peak,
        'product_stage_peak_volume':finished_peak,'supplier_volume':volumes,'purchase_cost':purchase,
        'freight_cost':freight,'production_cost':labor,'holding_cost':holding,'cost':cost,
        'receipts':view['historical_receipts'],'cash':cash}
    return {'tentative_state':tentative,'week_row':row,'observations':observations,'active_constraints':hits,
        'week_admissible':all(o['passed'] for o in observations),
        'scope':'tentative weekly algebra only; authoritative prefix and terminal rules belong to the caller'}
