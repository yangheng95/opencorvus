"""Metadata-only native/Inspect audit plus final already-executed replay assessment."""
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
import shutil
import sys
import zipfile
sys.dont_write_bytecode=True
from post_review import ROOT,RUN,REPO,command,save,load

metadata=ROOT/'native-evidence';metadata.mkdir(exist_ok=False)
names=['registration.json','runtime-source-worktree.json','evidence/server-result.json','evidence/preflight.json',
       'evaluator/provider-audit-summary.json','evaluator/inspect-terminal-summary.json',
       'evidence/provider-audit/provider-84392-78cad2e9-be00-4124-bb41-f982576a6159-293.json']
inventory=[]
for name in names:
    source=RUN/name;target=metadata/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
    inventory.append({'source':str(source),'snapshot':str(target.relative_to(ROOT)),
        'byte_equal_at_copy':source.read_bytes()==target.read_bytes(),'scope':'metadata only, no prompts/reasoning/credentials'})
save(ROOT/'native-evidence-inventory.json',inventory)
task=load(RUN/'evaluator/task-final.json');status=load(RUN/'evaluator/task-status-final.json')
reg=load(metadata/'registration.json');server=load(metadata/'evidence/server-result.json');work=load(metadata/'runtime-source-worktree.json')
audit=load(metadata/'evidence/provider-audit/provider-84392-78cad2e9-be00-4124-bb41-f982576a6159-293.json')
topology=status['sessionInvocationTopology']
owned={topology['rootSessionID']}|{n['sessionID'] for n in topology['nodes']}

def summarize(reqs):
    return {'requests':len(reqs),'models':dict(Counter(r['model'] for r in reqs)),
        'streaming_true':sum(r['streaming'] is True for r in reqs),
        'http200':sum(r['status']==200 for r in reqs),
        'identity_observed':sum(r['response_reader']['identityState']=='observed' for r in reqs),
        'settled_eof':sum(r['response_reader']['state']=='settled' and r['response_reader']['terminal']['kind']=='eof' for r in reqs),
        'context_providers':dict(Counter(r['response_reader']['requestContext']['streamRequest']['providerID'] for r in reqs)),
        'context_api_models':dict(Counter(r['response_reader']['requestContext']['streamRequest']['apiModelID'] for r in reqs))}

owned_requests=[r for r in audit['requests'] if r['response_reader']['requestContext']['sessionID'] in owned]
other_requests=[r for r in audit['requests'] if r['response_reader']['requestContext']['sessionID'] not in owned]
provider={'authority':'independently recomputed from raw provider source-reader metadata audit',
    'all':summarize(audit['requests']),'task_session_lineage':summarize(owned_requests),'other_preflight':summarize(other_requests),
    'session_counts':dict(Counter(r['response_reader']['requestContext']['sessionID'] for r in audit['requests'])),
    'owned_session_ids':sorted(owned),'snapshot_file_count_is_not_request_count':True}
save(ROOT/'provider-independent-verification.json',provider)

# Only the .eval header is read. No samples/message/reasoning entries are opened.
evalpath=next((RUN/'inspect').glob('*.eval'))
with zipfile.ZipFile(evalpath) as archive:
    header=load_header=__import__('json').loads(archive.read('header.json'))
    sample_entry=f"samples/{task['metadata']['inspect']['sample_id']}_epoch_1.json"
    named_sample_in_archive=sample_entry in archive.namelist()
inspect={'source_file':str(evalpath),'read_entry_only':'header.json',
    'status':header['status'],'results':header.get('results'),'eval_id':header['eval']['eval_id'],
    'task':header['eval']['task'],'model_placeholder':header['eval']['model'],
    'sample_metadata_id':task['metadata']['inspect']['sample_id'],'named_sample_entry_present':named_sample_in_archive,
    'sample_contents_read':False,'score_scope':'task_completed is lifecycle only'}
save(ROOT/'inspect-independent-header.json',inspect)
score=next(r for r in header['results']['scores'] if r['name']=='task_completed')
stream=provider['task_session_lineage'];n=stream['requests']
native_pass=(task['id']=='tsk_g00VZR9KuE00aKSMSF10' and task['status']=='completed' and
    task['executionLifecycle']['status']=='completed' and task['terminalReason']=='completed' and
    status['status']=='inactive' and status['lifecycleStatus']=='completed' and status['activity']['running']==0 and
    header['status']=='success' and header['results']['completed_samples']==1 and score['metrics']['accuracy']['value']==1 and named_sample_in_archive and
    n>0 and stream['models']=={'gpt-6.1-sol':n} and stream['context_providers']=={'openai':n} and
    stream['context_api_models']=={'gpt-6.1-sol':n} and all(stream[k]==n for k in ('streaming_true','http200','identity_observed','settled_eof')))
