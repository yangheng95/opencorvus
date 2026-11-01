"""Seal one naturally terminal candidate's complete owned project, then measure.

Does not follow external directory junctions, patch a candidate or export XLSX.
The declared generic runtime remains external; link targets are explicitly kept.
"""
from pathlib import Path
from datetime import datetime,timezone
import argparse,json,os,zipfile,hashlib,subprocess,sqlite3

ROOT=Path(__file__).parent
NODE=Path('C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
def now():return datetime.now(timezone.utc).isoformat()
def save(p,v):p.write_text(json.dumps(v,indent=2,default=str)+'\n',encoding='utf-8')
def seal(candidate,terminal_receipt):
    base=ROOT/candidate;project=base/'project';dest=base/'sealed'
    if dest.exists():raise RuntimeError('Original product already sealed; consume the original receipt, do not reseal')
    terminal=json.loads(terminal_receipt.read_text(encoding='utf-8'))
    if terminal.get('natural_terminal') is not True:raise ValueError('Natural terminal evidence required before sealing')
    dest.mkdir();files=[];links=[]
    for directory,dirs,names in os.walk(project,followlinks=False):
        directory=Path(directory)
        for name in list(dirs):
            p=directory/name
            if p.is_symlink() or p.is_junction():
                links.append(dict(path=p.relative_to(project).as_posix(),target=os.readlink(p),scope='external link not followed'))
                dirs.remove(name)
        for name in names:
            p=directory/name
            if p.is_symlink():links.append(dict(path=p.relative_to(project).as_posix(),target=os.readlink(p),scope='file link not followed'))
            else:files.append(p)
    started=now();manifest=[];archive=dest/'complete-project.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(files):
            before=p.stat();data=p.read_bytes();after=p.stat()
            if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):raise RuntimeError('Candidate file changed after terminal:'+str(p))
            member=p.relative_to(project).as_posix();z.writestr(member,data)
            manifest.append(dict(path=member,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
        z.writestr('ARCHIVE-EXTERNAL-LINKS.json',json.dumps(links,indent=2))
    identity=json.loads((ROOT/'frozen-public-identity.json').read_text(encoding='utf-8'))['members']
    input_identity=[]
    for row in identity:
        p=project/'public'/row['name']
        actual=hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
        input_identity.append(dict(name=row['name'],same_immutable_input=actual==row['sha256']))
    if candidate=='opencorvus':
        src=sqlite3.connect('file:'+str(base/'runtime/data/opencorvus.db')+'?mode=ro',uri=True)
        copy=sqlite3.connect(dest/'original-task.sqlite');src.backup(copy);copy.close();src.close()
    save(dest/'manifest.json',dict(files=manifest,links=links,terminal_evidence=str(terminal_receipt),started_at=started,sealed_at=now(),archive_bytes=archive.stat().st_size,original_file_bytes=sum(x['bytes'] for x in manifest),complete_owned_project=True,external_declared_runtime_included=False,input_identity=input_identity,scope='Immutable original-object retention only; sizes and hashes are not quality acceptance or effective hours.'))
    return dest
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('candidate',choices=['codex','opencorvus']);p.add_argument('--terminal-receipt',required=True,type=Path)
    a=p.parse_args();dest=seal(a.candidate,a.terminal_receipt)
    print(json.dumps(dict(candidate=a.candidate,sealed=str(dest),financial_evaluation_started=False)))
