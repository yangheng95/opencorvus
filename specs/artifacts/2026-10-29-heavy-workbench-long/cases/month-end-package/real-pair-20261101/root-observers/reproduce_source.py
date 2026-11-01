"""Run each original submitted build command once without generated answers."""
from pathlib import Path,PurePosixPath
from datetime import datetime,timezone
import argparse,json,zipfile,subprocess,sys,hashlib
ROOT=Path(__file__).parent
PY=Path('C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
def now():return datetime.now(timezone.utc).isoformat()
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('candidate',choices=['codex','opencorvus']);a=p.parse_args()
    target=ROOT/'source-reproduction'/a.candidate/'project'
    target.mkdir(parents=True,exist_ok=False)
    included=[]
    with zipfile.ZipFile(ROOT/a.candidate/'sealed/complete-project.zip') as z:
        for entry in z.infolist():
            rel=PurePosixPath(entry.filename)
            if rel.is_absolute() or '..' in rel.parts:raise ValueError('Archive path outside owned workspace')
            # Original public inputs and program source only. Original outputs,
            # caches, generated claim JSON and self-assessment results excluded.
            keep=entry.filename.startswith('public/') or (entry.filename.startswith('submission/') and rel.suffix in ['.py','.mjs','.ps1'])
            if not keep or entry.is_dir():continue
            file=target/entry.filename
            file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(z.read(entry))
            included.append(entry.filename)
    record=target.parent/'source-extraction.json'
    record.write_text(json.dumps(dict(source_archive=str(ROOT/a.candidate/'sealed/complete-project.zip'),files=included,generated_answers_copied=False,source_modified=False,declared_generic_runtime_reused=True),indent=2),encoding='utf-8')
    commands=([['pwsh.exe','-NoProfile','-Command',"& './submission/build.ps1'"]] if a.candidate=='codex' else [[str(PY),'submission/run_all.py'],[str(PY),'submission/make_visual_index.py']])
    receipts=[]
    for i,argv in enumerate(commands):
        start=now();child=subprocess.run(argv,cwd=target,capture_output=True)
        (target.parent/f'command-{i}.stdout.log').write_bytes(child.stdout)
        (target.parent/f'command-{i}.stderr.log').write_bytes(child.stderr)
        r=dict(argv=argv,cwd=str(target),started_at=start,ended_at=now(),native_exit=child.returncode)
        receipts.append(r);(target.parent/'execution.json').write_text(json.dumps(receipts,indent=2),encoding='utf-8');print(json.dumps(r),flush=True)
        if child.returncode:sys.exit(child.returncode)
    output=target/'submission/Aurisic_Financials_4-25-1.xlsx'
    (target.parent/'result.json').write_text(json.dumps(dict(source_only_build_native_exit=0,declared_output_present=output.is_file(),declared_output_bytes=output.stat().st_size if output.is_file() else None,original_candidate_untouched=True,scope='Actual original submitted command in a new source/public-only workspace; generic declared runtime reused. Financial correctness requires independent consumption.'),indent=2),encoding='utf-8')
