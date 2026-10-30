"""Recompute the fixed complete reference matrix and prepare scientific plot data."""
import argparse
import csv
from fractions import Fraction
import json
from pathlib import Path

from l02_scoring import load_study,score
from l02_selection import assess_selection
from l02_study_data import StudySource,load_pool,write_json
from material_contract import read_json


def bound_context(value):
    return {**value,'series_catalogue':sorted(value['series_catalogue'],key=lambda row:row['series_id']),
        'hierarchy':sorted(value['hierarchy'],key=lambda row:(row['parent'],row['child']))}


def bound_labels(value):return sorted(value,key=lambda row:(row['series_id'],row['target_tick']))


def summarize(a):
    study=load_study(a.study);pool,methods=load_pool(a.pool);data=StudySource(a.raw,a.material_contract,study)
    expected={name for name,g in data.origins.items() if g['role']=='outer'};found={}
    for run in a.run:
        result=read_json(run/'assessment.json');registration=read_json(run/'registration.json')
        if result.get('status')!='requested_reference_matrix_complete' or registration['pool']!=pool:raise ValueError('incomplete_or_changed_reference_run')
        for outer_id in registration['outer_ids']:
            if outer_id in found or outer_id not in expected:raise ValueError('duplicate_or_unknown_outer')
            found[outer_id]=run/'outer'/outer_id
    if set(found)!=expected:raise ValueError('incomplete_registered_outer_matrix')
    result_rows=[];plot={'origins':[],'nodes':data.grid['series_catalogue'],'methods':pool['outer_ids'],'clock':data.grid['clock']}
    for outer_id in sorted(expected):
        root=found[outer_id];outer=data.origins[outer_id];payload=read_json(root/'selector/input/inner.json',decimal_numbers=True)
        required_inner={g['origin_id'] for g in data.grid['origins'] if g['role']=='inner' and g['outer_id']==outer_id}
        if set(payload['inner_ids'])!=required_inner or payload['selection_ids']!=pool['selection_ids'] or payload['outer_origin_tick']!=outer['origin_tick']:raise ValueError('selection_registration_drift')
        for frame in payload['frames']:
            context,labels,released=data.context_and_labels(frame['origin_id'])
            if bound_context(frame['context'])!=bound_context(context) or bound_labels(frame['labels'])!=bound_labels(labels) or frame['labels_released_at']!=released or released>outer['origin_tick']:raise ValueError('selector_source_fact_drift')
        actual=read_json(root/'selector/output/result/selection.json');selection=assess_selection(actual,payload,study);selected=actual['selected_method_id']
        context,labels,_=data.context_and_labels(outer_id);metrics={};curves={}
        for method_id in pool['outer_ids']:
            directory=root/'outer'/method_id
            actual_config=read_json(directory/'input/method.json')
            if actual_config!={k:methods[method_id][k] for k in ['method_id','configuration']}:raise ValueError('outer_configuration_drift')
            forecast=read_json(directory/'output/result/forecast.json',decimal_numbers=True)
            metrics[method_id]=score(forecast,context,labels,method_id,study)
            # Only plot values are converted to floating point; the metrics retain exact fractions.
            curves[method_id]=[{'series_id':r['series_id'],'target_tick':r['target_tick'],'mean':float(r['mean']),
                'lower80':float(r['quantiles']['0.1']),'upper80':float(r['quantiles']['0.9'])} for r in forecast['forecasts']]
        result_rows.append({'outer_id':outer_id,'selected_method_id':selected,'selection':selection,'metrics':metrics,'selected_metrics':metrics[selected]})
        plot['origins'].append({'outer_id':outer_id,'cutoff_utc':outer['cutoff_utc'],'target_ticks':outer['target_ticks'],'labels':labels,'selected_method_id':selected,'curves':curves})
    aggregate={}
    for method in [*pool['outer_ids'],'selected']:
        aggregate[method]={}
        for metric in ['scaled_mse','scaled_mae','scaled_wis']:
            values=[Fraction(row['selected_metrics']['metrics_exact'][metric] if method=='selected' else row['metrics'][method]['metrics_exact'][metric]) for row in result_rows]
            aggregate[method][metric]=str(sum(values)/len(expected))
    a.out.mkdir(parents=True,exist_ok=False)
    result={'status':'complete_reference_matrix_recomputed','registered_outer_count':len(expected),'registered_inner_count':sum(g['role']=='inner' for g in data.grid['origins']),
        'outer_forecasts':len(expected)*len(pool['outer_ids']),'rows_per_forecast':len(data.grid['series_catalogue'])*data.contract['grid']['horizon_days'],
        'aggregate_exact':aggregate,'rows':result_rows,'quality_floor':study['quality_floor'],'candidate_score':None,
        'scope':'complete numerical author reference; no complete scientific delivery/rubric/freeze/candidate hours or statistical certification'}
    write_json(a.out/'assessment.json',result);write_json(a.out/'plot-input.json',plot)
    with (a.out/'outer-metrics.csv').open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=['outer_id','method_id','selected','scaled_mse','scaled_mae','scaled_wis']);writer.writeheader()
        for row in result_rows:
            for method,value in row['metrics'].items():writer.writerow({'outer_id':row['outer_id'],'method_id':method,'selected':int(method==row['selected_method_id']),**{k:format(float(Fraction(v)),'.12g') for k,v in value['metrics_exact'].items()}})
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser()
    for name in ['raw','material-contract','study','pool','out']:p.add_argument('--'+name,type=Path,required=True)
    p.add_argument('--run',type=Path,action='append',required=True);a=p.parse_args()
    try:
        value=summarize(a);print(json.dumps({'status':value['status'],'registered_outer_count':value['registered_outer_count'],'aggregate':{m:{k:float(Fraction(v)) for k,v in values.items()} for m,values in value['aggregate_exact'].items()}}),flush=True)
    except (OSError,ValueError,KeyError,TypeError) as e:
        print(json.dumps({'status':'run_invalid','error':'reference_matrix_invalid','detail':str(e),'candidate_score':None}),flush=True);raise SystemExit(3)
