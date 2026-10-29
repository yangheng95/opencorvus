import datetime
import json
from pathlib import Path
import subprocess
import time

root=Path(__file__).resolve().parent
repo=Path(r'D:/myhexin-local/opencorvus')
bun=Path(r'C:/Users/hengu/.bun/bin/bun.exe')
targets=['script/benchmark/heavy-workbench-registration.ts','script/benchmark/heavy-workbench-registration.test.ts','script/benchmark/serve_heavy_workbench.ts']
checks=[
 ('focused-tests',[str(bun),'test',str(repo/targets[1])],root),
 ('pure-metadata-probe',[str(bun),str(root/'metadata-probe.ts')],root),
 ('targeted-strict-null-types',[str(bun),str(repo/'node_modules/typescript/bin/tsc'),'--noEmit','--skipLibCheck','--strictNullChecks','--target','ESNext','--module','ESNext','--moduleResolution','bundler','--allowImportingTsExtensions','--typeRoots','packages/opencorvus/node_modules/@types','--types','bun',*targets],repo),
 ('targeted-prettier',[str(bun),str(repo/'node_modules/prettier/bin/prettier.cjs'),'--check',*targets],repo),
]
receipts=[]
for label,command,cwd in checks:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();before=time.perf_counter()
 run=subprocess.run(command,cwd=cwd,capture_output=True,text=True,encoding='utf-8',errors='replace')
 (root/f'{label}.stdout.txt').write_text(run.stdout,encoding='utf-8')
 (root/f'{label}.stderr.txt').write_text(run.stderr,encoding='utf-8')
 row={'label':label,'started_at_utc':start,'elapsed_seconds':time.perf_counter()-before,'command_argv':command,'cwd':str(cwd),'exit_code':run.returncode,'stdout':f'{label}.stdout.txt','stderr':f'{label}.stderr.txt','scope':'read-only focused non-UI checks; no launcher/service/model or credentials'}
 (root/f'{label}.json').write_text(json.dumps(row,indent=2)+'\n',encoding='utf-8')
 receipts.append(row);print(json.dumps(row));print(run.stdout);print(run.stderr)
manifest=json.loads((root/'source-manifest.json').read_text())
identity=[]
for row in manifest['files']:
 identity.append({'source':row['source'],'same_bytes_after_checks':Path(row['source']).read_bytes()==(root/row['snapshot']).read_bytes()})
(root/'source-identity-after-checks.json').write_text(json.dumps(identity,indent=2)+'\n',encoding='utf-8')
(root/'executions.json').write_text(json.dumps(receipts,indent=2)+'\n',encoding='utf-8')
raise SystemExit(0 if all(x['exit_code']==0 for x in receipts) else 1)
