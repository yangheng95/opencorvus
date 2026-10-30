from pathlib import Path
from datetime import datetime,timezone
import shutil,json,subprocess,sys,time
R=Path('D:/opencorvus-benchmark-runs/L02-paired-20261030-cb3a704d/codex/evaluation');P=Path('D:/opencorvus-benchmark-runs/l02-codex-candidate-independent-review-20261031')
review=R/'original-independent-review';review.mkdir()
for n in ('assignment.zip','review.json'):shutil.copy2(P/n,review/n)
with (review/'assignment.zip').open('rb') as a,(R/'evaluation-assignment/assignment.zip').open('rb') as b:
 while True:
  x=a.read(1024*1024);y=b.read(1024*1024)
  if x!=y:raise ValueError('original_assignment_mismatch')
  if not x:break
command=[sys.executable,'-X','utf8','-B',str(R/'evaluator-source/l02_grade.py'),'grade','--assignment',str(R/'evaluation-assignment/assignment.zip'),'--run',str(R/'formal-run'),'--review',str(review),'--out',str(R/'final-assessment')]
started=datetime.now(timezone.utc).isoformat();clock=time.perf_counter()
with (R/'grade.stdout.txt').open('wb') as out,(R/'grade.stderr.txt').open('wb') as err:
 p=subprocess.Popen(command,cwd=R,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
 (R/'grade-started.json').write_text(json.dumps({'argv':command,'pid':p.pid,'started_at':started,'subject_role':'candidate','scope':'actual frozen l02_grade with original38 independent ratings plus real quality26; no new native/model calls'},indent=2),encoding='utf-8')
 code=p.wait()
(R/'grade-terminal.json').write_text(json.dumps({'argv':command,'pid':p.pid,'started_at':started,'finished_at':datetime.now(timezone.utc).isoformat(),'exit_code':code,'wall_seconds':time.perf_counter()-clock},indent=2),encoding='utf-8')
raise SystemExit(code)
