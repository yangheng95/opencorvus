from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,sys
ROOT=Path(__file__).parent
NODE='C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
for name in ['codex','opencorvus']:
    dest=ROOT/'source-reproduction'/name
    argv=[sys.executable,'-B',str(ROOT/'current-evaluator/check_package.py'),'--public',str(ROOT/'frozen-public'),'--workbook',str(dest/'project/submission/Aurisic_Financials_4-25-1.xlsx'),'--source-calculations',str(ROOT/'original-source-arithmetic.json'),'--output',str(dest/'independent-assessment.json'),'--node',NODE]
    start=datetime.now(timezone.utc).isoformat();p=subprocess.run(argv,cwd=ROOT,capture_output=True)
    (dest/'independent-consumer.stdout.log').write_bytes(p.stdout);(dest/'independent-consumer.stderr.log').write_bytes(p.stderr)
    r=dict(argv=argv,started_at=start,ended_at=datetime.now(timezone.utc).isoformat(),native_exit=p.returncode,stage='posthoc_corrected_consumer_on_source_only_reconstruction',new_model_run=False,original_candidate_modified=False)
    (dest/'independent-consumer.execution.json').write_text(json.dumps(r,indent=2),encoding='utf-8')
    print(json.dumps(dict(candidate=name,**r)),flush=True);print(p.stdout.decode('utf-8',errors='replace'),flush=True)
