"""Actual producer and fresh-process consumer for the draft Adam restore contract."""
import argparse
import datetime
import os
import sys
exec(open('/work/qualify_pinn.py').read().split("emit('environment'")[0])
sys.path.insert(0,'/work/evaluator-tools')
import pinn_numeric_check as independent

parser=argparse.ArgumentParser();parser.add_argument('mode',choices=('producer','consumer'));args=parser.parse_args()
base=Path('/work/adam-restore-qualification')
root=base/args.mode;root.mkdir(parents=True,exist_ok=False)
problem='convection';d=data(problem);model=net(345)
optimizer=torch.optim.Adam(model.parameters(),lr=1e-4,betas=(.9,.999),eps=1e-8,weight_decay=0,amsgrad=False)
identity=(Path('/work')/f'adam-{args.mode}.cid').read_text().strip()
def update(count):
    deltas=[]
    for _ in range(count):
        previous=torch.cat([p.detach().ravel() for p in model.parameters()]).clone()
        optimizer.zero_grad(set_to_none=True)
        for key in ('residual','initial'):d[key].grad=None
        value=loss(model,d,problem);value.backward();optimizer.step()
        delta=float((torch.cat([p.detach().ravel() for p in model.parameters()])-previous).abs().max())
        assert delta>0 and math.isfinite(delta)
        deltas.append(delta)
    return deltas
sync();started=time.perf_counter()
if args.mode=='producer':
    prefix=update(500)
    torch.save({'model':model.state_dict(),'optimizer':optimizer.state_dict(),'cpu_rng':torch.get_rng_state(),
                'cuda_rng':torch.cuda.get_rng_state_all(),'accepted_updates':500},root/'state-500.pt')
    following=update(100)
    export(model,problem)
    (root/f'{problem}-checkpoint.npz').rename(root/'expected-600.npz')
    receipt={'mode':args.mode,'status':'completed','container_id':identity,'pid':os.getpid(),
             'pid_namespace':os.readlink('/proc/self/ns/pid'),'accepted_updates':600,
             'snapshot_accepted_updates':500,'following_accepted_updates':100}
else:
    source=base/'producer'
    producer=json.loads((source/'receipt.json').read_text())
    state=torch.load(source/'state-500.pt',map_location='cpu',weights_only=True)
    model.load_state_dict(state['model']);optimizer.load_state_dict(state['optimizer'])
    torch.set_rng_state(state['cpu_rng']);torch.cuda.set_rng_state_all(state['cuda_rng'])
    following=update(100)
    export(model,problem)
    actual=independent.load_network(root/f'{problem}-checkpoint.npz')
    expected=independent.load_network(source/'expected-600.npz')
    maximum=max(float(np.max(np.abs(a-b))) for left,right in zip(actual,expected) for a,b in zip(left,right))
    matches=all(np.allclose(a,b,atol=1e-10,rtol=1e-8) for left,right in zip(actual,expected) for a,b in zip(left,right))
    receipt={'mode':args.mode,'status':'passed' if matches else 'numeric_mismatch','container_id':identity,
             'producer_container_id':producer['container_id'],'pid':os.getpid(),'pid_namespace':os.readlink('/proc/self/ns/pid'),
             'prefix_updates_reexecuted':0,'restored_accepted_updates':state['accepted_updates'],'new_accepted_updates':100,
             'maximum_parameter_difference':maximum,'atol':1e-10,'rtol':1e-8,
             'independent_final':independent.metrics(problem,actual,independent.canonical_data(problem))}
    assert identity!=producer['container_id']
    assert matches,receipt
sync();receipt.update(seconds=time.perf_counter()-started,observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                      following_step_inf=following,evidence_scope='evaluator optimizer restoration only, not a candidate task')
(root/'receipt.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt),flush=True)
