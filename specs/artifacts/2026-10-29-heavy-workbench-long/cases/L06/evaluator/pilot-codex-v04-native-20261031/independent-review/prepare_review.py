from pathlib import Path
import json,shutil,datetime
R=Path('D:/opencorvus-benchmark-runs/l06-v04-codex-fresh-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-codex-fresh-native-20261031');old=Path('D:/opencorvus-benchmark-runs/l06-v04-whole-case-independent-review-20261031/audit_raw_SQL.py')
src=old.read_text(encoding='utf-8-sig').split("main= X/'native-whole-first'")[0].replace("D:/opencorvus-benchmark-runs/l06-v04-whole-case-independent-review-20261031",str(R)).replace("D:/opencorvus-benchmark-runs/l06-v04-full-case-20261031",str(X));(R/'independent_raw_definitions.py').write_text(src,encoding='utf-8')
for f in ['REPORT.md','HANDOFF.md','REVIEW-INDEX.md','REPRODUCE.ps1','DEPENDENCIES.txt','requirements-plot.txt','execution-index.json','recovery-index.json','FREEZE.json','source-archive.zip']:
 p=X/'submission'/f
 if p.is_file():dst=R/'original-submission'/f;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dst)
for folder in ['source','programme','runner']:
 for p in (X/'submission'/folder).rglob('*'):
  if p.is_file():dst=R/'original-submission'/p.relative_to(X/'submission');dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dst)
for f in ['assignment.json','review-template.json','rubric.json']:
 shutil.copy2(X/'evaluation/assessment'/f,R/('original-'+f))
for f in ['actual-execution-command.json','actual-prepare-command.json','complete-workspace-receipt.json','private-execution-registration.json','delivery-layout.json']:
 shutil.copy2(X/'evaluation'/f,R/('original-'+f))
print(json.dumps({'snapshot_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'review_root':str(R),'new_actor_or_solver_runs':0}))
