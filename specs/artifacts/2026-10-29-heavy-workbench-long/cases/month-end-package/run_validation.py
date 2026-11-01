"""Owned whole-workbook validation commands and their actual child exits."""
from pathlib import Path
from datetime import datetime, timezone
import json
import argparse
import subprocess
import sys

ROOT=Path(__file__).parent
LOG_DIR=ROOT/'validation'
NODE=Path('C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
def command(label,argv):
    start=datetime.now(timezone.utc).isoformat()
    p=subprocess.run([str(x) for x in argv],cwd=ROOT,capture_output=True)
    (LOG_DIR/f'{label}.stdout.log').write_bytes(p.stdout)
    (LOG_DIR/f'{label}.stderr.log').write_bytes(p.stderr)
    receipt=dict(label=label,argv=list(map(str,argv)),started_at=start,ended_at=datetime.now(timezone.utc).isoformat(),native_exit=p.returncode)
    (LOG_DIR/f'{label}.execution.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(json.dumps(receipt),flush=True)
    return p.returncode
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--final',action='store_true')
    parser.add_argument('variants',nargs='*',default=['reference'])
    args=parser.parse_args()
    ROOT=args.root.resolve()
    LOG_DIR=ROOT/'validation'
    variants=args.variants or ['reference']
    if args.final:
        LOG_DIR=ROOT/'validation-final'
        LOG_DIR.mkdir(exist_ok=False)
    if not (ROOT/'source-normalization.json').exists():
        if command('prepare',[sys.executable,'-B',ROOT/'implementation/prepare_source.py','--root',ROOT]):sys.exit(1)
    for variant in variants:
        out=LOG_DIR/variant
        out.mkdir(exist_ok=False)
        if command(variant+'-producer',[NODE,ROOT/'implementation/build_package.mjs',ROOT,out,variant]):sys.exit(1)
        if command(variant+'-layout',[sys.executable,'-B',ROOT/'implementation/preserve_layout.py','--root',ROOT,'--output',out/'Aurisic_Financials_4-25-1.xlsx']):sys.exit(1)
        command(variant+'-consumer',[sys.executable,'-B',ROOT/'implementation/check_package.py','--public',ROOT/'public','--workbook',out/'Aurisic_Financials_4-25-1.xlsx','--source-calculations',ROOT/'original-source-arithmetic.json','--output',out/'assessment.json','--node',NODE])
