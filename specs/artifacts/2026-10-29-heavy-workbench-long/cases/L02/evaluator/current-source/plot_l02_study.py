"""Scientific reference figures from recomputed actual results, not candidate UI."""
import argparse
from datetime import datetime,timedelta
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


def plot(input_path,out):
    data=json.loads(input_path.read_text(encoding='utf-8'));out.mkdir(parents=True,exist_ok=False)
    origins=data['origins'];methods=data['methods'];epoch=datetime.fromisoformat(data['clock']['epoch_utc'].replace('Z','+00:00'))
    selected=next(row for row in origins if row['outer_id']=='outer-20250620')
    figure,axes=plt.subplots(2,3,figsize=(16,8.5),layout='constrained')
    truth={(r['series_id'],r['target_tick']):r['value'] for r in selected['labels']}
    dates=[epoch+timedelta(hours=t-24) for t in selected['target_ticks']]
    for node,axis in zip(data['nodes'],axes.flat):
        name=node['series_id'];axis.plot(dates,[truth[name,t] for t in selected['target_ticks']],'k.-',label='terminal truth')
        for method in methods:
            rows={r['target_tick']:r for r in selected['curves'][method] if r['series_id']==name}
            line=axis.plot(dates,[rows[t]['mean'] for t in selected['target_ticks']],'.-',label=method)[0]
            if method==selected['selected_method_id']:axis.fill_between(dates,[rows[t]['lower80'] for t in selected['target_ticks']],[rows[t]['upper80'] for t in selected['target_ticks']],alpha=.15,color=line.get_color())
        axis.set_title(name+' ('+node['kind']+')');axis.set_ylabel('Daily demand (litres)');axis.tick_params(axis='x',rotation=35);axis.grid(alpha=.2)
    handles,labels=axes.flat[0].get_legend_handles_labels();figure.legend(handles,labels,loc='outside lower center',ncol=4,fontsize=9)
    figure.suptitle('20 June 2025 origin: complete future UTC days; selected mean and central 80% band\n'+selected['selected_method_id']+' selected using earlier inner folds only')
    figure.savefig(out/'june20-forecasts.png',dpi=140);plt.close(figure)
    with (out/'render.json').open('w',encoding='utf-8') as f:json.dump({'status':'scientific_plot_rendered','matplotlib_version':matplotlib.__version__,'origin':selected['outer_id'],'methods':methods,'scope':'actual recomputed private reference results; not visual acceptance until viewed'},f,indent=2)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();plot(a.input,a.out)
