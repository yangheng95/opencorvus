"""One post-terminal original-object seal and existing grader prepare invocation."""
from pathlib import Path
from datetime import datetime,timezone
import json,sqlite3,subprocess,sys,time,zipfile,shutil
R=Path('D:/opencorvus-benchmark-runs/L02-paired-20261030-cb3a704d/codex/evaluation')
REPO=Path('D:/myhexin-local/opencorvus');CASE='specs/artifacts/2026-10-29-heavy-workbench-long/cases/L02/'
if '--after-owned-launcher' in sys.argv and not (R/'owner-terminal.json').exists():
 # Wait on the already-owned real process, not a timer or a replacement matrix.
 command='$benchOwner = Get-CimInstance Win32_Process -Filter "ProcessId = 64636"; if ($benchOwner -and ($benchOwner.CommandLine -like "*L02-paired-20261030-cb3a704d*evaluation*owner.py*")) { Wait-Process -Id 64636 -ErrorAction SilentlyContinue }'
 waited=subprocess.run(['powershell','-NoProfile','-Command',command],capture_output=True,text=True)
 (R/'post-terminal-wait-receipt.json').write_text(json.dumps({'owned_pid':64636,'wait_exit':waited.returncode,'stdout':waited.stdout,'stderr':waited.stderr,'scope':'OS process completion wait on original evaluation owner only; no sleep, native restart or model calls'},indent=2),encoding='utf-8')
terminal=json.loads((R/'owner-terminal.json').read_text(encoding='utf-8'))
run=R/'formal-run';db=sqlite3.connect(run.as_uri()+'/runs.sqlite3?mode=ro',uri=True);db.row_factory=sqlite3.Row
cells=[dict(x) for x in db.execute('select * from cell order by id')];db.close()
if any(x['phase'] in ('created','running','started') for x in cells):raise ValueError('physical_work_unsettled')
# Use the existing public assignment primitive and the original sealed pool/grid.
import csv,io
from types import SimpleNamespace
sys.path.insert(0,str(R/'evaluator-source'))
from l02_study_data import numeric_assignment,validate_pool
with zipfile.ZipFile(run/'registration.zip') as z:
 reg=json.loads(z.read('registration.json'));manifest=json.loads(z.read('submission/submission.json'))
 grid={'origins':list(csv.DictReader(io.StringIO(z.read('raw/origins.csv').decode('utf-8'))))}
 pool,_=validate_pool(manifest['pool'])
expected=[*numeric_assignment(SimpleNamespace(grid=grid),pool,reg['outer_ids']),{'kind':'report'}]
key=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'))
expected_keys={key(x) for x in expected};actual_keys=[key(json.loads(x['identity'])) for x in cells]
if terminal['exit_code']==0 and (len(actual_keys)!=len(expected_keys) or set(actual_keys)!=expected_keys or any(x['phase']!='verified' for x in cells)):raise ValueError('success_receipt_disagrees_with_registered_assignment')
(R/'registered-matrix-seal-check.json').write_text(json.dumps({'expected_cells':len(expected),'observed_cells':len(cells),'selection_ids':pool['selection_ids'],'source':'original registration.zip pool/origins/outer_ids plus unchanged numeric_assignment primitive; zero native reexecution'},indent=2),encoding='utf-8')
completed=R/'completed';completed.mkdir();native=[];counts={};report=None
for cell in cells:
 identity=json.loads(cell['identity']);counts[identity['kind']]=counts.get(identity['kind'],0)+1
 if cell['phase']!='verified':continue
 with zipfile.ZipFile(run/'cells'/str(cell['id'])/'accepted.zip') as z:
  obj=json.loads(z.read('terminal-inspect.json'))
  if obj['Id']!=cell['cid'] or obj['State']['Status']!='exited' or obj['State']['ExitCode']!=0:raise ValueError('verified_native_mismatch')
  native.append({'id':cell['id'],'identity':identity,'cid':obj['Id'],'started_at':obj['State']['StartedAt'],'finished_at':obj['State']['FinishedAt'],'exit_code':obj['State']['ExitCode']})
  if identity=={'kind':'report'}:
   report=completed/'report';report.mkdir()
   for name in z.namelist():
    if name.startswith('output/result/'):
     p=report/name[len('output/result/'):]
     if not p.resolve().is_relative_to(report.resolve()):raise ValueError('report_path')
     p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(name))
