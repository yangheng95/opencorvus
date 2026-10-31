from pathlib import Path
from fractions import Fraction
import json,datetime,subprocess,importlib.util
R=Path('D:/opencorvus-benchmark-runs/l06-v04-whole-case-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-full-case-20261031');C=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06/evaluator/upgrade-v0.4');O=R/'repair-closure'
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
commands=[]
for label,prior,want in [('original-boolean-AR',R/'whole-checker-observations/boolean-original-AR-due-command.json',('M05','verified_fail')),('real-early-inspection',X/'concentrated-fix-checks/real-early-inspection-command.json',('M02','verified_fail'))]:
 d=load(prior);argv=d['argv'];argv[argv.index('--out')+1]=str(O/(label+'-assessment'));start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');a=load(O/(label+'-assessment')/'assignment.json');result={'case':label,'started_at':start,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':argv,'native_exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'M':{k:v for k,v in a['leaves'].items() if k.startswith('M')},'expected':dict([want]),'passed':p.returncode==0 and a['leaves'][want[0]]['status']==want[1],'scope':'Only current checker over unchanged existing native/output. No actor/native replay or solve.'};commands.append(result);(O/(label+'-command.json')).write_text(json.dumps(result,indent=2)+'\n')
spec=importlib.util.spec_from_file_location('trusted_current_case_checker',C/'check_whole.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ar=[{'receipt_id':'b','amount':24,'due_week':8},{'receipt_id':'a','amount':10,'due_week':1}];positive={'AR_plain_int_and_row_order':m.ar_records(ar)==list(reversed(ar)),'unreduced_fraction_preserved':m.numeric_fraction('2/6','fixture')==Fraction(1,3)}
unchanged={}
for folder in ['public','reference-source']:
 fs=[p for p in (R/'case-initial'/folder).rglob('*') if p.is_file()];unchanged[folder]=all((C/folder/p.relative_to(R/'case-initial'/folder)).read_bytes()==p.read_bytes() for p in fs)
for name in ['rubric.draft.json','registered.json']:unchanged[name]=(C/name).read_bytes()==(R/'case-initial'/name).read_bytes()
observed={}
for name in ['main','weak','iid']:
 d=load(X/'concentrated-fix-checks'/('assessment-'+name+'-closed-recheck.json'));states={k:v['status'] for k,v in d['M'].items()};observed[name]={'states':states,'expected':all(v==('verified_fail' if name=='iid' and k=='M04' else 'verified_pass') for k,v in states.items())}
actual=load(X/'wrong-early-inspection/actual-command.json');wire=load(X/'wrong-early-inspection/run/discovery-base/wire.jsonl');initial=load(X/'wrong-early-inspection/initial-prepare-command.json');proof={'original_actual_native_exit':actual['native_exit'],'actual_error_in_stderr':'available_quarantine_pack' in actual['stderr'],'actual_initial_packet_seq':wire['packet']['seq'],'actual_initial_quarantine':wire['packet']['state']['quarantine'],'actual_action':wire['response']['action'],'initial_checker_M02_blocked':'"M02":"blocked"' in initial['stdout'],'scope':'Actual new wrong programme preserved by main; reviewer only reads it. Distinct from earlier synthetic wire mapping probe.'}
result={'commands_passed':all(v['passed'] for v in commands),'positive_fields':positive,'unchanged_inputs_policy_rubric_actor':unchanged,'source_diff':'checker.diff','main_actual_closed_rechecks_read':observed,'real_B02_original_failure_proof':proof,'all_pass':all(v['passed'] for v in commands) and all(positive.values()) and all(unchanged.values()) and all(v['expected'] for v in observed.values()) and proof['original_actual_native_exit']==1 and proof['actual_error_in_stderr']}
(O/'closure-assessment.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
