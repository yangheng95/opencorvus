"""Seal factual v1 review claims; no optimization or original artifact writes."""
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
sys.dont_write_bytecode=True
from prepare_and_replay import ROOT, SRC, SNAP, REPO, command, save

tiny=json.loads((ROOT/'independent-tiny-enumeration.json').read_text(encoding='utf-8'))
full=json.loads((ROOT/'independent-full-prefix-audit.json').read_text(encoding='utf-8'))
boundaries=json.loads((ROOT/'reader-boundary-results.json').read_text(encoding='utf-8'))
native=json.loads((ROOT/'native-count-check.json').read_text(encoding='utf-8'))
oldcredit=json.loads((ROOT/'replay/original-credit-same-plan.json').read_text(encoding='utf-8'))
lineage=json.loads((ROOT/'input-lineage.json').read_text(encoding='utf-8'))
own_runs=[json.loads(p.read_text(encoding='utf-8')) for p in sorted((ROOT/'commands').glob('*.json'))
          if 'tool-receipt' not in p.name and not p.name.startswith('git-status')]
source_identity=[]
for item in json.loads((ROOT/'source-inventory.json').read_text(encoding='utf-8')):
    origin=Path(item['source']);copy=ROOT/item['snapshot']
    source_identity.append({'source':item['source'],'snapshot':item['snapshot'],
        'current_origin_still_byte_equal':origin.exists() and origin.read_bytes()==copy.read_bytes()})
save(ROOT/'source-final-identity.json',{'scope':'source version identity only, not functional acceptance','sources':source_identity})
command(['git','-C',str(REPO),'status','--short'],'git-status-end')
result={'assessment':'independent_cheap_v1_qualification_review',
    'completed_utc':datetime.now(timezone.utc).isoformat(),
    'reviewer':'/root/benchmark_review','review_report':'REVIEW.md',
    'writes':'new external review directory only; old count already12, old data/commands retained',
    'scope_constraints':{'additional_delegation':False,'repo_changes':False,'milp_or_scipy_execution':False,
        'gpu_or_training':False,'provider_or_credentials':False,'ui_or_user_processes':False,
        'container_actions':False,'resume_paused_work':False},
    'native_count':{'actual':native['actual_check_count'],'existing_report_correct':native['current_report_matches_count'],
        'old_json_or_command_modified':False},
    'tiny_actual':{'original_script_enumerated':324,'original_script_feasible':22,'original_nine_contracts_passed':9,
        'independent_scalar_enumerated':tiny['enumerated'],'independent_scalar_feasible':tiny['feasible'],
        'independent_best_exact':tiny['best_exact'],'all_choice_results_agree':len(tiny['disagreements'])==0,
        'without_common_commitment_best':tiny['clairvoyant_without_common_constraint_best'],
        'limits':'v1 zero end-FG capacity fixes production; not transferable as full enumeration to v2'},
    'full_v1_actual':{'end_of_week_abstraction_business_feasible':full['all_checks_passed'],
        'independent_prefix_conditions':full['check_count'],'independent_prefix_seconds':full['seconds'],
        'credit_witness_minor':5369,'expected_operating_cost_exact':full['expected_cost_exact'],
        'same_plan_original_credit_error':oldcredit,
        'strict_stage_storage_feasible':False,
        'scenarios':{sid:{k:v for k,v in s.items() if k!='weeks'} for sid,s in full['scenarios'].items()}},
    'source_lineage':lineage,
    'findings':[
        {'id':'F1','type':'business_contract_timing','status':'confirmed_v1_stage_peaks_exceed_capacities',
         'fix_required':'v2 explicit event-stage storage, new input/caps, independent cheap replay; preserve v1'},
        {'id':'F2','type':'instance_integrity','status':'negative_probability_and_empty_cost_vector_accepted',
         'fix_required':'one strict instance schema, positive probabilities, exact vector/tensor dimensions/types/signs, instance_invalid'},
        {'id':'F3','type':'artifact_reader_error_contract','status':'top_array_and_malformed_json_uncaught',
         'fix_required':'typed plan_json/plan_contract outputs, distinguish candidate/instance/infrastructure errors'},
        {'id':'C1','type':'public_time_index','status':'requires_explicit_t0_to3_common_reveal_before_t4',
         'fix_required':'publish exact index/knowledge boundary'},
    ],
    'reader_actual':[{k:v for k,v in r.items() if k!='receipt' and k!='result'}|{
        'result':None if r['result'] is None else {k:v for k,v in r['result'].items() if k!='scenarios'}} for r in boundaries],
    'minimum_credit_solver_evidence':{'read_original_log_and_solver_report':True,
        'source_matches_saved_execution':lineage['current_model_source_equals_minimum_credit_executed_source'],
        'reviewer_resolved_global_problem':False,'reviewer_machine_checked_global_proof':False,
        'credit_lower_bound_is_operating_cost_lower_bound':False,
        'global_infeasibility_at5000_from_same_plan_only':False},
    'supplementary_full12':{'read_existing_script_and_receipt':True,'repeated_group':False,
        'known_feasible_upper_bound_minor':51263,'reported_dominated_feasible_cost_minor':52201,
        'known_upper_bound_proves_reference_one_percent_optimal':False},
    'next_version':{'main_agent_proposed_stage_caps':{'raw':240,'finished':100},
        'main_agent_proposed_strict_schema_and_typed_errors':True,
        'v2_implementation_reviewed':False,'v1_bound_transfer_approved':False,
        'new_tiny_domain_enumeration_required':True},
    'maturity':{'full_v1_end_stock_reference_exists':True,'strict_physical_v1_reference':False,
        'operating_cost_1percent_qualified':False,'freeze_approved':False,'candidate_run_or_grade':False,
        'hours_validated':False,'professional_or_blind_calibration':False,'mature_benchmark':False},
    'actual_subprocess_commands_excluding_git':len(own_runs),
    'command_receipts':[str(p.relative_to(ROOT)).replace('\\','/') for p in sorted((ROOT/'commands').glob('*.json'))]}
save(ROOT/'stage-assessment.json',result)
print(json.dumps({'tiny':result['tiny_actual'],
    'full_end_stock_feasible':full['all_checks_passed'],'cost':full['expected_cost_exact'],
    'strict_stage_storage_feasible':False,'reader_findings':[f['id'] for f in result['findings']],
    'native_count':native['actual_check_count'],'freeze_approved':False,
    'source_changes_since_snapshot':[r['source'] for r in source_identity if not r['current_origin_still_byte_equal']]},
    ensure_ascii=False,indent=2))
