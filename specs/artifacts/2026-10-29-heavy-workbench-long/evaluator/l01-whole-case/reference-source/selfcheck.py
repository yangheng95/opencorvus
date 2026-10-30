"""Focused positive contracts for the new full-study engine, not a whole study."""
from pathlib import Path
import argparse,json
import numpy as np
import torch
import study_engine as e
from pinn_numeric_check import canonical_data,load_network,metrics

def main():
    p=argparse.ArgumentParser();p.add_argument('--inputs',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
    torch.set_default_dtype(torch.float64);torch.set_num_threads(1);checks={}
    matrix=torch.diag(torch.linspace(1,10,32));b=torch.linspace(-1,1,32)
    inverse,sketch=e.nystrom(lambda v:matrix@v,32,.1,20261029,'cpu')
    x,solve=e.pcg(lambda v:matrix@v+.1*v,b,inverse)
    expected=torch.linalg.solve(matrix+.1*torch.eye(32),b)
    checks['known_spd_explicit_residual']=solve['status']=='converged' and solve['explicit_relative_residual']<=1e-8
    checks['known_spd_actual_solution']=bool(torch.allclose(x,expected,atol=1e-8,rtol=1e-7))
    _,bad=e.pcg(lambda v:torch.tensor([-1.,2.])*v,torch.tensor([1.,0.]),lambda v:v)
    checks['nonpositive_curvature_contract']=bad['status']=='pcg_nonpositive_curvature'
    parameters=e.initial_parameters(345,'cpu');data=e.data_from_public(a.inputs,'convection','cpu');oracle=e.Oracle('convection',parameters,data)
    before=a.out/'initial.npz';e.export(parameters,before)
    torch_value=float(oracle.value().detach());numpy_value=metrics('convection',load_network(before),canonical_data('convection'))['total_loss']
    checks['actual_width100_objective']=bool(np.isclose(torch_value,numpy_value,atol=1e-10,rtol=1e-9))
    for method,limit in (('adam',2),('lbfgs',2)):
        r=e.optimize(oracle,method,limit,a.out/method,{'scope':'two-update engine diagnostic, not a registered completed configuration'},learning_rate=1e-4)
        rows=[json.loads(s) for s in (a.out/method/'attempts.jsonl').read_text().splitlines()]
        checks[method+'_actual_two_updates']=r['accepted_updates']==2 and r['attempts']==2 and all(v['step_inf']>0 for v in rows)
        checks[method+'_explicit_cost_deltas']=all(all(v['costs_increment'][k]>=0 for k in oracle.costs) for v in rows)
        final=metrics('convection',load_network(a.out/method/'final.npz'),canonical_data('convection'))['total_loss']
        checks[method+'_actual_final_loss']=bool(np.isclose(final,rows[-1]['loss_after'],atol=1e-10,rtol=1e-9))
        if method=='lbfgs':checks['native_closure_trials']=all(v['closures'] and all(t['alpha'] is not None and t['direction_consistency_inf']<1e-8 for t in v['closures']) for v in rows)
    e.write_json(a.out/'assessment.json',{'checks':checks,'all':all(checks.values()),'scope':'current new engine positive contracts only; not19+5/restore/report/fullcase/quality qualification','known_pcg':solve,'known_nystrom':sketch})
    print(json.dumps(checks));assert all(checks.values()),checks
if __name__=='__main__':main()
