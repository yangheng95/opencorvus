"""Protocol mutation on an owned copy; no candidate/native process is run."""
from pathlib import Path
import json,shutil,csv,subprocess,time
R=Path(__file__).parent;X=Path('D:/opencorvus-benchmark-runs/l10-full-case-20261031');src=R/'cold-run';out=R/'missing-dispatch-column-mutation';out.mkdir()
for name in ('runs.json','execution-status.json'):shutil.copy2(src/name,out/name)
for name in ('sealed-program','prepare','delivery'):shutil.copytree(src/name,out/name)
path=out/'delivery/result/dispatch.csv'
with path.open(encoding='utf-8',newline='') as f:rr=list(csv.DictReader(f))
fields=[k for k in rr[0] if k!='step']
with path.open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows(rr)
(R/'missing-dispatch-runs.json').write_text(json.dumps({'base':str(out.resolve())}))
(R/'missing-dispatch-keys.json').write_text(json.dumps({'base':str(X/'reference-base-final.json')}))
argv=['C:/Python314/python.exe','-X','utf8','-B',str(R/'checker-initial/check_l10.py'),'grade','--runs',str(R/'missing-dispatch-runs.json'),'--keys',str(R/'missing-dispatch-keys.json'),'--rubric',str(R/'checker-initial/rubric.json'),'--role','error_control','--out',str(R/'missing-dispatch-assessment.json')]
start=time.monotonic();p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');receipt=dict(argv=argv,exit_code=p.returncode,seconds=time.monotonic()-start,stdout=p.stdout,stderr=p.stderr,scope='Private output-only protocol mutation of cold-run delivery. Original recorded episode/source paths remain original, so moved-copy mount-binding warnings are not candidate evidence. No new native.')
(R/'missing-dispatch-command.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt,indent=2))
