"""New-process restoration of evaluator-owned, trusted optimizer checkpoints."""
import datetime
import os
import sys
exec(open('/work/qualify_pinn.py').read().split("emit('environment'")[0])
sys.path.insert(0,'/work/evaluator-tools')
import pinn_numeric_check as independent

destination=Path('/work/optimizer-restore-qualification')
destination.mkdir(exist_ok=False)
receipts=[]
for problem in ('reaction','wave'):
    source=Path('/work')/f'{problem}-convergence-qualification'
    root=destination/problem;root.mkdir()
    snapshot=torch.load(source/'state-100.pt',map_location='cpu',weights_only=True)
    d=data(problem)
    model=net(345)
    model.load_state_dict(snapshot['model'])
    optimizer=torch.optim.LBFGS(model.parameters(),lr=1.,max_iter=1,max_eval=25,history_size=100,
                                line_search_fn='strong_wolfe',tolerance_grad=1e-9,tolerance_change=1e-15)
    optimizer.load_state_dict(snapshot['optimizer'])
    torch.set_rng_state(snapshot['cpu_rng'])
    torch.cuda.set_rng_state_all(snapshot['cuda_rng'])
    calls=[0]
    def closure():
        optimizer.zero_grad(set_to_none=True)
        for key in ('residual','initial'):d[key].grad=None
        value=loss(model,d,problem);value.backward();calls[0]+=1
        return value
    native=optimizer.state[next(iter(model.parameters()))]
    initial_iterations=native['n_iter'];history_before=len(native['old_dirs'])
    accepted=0;deltas=[]
    sync();started=time.perf_counter()
    for attempt in range(20):
        before=torch.cat([p.detach().ravel() for p in model.parameters()]).clone()
        optimizer.step(closure)
        delta=float((torch.cat([p.detach().ravel() for p in model.parameters()])-before).abs().max())
        deltas.append(delta)
        if delta>0.:accepted+=1
    sync()
    export(model,problem)
    actual=independent.load_network(root/f'{problem}-checkpoint.npz')
    expected=independent.load_network(source/'accepted-120.npz')
    maximum=max(float(np.max(np.abs(a-b))) for left,right in zip(actual,expected) for a,b in zip(left,right))
    passed=all(np.allclose(a,b,atol=1e-10,rtol=1e-8) for left,right in zip(actual,expected) for a,b in zip(left,right))
    result={'problem':problem,'status':'passed' if passed else 'numeric_mismatch','started_from_accepted_update':snapshot['accepted_updates'],
            'prefix_updates_reexecuted':0,'restored_native_iterations':initial_iterations,'final_native_iterations':native['n_iter'],
            'restored_history_size':history_before,'final_history_size':len(native['old_dirs']),
            'new_attempts':20,'new_accepted_updates':accepted,'new_closure_calls':calls[0],
            'maximum_parameter_difference':maximum,'atol':1e-10,'rtol':1e-8,'parameter_step_inf':deltas,
            'pid':os.getpid(),'pid_namespace':os.readlink('/proc/self/ns/pid'),
            'seconds':time.perf_counter()-started,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'independent_final':independent.metrics(problem,actual,independent.canonical_data(problem))}
    receipts.append(result)
    (destination/'receipts.json').write_text(json.dumps(receipts,indent=2))
    print(json.dumps(result),flush=True)
    assert passed,result
    assert initial_iterations==100 and native['n_iter']==120
    assert accepted==20
