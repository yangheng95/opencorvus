"""Reviewer-only inference diagnostics. No thresholds or candidate scores."""
import json
import sys
from pathlib import Path
import numpy as np

root=Path(__file__).resolve().parent
sys.path.insert(0,str(root/'snapshot'))
import pinn_numeric_check as numeric


def quality(problem,layers):
    data=numeric.canonical_data(problem)
    measured=numeric.metrics(problem,layers,data)
    jets=numeric.forward_jets(layers,data['evaluation'])
    residual=numeric.operator_residual(problem,jets)
    initial=numeric.forward_jets(layers,data['initial'])
    left=numeric.forward_jets(layers,data['boundary_left'])
    right=numeric.forward_jets(layers,data['boundary_right'])
    target=numeric.exact_jets(problem,data['initial'])['u']
    rms=lambda x:float(np.sqrt(np.mean(x*x)))
    pools={'initial_value_rmse':rms(initial['u']-target)}
    if problem=='wave':
        pools.update(initial_velocity_rmse=rms(initial['ut']),left_boundary_rmse=rms(left['u']),right_boundary_rmse=rms(right['u']))
    else:pools['periodic_boundary_rmse']=rms(left['u']-right['u'])
    return {'existing_independent_metrics':measured,'evaluation_residual_rmse_full_public_grid':rms(residual),'constraint_pool_rmse':pools}


results=[]
for problem in ['convection','reaction','wave']:
    for constant in [0.,1.]:
        layers=[(np.zeros((100,2)),np.zeros(100)),(np.zeros((100,100)),np.zeros(100)),(np.zeros((100,100)),np.zeros(100)),(np.zeros((1,100)),np.array([constant]))]
        q=quality(problem,layers)
        results.append({'kind':'untrained_control_network','problem':problem,'constant':constant,'quality':q})
    data=numeric.canonical_data(problem)
    points=data['evaluation'];at_initial=points.copy();at_initial[:,1]=0.
    jets=numeric.exact_jets(problem,at_initial)
    jets['ut']=np.zeros_like(jets['u']);jets['utt']=np.zeros_like(jets['u'])
    results.append({'kind':'analytic_initial_extension_control_not_submitted_network','problem':problem,
                    'l2re':numeric.l2re(jets['u'],numeric.exact_jets(problem,points)['u']),
                    'evaluation_residual_rmse_full_public_grid':float(np.sqrt(np.mean(numeric.operator_residual(problem,jets)**2))),
                    'initial_and_boundary_constraints':'satisfies this problem initial data and value boundaries; wave initial velocity is also zero'})

state=root/'observed-main-agent/late-newton-200-qualification/nncg-mu-1.0/final.npz'
results.append({'kind':'nonselected_old_parent_mu1_200step_qualification_only','problem':'convection','quality':quality('convection',numeric.load_network(state))})
rubric=json.loads((root/'snapshot/rubric.draft.json').read_text())
leaves=[x for x in rubric['leaves'] if x['id'] in [f'L01-R-{p}-result' for p in ['convection','reaction','wave']]]
structure={'quality_leaf_weight':sum(x['weight'] for x in leaves),'quality_leaves_critical':any(x['critical'] for x in leaves),
           'conditional_score_if_these_unmet_and_all_other_leaves_full':rubric['maxPoints']-sum(x['weight'] for x in leaves),
           'acceptance_observed':rubric['acceptance'],'interpretation':'logical scoring structure, not a measured candidate score or claim that zero networks actually earned execution credit'}
(root/'quality-diagnostics.json').write_text(json.dumps({'scope':'reviewer CPU inference/analytic controls only; thresholds remain unfrozen','scoring_structure':structure,'diagnostics':results},indent=2,allow_nan=False)+'\n',encoding='utf-8')

cache=root.parent
a=json.loads((root/'observed-main-agent/late-newton-200-qualification/nncg-mu-1.0/result.json').read_text())
rows=a['rows']
expected_hvps=sum((20 if 'sketch_refresh'in x else 0)+1+2*x['pcg']['iterations'] for x in rows)
assert len(rows)==a['accepted_updates']==200
assert all(x['parameter_step_inf']>0 and x['gtd']<0 and x['pcg']['explicit_relative_residual']<=1e-8 and x['armijo_trials'][-1]['loss']<=x['armijo_trials'][-1]['bound'] for x in rows)
assert expected_hvps==a['hvp_calls']
q=results[-1]['quality']['existing_independent_metrics']
for field in ['residual_loss','constraint_loss','total_loss','l2re']:
    np.testing.assert_allclose(q[field],a['independent_terminal'][field],atol=1e-10,rtol=1e-9)
nn={'accepted_updates':200,'sketch_refreshes':[[x['attempt'],x['sketch_refresh']['seed']] for x in rows if 'sketch_refresh'in x],
    'max_pcg_explicit_relative_residual':max(x['pcg']['explicit_relative_residual'] for x in rows),'hvp_calls_reconstructed':expected_hvps,
    'all_nonzero_descent_armijo_verified':True,'independent_numpy_terminal_recomputed':q,'scope':'read-only audit of main-agent qualification, not candidate run'}

restores=[]
for problem in ['reaction','wave']:
    restored=cache/f'optimizer-restore-qualification/{problem}/{problem}-checkpoint.npz'
    expected=cache/f'{problem}-convergence-qualification/accepted-120.npz'
    actual=numeric.load_network(restored);target=numeric.load_network(expected)
    delta=max(float(np.max(np.abs(x-y))) for a,b in zip(actual,target) for x,y in zip(a,b))
    assert delta==0
    restores.append({'method':'lbfgs','problem':problem,'actual_parameter_difference_to_uninterrupted_120':delta,'restored':str(restored),'uninterrupted':str(expected)})
actual=numeric.load_network(cache/'adam-restore-qualification/consumer/convection-checkpoint.npz')
target=numeric.load_network(cache/'adam-restore-qualification/producer/expected-600.npz')
delta=max(float(np.max(np.abs(x-y))) for a,b in zip(actual,target) for x,y in zip(a,b));assert delta==0
restores.append({'method':'adam','problem':'convection','actual_parameter_difference_to_uninterrupted_600':delta})
(root/'qualification-receipt-audit.json').write_text(json.dumps({'newton_200':nn,'restoration_numeric_exports':restores,'scope':'parameter equality and receipt audit; no restoration process or GPU training launched'},indent=2,allow_nan=False)+'\n',encoding='utf-8')
print(json.dumps({'scoring_structure':structure,'newton_200_accepted':200,'newton_refreshes':len(nn['sketch_refreshes']),'restore_parameter_differences':[x.get('actual_parameter_difference_to_uninterrupted_120',x.get('actual_parameter_difference_to_uninterrupted_600')) for x in restores]}))