replay=load(ROOT/'replay-assessment.json');rows=load(ROOT/'independent-artifact-checks.json')
checks=[
    {'id':'native-completion','passed':bool(native_pass),'evidence':['api-terminal-observation.json','provider-independent-verification.json','inspect-independent-header.json'],
     'native_seconds':(task['time']['completed']-task['time']['started'])/1000},
    {'id':'sealed-business-feasibility','passed':all(r['business_feasible'] and r['all_passed'] for r in rows if r['kind']=='sealed'),
     'evidence':['business-checks/sealed-base.json','business-checks/sealed-price-change.json','independent-artifact-checks.json']},
    {'id':'known-small-optima','passed':all(r['all_passed'] for r in rows),
     'exact_costs':{'base':'9/2','price-change':'11/2'},'evidence':['independent-optima/base.json','independent-optima/price-change.json','independent-artifact-checks.json']},
    {'id':'full-clean-source-replay','passed':replay['all_replays_exit0'] and all(r['all_passed'] for r in rows if r['kind']=='reviewer-cold-replay'),
     'evidence':['cold-replay-initial-inventory.json','commands/solve-base.json','commands/solve-price-change.json','replay-assessment.json']}
]
solve=[load(ROOT/'commands'/f'solve-{c}.json') for c in ('base','price-change')]
checker=[load(ROOT/'commands'/f'check-{kind}-{c}.json') for c in ('base','price-change') for kind in ('sealed','reviewer-cold-replay')]
timings={'reviewer_candidate_runs_seconds':[r['seconds'] for r in solve],
    'reviewer_candidate_runs_total_seconds':sum(r['seconds'] for r in solve),
    'reviewer_four_checker_runs_seconds':[r['seconds'] for r in checker],
    'reviewer_four_checker_runs_total_seconds':sum(r['seconds'] for r in checker),
    'reviewer_solve_and_checker_total_seconds':sum(r['seconds'] for r in solve+checker),
    'scope':'subprocess wall time on this host; does not include source inspection/metadata review; not a ranking'}
actors=[{'agent':x['agent'],'kind':x['kind'],'sessionID':x['sessionID'],'parentSessionID':x.get('parentAgentSessionID',x.get('parentSessionID'))} for x in topology['nodes']]
result={'assessment':'independent_nonblind_S06_smoke_post_review','completed_utc':datetime.now(timezone.utc).isoformat(),
    'task_id':task['id'],'checks':checks,'smoke_pass':all(c['passed'] for c in checks),
    'timing':timings,'cost_scope':'synthetic expected operational minor units only: base4.5/price-change5.5; no LLM monetary cost ranking',
    'native_actor_footprint':actors,'native_child_count':sum(a['kind']=='delegated-worker' for a in actors),
    'single_agent_claim':False,'reviewer_additional_delegation':False,
    'source_read_review':'sealed solve.py uses supplied input data for finite exact search; reads no prior output; imports only stdlib; README and summary content were not new scoring keys',
    'runtime_source_identity':{'registered_commit':reg['runtimeSourceCommit'],'server_commit':server['registration']['runtimeSourceCommit'],
        'worktree_head':work['head'],'dirty_file_count':len(work['status']),
        'meaning':'runtime commit alone is not fully reconstructable executed source; dirty worktree retained; comparable false'},
    'candidate_git':load(ROOT/'original-evaluator/candidate-git.json'),
    'cleanup_from_server_receipt':{'outcome':server['outcome'],'cleanup':server['cleanup'],
        'reviewer_live_service_or_credentials_access':False},
    'inspect_scope_note':'none/none is the adapter placeholder; actual provider model is the raw-audited openai/gpt-6.1-sol; lifecycle score is not business math score',
    'warnings_from_main_receipt':'Windows optional AF_UNIX control-plane warning was reported by main evaluator; sample/header successful. Reviewer did not read reasoning-bearing stdout or claim warning repaired.',
    'claims':{'review_type':'non-blind development review','comparable':False,'heavy_case_count_increment':0,
        'L06_heavy_case_passed':False,'L06_one_percent_cost_approved':False,'hours_validated':False,'benchmark_mature':False,
        'blind_or_single_agent_certification':False},
    'constraints':{'new_provider_or_native_task':False,'gpu_or_milp':False,'container_or_user_process_action':False,
        'repo_writes':False,'credential_or_reasoning_body_read':False}}
save(ROOT/'stage-assessment.json',result)
command(['git','-C',str(REPO),'status','--short'],'git-status-final')
print({'smoke_pass':result['smoke_pass'],'checks':[{k:v for k,v in c.items() if k in ('id','passed')} for c in checks],
    'timing':timings,'task_requests':stream['requests'],'preflight_other_requests':provider['other_preflight']['requests'],
    'runtime_commit':reg['runtimeSourceCommit'],'runtime_dirty_count':len(work['status']),
    'native_child_count':result['native_child_count'],'comparable':False})
