import datetime
import json
from pathlib import Path
import subprocess
import time

root=Path(__file__).resolve().parent
command=['docker','run','--rm','--network','none','--cpus','1','-e','PYTHONDONTWRITEBYTECODE=1',
         '--mount',f'type=bind,source={root},target=/review',
         'pytorch/pytorch@sha256:c16f4c749e2d9e96878875cdf6cc45cddda1d1a36fddd371dd6f2360f1b6e2a2',
         'python','-B','/review/probe_cpu.py']
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
before=time.perf_counter()
run=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace')
(root/'probe.stdout.txt').write_text(run.stdout,encoding='utf-8')
(root/'probe.stderr.txt').write_text(run.stderr,encoding='utf-8')
receipt={'started_at_utc':start,'elapsed_seconds':time.perf_counter()-before,'command_argv':command,
         'exit_code':run.returncode,'scope':'one independent CPU container; no GPU requested; only this authorized external directory mounted writable'}
(root/'execution.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt));print(run.stdout);print(run.stderr)
raise SystemExit(run.returncode)
