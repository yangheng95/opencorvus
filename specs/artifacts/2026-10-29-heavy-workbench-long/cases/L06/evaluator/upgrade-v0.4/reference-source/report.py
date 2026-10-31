"""Build original-ledger products and actual scientific figures; no new execution."""
from pathlib import Path
from fractions import Fraction as F
import argparse,csv,json,sys,math,shutil
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'public'))
from model import load,canonical
from audit import analyze

def write(p,x):p.parent.mkdir(exist_ok=True,parents=True);p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def main():
    p=argparse.ArgumentParser();p.add_argument('--run',type=Path,required=True);p.add_argument('--studies',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--claim',choices=['bounded','false-certainty'],default='bounded');a=p.parse_args()
    facts=analyze(a.run);data_dir=a.out/'data';data_dir.mkdir(exist_ok=False,parents=True);fig=a.out/'figures';fig.mkdir(exist_ok=False)
    summaries=facts['instances'];scientific={}
    for ident,entry in summaries.items():
        source=json.loads((a.studies/ident/'science.json').read_text(encoding='utf-8'));require_value=F(entry['expected_cost_exact'])==F(source['bayes_optimum_exact']);assert require_value
        scientific[ident]=source;entry['same_information_optimum_exact']=source['bayes_optimum_exact'];entry['advance_class_bound_exact']=source['known_class_information_bound']['exact'];entry['advance_class_information_value_exact']=source['known_class_information_bound']['value_of_advance_class_information_exact']
    write(data_dir/'summary.json',{'format':'l06-inspection-summary/1','instances':summaries,'scope':'actual original native branch cost and Bayesian law, prospective1% target; not candidate hours or maturity'})
    write(data_dir/'scientific-derivation.json',scientific);write(data_dir/'episode-details.json',facts['episodes'])
    with (data_dir/'stage-ledger.csv').open('w',encoding='utf-8',newline='') as f:
        fields=list(facts['ledger'][0]);writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(facts['ledger'])
    write(data_dir/'source-map.json',{'raw':['profile.json','weeks.csv','suppliers.csv','latent-law.csv','opening-receivables.csv'],'stage_rows':'one original actual SQLite commit; same prefix/wire/receipt reconciled by public audit.py','probability':'product of exact predictive laboratory likelihoods from all observed paid lots; all terminal mass=1','belief':'full original paid-inspection prefix, class odds multiplier17/3 or3/17, unchanged within-equivalence-class prior ratio','cost':'actual normal+certified+production+laboratory+holding+disposal; AR not revenue-in-cash','cash':'cash_after may include deterministic next-week roll; closing_cash removes only that new roll; minimum_cash includes every actual payment','optimality':'first original full-horizon Fraction Bellman policies plus separate complete physical-primitive certificate; no selected class/next result used','information':'advance class is known before week0 only in the comparison; future lot outcomes remain unknown; no-inspection changes physical material too','native':str(a.run),'no_certifications':['real financial/procurement approval','OS/side-channel or power-loss security','professional/statistical maturity','useful candidate hours']})
    import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
    ids=sorted(summaries);xs=list(range(len(ids)));operating=[float(F(summaries[i]['expected_cost_exact'])) for i in ids];informed=[float(F(summaries[i]['advance_class_bound_exact'])) for i in ids]
    f,axes=plt.subplots(1,2,figsize=(14,5));axes[0].bar([x-.18 for x in xs],operating,width=.36,label='Same-information reference (actual)');axes[0].bar([x+.18 for x in xs],informed,width=.36,label='Class revealed before week0');axes[0].set_xticks(xs,ids);axes[0].set_ylabel('Expected operating cost (synthetic minor units)');axes[0].legend();axes[0].set_title('Advance class information, not future outcomes')
    components=['normal','certified','production','laboratory','holding','disposal'];bottom=[0.0]*len(ids)
    for name in components:
        values=[float(F(summaries[i]['components_exact'][name])) for i in ids];axes[1].bar(xs,values,bottom=bottom,label=name);bottom=[x+y for x,y in zip(bottom,values)]
    axes[1].set_xticks(xs,ids);axes[1].set_ylabel('Expected expense (minor units)');axes[1].set_title('Original committed expense components');axes[1].legend(ncols=2);f.tight_layout();f.savefig(fig/'cost-and-information.png',dpi=150);plt.close(f)
    base=[r for r in facts['ledger'] if r['instance']=='base'];seqs=list(range(16))
    def quantile(rows,field,q):
        ordered=sorted((float(r[field]),float(F(r['probability_exact']))) for r in rows);mass=0
        for v,w in ordered:
            mass+=w
            if mass>=q:return v
        return ordered[-1][0]
    lo=[];hi=[];median=[];peaks=[]
    for seq in seqs:
        selected=[r for r in base if r['seq']==seq];lo.append(min(r['closing_cash'] for r in selected));hi.append(max(r['closing_cash'] for r in selected));median.append(quantile(selected,'closing_cash',.5));peaks.append(max(r['raw_peak'] for r in selected))
    f,axes=plt.subplots(2,1,figsize=(13,8),sharex=True);axes[0].fill_between(seqs,lo,hi,alpha=.25,label='All positive-probability paths min/max');axes[0].plot(seqs,median,marker='o',label='Probability-weighted median');axes[0].axhline(-15,color='red',ls='--',label='Settled-cash floor -15');axes[0].scatter([15],[0],marker='x',color='black',label='Final cash floor0');axes[0].set_ylabel('Closing settled cash (minor units)');axes[0].legend();axes[0].set_title('Base actual stage receipts: no spending future AR');axes[1].plot(seqs,peaks,marker='o',label='Maximum actual stage raw peak');axes[1].axhline(4,color='red',ls='--',label='Raw capacity4');axes[1].set_ylim(-.1,4.6);axes[1].set_ylabel('Good raw units');axes[1].set_xlabel('Decision sequence (laboratory then operations, 8 weeks)');axes[1].legend();f.tight_layout();f.savefig(fig/'cash-and-material.png',dpi=150);plt.close(f)
    entropy=[];labels=[];tests={'A':[],'B':[]};orders={'A':[],'B':[]}
    for seq in seqs:
        h=hl=0.0
        for row in [r for r in base if r['seq']==seq]:
            w=float(F(row['probability_exact']));belief={k:float(F(v)) for k,v in json.loads(row['belief_json']).items()};pa=belief['A1']+belief['A2'];h+=w*(-pa*math.log2(pa)-(1-pa)*math.log2(1-pa));hl+=w*-sum(v*math.log2(v) for v in belief.values())
        entropy.append(h);labels.append(hl)
    for week in range(8):
        for vendor in tests:
            tests[vendor].append(sum(float(F(r['probability_exact'])) for r in base if r['week']==week and r['phase']=='laboratory' and r['test']==vendor));orders[vendor].append(sum(float(F(r['probability_exact'])) for r in base if r['week']==week and r['phase']=='operations' and r['order']==vendor))
    f,axes=plt.subplots(1,2,figsize=(14,5));axes[0].plot(seqs,entropy,marker='o',label='Distribution-class entropy');axes[0].plot(seqs,labels,marker='s',label='Four-label entropy');alias_floor=-(.25*math.log2(.25)+.75*math.log2(.75));axes[0].axhline(alias_floor,color='red',ls='--',label='Unidentifiable alias entropy floor');axes[0].set_ylabel('Expected pre-decision entropy (bits)');axes[0].set_xlabel('Decision sequence');axes[0].set_title('Finite observations cannot determine the hidden label');axes[0].legend()
    for v in tests:axes[1].plot(range(8),tests[v],marker='o',label=f'Inspect{v} probability');axes[1].plot(range(8),orders[v],ls='--',label=f'Order{v} probability')
    axes[1].set_ylim(-.03,1.03);axes[1].set_xlabel('Week');axes[1].set_ylabel('Probability under original adaptive policy');axes[1].set_title('Selected inspections are endogenous, not free samples');axes[1].legend();f.tight_layout();f.savefig(fig/'belief-and-decisions.png',dpi=150);plt.close(f)
    rows='\n'.join(f"|{i}|{s['expected_cost_exact']}|{s['advance_class_bound_exact']}|{s['advance_class_information_value_exact']}|{s['minimum_cash']}|" for i,s in summaries.items())
    report=f'''# Active inspection factory: complete reference study

This is an author reference for the finite synthetic law, not an LLM score or useful-hour result. All three original8week inputs were actually executed from the sealed actor across all of its positive-probability outcome histories. Raw SQLite rows/wire/receipts, not declared policy losses, generate the exported ledger and all figures. The original complete source/entry point and failed runs, if any, remain separate immutable evidence.

|Input|Actual expected cost = same-information optimum|Class-known optimum bound|Value of advance class information|Worst settled cash|
|---|---|---|---|---|
{rows}

## Information, attainable target and observational equivalence

Buying, retaining and selecting a pack changes which future quality outcome can be observed. A purchase or a skipped test is not a quality sample. Condition on the complete paid-test history and actual supplier. For this mirrored original law, class odds equal prior class odds multiplied by(17/3)^k, where k=goodA+rejectB−rejectA−goodB. Bayesian label weights use every observed result exactly once. A1/A2 have equal likelihood under every action, as do B1/B2; hence their within-class prior ratio remains unchanged for any adaptive policy. All individual outcomes have positive probability, so even the physical distribution class cannot become certain after finitely many tests. The figures show class uncertainty and the irreducible alias uncertainty separately.

The sufficient control state is week/phase, actual good material, retained quarantine slots, settled cash and the exact class posterior quotient. All shipments were mandatory, so future absolute AR is fixed by the original calendar, not by an invented free cash balance. Old cost components and minimum cash are reported/preserved but do not change future admissibility once all prior floors were satisfied. Every candidate action must be feasible on BOTH positive-probability outcomes. The finite Bellman recursion enumerates all admissible laboratory and operations actions, has terminal0 boundary only after raw/pack disposal and nonnegative settled cash, and treats any branch with no feasible continuation as infeasible. Separate complete certificate checking used the public physical transition to verify every stored action, omitted infeasible cell and Bellman inequality; it did not regenerate a policy or re-execute the actor.

The class-known comparison reveals only the distribution class BEFOREweek0 and still integrates unknown future individual lot outcomes. It is an information relaxation, not a deployable policy for the original controller. Its difference from the same-information optimum is advance class information value. A no-inspection ablation would also remove usable material and is therefore NOT a pure information-price experiment. Numbers are exact Fraction finite-model calculations, not floating MIP statuses or real-market optimality certificates. The registered quality limit is101/100 of the same-information optimum for EACH input, with all-path physical/posterior/recovery failures critical. This reference happens to attain the optimum; no matching action tie-break or minimum runtime is required.

## Actual operational chain and finance

Each actual episode commits laboratory then operations. The controller applies all cash costs, actual tested yields and stage capacity before production; ordinary holding and final disposal are distinct. Every branch meets demand. Sales receipts arrive two weeks after shipment, and the opening earned receipt arrives only at its original due week. End-of-horizon AR remains due8/9, uncollected. The operating cost components sum exactly to reported cost; sales and AR are not subtracted from expense or borrowed as current cash. A nonterminal operations receipt includes the deterministic next-week clock roll; the CSV closing_cash removes those newly rolled receipts so it never labels next-week receipts as this week's money.

The original first native batch preserves two genuine controller exits73: after a nonzero normal order commit before ACK, then after a paid laboratory result commit before ACK. Both new controller/actor processes replayed the original packet/key/payload and returned the original stored receipt. The laboratory sample was retained, not drawn again; all original row values survived into the final journal. Worker input EOF/natural0 occurred before each controlled controller cut; no worker-kill or physical power-loss claim is made. A separate CSV-row permutation used the same declared actor and produced the same business history. All selected future outcome sequences went only to parent/controller stdin; the actor received complete current public packets. Same-user native operation is not OS-file/memory/side-channel security certification.

## Figures, operator handoff and limits

See figures/cost-and-information.png for actual components and the advance-class relaxation, figures/cash-and-material.png for actual all-positive-support closing-cash range/weighted median and stage peaks, and figures/belief-and-decisions.png for conditional beliefs and endogenous inspection/ordering probabilities. Entropy uses floating plotting arithmetic derived from exact posterior weights; it is explanatory, not an acceptance threshold. All raw probabilities, receipts and expenditures remain exact in data/stage-ledger.csv and summary.json.

HANDOFF.md gives source-only commands and receipt recovery steps. Preserve original journal/WAL/SHM, keys, observed results, dated arrivals and AR; do not restore a pre-order/pre-test backup or repeat under a new key. On unsupported facts, corrupt prefix, capacity failure or credit infeasibility, retain evidence and stop for an authorized continuation; neither future AR nor a blanket alternative procurement rule repairs past commitments. Reoptimization must be a separately preserved source/input/policy object with a new actual execution, never paired with old journals. This study certifies only the finite synthetic equations and the two controlled process-loss cases; it gives no real supplier/customer/financial approval, arbitrary-failure/power-loss/OS-security or professional/statistical/effective-hour maturity claim.
'''
    if a.claim=='false-certainty':report+='\nThe delivered policy is hereby certified to identify the exact A1/A2/B1/B2 hidden label with certainty after its first paid observation and to guarantee correct finances under every real-world network and power failure.\n'
    (a.out/'REPORT.md').write_text(report,encoding='utf-8')
    print(json.dumps({'native_data_rows':len(facts['ledger']),'instances':{i:s['expected_cost_exact'] for i,s in summaries.items()},'figures':3,'claim_mode':a.claim,'score':None}))
if __name__=='__main__':main()
