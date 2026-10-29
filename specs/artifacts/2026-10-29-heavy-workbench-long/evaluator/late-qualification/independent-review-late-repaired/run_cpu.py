import datetime,json,subprocess,time
from pathlib import Path
root=Path(__file__).resolve().parent
command=['docker','run','--rm','--network','none','--cpus','1','-e','PYTHONDONTWRITEBYTECODE=1','--mount',f'type=bind,source={root},target=/review','pytorch/pytorch@sha256:c16f4c749e2d9e96878875cdf6cc45cddda1d1a36fddd371dd6f2360f1b6e2a2','python','-B','/review/probe_cpu.py']
start=datetime.datetime.now(datetime.timezone.utc).isoformat();begin=time.perf_counter()
a=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace')
(root/'cpu.stdout.txt').write_text(a.stdout,encoding='utf-8');(root/'cpu.stderr.txt').write_text(a.stderr,encoding='utf-8')
receipt={'started_at_utc':start,'elapsed_seconds':time.perf_counter()-begin,'command_argv':command,'exit_code':a.returncode,'scope':'independent CPU repair contracts; no GPU or main repository writable mount'}
(root/'execution.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt));print(a.stdout);print(a.stderr);raise SystemExit(a.returncode)
