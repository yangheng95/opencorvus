import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,'/work/evaluator-tools')
import torch
import pinn_torch_check as check
torch.set_num_threads(4)
suite=unittest.defaultTestLoader.discover('/work/evaluator-tools',pattern='test_pinn_torch_check.py')
assert unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful()
receipts=[]
for problem in ('convection','reaction','wave'):
    for component in ('total','residual','constraint'):
        result=check.evaluate(problem,Path('/work/qualification')/f'{problem}-checkpoint.npz','cuda',30,component)
        assert result['finite_difference_hvp_relative_error'] < 1e-4,result
        assert abs(result['directional_gradient']-result['finite_difference_directional_gradient']) < 1e-7
        receipts.append(result)
        Path('/work/qualification/independent-component-check.json').write_text(json.dumps(receipts,indent=2))
        print(json.dumps({'problem':problem,'component':component,'hvp_relative_error':result['finite_difference_hvp_relative_error']}),flush=True)
