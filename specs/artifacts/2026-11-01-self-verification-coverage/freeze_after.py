from datetime import datetime,timezone
import json
from pathlib import Path
import shutil
import sys

root=Path(__file__).resolve().parent;repo=Path('D:/myhexin-local/opencorvus')
sys.path.insert(0,str(repo/'script/benchmark'))
import delivery_selfcheck_cases as c
import delivery_workflow_cases as w
before=json.loads((root/'before/result.json').read_text(encoding='utf-8'))
assert before['status']=='completed' and len(before['requests'])==60
assert before['cleanup']==dict(errors=[],pairedCopiesRetired=True,sourceBytesPreserved=True)
for kind in c.CONTRACTS:
    initial=root/'frozen/public'/kind
    assert (initial/'CONTRACT.md').read_text(encoding='utf-8')==c.CONTRACTS[kind]
    assert (initial/'main.py').read_text(encoding='utf-8')==c.PROTOTYPES[kind]
w.setup('bundle',root/'frozen/public/bundle')
original=Path('D:/opencorvus-benchmark-runs/contract-domain-repair-e2e-20261101/frozen/public/bundle')
assert all((original/name).read_bytes()==(root/'frozen/public/bundle'/name).read_bytes() for name in ['CONTRACT.md','main.py'])
sources=['script/benchmark/delivery_selfcheck_cases.py','script/benchmark/delivery_workflow_cases.py','script/benchmark/delivery_verification_scope.py','script/benchmark/delivery_domain_cases.py','packages/opencorvus/script/delivery-verification-scope-real.ts','packages/opencorvus/src/prompt/fragments/verification-discipline.ts','packages/opencorvus/src/orchestrator/task-lifecycle-input.ts']
for name in sources:
    target=root/'frozen/after-implementation'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(repo/name,target)
(root/'frozen/bundle-private-cases.json').write_text(json.dumps(w.bundle_cases(),ensure_ascii=False,indent=2),encoding='utf-8')
report=dict(registeredAt=datetime.now(timezone.utc).isoformat(),beforeRequests=60,beforeUnusedBudgetRetired=80,afterMaxActualRequests=180,orderedRuns=[dict(id='R11',kind='query-export',entry='task'),dict(id='R12',kind='utc-ledger',entry='coding'),dict(id='R13',kind='bundle',entry='task')],newTaskPublicAndPrototypesUnchanged=True,bundlePublicAndPrototypeEqualOriginalR06=True,reason='Both new-domain baselines already exercise key distinctions; they measure regression only. Add one fresh R06-contract regression to inspect producer-native-source self-testing directly; original candidates remain unchanged.',method='same sole runner; changed shared semantic-discrimination and evidence-attribution discipline; declared-case aggregation repaired; no private feedback',causalLimit='small sample, temporal and random differences; no unique prompt causality or overall failure-rate gain')
(root/'after-registration.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=True,indent=2))
