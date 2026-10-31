"""Produce traceable operating mechanism summaries from selected actual vectors."""
import json,csv
from pathlib import Path
from collections import defaultdict,Counter
import core
ROOT=Path(__file__).resolve().parent

def rows(p):
    with p.open(newline='',encoding='utf-8-sig') as f:return list(csv.DictReader(f))

def main():
    summary=json.loads((ROOT/'analysis-summary.json').read_text());result={}
    for inst,relative in summary['selected_operating_runs'].items():
        base=ROOT/relative;arcs=rows(base/'arcs.csv');ledger=rows(base/'port-period.csv');paths=rows(base/'paths.csv')
        groups=defaultdict(list)
        for r in paths:groups[r['anonymous_path_id']].append(r)
        starts=[]
        for pid,rr in groups.items():
            rr.sort(key=lambda r:int(float(r['step'])));src=rr[0];first=next(r for r in rr if r['kind'] not in ('initial_source','waiting'))
            starts.append({'anonymous_path_id':pid,'vessel_class':int(float(src['vessel_class'])),'initial_port':int(float(src['to_port'])),'first_available_period':int(float(src['to_time_index'])),'first_service_period':int(float(first['from_time_index'])),'initial_wait_periods':int(float(first['from_time_index']))-int(float(src['to_time_index'])),'first_service_kind':first['kind']})
        core.table(base/'initial-service.csv',starts,list(starts[0]))
        portstats=[]
        for p in sorted({int(float(r['port'])) for r in ledger}):
            rr=[r for r in ledger if int(float(r['port']))==p];services=[r for r in arcs if r['inventory_service_port']!='' and int(float(r['inventory_service_port']))==p]
            byclass=Counter()
            for r in services:byclass[int(float(r['vessel_class']))]+=int(float(r['vessel_count']))
            alpha=sum(float(r['alpha_loss_or_shortfall']) for r in rr)
            portstats.append({'port':p,'role':rr[0]['role'],'signed_total_rate':sum(float(r['signed_production_consumption']) for r in rr),'initial_stock':float(rr[0]['stock_before']),'ending_stock':float(rr[-1]['stock_after']),'min_ending_stock':min(float(r['stock_after']) for r in rr),'max_ending_stock':max(float(r['stock_after']) for r in rr),'alpha_quantity':alpha,'alpha_cost':sum(float(r['alpha_cost']) for r in rr),'service_count':sum(int(float(r['vessel_count'])) for r in services),'service_quantity':sum(abs(float(r['signed_inventory_effect'])) for r in services),'used_berth_periods':sum(float(r['berths_used']) for r in rr),'available_berth_periods':sum(float(r['berths_available']) for r in rr),'class_service_counts':dict(byclass),'alpha_periods':[int(float(r['time_index'])) for r in rr if float(r['alpha_loss_or_shortfall'])>1e-6]})
        route=defaultdict(lambda:{'count':0,'cost':0,'service_at_origin':0})
        for r in arcs:
            if r['kind'] not in ('loaded_voyage','empty_return'):continue
            key=f'class{r["vessel_class"]}:P{r["from_port"]}->P{r["to_port"]}'
            route[key]['count']+=int(float(r['vessel_count']));route[key]['cost']+=float(r['cost_contribution']);route[key]['service_at_origin']+=abs(float(r['signed_inventory_effect']))
        result[inst]={'artifact_directory':relative,'initial_service':starts,'port_stats':portstats,'routes':dict(route)}
    core.dump(ROOT/'operating-analysis.json',result);print(json.dumps(result,indent=2))
if __name__=='__main__':main()
