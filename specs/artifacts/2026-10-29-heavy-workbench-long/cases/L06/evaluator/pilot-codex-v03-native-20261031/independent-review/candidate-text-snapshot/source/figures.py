"""Standalone scientific figures from exact published tables; headless only."""
import csv,json,os
from fractions import Fraction
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.environ['MPLCONFIGDIR']=str(ROOT/'.cache/matplotlib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'figures';OUT.mkdir(exist_ok=True)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.titlesize':13,'axes.labelsize':10,'figure.facecolor':'white','axes.spines.top':False,'axes.spines.right':False,'savefig.facecolor':'white'})
COLORS=['#164b79','#248b8b','#c58b28','#9d5f93','#5b8c45','#dc765b','#6877b4','#765439']
summary=json.loads((ROOT/'outputs/summary.json').read_text(encoding='utf8'))
detail=json.loads((ROOT/'outputs/detailed-ledger.json').read_text(encoding='utf8'))
base=json.loads((ROOT/'outputs/baseline-audit.json').read_text(encoding='utf8'))['paths']
relax=json.loads((ROOT/'outputs/information-relaxation.json').read_text(encoding='utf8'))
paths=list(detail);weeks=np.arange(16)

def finish(fig,name):
    fig.savefig(OUT/(name+'.png'),dpi=180,bbox_inches='tight')
    fig.savefig(OUT/(name+'.svg'),bbox_inches='tight')
    plt.close(fig)

def cash(rows):return [v['cash'] for v in rows]
def expected_components(source):return [sum(sum(row[k] for row in source[n]['weeks']) for n in paths)/8 for k in ('purchase_cost','freight_cost','production_cost','holding_cost')]

fig,axes=plt.subplots(1,2,figsize=(13,5.2),gridspec_kw={'width_ratios':[1.35,1]},layout='constrained')
ax=axes[0];c=np.array(expected_components(detail));b=np.array(expected_components(base));bottom=np.zeros(2)
for i,label in enumerate(['Purchases','Freight','Production','Holding']):
    values=np.array([c[i],b[i]]);ax.bar([0,1],values,bottom=bottom,color=COLORS[i],label=label,width=.6);bottom+=values
ax.set_xticks([0,1],['Causal policy','Canonical spot']);ax.set_ylabel('Expected operating cost (minor units)');ax.set_title('Expected cost and exact cost components')
for i,v in enumerate(bottom):ax.text(i,v+800,f'{v:,.3f}'.rstrip('0').rstrip('.'),ha='center',fontweight='bold')
ax.axhline(60044,color='#b3443b',linestyle='--',linewidth=1.2,label='Declared quality limit: 60,044');ax.set_ylim(0,81000);ax.legend(loc='upper left',fontsize=8)
ax=axes[1];idx=np.arange(len(paths));width=.36
ax.barh(idx+width/2,[sum(v['cost'] for v in detail[n]['weeks']) for n in paths],height=width,color=COLORS[0],label='Causal policy')
ax.barh(idx-width/2,[sum(v['cost'] for v in base[n]['weeks']) for n in paths],height=width,color='#b6c2cc',label='Canonical spot')
ax.set_yticks(idx,paths);ax.invert_yaxis();ax.set_xlabel('Full-path operating cost (minor units)');ax.set_xlim(0,79000);ax.set_title('All eight equally probable paths');ax.legend(loc='lower right',fontsize=8)
fig.suptitle('Staged factory operations | expected saving 31.44%',fontsize=17,fontweight='bold');finish(fig,'01-cost-comparison')

