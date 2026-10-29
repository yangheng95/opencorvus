import datetime,json,os,subprocess,sys,time
from pathlib import Path
root=Path(__file__).resolve().parent
command=[sys.executable,'-B',str(root/'diagnose_quality.py')]
start=datetime.datetime.now(datetime.timezone.utc).isoformat();before=time.perf_counter()
environment=dict(os.environ,OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1',MKL_NUM_THREADS='1',PYTHONDONTWRITEBYTECODE='1')
a=subprocess.run(command,cwd=root,env=environment,capture_output=True,text=True,encoding='utf-8',errors='replace')
(root/'diagnostic.stdout.txt').write_text(a.stdout,encoding='utf-8');(root/'diagnostic.stderr.txt').write_text(a.stderr,encoding='utf-8')
(root/'execution.json').write_text(json.dumps({'started_at_utc':start,'elapsed_seconds':time.perf_counter()-before,'command_argv':command,'exit_code':a.returncode,'scope':'CPU inference/analytic controls and read-only receipt arithmetic; no thresholds frozen, no training/service/model started'},indent=2)+'\n',encoding='utf-8')
print(a.stdout);print(a.stderr);raise SystemExit(a.returncode)
