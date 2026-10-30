"""L10's single original-data decoder and authoritative physical/billing recurrence."""
import csv,json,math
from pathlib import Path
from datetime import datetime,timedelta,timezone

def read(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def save(p,v):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def rows(p):
 with Path(p).open(encoding='utf-8',newline='') as f:return list(csv.DictReader(f))
def utc(s):
 d=datetime.fromisoformat(s.replace('Z','+00:00'))
 if d.tzinfo is None:raise ValueError('timezone_required')
 return d.astimezone(timezone.utc)
def historical(raw):
 """Highest revision including missing wins; data values are interval mean power."""
 raw=Path(raw);cutoff=utc(read(raw/'commission.json')['history_cutoff']);groups={}
 for r in rows(raw/'meter-history.csv'):
  if utc(r['released_at'])>cutoff:continue
  k=(r['site'],r['series'],r['interval_start']);groups.setdefault(k,[]).append(r)
 result=[]
 for k,rr in sorted(groups.items()):
  rev=max(int(r['revision']) for r in rr);rr=[r for r in rr if int(r['revision'])==rev]
  if len({json.dumps(r,sort_keys=True) for r in rr})!=1:raise ValueError('highest_revision_conflict')
  r=rr[0];v=None
  if r['status']=='valid':
   x=float(r['value']);dt=float(r['duration_hours'])
   if dt<=0:raise ValueError('duration_positive')
   v=x if r['unit']=='kW' else x/1000 if r['unit']=='W' else x/dt if r['unit']=='kWh' else None
   if v is None or not math.isfinite(v) or v<0:raise ValueError('history_unit_value')
  elif r['status']!='missing':raise ValueError('history_status')
  result.append({'site':k[0],'series':k[1],'interval_start':k[2],'revision':rev,'status':r['status'],'power_kw':v,'released_at':r['released_at']})
 return result
def equipment(raw):
 return {r['id']:{'id':r['id'],**{k:float(v) for k,v in r.items() if k!='id'}} for r in rows(Path(raw)/'equipment-quotes.csv')}
def authority(raw):
 raw=Path(raw);return {'commission':read(raw/'commission.json'),'sites':read(raw/'site-terms.json'),'devices':equipment(raw),'history':historical(raw),'prior':read(raw/'prior-bills.json')}
def initial(a,site):
 return {'soc':0.,'next':0,'peaks':dict(a['prior'][site]['peak_kw']),'energy':{},'wear':0.,'critical_unserved_kwh':0.,'flex_unserved_kwh':0.,'curtailed_kwh':0.}
def transition(a,site,dev,state,obs,action):
 """Positive AC kW charges. No automatic repair of invalid candidate power."""
 if type(action.get('power_kw')) not in (int,float) or not math.isfinite(action['power_kw']):raise ValueError('action_power_finite_number')
 q=action['power_kw'];dt=obs['dt_hours'];c=max(0.,q);d=max(0.,-q);tol=2e-6
 if dt<=0 or abs(q)>dev['power_kw']*obs['derating']+tol:raise ValueError('battery_power_limit')
 e=state['soc']+dev['eta_c']*c*dt-d*dt/dev['eta_d']
 if e < -tol or e>dev['capacity_kwh']+tol:raise ValueError('soc_balance_bounds')
 net=obs['critical_kw']+obs['flex_kw']-obs['pv_kw']+q
 if net < -obs['pv_kw']-tol:raise ValueError('battery_export_forbidden')
 curtail=max(0.,-net);g=max(0.,net);cap=a['sites'][site]['import_limit_kw']*obs['grid_available']
 short=max(0.,g-cap);g=min(cap,g);sf=min(short,obs['flex_kw']);sc=max(0.,short-sf)
 if sc>obs['critical_kw']+tol:raise ValueError('charging_while_unserved')
 # Stored energy may never be silently clamped or replaced by an optimizer state.
 s=json.loads(json.dumps(state));s['soc']=e;s['next']+=1
 m=obs['at'][:7];s['peaks'][m]=max(s['peaks'].get(m,0.),g)
 price=obs['price'];s['energy'][m]=s['energy'].get(m,0.)+g*dt*price
 wear=(c+d)*dt*a['commission']['wear_per_ac_kwh'];s['wear']+=wear
 s['critical_unserved_kwh']+=sc*dt;s['flex_unserved_kwh']+=sf*dt;s['curtailed_kwh']+=curtail*dt
 row={'step':state['next'],'at':obs['at'],'month':m,'dt_hours':dt,'power_kw':q,'charge_kw':c,'discharge_kw':d,'soc_before':state['soc'],'soc_after':e,'import_kw':g,'curtail_kw':curtail,'critical_unserved_kw':sc,'flex_unserved_kw':sf,'energy_cost':g*dt*price,'wear_cost':wear,'peak_after':s['peaks'][m]}
 return s,row
def bill(a,site,s):
 terms=a['sites'][site];energy=sum(s['energy'].values());demand=sum(s['peaks'].values())*terms['demand_per_kw']
 critical=s['critical_unserved_kwh']*a['commission']['critical_penalty'];flex=s['flex_unserved_kwh']*a['commission']['flex_penalty']
 return {'energy':energy,'demand':demand,'wear':s['wear'],'critical_penalty':critical,'flex_penalty':flex,'total':energy+demand+s['wear']+critical+flex,'critical_unserved_kwh':s['critical_unserved_kwh'],'flex_unserved_kwh':s['flex_unserved_kwh'],'peaks':s['peaks']}
def economic(a,dev,baseline,cost):
 c=a['commission'];annual=(baseline-cost)*c['campaigns_per_year'];cash=[{'year':0,'saving':0.,'om':0.,'replacement':0.,'residual':0.,'net':-dev['capital'],'discounted':-dev['capital']}]
 for y in range(1,c['years']+1):
  saving=annual*c['annual_escalation']**(y-1);om=dev['annual_om'];replacement=dev['replacement'] if y==c['replacement_year'] else 0.;residual=dev['residual'] if y==c['years'] else 0.
  net=saving-om-replacement+residual;cash.append({'year':y,'saving':saving,'om':om,'replacement':replacement,'residual':residual,'net':net,'discounted':net/(1+c['discount'])**y})
 return {'annual_initial_saving':annual,'npv':sum(r['discounted'] for r in cash),'cash':cash}
def packet(a,case,site,device,i,s,receipts):
 obs=case['actual'][site][i];now=utc(obs['at']);latest={}
 for r in case['forecasts'][site]:
  if utc(r['released_at'])>now or r['step']<i or r['step']>=i+16:continue
  key=r['step']
  if key not in latest or (utc(r['released_at']),r['revision'])>(utc(latest[key]['released_at']),latest[key]['revision']):latest[key]=r
 forecast=[latest[k] for k in sorted(latest)]
 # Current telemetry is explicitly perfect for this piecewise-constant interval.
 return {'kind':'decide','site':site,'step':i,'total_steps':len(case['actual'][site]),'device':device,'site_terms':a['sites'][site],'commission':a['commission'],'state':s,'current':obs,'forecast':forecast,'confirmed_history':receipts}
