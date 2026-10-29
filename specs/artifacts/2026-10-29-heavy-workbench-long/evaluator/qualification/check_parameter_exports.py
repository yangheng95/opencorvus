import json
import time
from pathlib import Path
print(json.dumps({'event':'python_started','at':time.time()}),flush=True)
import sys
sys.path.insert(0,'/work/evaluator-tools')
import torch
import pinn_torch_check as check
torch.set_num_threads(4)
print(json.dumps({'event':'imports_ready','at':time.time()}),flush=True)
receipts=[]
for problem in ('convection','reaction','wave'):
    start=time.perf_counter()
    result=check.evaluate(problem,Path('/work/qualification')/f'{problem}-checkpoint.npz','cuda',30)
    assert result['finite_difference_hvp_relative_error'] < 1e-4,result
    assert abs(result['directional_gradient']-result['finite_difference_directional_gradient']) < 1e-7
    result['elapsed_seconds']=time.perf_counter()-start
    receipts.append(result)
    Path('/work/qualification/independent-parameter-check.json').write_text(json.dumps(receipts,indent=2))
    print(json.dumps({'event':'checked','problem':problem,'seconds':result['elapsed_seconds'],'hvp_relative_error':result['finite_difference_hvp_relative_error']}),flush=True)
