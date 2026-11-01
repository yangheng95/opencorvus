"""Prepare only owned native runtime and pristine input/reference trees."""
from pathlib import Path
from datetime import datetime,timezone
import subprocess,json,sys,shutil,re
R=Path(__file__).parent
PY=Path('C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
def run(name,args,cwd=R):
 start=datetime.now(timezone.utc).isoformat();p=subprocess.run(args,cwd=cwd,capture_output=True)
 (R/(name+'.stdout.log')).write_bytes(p.stdout);(R/(name+'.stderr.log')).write_bytes(p.stderr)
 receipt=dict(argv=[str(x) for x in args],cwd=str(cwd),started_at=start,ended_at=datetime.now(timezone.utc).isoformat(),native_exit=p.returncode)
 (R/(name+'.json')).write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt),flush=True)
 if p.returncode:print(p.stderr.decode(errors='replace')[-5000:]);sys.exit(p.returncode)
run('native-venv',[str(PY),'-m','venv',str(R/'runtime')])
py=R/'runtime/Scripts/python.exe'
run('native-dependencies',[str(py),'-m','pip','install','click>=8.3.1','click-default-group>=1.2.3','pluggy','python-dateutil','sqlite-fts4','tabulate','pytest','pytest-cov','pytest-xdist','hypothesis'])
run('native-freeze',[str(py),'-m','pip','freeze'])
patch=R/'original-task/solution/solution.patch'
paths=re.findall(r'^diff --git a/(.*?) b/(.*?)$',patch.read_text(),re.M)
for old,new in paths:
 if old!=new or Path(new).is_absolute() or '..' in Path(new).parts:raise ValueError('Unexpected original patch path')
 if not (new.startswith('sqlite_utils/') or new.startswith('docs/')):raise ValueError('Reference edits outside task declared implementation/docs')
shutil.copytree(R/'original-base',R/'reference-source')
run('apply-original-reference',['git','apply','--check',str(patch)],R/'reference-source')
run('apply-original-reference-exact',['git','apply',str(patch)],R/'reference-source')
(R/'reference-patch-scope.json').write_text(json.dumps(dict(paths=paths,reference_source_patched_by_root=False,original_patch_applied_unchanged=True,branch_or_worktree_created=False),indent=2),encoding='utf-8')
