from pathlib import Path
import shutil,json,datetime,zipfile,gzip,difflib,importlib.util
from fractions import Fraction as F
R=Path('D:/opencorvus-benchmark-runs/l06-v04-codex-fresh-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-codex-fresh-native-20261031');D=X/'submission';run=X/'evaluation/private-run'
p=R/'independent_raw_definitions.py';shutil.copy2(p,R/'independent_raw_definitions-first-executed.py');lines=p.read_text().splitlines(True);lines[4]="R=Path('"+R.as_posix()+"');X=Path('"+X.as_posix()+"');read="+lines[4].split(';read=',1)[1];p.write_text(''.join(lines),encoding='utf-8')
spec=importlib.util.spec_from_file_location('independent_raw_definitions',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
checks=[]
def ck(name,ok,data=None):checks.append({'check':name,'pass':bool(ok),'details':data})
def zip_bind(zp,base):
 with zipfile.ZipFile(zp) as z:
  members=[n for n in z.namelist() if not n.endswith('/')];bad=[n for n in members if not(base/n).is_file() or (base/n).read_bytes()!=z.read(n)];return {'member_count':len(members),'differences':bad}
for label,zp,base in [('actual project capsule',run/'pre-execution-project.zip',run/'sealed-project'),('delivered programme',run/'pre-execution-project.zip',D/'programme'),('actual controller capsule',run/'pre-execution-controller.zip',run/'controller-source'),('actual public capsule',run/'public-originals.zip',run/'public'),('source archive original members',D/'source-archive.zip',D)]:
 q=zip_bind(zp,base);ck(label,not q['differences'],q)
cmds=m.read(run/'actual-commands.json');ck('Actual private command exits',len(cmds)==200 and sum(v['native_exit']==73 for v in cmds)==2 and sum(v['native_exit']==0 for v in cmds)==198)
rowpublic=run/'row-order-public/instances/base';ck('Row-reordered raw same semantic facts',m.raw(rowpublic)==m.raw(run/'public/instances/base'))
rr=m.sql(run/'row-order-control/journal.sqlite3');ck('row-control actual 16 SQL commits',len(rr)==16);rowhist=[json.loads(v[3]) for v in rr];orig=m.read(run/'owner-terminal.json')['instances']['base']['episodes'];same=False
for item in orig:
 row=m.sql(run/item['directory']/'journal.sqlite3');business=lambda rows:[(a[0],json.loads(a[2]),json.loads(a[3]),json.loads(a[4]),json.loads(a[5])) for a in rows]
 if business(rr)==business(row):same=True;break
ck('row-control complete original packet/action/receipt business same',same)
# Read stored certificate objects only, never execute the candidate solver/verifier.
values=m.read(D/'derivation/build-01/values.json');cert=m.read(D/'derivation/independent-bellman-review.json');roots={};counts={}
for p in sorted((D/'derivation/build-01/certificates').glob('*.jsonl.gz')):
 name=p.name.removesuffix('.jsonl.gz');ident=next(k for k in ['base','cash-tight','shifted-prior'] if name.startswith(k+'-'));mode=name[len(ident)+1:];d=m.raw(run/'public/instances'/ident);root=[0,0,0,0,0,d['initial_cash']+sum(x['amount'] for x in d['opening'] if x['due_week']==0),0];rows=0;rootvalue=None
 with gzip.open(p,'rt',encoding='utf-8') as f:
  for line in f:
   row=json.loads(line);rows+=1
   if row['state']==root:rootvalue=row['value']
 roots[name]=rootvalue;counts[name]=rows;ck('Stored certificate count/root '+name,rows==cert['certificates'][name]['states_exactly_verified'] and rootvalue==values[ident][mode]['value_exact'] and rootvalue==cert['certificates'][name]['root_value_exact'])
info={}
for ident in ['base','cash-tight','shifted-prior']:
 d=m.raw(run/'public/instances'/ident);pi=sum(v['prior'] for v in d['laws'].values() if v['A']==F(17,20));bound=pi*F(roots[ident+'-class-A'])+(1-pi)*F(roots[ident+'-class-B']);bayes=F(roots[ident+'-same-information']);s=m.initial(d)
 for t in range(8):
  s,_,_=m.step(d,s,{'test':None},None,('deterministic no-inspection closed form',ident,t));s,_,_=m.step(d,s,{'order':None,'certified_units':d['weeks_table'][t]['demand']},None,('deterministic no-inspection closed form',ident,t))
 closed=sum(v['demand']*(v['certified_unit_cost']+d['production_cost']) for v in d['weeks_table'].values());ck('No-inspection deterministic exact lower bound/attainment '+ident,closed==s['cumulative_cost']==F(roots[ident+'-no-inspection']));ck('Class advance weighted bound arithmetic '+ident,bound==F(values[ident]['advance-information-bound-exact']) and bayes-bound==F(values[ident]['intrinsic-information-value-exact']));info[ident]={'class_prior':str(pi),'advance_class_bound':str(bound),'intrinsic_information_value':str(bayes-bound),'no_inspection_cost_exact':closed,'no_inspection_cash_final':s['cash'],'no_inspection_min_cash':s['minimum_cash']}
# Record source-only permission change and real original owner failure, without executing it.
old=(X/'public/exercise.py').read_text();fixed=(D/'runner/exercise.py').read_text();(R/'actual-owned-runner.diff').write_text(''.join(difflib.unified_diff(old.splitlines(True),fixed.splitlines(True),fromfile='original-public',tofile='candidate-owned-runner')),encoding='utf-8');origerror=m.read(D/'native-run-01/owner-error.json');ck('Original readonly failure preserved','PermissionError' in json.dumps(origerror),origerror)
result={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':checks,'all_pass':all(v['pass'] for v in checks) and not m.fail,'additional_math_failures':m.fail,'class_and_no_inspection_arithmetic':info,'certificate_scope':'Read actual stored objects and independently inspect mathematical implementation/acyclic proof; no solver/DP/certificate verifier re-executed. The verifier is candidate-authored independent method, not a second external reviewer.','reviewer_tool_observation':'First audit source displayed SyntaxWarning for Windows \\l literal; computation returned complete failures=[]/exit0. Preserved first executed bytes and normalized only reviewer path spelling, no candidate change or native rerun.'};(R/'source-science-binding-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'all_pass':result['all_pass'],'failed_checks':[v for v in checks if not v['pass']],'mathematical_issues':m.fail,'information_arithmetic':info,'certificates':len(roots),'stored_states_read':sum(counts.values())},indent=2))
