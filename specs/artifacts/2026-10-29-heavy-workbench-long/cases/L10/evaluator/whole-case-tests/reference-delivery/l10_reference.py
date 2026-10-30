"""Public-history preparation and a causal, finite-horizon HiGHS controller."""
import argparse,json,sys
from pathlib import Path
from l10_core import authority,save,read

def prepare(raw,out):
 a=authority(raw);out.mkdir(parents=True);save(out/'model.json',{'history':a['history'],'prior':a['prior'],'devices':a['devices'],'commission':a['commission'],'sites':a['sites']});save(out/'audit.json',a)
def decide(p,mode='mpc'):
 if mode=='idle':return {'power_kw':0.}
 if mode=='future_file':return json.loads(Path('/future/actual.json').read_text())
 import numpy as np
 from scipy.optimize import linprog
 dev=p['device'];s=p['state'];cur=p['current']
 if dev['capacity_kwh']==0:return {'power_kw':0.}
 ff={x['step']:x for x in p['forecast']};h=[]
 for j in range(p['step'],min(p['total_steps'],p['step']+16)):
  if j==p['step']:r=dict(cur)
  else:
   f=ff.get(j)
   if f is None:raise ValueError('forecast_horizon_missing')
   r=dict(f['values'])
  h.append(r)
 n=len(h);months=sorted({r['at'][:7] for r in h});v=7*n+len(months);obj=np.zeros(v);bounds=[];eq=[];beq=[];ub=[];bub=[]
 # per interval c,d,grid,critical-unserved,flex-unserved,curtail,stored-energy
 for t,r in enumerate(h):
  dt=r['dt_hours'];wear=p['commission']['wear_per_ac_kwh'];base=7*t
  obj[base:base+7]=[wear*dt,wear*dt,r['price']*dt,p['commission']['critical_penalty']*dt,p['commission']['flex_penalty']*dt,0,0]
  power=dev['power_kw']*r['derating'];bounds.extend([(0,power),(0,power),(0,p['site_terms']['import_limit_kw']*r['grid_available']),(0,r['critical_kw']),(0,r['flex_kw']),(0,r['pv_kw']),(0,dev['capacity_kwh'])])
  row=np.zeros(v);row[base:base+6]=[-1,1,1,1,1,-1];eq.append(row);beq.append(r['critical_kw']+r['flex_kw']-r['pv_kw'])
  row=np.zeros(v);row[base]=-dev['eta_c']*dt;row[base+1]=dt/dev['eta_d'];row[base+6]=1
  if t:row[base-1]=-1
  eq.append(row);beq.append(s['soc'] if t==0 else 0.)
  row=np.zeros(v);row[base+2]=1;row[7*n+months.index(r['at'][:7])]=-1;ub.append(row);bub.append(0.)
 for m in months:bounds.append((s['peaks'].get(m,0.),None));obj[7*n+months.index(m)]=p['site_terms']['demand_per_kw']
 # Operational reserve target is an explicit policy, never knowledge of future outages.
 last=p['step']+n==p['total_steps']
 if last:bounds[7*(n-1)+6]=(0,0)
 else:
  # Soft reserve value encourages readiness while allowing necessary critical service.
  obj[7*(n-1)+6]=-.45
 result=linprog(obj,A_ub=np.array(ub),b_ub=np.array(bub),A_eq=np.array(eq),b_eq=np.array(beq),bounds=bounds,method='highs')
 if not result.success:raise ValueError('controller_planning_failed:'+result.message)
 c,d=result.x[0:2]
 if c>1e-6 and d>1e-6:raise ValueError('lp_simultaneous_cycle')
 q=float(c-d)
 if mode=='dt_error':q*=2
 if mode=='charge_always':q=dev['power_kw']
 return {'power_kw':q,'planning':{'horizon':n,'native_status':int(result.status),'objective':float(result.fun),'forecast_releases':[r['released_at'] for r in p['forecast']]}}
def actor(mode):
 for line in sys.stdin:
  p=json.loads(line)
  if p['kind']=='receipt_replay':ans={'acknowledged':p['receipt']['key']}
  else:ans=decide(p,mode)
  print(json.dumps(ans,allow_nan=False),flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('command',choices=['prepare','actor']);p.add_argument('--data',type=Path);p.add_argument('--out',type=Path);p.add_argument('--mode',default='mpc');a=p.parse_args()
 if a.command=='prepare':prepare(a.data,a.out)
 else:actor(a.mode)
