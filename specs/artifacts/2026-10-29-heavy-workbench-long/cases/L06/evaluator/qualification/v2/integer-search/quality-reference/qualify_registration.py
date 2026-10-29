"""Exercise the registered base bound against actual full business plans, no solver."""
import argparse,json,sys,zipfile
from fractions import Fraction
from pathlib import Path

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--case-root',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
    root=args.case_root.resolve();sys.path.insert(0,str(root/'evaluator/qualification/current-source'))
    from l06_input import read_json
    from l06_packet import read_packet
    from check_l06 import evaluate
    rubric=read_json(root/'rubric.draft.json','rubric',decimal_numbers=True)
    policy_path=root/rubric['quality_reference']['registration_file'];policy=read_json(policy_path,'reference')
    lower=Fraction(policy['lower_bound_minor']['numerator'],policy['lower_bound_minor']['denominator'])
    maximum=Fraction(rubric['quality_reference']['maximum_relative_gap'])
    data=read_packet((policy_path.parent/policy['input_identity']['public']).resolve())
    with zipfile.ZipFile(policy_path.parent/'originals.zip') as archive:
        original=json.loads(archive.read('input/full.json'))
        witness=json.loads(archive.read('quality-proof/plan.json'))
    assert data=={key:value for key,value in original.items() if key not in ('status','qualification_variant')}
    with zipfile.ZipFile(policy_path.parent.parent/'originals.zip') as archive:
        previous=json.loads(archive.read('cpsat-full/plan.json'));early=json.loads(archive.read('warm-full/plan.json'))
    outcomes=[]
    for name,plan,expected_cost,expected_status in [('registered-witness',witness,47808,'quality_met'),('previous-incumbent',previous,Fraction(490329,10),'quality_below_target'),('early-witness',early,51263,'quality_below_target')]:
        business=evaluate(data,plan);cost=Fraction(business['expected_cost_exact']['numerator'],business['expected_cost_exact']['denominator'])
        gap=(cost-lower)/lower;status='quality_met' if gap<=maximum else 'quality_below_target'
        assert business['business_feasible'] and cost==expected_cost and status==expected_status
        outcomes.append({'name':name,'business_feasible':True,'cost_exact':str(cost),'relative_gap_exact':str(gap),'reference_quality_status':status})
    result={'status':'passed','reference_id':policy['reference_id'],'semantic_input_identity':'equal','bound_trust':policy['bound_source']['kind'],'outcomes':outcomes,'scope':'base reference mathematical/configuration qualification only; full grader/candidate/hours unassessed'}
    args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

if __name__=='__main__':main()
