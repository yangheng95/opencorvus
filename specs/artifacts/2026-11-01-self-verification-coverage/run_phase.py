from datetime import datetime,timezone
import json
import os
from pathlib import Path
import subprocess
import sys

root=Path(__file__).resolve().parent;repo=Path('D:/myhexin-local/opencorvus');phase=sys.argv[1]
assert phase in ['before','after']
env=os.environ.copy()
source=Path('C:/Users/hengu/AppData/Local/opencorvus/data')
assert all((source/name).is_file() for name in ['auth.json','models.json'])
settings=dict(ALLOW_REAL_PROVIDER='1',AUTH_SOURCE=str(source/'auth.json'),MODEL='openai/gpt-6.1-sol',PHASE='selfcheck-'+phase,CASES=json.dumps([dict(kind='query-export',entry='task'),dict(kind='utc-ledger',entry='coding')]),OUTPUT=str(root/phase),PYTHON=sys.executable,MAX_REQUESTS='140')
if phase=='after':
    assert (root/'after-registration.json').is_file()
    settings['CASES']=json.dumps([dict(kind='query-export',entry='task'),dict(kind='utc-ledger',entry='coding'),dict(kind='bundle',entry='task')])
    settings['MAX_REQUESTS']='180'
for key,value in settings.items():env['DELIVERY_SCOPE_'+key]=value
env['PYTHONUTF8']='1'
env['PATH']='C:/Users/hengu/.bun/bin;'+env.get('PATH','')
started=datetime.now(timezone.utc).isoformat()
with (root/(phase+'.stdout.log')).open('wb') as out,(root/(phase+'.stderr.log')).open('wb') as err:
    p=subprocess.run(['C:/Users/hengu/.bun/bin/bun.exe','run','script/delivery-verification-scope-real.ts'],cwd=repo/'packages/opencorvus',env=env,stdout=out,stderr=err)
receipt=dict(phase=phase,startedAt=started,endedAt=datetime.now(timezone.utc).isoformat(),exit=p.returncode,command=['bun','run','script/delivery-verification-scope-real.ts'],maxActualRequests=int(settings['MAX_REQUESTS']),result=str(root/phase/'result.json'))
(root/(phase+'-native.json')).write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(receipt,indent=2));raise SystemExit(p.returncode)
