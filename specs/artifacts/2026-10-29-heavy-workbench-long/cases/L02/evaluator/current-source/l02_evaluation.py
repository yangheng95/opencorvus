"""Private source-bound evaluation assignment and grade; never runs a candidate."""
from pathlib import Path
import tempfile
import uuid

from l02_execution import (ExecutionError, archived_json, atomic_bytes, candidate_json,
    json_bytes, read_archive, regular_bytes, timestamp, unzip_bytes, zip_bytes)
from l02_quality import load_quality_policy, load_registered_reference, assess_quality
from l02_report import identity_key
from l02_rubric import load_rubric, aggregate, STATUSES
from l02_sealed import inspect_run
from material_contract import read_json


def nonempty(value, label):
    if type(value) is not str or not value.strip():
        raise ExecutionError('facility_evaluation_assignment_invalid', 'nonempty ' + label + ' required')
    return value


def private_path(path, candidate_root, run_root):
    actual=path.resolve()
    if actual.is_relative_to(candidate_root.resolve()) or actual.is_relative_to(run_root.resolve()):
        raise ExecutionError('facility_evaluation_location_invalid', 'evaluation/review must be outside candidate and execution roots')
    return actual


def evaluation_facts(files, inspection):
    with tempfile.TemporaryDirectory(prefix='l02-grade-authority-') as tmp:
        root=Path(tmp)
        for name in ('rubric.json','quality-policy.json','reference.zip','reference-method.json'):
            (root/name).write_bytes(files[name])
        rubric,criteria=load_rubric(root/'rubric.json')
        policy=load_quality_policy(root/'quality-policy.json')
        method=read_json(root/'reference-method.json',decimal_numbers=True)
        reference,contexts,labels,origins=load_registered_reference(root/'reference.zip',inspection['data'],inspection['study'],policy,method)
    return rubric,criteria,policy,reference,contexts,labels,origins


def prepare(run, candidate_root, rubric_path, policy_path, reference_path, method_path,
            submission_id, reviewer_id, subject_role, out):
    nonempty(submission_id,'submission ID');nonempty(reviewer_id,'assigned reviewer ID')
    if subject_role not in ('candidate','reference_qualification','protocol_control'):
        raise ExecutionError('facility_evaluation_assignment_invalid','explicit subject role required')
    private_path(out,candidate_root,run)
    out.mkdir(parents=True,exist_ok=False)
    inspection=inspect_run(run)
    files={'rubric.json':rubric_path.read_bytes(),'quality-policy.json':policy_path.read_bytes(),
           'reference.zip':reference_path.read_bytes(),'reference-method.json':method_path.read_bytes(),
           **{'execution/'+name:value for name,value in inspection['originals'].items()}}
    rubric,_,_,_,_,_,_=evaluation_facts(files,inspection)
    if inspection['summary']['status']=='run_invalid':
        raise ExecutionError('facility_sealed_run_invalid',str(inspection['summary']['facility_findings']))
    assignment={'format':'l02-evaluation-assignment/1','assignment_id':uuid.uuid4().hex,
        'created_at':timestamp(),'case_version':rubric['version'],'anchor_version':rubric['anchor_version'],
        'submission_id':submission_id,'subject_role':subject_role,'run_id':inspection['run_id'],
        'candidate_root':str(candidate_root.resolve()),'run_root':str(run.resolve()),
        'reviewer_id':reviewer_id,'reviewer_kind':'assigned_ai_agent',
        'truth_limit':'private operational assignment and original object binding do not authenticate scientific judgements; independent content review and calibration remain required'}
    files['assignment.json']=json_bytes(assignment)
    atomic_bytes(out/'assignment.zip',zip_bytes(files))
    atomic_bytes(out/'inspection-at-assignment.json',json_bytes(inspection['summary']))
    return assignment


