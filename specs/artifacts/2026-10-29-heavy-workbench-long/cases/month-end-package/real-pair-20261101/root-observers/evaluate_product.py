"""Consume a sealed original submission with the preregistered current checker."""
from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,sys,argparse
ROOT=Path(__file__).parent
NODE=Path('C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('candidate',choices=['codex','opencorvus']);a=p.parse_args()
    if not (ROOT/a.candidate/'sealed/manifest.json').is_file():raise RuntimeError('Seal original before consuming it')
    dest=ROOT/'evaluation'/a.candidate;dest.mkdir(parents=True,exist_ok=False)
    original=ROOT/a.candidate/'project/submission/Aurisic_Financials_4-25-1.xlsx'
    argv=[sys.executable,'-B',str(ROOT/'frozen-evaluator/check_package.py'),'--public',str(ROOT/'frozen-public'),'--workbook',str(original),'--source-calculations',str(ROOT/'original-source-arithmetic.json'),'--output',str(dest/'assessment.json'),'--node',str(NODE)]
    start=datetime.now(timezone.utc).isoformat();child=subprocess.run(argv,cwd=ROOT,capture_output=True)
    (dest/'consumer.stdout.log').write_bytes(child.stdout);(dest/'consumer.stderr.log').write_bytes(child.stderr)
    receipt=dict(candidate=a.candidate,argv=argv,started_at=start,ended_at=datetime.now(timezone.utc).isoformat(),native_exit=child.returncode,original_submission_modified=False,source_commit='394c7ee04ed06e988a3faa5d35da1d67fb03e48e',scope='Numeric/source/declared-refresh contracts only; not a whole professional grade or aggregate score')
    (dest/'execution.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(json.dumps(receipt));print(child.stdout.decode('utf-8',errors='replace'))
    sys.exit(child.returncode)
