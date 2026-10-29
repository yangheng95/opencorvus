"""Combine numeric findings with private evaluator observations; never self-grade a submission.

Evidence references and reviewer metadata are structural checks. Their presence
does not establish the truth of a rating: the assigned independent evaluator
must actually inspect the execution, source, business evidence and rendered art.
"""
import argparse,json,zipfile
from fractions import Fraction
from pathlib import Path

from l06_input import read_json,InputError
from l06_numeric import assess as assess_numeric,load_rubric,EvaluationError,NUMERIC_IDS
from l06_delivery import finding


REVIEW_IDS={'D01','D02','D07','D08','D09','D10',*[f'E{i:02}' for i in range(1,7)],*[f'F{i:02}' for i in range(1,6)]}
STATUSES=['verified_pass','verified_partial','verified_fail','candidate_incomplete','blocked_candidate','unassessed']
RATINGS={'full':('verified_pass',Fraction(1)),'half':('verified_partial',Fraction(1,2)),
         'zero':('verified_fail',Fraction(0)),'candidate_incomplete':('candidate_incomplete',Fraction(0)),
         'blocked_candidate':('blocked_candidate',Fraction(0)),'unassessed':('unassessed',None)}
REQUIRED_KINDS={'D01':{'process_receipt','source_audit'},'D02':{'process_receipt','business_oracle'},
                'D08':{'process_receipt'},'D09':{'process_receipt'},'D10':{'process_receipt'},
                'F04':{'rendered_figure'},'F05':{'process_receipt'}}


def invalid(detail):raise EvaluationError('review_evidence_invalid',detail)


def review_findings(args,rubric,criteria):
    if args.review is None:return {}
    if args.evidence_root is None:invalid('review requires a private evaluator evidence root')
    delivery=args.delivery_root.resolve();root=args.evidence_root.resolve();review_path=args.review.resolve()
    if review_path.is_relative_to(delivery) or root.is_relative_to(delivery):invalid('review/evaluator root must be outside candidate delivery')
    if not review_path.is_relative_to(root):invalid('review must be inside the evaluator evidence root')
    for name in ['normalized','plan','summary','ledger']:
        if not getattr(args,name).resolve().is_relative_to(delivery):invalid('numeric artifacts must belong to the declared delivery root')
    review=read_json(review_path,'review_evidence_invalid')
    try:
        if review['format']!='l06-review-evidence/1' or review['case']!=rubric['case'] or review['submission_id']!=args.submission_id:invalid('case/submission identity must match the evaluator assignment')
        rater=review['rater']
        if type(rater['id']) is not str or not rater['id'].strip() or rater['role']!='independent_evaluator':invalid('assigned independent evaluator identity required')
        if type(rater['assignment']) is not str or not rater['assignment'].strip():invalid('record the evaluator assignment provenance')
        for name in ['input','normalized','plan','summary','ledger']:
            if Path(review['artifact_bindings'][name]).resolve()!=getattr(args,name).resolve():invalid('review targets a different artifact: '+name)
        rows=review['findings']
        if type(rows) is not list:invalid('review findings must be a list')
        result={};by_id={c['id']:c for c in criteria}
        for row in rows:
            identifier=row['id'];judgement=row['judgement']
            if type(identifier) is not str or identifier not in REVIEW_IDS or identifier in result:invalid('unique declared review leaf IDs required')
            if judgement=='evaluator_error':raise EvaluationError('review_facility_failed',row['observation'])
            if type(judgement) is not str or judgement not in RATINGS:invalid('declared review judgement required')
            if judgement=='half' and 'half' not in by_id[identifier]['anchors']:invalid('half credit requires a leaf-specific published anchor')
            if type(row['observation']) is not str or not row['observation'].strip():invalid('record the actual observation, including missing or pending evidence')
            evidence=row['evidence']
            if type(evidence) is not list:invalid('evidence must be a list of located observations')
            kinds=set()
            for item in evidence:
                if any(type(item[key]) is not str or not item[key].strip() for key in ['path','kind','locator','observation']):invalid('each evidence reference needs path/kind/locator/observation')
                path=(root/item['path']).resolve()
                if not path.is_relative_to(root) or not path.is_file():invalid('evidence must resolve to a collected file inside evaluator root')
                if 'member' in item:
                    with zipfile.ZipFile(path) as archive:
                        if item['member'] not in archive.namelist():invalid('referenced archive member is missing')
                kinds.add(item['kind'])
            if judgement not in ('unassessed','evaluator_error') and not evidence:invalid('an assessed judgement needs located evidence')
            if judgement in ('full','half') and not REQUIRED_KINDS.get(identifier,set())<=kinds:invalid('execution/visual/source evidence class missing for '+identifier)
            status,fraction=RATINGS[judgement]
            result[identifier]=finding(identifier,status,'independent_evaluator',{
                'judgement':judgement,'fraction_exact':None if fraction is None else str(fraction),
                'observation':row['observation'],'evidence':evidence,'rater':rater['id'],
                'truth_scope':'rating by the assigned independent evaluator; reference existence alone is not a functional or visual pass'})
        return result
    except (KeyError,TypeError,ValueError,OSError,zipfile.BadZipFile) as error:
        if isinstance(error,(InputError,EvaluationError)):raise
        invalid(str(error))


