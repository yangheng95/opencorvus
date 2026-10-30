"""Independent scalar Fraction ledger. No author business imports or optimization."""
from pathlib import Path
from fractions import Fraction as F
from datetime import datetime,timedelta
import json,csv,sqlite3,itertools,time,sys
R=Path(__file__).parent;X=Path('D:/opencorvus-benchmark-runs/l10-full-case-20261031')
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def rows(p):
 with Path(p).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def n(v):
 if type(v) is bool:raise ValueError('bool numeric')
 return F(str(v))
def t(s):return datetime.fromisoformat(s.replace('Z','+00:00'))
counts={};failures=[];max_error=0.;out={}
def check(name,ok,detail=None):
 counts[name]=counts.get(name,0)+1
 if not ok:failures.append({'check':name,'detail':detail})
def eq(a,b,at=''):
 global max_error
 if isinstance(b,F) or type(b) in (float,int):
  if type(a) is bool or not isinstance(a,(float,int,F,str)):check('numeric',False,at);return
  d=abs(n(a)-n(b));max_error=max(max_error,float(d));check('numeric',d<=F('0.00002')+F('0.0000001')*abs(n(b)),{'at':at,'actual':a,'expected':str(b),'difference':str(d)});return
 if isinstance(b,dict):
  check('object_fields',type(a) is dict and set(a)>=set(b),at)
  if type(a) is dict:
   for k,v in b.items():
    if k in a:eq(a[k],v,at+'/'+str(k))
 elif isinstance(b,list):
  check('list_length',type(a) is list and len(a)==len(b),at)
  if type(a) is list:
   for i,(u,v) in enumerate(zip(a,b)):eq(u,v,at+'/'+str(i))
 else:check('identity',type(a) is type(b) and a==b,at)
def normalize(raw):
 c=load(raw/'commission.json');sites=load(raw/'site-terms.json');prior=load(raw/'prior-bills.json');devices={r['id']:{k:(v if k=='id' else n(v)) for k,v in r.items()} for r in rows(raw/'equipment-quotes.csv')};hist={}
 for r in rows(raw/'meter-history.csv'):
  if t(r['released_at'])<=t(c['history_cutoff']):
   key=tuple(r[k] for k in ['site','series','interval_start']);rev=int(r['revision'])
   if key not in hist or rev>int(hist[key]['revision']):hist[key]=r
 hh=[]
 for key,r in sorted(hist.items()):
  value=None
  if r['status']=='valid':value=n(r['value'])/({'W':F(1000),'kW':F(1),'kWh':n(r['duration_hours'])}[r['unit']])
  hh.append(dict(site=key[0],series=key[1],interval_start=key[2],revision=int(r['revision']),status=r['status'],power_kw=value,released_at=r['released_at']))
 return c,sites,prior,devices,hh
def finance(c,dev,base,cost,rate=None):
 annual=(base-cost)*n(c['campaigns_per_year']);rr=[dict(year=0,saving=F(0),om=F(0),replacement=F(0),residual=F(0),net=-dev['capital'],discounted=-dev['capital'])]
 for y in range(1,c['years']+1):
  saving=annual*n(c['annual_escalation'])**(y-1);replacement=dev['replacement'] if y==c['replacement_year'] else F(0);residual=dev['residual'] if y==c['years'] else F(0);net=saving-dev['annual_om']-replacement+residual
  rr.append(dict(year=y,saving=saving,om=dev['annual_om'],replacement=replacement,residual=residual,net=net,discounted=net/(1+n(c['discount'] if rate is None else rate))**y))
 return annual,sum(r['discounted'] for r in rr),rr
