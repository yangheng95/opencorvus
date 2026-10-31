from pathlib import Path
import difflib,json,shutil
R=Path('D:/opencorvus-benchmark-runs/l06-v04-whole-case-independent-review-20261031');C=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06/evaluator/upgrade-v0.4');f=R/'repair-closure';f.mkdir(exist_ok=False)
old=(R/'case-initial/check_whole.py').read_text(encoding='utf-8-sig');new=(C/'check_whole.py').read_text(encoding='utf-8-sig');shutil.copy2(C/'check_whole.py',f/'actual-check_whole.py');(f/'checker.diff').write_text(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='initial-captured-checker',tofile='current-repaired-checker')),encoding='utf-8');print((f/'checker.diff').read_text())
for name in ['assessment-main','assessment-weak','assessment-iid']:
 p=Path('D:/opencorvus-benchmark-runs/l06-v04-full-case-20261031/concentrated-fix-checks')/(name+'-closed-recheck.json');d=json.loads(p.read_text());print(name,json.dumps(d,ensure_ascii=False)[:1600])
