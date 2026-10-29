"""Real CLI contracts and exact aggregation fixtures, not candidate assessments."""
import argparse,copy,json,shutil,subprocess,sys,time,zipfile
from pathlib import Path

from l06_numeric import load_rubric,NUMERIC_IDS
from l06_grade import aggregate,REVIEW_IDS


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--case-root',type=Path,required=True);parser.add_argument('--reference-delivery',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    root=args.output.resolve();root.mkdir(parents=True,exist_ok=False);source=root/'source';source.mkdir()
    for name in ['l06_input.py','check_l06.py','l06_packet.py','l06_delivery.py','l06_numeric.py','l06_grade.py','qualify_grading.py']:shutil.copy2(Path(__file__).parent/name,source/name)
    case=root/'case';case.mkdir();shutil.copytree(args.case_root/'public',case/'public');shutil.copy2(args.case_root/'rubric.json',case/'rubric.json')
    fixture_rubric=json.loads((case/'rubric.json').read_text(encoding='utf8'))
    fixture_rubric['status']='draft_not_frozen'
    (case/'rubric.json').write_text(json.dumps(fixture_rubric,indent=2)+'\n')
    relative='evaluator/qualification/v2/integer-search/quality-reference';destination=case/relative;destination.mkdir(parents=True)
    for name in ['registered-reference.json','originals.zip','price-control.zip']:shutil.copy2(args.case_root/relative/name,destination/name)
    delivery=root/'delivery';delivery.mkdir()
    for name in ['normalized.json','plan.json','summary.json','ledger.json']:shutil.copy2(args.reference_delivery/name,delivery/name)
    evidence=root/'evidence';evidence.mkdir();(evidence/'protocol-fixture.json').write_text(json.dumps({'scope':'synthetic rating and locator contract only; these ratings are not an actual independent evaluation'}))
    bindings={'input':str((case/'public/inputs').resolve()),**{name:str(delivery/(name+'.json')) for name in ['normalized','plan','summary','ledger']}}
    rubric,criteria=load_rubric(case/'rubric.json')
    kinds=['process_receipt','source_audit','business_oracle','rendered_figure','report_or_table']
    fixture={'format':'l06-review-evidence/1','case':'L06','submission_id':'protocol-fixture-only','rater':{'id':'synthetic-protocol-fixture','role':'independent_evaluator','assignment':'Qualification fixture, not an actual reviewer or candidate grade.'},'artifact_bindings':bindings,'findings':[
        {'id':c['id'],'judgement':'full','observation':'Synthetic full-anchor rating to exercise the parser; not an independent assessment.','evidence':[{'path':'evidence/protocol-fixture.json','kind':kind,'locator':'scope','observation':'Explicitly synthetic fixture for evidence-reference validation.'} for kind in kinds]}
        for c in criteria if c['id'] in REVIEW_IDS]}
    reviews=root/'ratings';reviews.mkdir()
    def rating(name,value):p=reviews/(name+'.json');p.write_text(json.dumps(value,indent=2)+'\n');return p
    defaults={'case_root':case,'input':case/'public/inputs','normalized':delivery/'normalized.json','plan':delivery/'plan.json','summary':delivery/'summary.json','ledger':delivery/'ledger.json','delivery_root':delivery,'submission_id':'protocol-fixture-only'}
    events=[];start=time.perf_counter()
    def run(label,expected_status,expected_exit,review=None,code=None,**changes):
        output=root/'executions'/label;output.mkdir(parents=True);values=defaults|changes
        if review is not None:values|={'review':review,'evidence_root':root}
        cmd=[sys.executable,'-B',str(source/'l06_grade.py')]
        for key,value in values.items():cmd+=['--'+key.replace('_','-'),str(value)]
        cmd+=['--out',str(output/'assessment.json')];before=time.perf_counter();process=subprocess.run(cmd,capture_output=True,text=True)
        (output/'stdout.log').write_text(process.stdout);(output/'stderr.log').write_text(process.stderr)
        event={'name':label,'argv':cmd,'exit_code':process.returncode,'seconds':time.perf_counter()-before};events.append(event)
        (root/'progress.json').write_text(json.dumps({'status':'in_progress','executions':events},indent=2)+'\n')
        assert process.returncode==expected_exit,(label,event,process.stderr)
        result=json.loads((output/'assessment.json').read_text(encoding='utf8'));assert result['status']==expected_status,(label,result)
        assert result['total_score'] is None,(label,'current draft must not publish scores')
        if code:assert result['infrastructure_error']['code']==code,(label,result)
        return result
    missing=run('missing-evaluator-ratings','assessment_incomplete',4);assert len(missing['unassessed'])==17 and missing['business_success'] is None
    complete=run('complete-draft-evidence','draft_assessment_complete',0,rating('all-full',fixture));assert complete['counts']['verified_pass']==47 and complete['business_success'] is None
    partial=copy.deepcopy(fixture);partial['findings']=[row for row in partial['findings'] if row['id']!='E06']
    result=run('one-pending-review','assessment_incomplete',4,rating('one-pending',partial));assert result['unassessed']==['E06']
    half=copy.deepcopy(fixture);next(row for row in half['findings'] if row['id']=='E06')['judgement']='half'
    result=run('specific-half-anchor','draft_assessment_complete',0,rating('half',half));assert result['counts']['verified_partial']==1
    failure=copy.deepcopy(fixture);next(row for row in failure['findings'] if row['id']=='D01')['judgement']='candidate_incomplete'
    result=run('critical-candidate-incomplete','draft_assessment_complete',2,rating('candidate-incomplete',failure));assert result['business_success'] is False and result['known_critical_failures']==['D01']
    wronghalf=copy.deepcopy(fixture);next(row for row in wronghalf['findings'] if row['id']=='D01')['judgement']='half'
    run('binary-half-error','run_invalid',3,rating('binary-half',wronghalf),'review_evidence_invalid')
    mismatch=copy.deepcopy(fixture);mismatch['submission_id']='another-submission'
    run('submission-binding-error','run_invalid',3,rating('wrong-submission',mismatch),'review_evidence_invalid')
    for label,identity in [('empty-submission-id',''),('whitespace-submission-id','   ')]:
        invalid_id=copy.deepcopy(fixture);invalid_id['submission_id']=identity
        run(label,'run_invalid',3,rating(label,invalid_id),'review_evidence_invalid',submission_id=identity)
    mismatch=copy.deepcopy(fixture);mismatch['artifact_bindings']['plan']=str(delivery/'another-plan.json')
    run('artifact-binding-error','run_invalid',3,rating('wrong-artifact',mismatch),'review_evidence_invalid')
    duplicate=copy.deepcopy(fixture);duplicate['findings'].append(duplicate['findings'][0])
    run('duplicate-review-error','run_invalid',3,rating('duplicate',duplicate),'review_evidence_invalid')
    visual=copy.deepcopy(fixture);next(row for row in visual['findings'] if row['id']=='F04')['evidence']=[{'path':'evidence/protocol-fixture.json','kind':'report_or_table','locator':'scope','observation':'A report reference supplies no rendered-figure observation.'}]
    run('visual-evidence-class-error','run_invalid',3,rating('visual-class',visual),'review_evidence_invalid')
    broken=copy.deepcopy(fixture);broken['findings'][0]['evidence'][0]['path']='uncollected-evidence.json'
    run('uncollected-evidence-error','run_invalid',3,rating('uncollected',broken),'review_evidence_invalid')
    internal=delivery/'candidate-ratings.json';internal.write_text(json.dumps(fixture))
    run('candidate-rating-location-error','run_invalid',3,internal,'review_evidence_invalid')
    facility=copy.deepcopy(fixture);facility['findings'][0]['judgement']='evaluator_error';facility['findings'][0]['observation']='Explicit synthetic evaluator execution failure.'
    run('evaluator-failure','run_invalid',3,rating('facility',facility),'review_facility_failed')
    # Pure aggregation algebra on a declared frozen protocol projection. This is
    # not the current case configuration, a candidate grade or freeze approval.
    projection=copy.deepcopy(rubric);projection['status']='frozen'
    for name in projection['publication']['requires_readiness']:projection['readiness'][name]=True
    checks=[]
    def exact(label,rows,score,success,good):
        value=aggregate(projection,criteria,rows);assert value['status']=='graded' and value['fixed_denominator']==100
        assert (value['total_score'],value['business_success'],value['good'])==(score,success,good),(label,value)
        checks.append({'fixture':label,'exact_points':score,'critical_success':success,'good':good,'scope':'aggregation algebra only, not a case score'})
    exact('full',complete['findings'],100,True,True)
    rows=copy.deepcopy(complete['findings']);next(row for row in rows if row['id']=='D01')['status']='candidate_incomplete'
    exact('missing-critical-keeps-denominator',rows,93,False,False)
    rows=copy.deepcopy(complete['findings']);next(row for row in rows if row['id']=='D02')['status']='verified_fail'
    exact('input-variation-failure-is-critical',rows,96,False,False)
    rows=copy.deepcopy(complete['findings']);human={c['id'] for c in criteria if 'half' in c['anchors']}
    for row in rows:
        if row['id'] in human:row['status']='verified_partial'
    exact('all-human-half',rows,88,True,False)
    rows=copy.deepcopy(complete['findings']);next(row for row in rows if row['id']=='C06')['status']='verified_fail';weight=next(c['weight'] for c in criteria if c['id']=='C06')
    exact('quality-failure-cannot-be-compensated',rows,100-weight,False,False)
    blocked=copy.deepcopy(projection);blocked['readiness']['review_calibration']=False;value=aggregate(blocked,criteria,complete['findings'])
    assert value['status']=='draft_assessment_complete' and value['total_score'] is None and value['business_success'] is None
    (root/'aggregation-fixtures.json').write_text(json.dumps({'scope':'synthetic protocol fixtures only','checks':checks,'readiness_pending_observation':value['publication_blockers']},indent=2)+'\n')
    receipt={'status':'passed','scope':'actual CLI contracts and synthetic aggregation algebra; no candidate ratings, full-case freeze or hours approval','actual_cli_count':len(events),'seconds':time.perf_counter()-start,'executions':events}
    (root/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({k:v for k,v in receipt.items() if k!='executions'}))


if __name__=='__main__':main()
