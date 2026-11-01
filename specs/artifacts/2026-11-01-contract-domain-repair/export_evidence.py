"""Read completed, sealed runs; export evidence without credentials or new executions."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import zipfile

root = Path(__file__).resolve().parent
repo = Path('D:/myhexin-local/opencorvus')
dest = repo/'specs/artifacts/2026-11-01-contract-domain-repair'
observed = json.loads((root/'observed-runs.json').read_text(encoding='utf-8'))
live = root/'live'
db = sqlite3.connect('file:'+str(live/'storage/opencorvus.db')+'?mode=ro', uri=True)
canonical = []
archives = []
for run_id, kind in [('R06','bundle'),('R07','download'),('R08','temperature')]:
    trace = json.loads((live/(kind+'-trace.json')).read_text(encoding='utf-8'))
    sessions = [s['id'] for s in trace.get('sessions',[])]
    if not sessions:
        sessions = sorted({m['info']['sessionID'] for m in trace['messages']})
    placeholders = ','.join('?' for _ in sessions)
    rows = db.execute('SELECT r.id,r.message_id,m.session_id,r.data,r.time_created,o.id,o.data,o.time_created FROM tool_part_request r JOIN message m ON m.id=r.message_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id IN ('+placeholders+') ORDER BY r.time_created,r.id',sessions).fetchall()
    facts = [dict(requestID=r[0],messageID=r[1],sessionID=r[2],request=json.loads(r[3]),requestedAt=r[4],outcomeID=r[5],outcome=json.loads(r[6]) if r[6] else None,settledAt=r[7]) for r in rows]
    states = Counter(f['outcome']['outcome'] if f['outcome'] else 'pending' for f in facts)
    canonical.append(dict(run=run_id,sessions=sessions,requests=len(facts),outcomes=sum(f['outcome'] is not None for f in facts),states=dict(states)))
    out = dest/'runs'/run_id
    out.mkdir(parents=True,exist_ok=True)
    (out/'canonical-tools.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2),encoding='utf-8')
    shutil.copytree(live/(kind+'-consumer'),out/'initial-consumer',dirs_exist_ok=True)
    project = live/(kind+'-delivered')
    selected = []
    for p in project.rglob('*'):
        rel = p.relative_to(project)
        if p.is_file() and not any(x in {'.git','.opencorvus','.ruff_cache','__pycache__'} for x in rel.parts):
            selected.append(p)
            target = out/'source'/rel
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(p,target)
    git = {}
    for label,args in [('head',['rev-parse','HEAD']),('status',['status','--short']),('log',['log','-3','--format=%H %s'])]:
        result = subprocess.run(['git','-C',str(project),*args],capture_output=True,text=True,encoding='utf-8',errors='replace')
        git[label] = dict(argv=['git','-C',str(project),*args],exit=result.returncode,stdout=result.stdout,stderr=result.stderr)
    (out/'git-observation.json').write_text(json.dumps(git,ensure_ascii=False,indent=2),encoding='utf-8')
    zip_dir = root/'complete-project-archives'
    zip_dir.mkdir(exist_ok=True)
    archive = zip_dir/(run_id+'-project.zip')
    members = [p for p in project.rglob('*') if p.is_file()]
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for p in members:z.write(p,p.relative_to(project).as_posix())
    identity = dict(run=run_id,source=str(project),archive=str(archive),zipBytes=archive.stat().st_size,members=len(members),originalBytes=sum(p.stat().st_size for p in members),scope='complete previously sealed delivered-project copy including Git and published resources; runtime/auth/models and external original production DB are not project members')
    archives.append(identity)
    (out/'complete-project-location.json').write_text(json.dumps(identity,ensure_ascii=False,indent=2),encoding='utf-8')
    with zipfile.ZipFile(out/'source-and-program.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in selected:z.write(p,p.relative_to(project).as_posix())
db.close()
(root/'canonical-summary.json').write_text(json.dumps(canonical,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'complete-project-archives/receipt.json').write_text(json.dumps(archives,ensure_ascii=False,indent=2),encoding='utf-8')
for name in ['registration.json','live-native.json','observed-runs.json','observed-summary.json','canonical-summary.json','typed-json-before.json','typed-json-comparison.json','collect_observed.py','freeze_inputs.py','probe_typed_json.py','export_evidence.py','final-python-tests.stdout.log','final-python-tests.stderr.log','live.stdout.log','live.stderr.log']:
    shutil.copyfile(root/name,dest/name)
shutil.copyfile(live/'result.json',dest/'actual-provider-and-runtime-receipt.json')
for name in ['old-r04-expanded-consumer','correct-witness-expanded-consumer','domain-checker-validation','typed-wrong-programmes','bundle-final-consumer','frozen','original-tools']:
    shutil.copytree(root/name,dest/name,dirs_exist_ok=True)
with zipfile.ZipFile(dest/'original-traces.zip','w',zipfile.ZIP_DEFLATED) as z:
    for kind in ['bundle','download','temperature']:
        z.write(live/(kind+'-trace.json'),kind+'-trace.json')
for name in ['delivery_workflow_cases.py','delivery_domain_cases.py','delivery_verification_scope.py','test_delivery_workflow_cases.py','test_delivery_domain_cases.py','test_delivery_verification_scope.py']:
    target = dest/'final-consumer-implementation'/name
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(repo/'script/benchmark'/name,target)
all_files = [p for p in dest.rglob('*') if p.is_file()]
summary = dict(exportedAt=datetime.now(timezone.utc).isoformat(),originalRoot=str(root),repositoryProjection=str(dest),canonical=canonical,completeProjectArchives=archives,projectionMembers=len(all_files),projectionBytes=sum(p.stat().st_size for p in all_files),fullWorkspace=False,credentials='not included; staged auth/models retired by original runner',newExecutions=0)
(root/'export-receipt.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
(dest/'export-receipt.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
