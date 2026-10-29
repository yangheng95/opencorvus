"""Evaluator-only numerical feasibility witness for the public draft contract."""
import argparse
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, '/work/evaluator-tools')
import pinn_numeric_check as numeric
import pinn_torch_check as independent

torch.set_num_threads(4)
torch.set_default_dtype(torch.float64)
device = 'cuda'


def sync():
    torch.cuda.synchronize()


def nystrom(hessian, dimension, mu, seed):
    generator = torch.Generator(device=device).manual_seed(seed)
    q = torch.linalg.qr(torch.randn(dimension, min(dimension, 20), device=device, generator=generator), mode='reduced').Q
    y = torch.stack([hessian(vector) for vector in q.T], dim=1)
    projected = (q.T @ y + y.T @ q) / 2.0
    nu = math.sqrt(dimension) * torch.finfo(y.dtype).eps * torch.linalg.matrix_norm(y, ord=2)
    shift = torch.clamp(-torch.linalg.eigvalsh(projected)[0], min=0.0) + nu
    shifted = y + shift * q
    core = (q.T @ shifted + shifted.T @ q) / 2.0
    lower = torch.linalg.cholesky(core)
    factor = torch.linalg.solve_triangular(lower, shifted.T, upper=False).T
    u, sigma, _ = torch.linalg.svd(factor, full_matrices=False)
    lam = torch.clamp(sigma.square() - shift, min=0.0)
    def inverse(vector):
        projection = u.T @ vector
        return vector - u @ projection + u @ (((lam[-1] + mu) / (lam + mu)) * projection)
    return inverse, {'seed': seed, 'rank': q.shape[1], 'shift': float(shift),
                     'nu': float(nu), 'approx_eigenvalues': lam.cpu().tolist()}, (u, lam)


def pcg(operator, b, inverse, tolerance=1e-8, max_iterations=200):
    x = torch.zeros_like(b)
    denominator_norm = max(float(torch.linalg.vector_norm(b)), 1e-30)
    r = b - operator(x)
    z = inverse(r)
    p = z.clone()
    rz = r @ z
    history = []
    initial = float(torch.linalg.vector_norm(r)) / denominator_norm
    if initial <= tolerance:
        return x, {'status': 'converged', 'iterations': 0, 'explicit_relative_residual': initial, 'history': history}
    for index in range(max_iterations):
        image = operator(p)
        curvature = float(p @ image)
        if not math.isfinite(curvature) or curvature <= 0.0:
            return x, {'status': 'pcg_nonpositive_curvature', 'iterations': index,
                       'curvature': curvature, 'history': history}
        alpha = rz / curvature
        x = x + alpha * p
        r = r - alpha * image
        explicit = float(torch.linalg.vector_norm(b - operator(x))) / denominator_norm
        history.append({'iteration': index + 1, 'recursive_relative_residual': float(torch.linalg.vector_norm(r))/denominator_norm,
                        'explicit_relative_residual': explicit, 'curvature': curvature})
        if not math.isfinite(explicit):
            return x, {'status': 'pcg_nonfinite', 'iterations': index + 1, 'history': history}
        if explicit <= tolerance:
            return x, {'status': 'converged', 'iterations': index + 1,
                       'explicit_relative_residual': explicit, 'history': history}
        z = inverse(r)
        updated_rz = r @ z
        p = z + (updated_rz/rz) * p
        rz = updated_rz
    return x, {'status': 'pcg_iteration_limit', 'iterations': max_iterations,
               'explicit_relative_residual': history[-1]['explicit_relative_residual'], 'history': history}


