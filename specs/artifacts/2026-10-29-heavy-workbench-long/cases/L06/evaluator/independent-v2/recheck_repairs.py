"""Only the two repaired CLI cases and final source identity/diffs; no solver."""
import ast
import difflib
import json
from pathlib import Path
import shutil
import sys
sys.dont_write_bytecode=True
from prepare_and_replay import ROOT,SRC,SNAP,command,save,load

DEST=ROOT/'source-repaired';DEST.mkdir(exist_ok=False)
inventory=[]
for name in ('l06_input.py','check_l06.py','qualify_l06.py','qualify_business_checks.py','qualify_full_business_checks.py'):
    shutil.copy2(SRC/name,DEST/name)
    inventory.append({'source':str(SRC/name),'copy':str((DEST/name).relative_to(ROOT)),
        'byte_equal_at_copy':(SRC/name).read_bytes()==(DEST/name).read_bytes()})
for relative in ('v2/tiny-solver/executed-source.py','v2/cheap-necessary-cuts.json','v2/full-business-contracts-final/receipt.json'):
    to=ROOT/'supplementary-final'/relative;to.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(SRC/relative,to)
    inventory.append({'source':str(SRC/relative),'copy':str(to.relative_to(ROOT)),
        'byte_equal_at_copy':(SRC/relative).read_bytes()==to.read_bytes()})
save(ROOT/'repair-source-inventory.json',inventory)

def segment(path,name):
    text=path.read_text(encoding='utf-8');tree=ast.parse(text)
    node=next(n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name==name)
    return ast.get_source_segment(text,node)

identities={
    'business_evaluate_function_text_equal':segment(SNAP/'v2/check_l06.py','evaluate')==segment(DEST/'check_l06.py','evaluate'),
    'instance_validator_function_text_equal':segment(SNAP/'v2/l06_input.py','validate_instance')==segment(DEST/'l06_input.py','validate_instance'),
    'model_solve_function_text_equal':segment(SNAP/'v2/qualify_l06.py','solve')==segment(DEST/'qualify_l06.py','solve')}
for name in ('l06_input.py','check_l06.py','qualify_l06.py'):
    old=(SNAP/'v2'/name).read_text(encoding='utf-8').splitlines()
    new=(DEST/name).read_text(encoding='utf-8').splitlines()
    difference='\n'.join(difflib.unified_diff(old,new,fromfile='initial-v2/'+name,tofile='final/'+name,n=3))
    (ROOT/(name+'.repair.diff')).write_text(difference+'\n',encoding='utf-8')

def strict(text):
    def reject(value):raise ValueError('nonfinite '+value)
    return json.loads(text,parse_constant=reject)

results=[]
for label,expected in [('overflow-exponent-format','plan_json'),('invalid-instance-plus-bad-plan','instance_invalid')]:
    original=ROOT/'independent-boundaries'/label
    out=ROOT/'repaired-replay'/label/'result.json'
    receipt=command([sys.executable,'-B',str(DEST/'check_l06.py'),'--input',str(original/'input.json'),
        '--plan',str(original/'plan.json'),'--out',str(out)],'repaired-'+label)
    result=strict(out.read_text(encoding='utf-8'))
    stdout=strict((ROOT/receipt['stdout']).read_text(encoding='utf-8'))
    results.append({'case':label,'expected':expected,'actual':result['error'],'exit_code':receipt['exit_code'],
        'strict_result_and_stdout_json':True,'passed':receipt['exit_code']==2 and result['error']==expected and stdout==result,
        'result':result,'receipt':receipt})
result={'scope':'two actual repaired CLI boundary cases plus explicit source identity; no new math/solver execution',
    'source_identity_only_not_functional_proof':identities,'cases':results,'all_repaired_cases_passed':all(r['passed'] for r in results),
    'original_failure_commands_and_results_preserved':True,
    'main_final22_receipt_read_not_repeated':{k:v for k,v in load(ROOT/'supplementary-final/v2/full-business-contracts-final/receipt.json').items() if k!='executions'},
    'freeze_approved':False,'cost_1percent_approved':False,'hours_validated':False}
save(ROOT/'repair-assessment.json',result)
print(json.dumps(result,ensure_ascii=False,indent=2))
