"""Consume unchanged sealed source in fresh source-only directories, once each."""
from pathlib import Path
from datetime import datetime, timezone
import json, zipfile, subprocess, os
R=Path(__file__).parent
PY=R/'runtime/Scripts/python.exe'
def now(): return datetime.now(timezone.utc).isoformat()
def save(p,v): p.write_text(json.dumps(v,indent=2,default=str)+'\n',encoding='utf-8')
records=[]
for name in ('codex','opencorvus'):
    base=R/name; sealed=base/'sealed'; dest=R/'source-reproduction'/name
    source=dest/'source'; source.mkdir(parents=True,exist_ok=False)
    names=subprocess.check_output(['git','-C',str(base/'project'),'ls-files','-z']).decode('utf-8').split('\0')
    excluded=[]; extracted=[]
    with zipfile.ZipFile(sealed/'complete-project.zip') as z:
        for member in names:
            if not member: continue
            if member.startswith('validation/evidence/') or member in ('specs/artifacts/safe-import/evidence.json','specs/artifacts/safe-import/regression.txt'):
                excluded.append(member);continue
            p=source/member
            if not p.resolve().is_relative_to(source.resolve()):raise ValueError(member)
            p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(member));extracted.append(member)
    save(dest/'source-extraction.json',dict(registered_at=now(),source_archive=str(sealed/'complete-project.zip'),members=extracted,excluded_generated_evidence=excluded,scope='Unchanged original tracked source/docs/tests/public; no generated databases, cached results, private checker or source patches supplied. Declared generic dependency runtime reused; not cold OS.'))
    out=R/'candidate-consumption'/name
    out.parent.mkdir(exist_ok=True)
    log=dest/'consumer.stdout.log'; err=dest/'consumer.stderr.log'
    argv=[str(PY),'-X','utf8','-B',str(R/'consume_native.py'),'--source',str(source),'--output',str(out)]
    start=now()
    with log.open('wb') as stdout,err.open('wb') as stderr:
        child=subprocess.run(argv,cwd=R,stdout=stdout,stderr=stderr)
    record=dict(candidate=name,argv=argv,started_at=start,ended_at=now(),native_exit=child.returncode,stdout=str(log),stderr=str(err),assessment=str(out/'assessment.json'))
    save(dest/'execution.json',record);records.append(record)
    print(json.dumps(record),flush=True)
save(R/'candidate-consumption'/'executions.json',records)
