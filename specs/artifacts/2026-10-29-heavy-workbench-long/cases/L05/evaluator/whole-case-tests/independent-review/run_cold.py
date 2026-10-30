from pathlib import Path
import json,shutil,subprocess,time,uuid,zipfile,datetime
R=Path(__file__).parent;X=Path('D:/opencorvus-benchmark-runs/l05-full-case-20261031')
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
source=R/'cold-source';raw=R/'cold-raw';out=R/'cold-native';shutil.copytree(X/'closed-main-submission',source);shutil.copytree(X/'raw-closed-base',raw);out.mkdir();results=out/'results';results.mkdir();name='oc-l05-independent-'+uuid.uuid4().hex[:12];image='sha256:23ff8bfbf8055caa0b9fa5745ddb27cceea2f31d7d15b7a900c81112cdfe8ddf'
argv=['docker','create','--name',name,'--network','none','--cpus','1','--mount',f'type=bind,source={source},target=/source,readonly','--mount',f'type=bind,source={raw},target=/raw,readonly','--mount',f'type=bind,source={results},target=/results',image,'/opt/cpsat/bin/python','-B','/source/reproduce.py','--input','/raw','--output','/results/run']
started=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');save(out/'create-command.json',dict(argv=argv,exit_code=p.returncode,stdout=p.stdout,stderr=p.stderr,at=started))
if p.returncode:raise SystemExit(p.returncode)
cid=p.stdout.strip();cmd=['docker','start','--attach',cid];start=time.monotonic();p=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8');(out/'stdout.txt').write_text(p.stdout,encoding='utf-8');(out/'stderr.txt').write_text(p.stderr,encoding='utf-8');save(out/'terminal-command.json',dict(argv=cmd,exit_code=p.returncode,seconds=time.monotonic()-start,started_at=started,finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),cid=cid))
ins=subprocess.run(['docker','inspect',cid],capture_output=True,text=True,encoding='utf-8',check=True);(out/'inspect-terminal.json').write_text(ins.stdout,encoding='utf-8');state=json.loads(ins.stdout)[0]
with zipfile.ZipFile(R/'own-cold-originals.zip','w',zipfile.ZIP_DEFLATED) as z:
 for folder in [source,raw,out]:
  for f in folder.rglob('*'):
   if f.is_file():z.write(f,f.relative_to(R).as_posix())
if state['State']['Status']=='exited':
 clean=['docker','rm',cid];c=subprocess.run(clean,capture_output=True,text=True,encoding='utf-8');save(out/'cleanup.json',dict(argv=clean,exit_code=c.returncode,stdout=c.stdout,stderr=c.stderr))
print((out/'terminal-command.json').read_text());print(p.stdout)
