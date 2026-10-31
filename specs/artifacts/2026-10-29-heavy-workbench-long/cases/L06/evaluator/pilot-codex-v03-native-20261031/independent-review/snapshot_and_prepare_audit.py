from pathlib import Path
import json,shutil,subprocess,datetime,zipfile
R=Path('D:/opencorvus-benchmark-runs/l06-v03-codex-fresh-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v03-codex-fresh-native-20261031');A=X/'evaluation/assignment';D=A/'closed/delivery';C=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06/evaluator/upgrade-v0.3')
(R/'git-status-start.txt').write_text(subprocess.run(['git','status','--short'],cwd='D:/myhexin-local/opencorvus',capture_output=True,text=True).stdout)
for name in ['assignment.json','review-template.json','rubric.json','delivery-layout.json']:shutil.copy2(A/name,R/name)
for name in ['REPORT.md','HANDOFF.md','README.md','source-map.json','reproduce.ps1','requirements-lock.txt','submission.json']:
 p=R/'candidate-text-snapshot'/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(D/name,p)
for folder in ['source','programme']:shutil.copytree(D/folder,R/'candidate-text-snapshot'/folder)
shutil.copy2(C/'check_whole.py',R/'actual-layout-check_whole.py')
for f in ['public-scope-observation.json','prepare-command.json','private-run-command.json','delivery-layout.json']:
 p=R/'evaluation-records'/f;p.parent.mkdir(exist_ok=True);shutil.copy2(X/'evaluation'/f,p)
with zipfile.ZipFile(X/'evaluation/complete-workspace.zip') as z:
 names=z.namelist();(R/'workspace-capsule-member-index.json').write_text(json.dumps({'count':len(names),'first20':names[:20],'bytes':(X/'evaluation/complete-workspace.zip').stat().st_size},indent=2));print('ZIP first names',names[:12])
# Reuse only my own independent CSV/Fraction/SQL audit equations, never candidate or author functions.
source=Path('D:/opencorvus-benchmark-runs/l06-v03-whole-case-independent-review-20261031/audit_whole.py').read_text(encoding='utf-8-sig')
source=source.replace('l06-v03-whole-case-independent-review-20261031','l06-v03-codex-fresh-independent-review-20261031').replace('l06-v03-whole-case-20261031','l06-v03-codex-fresh-native-20261031').replace("A=X/'assessment-reference/closed'","A=X/'evaluation/assignment/closed'").replace("D/'weekly-ledger.csv'","D/'outputs/weekly-ledger.csv'").replace("D/'summary.json'","D/'outputs/summary.json'")
source=source.replace('print(json.dumps(result,indent=2))',"print(json.dumps({'failures':result['failures'],'expected_cost_exact':result['expected_cost_exact'],'components_exact':result['components_exact'],'information_nodes':result['information_nodes'],'paths':result['paths']},indent=2))")
(R/'audit_candidate_raw_sql.py').write_text(source,encoding='utf-8')
print('Snapshot and independent audit script ready',datetime.datetime.now(datetime.timezone.utc).isoformat())
