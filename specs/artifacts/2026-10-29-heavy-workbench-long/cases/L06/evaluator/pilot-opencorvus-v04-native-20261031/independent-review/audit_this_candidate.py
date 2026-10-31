from pathlib import Path
from fractions import Fraction as F
import json,importlib.util,datetime
R=Path('D:/opencorvus-benchmark-runs/l06-v04-opencorvus-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-opencorvus-native-20261031');D=X/'project/submission'
spec=importlib.util.spec_from_file_location('independent_raw_definitions',R/'independent_raw_definitions.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
summaries,records,histories,wire=m.audit(X/'evaluation/private-run');claim=m.read(D/'exports-complete/summary.json')['instances']
for ident,s in summaries.items():
 for k,v in s.items():m.ck(claim[ident][k]==v,'candidate_original_summary_exact',(ident,k))
rows=m.table(D/'exports-complete/stage-ledger.csv');m.ck(len(rows)==len(records),'candidate_stage_coverage');seen=set()
for row in rows:
 key=(row['instance'],row['path'],int(row['seq']));m.ck(key in records and key not in seen,'candidate_logical_identity',key);seen.add(key);ex=records[key]
 for k,v in ex.items():
  if k=='request_id':continue
  if k=='belief_json':m.ck({q:m.exact(t) for q,t in json.loads(row[k]).items()}=={q:F(t) for q,t in v.items()},'candidate_actual_posterior',key)
  elif k=='receivables_json':m.ck(sorted(json.loads(row[k]),key=lambda t:t['receipt_id'])==sorted(v,key=lambda t:t['receipt_id']),'candidate_actual_absolute_AR',key)
  elif type(v) is int:m.ck(int(row[k])==v,'candidate_stage_integer',(key,k))
  else:m.ck(row[k]==v,'candidate_stage_value',(key,k))
result={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Independent original raw CSV/Fraction Bayesian and material/cash/AR recurrence over THIS candidates actual private SQLite and worker wires. Reused independent physical-law parser code only; no author/other-candidate result as oracle, no candidate/core/planner import or execution. SQLite/WAL/SHM copied to review-owned directory before read.','failures':m.fail,'instances':summaries,'actual_SQL_stages':len(records),'actual_wire_lines':wire,'scope':'One completed private candidate execution read only; no new actor/cold/DP/solver and no handwritten aggregate'}
(R/'independent-numeric-audit.json').write_text(json.dumps(result,indent=2)+'\n');(R/'independent-logical-stages.json').write_text(json.dumps(list(records.values()),indent=2)+'\n');print(json.dumps({'failures':m.fail,'instances':{k:{a:b for a,b in v.items() if a!='receivables_by_path'} for k,v in summaries.items()},'SQL_stages':len(records),'wire_lines':wire},indent=2))
