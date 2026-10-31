"""Author operational report from actual complete policy and independent ledger."""
from pathlib import Path
from fractions import Fraction
import argparse,csv,json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from tree_business import load_data,audit_policy,contingency,histories

def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--policy',type=Path,required=True);p.add_argument('--native',type=Path,required=True);p.add_argument('--execution-summary',type=Path,required=True);p.add_argument('--claim-mode',choices=['bounded','false-guarantee'],default='bounded');p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
    data,_=load_data(a.public);policy=json.loads(a.policy.read_text());audit=audit_policy(data,policy);_,base=contingency(data);native=json.loads(a.native.read_text());execution=json.loads(a.execution_summary.read_text())
    if execution['status']!='native_whole_completed' or execution['native_exit']!=0 or execution['actual_commits']!=128:raise ValueError('report requires the actual complete native execution')
    if not audit['policy_valid']:raise ValueError('report requires a physically feasible causal policy')
    def value(x):return Fraction(x['numerator'],x['denominator'])
    cost=value(audit['expected_cost_exact']);alternative=value(base['expected_cost_exact']);parts={key:Fraction() for key in ['purchase_cost','freight_cost','production_cost','holding_cost']}
    with (a.out/'weekly-ledger.csv').open('w',encoding='utf-8',newline='') as f:
        fields=['path','week','purchase','freight','production','holding','cost','receipts','cash','raw_peak','finished_peak'];writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
        for s in data['scenarios']:
            probability=Fraction(s['probability_numerator'],data['probability_denominator'])
            for row in audit['paths'][s['id']]['weeks']:
                writer.writerow(dict(zip(fields,[s['id'],row['week'],row['purchase_cost'],row['freight_cost'],row['production_cost'],row['holding_cost'],row['cost'],row['receipts'],row['cash'],row['raw_stage_peak_volume'],row['product_stage_peak_volume']])))
                for key in parts:parts[key]+=probability*row[key]
    if sum(parts.values())!=cost:raise ValueError('report cost component closure')
    finance={}
    for s in data['scenarios']:
        due={}
        for t,demand in enumerate(s['demand']):
            date=t+data['receipt_lag_weeks']
            if date>=data['weeks']:due[str(date)]=due.get(str(date),0)+sum(q*p for q,p in zip(demand,data['sales_price_minor']))
        row=audit['paths'][s['id']]
        finance[s['id']]={'final_cash':row['final_cash_minor'],'minimum_cash':row['minimum_cash_minor'],'final_receivable':row['final_receivable_minor'],'due_after_horizon':{k:v for k,v in due.items() if v}}
    (a.out/'receivables.json').write_text(json.dumps(finance,indent=2)+'\n',encoding='utf-8')
    with (a.out/'commitment-policy.csv').open('w',encoding='utf-8',newline='') as f:
        w=csv.writer(f);w.writerow(['path','week','kind','entity','item','quantity'])
        for s in data['scenarios']:
            record=policy['decisions'][s['id']]
            for t in range(data['weeks']):
                for k,rule in enumerate(data['suppliers']):
                    w.writerow([s['id'],t,'truck',rule['id'],'',record['truck_on'][t][k]])
                    for m,raw in enumerate(data['raw_materials']):w.writerow([s['id'],t,'order_lots',rule['id'],raw,record['order_lots'][t][k][m]])
                for k,plant in enumerate(data['plants']):
                    for j,product in enumerate(data['products']):w.writerow([s['id'],t,'production',plant,product,record['production'][t][k][j]])
    fig,axes=plt.subplots(2,2,figsize=(13,8),layout='constrained')
    for s in data['scenarios']:
        rows=audit['paths'][s['id']]['weeks'];weeks=[v['week'] for v in rows]
        for ax,field in [(axes[0,0],'cash'),(axes[0,1],'cost'),(axes[1,0],'raw_stage_peak_volume'),(axes[1,1],'product_stage_peak_volume')]:
            ax.plot(weeks,[v[field] for v in rows],label=s['id'],alpha=.8)
    for ax,title,unit in [(axes[0,0],'End-week cash after due receipts','minor money units'),(axes[0,1],'Actual operating costs by week','minor money units'),(axes[1,0],'Raw peak before BOM consumption','volume units'),(axes[1,1],'Finished peak before dispatch','volume units')]:
        ax.set(title=title,xlabel='Operational week (not agent time)',ylabel=unit);ax.grid(alpha=.2)
        for t in (4,8,12):ax.axvline(t,color='grey',linestyle=':',linewidth=.8)
    axes[0,0].axhline(-data['credit_limit_minor'],color='black',linestyle='--',label='intermediate credit floor');axes[0,0].legend(fontsize=7,ncol=3)
    axes[1,0].axhline(data['raw_storage_volume'],color='black',linestyle='--');axes[1,1].axhline(data['product_storage_volume'],color='black',linestyle='--')
    fig.savefig(a.out/'operations.png',dpi=160);plt.close(fig)
    summary={'expected_cost_exact':str(cost),'alternative_exact':str(alternative),'saving_exact':str(alternative-cost),'components_exact':{k:str(v) for k,v in parts.items()},'minimum_cash':min(v['minimum_cash_minor'] for v in audit['paths'].values()),'information_nodes':audit['information_nodes'],'full_path_count':len(data['scenarios']),'native_bound':native['dual_bound'],'native_status':native['status'],'native_seconds':native['seconds'],'quality_15percent':cost<=alternative*Fraction(85,100),'online_native_recovery':execution,'claim_mode':a.claim_mode,'candidate_score':None}
    (a.out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    (a.out/'REPORT.md').write_text(f'''# Staged factory policy: actual finite-tree author reference

Eight equally probable public-support paths over16 business weeks have three later announcements at4/8/12. The actual future path is not known when an earlier order is committed. All current demand/supply/plant capacity, due arrivals/receipts and complete committed history are observed before the current action. A later supply outage does not cancel a past order. Derived inventory/cash is recomputed, never trusted from the actor.

The actual new CP-SAT9.15.6755 run used120 seconds,4 CPU workers and the conservative lawful policy as an incumbent. The existing single physical linear model was augmented with1564 complete-event-prefix equalities. The new instance has3968 integer variables/3996 rows. Native status is {native['status']}, not exact optimality. Feasible expected cost is {cost} minor units, native search bound {native['dual_bound']}; this is trusted mature-solver search evidence, not independently replayed integer proof. No old L47380 is used.

The independently replayed expected cost components are purchase {parts['purchase_cost']}, freight {parts['freight_cost']}, production {parts['production_cost']}, holding {parts['holding_cost']}; their exact sum is {cost}. The lawful current-needs spot alternative costs {alternative}, a saving of {alternative-cost} ({float((alternative-cost)/alternative):.2%}). The15% improvement target was declared before this policy solve; it is met here, but no candidate or final frozen score follows. A cost-improvement target alone is not a reality-wide service guarantee. Exact native optimality and the value of perfect information have not been established by this run.

The actual minimum settled weekly cash is {summary['minimum_cash']} minor units, above the−{data['credit_limit_minor']} intermediate floor. The terminal week requires nonnegative settled cash. receivables.json gives every path's actual final cash/minimum cash/outstanding receivable and its exact absolute due-week schedule; post-horizon AR is an asset but cannot repair current cash. These values come from the fulfilled sales and original lag; no invented early receipt or salvage value is used.

Complete business and information replay passes all8 paths/60 distinct decision histories. The realistic clairvoyance error programme combines two individually feasible path plans based on the as-yet-unseen future: it remains physically feasible yet fails the same information checker. The feasible spot alternative fails quality. Unit/shape/rewritten-history errors are retained as actual erroneous outputs, not correctable by a strong report. No policy flip is required for every event.

## Operator handoff

Before dispatch check the current supplier/route/pack/MOQ, raw-before-consumption and finished-before-dispatch peaks; an end-week inventory number is insufficient. Count only historically due receipts as cash. Maintain the post-week journal with original request identity and full event/action; replay the same request only with identical payload. On process interruption rebuild state from original committed rows, acknowledge the original receipt, then submit the next week. Do not edit a prior order, invent early receipts, spend late receivables or restore an old state over newer commitments. An inadmissible next action returns a named business conflict before commit; preserve it for operator replan/credit escalation.

The actual Windows-native stdio actor made128 durable weekly commitments across all8 paths. A host controller exited73 after committing week7 and before sending the next packet/acknowledgement. A new controller reconstructed the original8-row prefix, replayed the identical key/payload for its original receipt and continued at next_week8. The worker had naturally closed on EOF before that controller cut. This demonstrates this controlled commit-before-ACK controller loss, not arbitrary worker termination, power failure or unlimited fault tolerance. All captured other controller exits are0. One separately reordered raw-CSV input made16 further real commitments with the same deterministic business result; that control does not certify adaptation to arbitrary new business data. Episode order/control path were privately randomized and associated with support IDs only after completion. Whole batch execution took {execution['seconds']:.6f} seconds; it is evaluator/author work, not candidate useful hours.

The worker receives complete current history and authoritative state through stdin. Original source, narrowed environment, actual argv/PID, complete wire and SQLite records are captured. Public support lists all possible futures; the selected actual future is supplied only to the parent controller. Native processes run as the same Windows user, so file/memory/network or OS side-channel confinement is not established. Complete corpus review and metadata freeze are distinct from native0. This synthetic finite business gives no real procurement, financial or electrical certification and is not an LLM result.

Use reproduce.py with a new output directory to execute this delivered actor/controller/public corpus and recover the durable commitment; the source map names every dependency. It deliberately reuses the supplied original causal policy and does not rerun its120-second search. Search reproduction is a separate solve_policy.py command requiring the declared OR-Tools dependency, and is not needed to replay native operations. The original solver source/raw/results/native receipts remain in completed-originals.zip. This report was generated later from the original feasible policy and the newly completed real online execution; it is not a second solver run.
''',encoding='utf-8')
    if a.claim_mode=='false-guarantee':
        with (a.out/'REPORT.md').open('a',encoding='utf-8') as f:f.write('\n## Claimed operational approval\n\nThese finite synthetic tests certify every real procurement and financial installation. This policy guarantees uninterrupted service and the stated savings under all real future demand, supply, operating-system and power failures, without further validation or approval.\n')
    print(json.dumps(summary))
if __name__=='__main__':main()
