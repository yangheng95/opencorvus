from pathlib import Path
import json,datetime
R=Path('D:/opencorvus-benchmark-runs/l06-v04-whole-case-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-full-case-20261031')
src=(R/'audit_raw_SQL.py').read_text(encoding='utf-8-sig').split("main= X/'native-whole-first'")[0]
ns={};exec(compile(src,'independent_raw_sql_definitions','exec'),ns)
sumry,records,hist,wire=ns['audit'](X/'wrong-iid/run')
from fractions import Fraction as F
opt={'base':F(300834939,4000000),'cash-tight':F(11287373277,128000000),'shifted-prior':F(90125954529,1280000000)}
v={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Read-only independent raw CSV/Fraction/SQL full wrong-IID outcome support; no actor/planner run','independent_failures':ns['fail'],'instances':{k:{j:x for j,x in d.items() if j!='receivables_by_path'} for k,d in sumry.items()},'quality_failure':{k:{'actual_expected':d['expected_cost_exact'],'registered_optimum':str(opt[k]),'ratio':str(F(d['expected_cost_exact'])/opt[k]),'above_101_percent':F(d['expected_cost_exact'])>opt[k]*F(101,100)} for k,d in sumry.items()},'actual_stages':len(records),'wire_lines':wire}
(R/'wrong-IID-independent-numeric.json').write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
for name in ['prior-belief','expected-stock','ar-credit','random-key']:
 a=json.loads((X/'error-assessments'/name/'assignment.json').read_text());v.setdefault('actual_wrong_controls',{})[name]={k:d for k,d in a['leaves'].items() if k.startswith('M') and d['status']=='verified_fail'}
(R/'wrong-IID-independent-numeric.json').write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8');print(json.dumps(v,indent=2))
