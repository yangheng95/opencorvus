from pathlib import Path
import zipfile,json,shutil,subprocess,datetime,time,os,stat
R=Path('D:/opencorvus-benchmark-runs/l06-v04-whole-case-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-full-case-20261031');C=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06/evaluator/upgrade-v0.4');(R/'git-status-start.txt').write_text(subprocess.run(['git','status','--short'],cwd='D:/myhexin-local/opencorvus',capture_output=True,text=True).stdout)
for role in ['main','weak']:
 p=R/('assessment-'+role);p.mkdir(exist_ok=True)
 for n in ['assignment.json','review-template.json','rubric.json','delivery-layout.json']:shutil.copy2(X/('assessment-'+role)/n,p/n)
shutil.copytree(C,R/'case-initial',ignore=shutil.ignore_patterns('__pycache__'),dirs_exist_ok=True)
source=R/'source-only';source.mkdir();archive=X/'reference-delivery-final/source.zip';shutil.copy2(archive,R/'original-source.zip');members=[]
with zipfile.ZipFile(archive) as z:
 for entry in z.infolist():
  rel=Path(entry.filename);target=(source/rel).resolve()
  if rel.is_absolute() or '..' in rel.parts or not target.is_relative_to(source.resolve()) or stat.S_ISLNK(entry.external_attr>>16):raise ValueError('unsafe_source_archive_entry:'+entry.filename)
  if entry.is_dir():target.mkdir(parents=True,exist_ok=True)
  else:target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(entry))
  members.append(entry.filename)
(R/'source-extraction.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'original_archive':str(archive),'members':members,'scope':'complete actual source archive only; safe entry resolution, original bytes retained; no correctness-hash gate'},indent=2))
for n in ['REPORT.md','HANDOFF.md','requirements-lock.txt','reproduce.ps1']:
 shutil.copy2(X/'reference-delivery-final'/n,R/('original-main-'+n))
shutil.copy2(X/'weak-delivery/REPORT.md',R/'original-weak-REPORT.md')
# Own child environment puts incidental report/interpreter caches under owned root.
for f in ['temp','matplotlib-cache','cache']:(R/f).mkdir(exist_ok=True)
env=dict(os.environ);env.update(PYTHONDONTWRITEBYTECODE='1',MPLCONFIGDIR=str(R/'matplotlib-cache'),XDG_CACHE_HOME=str(R/'cache'),TEMP=str(R/'temp'),TMP=str(R/'temp'))
argv=['C:/Program Files/PowerShell/7/pwsh.exe','-NoProfile','-File',str(source/'reproduce.ps1'),'-Out',str(R/'cold-rebuild'),'-Python','C:/Python314/python.exe','-ReportPython','D:/opencorvus-benchmark-runs/l06-v04-full-case-20261031/report-environment/venv/Scripts/python.exe'];started=datetime.datetime.now(datetime.timezone.utc);timer=time.perf_counter()
with (R/'cold.stdout.txt').open('w',encoding='utf-8') as out,(R/'cold.stderr.txt').open('w',encoding='utf-8') as err:
 p=subprocess.Popen(argv,cwd=source,env=env,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW);record={'argv':argv,'cwd':str(source),'started_at':started.isoformat(),'owned_script_pid':p.pid,'cache_environment':{k:env[k] for k in ['MPLCONFIGDIR','XDG_CACHE_HOME','TEMP','TMP','PYTHONDONTWRITEBYTECODE']},'scope':'one authorized complete new0.4 self-contained study/native/report rebuild only; no old solver, Provider, Docker/WSL or L01 action'};(R/'cold-owner-started.json').write_text(json.dumps(record,indent=2));code=p.wait()
record.update(finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),native_exit=code,elapsed_seconds=time.perf_counter()-timer);(R/'cold-owner-terminal.json').write_text(json.dumps(record,indent=2));print(json.dumps(record,indent=2));raise SystemExit(code)
