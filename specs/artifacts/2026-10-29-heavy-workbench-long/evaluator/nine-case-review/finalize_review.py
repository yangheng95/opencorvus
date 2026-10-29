"""Index and explicit maturity claims for this external read-only audit."""
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
import sys
sys.dont_write_bytecode=True
from collect_review_evidence import OUT, REPO, command, save

priorities={'H02':'P1','H03':'P1','H04':'P0-2','H05':'P0-3','H06':'P0-1',
            'H07':'P1','H08':'P1','H09':'P2','H10':'P1'}
facts=json.loads((OUT/'old-case-facts.json').read_text(encoding='utf-8'))
diags=json.loads((OUT/'diagnostic-probes.json').read_text(encoding='utf-8'))
plans=json.loads((OUT/'author-plan-witness-probes.json').read_text(encoding='utf-8'))
errors=json.loads((OUT/'structural-error-probes.json').read_text(encoding='utf-8'))
matrix=[]
for f in facts:
    cid=f['case'];doc=OUT/f'{cid}.md'
    if not doc.is_file():raise ValueError(cid+' report missing')
    row={'case':cid,'title':f['title'],'implementation_priority':priorities[cid],
         'review':doc.name,'old_objective_actual_points':next(x['objective'] for x in diags if x['case']==cid),
         'old_full_candidate_evidence':'recorded_two_system_nonblind_100_under_old_contract' if cid=='H05' else 'not_established',
         'old_full_evidence_review_scope':'read_long_README_Recall_and_prior_review_context_not_new_full_candidate_replay',
         'new_public_inputs':'not_collected_and_frozen',
         'new_public_contract':'proposal_not_frozen',
         'new_checker':'main_reported_local_qualification_not_reviewed' if cid=='H06' else 'not_implemented_or_reviewed',
         'new_micro_witness':'analytic_construction_in_report_not_executed',
         'new_complete_reachable_reference':'not_established',
         'new_clean_replay':'not_established',
         'new_error_counterparts':'specified_not_implemented',
         'new_real_active_duration':'unmeasured',
         'new_multi_system_repeats':'not_run',
         'professional_multi_quality_calibration':'not_done',
         'freeze_approved':False,'mature_benchmark_claim':False}
    matrix.append(row)
save(OUT/'maturity-matrix.json',{'as_of_utc':datetime.now(timezone.utc).isoformat(),
    'scope':'nine new long versions; old evidence never upgrades new status automatically','cases':matrix})
with (OUT/'maturity-matrix.csv').open('w',encoding='utf-8-sig',newline='') as h:
    w=csv.DictWriter(h,fieldnames=list(matrix[0]));w.writeheader();w.writerows(matrix)

inventory=json.loads((OUT/'source-inventory.json').read_text(encoding='utf-8'))
identity=[]
for item in inventory:
    rel=Path(item['repo_relative']);src=REPO/rel;snap=OUT/'source-snapshot'/rel
    identity.append({'repo_relative':item['repo_relative'],
                     'same_bytes_as_review_snapshot_at_final_check':src.exists() and src.read_bytes()==snap.read_bytes()})
save(OUT/'source-final-identity.json',{'scope':'review source identity only, not functionality',
    'sources':identity})
end_status=command(['git','-C',str(REPO),'status','--short'],'git-status-end')
commands=sorted(str(p.relative_to(OUT)).replace('\\','/') for p in (OUT/'commands').glob('*.json'))
receipt={'scope':'independent design audit plus actual old reference/checker probes',
    'completed_utc':datetime.now(timezone.utc).isoformat(),'reviewer':'/root/benchmark_review',
    'delegation':'none','repo_writes':'none','provider_or_credential_use':'none',
    'ui_or_user_process_actions':'none','gpu_training_or_interference':'none',
    'new_case_implementation_or_candidate_answers':'none',
    'reviewed_cases':[r['case'] for r in matrix], 'source_snapshot_count':len(inventory),
    'actual_objective_runs':len(diags),'actual_numeric_error_objective_runs':len(diags),
    'actual_author_feasibility_witness_runs':len(plans),
    'actual_structural_error_plan_runs':len(errors),
    'objective_result_scope':'20-point diagnostics only; no 80-point rubric grade',
    'all_objectives_20':all(x['objective']==20 for x in diags),
    'all_numeric_error_results_15':all(x['single_numeric_error_probe']['objective']==15 for x in diags),
    'all_seven_old_witnesses_feasible':all(x['result']['passed'] for x in plans),
    'structural_error_codes':{x['case']:sorted({v['code'] for v in x['result']['violations']}) for x in errors},
    'stage':'new_versions_proposals_not_frozen',
    'new_complete_reference_or_agent_runs':False,'hours_validated':False,
    'professional_or_blind_calibration':False,'freeze_approved':False,
    'native_addendum':'pure_stdlib_decoded_endpoints_and_math_only_not_second_native_run',
    'command_receipts':commands,
    'corrected_review_statement':'H06 R06 full/half baseline-equality wording overlaps; not assigned full or whole-task grade',
    'remaining_work':'public input/contract, actual checker, full constructive reference, errors, cold replay, real fresh repeated systems, expert calibration'}
save(OUT/'review-receipt.json',receipt)
print(json.dumps({'reviewed_cases':receipt['reviewed_cases'],'source_count':len(inventory),
    'command_receipts':len(commands),'actual_runs':{'objective':len(diags),'numeric_error':len(diags),
       'old_witness':len(plans),'structural_error':len(errors)},'freeze_approved':False,
    'source_changes_since_snapshot':[x['repo_relative'] for x in identity if not x['same_bytes_as_review_snapshot_at_final_check']]},
    ensure_ascii=False,indent=2))
