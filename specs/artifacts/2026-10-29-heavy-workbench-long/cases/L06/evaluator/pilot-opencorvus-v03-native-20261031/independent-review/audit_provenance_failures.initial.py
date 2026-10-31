from pathlib import Path
from contextlib import closing
from fractions import Fraction as F
import json,zipfile,sqlite3,shutil,datetime
R=Path('D:/opencorvus-benchmark-runs/l06-v03-opencorvus-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v03-opencorvus-native-20261031');A=X/'evaluation/assignment';D=A/'closed/delivery';N=A/'closed/run';read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'));canon=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'));checks={};details={}
layout=read(A/'delivery-layout.json');assignment=read(A/'assignment.json');checks['assignment_layout2_bound']=assignment['format']=='l06-whole-assignment/2' and layout==assignment['delivery_layout'];checks['actual_existing_inside_layout_paths']=all((D/v).resolve().is_relative_to(D.resolve()) and (D/v).exists() for k,value in layout['paths'].items() for v in (value if k=='figures' else [value]));checks['frozen_17_scoring_leaves_same']=read(A/'rubric.json')['leaves']==read(Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06/evaluator/upgrade-v0.3/rubric.draft.json'))['leaves']
for folder,archive in [('sealed-project','pre-execution-project.zip'),('controller-source','pre-execution-controller-source.zip'),('public','public-originals.zip')]:
 with zipfile.ZipFile(N/archive) as z:
  entries=[v for v in z.namelist() if not v.endswith('/')];checks['native_'+folder+'_capsule']=len(entries)==len(set(entries)) and set(entries)=={p.relative_to(N/folder).as_posix() for p in (N/folder).rglob('*') if p.is_file()} and all((N/folder/name).read_bytes()==z.read(name) for name in entries)
actual_files={p.relative_to(N/'sealed-project').as_posix():p for p in (N/'sealed-project').rglob('*') if p.is_file()};programme={p.relative_to(D/'actor').as_posix():p for p in (D/'actor').rglob('*') if p.is_file()};checks['complete_actual_programme_delivered']=set(actual_files)==set(programme) and all(p.read_bytes()==programme[k].read_bytes() for k,p in actual_files.items())
original=Path(assignment['original_run']);sub=read(N/'sealed-project/submission.json');identities=[]
for episode in read(N/'episodes.json'):
 for phase in episode['phases']:
  out=N/phase['out'];active=read(out/'active.json');terminal=read(out/'worker-terminal.json');mapped=sub['argv'].copy()
  for k,v in {'{python}':phase['argv'][0],'{project}':str((original/'sealed-project').resolve()),'{public}':str((original/'public').resolve())}.items():mapped=[a.replace(k,v) for a in mapped]
  ok=active['argv']==mapped and active['argv']==terminal['argv'] and active['worker_pid']==terminal['pid'] and terminal['native_exit']==0 and Path(phase['argv'][3]).resolve()==(original/'controller-source/source/execute_policy.py').resolve();identities.append({'path':episode['path'],'controller_exit':phase['native_exit'],'worker_pid':terminal['pid'],'declared_argv_and_native_identity':ok})
checks['every_actual_declared_argv_and_native_identity']=all(v['declared_argv_and_native_identity'] for v in identities)
selected=['REPORT.md','HANDOFF.md','requirements-lock.txt','requirements.txt','policy.json','results/source-map.json','results/summary.json','results/receivables.json','figures/cash-and-storage.png','figures/cost-comparison.png']+[p.relative_to(D).as_posix() for f in ['actor','tools'] for p in (D/f).glob('*') if p.is_file()];capsule={}
with zipfile.ZipFile(X/'evaluation/complete-workspace.zip') as z:
 for name in selected:capsule[name]=z.read('project/'+name)==(D/name).read_bytes()
checks['reviewed_closed_objects_same_original_workspace']=all(capsule.values());archive_checks={}
with zipfile.ZipFile(D/'delivery-source.zip') as z:
 for name in z.namelist():
  if not name.endswith('/'):archive_checks[name]=(D/name).is_file() and (D/name).read_bytes()==z.read(name)
checks['actual_delivered_selfcontained_source_archive_bytes']=all(archive_checks.values())
# Preserve original candidate failure evidence as candidate records, not our rating.
negative=read(D/'results/negative-packet-diagnostic.json');attempts=read(D/'review/checker-attempts.json');aux=read(D/'review/auxiliary-correction.json');checks['forged_packet_original_trace_preserved']=negative['exit']==1 and negative['stdout']=='' and 'packet disagrees with authoritative committed prefix' in negative['stderr'];checks['own_review_checker_failure_preserved']=attempts[0]['exit']==1 and 'export[state] == final' in attempts[0]['failure'] and 'queue' in attempts[0]['cause'];checks['own_review_auxiliary_correction_disclosed']=len(aux)==2 and {v['bytes'] for v in aux}=={0,32768}
with zipfile.ZipFile(D/'review/evidence.zip') as z:
 checks['failure_records_in_original_review_archive']=json.loads(z.read('review/checker-attempts.json'))==attempts and json.loads(z.read('review/auxiliary-correction.json'))==aux
 details['first_review_failure_evidence_limit']='Local checker-attempts is a retained structured report of exit1; the initial raw Host tool part cited in review/REPORT was not fetched via Task/service. We independently prove current queues from raw/SQL, and do not substitute this internal Accepted verdict for our own fiveH.'
# Directly corroborate its own successful original public and internal-review fresh prefix,
# without executing either or using their independent-check conclusions as truth.
derived=read(R/'independent-derived-values.json');runchecks=[]
for public_run in [D/'exercise/run-001',D/'review/native-001']:
 episodes=read(public_run/'episodes.json')
 for e in episodes:
  s=e['path'];db=public_run/e['directory']/'journal.sqlite3';dest=R/'sql-read-copies'/db.relative_to(X);dest.parent.mkdir(parents=True,exist_ok=True)
  for ext in ['', '-wal','-shm']:
   p=Path(str(db)+ext)
   if p.exists():shutil.copy2(p,Path(str(dest)+ext))
  with closing(sqlite3.connect('file:'+dest.resolve().as_posix()+'?mode=ro',uri=True)) as con:actual=con.execute('SELECT week,request_id,item_json FROM commits ORDER BY week').fetchall()
  export=read(public_run/e['directory']/'completed/journal-export.json');ok=len(actual)==16 and [json.loads(v[2]) for v in actual]==export['committed'] and export['state']==derived['states'][s][-1] and export['weeks']==derived['rows'][s];runchecks.append({'existing_run':public_run.relative_to(D).as_posix(),'path':s,'full_SQL_state_against_our_math':ok})
checks['candidate_original_and_internal_review_SQL_not_just_selfPASS']=all(v['full_SQL_state_against_our_math'] for v in runchecks)
opt=read(D/'results/optimization.json');relax=read(D/'results/information-relaxation.json');expected=F(read(D/'results/summary.json')['expected_cost_exact']);checks['original_optimizer_status_scope']=opt['status']==1 and 'Time limit' in opt['message'] and F(str(opt['objective_float']))==expected and opt['native_dual_bound_float']==47658.125;checks['original_continuous_relaxation_scope']=relax['status']==0 and relax['nodes']==128 and 'continuous' in relax['method'] and abs(relax['objective_float']-46727.84821428571)<1e-8
locked={v.split('==')[0].lower().replace('_','-'):v.split('==')[1] for v in (D/'requirements-lock.txt').read_text().splitlines() if '==' in v};installed={}
for p in (D/'.venv/Lib/site-packages').glob('*.dist-info/METADATA'):
 import email
 msg=email.message_from_bytes(p.read_bytes());name=msg['Name'].lower().replace('_','-')
 if name in locked:installed[name]=msg['Version']
checks['declared_scientific_environment_actual_metadata']=installed==locked
# Public original source/input bytes are identical, and no extra public path remains.
pub={};closedpub={}
for p in (X/'public').rglob('*'):
 if p.is_file():pub[p.relative_to(X/'public').as_posix()]=p.read_bytes()
for p in (N/'public').rglob('*'):
 if p.is_file():closedpub[p.relative_to(N/'public').as_posix()]=p.read_bytes()
checks['actual_public25_no_extras_and_private_exact']=len(pub)==25 and pub==closedpub
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'read-only immutable ZIP members/source/native identities and owned copied SQLite; no actor/solver/LP/test/grader execution','checks':checks,'actual_private_native_identities':identities,'original_workspace_bytes':capsule,'source_archive_members':archive_checks,'candidate_own_failure_records':{'forged_packet':negative,'checker_attempts':attempts,'auxiliary_correction':aux},'existing_original_and_internal_review_SQL':runchecks,'scientific_lock_actual_metadata':installed,'evidence_limits':details,'model_comparison':'owner reports actual streaming gpt-6.1-sol; no causal speed/cost ranking against any unknown model','scope':'this candidate fiveH science/content only; internal review Accepted is not adopted as external authority'};(R/'provenance-and-failure-audit.json').write_text(json.dumps(result,indent=2));print(json.dumps({'checks':checks,'all':all(checks.values()),'evidence_limits':details},indent=2));raise SystemExit(not all(checks.values()))
