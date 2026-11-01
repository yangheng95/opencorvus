"""One explicit post-hoc quantity-basis consumption per unchanged original."""
from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,sys
ROOT=Path(__file__).parent
NODE='C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
for name in ['codex','opencorvus']:
    dest=ROOT/'posthoc-measurement'/name;dest.mkdir(exist_ok=False)
    argv=[sys.executable,'-B',str(ROOT/'current-evaluator/check_package.py'),'--public',str(ROOT/'frozen-public'),'--workbook',str(ROOT/name/'project/submission/Aurisic_Financials_4-25-1.xlsx'),'--source-calculations',str(ROOT/'original-source-arithmetic.json'),'--output',str(dest/'assessment.json'),'--node',NODE]
    start=datetime.now(timezone.utc).isoformat();p=subprocess.run(argv,cwd=ROOT,capture_output=True)
    (dest/'stdout.log').write_bytes(p.stdout);(dest/'stderr.log').write_bytes(p.stderr)
    r=dict(argv=argv,started_at=start,ended_at=datetime.now(timezone.utc).isoformat(),native_exit=p.returncode,stage='post_hoc_measurement_repair',original_frozen_native_exit=4,new_model_run=False,candidate_modified=False)
    (dest/'execution.json').write_text(json.dumps(r,indent=2),encoding='utf-8')
    print(json.dumps(dict(candidate=name,**r)),flush=True);print(p.stdout.decode('utf-8',errors='replace'),flush=True)
