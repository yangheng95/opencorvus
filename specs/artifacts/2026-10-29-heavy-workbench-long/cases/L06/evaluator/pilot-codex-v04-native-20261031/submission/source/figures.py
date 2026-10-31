"""Actual native ledgers -> readable scientific figures, no UI automation."""
import argparse,csv,json,os,sys
from pathlib import Path
from fractions import Fraction as F
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args();r=a.root
os.environ['MPLCONFIGDIR']=str(r/'plot-cache');sys.path.insert(0,str(r/'dependencies'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'figure.dpi':150,'savefig.facecolor':'white'})
with (r/'stage-ledger.csv').open(encoding='utf-8',newline='') as f:rows=list(csv.DictReader(f))
summary=json.loads((r/'summary.json').read_text(encoding='utf-8'));values=json.loads((r/'derivation/build-01/values.json').read_text(encoding='utf-8'));ids=['base','cash-tight','shifted-prior'];colors={'A':'#1765ab','B':'#cb5a2a','skip':'#b9c3cf'}
fig,axes=plt.subplots(3,2,figsize=(14,12),layout='constrained')
for rownum,ident in enumerate(ids):
    unique={x['request_id']:x for x in rows if x['instance']==ident and x['phase']=='laboratory'};cells=list(unique.values());ax=axes[rownum,0];bottom=np.zeros(8)
    for action in ['A','B','skip']:
        counts=[sum(F(x['node_probability_exact']) for x in cells if int(x['week'])==w and (x['test'] or 'skip')==action) for w in range(8)];ys=np.array(list(map(float,counts)));ax.bar(range(8),ys,bottom=bottom,color=colors[action],label='inspect '+action if action!='skip' else 'skip');bottom+=ys
    assert np.allclose(bottom,1);ax.set(ylim=(0,1.06),xlabel='Week',ylabel='Unconditional action probability',title=f'{ident}: paid-inspection policy');ax.set_xticks(range(8));ax.legend(ncol=3,loc='upper center',fontsize=8)
    ax=axes[rownum,1]
    for index,x in enumerate(cells):
        belief=json.loads(x['belief_json']);pa=F(belief['A1'])+F(belief['A2']);mass=F(x['node_probability_exact']);action=x['test'] or 'skip';jitter=((index%7)-3)*0.018
        ax.scatter(int(x['week'])+jitter,float(pa),s=15+170*float(mass)**0.5,c=colors[action],edgecolors='white',linewidth=.4,alpha=.78)
    ax.set(xlim=(-.35,7.35),ylim=(-.05,1.05),xlabel='Week (small overlap jitter)',ylabel='P(distribution class A | paid results)',title=f'{ident}: actual laboratory decision prefixes');ax.set_xticks(range(8));ax.axhline(.5,c='#999999',lw=.7,ls=':')
fig.suptitle('Policy decisions from original native receipts\nNode area varies with exact prefix reach probability; no unobserved lot is evidence',fontsize=15)
for ext in ['png','svg','pdf']:fig.savefig(r/'figures'/('policy-decisions.'+ext))
plt.close(fig)
fig,axes=plt.subplots(1,2,figsize=(14,6),layout='constrained');ax=axes[0];xs=np.arange(3);width=.24
for offset,(field,label,color) in enumerate([('advance_class_information_bound_exact','Class revealed before week 0','#309573'),('expected_cost_exact','Same-information optimum / actor','#1765ab'),('no_inspection_physical_optimum_exact','No paid inspections (physical restriction)','#8996a8')]):
    ys=[float(F(summary['instances'][i][field])) for i in ids];bars=ax.bar(xs+(offset-1)*width,ys,width,label=label,color=color);ax.bar_label(bars,fmt='%.3f',padding=3,fontsize=9)
