"""Publish exact tables from authoritative recurrence, never declared inventory."""
import argparse, csv, json
from fractions import Fraction
from pathlib import Path
from common import *


def write_json(path,value):path.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf8')
def exact(x):return int(x) if x.denominator==1 else str(x)
def csv_out(path,headers,rows):
    with path.open('w',encoding='utf8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=headers);w.writeheader();w.writerows(rows)


def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--policy',type=Path,required=True);p.add_argument('--solve',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--exercise',type=Path);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
    data,_=load_data(a.public);policy=json.loads(a.policy.read_text(encoding='utf8'));audit=audit_policy(data,policy);baseline,base=contingency(data)
    if not audit['policy_valid']:raise RuntimeError(audit)
    write_json(a.out/'policy-audit.json',audit);write_json(a.out/'baseline-policy.json',baseline);write_json(a.out/'baseline-audit.json',base);write_json(a.out/'normalized-input.json',data)
    ledgers=[];base_ledgers=[];actions=[];receivables={};path_summary=[];detailed={};components={k:Fraction() for k in ('purchase_cost','freight_cost','production_cost','holding_cost')};expected=Fraction();alternative=Fraction();lowers=[];expected_lower=Fraction()
    for path in data['scenarios']:
        name=path['id'];prob=Fraction(path['probability_numerator'],data['probability_denominator']);state=initial_state(data);rows=[]
        for t in range(data['weeks']):
            action=action_at(policy,name,t);state,row=advance(data,state,event(path,t),action);rows.append(row)
            ledgers.append({'path':name,'week':t,**{k:row[v] for k,v in [('purchase','purchase_cost'),('freight','freight_cost'),('production','production_cost'),('holding','holding_cost'),('cost','cost'),('receipts','receipts'),('cash','cash'),('raw_peak','raw_stage_peak_volume'),('finished_peak','product_stage_peak_volume')]}})
            for key in components:components[key]+=prob*row[key]
            for s,rule in enumerate(data['suppliers']):
                actions.append({'path':name,'week':t,'kind':'truck','entity':rule['id'],'item':'','quantity':action['truck_on'][s]})
                for m,raw in enumerate(data['raw_materials']):actions.append({'path':name,'week':t,'kind':'order_lots','entity':rule['id'],'item':raw,'quantity':action['order_lots'][s][m]})
            for k,plant in enumerate(data['plants']):
                for j,prod in enumerate(data['products']):actions.append({'path':name,'week':t,'kind':'production','entity':plant,'item':prod,'quantity':action['production'][k][j]})
        expected+=prob*state['total_cost_minor'];bcost=sum(r['cost'] for r in base['paths'][name]['weeks']) if 'paths' in base else sum(r['cost'] for r in base['scenarios'][name]['weeks'])
        alternative+=prob*bcost
        for row in base['paths'][name]['weeks']:
            base_ledgers.append({'path':name,'week':row['week'],**{k:row[v] for k,v in [('purchase','purchase_cost'),('freight','freight_cost'),('production','production_cost'),('holding','holding_cost'),('cost','cost'),('receipts','receipts'),('cash','cash'),('raw_peak','raw_stage_peak_volume'),('finished_peak','product_stage_peak_volume')]}})
        post={str(t):v for t,v in enumerate(state['receipts_by_week']) if t>=data['weeks'] and v}
        rec={'final_cash':state['cash'],'minimum_cash':min(r['cash'] for r in rows),'final_receivable':sum(post.values()),'due_after_horizon':post};receivables[name]=rec
        detailed[name]={'probability':str(prob),'weeks':rows,'terminal_state':state}
        path_summary.append({'path':name,'probability':str(prob),'cost':state['total_cost_minor'],'spot_cost':bcost,'saving':bcost-state['total_cost_minor'],**{k:rec[k] for k in ('final_cash','minimum_cash','final_receivable')},'raw_peak':max(r['raw_stage_peak_volume'] for r in rows),'finished_peak':max(r['product_stage_peak_volume'] for r in rows)})
        # Independent exact relaxation: all future known, fractional purchasing,
        # unlimited cheapest supplier and cheapest routes; waive freight/holding,
        # lead/capacity/credit/storage restrictions. Every removed cost is >=0.
        totals=[sum(row[j] for row in path['demand'])-data['initial_products'][j] for j in range(4)]
        raw_need=[sum(totals[j]*data['bom'][j][m] for j in range(4)) for m in range(4)]
        purchase_lb=sum(max(0,raw_need[m]-data['initial_raw'][m])*min(s['price_minor'][m] for s in data['suppliers']) for m in range(4))
        production_lb=sum(totals[j]*min(data['production_cost_minor'][k][j] for k in range(2) if data['allowed'][k][j]) for j in range(4))
        lower=purchase_lb+production_lb;expected_lower+=prob*lower
        lowers.append({'path':name,'product_total':totals,'raw_consumption':raw_need,'purchase_lower':purchase_lb,'production_lower':production_lb,'cost_lower':lower})
    csv_out(a.out/'weekly-ledger.csv',['path','week','purchase','freight','production','holding','cost','receipts','cash','raw_peak','finished_peak'],ledgers)
    csv_out(a.out/'baseline-weekly-ledger.csv',['path','week','purchase','freight','production','holding','cost','receipts','cash','raw_peak','finished_peak'],base_ledgers)
    csv_out(a.out/'commitment-policy.csv',['path','week','kind','entity','item','quantity'],actions)
    csv_out(a.out/'path-summary.csv',list(path_summary[0]),path_summary)
    write_json(a.out/'receivables.json',receivables);write_json(a.out/'detailed-ledger.json',detailed)
    provenance=json.loads((a.solve/'optimization.json').read_text(encoding='utf8'))
    execution=json.loads((a.exercise/'owner-terminal.json').read_text(encoding='utf8')) if a.exercise else {'status':'not_yet_run'}
    summary={'expected_cost_exact':exact(expected),'alternative_exact':exact(alternative),'saving_exact':exact(alternative-expected),'saving_fraction_exact':str((alternative-expected)/alternative),'components_exact':{k:exact(v) for k,v in components.items()},'minimum_cash':min(r['cash'] for r in ledgers),'information_nodes':audit['information_nodes'],'full_path_count':len(data['scenarios']),'quality_limit_exact':60044,'native_execution':execution,'optimization':provenance,'scope':'finite eight-path synthetic business; source execution/recovery evidence separately retained; no OS isolation, real-world approval, arbitrary-failure or working-hours certificate'}
    assert sum(components.values())==expected and alternative==70640 and expected<=60044
    write_json(a.out/'summary.json',summary)
    write_json(a.out/'information-relaxation.json',{'format':'l06-explicit-optimistic-relaxation/1','method':'perfect information plus unlimited cheapest-source and cheapest-route continuous acquisition; zero freight and holding; all lead/capacity/storage/credit constraints removed','exact_expected_lower_bound':exact(expected_lower),'candidate_minus_lower_bound_exact':exact(expected-expected_lower),'paths':lowers,'proof':'Terminal finished=0 fixes total production to demand minus initial finished. Raw balance and nonnegative terminal raw imply total bought >= consumption minus initial raw for each raw. Every purchased unit costs >= the minimum quoted unit price, and every produced unit costs >= the cheapest allowed route. Freight and holding are nonnegative. Summing these inequalities pathwise and weighting by public rational probabilities gives this exact lower bound. It is intentionally optimistic and need not be implementable.','claim':'Exact rational analytical lower bound, not a claim the executable candidate or this relaxed bound is the causal optimum.'})
    print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
