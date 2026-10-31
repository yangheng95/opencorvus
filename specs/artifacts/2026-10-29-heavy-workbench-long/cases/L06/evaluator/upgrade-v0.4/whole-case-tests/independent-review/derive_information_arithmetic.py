from pathlib import Path
from fractions import Fraction as F
import json,datetime
R=Path('D:/opencorvus-benchmark-runs/l06-v04-whole-case-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-full-case-20261031');out=[]
for ident in ['base','cash-tight','shifted-prior']:
 s=json.loads((X/'author-project/work'/ident/'science.json').read_text());b=s['known_class_information_bound'];parts=b['parts'];weighted=sum(F(p['prior_mass'])*F(p['optimum_if_class_known']) for p in parts);out.append({'instance':ident,'weighted_class_known_exact':str(weighted),'published_bound_same':weighted==F(b['exact']),'difference_exact':str(F(s['bayes_optimum_exact'])-weighted),'published_difference_same':F(s['bayes_optimum_exact'])-weighted==F(b['value_of_advance_class_information_exact']),'proof_scope':'Inspected exact class-conditioned planner recurrence; unknown future lot outcomes remain two positive branches. No separate second planner/certificate executed by reviewer beyond authorized complete rebuild.'})
base=Path(X/'reference-delivery-final/public/instances/base/latent-law.csv')
import csv
laws=list(csv.DictReader(base.open()));w={v['latent_id']:F(int(v['prior_num']),int(v['prior_den']))*F(int(v['A_good_num']),int(v['A_good_den'])) for v in laws};z=sum(w.values());post={k:str(v/z) for k,v in w.items()}
weak=X/'weak-delivery/REPORT.md';lines=weak.read_text().splitlines();lineno=next(i for i,l in enumerate(lines,1) if l.startswith('The delivered policy is hereby certified'))
(R/'scientific-small-derivations.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'advance_class_arithmetic':out,'first_paid_A_good_base':post,'weak_actual_unheaded_final_certification':{'file':str(weak),'line':lineno,'text':lines[lineno-1]},'clarification':'Initial evidence fragment #False-certainty certification is a descriptive locator for this unheaded final paragraph, not an actual Markdown heading; final review uses exact line.'},indent=2)+'\n');print(json.dumps({'class_arithmetic':out,'posterior':post,'weak_line':lineno}))
