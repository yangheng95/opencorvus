import datetime,json,os,subprocess,sys,time
from pathlib import Path
root=Path(__file__).resolve().parent
(root/'cli-results').mkdir();(root/'temporary').mkdir()
environment=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',OPENBLAS_NUM_THREADS='1',MKL_NUM_THREADS='1',OMP_NUM_THREADS='1',TEMP=str(root/'temporary'),TMP=str(root/'temporary'))
records=[]
def run(label,command):
    start=datetime.datetime.now(datetime.timezone.utc).isoformat();before=time.perf_counter()
    a=subprocess.run(command,cwd=root,env=environment,capture_output=True,text=True,encoding='utf-8',errors='replace')
    (root/f'{label}.stdout.txt').write_text(a.stdout,encoding='utf-8');(root/f'{label}.stderr.txt').write_text(a.stderr,encoding='utf-8')
    receipt={'label':label,'started_at_utc':start,'elapsed_seconds':time.perf_counter()-before,'command_argv':command,'exit_code':a.returncode,'scope':'reviewer-only numerical inference/tests; no training/GPU/provider'}
    records.append(receipt);(root/'executions.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(receipt));print(a.stdout);print(a.stderr)
    if a.returncode:raise SystemExit(a.returncode)
run('numpy-18-tests',[sys.executable,'-B',str(root/'source-snapshot/test_pinn_numeric_check.py')])
run('quality-controls-and-finite-error',[sys.executable,'-B',str(root/'diagnostics.py')])
for problem in ('convection','reaction','wave'):
    run('cli-'+problem,[sys.executable,'-B',str(root/'source-snapshot/pinn_numeric_check.py'),'evaluate','--problem',problem,'--checkpoint',str(root/'observed-exports'/f'{problem}.npz'),'--out',str(root/'cli-results'/f'{problem}.json')])
run('independent-torch-cpu',[r'C:/Program Files/Docker/Docker/resources/bin/docker.exe','run','--rm','--network','none','--cpus','1','-e','PYTHONDONTWRITEBYTECODE=1','--mount',f'type=bind,source={root},target=/review','pytorch/pytorch@sha256:c16f4c749e2d9e96878875cdf6cc45cddda1d1a36fddd371dd6f2360f1b6e2a2','python','-B','/review/torch_crosscheck.py'])