def known_spd():
    generator = torch.Generator(device=device).manual_seed(116)
    basis = torch.linalg.qr(torch.randn(64, 64, device=device, generator=generator)).Q
    eigenvalues = torch.logspace(0, 3, 64, device=device)
    matrix = (basis * eigenvalues) @ basis.T
    b = torch.linspace(-1.0, 1.0, 64, device=device)
    inverse, sketch, _ = nystrom(lambda v: matrix @ v, 64, .1, 20261029)
    action = torch.stack([inverse(v) for v in torch.eye(64, device=device)], dim=1)
    assert float(torch.linalg.eigvalsh((action + action.T)/2)[0]) > 0
    x, receipt = pcg(lambda v: matrix @ v + .1*v, b, inverse)
    exact = torch.linalg.solve(matrix + .1*torch.eye(64, device=device), b)
    assert receipt['status'] == 'converged', receipt
    relative_error = float(torch.linalg.vector_norm(x-exact)/torch.linalg.vector_norm(exact))
    assert relative_error < 1e-7, relative_error
    lowrank = (basis[:, :4] * torch.tensor([1., 3., 9., 27.], device=device)) @ basis[:, :4].T
    low_inverse, _, (u,lam) = nystrom(lambda v: lowrank@v,64,.1,20261030)
    approximation = (u*lam)@u.T
    approximation_error = float(torch.linalg.matrix_norm(approximation-lowrank)/torch.linalg.matrix_norm(lowrank))
    assert approximation_error < 1e-9,approximation_error
    expected_inverse = .1*torch.linalg.inv(lowrank+.1*torch.eye(64,device=device))
    actual_inverse = torch.stack([low_inverse(v) for v in torch.eye(64,device=device)],dim=1)
    inverse_error = float(torch.linalg.matrix_norm(expected_inverse-actual_inverse)/torch.linalg.matrix_norm(expected_inverse))
    assert inverse_error < 1e-8,inverse_error
    # The expected typed nonpositive-curvature contract is also exercised explicitly.
    _, indefinite = pcg(lambda v: torch.tensor([-1.0, 2.0], device=device)*v,
                        torch.tensor([1.0, 0.0], device=device), lambda v:v)
    assert indefinite['status'] == 'pcg_nonpositive_curvature'
    return {'status': 'passed', 'solution_relative_error': relative_error,
            'exact_lowrank_approximation_relative_error':approximation_error,'exact_lowrank_inverse_relative_error':inverse_error,'sketch': sketch,
            'pcg': receipt, 'indefinite_contract': indefinite}


def export(parameters, destination):
    arrays = {f'{name}_{i}': parameters[2*i+j].detach().cpu().numpy()
              for i in range(4) for j, name in enumerate(('weight', 'bias'))}
    np.savez(destination, **arrays)


def copy_flat(parameters, flat):
    offset = 0
    with torch.no_grad():
        for parameter in parameters:
            parameter.copy_(flat[offset:offset+parameter.numel()].reshape(parameter.shape))
            offset += parameter.numel()


