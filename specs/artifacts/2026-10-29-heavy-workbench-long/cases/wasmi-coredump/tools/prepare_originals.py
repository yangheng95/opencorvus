"""Register one complete original task before reading its private solution/tests."""
from pathlib import Path
from datetime import datetime,timezone
import json,zipfile,urllib.request,hashlib,io,shutil
R=Path(__file__).parent;INTAKE=Path('D:/opencorvus-benchmark-runs/deep-task-intake-20261101')
TASK='wasmi-trap-coredumps';BASE='e1f76e285b9ad68a952b7cf5297bbb7ab91e6028';SOURCE='0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea'
if (R/'registration.json').exists():raise RuntimeError('Selection already registered; use original objects')
record=dict(registered_at=datetime.now(timezone.utc).isoformat(),task=TASK,task_source_commit=SOURCE,base_repository='https://github.com/wasmi-labs/wasmi',base_commit=BASE,selected_before_reference_or_private_tests_read=True,selection_evidence='Original113 metadata, priorSQLite/GQL prompts, this turn GQL/Wasmi/Bandit prompts; no model scores/trajectories/solutions/tests for this task',reason='Whole VM configuration/trap/error/typed-frame/reentrant stack/memory/global/binary consumption feature, rather than a standalone encoder',plan='specs/artifacts/2026-10-29-heavy-workbench-long/cases/wasmi-coredump/BUILD-PLAN.md',candidate_started=False,model_calls=0,automatic_candidate_launch_allowed=False,effective_candidate_hours_qualified=False,official_score=False)
(R/'registration.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
with zipfile.ZipFile(INTAKE/'original-deep-swe.zip') as z:
    for m in z.infolist():
        parts=Path(m.filename).parts
        if len(parts)<4 or parts[1:3]!=('tasks',TASK) or m.is_dir():continue
        p=R/'original-task'/Path(*parts[3:]);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(m))
url='https://codeload.github.com/wasmi-labs/wasmi/zip/'+BASE
with urllib.request.urlopen(url,timeout=60) as response:data=response.read()
(R/'original-base.zip').write_bytes(data)
members=[]
with zipfile.ZipFile(io.BytesIO(data)) as z:
    for m in z.infolist():
        if m.is_dir():continue
        relative=Path(*Path(m.filename).parts[1:]);p=R/'original-base'/relative
        if not p.resolve().is_relative_to((R/'original-base').resolve()):raise ValueError(m.filename)
        p.parent.mkdir(parents=True,exist_ok=True);raw=z.read(m);p.write_bytes(raw)
        members.append(dict(path=relative.as_posix(),bytes=len(raw)))
(R/'download.json').write_text(json.dumps(dict(url=url,downloaded_at=datetime.now(timezone.utc).isoformat(),archive_bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),identity_scope='Pinned immutable source archive identity only; not functional correctness or qualification',members=members),indent=2),encoding='utf-8')
current=dict(record,phase='original_complete_task_registered_native_readiness_pending',active_candidate=None,active_evaluation=None,original_reference_execution_count=0)
(R/'current.json').write_text(json.dumps(current,indent=2),encoding='utf-8')
print(json.dumps(dict(phase=current['phase'],base_archive_bytes=len(data),base_members=len(members),original_task_files=sum(p.is_file() for p in (R/'original-task').rglob('*')))))
