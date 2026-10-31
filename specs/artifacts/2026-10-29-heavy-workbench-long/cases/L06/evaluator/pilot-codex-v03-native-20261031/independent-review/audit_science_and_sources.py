from pathlib import Path
from fractions import Fraction as F
import json,csv,sqlite3,zipfile,io,datetime,email
R=Path('D:/opencorvus-benchmark-runs/l06-v03-codex-fresh-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v03-codex-fresh-native-20261031');A=X/'evaluation/assignment';D=A/'closed/delivery';run=A/'closed/run';read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'));canon=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'))
# Load only my own saved raw-CSV arithmetic definitions, not candidate/author code.
source=(R/'audit_candidate_raw_sql.py').read_text().split('# Original actual SQL, wire and idempotency recovery;')[0];n={};exec(compile(source,str(R/'audit_candidate_raw_sql.py')+':pure-independent-equations','exec'),n)
raw,prod,M,J,PP,S,sc,fac=[n[k] for k in ['raw','prod','M','J','PP','S','sc','fac']];rec=read(R/'independent-recurrence.json');problems=[];boundrows=[];lower=F()
for path in sc:
 s=path['scenario_id'];totals=[sum(n['demand'][s,t,j] for t in range(fac['weeks']))-prod[k]['initial_units'] for k,j in enumerate(J)];cons=[sum(totals[j]*n['bom'][J[j],m] for j in range(len(J))) for m in M];purchase=sum(max(0,cons[k]-raw[k]['initial_units'])*min(n['price'][sup,m] for sup in S) for k,m in enumerate(M));production=sum(totals[j]*min(n['route'][p,J[j]][1] for p in PP if n['route'][p,J[j]][0]) for j in range(len(J)));cost=purchase+production;lower+=F(path['probability_numerator'],fac['probability_denominator'])*cost;boundrows.append({'path':s,'product_total':totals,'raw_consumption':cons,'purchase_lower':purchase,'production_lower':production,'cost_lower':cost})
relax=read(D/'outputs/information-relaxation.json');bound_ok=relax['paths']==boundrows and F(str(relax['exact_expected_lower_bound']))==lower==39714
if not bound_ok:problems.append('analytical_relaxation')
finance=read(D/'outputs/receivables.json');fchecks={}
for s,states in rec['states'].items():
 st=states[-1];expected={'final_cash':st['cash'],'minimum_cash':min(v['cash'] for v in states[1:]),'final_receivable':sum(st['receipts_by_week'][16:]),'due_after_horizon':{str(t):v for t,v in enumerate(st['receipts_by_week']) if t>=16 and v}};fchecks[s]=finance[s]==expected
 if not fchecks[s]:problems.append('receivables:'+s)
# All original action CSV coordinates, every informational prefix and exact derived components.
expect={};policy=read(D/'policy.json')
for s in [v['scenario_id'] for v in sc]:
 for t in range(fac['weeks']):
  a={k:policy['decisions'][s][k][t] for k in ['order_lots','truck_on','production']}
  for k,sup in enumerate(S):
   expect[s,t,'truck',sup,'']=a['truck_on'][k]
   for m,item in enumerate(M):expect[s,t,'order_lots',sup,item]=a['order_lots'][k][m]
  for p,plant in enumerate(PP):
   for j,item in enumerate(J):expect[s,t,'production',plant,item]=a['production'][p][j]
seen=set();coord=True
for v in csv.DictReader((D/'outputs/commitment-policy.csv').open(newline='',encoding='utf-8-sig')):
 key=(v['path'],int(v['week']),v['kind'],v['entity'],v['item']);coord &= key in expect and key not in seen and F(v['quantity'])==expect.get(key);seen.add(key)
