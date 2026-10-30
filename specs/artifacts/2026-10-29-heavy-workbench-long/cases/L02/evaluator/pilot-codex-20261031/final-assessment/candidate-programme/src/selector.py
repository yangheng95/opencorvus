"""Exact selector: only full registered inner forecasts, labels and positive fixed scales."""
import sys
from pathlib import Path
from fractions import Fraction
from common import load,dump,F,score


def choose(packet):
    ids=packet['selection_ids'];inner=packet['inner_ids'];frames=packet['frames']
    if len(ids)<2 or len(set(ids))!=len(ids) or len(inner)!=3 or len(set(inner))!=3 or sorted(f['origin_id'] for f in frames)!=sorted(inner):
        raise ValueError('invalid_selection_grid')
    losses={m:Fraction() for m in ids}
    by_origin={}
    for frame in frames:
        if frame['labels_released_at']>packet['outer_origin_tick'] or set(frame['forecasts'])!=set(ids):
            raise ValueError('invalid_selection_availability')
        by_origin[frame['origin_id']]={}
        for mid in ids:
            m=score(frame['context'],frame['labels'],frame['forecasts'][mid])
            loss=F(m['metrics_exact']['scaled_mse'])
            losses[mid]+=loss/3
            by_origin[frame['origin_id']][mid]=str(loss)
    winner=min(ids,key=lambda mid:(losses[mid],mid))
    return {'format':'l02-selection/1','outer_origin_tick':packet['outer_origin_tick'],'selected_method_id':winner,'method_mean_inner_scaled_mse':{m:str(losses[m]) for m in ids},'complete_inner_origins':3,'per_inner_scaled_mse':by_origin}


def main(inp='/input',out='/output'):
    study=load(Path(inp)/'study.json')
    if study['selector']!='minimum_mean_inner_scaled_mse_then_lexical_id':raise ValueError('unsupported_study_selector')
    result=choose(load(Path(inp)/'inner.json', exact=True))
    dump(Path(out)/'result/selection.json',result)
    print('selection_written',result['selected_method_id'],flush=True)


if __name__=='__main__':main(*(sys.argv[1:]))
