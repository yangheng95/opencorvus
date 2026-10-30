"""Frozen author reporter. Transport/figure qualification, not a full research paper."""
import json
from pathlib import Path
from fractions import Fraction
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


def main():
    data = json.loads(Path('/input/results.json').read_text())
    out = Path('/output/result')
    out.mkdir()
    lines = ['# Sealed numerical study', '', 'This is an author protocol reference. Scientific review and quality thresholds remain unassessed.', '',
             'Complete registered assignment: ' + str(data['complete_assignment']), '', '| Method | Scaled MSE | Scaled WIS |', '|---|---:|---:|']
    for method, values in [*data['aggregate_exact']['per_method'].items(), ('Chosen by inner selection', data['aggregate_exact']['selected'])]:
        lines.append('| ' + method + ' | ' + format(float(Fraction(values['scaled_mse'])), '.10g') + ' | ' + format(float(Fraction(values['scaled_wis'])), '.10g') + ' |')
    lines += ['', 'Choices use earlier inner folds only. No-weather is a mandatory ablation, not a retrospective addition to the selection pool.',
              'Intervals are marginal; this execution does not establish nominal coverage or calibrated joint paths.', '',
              '![Actual forecasts and terminal observations](forecast.png)', '']
    row = data['outer_results'][0]
    method = row['selected_method_id']
    truth = {(r['series_id'], r['target_tick']): r['value'] for r in row['labels']}
    nodes = row['context']['series_catalogue']
    ticks = row['context']['target_ticks']
    figure, axes = plt.subplots(2, 3, figsize=(14, 8), layout='constrained')
    for node, axis in zip(nodes, axes.flat):
        name = node['series_id']
        predictions = {r['target_tick']: r for r in row['forecasts'][method]['forecasts'] if r['series_id'] == name}
        axis.plot(range(1, len(ticks)+1), [truth[name, t] for t in ticks], 'k.-', label='terminal truth')
        line = axis.plot(range(1, len(ticks)+1), [predictions[t]['mean'] for t in ticks], '.-', label='selected mean')[0]
        axis.fill_between(range(1, len(ticks)+1), [predictions[t]['quantiles']['0.1'] for t in ticks],
                          [predictions[t]['quantiles']['0.9'] for t in ticks], color=line.get_color(), alpha=.18, label='central 80%')
        axis.set_title(name + ' (' + node['kind'] + ')')
        axis.set_xlabel('Assigned future UTC day index')
        axis.set_ylabel('Litres')
        axis.grid(alpha=.2)
    figure.suptitle(row['outer_id'] + ': ' + method)
    handles, labels = axes.flat[0].get_legend_handles_labels()
    figure.legend(handles, labels, loc='outside lower center', ncol=3)
    figure.savefig(out / 'forecast.png', dpi=120)
    plt.close(figure)
    (out / 'report.md').write_text('\n'.join(lines), encoding='utf-8')
    (out / 'report.json').write_text(json.dumps({'format': 'l02-report-receipt/1', 'outer_ids': data['outer_ids']}))


if __name__ == '__main__':
    main()
