"""Exact operational export/reconciliation of original exercise journals.

No score, rubric, private target, reference policy or solver is provided here.
Read copies of SQLite/WAL/SHM to preserve original native files.
"""
from pathlib import Path
from fractions import Fraction as F
import json,sqlite3,shutil,tempfile
from model import load,canonical,packet,advance,posterior,predictive,exact,require,belief_wire

def read_rows(db):
    with tempfile.TemporaryDirectory(prefix='l06-inspection-read-') as directory:
        target=Path(directory)/db.name
        for suffix in ['', '-wal','-shm']:
            p=Path(str(db)+suffix)
            if p.exists():shutil.copy2(p,Path(str(target)+suffix))
        connection=sqlite3.connect(target.resolve().as_uri()+'?mode=ro',uri=True)
        try:
            meta=json.loads(connection.execute('SELECT law FROM meta WHERE id=1').fetchone()[0])
            rows=connection.execute('SELECT seq,request_id,payload,receipt,packet,response FROM commits ORDER BY seq').fetchall()
        finally:connection.close()
    return meta,rows

def normalize(x):
    if isinstance(x,F):return str(x)
    if isinstance(x,dict):return {k:normalize(v) for k,v in x.items()}
    if isinstance(x,list):return [normalize(v) for v in x]
    return x

def audit_episode(data,db,episode):
    meta,stored=read_rows(db);require(canonical(meta)==canonical(normalize(data)),'original_sql_law')
    history=[];probability=F(1);records=[];edges=[]
    for index,row in enumerate(stored):
        seq,key,payload,receipt_text,packet_text,response_text=row;current=packet(data,history);state=current['state'];receipt=json.loads(receipt_text);response=json.loads(response_text)
        require(seq==index and canonical(json.loads(packet_text))==canonical(current),'original_sql_packet')
        require(response['request_id']==key and receipt['request_id']==key,'original_sql_request')
        weights=posterior(data,history);require(set(response['belief'])==set(weights) and all(exact(response['belief'][m])==v for m,v in weights.items()),'original_sql_belief')
        require(canonical(json.loads(payload))==canonical({'action':response['action'],'belief':response['belief']}),'original_sql_payload')
        require(receipt['seq']==seq and receipt['week']==state['week'] and receipt['phase']==state['phase'] and receipt['action']==response['action'],'original_sql_receipt')
        action=response['action'];observation=receipt['observation'];before_p=probability
        if state['phase']=='laboratory' and action['test']:
            pg=predictive(data,weights,action['test']);probability*=pg if observation=='good' else 1-pg
        after=advance(data,state,action,observation);require(canonical(receipt['post_state'])==canonical(after),'original_sql_post_state')
        prefix=canonical(history);edges.append({'prefix':prefix,'action':canonical(action),'belief':canonical(belief_wire(weights)),'observation':observation,'terminal':after['terminal']})
        closing=after['cash']
        if state['phase']=='operations' and not after['terminal']:
            nxt=after['week'];closing-=sum(x['amount'] for x in state['receivables'] if x['due_week']==nxt)
            if state['week']+data['sales_receipt_lag']==nxt:closing-=data['calendar'][state['week']]['demand']*data['revenue']
        row_out={'instance':data['id'],'episode':episode,'seq':seq,'week':state['week'],'phase':state['phase'],
                 'request_id':key,'test':action.get('test') or '', 'observation':observation or '',
                 'certified_units':action.get('certified_units',0),'order':action.get('order') or '',
                 'good_before':state['good'],'good_after':after['good'],
                 'raw_peak':(state['good']+(data['pack_good_units'] if observation=='good' else 0)) if state['phase']=='laboratory' else state['good']+action['certified_units'],
                 'cash_before':state['cash'],'cash_after':after['cash'],'closing_cash':closing,
                 'cumulative_cost':after['cumulative_cost'],'belief_json':canonical(belief_wire(weights)),
                 'receivables_json':canonical(after['receivables']),'node_probability_exact':str(before_p)}
        records.append(row_out);history.append(receipt)
    require(len(stored)==2*data['weeks'] and packet(data,history)['state']['terminal'],'complete_actual_episode')
    logical_path='|'.join(f"w{v['week']}:{v['action']['test']}:{v['observation']}" for v in history if v['phase']=='laboratory' and v['action']['test']) or 'no-paid-tests'
    for row in records:row['probability_exact']=str(probability);row['path']=logical_path
    final=history[-1]['post_state'];ar={}
    for item in final['receivables']:ar[str(item['due_week'])]=ar.get(str(item['due_week']),0)+item['amount']
    return {'history':history,'path':logical_path,'probability':probability,'records':records,'edges':edges,'cost':final['cumulative_cost'],'components':final['costs'],'minimum_cash':final['minimum_cash'],'final_cash':final['cash'],'receivables':ar,'raw_rows':stored}