archive=completed/'execution-originals.zip'
with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED) as z:
 for p in run.rglob('*'):
  if p.is_file() and 'work' not in p.relative_to(run).parts and not any(x.startswith('materialize-') for x in p.relative_to(run).parts):z.write(p,'formal-run/'+p.relative_to(run).as_posix())
 for name in ('launch.json','owner.py','owner-started.json','owner-terminal.json','owner.stdout.txt','owner.stderr.txt','material-contract.json','study-contract.json'):z.write(R/name,name)
 for folder,prefix in ((R/'evaluator-source','evaluator-source'),(R.parent/'completed/submission','candidate-submission')):
  for p in folder.rglob('*'):
   if p.is_file():z.write(p,prefix+'/'+p.relative_to(folder).as_posix())
(completed/'seal-assessment.json').write_text(json.dumps({'sealed_at':datetime.now(timezone.utc).isoformat(),'role':'candidate_evaluation','owner_terminal':terminal,'counts':counts,'native_verified':native,'archive_bytes':archive.stat().st_size,'report':str(report) if report else None,'scope':'complete original registration/SQL/cells/native/source/output; mutable work duplicates omitted; no candidate score or effective-hour claim'},indent=2),encoding='utf-8')
authority=R/'evaluation-authority';authority.mkdir();git='441aa82c9f6afeb3bd97e7ef024a164e8a01a5e2'
for n,relative in [('rubric.json','rubric.json'),('quality-policy.json','public/quality-policy.json')]:
 (authority/n).write_bytes(subprocess.check_output(['git','show',git+':'+CASE+relative],cwd=REPO))
shutil.copy2('D:/opencorvus-benchmark-runs/l02-public-contract-registration-20261030/final-publication/registered-reference/registered-reference.zip',authority/'reference.zip')
shutil.copy2('D:/opencorvus-benchmark-runs/l02-source-bound-grade-qualification-20261030/reference-method.json',authority/'reference-method.json')
with zipfile.ZipFile(authority/'reference.zip') as z:
 if json.loads(z.read('fixed-reference-method.json'))!=json.loads((authority/'reference-method.json').read_text(encoding='utf-8')):raise ValueError('registered_reference_method_identity')
command=[sys.executable,'-X','utf8','-B',str(R/'evaluator-source/l02_grade.py'),'prepare','--run',str(run),'--candidate-root',str(R.parent/'completed/submission'),'--rubric',str(authority/'rubric.json'),'--quality-policy',str(authority/'quality-policy.json'),'--reference',str(authority/'reference.zip'),'--reference-method',str(authority/'reference-method.json'),'--submission-id','Codex-L02-ee1ab32a6819-20261031','--reviewer-id','/root/benchmark_review','--subject-role','candidate','--out',str(R/'evaluation-assignment')]
started=datetime.now(timezone.utc).isoformat();clock=time.perf_counter()
with (R/'evaluation-prepare.stdout.txt').open('wb') as out,(R/'evaluation-prepare.stderr.txt').open('wb') as err:
 p=subprocess.Popen(command,cwd=R,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
 (R/'evaluation-prepare-started.json').write_text(json.dumps({'argv':command,'pid':p.pid,'started_at':started,'scope':'unique existing reader/grader immutable assignment preparation; zero new forecast/report/native model executions'},indent=2),encoding='utf-8')
 code=p.wait()
(R/'evaluation-prepare-terminal.json').write_text(json.dumps({'argv':command,'pid':p.pid,'started_at':started,'finished_at':datetime.now(timezone.utc).isoformat(),'exit_code':code,'wall_seconds':time.perf_counter()-clock},indent=2),encoding='utf-8')
raise SystemExit(code)
