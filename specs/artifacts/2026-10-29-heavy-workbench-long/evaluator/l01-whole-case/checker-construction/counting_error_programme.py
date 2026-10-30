"""Purposeful real counting error: a nonzero native step is mislabeled stalled.

The actual trace and native receipt remain truthful; only the submission's
declared terminal/count interpretation is wrong. This is not a successful study.
"""
from pathlib import Path
import argparse,json,os,sys
import torch
import study_engine as e
from correct_driver_support import blank
def main():
    p=argparse.ArgumentParser();p.add_argument('--inputs',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--device',choices=['cpu'],required=True);p.add_argument('--only',required=True);a=p.parse_args()
    torch.set_default_dtype(torch.float64);torch.set_num_threads(1);a.output.mkdir(parents=True,exist_ok=False)
    profile=json.loads((a.inputs/'profile.json').read_text());spec=next(s for s in profile['base_configurations'] if s['id']==a.only)
    params=e.initial_parameters(spec['seed'],'cpu');e.export(params,a.output/'initial.npz');oracle=e.Oracle(spec['problem'],params,e.data_from_public(a.inputs,spec['problem'],'cpu'))
    actual=e.optimize(oracle,'lbfgs',1,a.output/'actual-native',{'scope':'purposeful terminal/count interpretation error, one actual native update'})
    assert actual['attempts']==1 and actual['accepted_updates']==1,actual
    manifest={'format':'heavy-pinn-study/1','benchmark':profile['benchmark'],'case':'L01','runs':[blank(s) for s in profile['base_configurations']+profile['continuations']],'solution_checkpoints':{'convection':spec['id'],'reaction':None,'wave':None}}
    for r in manifest['runs']:
        if r['config_id'] in [s['id'] for s in profile['continuations']]:r.update(status='dependency_incomplete',reason='registered hybrid parents not executed')
    record=next(r for r in manifest['runs'] if r['config_id']==spec['id']);rel=lambda p:Path(p).resolve().relative_to(Path(__file__).resolve().parent).as_posix()
    record.update(status='optimizer_stalled',reason='DELIBERATE BUG: old native scalar return interpreted as zero parameter update',phases={'lbfgs':{'attempts':1,'accepted_updates':0}},costs={k:actual['costs'][k] for k in record['costs']},checkpoints={'initial':rel(a.output/'initial.npz'),'switch':None,'final':rel(a.output/'actual-native/final.npz')},trace=rel(a.output/'actual-native/attempts.jsonl'),receipt=rel(a.output/'actual-native/execution.json'))
    e.write_json(a.output/'manifest.json',manifest);e.write_json(a.output/'purposeful-error.json',{'native_pid':os.getpid(),'argv':sys.argv,'true_execution':actual,'declared_count':record['phases'],'scope':'real wrong programme, not a trained registered reference or a model candidate score'})
    print(json.dumps({'actual_updates':actual['accepted_updates'],'declared_updates':0,'purposeful_error':True}),flush=True)
if __name__=='__main__':main()
