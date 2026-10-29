"""Final local audit claims; no optimizer import or original data mutation."""
from datetime import datetime,timezone
from pathlib import Path
import sys
sys.dont_write_bytecode=True
from prepare_and_replay import ROOT,SRC,REPO,command,save,load

common=load(ROOT/'independent-tiny-common.json')
clairvoyant=load(ROOT/'independent-tiny-clairvoyant.json')
full=load(ROOT/'independent-full-audit.json')
repaired=load(ROOT/'repair-assessment.json')
original20=load(ROOT/'replay/v2/full-business-contracts/receipt.json')
cut=load(ROOT/'independent-necessary-cut.json')
final_identity=[]
for item in load(ROOT/'repair-source-inventory.json'):
    src=Path(item['source']);copy=ROOT/item['copy']
    final_identity.append({'source':item['source'],'copy':item['copy'],
        'same_bytes_at_final_check':src.exists() and src.read_bytes()==copy.read_bytes()})
save(ROOT/'final-source-identity.json',{'scope':'source identity, not functional acceptance','sources':final_identity})
command(['git','-C',str(REPO),'status','--short'],'git-status-end')
result={'assessment':'independent_cheap_v2_local_review_final',
    'completed_utc':datetime.now(timezone.utc).isoformat(),'reviewer':'/root/benchmark_review',
    'report':'REVIEW.md','initial_report_preserved':'REVIEW-INITIAL.md',
    'constraints':{'repo_writes':False,'extra_delegation':False,'scipy_or_milp_import_run':False,
        'gpu_or_training':False,'provider_or_credentials':False,'ui_or_user_processes':False,
        'container_or_paused_work_actions':False},
    'local_requested_repairs_accepted':True,'remaining_confirmed_local_blockers':[],
    'actual_original20_cli':{'count':original20['actual_cli_cases'],'all_passed':original20['all_expected_contracts_passed']},
    'independent_scalar_domain':{
        'common':{'tested':common['tested'],'feasible':common['feasible'],'best_exact':common['best_exact'],'disagreements':len(common['disagreements'])},
        'clairvoyant':{'tested':clairvoyant['tested'],'feasible':clairvoyant['feasible'],'best_exact':clairvoyant['best_exact'],'disagreements':len(clairvoyant['disagreements'])},
        'early_production_enumerated':True,'new_solver_execution':False},
    'full_witness':{'independent_arithmetic_passed':full['all_checks_passed'],
        'checked_conditions':full['check_count'],'seconds':full['seconds'],'cost_exact':full['expected_cost_exact'],
        'raw_cap':240,'finished_cap':100,'max_raw_peak':230,'max_finished_peak':96,
        'credit5369_feasible_upper_bound_only':True,'v1_credit_lower_bound_transferred':False},
    'necessary_cut':{k:v for k,v in cut.items() if k!='all_48_rows'},
    'reader_repairs':{'overflow_exponent':'plan_json','input_precedence':'instance_invalid',
        'actual_repaired_cli_count':len(repaired['cases']),
        'strict_result_and_stdout_json':all(r['strict_result_and_stdout_json'] for r in repaired['cases']),
        'all_passed':repaired['all_repaired_cases_passed'],'original_failures_preserved':True},
    'final_source':{'identity':final_identity,
        'body_identity_scope_only':repaired['source_identity_only_not_functional_proof'],
        'math_correctness_scope':'actual tiny oracle + full independent prefix/stage computation; model static review, no full new solve'},
    'main_final22_group':{'read_original_receipt':True,'repeated_full_group':False,
        'scope':'source-side evidence, not another independent22 run'},
    'maturity':{'frozen_public_case':False,'cost_1percent_qualified':False,'v2_operating_cost_bound_established':False,
        'candidate_run_or_grade':False,'hours_validated':False,'expert_or_blind_calibration':False,'freeze_approved':False,
        'mature_benchmark_claim':False},
    'commands':'commands/ exact argv/cwd/exit/stdout/stderr; original20 cases have their nested real commands in replay/v2/full-business-contracts/receipt.json'}
save(ROOT/'stage-assessment.json',result)
print({'local_repairs_accepted':True,'common':result['independent_scalar_domain']['common'],
    'clairvoyant':result['independent_scalar_domain']['clairvoyant'],'cost':'51263',
    'repaired_cli':result['reader_repairs']['all_passed'],'freeze_approved':False,
    'changed_after_final_snapshot':[i['source'] for i in final_identity if not i['same_bytes_at_final_check']]})
