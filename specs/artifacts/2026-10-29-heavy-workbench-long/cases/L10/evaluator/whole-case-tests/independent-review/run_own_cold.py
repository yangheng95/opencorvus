from pathlib import Path
import shutil,subprocess,json,time,datetime
R=Path(__file__).parent
X=Path('D:/opencorvus-benchmark-runs/l10-full-case-20261031')
C=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L10')
for name in ('run_l10.py','l10_core.py','l10_episode.py'):
 (R/'cold-evaluator').mkdir(exist_ok=True)
 shutil.copy2(C/'evaluator'/name,R/'cold-evaluator'/name)
shutil.copytree(X/'raw/base',R/'cold-input/raw')
shutil.copytree(X/'cases/base',R/'cold-input/cases')
shutil.copytree(X/'final-submission',R/'cold-program')
shutil.copytree(C/'public',R/'public-snapshot')
shutil.copy2(C/'rubric.json',R/'rubric-initial.json')
argv=['C:/Python314/python.exe','-X','utf8','-B',str(R/'cold-evaluator/run_l10.py'),'--submission',str(R/'cold-program'),'--raw',str(R/'cold-input/raw'),'--cases',str(R/'cold-input/cases'),'--out',str(R/'cold-run')]
start=time.monotonic();started=datetime.datetime.now(datetime.timezone.utc).isoformat()
p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8')
(R/'cold.stdout').write_text(p.stdout,encoding='utf-8');(R/'cold.stderr').write_text(p.stderr,encoding='utf-8')
(R/'cold-command.json').write_text(json.dumps({'argv':argv,'exit_code':p.returncode,'seconds':time.monotonic()-start,'started_at':started,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2),encoding='utf-8')
print((R/'cold-command.json').read_text())
