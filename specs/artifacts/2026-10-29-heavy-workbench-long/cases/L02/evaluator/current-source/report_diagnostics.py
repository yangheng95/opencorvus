"""Rational derived tables for the author report, not a prediction algorithm."""
from collections import defaultdict
from fractions import Fraction as F


LEVELS = [(50,'0.25','0.75'),(80,'0.1','0.9'),(95,'0.025','0.975')]
COSTS = [(1,'0.5'),(3,'0.75'),(9,'0.9')]


def interval_diagnostics(y,q):
    return [{'coverage_level_percent':level,'hits':int(F(q[lo])<=y<=F(q[hi])),
             'assigned_days':1,'width_L':F(q[hi])-F(q[lo])} for level,lo,hi in LEVELS]


def decision(action,y,shortage):
    under,over = max(y-action,F(0)),max(action-y,F(0))
    return {'action_L':action,'shortage_L':under,'overage_L':over,
            'shortage_cost_units':shortage*under,'overage_cost_units':over,
            'loss_cost_units':shortage*under+over}


def summarize_intervals(rows,keys):
    groups = defaultdict(list)
    for row in rows:groups[tuple(row[k] for k in keys)].append(row)
    result = []
    for key,values in sorted(groups.items()):
        n = sum(r['assigned_days'] for r in values);hits = sum(r['hits'] for r in values)
        result.append({**dict(zip(keys,key)),'hits':hits,'assigned_days':n,'coverage':F(hits,n),
            'mean_width_L':sum(F(r['width_L'])*r['assigned_days'] for r in values)/n})
    return result


def derive(data):
    intervals,policy_intervals,actions = [],[],[]
    for row in data['outer_results']:
        truth = {(r['series_id'],r['target_tick']):F(r['value']) for r in row['labels']}
        kinds = {n['series_id']:n['kind'] for n in row['context']['series_catalogue']}
        selected = row['selected_method_id']
        for method in data['pool']['outer_ids']:
            for name in kinds:
                values = [r for r in row['forecasts'][method]['forecasts'] if r['series_id']==name]
                ticks = row['context']['target_ticks'];n = len(ticks)
                if len(values)!=n or {r['target_tick'] for r in values}!=set(ticks):raise ValueError('author_report_grid_incomplete')
                daily = [d for r in values for d in interval_diagnostics(truth[name,r['target_tick']],r['quantiles'])]
                for level,_,_ in LEVELS:
                    ds = [d for d in daily if d['coverage_level_percent']==level]
                    record = {'outer_id':row['outer_id'],'method_id':method,'series_id':name,
                        'coverage_level_percent':level,'hits':sum(d['hits'] for d in ds),'assigned_days':n,
                        'width_L':sum(d['width_L'] for d in ds)/n}
                    intervals.append(record)
                    if method==selected:policy_intervals.append(record)
        for r in row['forecasts'][selected]['forecasts']:
            name,tick = r['series_id'],r['target_tick']
            if kinds[name]!='leaf':continue
            y = truth[name,tick]
            for shortage,q in COSTS:
                quantile = decision(F(r['quantiles'][q]),y,shortage);mean = decision(F(r['mean']),y,shortage)
                actions.append({'outer_id':row['outer_id'],'series_id':name,'target_tick':tick,'method_id':selected,
                    'forecast_locator':'forecasts/'+selected+'/forecasts:series_id='+name+',target_tick='+str(tick),
                    'overage_cost_unit_per_L':1,'shortage_cost_unit_per_L':shortage,'frozen_quantile':q,
                    'truth_L':y,**quantile,**{'mean_'+k:v for k,v in mean.items()}})
    groups = defaultdict(list)
    for r in actions:groups[r['series_id'],r['shortage_cost_unit_per_L'],r['frozen_quantile']].append(r)
    operating = []
    fields = ['shortage_L','overage_L','shortage_cost_units','overage_cost_units','loss_cost_units']
    for (name,cost,q),rows in sorted(groups.items()):
        operating.append({'series_id':name,'shortage_cost_unit_per_L':cost,'overage_cost_unit_per_L':1,
            'frozen_quantile':q,'assigned_days':len(rows),
            **{'average_'+k:sum(r[k] for r in rows)/len(rows) for k in fields},
            **{'average_mean_'+k:sum(r['mean_'+k] for r in rows)/len(rows) for k in fields}})
    return {'intervals':intervals,
        'method-interval-summary':summarize_intervals(intervals,['method_id','series_id','coverage_level_percent']),
        'policy-interval-summary':summarize_intervals(policy_intervals,['series_id','coverage_level_percent']),
        'operating-ledger':actions,'operating-summary':operating}


