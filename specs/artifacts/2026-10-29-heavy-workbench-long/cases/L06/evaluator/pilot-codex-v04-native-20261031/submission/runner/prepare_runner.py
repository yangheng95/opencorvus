from pathlib import Path
import difflib
root=Path('D:/opencorvus-benchmark-runs/l06-v04-codex-fresh-native-20261031')
original=(root/'public/exercise.py').read_text(encoding='utf-8')
needle="            with p.open('w',encoding='utf-8',newline='') as f:csv.writer(f).writerows(rows[:1]+list(reversed(rows[1:])))"
replacement="            # Windows copytree preserves the input read-only bit; only the owned reordered copy is changed.\n            import stat\n            p.chmod(p.stat().st_mode | stat.S_IWRITE)\n"+needle
assert original.count(needle)==1
fixed=original.replace(needle,replacement)
(root/'submission/runner/exercise.py').write_text(fixed,encoding='utf-8')
(root/'submission/runner/readonly-copy-fix.diff').write_text(''.join(difflib.unified_diff(original.splitlines(True),fixed.splitlines(True),fromfile='public/exercise.py',tofile='submission/runner/exercise.py')),encoding='utf-8')
