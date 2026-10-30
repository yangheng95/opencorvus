from pathlib import Path
import subprocess,sys,json,time
from datetime import datetime,timezone
R=Path('D:/opencorvus-benchmark-runs/L02-paired-20261030-cb3a704d/codex/evaluation')
cmd='$benchPost = Get-CimInstance Win32_Process -Filter "ProcessId = 96992"; if ($benchPost -and ($benchPost.CommandLine -like "*prepare-l02-codex-assessment-20261031.py*")) { Wait-Process -Id 96992 -ErrorAction SilentlyContinue }'
p=subprocess.run(['powershell','-NoProfile','-Command',cmd],capture_output=True,text=True)
(R/'matrix-continuation-wait.json').write_text(json.dumps({'owned_pid':96992,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'scope':'original helper natural termination; no cancellation or new native forecasts'},indent=2),encoding='utf-8')
if (R/'completed').exists() or (R/'evaluation-prepare-started.json').exists():raise ValueError('original_post_terminal_state_requires_review_before_continuing')
cmd=[sys.executable,'-X','utf8','-B','D:/opencorvus-benchmark-runs/prepare-l02-codex-registered-matrix-20261031.py']
t=time.monotonic();started=datetime.now(timezone.utc).isoformat()
with (R/'matrix-continuation.stdout.txt').open('wb') as o,(R/'matrix-continuation.stderr.txt').open('wb') as e:p=subprocess.run(cmd,stdout=o,stderr=e)
(R/'matrix-continuation-terminal.json').write_text(json.dumps({'argv':cmd,'started_at':started,'finished_at':datetime.now(timezone.utc).isoformat(),'exit_code':p.returncode,'seconds':time.monotonic()-t},indent=2),encoding='utf-8')
raise SystemExit(p.returncode)
