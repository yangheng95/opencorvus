import base64
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

root=Path(__file__).resolve().parent
out=root/'post-delivery-native-source-path'
out.mkdir()
fixture=json.loads((root/'frozen/workflow-cases.json').read_text(encoding='utf-8'))['bundle'][0]
work=out/'inputs';work.mkdir()
manifest=[];proof=[]
for row in fixture['entries']:
    source=work/row['source'];source.parent.mkdir(parents=True,exist_ok=True)
    raw=base64.b64decode(row['base64']);source.write_bytes(raw)
    native=row['source'].replace('/', '\\')
    manifest.append(dict(source=native,target=row['target']))
    actual=(work/native).read_bytes()
    proof.append(dict(source=native,resolved=str((work/native).resolve()),source_bytes_match=actual==raw))
(work/'manifest.json').write_text(json.dumps(dict(files=manifest),ensure_ascii=False),encoding='utf-8')
registration=dict(registeredAt=datetime.now(timezone.utc).isoformat(),type='post-delivery contract probe, not original pool or new model trial',reason='Only ZIP target paths were specified as forward-slash; source paths are native relative filesystem paths under declared Windows runtime',source_proof=proof,expected_native=0)
(out/'registration.json').write_text(json.dumps(registration,ensure_ascii=False,indent=2),encoding='utf-8')
assert all(row['source_bytes_match'] for row in proof)
expected={r['target']:r['base64'] for r in fixture['entries']}
expected_index=dict(files=[dict(path=n,bytes=len(base64.b64decode(b))) for n,b in sorted(expected.items())])
results=[]
for label,source in [('original-delivered',root/'after/bundle-delivered/deliverable.pyz'),('pre-model-correct-witness',root/'workflow-checker-validation-v2/bundle-correct/deliverable.pyz')]:
    app=out/(label+'.pyz');shutil.copy2(source,app)
    target=out/(label+'.zip')
    argv=[sys.executable,'-I',str(app),str(work),'--output',str(target)]
    done=subprocess.run(argv,cwd=out,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=30)
    row=dict(label=label,argv=argv,cwd=str(out),exit=done.returncode,stdout=done.stdout,stderr=done.stderr,expected=dict(payload=expected,index=expected_index))
    if done.returncode==0:
        with zipfile.ZipFile(target) as z:
            actual={n:base64.b64encode(z.read(n)).decode() for n in z.namelist() if not n.endswith('/') and n!='_bundle_index.json'}
            index=json.loads(z.read('_bundle_index.json'))
            row['actual']=dict(payload=actual,index=index)
            row['passed']=actual==expected and index==expected_index
    else:row['passed']=False
    results.append(row)
(out/'assessment.json').write_text(json.dumps(dict(registration=registration,results=results),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([dict(label=r['label'],exit=r['exit'],passed=r['passed'],stderr=r['stderr']) for r in results],ensure_ascii=False,indent=2))