def load_assignment(path, run):
    # The path names a specific immutable collected object, not a source hash gate.
    raw=regular_bytes(path.parent,[path.name])[path.name];files=unzip_bytes(raw)
    header=archived_json(files,'assignment.json')
    if type(header) is not dict or header.get('format')!='l02-evaluation-assignment/1':
        raise ExecutionError('facility_evaluation_assignment_invalid','unknown assignment format')
    for key in ('assignment_id','submission_id','reviewer_id','run_id','case_version','anchor_version','candidate_root','run_root'):
        nonempty(header.get(key),key)
    if header.get('subject_role') not in ('candidate','reference_qualification','protocol_control') or header.get('reviewer_kind')!='assigned_ai_agent':
        raise ExecutionError('facility_evaluation_assignment_invalid','assigned subject/reviewer role required')
    private_path(path,Path(header['candidate_root']),run)
    inspection=inspect_run(run)
    # Preflight the fixed external authority even when a candidate result is bad.
    facts=evaluation_facts(files,inspection)
    rubric=facts[0]
    if header['case_version']!=rubric['version'] or header['anchor_version']!=rubric['anchor_version'] or header['run_id']!=inspection['run_id']:
        raise ExecutionError('facility_evaluation_binding_invalid','original run or rubric/anchor version differs')
    if 'execution/ledger-snapshot.json' not in files:
        raise ExecutionError('facility_evaluation_stage_unbound','prototype assignment did not capture its original logical execution stage; collect a fresh assignment without rewriting it')
    captured={name[10:]:value for name,value in files.items() if name.startswith('execution/')}
    if captured!=inspection['originals']:
        raise ExecutionError('facility_evaluation_binding_invalid','current canonical execution objects differ from the collected immutable originals')
    if inspection['summary']['status']=='run_invalid':
        raise ExecutionError('facility_sealed_run_invalid',str(inspection['summary']['facility_findings']))
    return raw,files,header,inspection,facts


def original_failure_roots(inspection,identities):
    """Resolve intermediate blocked nodes to the actual original candidate failures."""
    cells={identity_key(c['identity']):c for c in inspection['summary']['cells']}
    roots={};visited=set()
    def visit(identity):
        key=identity_key(identity)
        if key in visited:return
        visited.add(key);cell=cells[key]
        if cell['outcome']=='candidate_failed':roots[key]=identity
        elif cell['outcome']=='blocked_candidate':
            for parent in cell['dependencies']:visit(parent)
        else:raise ExecutionError('facility_review_dependency_invalid','dependency is not an actual candidate failure or its blocked descendant')
    for identity in identities:visit(identity)
    return list(roots.values())


def failure_sources(inspection,roots):
    values=[]
    for identity in roots:
        record=inspection['records'][identity_key(identity)]
        values.append({'object':'execution/cells/'+str(record['cell']['id'])+'/terminal.zip','member':None,
            'locator':'original terminal/output and the independently rechecked typed failure'})
    if roots:values.append({'object':'execution/ledger-snapshot.json','member':None,'locator':'actual original failed cell and failure reason'})
    return values


def research_execution(row,inspection):
    summary=inspection['summary']
    finding={'id':row['id'],'status':'unassessed','basis':'formal full assignment required','sources':[],'dependency_roots':[]}
    if not summary['formal_full_assignment']:return finding
    cells=[c for c in summary['cells'] if c['identity']['kind'] in (('predict','select') if row['source_rule']=='full_numeric' else ('select',))]
    failed=[c for c in cells if c['outcome']=='candidate_failed'];blocked=[c for c in cells if c['outcome']=='blocked_candidate']
    if failed:
        finding.update(status='verified_fail',basis='actual required numerical execution/checker failed',dependency_roots=[c['identity'] for c in failed])
    elif blocked:
        finding.update(status='blocked_candidate',basis='actual required candidate inputs blocked execution',dependency_roots=[c['identity'] for c in blocked])
    elif all(c['outcome']=='verified' for c in cells):
        finding.update(status='verified_pass',basis='complete original assigned native/input/output/checker evidence closed')
    else:finding['basis']='independent assigned work or host assessment remains unassessed'
    finding['dependency_roots']=original_failure_roots(inspection,finding['dependency_roots'])
    finding['observed_outcomes']=[{'identity':c['identity'],'outcome':c['outcome'],'reason':c['reason'],'dependencies':c['dependencies']} for c in cells]
    finding['sources']=failure_sources(inspection,finding['dependency_roots'])
    for c in cells:
        record=inspection['records'].get(identity_key(c['identity']))
        if record is not None:
            kind='accepted' if c['outcome']=='verified' else 'terminal'
            finding['sources'].append({'object':'execution/cells/'+str(c['cell_id'])+'/'+kind+'.zip','member':'terminal-inspect.json','locator':'original source/argv/CID/exit and typed checker closure'})
    return finding