coord &= set(expect)==seen
if not coord:problems.append('commitment_coordinates')
# Canonical spot supplied as action input only to the same independent recurrence.
base_source=source.replace("policy=load(D/'policy.json')","policy=load(D/'outputs/baseline-policy.json')");b={};exec(compile(base_source,str(R/'audit_candidate_raw_sql.py')+':baseline-independent-equations','exec'),b);basecost=sum(F(v['probability_numerator'],fac['probability_denominator'])*b['summaries'][v['scenario_id']]['cost'] for v in sc)
if b['findings'] or basecost!=70640:problems.append('canonical_spot')
spot=D/'evidence/native-spot-01';spotdb=[]
for ep in read(spot/'episodes.json'):
 s=ep['path'];folder=spot/ep['directory']
 with sqlite3.connect('file:'+str(folder/'journal.sqlite3')+'?mode=ro',uri=True) as con:items=[json.loads(v[0]) for v in con.execute('SELECT item_json FROM commits ORDER BY week')]
 ok=len(items)==16 and all(v['action']=={k:b['policy']['decisions'][s][k][t] for k in ['order_lots','truck_on','production']} and v['receipt']['cost_minor']==b['allrows'][s][t]['cost'] and v['receipt']['cash_minor']==b['allrows'][s][t]['cash'] for t,v in enumerate(items));spotdb.append({'path':s,'complete_business_actual':ok})
 if not ok:problems.append('spot_sql:'+s)
spot_assessment=read(spot/'logical-and-journal-assessment.json');spot_error=read(spot/'owner-error.json');spot_ok=spot_assessment['business_feasible'] is True and spot_assessment['information_legal'] is True and spot_assessment['journal_replay_complete'] is True and spot_assessment['quality_target_pass'] is False and F(spot_assessment['expected_cost_exact'])==70640 and read(spot/'actual-checker-command.json')['native_exit']==2
# Private actual control/source seals and current declared argv; capsule objects only read.
identity={}
for folder,archive in [('sealed-project','pre-execution-project.zip'),('controller-source','pre-execution-controller-source.zip'),('public','public-originals.zip')]:
 with zipfile.ZipFile(run/archive) as z:identity[folder]=all((run/folder/name).is_file() and (run/folder/name).read_bytes()==z.read(name) for name in z.namelist() if not name.endswith('/'))
original=Path(read(A/'assignment.json')['original_run']);sub=read(run/'sealed-project/submission.json');commands=read(run/'actual-commands.json');argv_checks=[]
for e in read(run/'episodes.json'):
 for ph in e['phases']:
  active=read(run/ph['out']/'active.json');mapped=sub['argv'].copy()
  for k,v in {'{python}':ph['argv'][0],'{project}':str((original/'sealed-project').resolve()),'{public}':str((original/'public').resolve())}.items():mapped=[x.replace(k,v) for x in mapped]
  argv_checks.append(mapped==active['argv'] and Path(ph['argv'][3]).resolve()==(original/'controller-source/source/execute_policy.py').resolve())
term=read(run/'owner-terminal.json');control=run/term['row_order_control'];path=term['control_path_after_terminal'];export=read(control/'completed/journal-export.json');control_ok=export['state']==rec['states'][path][-1] and export['weeks']==rec['rows'][path]
with sqlite3.connect('file:'+str(control/'journal.sqlite3')+'?mode=ro',uri=True) as con:control_items=[json.loads(v[0]) for v in con.execute('SELECT item_json FROM commits ORDER BY week')]
control_ok &= control_items==export['committed'] and len(control_items)==16
# Source-only public modules are the same permitted raw/physics primitives; no author answers.
public_module_map={'check_l06.py':'qualification/current-source','l06_input.py':'qualification/current-source','l06_packet.py':'qualification/current-source','l06_physics.py':'qualification/current-source','tree_business.py':'upgrade-v0.3/source'}
module_identity={name:(D/'programme'/name).read_bytes()==(run/'public/exercise-tools'/folder/name).read_bytes() for name,folder in public_module_map.items()}
# Closed files are actual submitted bytes in complete capsule, not patched layout outputs.
capsule={};selected=['REPORT.md','HANDOFF.md','README.md','source-map.json','reproduce.ps1','requirements-lock.txt','policy.json']+[str(v.relative_to(D)).replace('\\','/') for v in (D/'source').glob('*.py')]+[str(v.relative_to(D)).replace('\\','/') for v in (D/'programme').glob('*') if v.is_file()]
with zipfile.ZipFile(X/'evaluation/complete-workspace.zip') as z:
 for name in selected:capsule[name]=z.read('submission/'+name)==(D/name).read_bytes()