fig,axes=plt.subplots(1,2,figsize=(13,5.5),layout='constrained',sharey=True)
for ax,source,title in [(axes[0],detail,'Causal policy: minimum cash -3,116'),(axes[1],base,'Canonical spot: lower terminal cash')]:
    for i,name in enumerate(paths):ax.plot(weeks,cash(source[name]['weeks']),color=COLORS[i],label=name,linewidth=1.6,marker='o',markersize=2.5)
    ax.plot([0,14],[-9000,-9000],color='#b3443b',linestyle='--',label='Weeks 0–14 credit floor',linewidth=1.3)
    ax.scatter([15],[0],marker='D',color='#b3443b',s=45,zorder=6,label='Week 15 cash floor = 0')
    for t in (4,8,12):ax.axvline(t,color='#b7bdc5',linestyle=':',linewidth=1)
    ax.axhline(0,color='#67727e',linewidth=.7);ax.set_xticks(range(0,16,2));ax.set_xlim(-.3,15.4);ax.set_ylim(-11000,42000);ax.set_xlabel('Week (0–15)');ax.set_title(title);ax.grid(axis='y',alpha=.16)
axes[0].set_ylabel('Settled end-week cash (minor units)');axes[0].legend(ncol=2,loc='upper left',fontsize=8)
fig.suptitle('Liquidity uses only receipts already due | sales lag = 4 weeks',fontsize=16,fontweight='bold');finish(fig,'02-cash-and-credit')

fig,axes=plt.subplots(2,1,figsize=(12,7),layout='constrained',sharex=True)
for ax,key,limit,title in [(axes[0],'raw_stage_peak_volume',240,'Raw warehouse: before BOM consumption'),(axes[1],'product_stage_peak_volume',100,'Finished warehouse: before demand dispatch')]:
    for i,name in enumerate(paths):ax.plot(weeks,[r[key] for r in detail[name]['weeks']],color=COLORS[i],label=name,linewidth=1.4,marker='o',markersize=2.5)
    ax.axhline(limit,color='#b3443b',linestyle='--',linewidth=1.2,label=f'Physical capacity = {limit}')
    for t in (4,8,12):ax.axvline(t,color='#b7bdc5',linestyle=':',linewidth=1)
    ax.set_ylim(0,limit*1.16);ax.set_ylabel('Stage peak volume');ax.set_title(title);ax.grid(axis='y',alpha=.16)
axes[0].legend(ncol=5,loc='lower center',fontsize=8);axes[1].set_xlabel('Week (0–15)');axes[1].set_xticks(range(16))
fig.suptitle('All-path warehouse safety | peak raw 239/240; finished 81/100',fontsize=16,fontweight='bold');finish(fig,'03-warehouse-peaks')

fig,axes=plt.subplots(1,2,figsize=(13,5.2),layout='constrained')
rec=json.loads((ROOT/'outputs/receivables.json').read_text(encoding='utf8'));x=np.arange(8)
axes[0].bar(x-.18,[rec[n]['final_cash'] for n in paths],width=.36,color=COLORS[0],label='Settled cash at week15')
axes[0].bar(x+.18,[rec[n]['final_receivable'] for n in paths],width=.36,color=COLORS[1],label='Receivables due16–19')
axes[0].set_xticks(x,paths);axes[0].set_ylabel('Minor units');axes[0].set_title('Terminal cash and separate assets');axes[0].legend(fontsize=8,loc='upper right');axes[0].set_ylim(0,47000)
vals=[39714,47625.5,48431.125,70640];labels=['Analytical\nrelaxation bound','Native solver\nbound (numerical)','Executed\ncausal policy','Executed\ncanonical spot']
axes[1].bar(range(4),vals,color=['#acb7bd','#8a9dab',COLORS[0],'#b6c2cc'],width=.65)
for i,v in enumerate(vals):axes[1].text(i,v+1000,f'{v:,.3f}'.rstrip('0').rstrip('.'),ha='center',fontsize=9)
axes[1].set_xticks(range(4),labels,fontsize=8);axes[1].set_ylim(0,82000);axes[1].set_ylabel('Expected cost (minor units)');axes[1].set_title('Quality evidence has different strengths')
fig.suptitle('Late sales remain assets | FEASIBLE does not certify optimality',fontsize=16,fontweight='bold');finish(fig,'04-receivables-and-bounds')
print(json.dumps({'figures':[p.name for p in sorted(OUT.glob('*.png'))],'data':'outputs exact ledgers/summary/receivables'}))
