"""Author construction of explicit new multi-stage raw materials, not a grader."""
from pathlib import Path
from copy import deepcopy
import argparse,json,itertools,sys

HERE=Path(__file__).resolve().parent
CORE=HERE.parent/'qualification/current-source';sys.path.insert(0,str(CORE));sys.path.insert(0,str(HERE/'source'))
from l06_packet import read_packet,write_packet
from tree_business import contingency

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
    old=read_packet(HERE.parents[1]/'public/inputs');data=deepcopy(old)
    data.update(common_weeks=0,probability_denominator=8,initial_cash_minor=12000,credit_limit_minor=9000)
    base,shift=old['scenarios'][0],old['scenarios'][2];paths=[]
    for index,bits in enumerate(itertools.product((0,1),repeat=3)):
        s={'id':'T'+str(index).zfill(2),'probability_numerator':1,'demand':[],'supplier_capacity_volume':[],'plant_capacity_hours':[]}
        for t in range(16):
            stage=t//4;bit=0 if stage==0 else bits[stage-1]
            s['demand'].append(deepcopy((shift if bit else base)['demand'][t]))
            # Announced current supply is observed before the current action;
            # old orders still arrive regardless of this week's capacity.
            s['supplier_capacity_volume'].append([30 if bit else 80,75,140])
            s['plant_capacity_hours'].append([24,34 if bit else 31])
        paths.append(s)
    data['scenarios']=paths;write_packet(data,a.out/'inputs')
    contract={'format':'l06-tree-contract/1','case_version':'L06/0.3.0-draft','weeks':16,
        'observation':'complete_current_event_and_perfect_recall','reveal_weeks':[4,8,12],
        'probabilities':'positive integer numerators / facility denominator; full public support, actual future private',
        'state':'post_week; original committed event/action prefix authoritative; derived state recomputed',
        'timing':'historical arrivals/receipts then current event, new orders/lead0, production/fulfilment, stage peaks/holding/cash',
        'checkpoint':'l06-committed-journal/1; schema1 SQLite is host-owned, actor may use any internal persistence',
        'quality_design':'before any policy solve: improve expected cost at least15% over legal spot contingency; additional registered feasible reference tolerance to be frozen after full construction',
        'limits':'synthetic finite business; no real procurement, OS side-channel, arbitrary failure or financial certification'}
    (a.out/'tree-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
    baseline,audit=contingency(data)
    # This author-side witness must never be included in candidate public input.
    (a.out.parent/(a.out.name+'-contingency-policy.json')).write_text(json.dumps(baseline,indent=2)+'\n')
    (a.out.parent/(a.out.name+'-contingency-audit.json')).write_text(json.dumps(audit,indent=2)+'\n')
    (a.out/'OPERATIONS.md').write_text('''# Four-product operations desk: staged commitments

Original synthetic business, no real supplier/customer. Static catalogue/BOM/route/pack/freight/lead/holding/sales terms inherit the declared L06 manufacturing model. This is a new instance, not the old0.2 input or lower bound. Eight equally probable joint paths combine three later announcements at weeks4,8,12. The tree is public support; the actual selected future is private to execution.

The spot supplier can serve a conservative current-needs alternative but is costly. Forward suppliers offer lower unit prices, integer packs, dispatch minimums and lead1/2. Supply announcements never revoke already placed orders. Production routes share real work hours; warehouse limits apply before consumption/dispatch. All current demand must be fulfilled. Historical cash arrives only after the declared lag; late receivables remain assets and cannot be spent early. Completed-week actions and receipts cannot be edited on restart.

Compare a lawful full-observation-history policy, an executable costly alternative and a clearly labelled information relaxation. An action may stay unchanged after news. Neither a path label nor a solver status proves causality, physical feasibility, quality or approval. Preserve failures and give practical operator recovery/credit advice. All money/volume/hour units are the raw table integer units; not real currency commitments.
''',encoding='utf-8')
    print(json.dumps({'raw_paths':len(paths),'weeks':16,'contingency_cost':audit['expected_cost_exact'],'all_business_and_information_valid':audit['policy_valid']}))
if __name__=='__main__':main()
