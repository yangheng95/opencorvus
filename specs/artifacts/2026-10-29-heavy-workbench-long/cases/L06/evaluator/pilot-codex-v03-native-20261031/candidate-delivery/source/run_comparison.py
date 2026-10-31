"""Retain the comparison's original expected quality-stage rejection truthfully."""
import argparse,json,subprocess,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--project',type=Path,required=True);p.add_argument('--policy',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
command=[sys.executable,'-B',str(a.public/'exercise.py'),'--project',str(a.project),'--policy',str(a.policy),'--out',str(a.out)]
result=subprocess.run(command,capture_output=True,text=True,encoding='utf8')
record={'argv':command,'native_exit':result.returncode,'stdout':result.stdout,'stderr':result.stderr}
(a.out/'comparison-wrapper-command.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
assessment=json.loads((a.out/'logical-and-journal-assessment.json').read_text(encoding='utf8'))
assert result.returncode==1 and assessment['business_feasible'] is True and assessment['information_legal'] is True and assessment['journal_replay_complete'] is True and assessment['expected_cost_exact']=='70640' and assessment['quality_target_pass'] is False
print(json.dumps({'status':'comparison_business_execution_complete_expected_candidate_quality_rejection','original_wrapper_exit':result.returncode,'expected_cost':'70640','original_evidence':str(a.out)}))
