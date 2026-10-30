"""Private evaluator CLI. This never invokes a candidate programme or Provider."""
import argparse
import json
from pathlib import Path

from l02_evaluation import prepare, grade, private_path
from l02_execution import archived_json, atomic_bytes, json_bytes, read_archive


def main(argv=None):
    parser=argparse.ArgumentParser();commands=parser.add_subparsers(dest='command',required=True)
    build=commands.add_parser('prepare')
    for key in ('run','candidate-root','rubric','quality-policy','reference','reference-method','out'):
        build.add_argument('--'+key,type=Path,required=True)
    for key in ('submission-id','reviewer-id'):
        build.add_argument('--'+key,required=True)
    build.add_argument('--subject-role',choices=['candidate','reference_qualification','protocol_control'],required=True)
    assess=commands.add_parser('grade')
    for key in ('assignment','run','out'):assess.add_argument('--'+key,type=Path,required=True)
    assess.add_argument('--review',type=Path)
    args=parser.parse_args(argv)
    try:
        if args.command=='prepare':
            result=prepare(args.run,args.candidate_root,args.rubric,args.quality_policy,args.reference,args.reference_method,
                args.submission_id,args.reviewer_id,args.subject_role,args.out)
            print(json.dumps({'status':'evaluation_assigned','assignment_id':result['assignment_id'],
                'subject_role':result['subject_role'],'candidate_score':None}),flush=True)
            return 0
        header=archived_json(read_archive(args.assignment),'assignment.json')
        private_path(args.out,Path(header['candidate_root']),args.run)
        args.out.mkdir(parents=True,exist_ok=False)
        result=grade(args.assignment,args.run,args.review)
        atomic_bytes(args.out/'assessment.json',json_bytes(result))
        print(json.dumps({k:result[k] for k in ('status','submission_id','subject_role','total_score','study_complete','quality_success','good','counts','known_critical_failures')}),flush=True)
        return 0 if result['status']=='graded' else 4
    except Exception as e:
        code=getattr(e,'code','facility_evaluation_invalid')
        if not code.startswith('facility_') and code!='run_busy':code='facility_evaluation_invalid'
        print(json.dumps({'status':'assessment_incomplete' if code=='run_busy' else 'run_invalid',
            'error':code,'detail':str(e),'candidate_score':None}),flush=True)
        return 4 if code=='run_busy' else 3


if __name__=='__main__':raise SystemExit(main())
