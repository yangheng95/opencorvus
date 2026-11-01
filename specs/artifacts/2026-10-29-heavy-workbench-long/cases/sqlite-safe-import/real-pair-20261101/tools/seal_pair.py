"""Retain each naturally terminal original before evaluating its software."""
from pathlib import Path
from datetime import datetime, timezone
import os, json, zipfile, hashlib, subprocess, sqlite3
R=Path(__file__).parent
def now(): return datetime.now(timezone.utc).isoformat()
def save(p,v): p.write_text(json.dumps(v,indent=2,default=str)+'\n',encoding='utf-8')
status=json.loads((R/'status-20261101T1205.json').read_text(encoding='utf-8'))
if status['lifecycleStatus']!='completed' or status['activity']['running']!=0:
    raise RuntimeError('Unique original OC Task not naturally terminal')
registration=json.loads((R/'pair-registration.json').read_text(encoding='utf-8'))
public_files=list((R/'frozen-public').glob('*'))
for candidate in ('codex','opencorvus'):
    base=R/candidate; project=base/'project'; dest=base/'sealed'
    dest.mkdir(exist_ok=False)
    terminal=dict(candidate=candidate,natural_terminal=True,observed_at=now(),source='collaboration.list_agents completed + original final answer' if candidate=='codex' else str(R/'status-20261101T1205.json'),owned_children_settled='Candidate final states all owned processes finished' if candidate=='codex' else 'Native Task terminal/all occurrence inactive; Inspect observer native0; no task command processes in owned-path process snapshot')
    save(dest/'terminal.json',terminal)
    manifest=[]; links=[]; archive=dest/'complete-project.zip'
    started=now()
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for directory,dirs,names in os.walk(project,followlinks=False):
            directory=Path(directory)
            for name in list(dirs):
                p=directory/name
                if p.is_symlink() or p.is_junction():
                    links.append(dict(path=p.relative_to(project).as_posix(),target=os.readlink(p)))
                    dirs.remove(name)
            for name in sorted(names):
                p=directory/name; member=p.relative_to(project).as_posix()
                if p.is_symlink():
                    links.append(dict(path=member,target=os.readlink(p)));continue
                before=p.stat(); data=p.read_bytes(); after=p.stat()
                if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):
                    raise RuntimeError('Original changed during retention:'+member)
                z.writestr(member,data)
                manifest.append(dict(path=member,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
        z.writestr('ARCHIVE-EXTERNAL-LINKS.json',json.dumps(links,indent=2))
    git={}
    for label,args in [('head',['rev-parse','HEAD']),('status',['status','--short']),('log',['log','-5','--format=%H %s']),('diff',['diff','--stat'])]:
        p=subprocess.run(['git','-C',str(project),*args],capture_output=True)
        (dest/(label+'.stdout.log')).write_bytes(p.stdout);(dest/(label+'.stderr.log')).write_bytes(p.stderr)
        git[label]=dict(native_exit=p.returncode,value=p.stdout.decode('utf-8',errors='replace'))
    identity=[]
    for p in public_files:
        actual=project/'public'/p.name
        identity.append(dict(name=p.name,immutable_public_bytes_same=actual.is_file() and actual.read_bytes()==p.read_bytes()))
    if candidate=='opencorvus':
        src=sqlite3.connect((base/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True)
        target=sqlite3.connect(dest/'original-task.sqlite');src.backup(target);target.close();src.close()
    save(dest/'manifest.json',dict(started_at=started,sealed_at=now(),archive_bytes=archive.stat().st_size,files=manifest,links=links,original_file_bytes=sum(x['bytes'] for x in manifest),git=git,public_identity=identity,scope='Complete owned original project; external generic runtime excluded; hashes identify retained original objects, not correctness or effective hours.'))
    print(json.dumps(dict(candidate=candidate,archive_bytes=archive.stat().st_size,members=len(manifest),original_bytes=sum(x['bytes'] for x in manifest),head=git['head'],public_same=all(x['immutable_public_bytes_same'] for x in identity))),flush=True)