def quality_findings(criteria,inspection,facts):
    rubric,_,policy,reference,contexts,labels,origins=facts
    rows=[r for r in criteria if r['quality']]
    def pending(status,basis,roots):
        roots=original_failure_roots(inspection,roots)
        return [{'id':r['id'],'status':status,'basis':basis,'sources':failure_sources(inspection,roots),'dependency_roots':roots} for r in rows],None
    if not inspection['summary']['formal_full_assignment']:
        return pending('unassessed','formal full assignment required',[])
    by_key={identity_key(c['identity']):c for c in inspection['summary']['cells']}
    cases={};roots=[];unassessed=[];selected_sources=[]
    for outer in origins:
        selected_identity={'kind':'select','outer_id':outer};key=identity_key(selected_identity);cell=by_key[key]
        if cell['outcome']!='verified':
            (roots if cell['outcome'] in ('candidate_failed','blocked_candidate') else unassessed).append(selected_identity);continue
        selected=inspection['records'][key]
        method=candidate_json(selected['accepted'],'output/result/selection.json')['selected_method_id']
        identity={'kind':'predict','outer_id':outer,'origin_id':outer,'method_id':method,'level':'outer'}
        pkey=identity_key(identity);prediction=by_key[pkey]
        if prediction['outcome']!='verified':
            (roots if prediction['outcome'] in ('candidate_failed','blocked_candidate') else unassessed).append(identity);continue
        record=inspection['records'][pkey]
        cases[outer]={'method_id':method,'forecast':candidate_json(record['accepted'],'output/result/forecast.json',True)}
        selected_sources.extend([{'object':'execution/cells/'+str(selected['cell']['id'])+'/accepted.zip','member':'output/result/selection.json','locator':'actual selected method ID'},
            {'object':'execution/cells/'+str(record['cell']['id'])+'/accepted.zip','member':'output/result/forecast.json','locator':'that selected method at this outer'}])
    if roots:return pending('blocked_candidate','complete selected policy depends on actual failed candidate inputs',roots)
    if unassessed:return pending('unassessed','selected policy remains unevaluated on the fixed complete origin grid',[])
    result=assess_quality(cases,reference,contexts,labels,origins,inspection['study'],policy)
    actual={'Q.'+r['id']:r for r in result['leaves']}
    if set(actual)!={r['id'] for r in rows}:
        raise ExecutionError('facility_grade_mapping_invalid','registered quality rules do not cover the exact rubric grid')
    return [{'id':r['id'],'status':'verified_pass' if actual[r['id']]['passed'] else 'verified_fail',
        'basis':'exact original selected-policy loss against assigned fixed external reference',
        'observation':actual[r['id']],'sources':selected_sources,'dependency_roots':[]} for r in rows],result