# Check optional environment available from original wheels, without installing anything.
locked={}
for line in (D/'requirements-lock.txt').read_text().splitlines():
 if '==' in line:
  name,version=line.split('==');locked[name.lower().replace('_','-')]=version
wheels={}
for p in (D/'dependencies/wheels').glob('*.whl'):
 with zipfile.ZipFile(p) as z:
  meta=[x for x in z.namelist() if x.endswith('.dist-info/METADATA')];m=email.message_from_bytes(z.read(meta[0]));wheels[m['Name'].lower().replace('_','-')]={'version':m['Version'],'requires_python':m.get('Requires-Python'),'file':p.name}
wheel_checks={name:name in wheels and wheels[name]['version']==ver for name,ver in locked.items()}
opt=read(D/'outputs/solve-causal-01/optimization.json');summary=read(D/'outputs/summary.json');bound_native=F(str(opt['native_weighted_best_bound']))/fac['probability_denominator'];native_ok=opt['status']=='FEASIBLE' and F(str(opt['weighted_objective']))/8==F(summary['expected_cost_exact']) and bound_native==F('47625.5') and 'status: FEASIBLE' in opt['response_stats']
layout=read(A/'delivery-layout.json');assigned=read(A/'assignment.json');layoutchecks={'assignment_format2':assigned['format']=='l06-whole-assignment/2','embedded_layout_exact':layout==assigned['delivery_layout'],'all_resolve_inside_original_delivery':all((D/p).resolve().is_relative_to(D.resolve()) and (D/p).exists() for k,v in layout['paths'].items() for p in (v if k=='figures' else [v])),'original_delivered_bytes_capsule':all(capsule.values()),'machine_leaf_ids_weights_same_frozen':read(A/'rubric.json')['leaves']==read(Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06/evaluator/upgrade-v0.3/rubric.draft.json'))['leaves']}
checks={'analytical_lower_bound_exact39714':bound_ok,'all_AR_due_exact':all(fchecks.values()),'all2944_commitment_coordinates':coord,'canonical_spot_independent70640':basecost==70640 and not b['findings'],'actual_spot_SQL_all8':all(v['complete_business_actual'] for v in spotdb),'actual_spot_expected_quality_rejection_preserved':spot_ok,'actual_private_capsule_identity':all(identity.values()),'actual_private_declared_argv_from_sealed_source':all(argv_checks),'actual_private16_row_control_exact':control_ok,'public_module_copy_identity':all(module_identity.values()),'current_closed_original_source_bytes':all(capsule.values()),'all_locked_wheels_present_exact_versions':all(wheel_checks.values()),'original_native_optimization_numeric_scope':native_ok,'layout_binding_and_original_paths':all(layoutchecks.values())}
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'standard-library read-only CSV/Fraction/SQLite/ZIP audit; no candidate/author imports, execution, solve or grader call','checks':checks,'failures':problems,'exact_analytical_lower_bound':str(lower),'analytical_per_path':boundrows,'candidate_minus_analytical_exact':str(F(summary['expected_cost_exact'])-lower),'native_search_bound_numerical':str(bound_native),'candidate_minus_native_numerical_exact':str(F(summary['expected_cost_exact'])-bound_native),'receivables':fchecks,'spot_sql':spotdb,'layout_checks':layoutchecks,'native_capsules':identity,'permitted_public_modules':module_identity,'declared_lock_wheel_checks':wheel_checks,'captured_original_source_members':capsule,'optimization_status':opt['status'],'private_native_seconds':term['seconds'],'scope':'five substantive H review support; no candidate rerun, no replayed search proof/exact optimum, no OS/professional/hour/maturity certification'}
(R/'scientific-provenance-audit.json').write_text(json.dumps(result,indent=2));print(json.dumps({'checks':checks,'failures':problems,'lower':str(lower),'native_bound':str(bound_native),'all':all(checks.values()) and not problems},indent=2));raise SystemExit(not all(checks.values()) or bool(problems))
