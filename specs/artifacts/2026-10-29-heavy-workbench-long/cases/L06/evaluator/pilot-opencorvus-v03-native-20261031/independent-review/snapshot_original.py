from pathlib import Path
import json,shutil,zipfile,subprocess,datetime
R=Path('D:/opencorvus-benchmark-runs/l06-v03-opencorvus-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v03-opencorvus-native-20261031');A=X/'evaluation/assignment';D=A/'closed/delivery'
(R/'git-status-start.txt').write_text(subprocess.run(['git','status','--short'],cwd='D:/myhexin-local/opencorvus',capture_output=True,text=True).stdout)
for name in ['assignment.json','review-template.json','rubric.json','delivery-layout.json']:shutil.copy2(A/name,R/name)
for name in ['REPORT.md','HANDOFF.md','requirements-lock.txt','requirements.txt']:
 p=R/'candidate-source-snapshot'/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(D/name,p)
for folder in ['tools','actor']:
 for f in (D/folder).glob('*'):
  if f.is_file():
   p=R/'candidate-source-snapshot'/folder/f.name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,p)
for f in ['REPORT.md','checker-attempts.json','auxiliary-correction.json','independent-check.json','protocol-probes.json']:
 p=R/'candidate-own-review-snapshot'/f;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(D/'review'/f,p)
with zipfile.ZipFile(X/'evaluation/complete-workspace.zip') as z:
 names=z.namelist();r={'members':len(names),'bytes':(X/'evaluation/complete-workspace.zip').stat().st_size,'first12':names[:12]};(R/'workspace-index-observation.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
print('snapshot-at',datetime.datetime.now(datetime.timezone.utc).isoformat())
