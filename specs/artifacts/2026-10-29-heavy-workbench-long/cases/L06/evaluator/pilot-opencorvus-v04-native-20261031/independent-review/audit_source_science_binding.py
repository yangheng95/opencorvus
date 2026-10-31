from pathlib import Path
from fractions import Fraction as F
import json,zipfile,gzip,datetime,importlib.util
R=Path('D:/opencorvus-benchmark-runs/l06-v04-opencorvus-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-opencorvus-native-20261031');D=X/'project/submission';run=X/'evaluation/private-run'
spec=importlib.util.spec_from_file_location('independent_raw_definitions',R/'independent_raw_definitions.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
checks=[]
def ck(name,ok,details=None):checks.append({'check':name,'pass':bool(ok),'details':details})
def zip_bind(zp,base):
 with zipfile.ZipFile(zp) as z:
  ms=[n for n in z.namelist() if not n.endswith('/')];return {'members':ms,'different':[n for n in ms if not (base/n).is_file() or (base/n).read_bytes()!=z.read(n)]}
for label,zp,base in [('actual frozen project',run/'pre-execution-project.zip',run/'sealed-project'),('delivered actor',run/'pre-execution-project.zip',D/'actor'),('actual controller',run/'pre-execution-controller.zip',run/'controller-source'),('actual public',run/'public-originals.zip',run/'public')]:
 b=zip_bind(zp,base);ck(label,not b['different'],b)
with zipfile.ZipFile(D/'source.zip') as z:
 members=[n for n in z.namelist() if not n.endswith('/')];bad=[]
 for n in members:
  p=(X/'project'/n) if n.startswith('public/') else D/n
  if not p.is_file() or p.read_bytes()!=z.read(n):bad.append(n)
 ck('Complete delivered source ZIP original source/raw identity',not bad,{'members':members,'different':bad,'archive_generated_table_members':[n for n in members if n.startswith('actor/tables/')]})
cmd=m.read(run/'actual-commands.json');ck('Actual private 200 controller command outcomes',len(cmd)==200 and sum(v['native_exit']==73 for v in cmd)==2 and sum(v['native_exit']==0 for v in cmd)==198)
ck('Row-reordered public raw semantic identity',m.raw(run/'row-order-public/instances/base')==m.raw(run/'public/instances/base'));rr=m.sql(run/'row-order-control/journal.sqlite3');ck('actual complete row-control SQL16',len(rr)==16);equiv=lambda rows:[(v[0],json.loads(v[2]),json.loads(v[3]),json.loads(v[4]),json.loads(v[5])) for v in rows];equal=False
for v in m.read(run/'owner-terminal.json')['instances']['base']['episodes']:
 if equiv(rr)==equiv(m.sql(run/v['directory']/'journal.sqlite3')):equal=True;break
ck('Row-control original full business packet/action/receipt identity',equal)
# Read certificates and saved outcome without executing planner/certificate checker.
verified={v['certificate']:v for v in m.read(D/'certificate-verification.json')};certmeta=m.read(D/'actor/tables/certificate.json');info={};counts={}
for ident in ['base','cash-tight','shifted-prior']:
 d=m.raw(run/'public/instances'/ident);roots={};no_nodes=None
 for name in ['same','A1','B1','no-inspection']:
  file=ident+'-'+name+'.json.gz'
  with gzip.open(D/'certificates'/file,'rt',encoding='utf-8') as f:c=json.load(f)
  rows={tuple(k):(value,action) for k,value,action in c['nodes']};root=('laboratory',0,0,0,d['initial_cash']+sum(t['amount'] for t in d['opening'] if t['due_week']==0),0);roots[name]=F(rows[root][0]);counts[file]=len(rows);ck('Stored certificate root/count '+file,len(rows)==len(c['nodes'])==verified[file]['nodes'] and roots[name]==F(verified[file]['root_exact']))
  if name=='no-inspection':no_nodes=rows
 pi=sum(v['prior'] for v in d['laws'].values() if v['A']==F(17,20));bound=pi*roots['A1']+(1-pi)*roots['B1'];ck('Advance class value arithmetic '+ident,bound==F(certmeta[ident]['advance_class_bound_exact']) and roots['same']==F(certmeta[ident]['optimum_exact']))
 s=m.initial(d);trace=[]
 for seq in range(16):
  key=(s['phase'],s['week'],s['good'],s['quarantine']['A']+2*s['quarantine']['B'],s['cash'],0);action=no_nodes[key][1];s,peak,closing=m.step(d,s,action,None,('read already supplied no-inspection certificate path only',ident,seq));trace.append({'seq':seq,'action':action,'cost':s['cumulative_cost'],'cash':closing,'peak':peak})
 ck('No-inspection selected path16 actual arithmetic '+ident,s['terminal'] and s['cumulative_cost']==roots['no-inspection']);info[ident]={'class_prior':str(pi),'same_information_root':str(roots['same']),'class_A_root':str(roots['A1']),'class_B_root':str(roots['B1']),'weighted_advance_class_bound':str(bound),'intrinsic_information_value':str(roots['same']-bound),'no_inspection_actual_cost':s['cumulative_cost'],'no_inspection_path':trace}
first=m.read(D/'exports/exercise-process.json');ck('Original first facility failure exact traceback',first['exit']==1 and 'PermissionError' in first['stderr'] and 'row-order-public' in first['stderr'])
# Actual source rebuild object identities/results; no execution.
rebuilt=m.read(D/'rebuilt-final/rebuild-process.json');ck('Original final archive rebuild process exited0',rebuilt['exit']==0)
for ident in ['base','cash-tight','shifted-prior']:
 ck('Original source regenerated complete actor table '+ident,m.read(D/'rebuilt-final/actor/tables'/(ident+'.json'))==m.read(D/'actor/tables'/(ident+'.json')))
ck('Original rebuilt native summary full numerical identity',m.read(D/'exports-rebuilt/summary.json')==m.read(D/'exports-complete/summary.json'))
# Bind all rated original documents/images to received closed assignment.
A=X/'evaluation/assessment/closed/delivery'
for p in ['report.md','OPERATOR-HANDOFF.txt','requirements-lock.txt']+[f'figures/{n}.png' for n in ['decisions','cost-information','cash','material','belief-information']]:ck('Actual closed content same '+p,(A/p).read_bytes()==(D/p).read_bytes())
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':checks,'all_pass':all(c['pass'] for c in checks) and not m.fail,'math_failures':m.fail,'class_information_arithmetic':info,'stored_certificates':len(counts),'stored_certificate_nodes':sum(counts.values()),'scope':'Original candidate objects, source static mathematical audit, exact arithmetic and stored path evaluation only. No candidate import, planner/DP/solver/verifier/native execution. Source/capsule bytes prove actual object identity; raw functional correctness is separately independently reconstructed.'};(R/'source-science-binding-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'all_pass':result['all_pass'],'failed_checks':[v for v in checks if not v['pass']],'math_failures':m.fail,'certificates':len(counts),'nodes':sum(counts.values()),'values':{k:{a:b for a,b in v.items() if a!='no_inspection_path'} for k,v in info.items()}},indent=2))