def audit(variant,run):
 raw=X/'raw'/variant;casepaths=X/'cases'/variant;c,sites,prior,devices,hist=normalize(raw);cases={p.stem:load(p) for p in casepaths.glob('*.json')};check('path_probabilities',sum(n(v['probability']) for v in cases.values())==1)
 audit=load(run/'prepare/model/audit.json');eq(audit,dict(commission=c,sites=sites,prior=prior,devices=devices,history=hist),'prepare authority')
 reg=load(run/'runs.json');check('assigned_matrix',len(reg['episodes'])==18 and {(r['scenario'],r['site'],r['device']) for r in reg['episodes']}==set(itertools.product(cases,sites,devices)))
 bills={};packets={};episodeproof=[]
 for rr in reg['episodes']:
  sc,site,di=(rr[k] for k in ['scenario','site','device']);root=Path(rr['root']);dev=devices[di];case=cases[sc];db=sqlite3.connect((root/'plant.sqlite3').resolve().as_uri()+'?mode=ro',uri=True);record=db.execute('select i,packet,action,receipt,state from step order by i').fetchall();db.close();check('144_SQL_cells',len(record)==144 and [r[0] for r in record]==list(range(144)))
  soc=F(0);peaks={m:n(v) for m,v in prior[site]['peak_kw'].items()};energy={};wear=cu=fu=curtailed=F(0);receipts=[];previous_end=None;duration=F(0)
  for i,ps,acts,recs,ss in record:
   p,act,rec,stored=map(json.loads,(ps,acts,recs,ss));obs=case['actual'][site][i];dt=n(obs['dt_hours']);dtsec=dt*3600;check('UTC_contiguous',previous_end is None or t(obs['at'])==previous_end);previous_end=t(obs['at'])+timedelta(seconds=float(dtsec));duration+=dt
   check('packet_current_and_identity',p['current']==obs and p['site']==site and p['step']==i and p['total_steps']==144 and p['kind']=='decide' and set(p)=={'kind','site','step','total_steps','device','site_terms','commission','state','current','forecast','confirmed_history'})
   eq(p['state'],dict(soc=soc,next=i,peaks=peaks,energy=energy,wear=wear,critical_unserved_kwh=cu,flex_unserved_kwh=fu,curtailed_kwh=curtailed),'packet state');eq(p['device'],dev);check('packet_original_terms',p['site_terms']==sites[site] and p['commission']==c);check('confirmed_prefix',p['confirmed_history']==receipts)
   eligible={}
   for f in case['forecasts'][site]:
    if i<=f['step']<i+16 and t(f['released_at'])<=t(obs['at']):
     k=f['step']
     if k not in eligible or (f['revision'],t(f['released_at']))>(eligible[k]['revision'],t(eligible[k]['released_at'])):eligible[k]=f
   check('highest_released_forecast',p['forecast']==[eligible[k] for k in sorted(eligible)],(variant,sc,site,di,i))
   q=n(act['power_kw']);charge=max(F(0),q);discharge=max(F(0),-q);new=soc+dev['eta_c']*charge*dt-discharge*dt/dev['eta_d'];tol=F('.000002')
   check('power_SOC',abs(q)<=dev['power_kw']*n(obs['derating'])+tol and -tol<=new<=dev['capacity_kwh']+tol)
   demand=n(obs['critical_kw'])+n(obs['flex_kw']);pv=n(obs['pv_kw']);net=demand+q-pv;curtail=max(F(0),-net);grid=min(max(F(0),net),n(sites[site]['import_limit_kw'])*n(obs['grid_available']));short=max(F(0),net-grid);sf=min(short,n(obs['flex_kw']));su=max(F(0),short-sf)
   check('bus_balance_and_noexport',grid+pv+discharge+sf+su==demand+charge+curtail and discharge<=demand+tol and F(0)<=su<=n(obs['critical_kw'])+tol)
   month=t(obs['at']).strftime('%Y-%m');peaks[month]=max(peaks.get(month,F(0)),grid);ec=grid*dt*n(obs['price']);wc=(charge+discharge)*dt*n(c['wear_per_ac_kwh']);energy[month]=energy.get(month,F(0))+ec;wear+=wc;cu+=su*dt;fu+=sf*dt;curtailed+=curtail*dt
   row=dict(step=i,at=obs['at'],month=month,dt_hours=dt,power_kw=q,charge_kw=charge,discharge_kw=discharge,soc_before=soc,soc_after=new,import_kw=grid,curtail_kw=curtail,critical_unserved_kw=su,flex_unserved_kw=sf,energy_cost=ec,wear_cost=wc,peak_after=peaks[month]);eq(rec,dict(key=f'{site}:{di}:{i}',row=row),'receipt');state=dict(soc=new,next=i+1,peaks=peaks,energy=energy,wear=wear,critical_unserved_kwh=cu,flex_unserved_kwh=fu,curtailed_kwh=curtailed);eq(stored,state,'SQL state');soc=new;receipts.append(rec);packets[(sc,site,di,i)]=(p,act['power_kw'])
  check('72h_terminal_SOC',duration==72 and abs(soc)<=F('.00002'))
  b=dict(energy=sum(energy.values()),demand=sum(peaks.values())*n(sites[site]['demand_per_kw']),wear=wear,critical_penalty=cu*n(c['critical_penalty']),flex_penalty=fu*n(c['flex_penalty']),critical_unserved_kwh=cu,flex_unserved_kwh=fu,peaks=peaks);b['total']=sum(b[k] for k in ['energy','demand','wear','critical_penalty','flex_penalty']);bills[(sc,site,di)]=b;res=load(root/'result.json');eq(res['bill'],b,'bill');eq(res['state'],state,'final SQL state');check('complete_original_ledger',res['ledger']==receipts)
  for cp in root.glob('*/create.json'):
   cr=load(cp);ins=load(cp.parent/'terminal-inspect.json');ms={m['Destination']:m for m in ins['Mounts']};check('actor_OS_isolation',set(ms)=={'/program','/model'} and all(not m['RW'] for m in ms.values()) and ins['HostConfig']['NetworkMode']=='none' and ins['HostConfig']['NanoCpus']==1000000000 and ins['State']['ExitCode']==0 and ins['RestartCount']==0 and cr['cid']==ins['Id']);check('actor_no_path_label_argv',ins['Args']==['-B','l10_reference.py','actor'])
  if rr['fault']:
   co=load(root/'committed-before-exit.json');rep=load(root/'resume/replay.json');check('real_73_and_original_resume',load(root/'owner-initial.json')['exit_code']==73 and load(root/'owner-resume.json')['exit_code']==0 and co['i']==45 and co['receipt']==receipts[45] and rep['receipt']==receipts[45] and rep['response']=={'acknowledged':receipts[45]['key']});eq(co['soc'],json.loads(record[45][4])['soc']);eq(co['peaks'],json.loads(record[45][4])['peaks'])
  episodeproof.append(dict(path=sc,site=site,device=di,steps=len(record),total=float(b['total']),critical=float(cu),terminal_soc=float(soc)))
 for site,di in itertools.product(sites,devices):
  for ca,cb in itertools.combinations(cases,2):
   for i in range(144):
    a,b=packets[(ca,site,di,i)],packets[(cb,site,di,i)]
    if a[0]==b[0]:check('full_visible_prefix_same_action',a[1]==b[1],(site,di,ca,cb,i))
 expected={s:{di:sum(n(cases[sc]['probability'])*bills[(sc,s,di)]['total'] for sc in cases) for di in devices} for s in sites};summ=[];cash=[];choices=[]
 for s in sites:
  value={}
  for di,dev in devices.items():
   annual,npv,flows=finance(c,dev,expected[s]['ZERO'],expected[s][di]);value[di]=npv;critical=sum(n(cases[sc]['probability'])*bills[(sc,s,di)]['critical_unserved_kwh'] for sc in cases);summ.append(dict(site=s,device=di,expected_campaign_cost=expected[s][di],expected_critical_unserved_kwh=critical,npv=npv,annual_initial_saving=annual));cash.extend(dict(site=s,device=di,**f) for f in flows)
  best=min(value,key=lambda di:(-value[di],di));choices.append(dict(site=s,selected=best,npv=value[best]))
 delivery=run/'delivery/result';study=load(delivery/'study.json');eq(study['expected_costs'],expected,'expected costs')
 for field,want,keys in [('summaries',summ,('site','device')),('cash',cash,('site','device','year')),('choices',choices,('site',))]:
  got=study[field];gm={tuple(r[k] for k in keys):r for r in got};wm={tuple(r[k] for k in keys):r for r in want};check('financial_business_keys',len(gm)==len(got) and set(gm)==set(wm),field)
  for k,r in wm.items():eq(gm[k],r,field+'/'+str(k))
 ref=load(X/f'reference-{variant}-final.json');eq(ref['expected_costs'],expected,'registered causal cost');
 for s,di in itertools.product(sites,devices):
  cost=expected[s][di];crit=sum(n(cases[sc]['probability'])*bills[(sc,s,di)]['critical_unserved_kwh'] for sc in cases);check('registered_quality',cost<=(1+n(c['quality_cost_relative_allowance']))*n(ref['expected_costs'][s][di])+F('.00001') and crit<=n(ref['critical'][s][di])+n(c['quality_critical_kwh_allowance']))
 for sens in load(delivery/'sensitivity.json'):
  s=sens['site'];vv={di:finance(c,d,expected[s]['ZERO'],expected[s][di],sens['discount'])[1] for di,d in devices.items()};eq(sens['npvs'],vv,'discount sensitivity');check('sensitivity_choice',sens['selected']==min(vv,key=lambda d:(-vv[d],d)))
 for r in rows(delivery/'historical-invoices.csv'):
  s=r['site'];m=r['month'];pr=prior[s];eq(r['historical_invoice'],n(pr['prior_energy_usd'])+n(pr['peak_kw'][m])*n(sites[s]['demand_per_kw']))
 # Report receives actual telemetry/actions; no host precomputed bill is supplied.
 report_input=load(run/'report-evidence/results.json')['episodes'];check('report_input_no_bill',len(report_input)==18 and all('bill' not in r and len(r['telemetry'])==len(r['ledger'])==144 for r in report_input))
 # Same immutable programme across actual input controls, not a correctness hash gate.
 source=X/'final-submission';check('sealed_source_identity',{p.relative_to(source).as_posix():p.read_bytes() for p in source.rglob('*') if p.is_file()}=={p.relative_to(run/'sealed-program').as_posix():p.read_bytes() for p in (run/'sealed-program').rglob('*') if p.is_file()})
 return dict(episodes=episodeproof,expected_costs=expected,summaries=summ,choices=choices,history_rows=len(hist),history_missing=sum(r['status']=='missing' for r in hist))
def encode(v):
 if isinstance(v,F):return {'num':v.numerator,'den':v.denominator,'decimal':float(v)}
 raise TypeError(type(v).__name__)
start=time.monotonic()
if '--cold' in sys.argv:out['base']=audit('base',R/'cold-run')
else:
 for variant in ('base','price','quote'):out[variant]=audit(variant,X/f'final-{variant}-run')
name='cold-business-audit.json' if '--cold' in sys.argv else 'business-audit.json'
(R/name).write_text(json.dumps(dict(seconds=time.monotonic()-start,source='independent standard-library scalar Fraction arithmetic; no author imports',checks=counts,failures=failures,max_absolute_roundoff=max_error,results=out),default=encode,indent=2),encoding='utf-8');print(json.dumps(dict(seconds=time.monotonic()-start,checks=sum(counts.values()),failures=len(failures),max_absolute_roundoff=max_error),indent=2))
