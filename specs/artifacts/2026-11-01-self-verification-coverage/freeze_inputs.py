from datetime import datetime,timezone
import json
from pathlib import Path
import shutil
import subprocess
import sys

repo=Path('D:/myhexin-local/opencorvus');root=Path(__file__).resolve().parent
sys.path.insert(0,str(repo/'script/benchmark'))
import delivery_selfcheck_cases as c
frozen=root/'frozen';frozen.mkdir()
for kind in c.CONTRACTS:c.setup(kind,frozen/'public'/kind)
(frozen/'private-cases.json').write_text(json.dumps({'query-export':c.sql_cases(),'utc-ledger':c.utc_cases()},ensure_ascii=False,indent=2),encoding='utf-8')
sources=['script/benchmark/delivery_selfcheck_cases.py','script/benchmark/test_delivery_selfcheck_cases.py','script/benchmark/delivery_verification_scope.py','script/benchmark/delivery_domain_cases.py','packages/opencorvus/script/delivery-verification-scope-real.ts','packages/opencorvus/src/prompt/fragments/verification-discipline.ts','packages/opencorvus/src/orchestrator/task-lifecycle-input.ts']
for name in sources:
    dest=frozen/'before-implementation'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(repo/name,dest)
registration=dict(registeredAt=datetime.now(timezone.utc).isoformat(),baseCommit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo).decode().strip(),model='openai/gpt-6.1-sol',maxActualRequestsPerPhase=140,phases=['before','after'],orderedRuns=[dict(id='R09',phase='before',kind='query-export',entry='task'),dict(id='R10',phase='before',kind='utc-ledger',entry='coding'),dict(id='R11',phase='after',kind='query-export',entry='task'),dict(id='R12',phase='after',kind='utc-ledger',entry='coding')],privateCounts={'query-export':3,'utc-ledger':4},primaryOutcome='model-authored and actually executed semantic-discrimination conditions, separately owner/internal reviewer/external consumer',basis='trace exact serialized inputs, final-entry execution and independently grounded assertions; no keyword/test-count or external-pass proxy',oldServicesBudgets='retired',heartbeat='PAUSED',limits='one run per task per phase; order/randomness and small sample prevent unique prompt causality or global failure-rate claims')
(root/'registration.json').write_text(json.dumps(registration,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in registration.items() if k!='orderedRuns'},ensure_ascii=True,indent=2))
