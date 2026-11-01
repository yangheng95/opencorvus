from datetime import datetime,timezone
import importlib.util
import json
from pathlib import Path
import shutil
import sys
repo=Path('D:/myhexin-local/opencorvus');root=Path(__file__).resolve().parent
sys.path.insert(0,str(repo/'script/benchmark'))
import delivery_workflow_cases as w
import delivery_domain_cases as d
oldroot=Path('D:/opencorvus-benchmark-runs/outcome-quality-selection-e2e-20261101')
spec=importlib.util.spec_from_file_location('original_workflow',oldroot/'frozen/delivery_workflow_cases.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
assert old.CONTRACTS['bundle']==w.CONTRACTS['bundle']
assert old.PROTOTYPES['bundle']==w.PROTOTYPES['bundle']
request='Repair the supplied project according to CONTRACT.md. Deliver the complete deliverable.pyz, maintainable source and concise handoff. Work directly in this project without delegation.\n\n'+w.CONTRACTS['bundle']
oldreport=json.loads((oldroot/'after/result.json').read_text(encoding='utf-8'));assert next(c for c in oldreport['cases'] if c['kind']=='bundle')['prompt']==request
frozen=root/'frozen';frozen.mkdir()
for kind in ['bundle','download','temperature']:
    (w.setup if kind=='bundle' else d.setup)(kind,frozen/'public'/kind)
(frozen/'private-cases.json').write_text(json.dumps(dict(bundle=w.bundle_cases(),download=d.download_cases(),temperature=d.temperature_cases()),ensure_ascii=False,indent=2),encoding='utf-8')
for source in ['script/benchmark/delivery_workflow_cases.py','script/benchmark/delivery_domain_cases.py','script/benchmark/delivery_verification_scope.py','packages/opencorvus/script/delivery-verification-scope-real.ts','packages/opencorvus/src/prompt/fragments/verification-discipline.ts','packages/opencorvus/src/orchestrator/task-lifecycle-input.ts']:
    target=frozen/'implementation'/source;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(repo/source,target)
registration=dict(registeredAt=datetime.now(timezone.utc).isoformat(),phase='contract-domain',baseProductCommit='2c37ede22057a8a3cdfecfb0524adfc4140cbdfc',model='openai/gpt-6.1-sol',maxActualRequests=180,cases=[dict(kind='bundle',entry='task'),dict(kind='download',entry='task'),dict(kind='temperature',entry='coding')],bundlePublicAndPrototypeAndOperatorPromptEqualOriginal=True,privateCaseCounts=dict(bundle=4,download=3,temperature=4),rootCorrection='role-specific admissibility authority plus independent input-domain coverage; no candidate hand patch',heartbeat='PAUSED',oldCredentialsServicesBudgets='retired, not reused')
(root/'registration.json').write_text(json.dumps(registration,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(registration,ensure_ascii=False,indent=2))
