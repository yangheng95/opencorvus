from pathlib import Path
import json,shutil,datetime
R=Path('D:/opencorvus-benchmark-runs/l06-v04-opencorvus-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-opencorvus-native-20261031');D=X/'project/submission'
base=Path('D:/opencorvus-benchmark-runs/l06-v04-codex-fresh-independent-review-20261031/independent_raw_definitions.py').read_text(encoding='utf-8-sig');lines=base.splitlines(True);lines[4]="R=Path('"+R.as_posix()+"');X=Path('"+X.as_posix()+"');read="+lines[4].split(';read=',1)[1];(R/'independent_raw_definitions.py').write_text(''.join(lines),encoding='utf-8')
for f in ['report.md','OPERATOR-HANDOFF.txt','solver.py','verify_certificates.py','rebuild.py','run_native.py','prepare_inputs.py','make_report.py','bundle_source.py','requirements-lock.txt','requirements.txt','source.zip','certificate-verification.json','final-capsule-certificate-verification.json','final-capsule-actor-verification.json','execution-public-copy-record.json']:
 p=D/f
 if p.is_file():dst=R/'original-submission'/f;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dst)
for p in (D/'actor').rglob('*'):
 if p.is_file():dst=R/'original-submission'/p.relative_to(D);dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dst)
for f in ['assignment.json','review-template.json','rubric.json']:
 shutil.copy2(X/'evaluation/assessment'/f,R/('original-'+f))
for f in ['actual-execution-command.json','actual-prepare-command.json','complete-workspace-receipt.json','private-execution-registration.json','delivery-layout.json']:
 p=X/'evaluation'/f
 if p.exists():shutil.copy2(p,R/('original-'+f))
print(json.dumps({'snapshot_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'review_root':str(R),'new_actor_or_solver_runs':0}))
