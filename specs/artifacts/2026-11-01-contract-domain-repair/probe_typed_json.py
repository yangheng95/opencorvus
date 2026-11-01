import json
from pathlib import Path
import subprocess
import sys
import zipapp
import zipfile
root=Path(__file__).resolve().parent
old=Path('D:/opencorvus-benchmark-runs/outcome-quality-selection-e2e-20261101/workflow-checker-validation-v2')
checker=root/'frozen/implementation/script/benchmark/delivery_workflow_cases.py'
results=[]
for kind in ['bundle','stock']:
    with zipfile.ZipFile(old/(kind+'-correct')/'deliverable.pyz') as z:source=z.read('__main__.py').decode('utf-8')
    before,after=('bytes=len(raw)','bytes=(False if len(raw)==0 else len(raw))') if kind=='bundle' else ('result=dict(success=False','result=dict(success=0')
    assert source.count(before)==1
    source=source.replace(before,after)
    project=root/'typed-wrong-programmes'/kind;code=project/'source';code.mkdir(parents=True)
    (code/'__main__.py').write_text(source,encoding='utf-8');zipapp.create_archive(code,project/'deliverable.pyz')
    output=project/'before-consumer'
    done=subprocess.run([sys.executable,str(checker),'grade',kind,str(project),'--output',str(output)],capture_output=True,text=True,encoding='utf-8')
    report=json.loads((output/'grade.json').read_text(encoding='utf-8'))
    results.append(dict(kind=kind,exit=done.returncode,passed=report['passed'],result_file=str(output/'grade.json')))
(root/'typed-json-before.json').write_text(json.dumps(results,indent=2),encoding='utf-8');print(json.dumps(results,indent=2))
