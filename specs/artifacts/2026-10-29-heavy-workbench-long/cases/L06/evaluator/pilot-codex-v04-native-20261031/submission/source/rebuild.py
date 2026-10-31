"""Rebuild every policy and exact value certificate from the original inputs."""
import argparse,json,sys,time
from pathlib import Path
from fractions import Fraction as F
from bellman import Bellman,normalize,encode
p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
sys.path.insert(0,str(a.public));import model
a.out.mkdir(parents=True,exist_ok=False);(a.out/'policies').mkdir();(a.out/'certificates').mkdir();results={}
for folder in sorted((a.public/'instances').iterdir()):
    data=model.load(folder);one={}
    for name,mode,inspection in [('same-information','unknown',True),('class-A','A',True),('class-B','B',True),('no-inspection','unknown',False)]:
        solver=Bellman(data,mode,inspection);v=solver.V(*solver.initial());elapsed=time.perf_counter()-solver.started
        solver.write_certificate(a.out/'certificates'/f'{data["id"]}-{name}.jsonl.gz')
        one[name]={'value_exact':str(v) if v is not None else None,'states':len(solver.values),'feasible_states':len(solver.actions),'seconds':elapsed,'initial_action':solver.actions.get(solver.initial())}
        if name=='same-information':
            reachable,leaves=solver.reachable();table={encode(s):{'action':v['action'],'value':v['value']} for s,v in reachable.items()}
            output={'format':'l06-exact-policy/1','law':normalize(data),'initial_value_exact':str(v),'states':table,'terminal_histories':len(leaves),'probability_mass_exact':str(sum(x[0] for x in leaves))}
            (a.out/'policies'/f'{data["id"]}.json').write_text(json.dumps(output,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8')
            one[name]['policy_states']=len(table);one[name]['terminal_histories']=len(leaves)
        print(json.dumps({'instance':data['id'],'comparison':name,**one[name]}),flush=True)
        del solver
    prior=sum(r['prior'] for r in data['modes'].values() if r['A']==F(17,20))
    bound=prior*F(one['class-A']['value_exact'])+(1-prior)*F(one['class-B']['value_exact'])
    one['advance-information-bound-exact']=str(bound);one['intrinsic-information-value-exact']=str(F(one['same-information']['value_exact'])-bound)
    results[data['id']]=one
(a.out/'values.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
