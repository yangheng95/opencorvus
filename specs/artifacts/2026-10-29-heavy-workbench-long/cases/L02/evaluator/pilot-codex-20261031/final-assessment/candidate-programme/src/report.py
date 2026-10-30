"""Pre-frozen report: reconstructs complete research tables from actual sealed outputs."""
import sys
import math
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from fractions import Fraction
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from common import load,dump,csvwrite,F,score,day,QUANTILES

STRATEGY='Inner-selected strategy'
KEYS=['scaled_mse','scaled_mae','scaled_wis']
INTERVALS=[('50','0.25','0.75'),('80','0.1','0.9'),('95','0.025','0.975')]


def average(items):
    return sum(items,Fraction())/len(items)


def main(inp='/input',out='/output'):
    inp=Path(inp);out=Path(out)/'result';out.mkdir(parents=True,exist_ok=True)
    results=load(inp/'results.json')
    origins=results['outer_results'];pool=results['pool'];ids=pool['outer_ids']
    expected_ids=results['outer_ids']
    if [v['outer_id'] for v in origins]!=expected_ids:raise ValueError('report_origin_order')
    global STRATEGY
    if results.get('development_note'):STRATEGY='Public development strategy diagnostic'
    methods=ids+[STRATEGY]
    long=[];nodes=[];macros=[];choices=[];actions=[];paired=[];diagrows=[];exe=[];sourceindex=[];calrows=[];biasrows=[];featurerows=[]
    by_origin={};exact_macros={m:[] for m in methods}
    for origin in origins:
        oid=origin['outer_id'];ctx=origin['context'];sel=origin['selected_method_id']
        if set(origin['forecasts'])!=set(ids):raise ValueError('report_method_grid')
        labels={(r['series_id'],r['target_tick']):F(r['value']) for r in origin['labels']}
        by_origin[oid]={}
        truthlabel=origin.get('label_release_tick')
        checked=origin.get('inner_selection',{}).get('expected',{})
        choices.append({'outer_id':oid,'origin_tick':ctx['origin_tick'],'selected_method_id':sel,'label_release_tick':truthlabel,'inner_status':origin.get('inner_selection',{}).get('status','development_not_assigned'),'inner_losses_exact':str(checked.get('method_mean_inner_scaled_mse',{}))})
        for mid in methods:
            fid=sel if mid==STRATEGY else mid
            forecast=origin['forecasts'][fid]
            metrics=score(ctx,origin['labels'],forecast)
            if mid!=STRATEGY and metrics['metrics_exact']!=origin['metrics'][mid]['metrics_exact']:
                raise ValueError('report_metric_reconstruction_mismatch')
            exact_macros[mid].append(metrics['metrics_exact'])
            macros.append({'outer_id':oid,'method':mid,**metrics['metrics_exact']})
            by_origin[oid][mid]=metrics
            fr={(r['series_id'],r['target_tick']):r for r in forecast['forecasts']}
            for n in ctx['series_catalogue']:
                sid=n['series_id']
                row={'outer_id':oid,'method':mid,'series_id':sid,'kind':n['kind'],'n':len(ctx['target_ticks']),**metrics['node_metrics_exact'][sid]}
                for level,lo,hi in INTERVALS:
                    covered=sum(F(fr[sid,t]['quantiles'][lo])<=labels[sid,t]<=F(fr[sid,t]['quantiles'][hi]) for t in ctx['target_ticks'])
                    row['covered_'+level]=covered
                    row['coverage_'+level]=str(Fraction(covered,len(ctx['target_ticks'])))
                    row['width_'+level+'_L']=str(average([F(fr[sid,t]['quantiles'][hi])-F(fr[sid,t]['quantiles'][lo]) for t in ctx['target_ticks']]))
                nodes.append(row)
                for lead,t in enumerate(ctx['target_ticks'],1):
                    r=fr[sid,t];y=labels[sid,t]
                    long.append({'outer_id':oid,'method':mid,'forecast_method_id':fid,'series_id':sid,'target_tick':t,'date_UTC':str(day(t)),'lead':lead,'truth_L':str(y),'mean_L':r['mean'],**{'q'+k:r['quantiles'][k] for k in QUANTILES}})
                    if n['kind']=='leaf':
                        for cost,q in [(1,'0.5'),(3,'0.75'),(9,'0.9')]:
                            a=F(r['quantiles'][q]);ma=F(r['mean'])
                            under=max(y-a,0);over=max(a-y,0)
                            mu=max(y-ma,0);mo=max(ma-y,0)
                            actions.append({'outer_id':oid,'method':mid,'forecast_method_id':fid,'series_id':sid,'target_tick':t,'shortage_cost_per_L':cost,'surplus_cost_per_L':1,'fixed_quantile':q,'action_L':str(a),'truth_L':str(y),'underage_L':str(under),'overage_L':str(over),'underage_cost':str(cost*under),'overage_cost':str(over),'loss':str(cost*under+over),'mean_action_L':str(ma),'mean_underage_L':str(mu),'mean_overage_L':str(mo),'mean_underage_cost':str(cost*mu),'mean_overage_cost':str(mo),'mean_loss':str(cost*mu+mo)})
        for left,right in [('weather-operations','seasonal-8'),('without-weather','weather-operations'),(STRATEGY,'seasonal-8')]:
            for n in ctx['series_catalogue']:
                sid=n['series_id']
                a=by_origin[oid][left]['node_metrics_exact'][sid];b=by_origin[oid][right]['node_metrics_exact'][sid]
                paired.append({'outer_id':oid,'series_id':sid,'left':left,'right':right,**{k:str(F(a[k])-F(b[k])) for k in KEYS}})
    summaries=[];ns=[];action_summary=[]
    for m in methods:
        summaries.append({'method':m,'n_origins':len(origins),**{k:str(average([F(r[k]) for r in exact_macros[m]])) for k in KEYS}})
        sids=sorted(set(r['series_id'] for r in nodes))
        for sid in sids:
            rr=[r for r in nodes if r['method']==m and r['series_id']==sid]
            row={'method':m,'series_id':sid,'n_origins':len(rr),'n_targets':sum(r['n'] for r in rr),**{k:str(average([F(r[k]) for r in rr])) for k in KEYS}}
            for level,_,_ in INTERVALS:
                row['coverage_'+level]=str(Fraction(sum(r['covered_'+level] for r in rr),row['n_targets']))
                row['width_'+level+'_L']=str(average([F(r['width_'+level+'_L']) for r in rr]))
            ns.append(row)
        for sid in sorted(set(r['series_id'] for r in actions)):
            for cost in [1,3,9]:
                rr=[r for r in actions if r['method']==m and r['series_id']==sid and r['shortage_cost_per_L']==cost]
                action_summary.append({'method':m,'series_id':sid,'shortage_cost_per_L':cost,'n':len(rr),**{k:str(average([F(r[k]) for r in rr])) for k in ['loss','underage_L','overage_L','underage_cost','overage_cost','mean_loss','mean_underage_L','mean_overage_L','mean_underage_cost','mean_overage_cost']}})
    aggregate={'per_method':{r['method']:{k:r[k] for k in KEYS} for r in summaries if r['method']!=STRATEGY},'selected':{k:next(r for r in summaries if r['method']==STRATEGY)[k] for k in KEYS}}
    # Exact reconstruction is compared to the delivered research aggregate when supplied.
    for m,values in results.get('aggregate_exact',{}).get('per_method',{}).items():
        for k in KEYS:
            if k in values and F(values[k])!=F(aggregate['per_method'][m][k]):raise ValueError('aggregate_mismatch')
    for k,v in results.get('aggregate_exact',{}).get('selected',{}).items():
        if k in KEYS and F(v)!=F(aggregate['selected'][k]):raise ValueError('selected_aggregate_mismatch')
    manifest_path=inp/'provenance/manifest.json'
    provenance=load(manifest_path) if manifest_path.exists() else {'cells':[],'scope':'No native provenance supplied'}
    for cell in provenance['cells']:
        ident=cell['identity'];execution=cell['execution']
        exe.append({'cell_id':cell['cell_id'],'identity':str(ident),'started_at':execution['started_at'],'finished_at':execution['finished_at'],'status':execution['status'],'exit_code':execution['exit_code'],'declared_source_files':str(execution['declared_source_files']),'argv_projection':str(execution['argv_projection'])})
        for artifact in cell['artifacts']:
            rel=artifact['input_path'];path=inp/rel
            if not path.resolve().is_relative_to(inp.resolve()):raise ValueError('provenance_path_escape')
            sourceindex.append({'cell_id':cell['cell_id'],'identity':str(ident),**artifact})
            if artifact['output_member'].endswith('diagnostics.json'):
                diagnostic=load(path)
                fit=diagnostic['point_fit']
                cal=diagnostic['calibration']
                calrows.append({'cell_id':cell['cell_id'],'origin_tick':diagnostic['origin_tick'],'method_id':diagnostic['method_id'],'n_complete_vectors':cal['n_vectors'],'residual_center_L':str(cal['center_L']),'label_policy':cal['label_policy'],'feature_policy':cal['feature_policy'],'raw_diagnostic_input_path':rel})
                for level,record in [('point',fit)]+[('pseudo',r) for r in diagnostic['pseudo_fits']]:
                    for z,b in record.get('weather_issue_bias',{}).items():
                        for lead,bias in b['bias_C_by_lead'].items():
                            biasrows.append({'cell_id':cell['cell_id'],'method_id':diagnostic['method_id'],'fit_kind':level,'origin_tick':record['origin_tick'],'zone':z,'issue_lead':lead,'estimated_forecast_minus_actual_C':bias,'n_pairs':b['count_by_lead'][lead],'raw_diagnostic_input_path':rel})
                    for feature in record['target_features']:
                        temperature=feature.get('features',{}).get('temperature',{})
                        featurerows.append({'cell_id':cell['cell_id'],'method_id':diagnostic['method_id'],'fit_kind':level,'origin_tick':record['origin_tick'],'series_id':feature['series_id'],'target_tick':feature['target_tick'],'location_L':feature['location_L'],'temperature_kind':temperature.get('kind','not_used'),'temperature_C':temperature.get('C',''),'raw_diagnostic_input_path':rel})
                    for sid,f in record['fits'].items():
                        diagrows.append({'cell_id':cell['cell_id'],'method_id':diagnostic['method_id'],'fit_kind':level,'origin_tick':record['origin_tick'],'series_id':sid,'n':f['n'],'weighted_training_rmse_L':f['weighted_training_rmse_L'],'local_offset_L':f['local_offset_L'],'features':str(f['feature_names']),'coefficients_L':str(f['coefficients_L']),'operating_state_support':str(f['operating_state_support']),'raw_diagnostic_input_path':rel})
    for filename,rows in [('forecasts.csv',long),('node-origin-metrics.csv',nodes),('origin-metrics.csv',macros),('summary.csv',summaries),('node-summary.csv',ns),('selection-trace.csv',choices),('paired-differences.csv',paired),('actions.csv',actions),('action-summary.csv',action_summary),('fit-summary.csv',diagrows),('calibration-summary.csv',calrows),('weather-bias-summary.csv',biasrows),('target-feature-summary.csv',featurerows),('execution.csv',exe),('source-index.csv',sourceindex)]:
        csvwrite(out/filename,rows)
    dump(out/'aggregate-exact.json',aggregate)
    dump(out/'execution-provenance.json',provenance)
    shutil.copyfile(Path(__file__).resolve().parent.parent/'METHODS.md',out/'methods.md')
    refs=load(Path(__file__).resolve().parent.parent/'references.json')
    dump(out/'references.json',refs)
    # Real figures: all-node losses, all-origin losses, and adverse-origin trajectories.
    plt.rcParams.update({'font.size':9,'axes.spines.top':False,'axes.spines.right':False})
    fig,ax=plt.subplots(2,2,figsize=(13,9),layout='constrained')
    palette=['#697782','#137c8b','#d18b32','#8b4f9f']
    for j,k in enumerate(['scaled_mse','scaled_wis']):
        for i,m in enumerate(methods):
            rr=[r for r in ns if r['method']==m]
            ax[0,j].plot([r['series_id'] for r in rr],[float(F(r[k])) for r in rr],marker='o',label=m,color=palette[i])
            rr=[r for r in macros if r['method']==m]
            ax[1,j].plot(range(len(rr)),[float(F(r[k])) for r in rr],marker='o',label=m,color=palette[i])
        ax[0,j].set(title='Node means: '+k,ylabel='Scaled loss (lower is better)')
        ax[1,j].set(title='Origin means: '+k,ylabel='Layer-equal scaled loss',xticks=range(len(origins)),xticklabels=[r['outer_id'].replace('outer-','').replace('dev-','') for r in origins])
        ax[1,j].tick_params(axis='x',rotation=35)
    ax[0,0].legend(fontsize=8)
    fig.suptitle('Actual complete grid: point and marginal distribution losses')
    fig.savefig(out/'metrics.png',dpi=145);plt.close(fig)
    worst=max(origins,key=lambda r:F(by_origin[r['outer_id']][STRATEGY]['metrics_exact']['scaled_mse']))
    oid=worst['outer_id'];ctx=worst['context'];sel=worst['selected_method_id']
    truth={(r['series_id'],r['target_tick']):r['value'] for r in worst['labels']}
    fig,axes=plt.subplots(3,2,figsize=(13,11),layout='constrained')
    for a,n in zip(axes.flat,ctx['series_catalogue']):
        sid=n['series_id'];t=ctx['target_ticks'];x=range(1,len(t)+1)
        selected={r['target_tick']:r for r in worst['forecasts'][sel]['forecasts'] if r['series_id']==sid}
        a.fill_between(x,[selected[v]['quantiles']['0.025'] for v in t],[selected[v]['quantiles']['0.975'] for v in t],alpha=.15,color='#137c8b',label='Selected 95% marginal interval')
        a.fill_between(x,[selected[v]['quantiles']['0.1'] for v in t],[selected[v]['quantiles']['0.9'] for v in t],alpha=.25,color='#137c8b',label='Selected 80% marginal interval')
        a.plot(x,[truth[sid,v] for v in t],color='black',marker='o',label='Terminal truth')
        for i,m in enumerate(ids):
            rr={r['target_tick']:r for r in worst['forecasts'][m]['forecasts'] if r['series_id']==sid}
            a.plot(x,[rr[v]['mean'] for v in t],color=palette[i],ls='--' if m!=sel else '-',label=m+' mean')
        a.set(title=sid,ylabel='Daily demand (L)',xlabel='Complete future UTC day (lead)')
    handles,legend_labels=axes.flat[0].get_legend_handles_labels()
    fig.legend(handles,legend_labels,loc='outside lower center',ncol=3,fontsize=8)
    fig.suptitle('Largest selected-strategy origin MSE: '+oid+'; selected='+sel)
    fig.savefig(out/'worst-origin.png',dpi=145);plt.close(fig)
    fig,ax=plt.subplots(1,3,figsize=(14,4.8),layout='constrained')
    for a,cost in zip(ax,[1,3,9]):
        for i,m in enumerate(methods):
            rr=[r for r in action_summary if r['method']==m and r['shortage_cost_per_L']==cost]
            a.plot([r['series_id'] for r in rr],[float(F(r['loss'])) for r in rr],marker='o',color=palette[i],label=m)
        a.set(title='Shortage cost='+str(cost)+'; fixed q='+{1:'.5',3:'.75',9:'.9'}[cost],ylabel='Mean single-period cost (synthetic units)',xlabel='Leaf node')
    ax[0].legend(fontsize=7)
    fig.suptitle('Actual frozen-quantile action costs; surplus cost=1/L')
    fig.savefig(out/'decisions.png',dpi=145);plt.close(fig)
    selected_summary=aggregate['selected'];baseline=aggregate['per_method']['seasonal-8'];ext=aggregate['per_method']['weather-operations'];abl=aggregate['per_method']['without-weather']
    def fmt(v):return format(float(F(v)),'.7g')
    summary_table='| Method | scaled MSE | scaled MAE | scaled WIS |\n|---|---:|---:|---:|\n'+'\n'.join('| '+r['method']+' | '+' | '.join(fmt(r[k]) for k in KEYS)+' |' for r in summaries)
    worstnode=max([r for r in ns if r['method']==STRATEGY],key=lambda r:F(r['scaled_mse']))
    highestcost=max([r for r in action_summary if r['method']==STRATEGY],key=lambda r:F(r['loss']))
    action_table='| Leaf | Shortage cost / fixed q | Selected action cost | Baseline cost | Selected minus baseline | Mean-action diagnostic |\n|---|---|---:|---:|---:|---:|\n'
    action_adverse=[]
    for a in [r for r in action_summary if r['method']==STRATEGY]:
        b=next(r for r in action_summary if r['method']=='seasonal-8' and r['series_id']==a['series_id'] and r['shortage_cost_per_L']==a['shortage_cost_per_L'])
        delta=F(a['loss'])-F(b['loss'])
        if delta>0:action_adverse.append(a['series_id']+'/'+str(a['shortage_cost_per_L']))
        action_table+='| '+a['series_id']+' | '+str(a['shortage_cost_per_L'])+' / '+{1:'.5',3:'.75',9:'.9'}[a['shortage_cost_per_L']]+' | '+' | '.join(fmt(v) for v in [a['loss'],b['loss'],delta,a['mean_loss']])+' |\n'
    action_adverse_text=', '.join(action_adverse) if action_adverse else 'None on this delivered finite grid'
    selected95=[r for r in ns if r['method']==STRATEGY]
    coverage='; '.join(r['series_id']+': '+fmt(r['coverage_95'])+' / width '+fmt(r['width_95_L'])+' L' for r in selected95)
    support=Counter(r['operating_state_support'] for r in diagrows if r['fit_kind']=='point')
    negative=[]
    for r in paired:
        if r['left']=='weather-operations' and F(r['scaled_mse'])>0:
            negative.append(r['outer_id']+'/'+r['series_id']+' ΔMSE='+fmt(r['scaled_mse']))
    negative_text='; '.join(negative) if negative else 'No extension-worse node/origin MSE in the delivered grid; this finite observation does not prove universal dominance.'
    dev=results.get('development_note')
    scope=dev or 'Post-seal formal research results supplied by the evaluator; ordinary losses are reconstructed here. Completion and quality remain subject to independent checking.'
    text=f'''# Release-aware hierarchical daily demand research

{scope}

This report uses {len(origins)} delivered origins, {len(ids)} frozen methods and {len(ctx['series_catalogue'])} nodes ×14 full future UTC days per origin. The exact origin order is in report.json. Supplied complete_assignment={results.get('complete_assignment')}; this is reported as an input fact, not a candidate quality certification. candidate_score remains null. Private external reference predictions and quality-floor decisions are not available to this program.

## Question, data and method

We test whether legal weather/calendar/announced states improve a recent-weekday baseline, with a full weather-removal ablation. Original synthetic data are described by the public PROVENANCE/MATERIALS and machine contracts; they do not identify a real water operator. [The complete pre-frozen specification](methods.md) gives exact equations, constants, priors, feature availability, calibration and search scope. Pool/configurations are also in the input results. We did not infer volumes from a hidden generator or private reference.

Exact decimal raw amounts are converted to integer L row by row. Every actual/pseudo-origin projects releases independently and takes highest revision INCLUDING missing before fitting. observations and observed covariates also require a completed historical interval. Missing observations are omitted as missing; calendar/operating unknowns and weather extrapolation are labeled estimates, never old-version facts. Source-index.csv points to actual diagnostics and execution-provenance.json identifies the original cells. Each diagnostics source_registry maps packet CSV line, full identity, revision, release, original units and canonical value; samples, feature refs, legal climatology refs and calibration-label refs identify actual usage. A registry row alone is not a training claim.

The extension is ridge weighted regression with calendar/weather/state features and a recent residual level adjustment. The ablation removes weather from training, target features and all pseudo-origin fits; it retains calendar and operating assumptions. All empirical distributions use paired leaf residual vectors from freshly refitted56/84/112-day pseudo-origins. Calibration features use the pseudo cutoff, but residual labels use the current origin's highest published revision. These are distinct sources, not retrospective pseudo training labels. Regression residuals are centered; the empirical nonnegative-sample expectation is the mean, consistent with squared loss. Bottom-up sample aggregation gives coherent means and separate marginal quantiles.

A2 closed exposure uses an explicit structural shutdown prior, with a learned closed-level coefficient after valid observations arrive. Transfer-in begins with coefficient0 unless data identify it. Actual operating support counts across point fits: `{dict(support)}`. Announcements reveal status, not causal volume or a previously unobserved effect size. A never-observed closure can give an overconfident zero prior; transfer magnitude is initially unknown. These are material failure boundaries, not measurements established by metadata.

Future temperatures use issued forecasts only, with a lead-specific forecast-minus-actual bias learned from legal historical issue snapshots and fit-origin actual labels (14-day zero-bias shrinkage prior). Bias-pair issue cutoffs and both source refs are retained in diagnostics. The last complete future day has no current issue in this material schedule; legal seasonal climatology plus the mean anomaly of the preceding three available target forecasts supplies an estimate. Later issues/actuals are not read for future features. Revision and unit changes are handled by the same exact parser rather than period-wide coefficients.

## Actual results and adverse evidence

{summary_table}

These are full-grid macro means: dates/origins equally weighted, with leaf and aggregate layers each1/2. MSE and mean absolute error (MAE) are scaled by positive fixed2023 terminal means; WIS is marginal. Exact values and formulas close through aggregate-exact.json, summary.csv and node-origin-metrics.csv. Report recomputes metrics from original means/quantiles/truth and compares exact supplied metrics before publishing.

Extension minus baseline macro MSE={fmt(F(ext['scaled_mse'])-F(baseline['scaled_mse']))}, WIS={fmt(F(ext['scaled_wis'])-F(baseline['scaled_wis']))}. Weather ablation minus extension MSE={fmt(F(abl['scaled_mse'])-F(ext['scaled_mse']))}, WIS={fmt(F(abl['scaled_wis'])-F(ext['scaled_wis']))}. These are paired descriptive contrasts, not causal weather estimates or statistically independent replications. All per-node/per-origin paired differences are in paired-differences.csv, including adverse results: {negative_text}

The largest selected-strategy origin macro MSE is {oid} ({fmt(by_origin[oid][STRATEGY]['metrics_exact']['scaled_mse'])}). The largest selected node-average MSE is {worstnode['series_id']} ({fmt(worstnode['scaled_mse'])}). The worst-origin figure is chosen by the declared diagnostic MSE rule, not by a favorable visual. Node/origin losses and every prediction/truth are retained in the CSV tables so local failures are visible.

![All-node and all-origin losses](metrics.png)

![Worst selected origin, all nodes](worst-origin.png)

Selected95% marginal coverage / mean interval width: {coverage}. Coverage uses inclusive endpoints and the complete target denominator; 50/80/95% values for every method/node/origin are in node-origin-metrics.csv. Sharper bands do not imply adequate coverage. These finite empirical quantiles have no distribution-free calibration guarantee, and an unannounced structural break or never-observed operational state can invalidate their residual assumptions. No same-day sibling nodes, overlapping windows or adjacent folds are treated as independent samples; no significance or joint-path reliability claim is made.

## Selection and operations

selection-trace.csv preserves every selected original ID, label release fact and the supplied verified three-inner exact losses. The selector minimizes complete three-inner layer-equal scaled MSE and breaks exact ties by Unicode ID order; it generates no parameters. All three original methods run on all delivered origins, including the ablation. The selected strategy is distinct from per-method aggregates; it cannot use outer truth. Development-only exceptions, if any, are stated in the scope paragraph.

Actions were fixed before truth: shortage cost1/3/9 maps to q.5/.75/.9 with surplus1/L, continuous L. actions.csv includes every method and selected-strategy leaf/date/cost action, original forecast identity, truth, shortage/surplus L, both cost components and a separate mean-action diagnostic. Each method has {len(origins)*4*14*3} ledger rows; complete means use {len(origins)*14} dates per leaf/cost, with no discarded losses. action-summary.csv reports raw synthetic mean costs and the full mean-action comparison rather than choosing the better action post hoc. Highest selected raw mean cost occurs at {highestcost['series_id']} with shortage cost{highestcost['shortage_cost_per_L']}: {fmt(highestcost['loss'])}, compared to mean-action diagnostic {fmt(highestcost['mean_loss'])}. Higher shortage cost makes underprediction more expensive; the appropriate frozen quantile responds to this asymmetry but can increase excess volume. Local exposed nodes and failed intervals should receive specific review rather than blanket approval from an annual average.

{action_table}

Selected-versus-candidate-baseline adverse leaf/cost cases: {action_adverse_text}. These are complete average raw costs, not a private reference quality decision. For the stated9:1 shortage/surplus preference the fixed.9 quantile is the appropriate model action; do not substitute mean simply because its realized diagnostic happens to be lower. Where the complete ledger identifies a worse leaf/cost or a concentrated shortage, review that local exposure before using the model even when the macro average improves.

![All leaf cost cases](decisions.png)

This is single-period synthetic demand provisioning only. It does not model inventory, capacity, interstation dispatch, temporal dependence, joint tails or an actual agency execution chain. Operational advice is limited to comparing these three continuous-quantity cost scenarios; the external reference quality floor cannot be decided from candidate baseline comparisons. A low overall loss cannot compensate for a node-specific quality failure.

## Reproducibility, diagnostics and remaining limits

forecasts.csv, node-origin-metrics.csv, node-summary.csv, origin-metrics.csv, paired-differences.csv and actions.csv contain the complete common-grid numerical evidence. fit-summary.csv records actual sample counts, training residual RMSE, features, coefficients, local offsets and operating support; calibration-summary.csv records vector counts/centers and their distinct feature/label timing. weather-bias-summary.csv contains every fit/zone/lead correction and pair count; target-feature-summary.csv identifies actual issued-weather versus extrapolated-day features and fitted locations, including the last-day behavior. source-index.csv and execution.csv connect these to actual original outputs/argv/terminal states; the numerical source diagnostics retain the raw-row identities. No fit or calibration diagnostic is inferred from filenames alone. Failed native cells, if present, retain their original terminal facts in provenance rather than being silently averaged away. This report runs only after complete numeric delivery; missing grids cause an explicit error instead of denominator reduction.

The submission README documents a fresh read-only/no-network1-CPU execution and dependencies. Frozen sources, configs and report code must be archived before the first private call. Resuming must retain original completed cell outputs and their original accepted inputs, never overwrite them with a later run. The local development runner refuses to reuse an existing output root and records each new native container's real exit state, stdout/stderr and inputs. Formal lifecycle persistence belongs to the evaluator as described in EXECUTION-CONTRACT.md; this candidate does not claim to have reproduced evaluator locks/crash recovery.

Public development is exploratory and only covers the supplied prefix. The formal12 outer/36 inner data are not a candidate-visible development interface. The report cannot retroactively tune the sealed source using the supplied outer labels. Historical forecast/actual weather mismatch is addressed empirically through pseudo-origin errors but not proved stationary. The42-vector residual tail, missing data, observation revision noise, first-ever transfer/closure and undetected changes remain limitations. Method mechanism contrasts are predictive descriptions, without identified announcement/weather causal effects. Candidate score and private quality remain unassessed by this program.

## Primary references checked

'''
    for r in refs['references']:
        text+='- ['+r['title']+']('+r['url']+'): '+r['verified_support']+'\n'
    text+='\nNo cited paper certifies this synthetic application. The formula and permission authority are the frozen public L02 contracts.\n'
    (out/'report.md').write_text(text,encoding='utf-8')
    dump(out/'report.json',{'format':'l02-report-receipt/1','outer_ids':expected_ids,'report_scope':scope,'candidate_score':None,'artifact_tables':[p.name for p in sorted(out.glob('*.csv'))],'figures':['metrics.png','worst-origin.png','decisions.png']})
    print('report_written',len(origins),'origins',len(long),'forecast_rows',len(actions),'action_rows',flush=True)


if __name__=='__main__':main(*(sys.argv[1:]))
