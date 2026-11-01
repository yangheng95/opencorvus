"""Public-only original full repository task, local runtime and disclosed adaptation."""
from pathlib import Path
import json,shutil,hashlib,sys
R=Path(__file__).parent;W=Path('D:/myhexin-local/opencorvus');C=W/'specs/artifacts/2026-10-29-heavy-workbench-long/cases/sqlite-safe-import'
P=R/'public';P.mkdir(exist_ok=True)
shutil.copy2(R/'original-task/instruction.md',P/'TASK.original.md')
def write(name,text):(P/name).write_text(text,encoding='utf-8')
write('TASK.md','''# Complete sqlite-utils safe import feature

Implement the entire original task in TASK.original.md against the supplied complete upstream base repository. Deliver actual modified source, public API/CLI functionality, updated CLI documentation, focused real behavior tests and a concise HANDOFF.md with exact native build/run commands and honest limits. A plan, pseudocode, fake output or only a standalone demo is insufficient. The primary application remains sqlite-utils; do not build a parallel replacement service.

The current local execution contract overrides the original last sentence requesting a new branch: stay on the supplied main source, create no branch/worktree, and commit your actual changes there. Do not push, modify remotes, publish, call other models or delegate. Work only in this project; the declared runtime is the only external filesystem exception. The task is a local native-Windows adaptation of a pinned DeepSWE task, not an official Docker/network-locked score.

Use the original interfaces, data/state/error contracts and semantics. Named exceptions are evaluated at actual operations, not by an author-specific private module location. Checkpoint result IDs are nonempty strings as required by the error-result contract; invariant IDs remain opaque and CLI arguments are their textual representations. Internal metadata names, implementation organization and legitimate data representations are your choice. Do not claim final quality from test count or source hashes.

Do not access other run roots, the host repository, references, private graders, test patches, old solutions, trajectories, credentials or external answer services. Read only the supplied base and public task material plus declared generic runtime. Internet/extra dependency fetches are outside this task; installed tools in RUNTIME.md are available equally. Do not modify public task files or the shared runtime. Keep owned caches and evidence inside the project.

No Docker/WSL, user-app/window/process operations, UI automation or external messages. Use meaningful positive behavior/state/error tests on actual SQLite data and real CLI invocations. There is no total candidate token/time cap or minimum duration. Work efficiently; do not sleep or pad output/work. Finish owned child processes naturally before ending and identify the source commit, complete deliverable, exact commands and material remaining limits. Do not claim a benchmark grade or heavy/effective-hour qualification.
''')
write('QUALITY.md','''# Whole-task outcomes, without aggregate100

1. Checkpoint lifecycle: enable/disable, create opaque nonempty id, commit/rollback/cleanup, named errors and nested use.
2. Invariants: persistent id/expression registration/removal/listing, SELECT and row/aggregate expression meaning, real validation result and failures.
3. Atomic imports: insert/upsert/CSV/JSON strict and non-strict results; failed operations restore actual user data and complete affected schema including columns/indexes/triggers. Report actual differences rather than only a total pass flag.
4. CLI integration: all specified commands, insert/upsert/bulk safe-mode including UPDATE, expected native code domains and visible invariant identities. An operation failure is a documented process-error outcome; validation always exits0 while communicating its actual result.
5. Existing functionality: ordinary source-backed import/read/write remains useful. Preserve actual data; source reference behavior is not authority to invent extra public requirements.
6. Complete source and documentation: original requested feature is integrated in the existing package; provide real CLI docs, concise build/handoff and genuine failure/validation evidence. Correct uncertainty is not a substitute for implementation.
7. Reproducibility and evidence: actual source-only rebuild/execution in the declared runtime, saved database/CLI behavior, all processes naturally settled, honest limits. Functional test count, code size and elapsed lifecycle are not independent quality or effective-hour measures.

These dimensions are kept separate. No guaranteed winner, hindsight threshold, overall100, forced failure, library ban or reward for complexity. The numerical/functional consumer does not replace reading complete source/docs or professional/statistical validation. This task is not qualified as hours-long merely because its source benchmark calls it long-horizon.
''')
freeze=(R/'native-freeze.stdout.log').read_text(encoding='utf-8')
write('RUNTIME.md','''# Same native runtime for both candidates

Windows PowerShell. Python3.12.14, SQLite from that interpreter, plus the exact independently installed packages below. Use:

`D:/opencorvus-benchmark-runs/sqlite-safe-import-pair-20261101/runtime/Scripts/python.exe`

From this project root, `& <python-path> -B -m sqlite_utils --help` imports the local source. To run a script elsewhere set PYTHONPATH to this project, keeping private files and other projects outside scope. The runtime and its standard-library/site-packages paths may be read but not modified; write caches, temporary databases and configurations only in your project. No new downloads are required. No Docker, WSL or native UI needed.

Installed package snapshot (actual preparation output, not an assumed latest catalog):

```text
'''+freeze.rstrip()+'''
```

The same installed dependency tree is supplied to both candidates. Setup time and evaluator computation are not candidate effective hours. The original Linux container/network-locked execution protocol is not claimed here. Avoid unreviewed broad tests; use directly relevant non-UI positive behavior/state/error checks.
''')
inp=dict(source_task='sqlite-utils-safe-import-checkpoints',task_repository='https://github.com/datacurve-ai/deep-swe',task_commit='0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea',upstream_repository='https://github.com/simonw/sqlite-utils',upstream_commit='8d74ffc93292c604d5827e2b44fffedca0c28c19',base_material='Complete local upstream source at project root; original base archive fixed before any candidate',source_license='Apache-2.0; upstream LICENSE retained',official_score=False)
write('INPUTS.json',json.dumps(inp,indent=2)+'\n')
(C/'public').mkdir(parents=True,exist_ok=True)
for f in P.iterdir():shutil.copy2(f,C/'public'/f.name)
shutil.copy2(R/'original-base/LICENSE',C/'UPSTREAM-LICENSE')
print(json.dumps(dict(public_files=[p.name for p in P.iterdir()],candidate_started=False)))
