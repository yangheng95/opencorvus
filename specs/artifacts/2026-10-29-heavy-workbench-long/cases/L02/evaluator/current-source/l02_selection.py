"""A numerical selector over complete legal inner grids; never accepts outer truth."""
import argparse
from fractions import Fraction
import json
from pathlib import Path
from l02_scoring import ProtocolError, load_study, score
from material_contract import read_json


def choose(payload,study):
    if type(payload) is not dict or set(payload)!={'format','outer_origin_tick','inner_ids','selection_ids','frames'} or payload['format']!='l02-inner-selection-packet/1':raise ProtocolError('facility_selection_packet_invalid','registered complete inner packet required')
    ids=payload['selection_ids'];inner=payload['inner_ids'];outer=payload['outer_origin_tick']
    if type(outer) is not int or type(ids) is not list or len(ids)<2 or any(type(i) is not str or not i.strip() for i in ids) or len(set(ids))!=len(ids):raise ProtocolError('facility_selection_packet_invalid','assigned method pool required')
    if type(inner) is not list or not inner or any(type(i) is not str or not i.strip() for i in inner) or len(set(inner))!=len(inner):raise ProtocolError('facility_selection_packet_invalid','assigned inner identities required')
    frames=payload['frames']
    if type(frames) is not list or len(frames)!=len(inner):raise ProtocolError('selection_incomplete','all registered inner cells required')
    losses={i:[] for i in ids};seen=set()
    for frame in frames:
        if type(frame) is not dict or set(frame)!={'origin_id','context','labels','labels_released_at','forecasts'} or frame['origin_id'] not in inner or frame['origin_id'] in seen:raise ProtocolError('selection_incomplete','unique complete inner frames required')
        seen.add(frame['origin_id'])
        if type(frame['context']) is not dict or type(frame['labels_released_at']) is not int or frame['labels_released_at']>outer or type(frame['context'].get('origin_tick')) is not int or frame['context']['origin_tick']>=outer:raise ProtocolError('facility_selection_packet_invalid','only already-published earlier inner labels are eligible')
        if type(frame['forecasts']) is not dict or set(frame['forecasts'])!=set(ids):raise ProtocolError('selection_incomplete','every mandatory method required at every inner')
        for method in ids:
            try:value=score(frame['forecasts'][method],frame['context'],frame['labels'],method,study)
            except ProtocolError as e:
                if e.code.startswith('facility_'):raise
                raise ProtocolError('selection_incomplete','invalid mandatory inner prediction: '+method+':'+e.code) from e
            losses[method].append(Fraction(value['metrics_exact']['scaled_mse']))
    means={method:sum(values)/len(inner) for method,values in losses.items()}
    selected=min(ids,key=lambda method:(means[method],method))
    return {'format':'l02-selection/1','outer_origin_tick':outer,'selected_method_id':selected,
        'method_mean_inner_scaled_mse':{method:str(value) for method,value in means.items()},'complete_inner_origins':len(inner)}


def assess_selection(actual,payload,study):
    expected=choose(payload,study)
    if type(actual) is not dict or actual.get('format')!='l02-selection/1' or type(actual.get('outer_origin_tick')) is not int or actual['outer_origin_tick']!=expected['outer_origin_tick'] or actual.get('selected_method_id')!=expected['selected_method_id']:
        raise ProtocolError('selection_invalid','actual selected ID must be the registered complete-inner minimum and cannot inject a new configuration')
    if 'method_mean_inner_scaled_mse' in actual:
        if type(actual['method_mean_inner_scaled_mse']) is not dict or set(actual['method_mean_inner_scaled_mse'])!=set(expected['method_mean_inner_scaled_mse']):raise ProtocolError('selection_invalid','reported score grid must match actual complete inner grid')
        try:
            if any(Fraction(actual['method_mean_inner_scaled_mse'][i])!=Fraction(value) for i,value in expected['method_mean_inner_scaled_mse'].items()):raise ValueError()
        except (ValueError,TypeError,ZeroDivisionError) as e:raise ProtocolError('selection_invalid','reported losses contradict independent recomputation') from e
    return {'status':'selection_verified','expected':expected,'scope':'complete assigned inner grids only; no outer quality or full task grade'}


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--study',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    try:
        result=choose(read_json(a.input,decimal_numbers=True),load_study(a.study));a.output.mkdir(parents=True,exist_ok=False)
        (a.output/'selection.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({'status':'selection_completed','selected_method_id':result['selected_method_id']}),flush=True)
    except ProtocolError as e:
        facility=e.code.startswith('facility_')
        print(json.dumps({'status':'run_invalid' if facility else 'selection_incomplete','error':e.code,'detail':e.detail}),flush=True);raise SystemExit(3 if facility else 2)
    except (OSError,ValueError,KeyError,TypeError) as e:
        print(json.dumps({'status':'run_invalid','error':'facility_selection_input_invalid','detail':str(e)}),flush=True);raise SystemExit(3)
