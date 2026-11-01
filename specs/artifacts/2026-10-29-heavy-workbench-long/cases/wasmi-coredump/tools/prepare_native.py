"""Materialize untouched reference and check its library with task-owned Cargo state."""
from pathlib import Path
from datetime import datetime,timezone
import shutil,subprocess,json,os
R=Path(__file__).parent;src=R/'reference-source';cargo=Path('C:/Users/hengu/.cargo/bin/cargo.exe')
if src.exists():raise RuntimeError('Reference already materialized; inspect original receipt')
shutil.copytree(R/'original-base',src)
def save(name,v):(R/name).write_text(json.dumps(v,indent=2),encoding='utf-8')
patch=[str(Path('C:/Program Files/Git/cmd/git.exe')),'apply',str(R/'original-task/solution/solution.patch')]
p=subprocess.run(patch,cwd=src,capture_output=True)
(R/'original-reference-apply.stdout.log').write_bytes(p.stdout);(R/'original-reference-apply.stderr.log').write_bytes(p.stderr)
save('original-reference-apply.json',dict(argv=patch,native_exit=p.returncode,scope='Exact original solution patch; no author implementation'))
if p.returncode:raise SystemExit(p.returncode)
home=R/'runtime/cargo-home';home.mkdir(parents=True,exist_ok=False)
env=dict(os.environ,CARGO_HOME=str(home),CARGO_TARGET_DIR=str(R/'private-build/reference'),CARGO_TERM_COLOR='never')
argv=[str(cargo),'check','--locked','-p','wasmi','--lib','--features','portable-dispatch']
record=dict(argv=argv,cwd=str(src),declared_env={k:env[k] for k in ['CARGO_HOME','CARGO_TARGET_DIR','CARGO_TERM_COLOR']},started_at=datetime.now(timezone.utc).isoformat(),scope='Only library compilation and dependency readiness; not feature execution/model work/effective hours. Portable dispatch is a prospective native-Windows runtime choice for both future candidates, not source patching.')
save('native-reference-check-started.json',record)
with (R/'native-reference-check.stdout.log').open('wb') as out,(R/'native-reference-check.stderr.log').open('wb') as err:p=subprocess.run(argv,cwd=src,env=env,stdout=out,stderr=err)
record.update(ended_at=datetime.now(timezone.utc).isoformat(),native_exit=p.returncode);save('native-reference-check.json',record)
print(json.dumps(record),flush=True)
