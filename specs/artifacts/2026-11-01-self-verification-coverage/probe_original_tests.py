"""Evaluate unmodified original model tests against one explicit semantic-fault copy."""
import json
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import zipapp

root=Path(__file__).resolve().parent;repo=Path('D:/myhexin-local/opencorvus')
project=root/'original-r06-sensitivity';project.mkdir()
original=Path('D:/opencorvus-benchmark-runs/contract-domain-repair-e2e-20261101/live/bundle-delivered')
source=(original/'main.py').read_text(encoding='utf-8')
needle='    parts = value.split("/") if target else Path(value).parts\n'
assert source.count(needle)==1
broken=source.replace(needle,'    if not target and "\\\\" in value:\n        raise ValueError("evaluation-only source-domain regression")\n'+needle)
code=project/'evaluation-copy';code.mkdir();(code/'__main__.py').write_text(broken,encoding='utf-8')
zipapp.create_archive(code,project/'deliverable.pyz')
shutil.copyfile(original/'test_delivery.py',project/'test_delivery.py')
shutil.copyfile(project/'deliverable.pyz',project/'.review-delivered.pyz')
facts=json.loads((root/'original-r06-observable-facts.json').read_text(encoding='utf-8'))
review=next(p for p in facts['tools'] if p['id']=='prt_g0VZjIfIM00MQTO6JHZR')
review_argv=shlex.split(review['input']['command'])
assert review_argv[:3]==['python','-B','-c'] and len(review_argv)==4
runs=[]
for name,argv in [('owner-positive-original',[sys.executable,'-B','-m','unittest','-v','test_delivery.DeliveryTests.test_exact_bytes_names_order_and_standalone_execution']),('reviewer-original',[sys.executable,*review_argv[1:]])]:
    p=subprocess.run(argv,cwd=project,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=45)
    runs.append(dict(name=name,argv=argv,cwd=str(project),exit=p.returncode,stdout=p.stdout,stderr=p.stderr))
sys.path.insert(0,str(repo/'script/benchmark'))
from delivery_workflow_cases import grade
external=grade('bundle',project,project/'external-consumer')
result=dict(originalSourceUnchanged=True,originalTestBytesEqual=(project/'test_delivery.py').read_bytes()==(original/'test_delivery.py').read_bytes(),fault='reject every native backslash source while preserving other roles and effects',originalModelTests=runs,external=external,scope='external sensitivity experiment using original model-authored tests; not a new model run or evidence that the model originally ran this regression')
(project/'sensitivity.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(originalTests=[dict(name=r['name'],exit=r['exit']) for r in runs],external=[dict(name=r['name'],exit=r.get('exit'),passed=r['passed']) for r in external['results']]),indent=2))
