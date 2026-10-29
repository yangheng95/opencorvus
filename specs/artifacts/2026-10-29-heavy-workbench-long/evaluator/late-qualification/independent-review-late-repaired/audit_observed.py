import json,sys
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parent
sys.path.insert(0,str(root/'snapshot/evaluator-tools'))
import pinn_numeric_check as numeric
base=numeric.load_network(root/'observed-main-agent/convergence-qualification/convection-checkpoint.npz')
out=[]
for p in sorted((root/'observed-main-agent/late-newton-qualification-b').glob('nncg-*/result.json')):
    a=json.loads(p.read_text());rows=a['rows'];k=a['parameter']
    independently=numeric.metrics('convection',numeric.load_network(p.parent/'final.npz'),numeric.canonical_data('convection'))
    for name in ['residual_loss','constraint_loss','total_loss','l2re']:
        np.testing.assert_allclose(independently[name],a['independent_terminal'][name],atol=1e-10,rtol=1e-9)
    success=a['status']=='max_updates'
    expected_hvps=0
    for row in rows:
        expected_hvps+=20 if 'sketch_refresh' in row else 0
        pcg=row['pcg'];expected_hvps+=1+2*pcg['iterations']
        if pcg['status']=='pcg_nonpositive_curvature':expected_hvps+=2
        if success:
            assert pcg['status']=='converged' and pcg['explicit_relative_residual']<=1e-8
            assert row['parameter_step_inf']>0 and row['gtd']<0
            assert row['armijo_trials'][-1]['loss']<=row['armijo_trials'][-1]['bound']
    assert expected_hvps==a['hvp_calls']
    item={'parameter':k,'status':a['status'],'attempts':a['attempts'],'accepted_updates':a['accepted_updates'],'independent_numpy_recomputed':independently,'hvp_count':a['hvp_calls'],'hvp_count_reconstructed_from_actual_receipts':expected_hvps,'refresh_attempts_and_seeds':[[i['attempt'],i['sketch_refresh']['seed']] for i in rows if 'sketch_refresh' in i], 'source':'main-agent GPU qualification receipts; not reviewer GPU execution'}
    if not success:
        final=numeric.load_network(p.parent/'final.npz')
        item['terminal_parameters_equal_original_base']=all(np.array_equal(x,y) for bs,fs in zip(base,final) for x,y in zip(bs,fs))
        assert item['terminal_parameters_equal_original_base']
        item['failure_curvature']=rows[-1]['pcg']['curvature'];item['explicit_relative_residual']=rows[-1]['pcg']['explicit_relative_residual']
    else:
        item['all_positive_steps_and_armijo_and_explicit_pcg_verified']=True
    out.append(item)
(root/'observed-run-b-independent-audit.json').write_text(json.dumps(out,indent=2,allow_nan=False)+'\n',encoding='utf-8')
print(json.dumps(out))
