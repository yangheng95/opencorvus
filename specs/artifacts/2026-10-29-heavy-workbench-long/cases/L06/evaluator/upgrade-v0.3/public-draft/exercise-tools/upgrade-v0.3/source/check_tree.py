"""Actual finite-tree policy/committed journal checker, no solver or actor invocation."""
from pathlib import Path
from fractions import Fraction
import argparse,json
from tree_business import load_data,audit_policy,contingency,replay,event,canonical,action_at,BusinessError
from l06_input import read_json,InputError
from check_l06 import PlanError

def assess(data,policy,journals=None):
    audit=audit_policy(data,policy);baseline,base=contingency(data)
    expected=None
    if audit['policy_valid']:
        x=audit['expected_cost_exact'];expected=Fraction(x['numerator'],x['denominator'])
    b=base['expected_cost_exact'];limit=Fraction(b['numerator'],b['denominator'])*Fraction(85,100)
    records=[];execution=None
    if journals is not None:
        if type(journals) is not dict or set(journals)!={s['id'] for s in data['scenarios']}:raise BusinessError('journal_path_coverage')
        for s in data['scenarios']:
            committed=journals[s['id']];state,rows=replay(data,committed)
            if state['next_week']!=data['weeks']:raise BusinessError('journal_incomplete',state['next_week'])
            for t,item in enumerate(committed):
                if canonical(item['event'])!=canonical(event(s,t)):raise BusinessError('journal_path_event',t)
                if canonical(item['action'])!=canonical(action_at(policy,s['id'],t)):raise BusinessError('journal_policy_action',t)
            if not audit['policy_valid'] or canonical(rows)!=canonical(audit['paths'][s['id']]['weeks']):raise BusinessError('journal_business_ledger')
            records.append({'path':s['id'],'commits':len(committed),'final_cash':state['cash'],'cost':state['total_cost_minor']})
        execution=True
    return {'status':'logical_policy_checked','business_feasible':audit['business_feasible'],'information_legal':audit['information_legal'],
        'quality_target_pass':False if expected is None else expected<=limit,'expected_cost_exact':str(expected) if expected is not None else None,
        'registered_contingency_cost':str(Fraction(b['numerator'],b['denominator'])),'pre_registered_quality_maximum':str(limit),
        'journal_replay_complete':execution,'journal_records':records,'audit':audit,
        'native_execution_attestation':'unassessed; JSON journal is not proof of the isolated actor/native/recovery; original evidence and whole-case review required',
        'total':None,'good':None,'limits':'not frozen or fully reviewed; no candidate score or effective-hour certification'}

def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--policy',type=Path,required=True);p.add_argument('--journals',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    data,contract=load_data(a.public)
    try:
        result=assess(data,read_json(a.policy,'policy_json'),read_json(a.journals,'journal_json') if a.journals else None)
        code=0 if result['business_feasible'] and result['information_legal'] and result['quality_target_pass'] else 2
    except (BusinessError,PlanError,InputError) as e:
        result={'status':'logical_policy_invalid','error':getattr(e,'code',str(e)),'total':None,'good':False,'where':getattr(e,'week',None)};code=2
    a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k!='audit'}));return code
if __name__=='__main__':raise SystemExit(main())