def review_findings(review_root,assignment_raw,files,header,inspection,criteria,run):
    manual=[r for r in criteria if r['method']=='independent_evaluator_review']
    pending=[{'id':r['id'],'status':'unassessed','basis':'assigned independent review not completed','sources':[],'dependency_roots':[]} for r in manual]
    if review_root is None:return pending
    private_path(review_root,Path(header['candidate_root']),run)
    private_path(review_root,Path(header['candidate_root']),Path(header['run_root']))
    if not review_root.exists() or review_root.is_dir() and not (review_root/'review.json').exists():return pending
    if not review_root.is_dir():
        raise ExecutionError('facility_review_schema_invalid','private review directory required')
    try:received=regular_bytes(review_root,['assignment.zip'])['assignment.zip']
    except (ExecutionError,OSError) as e:
        raise ExecutionError('facility_review_binding_invalid','original received assignment object required') from e
    if received!=assignment_raw:
        raise ExecutionError('facility_review_binding_invalid','reviewer received a different immutable assignment/object bundle')
    value=read_json(review_root/'review.json')
    required={'format','assignment_id','submission_id','reviewer_id','anchor_version','disclosure','findings'}
    if type(value) is not dict or set(value)!=required or value['format']!='l02-independent-review/1' or any(value[k]!=header[k] for k in ('assignment_id','submission_id','reviewer_id','anchor_version')):
        raise ExecutionError('facility_review_binding_invalid','assigned reviewer/submission/anchor identity differs')
    disclosure=value['disclosure']
    if type(disclosure) is not dict or set(disclosure)!={'kind','blinded','familiarity','limitations'} or disclosure['kind']!='ai-agent' or type(disclosure['blinded']) is not bool:
        raise ExecutionError('facility_review_schema_invalid','actual review mode and limitations required')
    for k in ('familiarity','limitations'):nonempty(disclosure[k],'review '+k)
    findings=value['findings']
    if type(findings) is not list or any(type(r) is not dict or type(r.get('id')) is not str for r in findings):
        raise ExecutionError('facility_review_schema_invalid','typed research finding IDs required')
    ids=[r['id'] for r in findings]
    if len(ids)!=len(set(ids)) or set(ids)!={r['id'] for r in manual}:
        raise ExecutionError('facility_review_schema_invalid','every assigned research leaf once, including unassessed')
    actual_roots={identity_key(c['identity']) for c in inspection['summary']['cells'] if c['outcome'] in ('candidate_failed','blocked_candidate')}
    for row in findings:
        if type(row) is not dict or set(row)!={'id','status','basis','sources','dependency_roots'} or type(row['status']) is not str or row['status'] not in STATUSES:
            raise ExecutionError('facility_review_schema_invalid','typed per-leaf status/basis/sources/dependencies required')
        nonempty(row['basis'],'actual review observation')
        if type(row['sources']) is not list or type(row['dependency_roots']) is not list:
            raise ExecutionError('facility_review_schema_invalid','source and dependency lists required')
        if row['status']!='unassessed' and not row['sources']:
            raise ExecutionError('facility_review_source_invalid','assessed leaf requires actual original object locator')
        for source in row['sources']:
            if type(source) is not dict or set(source)!={'object','member','locator'} or type(source['object']) is not str or not source['object'].startswith('execution/') or source['object'] not in files:
                raise ExecutionError('facility_review_source_invalid','original execution object required')
            nonempty(source['locator'],'specific source locator')
            if source['member'] is not None:
                nonempty(source['member'],'original member')
                if source['member'] not in unzip_bytes(files[source['object']]):
                    raise ExecutionError('facility_review_source_invalid','referenced original member differs or is missing')
        if any(identity_key(i) not in actual_roots for i in row['dependency_roots']) or row['status']=='blocked_candidate' and not row['dependency_roots']:
            raise ExecutionError('facility_review_dependency_invalid','actual candidate dependency roots required')
    return findings


def grade(assignment_path,run,review_root=None):
    raw,files,header,inspection,facts=load_assignment(assignment_path,run)
    rubric,criteria,*_=facts
    quality,quality_result=quality_findings(criteria,inspection,facts)
    manual=review_findings(review_root,raw,files,header,inspection,criteria,run)
    machine=[research_execution(r,inspection) for r in criteria if r['method']=='registered_execution_checker']
    mapping={r['id']:r for r in [*quality,*manual,*machine]}
    findings=[]
    for criterion in criteria:
        findings.append({**mapping[criterion['id']],'weight':criterion['weight'],'critical':criterion['critical'],
            'quality':criterion['quality'],'method':criterion['method'],'rule_version':rubric['anchor_version']})
    result=aggregate(rubric,criteria,findings)
    return {**result,'format':'l02-source-bound-assessment/1','assignment_id':header['assignment_id'],
        'submission_id':header['submission_id'],'subject_role':header['subject_role'],
        'case_version':header['case_version'],'anchor_version':header['anchor_version'],
        'formal_full_assignment':inspection['summary']['formal_full_assignment'],
        'findings':findings,'quality':quality_result,'execution_inspection':inspection['summary'],
        'truth_limit':'schema/object binding is not scientific truth; assigned content review, calibration and full reference qualification remain separate evidence'}
