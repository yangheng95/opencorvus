"""Reconcile original SQLite receipts using the supplied unscored audit."""
import argparse,csv,json,sys,os,importlib.metadata
from pathlib import Path
from fractions import Fraction as F
p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--run',type=Path,required=True);p.add_argument('--build',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
sys.path.insert(0,str(a.public));import audit,model
result=audit.analyze(a.run);values=json.loads((a.build/'values.json').read_text(encoding='utf-8'));episodes=result['episodes'];history_cache={}
for row in result['ledger']:
    episode=row['episode'];ident=row['instance']
    if episode not in history_cache:history_cache[episode]=json.loads((a.run/episode/'completed/journal-export.json').read_text(encoding='utf-8'))
    h=history_cache[episode];i=row['seq'];d=model.load(a.public/'instances'/ident);before=model.packet(d,h[:i])['state'];after=h[i]['post_state'];w=model.posterior(d,h[:i]);act=h[i]['action'];obs=h[i]['observation'];conditional=F(1)
    if row['phase']=='laboratory' and act['test']:
        pg=model.predictive(d,w,act['test']);conditional=pg if obs=='good' else 1-pg
    row.update({'conditional_probability_exact':str(conditional),'posterior_after_json':model.canonical(model.belief_wire(model.posterior(d,h[:i+1]))),'quarantine_before_json':model.canonical(before['quarantine']),'quarantine_after_json':model.canonical(after['quarantine']),'incoming_before_json':model.canonical(before['incoming']),'incoming_after_json':model.canonical(after['incoming']),'cost_components_json':model.canonical(after['costs'])})
summary={'format':'l06-inspection-summary/1','instances':result['instances'],'native_run_original':a.run.name,'controller_cuts':result['controller_cuts'],'row_order_control_rows':result['row_order_control_rows'],'scope':result['limits']}
for ident,s in summary['instances'].items():
    v=values[ident];assert F(s['expected_cost_exact'])==F(v['same-information']['value_exact'])
    s.update({'same_information_optimum_exact':v['same-information']['value_exact'],'policy_regret_exact':'0','relative_regret_exact':'0','advance_class_information_bound_exact':v['advance-information-bound-exact'],'intrinsic_information_value_exact':v['intrinsic-information-value-exact'],'no_inspection_physical_optimum_exact':v['no-inspection']['value_exact']})
fields=['instance','path','episode','seq','week','phase','request_id','test','observation','certified_units','order','good_before','good_after','raw_peak','cash_before','cash_after','closing_cash','cumulative_cost','belief_json','receivables_json','probability_exact','node_probability_exact','conditional_probability_exact','posterior_after_json','quarantine_before_json','quarantine_after_json','incoming_before_json','incoming_after_json','cost_components_json']
with (a.out/'stage-ledger.csv').open('w',encoding='utf-8',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(result['ledger'])
(a.out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
(a.out/'reconciliation-full.json').write_text(json.dumps(audit.normalize(result),indent=2)+'\n',encoding='utf-8')
(a.out/'episodes.json').write_text(json.dumps(result['episodes'],indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'passed','actual_stages':len(result['ledger']),'actual_terminal_histories':len(episodes),'cuts':result['controller_cuts'],'instances':{k:{x:v[x] for x in ['expected_cost_exact','minimum_cash','minimum_final_cash','maximum_raw_peak','terminal_histories','decision_histories']} for k,v in summary['instances'].items()}}))
