"""Synthetic reader-contract probes only; declared counts and empty traces are not training."""
import contextlib
import inspect
import json
from pathlib import Path
import subprocess
import sys

root=Path(__file__).resolve().parent
version=sys.argv[1]
source=root/version
sys.path.insert(0,str(source/'script/benchmark'))
import pinn_submission_check as check
import test_pinn_submission_check as fixture
repaired=len(inspect.signature(check.check_submission).parameters)==3
out=root/(version+'-probe-results');out.mkdir()
records=[]

@contextlib.contextmanager
def case(name):
    f=fixture.SubmissionContracts('test_complete_registry_of_unstarted_runs_remains_unassessed');f.setUp()
    try:yield f
    finally:f.doCleanups()

def evaluate(f,manifest='results/manifest.json'):
    f.write()
    return check.check_submission(f.root,f.profile,manifest) if repaired else check.check_submission(f.root,f.profile)

def record_result(name,call):
    try:
        result=call()
        records.append({'probe':name,'outcome':'accepted','artifact_contract_checked':result['artifact_contract_checked'],
                        'study_complete':result['study_complete'],'solution_reproduced':result['solution_reproduced'],
                        'continuation_parent':result['continuation_parent'],'solution_checkpoints':result['solution_checkpoints']})
    except Exception as e:
        records.append({'probe':name,'outcome':'error','error_type':type(e).__name__,'code':getattr(e,'code',None),'detail':str(e)})

with case('unstarted_bad_trace') as f:
    f.manifest['runs'][0]['trace']='../outside.jsonl'
    record_result('zero_attempt_nonnull_trace_scope',lambda:evaluate(f))
with case('unstarted_bad_receipt') as f:
    f.manifest['runs'][0]['receipt']={'wrong':'type'}
    record_result('zero_attempt_nonnull_receipt_type',lambda:evaluate(f))
with case('custom_output') as f:
    f.write();custom=f.root/'trial-a';custom.mkdir()
    (custom/'manifest.json').write_bytes((f.root/'results/manifest.json').read_bytes())
    (f.root/'results/manifest.json').unlink()
    def custom_check():
        return check.check_submission(f.root,f.profile,'trial-a/manifest.json') if repaired else check.check_submission(f.root,f.profile)
    record_result('valid_custom_output_manifest',custom_check)
with case('nul_cli') as f:
    r=f.synthetic_finite_run('wave-adam-s345-lr1e-03');r['checkpoints']['initial']='bad\x00.npz';f.write()
    output=f.root/'machine-receipt.json'
    command=[sys.executable,'-B',str(source/'script/benchmark/pinn_submission_check.py'),'--root',str(f.root),'--profile',str(fixture.PROFILE),'--out',str(output)]
    if repaired:command.extend(['--manifest','results/manifest.json'])
    a=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace')
    (out/'nul-cli.stdout.txt').write_text(a.stdout,encoding='utf-8');(out/'nul-cli.stderr.txt').write_text(a.stderr,encoding='utf-8')
    records.append({'probe':'nul_path_real_cli','exit_code':a.returncode,'command_argv':command,
                    'machine_receipt':json.loads(output.read_text()) if output.is_file() else None})
with case('different_tie_rules') as f:
    keys=['convection-hybrid-s345-lr1e-04','convection-hybrid-s345-lr1e-03','convection-hybrid-s345-lr1e-02']
    for key in keys:f.synthetic_finite_run(key)
    parent='convection-hybrid-s345-lr1e-04'
    for spec in f.profile['continuations']:
        r=f.run_record(spec['id']);r.update(status='incomplete',parent_id=parent)
        r['checkpoints']['initial']='zero.npz'
    f.manifest['solution_checkpoints']['convection']=min(keys)
    record_result('parent_small_lr_and_final_lexical_id_ties',lambda:evaluate(f))
with case('initial_pairing') as f:
    first='wave-adam-s345-lr1e-03';second='wave-lbfgs-s345-lrnone'
    f.synthetic_finite_run(first);r=f.synthetic_finite_run(second)
    r['checkpoints']['initial']=f.export('different-initial.npz',1.)
    f.manifest['solution_checkpoints']['wave']=first
    record_result('different_initials_for_same_problem_seed',lambda:evaluate(f))
with case('plateau_too_short') as f:
    r=f.synthetic_finite_run('wave-lbfgs-s345-lrnone')
    r.update(status='finite_plateau',reason='Synthetic declared plateau after one accepted update')
    r['phases']['lbfgs'].update(attempts=1,accepted_updates=1)
    r['costs'].update(closure_calls=1,lbfgs_native_iterations=1)
    record_result('finite_plateau_one_update',lambda:evaluate(f))
with case('zero_attempt_stalled') as f:
    r=f.synthetic_finite_run('wave-lbfgs-s345-lrnone')
    r.update(status='optimizer_stalled',reason='Synthetic declared native zero-step without any attempt')
    r['phases']['lbfgs'].update(attempts=0,accepted_updates=0)
    r['costs'].update(closure_calls=0,lbfgs_native_iterations=0)
    record_result('optimizer_stalled_zero_attempts',lambda:evaluate(f))
with case('duplicate_id') as f:
    f.manifest['runs'][1]['config_id']=f.manifest['runs'][0]['config_id']
    record_result('duplicate_registry_id',lambda:evaluate(f))
with case('failed_endpoint_selection') as f:
    eligible='reaction-adam-s345-lr1e-03';failed='reaction-lbfgs-s345-lrnone'
    a=f.synthetic_finite_run(eligible);a['checkpoints']['final']=f.export('one-final.npz',1.)
    b=f.synthetic_finite_run(failed);b.update(status='numerical_failure',failure_code='synthetic_failure',reason='Local fixture only')
    b['phases']['lbfgs'].update(attempts=1,accepted_updates=0)
    b['costs'].update(closure_calls=1,lbfgs_native_iterations=1)
    f.manifest['solution_checkpoints']['reaction']=eligible
    record_result('failed_lower_loss_endpoint_excluded_from_solution',lambda:evaluate(f))
(out/'observations.json').write_text(json.dumps({'source_version':version,'synthetic_reader_contract_only':True,'training_occurred':False,'observations':records},indent=2,allow_nan=False)+'\n',encoding='utf-8')
print(json.dumps(records))
