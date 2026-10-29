import datetime
import json
import subprocess
import time
from pathlib import Path

root=Path(__file__).resolve().parent
records=[]
for mode in ('producer','consumer'):
    command=['docker','run','--rm','--name',f'oc-pinn-adam-{mode}-20261029-a','--cidfile',str(root/f'adam-{mode}.cid'),
             '--gpus','all','--network','none','--env','CUDA_CACHE_PATH=/work/cuda-cache','--mount',
             f'type=bind,source={root.as_posix()},target=/work','--workdir','/work','opencorvus-benchmark-science:20261029',
             'python','-u','qualify_adam_restore.py',mode]
    started=datetime.datetime.now(datetime.timezone.utc).isoformat();before=time.perf_counter()
    with (root/f'adam-{mode}-stdout.log').open('w',encoding='utf8') as stdout,(root/f'adam-{mode}-stderr.log').open('w',encoding='utf8') as stderr:
        result=subprocess.run(command,stdout=stdout,stderr=stderr)
    records.append({'mode':mode,'command':command,'started_at':started,'seconds':time.perf_counter()-before,'exit_code':result.returncode})
    (root/'adam-restore-execution.json').write_text(json.dumps(records,indent=2))
    print(json.dumps(records[-1]),flush=True)
    if result.returncode:raise SystemExit(result.returncode)
