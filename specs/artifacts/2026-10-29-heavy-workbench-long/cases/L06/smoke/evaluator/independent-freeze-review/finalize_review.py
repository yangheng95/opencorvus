from datetime import datetime,timezone
from pathlib import Path
import sys
sys.dont_write_bytecode=True
from review_smoke import ROOT,REPO,command,save,load

e=load(ROOT/'enumeration.json');facts=load(ROOT/'contract-facts.json')
identity=[]
for i in load(ROOT/'source-inventory.json'):
    original=Path(i['source']);copy=ROOT/i['snapshot']
    identity.append({'source':i['source'],'copy':i['snapshot'],
        'byte_equal_at_final_check':original.exists() and original.read_bytes()==copy.read_bytes()})
command(['git','-C',str(REPO),'status','--short'],'git-status-final')
result={'assessment':'S06_smoke_definition_freeze_review','completed_utc':datetime.now(timezone.utc).isoformat(),
    'reviewer':'/root/benchmark_review','smoke_definition_freeze_approved':True,'remaining_definition_blockers':[],
    'report':'REVIEW.md','read_scope':'only the five requested files, copied exactly; no candidate/reference implementation read',
    'source_identity_scope_only':identity,
    'actual_independent_arithmetic':{'method':'standard-library scalar exhaustive oracle, no evaluator or solver imported',
        'base':{'tested':e['base']['tested'],'feasible':e['base']['feasible'],'best_exact':e['base']['best_exact']},
        'price_change':{'tested':e['price-change']['tested'],'feasible':e['price-change']['feasible'],'best_exact':e['price-change']['best_exact']},
        'expected_reference_match':e['references_match'],'seconds':e['seconds'],
        'semantic_input_differences':facts['semantic_input_differences'],
        'base_optimum_strategy_at_changed_price':e['old_base_strategy_on_changed_price']},
    'actual_smoke_checks':[{'id':c['id'],'definition_reviewed':True,'actual_run_result':None} for c in facts['contract']['checks']],
    'smoke_executed':False,'smoke_pass':None,'native_lifecycle_verified':False,'actual_model_binding_verified':False,
    'candidate_source_clean_replay_verified':False,
    'candidate_export':{'allowed':'public/ only','evaluator_or_review_answer_export':False,'sandbox_or_blind_certification':False},
    'nonblocking_interpretations':['expected cost can be rational despite integer input monetary units',
        'summary field names are not frozen; no unpublished key requirements',
        'public requirement to compute from input needs source data-flow review; two outputs do not certify generalization'],
    'constraints':{'repo_writes':False,'extra_delegation':False,'provider_or_native_task':False,'milp_or_gpu':False,
        'container_or_user_process_actions':False},
    'claims':{'heavy_case_count_increment':0,'L06_heavy_case_freeze_approved':False,
        'hours_qualified':False,'difficulty_score':None,'comparable':False,'entire_benchmark_approved':False}}
save(ROOT/'stage-assessment.json',result)
print({'S06_definition_freeze_approved':True,'base':e['base']['best_exact'],'price_change':e['price-change']['best_exact'],
    'actual_smoke_results':'not run','heavy_case_increment':0,'comparable':False,
    'source_changes_since_review':[i['source'] for i in identity if not i['byte_equal_at_final_check']]})
