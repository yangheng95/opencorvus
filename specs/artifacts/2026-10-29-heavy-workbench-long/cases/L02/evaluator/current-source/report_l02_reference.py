"""Author reporter consuming the actual report-provenance/1 input contract.

Its empirical fit format is this reference's output, not a candidate requirement.
"""
import csv
from decimal import Decimal
from fractions import Fraction as F
import json
from pathlib import Path
import shutil
from report_diagnostics import derive, discussion


def read(path):
    return json.loads(path.read_text(encoding='utf-8'), parse_float=Decimal)


def write_table(path, rows):
    with path.open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader();writer.writerows(rows)


def wis(y, q):
    total = abs(y-F(q['0.5']))/2
    for a in (F(1,2),F(1,5),F(1,20)):
        lower, upper = F(q[str(float(a/2))]), F(q[str(float(1-a/2))])
        total += a/2*(upper-lower) + max(lower-y,F(0)) + max(y-upper,F(0))
    return total/F(7,2)


def main():
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    data = read(Path('/input/results.json'))
    provenance = read(Path('/input/provenance/manifest.json'))
    if provenance['format'] != 'l02-report-provenance/1':
        raise ValueError('author_report_provenance_required')
    out = Path('/output/result');out.mkdir()
    source_rows, fits, sources = [], [], []
    methods = {m['method_id']: m for m in data['pool']['methods']}
    for cell in provenance['cells']:
        identity, execution = cell['identity'], cell['execution']
        for artifact in cell['artifacts']:
            original = Path('/input')/artifact['input_path']
            destination = out/'sources'/str(cell['cell_id'])/artifact['output_member']
            destination.parent.mkdir(parents=True, exist_ok=True);shutil.copyfile(original,destination)
            relative = destination.relative_to(out).as_posix()
            source_rows.append({'cell_id':cell['cell_id'], 'kind':identity['kind'],
                'outer_id':identity['outer_id'], 'origin_id':identity.get('origin_id',''),
                'method_id':identity.get('method_id',''), 'artifact':artifact['output_member'],
                'delivered_copy':relative, 'started_at':execution['started_at'],
                'finished_at':execution['finished_at'], 'exit_code':execution['exit_code'],
                'argv_projection':json.dumps(execution['argv_projection'],ensure_ascii=False)})
            if identity['kind']=='predict' and artifact['output_member']=='result/fit.json':
                fit = read(original)
                if fit['format']!='l02-reference-fit/1' or fit['method']!={k:methods[identity['method_id']][k] for k in ('method_id','configuration')}:
                    raise ValueError('author_fit_binding_invalid')
                sources.append({'identity':identity,'source':relative,'fit':fit})
                for node, audit in fit['fit'].items():
                    fits.append({'cell_id':cell['cell_id'],'outer_id':identity['outer_id'],
                        'origin_id':identity['origin_id'],'level':identity['level'],
                        'method_id':identity['method_id'],'series_id':node,
                        'training_rows':audit['training_rows'], 'training_end_tick':audit['maximum_training_event_tick'],
                        'paired_residual_rows':fit['paired_residual_rows'], 'calibration_origins':json.dumps([x['origin_tick'] for x in fit['calibration']]),
                        'features':json.dumps(audit['features']), 'coefficient':json.dumps(audit['coefficient'],default=str),
                        'imputed_future_ticks':json.dumps(audit['future_temperature_imputed_ticks']), 'source':relative})
    if len(sources) != sum(c['identity']['kind']=='predict' for c in provenance['cells']):
        raise ValueError('author_fit_sources_incomplete')
    write_table(out/'source-index.csv',source_rows);write_table(out/'fit-index.csv',fits)
    # Native facts remain distinct from self-reported fitting details.
    (out/'execution-index.json').write_text(json.dumps(provenance,indent=2,default=str),encoding='utf-8')
    (out/'fit-records.json').write_text(json.dumps(sources,indent=2,default=str),encoding='utf-8')
    node_rows, origin_rows = [], []
    for row in data['outer_results']:
        context=row['context'];truth={(r['series_id'],r['target_tick']):F(r['value']) for r in row['labels']}
        for method in data['pool']['outer_ids']:
            values=row['metrics'][method]['metrics_exact']
            origin_rows.append({'outer_id':row['outer_id'],'method_id':method,
                'selected':method==row['selected_method_id'],**values})
            for node in context['series_catalogue']:
                name=node['series_id'];rows=[r for r in row['forecasts'][method]['forecasts'] if r['series_id']==name]
                scale=F(context['scales_litres'][name]);n=len(rows)
                mse=sum(((F(r['mean'])-truth[name,r['target_tick']])/scale)**2 for r in rows)/n
                interval=sum(wis(truth[name,r['target_tick']],r['quantiles'])/scale for r in rows)/n
                node_rows.append({'outer_id':row['outer_id'],'method_id':method,'series_id':name,
                    'scaled_mse':str(mse),'scaled_wis':str(interval),'assigned_days':n})
    write_table(out/'origin-losses.csv',origin_rows);write_table(out/'node-losses.csv',node_rows)
    tables = derive(data)
    for name,rows in tables.items():write_table(out/(name+'.csv'),rows)
    shutil.copyfile(Path('/input/results.json'),out/'numerical-results.json')
    for name,value in [('method-pool',data['pool']),
                       ('selection-trace',[{k:r[k] for k in ('outer_id','selected_method_id','inner_selection')} for r in data['outer_results']])]:
        (out/(name+'.json')).write_text(json.dumps(value,indent=2,default=str),encoding='utf-8')
    project = Path(__file__).resolve().parent
    for name in ['reference-data.md','reference-sources.md','reference-reproduce.md']:
        shutil.copyfile(project/name,out/name)
    reproduction=out/'reproduction';reproduction.mkdir()
    for path in sorted(project.glob('*.py')):shutil.copyfile(path,reproduction/path.name)
    # Pick a diagnostic slice by registered time, never by its observed performance.
    row=next((r for r in data['outer_results'] if r['outer_id']=='outer-20250620'),data['outer_results'][0])
    method=row['selected_method_id'];truth={(r['series_id'],r['target_tick']):r['value'] for r in row['labels']}
    ticks=row['context']['target_ticks'];nodes=row['context']['series_catalogue']
    fig,axes=plt.subplots(2,3,figsize=(14,8),layout='constrained')
    for node,axis in zip(nodes,axes.flat):
        name=node['series_id'];values={r['target_tick']:r for r in row['forecasts'][method]['forecasts'] if r['series_id']==name}
        axis.plot(range(1,len(ticks)+1),[float(truth[name,t]) for t in ticks],'k.-',label='terminal truth')
        line=axis.plot(range(1,len(ticks)+1),[float(values[t]['mean']) for t in ticks],'.-',label='selected mean')[0]
        axis.fill_between(range(1,len(ticks)+1),[float(values[t]['quantiles']['0.1']) for t in ticks],
            [float(values[t]['quantiles']['0.9']) for t in ticks],color=line.get_color(),alpha=.18,label='central 80%')
        axis.set_title(name+' ('+node['kind']+')');axis.set_xlabel('Assigned future UTC day index');axis.set_ylabel('Litres');axis.grid(alpha=.2)
    fig.suptitle(row['outer_id']+': '+method)
    handles,labels=axes.flat[0].get_legend_handles_labels();fig.legend(handles,labels,loc='outside lower center',ncol=3)
    fig.savefig(out/'forecast.png',dpi=120);plt.close(fig)
    lines=['# Sealed daily forecasting study','',
        'Author reference report. This report consumes captured numerical outputs and narrow native execution facts. It does not certify the self-reported fitting diagnostics or replace independent scientific review.','',
        'Requested outer origins: '+', '.join(data['outer_ids'])+'. Complete registered coverage: '+str(data['complete_assignment'])+'.',
        '','## Methods and information timing','',
        'The execution contract freezes programmes and configurations before prediction. These report-side numeric records alone do not establish when this report programme was frozen relative to historical numeric cells; that requires the independent registration audit. Each worker is assigned an original CSV release-prefix; highest revision including missing is chosen before valid-value filtering. The reference uses historical seasonal weather imputation. Inner selection uses earlier published inner labels and mean scaled MSE; ties use the method ID. Outer labels reach the report only after numerical acceptance.','',
        '| Method | Role | Frozen configuration |','|---|---|---|']
    for m in data['pool']['methods']:
        lines.append('| '+m['method_id']+' | '+m['role']+' | `'+json.dumps(m['configuration'],ensure_ascii=False,default=str)+'` |')
    lines+=['','The seasonal method averages up to eight matching weekdays. Ridge uses standardized features, an unpenalized intercept and the frozen alpha; the no-weather ablation removes weather features. Configuration and fitted coefficients are separately located in [fit-index.csv](fit-index.csv) and [fit-records.json](fit-records.json). These are empirical model parameters, not identified causal effects.','',
        'Uncertainty uses the recorded earlier pseudo-origins and complete paired leaf residual rows; current operating closures act on whole future sample vectors before hierarchical sums. Means are coherent; marginal quantiles need not sum. This empirical construction gives no finite-sample or joint-path coverage guarantee.','',
        '## Out-of-sample results','', '| Method | Scaled MSE | Scaled WIS |','|---|---:|---:|']
    for method,values in [*data['aggregate_exact']['per_method'].items(),('Inner-selected policy',data['aggregate_exact']['selected'])]:
        lines.append('| '+method+' | '+format(float(F(values['scaled_mse'])),'.10g')+' | '+format(float(F(values['scaled_wis'])),'.10g')+' |')
    lines+=['','[Per-origin metrics](origin-losses.csv) and [all node losses](node-losses.csv) preserve every declared origin and method. Coverage and width are in [the complete interval table](intervals.csv). The no-weather outer ablation remains a diagnostic; seeing its outer results cannot change the frozen selection pool. A good aggregate loss does not establish local calibration or correct response to a new operating regime.','',
        '![Actual selected forecasts and terminal observations](forecast.png)','',
        '## Single-period operating decisions','',
        'The [operating ledger](operating-ledger.csv) fixes overage cost 1 and shortage costs 1, 3, 9 cost-unit/L before truth, using q=.5, .75, .9 respectively. Actions are continuous litres. Each row records action, later truth, shortage, overage and realized cost. These are separate single-period decisions, not a capacity, inventory, joint-risk or field supply simulation.','',
        '## Reproduction and evidence limitations','',
        '[Source index](source-index.csv) links actual numeric cell IDs, origin/method, narrowed argv, native start/finish/exit and delivered copies of each original output. [Execution index](execution-index.json) preserves the allowed native facts. Candidate fit statements require source and independent execution audit; a file or timestamp alone does not prove how training occurred. Exact rational tables retain evaluation precision; figure coordinates are plotting floats.','',
        'This report is a reproducible research component. Study completion, quality success and benchmark score remain unassessed until the full frozen case and independent rubric review.']
    lines += ['', *discussion(data,tables,sources,row)]
    (out/'report.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    (out/'report.json').write_text(json.dumps({'format':'l02-report-receipt/1','outer_ids':data['outer_ids']}),encoding='utf-8')


if __name__=='__main__':
    main()