def run_branch(layers, data, method, parameter, branch_index, steps, out):
    parameters = independent.model_parameters(layers, device)
    rows, accepted = [], 0
    sketch_receipt, inverse = None, None
    status = 'max_updates'
    sync(); started = time.perf_counter()
    hvps = [0]
    for attempt in range(steps):
        value, gradient = independent.parameter_gradient('convection', parameters, data, graph=method=='nncg')
        loss_before = float(value.detach())
        b = -gradient.detach()
        row = {'attempt': attempt+1, 'accepted_before': accepted, 'loss_before': loss_before,
               'gradient_inf': float(gradient.detach().abs().max())}
        if not torch.isfinite(gradient).all() or not math.isfinite(loss_before):
            status = 'numerical_failure'; rows.append(row); break
        if float(torch.linalg.vector_norm(b)) == 0.0:
            status = 'gradient_converged'; rows.append(row); break
        old = independent.flatten(parameters).detach().clone()
        if method == 'gd':
            direction = b
            alpha = parameter
            copy_flat(parameters, old+alpha*direction)
            current = float(independent.objective('convection', parameters, data).detach())
            if not math.isfinite(current):
                copy_flat(parameters, old); status='numerical_failure'; rows.append(row); break
            row.update(step_size=alpha, loss_after=current)
        else:
            raw_hessian = independent.hessian_operator(gradient, parameters)
            def hessian(vector):
                hvps[0] += 1
                return raw_hessian(vector)
            if attempt % 20 == 0:
                inverse, sketch_receipt, _ = nystrom(hessian, b.numel(), parameter, 20261029+branch_index*1000+attempt//20)
                row['sketch_refresh'] = sketch_receipt
            direction, solve = pcg(lambda v:hessian(v)+parameter*v, b, inverse)
            row['pcg'] = solve
            if solve['status'] != 'converged':
                status=solve['status']; rows.append(row); break
            directional = float(gradient.detach() @ direction)
            row['gtd'] = directional
            if directional >= 0.0 or not math.isfinite(directional):
                status='non_descent_direction';rows.append(row);break
            row['armijo_trials'] = []
            for shrink in range(31):
                alpha = .5**shrink
                copy_flat(parameters, old+alpha*direction)
                current = float(independent.objective('convection', parameters, data).detach())
                bound = loss_before+.1*alpha*directional
                row['armijo_trials'].append({'alpha':alpha,'loss':current,'bound':bound})
                if not math.isfinite(current):
                    status='numerical_failure';break
                if current <= bound:
                    row.update(step_size=alpha,loss_after=current);break
            else:
                status='armijo_failure'
            if status in ('numerical_failure','armijo_failure'):
                copy_flat(parameters,old);rows.append(row);break
        accepted += 1
        row.update(accepted_after=accepted,hvp_calls_total=hvps[0],elapsed_seconds=time.perf_counter()-started)
        rows.append(row)
        (out/'progress.json').write_text(json.dumps({'method':method,'parameter':parameter,'accepted':accepted,'last':row},indent=2))
    sync()
    export(parameters,out/'final.npz')
    final = numeric.metrics('convection',numeric.load_network(out/'final.npz'),numeric.canonical_data('convection'))
    result={'method':method,'parameter':parameter,'status':status,'accepted_updates':accepted,'attempts':len(rows),
            'max_updates':steps,'seconds':time.perf_counter()-started,'hvp_calls':hvps[0],
            'independent_terminal':final,'rows':rows}
    (out/'result.json').write_text(json.dumps(result,indent=2))
    return {key:value for key,value in result.items() if key!='rows'}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--checkpoint',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--known-only',action='store_true')
    parser.add_argument('--steps',type=int,default=21)
    args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=False)
    witness=known_spd()
    (args.output/'known-spd.json').write_text(json.dumps(witness,indent=2))
    print(json.dumps({'event':'known_spd_passed','relative_error':witness['solution_relative_error']}),flush=True)
    if args.known_only:return
    if args.checkpoint is None:parser.error('--checkpoint is required')
    layers=numeric.load_network(args.checkpoint)
    arrays=numeric.canonical_data('convection')
    data={key:torch.tensor(value,device=device,requires_grad=key in ('residual','initial')) for key,value in arrays.items()}
    initial=numeric.metrics('convection',layers,arrays)
    (args.output/'independent-base.json').write_text(json.dumps(initial,indent=2))
    spectrum=independent.evaluate('convection',args.checkpoint,device,60)
    (args.output/'base-derivatives-spectrum.json').write_text(json.dumps(spectrum,indent=2))
    results=[]
    for method,key,values in [('gd','lr',[1e-4,1e-3]),('nncg','mu',[.01,.1])]:
        for index,parameter in enumerate(values):
            out=args.output/f'{method}-{key}-{parameter}';out.mkdir()
            result=run_branch(layers,data,method,parameter,index,200 if method=='gd' else args.steps,out)
            results.append(result)
            (args.output/'summary.json').write_text(json.dumps({'purpose':'qualification only, not candidate evaluation',
                                                               'initial':initial,'branches':results},indent=2))
            print(json.dumps(result),flush=True)


if __name__=='__main__':main()