def analyze(run):
    run=Path(run);terminal=json.loads((run/'owner-terminal.json').read_text(encoding='utf-8'));require(terminal['native_exit']==0,'complete_native_terminal')
    summaries={};ledger=[];episode_details={};cuts={'order':0,'laboratory':0};control_base=None
    for ident,entry in terminal['instances'].items():
        data=load(run/'public/instances'/ident);worlds=[];prefixes={};seen=set()
        for cell in entry['episodes']:
            folder=run/cell['directory'];one=audit_episode(data,folder/'journal.sqlite3',cell['directory']);sig=canonical(one['history']);require(sig not in seen,'unique_actual_terminal_history');seen.add(sig)
            require(one['probability']==F(cell['probability']) and one['cost']==cell['discovered_cost'],'actual_discovery_reconciliation')
            worlds.append(one);ledger.extend(one['records']);episode_details[cell['directory']]={k:normalize(one[k]) for k in ['path','probability','cost','components','minimum_cash','final_cash','receivables']}
            if ident=='base' and control_base is None:control_base=one
            for edge in one['edges']:
                group=prefixes.setdefault(edge['prefix'],{'action':edge['action'],'belief':edge['belief'],'observations':set()})
                require(group['action']==edge['action'] and group['belief']==edge['belief'],'same_information_policy')
                group['observations'].add(edge['observation'])
            for kind in cuts:
                cut=folder/('cut-'+kind)
                if not cut.exists():continue
                before=json.loads((cut/'original-prefix.json').read_text(encoding='utf-8'));require([list(r) for r in one['raw_rows'][:len(before)]]==before,'original_rows_after_process_loss')
                stage='cut-laboratory' if kind=='order' else 'completed'
                replay=json.loads((folder/stage/'resume-receipt.json').read_text(encoding='utf-8'));original=json.loads(before[-1][3]);require(replay['request_id']==before[-1][1] and replay['original_receipt']==original and replay['next_seq']==len(before),'original_recovered_receipt')
                wire=json.loads((folder/stage/'worker/wire.jsonl').read_text(encoding='utf-8').splitlines()[0]);require(canonical(wire['packet'])==canonical(json.loads(before[-1][4])) and canonical(wire['response'])==canonical(json.loads(before[-1][5])),'actual_new_process_original_replay')
                crash=json.loads((cut/'crash-after-commit.json').read_text(encoding='utf-8'));require(crash['controller_actual_exit']==73 and crash['worker_exit_before_cut']==0,'actual_controller_worker_boundary')
                if kind=='laboratory':require(original['action']['test'] is not None and original['observation'] in ['good','reject'],'original_paid_lab_observation')
                else:require(original['action']['order'] is not None,'original_nonzero_order')
                cuts[kind]+=1
        for prefix,edge in prefixes.items():
            phase=packet(data,json.loads(prefix))['state']['phase'];action=json.loads(edge['action']);expected={'good','reject'} if phase=='laboratory' and action['test'] else {None}
            require(edge['observations']==expected,'all_positive_probability_policy_branches')
        mass=sum(w['probability'] for w in worlds);require(mass==1,'actual_complete_probability_mass')
        cost=sum(w['probability']*w['cost'] for w in worlds);components={name:sum(w['probability']*w['components'][name] for w in worlds) for name in worlds[0]['components']}
        require(sum(components.values())==cost,'actual_component_sum')
        require(len({w['path'] for w in worlds})==len(worlds),'unique_logical_policy_paths')
        summaries[ident]={'expected_cost_exact':str(cost),'components_exact':normalize(components),'minimum_cash':min(w['minimum_cash'] for w in worlds),'minimum_final_cash':min(w['final_cash'] for w in worlds),'maximum_raw_peak':max(r['raw_peak'] for w in worlds for r in w['records']),'terminal_histories':len(worlds),'decision_histories':len(prefixes),'probability_mass_exact':str(mass),'receivables_by_path':{one['path']:one['receivables'] for one in worlds}}
    require(cuts=={'order':1,'laboratory':1},'exact_two_observed_recovery_kinds')
    control=audit_episode(load(run/'row-order-public/instances/base'),run/'row-order-control/journal.sqlite3','row-order-control')
    business=lambda h:[{k:v for k,v in item.items() if k!='request_id'} for item in h]
    # Locate the actually matching base outcome history, not an assumed path order.
    matches=[p for p in terminal['instances']['base']['episodes'] if canonical(business(json.loads((run/p['directory']/'completed/journal-export.json').read_text(encoding='utf-8'))))==canonical(business(control['history']))]
    require(len(matches)==1,'row_order_original_business')
    return {'instances':summaries,'episodes':episode_details,'ledger':ledger,'controller_cuts':cuts,'row_order_control_rows':len(control['records']),'limits':'exact full positive-support/source/controlled process-loss; no OS/power-loss/useful-hour certification'}
