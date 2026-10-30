from pathlib import Path
import subprocess,json,shutil,time
R=Path(__file__).parent;X=Path('D:/opencorvus-benchmark-runs/l10-full-case-20261031');C=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L10')
S=R/'checker-initial';S.mkdir()
for name in ('check_l10.py','l10_core.py'):shutil.copy2(C/'evaluator'/name,S/name)
shutil.copy2(C/'rubric.json',S/'rubric.json')
roots=json.loads((X/'bad_shape-runs.json').read_text())
rv={'run_roots':roots,'ratings':{'M07':{'status':'pass','evidence':'Protocol-only malicious override of a machine financial failure; not a scientific review.'},**{f'H0{i}':{'status':'pass','evidence':'Synthetic protocol fixture, not actual content judgment.'} for i in range(1,6)}}}
(R/'review-override-protocol-fixture.json').write_text(json.dumps(rv),encoding='utf-8')
argv=['C:/Python314/python.exe','-X','utf8','-B',str(S/'check_l10.py'),'grade','--runs',str(X/'bad_shape-runs.json'),'--keys',str(X/'bad_shape-keys.json'),'--rubric',str(S/'rubric.json'),'--review',str(R/'review-override-protocol-fixture.json'),'--role','error_control','--out',str(R/'review-override-actual-assessment.json')]
st=time.monotonic();p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');(R/'review-override-command.json').write_text(json.dumps(dict(argv=argv,exit_code=p.returncode,seconds=time.monotonic()-st,stdout=p.stdout,stderr=p.stderr),indent=2));print((R/'review-override-command.json').read_text());print((R/'review-override-actual-assessment.json').read_text()[:1200])
