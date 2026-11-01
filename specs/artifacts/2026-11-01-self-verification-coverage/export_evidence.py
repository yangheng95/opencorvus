"""Project closed-run evidence; archive whole projects privately before read-only Git probes."""
from collections import Counter
from datetime import datetime,timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import zipfile

root=Path(__file__).resolve().parent;repo=Path('D:/myhexin-local/opencorvus');dest=repo/'specs/artifacts/2026-11-01-self-verification-coverage'
assessment=json.loads((root/'self-verification-assessment.json').read_text(encoding='utf-8'))
archives=[]
for row in assessment['runs']:
    run_id,phase,kind=row['id'],row['phase'],row['kind'];project=root/phase/(kind+'-delivered');out=dest/'runs'/run_id;out.mkdir(parents=True,exist_ok=True)
    members=[p for p in project.rglob('*') if p.is_file()]
    archive=root/'complete-project-archives'/(run_id+'-project.zip');archive.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for p in members:z.write(p,p.relative_to(project).as_posix())
    receipt=dict(run=run_id,source=str(project),archive=str(archive),zipBytes=archive.stat().st_size,members=len(members),originalBytes=sum(p.stat().st_size for p in members),scope='complete original delivered-project copy including Git and published resources, sealed before independent consumption; source credentials and external production DB are not project files')
    archives.append(receipt);(out/'complete-project-location.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
    selected=[]
    for p in members:
        rel=p.relative_to(project)
        if any(x in {'.git','.opencorvus','.ruff_cache','__pycache__'} for x in rel.parts):continue
        target=out/'source'/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target);selected.append(p)
    with zipfile.ZipFile(out/'source-and-program.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in selected:z.write(p,p.relative_to(project).as_posix())
    shutil.copytree(root/phase/(kind+'-consumer'),out/'external-consumer',dirs_exist_ok=True)
    for suffix,filename in [('canonical','canonical-tools.json'),('observable','tool-observations.json'),('messages','participant-messages.json')]:shutil.copyfile(root/(phase+'-'+kind+'-'+suffix+'.json'),out/filename)
    git={};env=os.environ.copy();env['GIT_OPTIONAL_LOCKS']='0'
    for label,args in [('head',['rev-parse','HEAD']),('status',['status','--short']),('log',['log','-3','--format=%H %s'])]:
        p=subprocess.run(['git','-C',str(project),*args],env=env,capture_output=True,text=True,encoding='utf-8',errors='replace');git[label]=dict(argv=['git','-C',str(project),*args],exit=p.returncode,stdout=p.stdout,stderr=p.stderr)
    (out/'git-observation.json').write_text(json.dumps(git,ensure_ascii=False,indent=2),encoding='utf-8')
for phase in ['before','after']:
    target=dest/phase;target.mkdir(exist_ok=True)
    for name in ['result.json','progress.json']:shutil.copyfile(root/phase/name,target/name)
    for name in ['stdout.log','stderr.log','native.json']:shutil.copyfile(root/(phase+('-' if name=='native.json' else '.')+name),target/name)
    with zipfile.ZipFile(target/'original-traces.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in (root/phase).glob('*-trace.json'):z.write(p,p.name)
    data=json.loads((root/phase/'result.json').read_text(encoding='utf-8'))
    states=Counter(r.get('response_reader',{}).get('state','unrecorded') for r in data['requests'])
    (target/'reader-settlement.json').write_text(json.dumps(dict(states=dict(states),scope='actual source-reader observations; HTTP200 alone is not settlement'),indent=2),encoding='utf-8')
for name in ['registration.json','after-registration.json','before-observed.json','after-observed.json','self-verification-assessment.json','original-r06-observable-facts.json','original-r06-self-verification.json','investigate.py','inspect_original.py','inspect_phase.py','extract_messages.py','collect_phase.py','write_measurement.py','freeze_inputs.py','freeze_after.py','run_phase.py','probe_original_tests.py','probe_before_tests.py','probe_after_tests.py','export_evidence.py','before-startup-failed-native.json','before-startup-failed.stdout.log','before-startup-failed.stderr.log']:
    shutil.copyfile(root/name,dest/name)
for name in ['frozen','consumer-validation','original-r06-sensitivity','before-test-sensitivity','after-test-sensitivity','before-startup-failed','failed-startup-summary-contract']:
    shutil.copytree(root/name,dest/name,dirs_exist_ok=True)
for name in ['delivery_selfcheck_cases.py','test_delivery_selfcheck_cases.py','test_delivery_trial_summary.py']:
    target=dest/'current-consumer-implementation'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(repo/'script/benchmark'/name,target)
projection=[p for p in dest.rglob('*') if p.is_file()]
receipt=dict(exportedAt=datetime.now(timezone.utc).isoformat(),originalRoot=str(root),completeProjectArchives=archives,projectionMembers=len(projection),projectionBytes=sum(p.stat().st_size for p in projection),fullWorkspace=False,credentials='excluded; live staged pairs already retired; source credential/model files never copied to this projection',productionDatabase='closed per-phase original backups remain external under before/storage and after/storage',modelCallsByExporter=0)
(root/'export-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8');(dest/'export-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in receipt.items() if k!='completeProjectArchives'},indent=2))
print(json.dumps(archives,ensure_ascii=True,indent=2))
