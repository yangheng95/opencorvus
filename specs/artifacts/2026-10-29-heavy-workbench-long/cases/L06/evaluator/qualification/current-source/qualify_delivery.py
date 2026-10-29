"""Actual CLI qualification of the derived-output primitive only."""
import argparse,copy,json,shutil,subprocess,sys,time
from pathlib import Path

from check_l06 import evaluate
from l06_delivery import expected_delivery
from l06_input import read_json,validate_instance
from l06_packet import write_packet


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    root=args.output;root.mkdir(parents=True,exist_ok=False);source=root/'executed-source';source.mkdir()
    for name in ['l06_delivery.py','l06_input.py','l06_packet.py','check_l06.py','qualify_delivery.py']:
        shutil.copy2(Path(__file__).parent/name,source/name)
    work=Path(__file__).parent;events=[];start=time.perf_counter()
    data=read_json(work/'v2/inputs/full.json','instance_invalid');plan=read_json(work/'v2/root-node-diagnostic-20261029/cpsat-full/plan.json','plan_json')
    packet=root/'packet';write_packet(data,packet)
    ledger,summary=expected_delivery(data,plan,evaluate(data,plan));assert summary['expected_cost_minor']=={'numerator':490329,'denominator':10}
    def write(name,value):
        path=root/name;path.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n');return path
    plan_path=write('plan.json',plan);ledger_path=write('ledger.json',ledger);summary_path=write('summary.json',summary)
    def run(name,expected_statuses=None,exit_code=0,packet_path=packet,plan_arg=plan_path,ledger_arg=ledger_path,summary_arg=summary_path):
        out=root/(name+'.json');cmd=[sys.executable,'-B',str(source/'l06_delivery.py'),'--input',str(packet_path),'--plan',str(plan_arg),'--ledger',str(ledger_arg),'--summary',str(summary_arg),'--out',str(out)]
        before=time.perf_counter();process=subprocess.run(cmd,text=True,capture_output=True)
        result=json.loads(out.read_text());event={'name':name,'argv':cmd,'exit_code':process.returncode,'seconds':time.perf_counter()-before,'stdout':process.stdout,'stderr':process.stderr,'out':str(out)};events.append(event)
        assert process.returncode==exit_code,(name,event)
        if expected_statuses is not None:assert {item['id']:item['status'] for item in result['findings']}==expected_statuses,(name,result)
        return result
    passed={identifier:'verified_pass' for identifier in ['C01','C07','C08','C09','C10','C11','D03','D04','D05','D06']}
    run('full-valid',passed)
    decimal=copy.deepcopy(summary);decimal['expected_cost_minor']=49032.9
    for record in decimal['scenarios'].values():
        probability=record['probability'];record['probability']={'numerator':probability['numerator']*100,'denominator':probability['denominator']*100}
    run('exact-decimal-and-unreduced',passed,summary_arg=write('decimal-summary.json',decimal))
    bad=copy.deepcopy(summary);name=data['scenarios'][0]['id'];bad['scenarios'][name]['minimum_cash_minor']=5369
    run('changed-minimum-cash',passed|{'C08':'verified_fail'},2,summary_arg=write('bad-minimum-summary.json',bad))
    bad=copy.deepcopy(ledger);bad['scenarios'][name]['weeks'][0]['cost']+=1
    run('changed-cost-ledger',passed|{'D05':'verified_fail'},2,ledger_arg=write('bad-cost-ledger.json',bad))
    bad=copy.deepcopy(plan);bad['decisions'][name]['raw_inventory'][0][0]+=1
    run('changed-optional-inventory',passed|{'D03':'verified_fail'},2,plan_arg=write('bad-inventory-plan.json',bad))
    bad=copy.deepcopy(plan);bad['decisions'][name]['finished_inventory']=[]
    run('optional-inventory-shape-contract',passed|{'D03':'candidate_incomplete'},2,plan_arg=write('bad-inventory-shape-plan.json',bad))
    run('missing-ledger',passed|{i:'candidate_incomplete' for i in ['D03','D04','D05','D06']},2,ledger_arg=root/'candidate-omitted-ledger.json')
    bad=copy.deepcopy(summary);bad['scenarios'][name]['probability']=True
    run('probability-type-contract',passed|{'C11':'candidate_incomplete'},2,summary_arg=write('bad-probability-summary.json',bad))
    bad=copy.deepcopy(plan);del bad['decisions'][name]
    run('candidate-dependency-blocked',{i:'blocked_candidate' for i in passed},2,plan_arg=write('incomplete-plan.json',bad))
    broken=root/'broken-frozen-packet';shutil.copytree(packet,broken)
    quotes=broken/'supplier_quotes.csv'
    with quotes.open('a') as file:file.write(quotes.read_text().splitlines()[1]+'\n')
    invalid=run('evaluation-input-error',exit_code=3,packet_path=broken);assert invalid['status']=='run_invalid'
    native=work/'v2/root-node-diagnostic-20261029/native-known'
    credit=read_json(native/'credit-input.json','instance_invalid');credit['credit_limit_minor']=5
    credit_plan=read_json(native/'credit-integer.json','record')['plan'];validate_instance(credit)
    credit_ledger,credit_summary=expected_delivery(credit,credit_plan,evaluate(credit,credit_plan))
    for record in credit_ledger['scenarios'].values():
        assert [row['receivable'] for row in record['weeks']]==[10,0]
        assert [row['receipts'] for row in record['weeks']]==[0,10]
        assert [row['cash'] for row in record['weeks']]==[-5,4]
    assert credit_summary['expected_cost_minor']=={'numerator':7,'denominator':1}
    credit_packet=root/'credit-packet';write_packet(credit,credit_packet)
    run('hand-receivable-and-cash',passed,packet_path=credit_packet,plan_arg=write('credit-plan.json',credit_plan),ledger_arg=write('credit-ledger.json',credit_ledger),summary_arg=write('credit-summary.json',credit_summary))
    receipt={'status':'passed','actual_cli_commands':len(events),'seconds':time.perf_counter()-start,'hand_values':{'receivable':[10,0],'receipts':[0,10],'cash':[-5,4],'cost':7},'scope':'derived-output projection only; no full rubric score, replay attestation or quality qualification','executions':events}
    (root/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({k:v for k,v in receipt.items() if k!='executions'}))


if __name__=='__main__':main()