def weighted_total(criteria,findings):
    mapping={row['id']:row for row in findings};total=Fraction()
    for criterion in criteria:
        value=mapping[criterion['id']];status=value['status']
        if status=='unassessed':raise EvaluationError('assessment_incomplete','every leaf needs a completed assessment')
        fraction=Fraction(1) if status=='verified_pass' else Fraction(1,2) if status=='verified_partial' else Fraction(0)
        total+=Fraction(criterion['weight'])*fraction
    return total


def aggregate(rubric,criteria,findings):
    ids=[row['id'] for row in findings]
    if len(ids)!=47 or len(set(ids))!=47 or set(ids)!={c['id'] for c in criteria}:raise EvaluationError('grade_mapping_invalid','exactly the 47 declared leaves required')
    if any(row['status'] not in STATUSES for row in findings):raise EvaluationError('grade_mapping_invalid','unknown finding status')
    mapping={row['id']:row for row in findings};pending=[i for i in ids if mapping[i]['status']=='unassessed']
    failed=[c['id'] for c in criteria if c['critical'] and mapping[c['id']]['status'] in ('verified_fail','verified_partial','candidate_incomplete','blocked_candidate')]
    publication=rubric['publication'];requires=publication['requires_readiness'];readiness=rubric['readiness']
    if type(requires) is not list or not requires or any(type(k) is not str or k not in readiness or type(readiness[k]) is not bool for k in requires):raise EvaluationError('rubric_invalid','explicit typed pre-freeze readiness list required')
    threshold=publication['good_score_at_least']
    if type(threshold) is not int or not 0<=threshold<=100:raise EvaluationError('rubric_invalid','registered good-score threshold must be 0..100')
    blockers=(['rubric_not_frozen'] if rubric['status']!='frozen' else [])+['readiness:'+k for k in requires if not readiness[k]]+['unassessed:'+i for i in pending]
    result={'status':'assessment_incomplete' if pending else 'draft_assessment_complete' if blockers else 'graded',
            'fixed_denominator':100,'total_score':None,'business_success':False if failed else None,'good':None,
            'publication_blockers':blockers,'known_critical_failures':failed,'unassessed':pending,
            'counts':{status:sum(row['status']==status for row in findings) for status in STATUSES},'findings':findings}
    if not blockers:
        score=weighted_total(criteria,findings);result['total_score']=float(score) if score.denominator!=1 else score.numerator
        result['business_success']=all(mapping[c['id']]['status']=='verified_pass' for c in criteria if c['critical'])
        result['good']=result['business_success'] and score>=threshold
    return result


def assess(args):
    result={'format':'l06-complete-assessment/1','submission_id':args.submission_id,'total_score':None,'business_success':None,'good':None,'findings':[]}
    try:
        if type(args.submission_id) is not str or not args.submission_id.strip():invalid('nonempty evaluator-assigned submission identity required')
        rubric,criteria=load_rubric(args.case_root.resolve()/'rubric.json')
        if len(criteria)!=47 or set(NUMERIC_IDS)|REVIEW_IDS!={c['id'] for c in criteria}:raise EvaluationError('rubric_invalid','current L06 numeric/review coverage must be exactly 47 leaves')
        numeric=assess_numeric(args)
        if numeric['status']=='run_invalid':return {**result,**numeric,'format':result['format'],'submission_id':args.submission_id}
        reviews=review_findings(args,rubric,criteria)
        findings=[reviews.get(row['id'],row) for row in numeric['findings']]
        result.update(aggregate(rubric,criteria,findings))
        result['review_trust']='Private evaluator ratings; structural validation does not independently prove the judgement. Candidate files never supply ratings.'
    except (InputError,EvaluationError,KeyError,TypeError,ValueError,OSError) as error:
        result.update(status='run_invalid',business_success=None,infrastructure_error={'code':getattr(error,'code','rubric_invalid'),'detail':getattr(error,'detail',str(error))},findings=[])
    return result


def main():
    parser=argparse.ArgumentParser()
    for name in ['case-root','input','normalized','plan','summary','ledger','delivery-root','out']:parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--submission-id',required=True);parser.add_argument('--review',type=Path);parser.add_argument('--evidence-root',type=Path)
    args=parser.parse_args();result=assess(args)
    args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='findings'},allow_nan=False))
    raise SystemExit(3 if result['status']=='run_invalid' else 4 if result['status']=='assessment_incomplete' else 2 if result['known_critical_failures'] else 0)


if __name__=='__main__':main()