ax.set(xticks=xs,xticklabels=ids,ylabel='Expected operating expense [cash units]',ylim=(0,140),title='Exact values shown as rounded decimals');ax.legend(loc='upper left',fontsize=8)
ax=axes[1];bottom=np.zeros(3)
for component,color in [('normal','#1765ab'),('certified','#cb5a2a'),('production','#53a489'),('laboratory','#9064a9'),('holding','#e0ad4e'),('disposal','#7b899b')]:
    ys=np.array([float(F(summary['instances'][i]['components_exact'][component])) for i in ids]);ax.bar(xs,ys,bottom=bottom,label=component,color=color);bottom+=ys
ax.set(xticks=xs,xticklabels=ids,ylabel='Expected operating expense [cash units]',title='Actor cost components, original branch probabilities');ax.legend(ncol=2,fontsize=9)
fig.suptitle('Cost and value of advance class information\nNo-inspection differences include usable-material effects and are not pure information value',fontsize=14)
for ext in ['png','svg','pdf']:fig.savefig(r/'figures'/('cost-information.'+ext))
plt.close(fig)
fig,axes=plt.subplots(3,2,figsize=(14,12),layout='constrained');x=np.arange(16);labels=[f'{w}{p}' for w in range(8) for p in ['L','O']]
for rownum,ident in enumerate(ids):
    paths={}
    for cell in rows:
        if cell['instance']==ident:paths.setdefault(cell['path'],[]).append(cell)
    cash=[];raw=[];prob=[]
    for path,cells in paths.items():
        cells.sort(key=lambda x:int(x['seq']));cash.append([int(c['cash_after']) if c['phase']=='laboratory' else int(c['closing_cash']) for c in cells]);raw.append([int(c['raw_peak']) for c in cells]);prob.append(float(F(cells[0]['probability_exact'])))
    for col,(series,yl,title,limit) in enumerate([(cash,'Settled cash [cash units]','stage close before next-week receipts',-15),(raw,'Actual raw-material peak [good units]','received material before consumption',4)]):
        ax=axes[rownum,col];arr=np.array(series);mean=np.sum(arr*np.array(prob)[:,None],axis=0)
        for one in arr:ax.plot(x,one,c='#597da2',alpha=.07,lw=.65)
        ax.fill_between(x,arr.min(axis=0),arr.max(axis=0),color='#b9d1e5',alpha=.45,label='all supported paths: min–max');ax.plot(x,mean,c='#1765ab',lw=2,label='exact-probability mean');ax.axhline(limit,c='#c14b3c',ls='--',lw=1,label='credit floor −15' if col==0 else 'capacity 4')
        if col==0:ax.scatter([15],[arr[:,-1].min()],c='#c14b3c',s=28,zorder=5);ax.annotate(f'min final = {arr[:,-1].min()}',(15,arr[:,-1].min()),xytext=(-70,12),textcoords='offset points',fontsize=9)
        else:ax.set_ylim(-.15,4.5)
        ax.set(title=f'{ident}: {title}',xlabel='Week and phase (L laboratory, O operations)',ylabel=yl,xticks=x,xticklabels=labels);ax.legend(loc='upper left',fontsize=8)
fig.suptitle('Actual cash and material across every native terminal history\nFaint lines are complete paths (unequal probabilities); blue means use terminal exact path mass once',fontsize=14)
for ext in ['png','svg','pdf']:fig.savefig(r/'figures'/('cash-material.'+ext))
plt.close(fig)
versions={d.metadata['Name']:d.version for d in __import__('importlib.metadata',fromlist=['distributions']).distributions(path=[str(r/'dependencies')])}
(r/'plot-dependency-versions.json').write_text(json.dumps(versions,indent=2)+'\n',encoding='utf-8')
(r/'requirements-plot.txt').write_text('\n'.join(f'{name}=={version}' for name,version in sorted(versions.items()))+'\n',encoding='utf-8')
print(json.dumps({'status':'generated','figures':['policy-decisions','cost-information','cash-material'],'formats':['png','svg','pdf'],'source':'stage-ledger.csv','versions':versions}))
