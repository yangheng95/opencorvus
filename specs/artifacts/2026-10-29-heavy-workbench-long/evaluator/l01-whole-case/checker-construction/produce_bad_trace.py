"""Purposeful erroneous trace writers for the new case checker's focused contracts.

These do not claim a registered full study or any new training.
"""
from pathlib import Path
import argparse,json,copy
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(exist_ok=False)
rows=[json.loads(s) for s in a.source.read_text(encoding='utf-8').splitlines()]
variants={}
v=copy.deepcopy(rows);v.insert(1,copy.deepcopy(v[0]));variants['duplicate_attempt']=v
v=copy.deepcopy(rows);v[0]['costs_total']['closure_calls']=False;variants['boolean_cost']=v
v=copy.deepcopy(rows);v[0]['pcg']['explicit_relative_residual']=1e-3;variants['accepted_bad_pcg']=v
v=copy.deepcopy(rows);v[0]['armijo_trials'][-1]['bound']+=1e-6;variants['invented_armijo_bound']=v
v=copy.deepcopy(rows);v[0].update(step_inf=0,accepted_after=0,loss_after=v[0]['loss_before'],status='optimizer_stalled');variants['continue_after_zero']=v
for name,value in variants.items():(a.out/(name+'.jsonl')).write_text('\n'.join(json.dumps(r) for r in value)+'\n',encoding='utf-8')
print(json.dumps({'actual_input_rows':len(rows),'emitted':list(variants),'scope':'purposeful local postprocessing errors, not a full candidate or training result'}))
