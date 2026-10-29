"""Read-only native receipt/source review and independent stdlib endpoint arithmetic.

Does NOT execute Torch, a container, training, a model, or a user process.
"""
import ast
import json
import math
from pathlib import Path
import shutil
import struct
import sys
import zipfile

sys.dont_write_bytecode=True
from collect_review_evidence import OUT, save

SRC=Path('D:/opencorvus-benchmark-runs/paperbench-discovery-20261029/native-lbfgs-zero-qualification')
DEST=OUT/'native-zero-readonly-addendum'
DEST.mkdir(exist_ok=False)
for name in ('before.npz','after.npz','receipt.json','independent-numpy.json','execution.json',
             'executed-source.py','pinn_numeric_check.py','pinn_torch_check.py'):
    shutil.copy2(SRC/name,DEST/name)

def decode(path):
    arrays={}
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            b=z.read(name)
            if b[:6]!=b'\x93NUMPY':raise ValueError('npy magic')
            major=b[6]
            if major==1:hlen=struct.unpack('<H',b[8:10])[0];start=10
            elif major in (2,3):hlen=struct.unpack('<I',b[8:12])[0];start=12
            else:raise ValueError('npy version')
            header=ast.literal_eval(b[start:start+hlen].decode('latin1'))
            if header['descr']!='<f8' or header['fortran_order']:
                raise ValueError('expected C-order float64')
            count=math.prod(header['shape']);payload=b[start+hlen:]
            if len(payload)!=8*count:raise ValueError('payload count')
            values=struct.unpack('<'+'d'*count,payload)
            if any(not math.isfinite(x) for x in values):raise ValueError('nonfinite')
            arrays[name.removesuffix('.npy')]={'shape':list(header['shape']),'values':values}
    return arrays

before,after=decode(DEST/'before.npz'),decode(DEST/'after.npz')
shapes={'weight_0':[100,2],'bias_0':[100], 'weight_1':[100,100],'bias_1':[100],
        'weight_2':[100,100],'bias_2':[100], 'weight_3':[1,100],'bias_3':[1]}
if set(before)!=set(shapes) or set(after)!=set(shapes):raise ValueError('array identity')
for name,shape in shapes.items():
    if before[name]['shape']!=shape or after[name]['shape']!=shape:raise ValueError('shape')
expected=2e-8
initialization_error=max(abs(v-(expected if name=='bias_3' else 0))
                         for name,a in before.items() for v in a['values'])
parameter_delta=max(abs(a-b) for name in before for a,b in zip(before[name]['values'],after[name]['values']))
parameter_count=sum(len(a['values']) for a in before.values())
# For the decoded all-zero network except output bias: u=c; all space/time jets=0.
# Canonical initial x=2pi*i/256, periodic count101; pooled constraint count358.
c=before['bias_3']['values'][0]
initial_errors=[c-math.sin(2*math.pi*i/256) for i in range(257)]
loss=0.5*math.fsum(e*e for e in initial_errors)/358
bias_gradient=math.fsum(initial_errors)/358
init_rmse=math.sqrt(math.fsum(e*e for e in initial_errors)/257)
truth=[math.sin(2*math.pi*i/128-40*j/64) for i in range(129) for j in range(65)]
l2re=math.sqrt(math.fsum((c-u)**2 for u in truth)/math.fsum(u*u for u in truth))
receipt=json.loads((DEST/'receipt.json').read_text(encoding='utf-8'))
independent=json.loads((DEST/'independent-numpy.json').read_text(encoding='utf-8'))
g=receipt['gradient_before_inf']
checks={
    'decoded_expected_initialization':initialization_error==0,
    'decoded_actual_zero_step':parameter_delta==0,
    'full_parameter_count':parameter_count==20601,
    'one_attempt_zero_accepted':receipt['attempts']==1 and receipt['accepted_updates']==0,
    'one_native_iter_and_closure':receipt['native_iterations']==1 and receipt['closure_calls']==1,
    'gradient_exceeds_tolerance':g>receipt['tolerance_grad'],
    'gtd_matches_steepest_direction':abs(receipt['native_directional_derivative']+g*g)<1e-28,
    'gtd_meets_change_guard':receipt['native_directional_derivative']>-receipt['tolerance_change'],
    'manual_bias_gradient_matches':abs(bias_gradient-g)<1e-14,
    'manual_loss_matches':abs(loss-receipt['loss_before'])<1e-14,
    'manual_l2re_matches':abs(l2re-independent['before']['l2re'])<1e-13,
    'manual_initial_family_matches':abs(init_rmse-independent['before']['constraint_families']['initial_value']['rmse'])<1e-14,
}
result={'scope':'readonly native receipts/source plus stdlib decoded 8-array/math verification; no new native run',
        'parameters':parameter_count,'arrays':shapes,'initialization_error':initialization_error,
        'actual_parameter_delta':parameter_delta,'manual_bias_gradient':bias_gradient,
        'manual_loss':loss,'manual_initial_rmse':init_rmse,'manual_full_grid_l2re':l2re,
        'checks':checks,'all_checks_passed':all(checks.values()),
        'conclusion':'optimizer_stalled is consistent; native n_iter/t do not certify an accepted update',
        'limits':['constructed nonregistered initialization','not candidate quality','not R9 calibration',
                  'native execution itself was the main agent run, not repeated by this reviewer']}
save(DEST/'reviewer-arithmetic.json',result)
print(json.dumps(result,ensure_ascii=False,indent=2))
if not result['all_checks_passed']:raise SystemExit(1)
