"""Cross-check delivered numbers/actions against actual retained execution."""
import argparse,csv,json,sqlite3
from pathlib import Path
from fractions import Fraction
from common import *

def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);a=p.parse_args();data,_=load_data(a.public)
    summary=json.loads((ROOT/'outputs/summary.json').read_text(encoding='utf8'));policy=json.loads((ROOT/'policy.json').read_text(encoding='utf8'))
    assert canonical(policy)==canonical(json.loads((ROOT/'programme/policy.json').read_text(encoding='utf8')))
    results=[]
    for mode,policy_file,ledger_file in [('policy',ROOT/'policy.json',ROOT/'outputs/weekly-ledger.csv'),('spot',ROOT/'outputs/baseline-policy.json',ROOT/'outputs/baseline-weekly-ledger.csv')]:
        folder=ROOT/f'evidence/native-{mode}-01';journals=json.loads((folder/'journals.json').read_text(encoding='utf8'));expected_policy=json.loads(policy_file.read_text(encoding='utf8'))
        with ledger_file.open(encoding='utf8',newline='') as f:ledger={(r['path'],int(r['week'])):r for r in csv.DictReader(f)}
        assert len(ledger)==128
        exact=Fraction()
        for path in data['scenarios']:
            name=path['id'];committed=journals[name];state,rows=replay(data,committed)
            assert len(committed)==16
            for t,(item,row) in enumerate(zip(committed,rows)):
                assert canonical(item['action'])==canonical(action_at(expected_policy,name,t))
                target=ledger[name,t]
                for field,physical in [('purchase','purchase_cost'),('freight','freight_cost'),('production','production_cost'),('holding','holding_cost'),('cost','cost'),('receipts','receipts'),('cash','cash'),('raw_peak','raw_stage_peak_volume'),('finished_peak','product_stage_peak_volume')]:assert Fraction(target[field])==row[physical]
            exact+=Fraction(path['probability_numerator'],data['probability_denominator'])*state['total_cost_minor']
        audit=json.loads((folder/'logical-and-journal-assessment.json').read_text(encoding='utf8'))
        assert audit['business_feasible'] is True and audit['information_legal'] is True and audit['journal_replay_complete'] is True
        assert Fraction(audit['expected_cost_exact'])==exact
        if mode=='policy':
            assert audit['quality_target_pass'] is True and Fraction(summary['expected_cost_exact'])==exact
            owner=json.loads((folder/'owner-terminal.json').read_text(encoding='utf8'));assert owner['original_receipt_recovered'] is True and owner['actual_commits']==128
        else:
            assert audit['quality_target_pass'] is False and exact==70640
            # The baseline genuinely completes execution, then is rejected for
            # the candidate-only improvement target. Preserve original error.
            assert json.loads((folder/'actual-checker-command.json').read_text(encoding='utf8'))['native_exit']==2
        episodes=json.loads((folder/'episodes.json').read_text(encoding='utf8'));fault=next(v for v in episodes if v['has_real_commit_loss']);e=folder/fault['directory']
        original=json.loads((e/'after-commit-original.json').read_text(encoding='utf8'))
        with sqlite3.connect('file:'+(e/'journal.sqlite3').as_posix()+'?mode=ro',uri=True) as con:actual=con.execute('SELECT week,request_id,item_json FROM commits ORDER BY week').fetchall()
        assert [tuple(v) for v in original]==actual[:8]
        recovery=json.loads((e/'completed/resume-receipt.json').read_text(encoding='utf8'));original_item=json.loads(original[-1][2]);assert canonical(recovery['receipt'])==canonical(original_item['receipt'])
        results.append({'mode':mode,'expected_cost':str(exact),'actual_path_commits':128,'actual_control_commits':16,'native_workers':len(json.loads((folder/'actual-commands.json').read_text(encoding='utf8'))),'fault_path':fault['path'],'original_rows_unchanged':8,'recovered_original_receipt':recovery['receipt'],'candidate_quality_check':audit['quality_target_pass'],'journal_ledger_coordinates_equal':128*10})
    with (ROOT/'outputs/commitment-policy.csv').open(encoding='utf8',newline='') as f:actions=list(csv.DictReader(f))
    assert len(actions)==2944
    suppliers={s['id']:i for i,s in enumerate(data['suppliers'])};raws={s:i for i,s in enumerate(data['raw_materials'])};plants={s:i for i,s in enumerate(data['plants'])};products={s:i for i,s in enumerate(data['products'])};seen=set()
    for row in actions:
        name=row['path'];t=int(row['week']);a0=action_at(policy,name,t);kind=row['kind'];entity=row['entity'];item=row['item'];key=(name,t,kind,entity,item);assert key not in seen;seen.add(key)
        expected=a0['truck_on'][suppliers[entity]] if kind=='truck' else a0['order_lots'][suppliers[entity]][raws[item]] if kind=='order_lots' else a0['production'][plants[entity]][products[item]]
        assert int(row['quantity'])==expected
    print(json.dumps({'status':'passed','commitment_coordinates_equal':len(actions),'execution_cross_checks':results},indent=2))
    (ROOT/'evidence/delivery-cross-check.json').write_text(json.dumps({'status':'passed','commitment_coordinates_equal':len(actions),'execution_cross_checks':results},indent=2)+'\n',encoding='utf8')
if __name__=='__main__':main()
