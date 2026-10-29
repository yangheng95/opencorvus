import datetime,json,os,subprocess,sys,time
from pathlib import Path
root=Path(__file__).resolve().parent
(root/'temporary').mkdir(exist_ok=True)
environment=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1',MKL_NUM_THREADS='1',TEMP=str(root/'temporary'),TMP=str(root/'temporary'))
receipts=[]
for version in ('source-snapshot','source-final'):
 for label,command in [('unit-tests',[sys.executable,'-B',str(root/version/'script/benchmark/test_pinn_submission_check.py')]),('adversarial-local-probes',[sys.executable,'-B',str(root/'probes.py'),version])]:
  name=version+'-'+label;start=datetime.datetime.now(datetime.timezone.utc).isoformat();before=time.perf_counter()
  a=subprocess.run(command,cwd=root,env=environment,capture_output=True,text=True,encoding='utf-8',errors='replace')
  (root/f'{name}.stdout.txt').write_text(a.stdout,encoding='utf-8');(root/f'{name}.stderr.txt').write_text(a.stderr,encoding='utf-8')
  row={'label':name,'started_at_utc':start,'elapsed_seconds':time.perf_counter()-before,'command_argv':command,'exit_code':a.returncode,'scope':'synthetic local reader contracts; no training or scientific score'}
  receipts.append(row);(root/'executions.json').write_text(json.dumps(receipts,indent=2)+'\n',encoding='utf-8')
  print(json.dumps(row));print(a.stdout);print(a.stderr)
  if a.returncode:raise SystemExit(a.returncode)