def number(v):return format(float(F(v)),'.8g')


def discussion(data,tables,sources,diagnostic):
    lines = ['## Complete interval and decision diagnostics','',
        '[All interval rows](intervals.csv) give hits/assigned days and average width in litres for every method/origin/node at central50/80/95. [Method totals](method-interval-summary.csv) and [actual selected-policy totals](policy-interval-summary.csv) sum original counts over the entire grid. Selected is connected by each original selector ID, not a reserved method name. Denominator per node is '+str(sum(len(r['context']['target_ticks']) for r in data['outer_results']))+' assigned dates; the dates are dependent, not independent experiments. Wider bands can improve coverage while worsening sharpness and WIS.','',
        '| Selected node | Central band | Hits / assigned | Mean width L |','|---|---:|---:|---:|']
    for r in tables['policy-interval-summary']:
        lines.append('| '+r['series_id']+' | '+str(r['coverage_level_percent'])+'% | '+str(r['hits'])+'/'+str(r['assigned_days'])+' | '+number(r['mean_width_L'])+' |')
    lines += ['', '### Actual comparisons and failure boundaries','']
    for method in data['pool']['methods']:
        if method['role']=='ablation':
            values = data['aggregate_exact']['per_method'][method['method_id']]
            diff = {k:F(values[k])-F(data['aggregate_exact']['selected'][k]) for k in ('scaled_mse','scaled_wis')}
            lines.append(method['method_id']+' minus the actual selected policy: '+', '.join(k+' '+number(v) for k,v in diff.items())+'; negative means lower loss. A better outer ablation cannot retroactively enter the frozen selection pool. This paired descriptive comparison does not identify the causal value of weather.')
    lines += ['', 'Earlier author development had already exposed a possible June transfer/closure failure and a stronger no-weather ablation. The fixed June20 diagnostic is therefore not a blind discovery. The following values come from this execution, not a copied older report.']
    truth = {(r['series_id'],r['target_tick']):F(r['value']) for r in diagnostic['labels']}
    ticks = diagnostic['context']['target_ticks'][-4:]
    for name in ['A1','ZA']:
        rows = [r for r in diagnostic['forecasts'][diagnostic['selected_method_id']]['forecasts'] if r['series_id']==name and r['target_tick'] in ticks]
        if rows:
            y = sum(truth[name,r['target_tick']] for r in rows)/len(rows);mean = sum(F(r['mean']) for r in rows)/len(rows)
            hits = sum(F(r['quantiles']['0.1'])<=truth[name,r['target_tick']]<=F(r['quantiles']['0.9']) for r in rows)
            lines.append(name+' / '+diagnostic['outer_id']+' last four assigned days, ticks '+','.join(map(str,ticks))+': average truth '+number(y)+' L, exported mean '+number(mean)+' L, central80 hits '+str(hits)+'/'+str(len(rows))+'. These are local observations, not independent coverage trials.')
    for source in sources:
        identity = source['identity']
        if identity.get('level')!='outer' or identity['origin_id']!=diagnostic['outer_id'] or identity['method_id']!=diagnostic['selected_method_id']:continue
        audit = source['fit']['fit'].get('A1',{});features = audit.get('features',[])
        if 'transfer_in' in features:
            i = features.index('transfer_in')
            lines += ['', 'Actual A1 transfer feature: centre '+str(audit['feature_centre'][i-1])+', standardized coefficient '+str(audit['coefficient'][i])+', fit source `'+source['source']+'`. A zero centre for a nonnegative binary feature means no positive training transfer in that fit; it cannot identify the magnitude of a new transfer. This diagnostic requires verification against the captured packet and source. A notice can be known while its volume effect is unlearned.']
    lines += ['', 'Same-day leaves/zone totals, seasonal history, overlapping training/inner windows and selection create dependence. Neither twelve origins nor thousands of table rows are randomized independent replications. No p-value, causal identification or joint-tail certification is inferred. Changes not announced at the forecast cutoff, revisions and limited residual support remain exposure even when aggregate loss improves.','',
        '### Quantile actions and exported-mean diagnostic','',
        'The operating ledger keeps the original q=.5/.75/.9 action for under-cost1/3/9 and over-cost1. For each row, shortage=max(y-a,0), surplus=max(a-y,0), their costs are c_under*shortage and surplus, and loss is their sum. The mean diagnostic uses the original exported probabilistic mean, not the ridge base point. It is never substituted after observing truth.','',
        '| Leaf | Under cost | q | Days | q loss | Mean loss | q shortage L | q surplus L | q shortage cost | q surplus cost |',
        '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
    for r in tables['operating-summary']:
        fields = ['average_loss_cost_units','average_mean_loss_cost_units','average_shortage_L','average_overage_L','average_shortage_cost_units','average_overage_cost_units']
        lines.append('| '+' | '.join([r['series_id'],str(r['shortage_cost_unit_per_L']),r['frozen_quantile'],str(r['assigned_days'])]+[number(r[k]) for k in fields])+' |')
    better = [r for r in tables['operating-summary'] if r['average_mean_loss_cost_units']<r['average_loss_cost_units']]
    for cost,q in COSTS:
        rows = [r for r in tables['operating-summary'] if r['shortage_cost_unit_per_L']==cost]
        n = sum(r['assigned_days'] for r in rows)
        short = sum(r['average_shortage_L']*r['assigned_days'] for r in rows)/n
        surplus = sum(r['average_overage_L']*r['assigned_days'] for r in rows)/n
        loss = sum(r['average_loss_cost_units']*r['assigned_days'] for r in rows)/n
        lines += ['', 'Under-cost'+str(cost)+' uses q='+q+': across all '+str(n)+' station-days, average shortage '+number(short)+' L and surplus '+number(surplus)+' L per station-day, with realized average cost '+number(loss)+'. Read this exposure under the stated penalty, not as a guarantee that its quantile avoids shortage. Higher quantiles trade more surplus for less shortage under the same forecast; the displayed local regime failure still needs business review.']
    lines += ['', 'Values are per assigned day. [Complete operating totals](operating-summary.csv) retain both actions\' shortage/surplus volumes and separate cost components. Exported mean has lower realized average loss in '+str(len(better))+'/'+str(len(tables['operating-summary']))+' leaf/cost cells'+(': '+', '.join(r['series_id']+'/under'+str(r['shortage_cost_unit_per_L']) for r in better) if better else '')+'. Quantile optimality concerns expected single-period loss under the predictive distribution, not a promised finite-sample win. The original actions remain fixed.','',
        'Read each cost scenario with its displayed shortage/surplus exposure; do not select q using these labels. Before a known closure/transfer or other regime change, review local effects and uncertainty with business evidence. That is an untested operating recommendation, not an executed mitigation. No inventory, capacity, physical stock transfer, joint-path tail risk or real supply deployment is modeled here.','',
        '## Data, methodology and reproducible handoff','',
        '[Data note](reference-data.md), [verified method sources](reference-sources.md) and [reproduction instructions](reference-reproduce.md) are declared report assets sealed with the programme. [Programme copies](reproduction/) accompany the original outputs. [Full numerical results](numerical-results.json), [method pool](method-pool.json) and [selection trace](selection-trace.json) preserve identities and exact numbers. The reporter consumes no private quality registry, weights or grading result.','',
        'Ridge uses weekday indicators with Monday reference, annual sine/cosine, optional temperature and open/transfer features. Each fit standardizes its own training features (constant scales become1); alpha penalizes standardized coefficients but not the intercept. Augmented least squares solves that declared objective. A training actual-temperature gap or unavailable future forecast is imputed from that origin\'s historical month mean; the final future day lacks an issued weather forecast. The no-weather ablation removes weather from fit, prediction and pseudo-origin calibration. Nonnegative base points and exported sample means are distinct.','',
        'Pseudo-origins at56/84/112 days earlier use features available then. For residual labels, first choose the highest released revision at the current origin, including missing, then use only complete valid four-leaf rows; an older valid revision cannot fill a latest missing. The42 complete four-leaf residual vectors are paired observations, not42 independent calibration experiments. Closures multiply whole sample vectors before zone sums; this empirical construction claims neither conformal nor finite-sample coverage. Mean-squared error targets conditional means, asymmetric linear loss targets the stated quantiles, and WIS includes width and missed-interval penalties. These statistical roles do not prove that the empirical distribution is calibrated.','',
        'Original registration and native facts establish actual freezing and execution; fit files alone cannot prove training. Exact rational tables retain arithmetic and figure floats are display only. The owner command/image and full original packet remain evaluator-side audit evidence; a narrow reporter projection must not invent those host facts. This is an author research product, not candidate-hour evidence or professional-human/statistical benchmark certification.']
    return lines
