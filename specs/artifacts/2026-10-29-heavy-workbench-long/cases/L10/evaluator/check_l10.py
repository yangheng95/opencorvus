"""Actual L10 artifacts, authoritative plant facts, registered input and fixed rubric."""
import argparse,csv,json,math,sqlite3,itertools
from pathlib import Path
from l10_core import read,save,authority,initial,packet,transition,bill,economic
def numeric(x):return type(x) in (int,float) and math.isfinite(x)
def identical(x,y):
 if numeric(x) and numeric(y):return x==y
 if type(x) is not type(y):return False
 if isinstance(x,dict):return x.keys()==y.keys() and all(identical(x[k],y[k]) for k in x)
 if isinstance(x,list):return len(x)==len(y) and all(identical(a,b) for a,b in zip(x,y))
 return x==y
def same(x,y):
 if numeric(x) and numeric(y):return abs(x-y)<=2e-5+1e-7*abs(y)
 if type(x) is not type(y):return False
 if isinstance(x,dict):return x.keys()==y.keys() and all(same(x[k],y[k]) for k in x)
 if isinstance(x,list):return len(x)==len(y) and all(same(a,b) for a,b in zip(x,y))
 return x==y
def fail(code,detail):raise ValueError(code+':'+str(detail))
def sqlsteps(root):
 p=(root/'plant.sqlite3').resolve();c=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
 try:
  if c.execute('pragma user_version').fetchone()[0]!=1:fail('plant_format',root)
  return [dict(r) for r in c.execute('select * from step order by i')]
 finally:c.close()
def candidate_csv(path,required):
 try:
  with path.open(encoding='utf-8',newline='') as f:
   reader=csv.DictReader(f);fields=reader.fieldnames
   if fields is None or len(set(fields))!=len(fields) or not set(required)<=set(fields):return None,{'code':'candidate_export_columns_invalid','file':path.name,'required':list(required),'observed':fields}
   rr=list(reader)
  if any(None in r or any(r.get(k) is None for k in required) for r in rr):return None,{'code':'candidate_export_row_shape_invalid','file':path.name}
  return rr,None
 except FileNotFoundError:return None,{'code':'candidate_export_missing','file':path.name}
 except (ValueError,UnicodeError,csv.Error):return None,{'code':'candidate_export_csv_invalid','file':path.name}
def check_export_rows(path,expected,keys):
 if not expected:raise ValueError('facility_expected_export_grid_invalid')
 rr,error=candidate_csv(path,tuple(expected[0]))
 if error:return [error]
 wanted={tuple(str(r[k]) for k in keys):r for r in expected};seen=set();errors=[]
 for row in rr:
  identity=tuple(row[k] for k in keys);seen.add(identity)
  if identity not in wanted:errors.append({'code':'candidate_export_row_identity','file':path.name,'identity':identity});continue
  for field,value in wanted[identity].items():
   try:ok=same(float(row[field]),value) if numeric(value) else row[field]==value
   except (KeyError,ValueError,TypeError):ok=False
   if not ok:errors.append({'code':'candidate_export_field_value','file':path.name,'identity':identity,'field':field})
 if len(seen)!=len(rr) or seen!=set(wanted):errors.append({'code':'candidate_export_complete_unique_grid','file':path.name})
 return errors
def financial_output(path):
 try:s=read(path)
 except FileNotFoundError:return None,[{'field':'study','code':'candidate_financial_output_missing'}]
 except (ValueError,UnicodeError):return None,[{'field':'study','code':'candidate_financial_json_invalid'}]
 if type(s) is not dict:return None,[{'field':'study','code':'candidate_financial_object_required'}]
 return s,[]
def financial_index(value,keys):
 if type(value) is not list or any(type(r) is not dict or any(k not in r for k in keys) for r in value):raise ValueError('candidate_financial_row_array_required')
 try:return {tuple(r[k] for k in keys):r for r in value}
 except TypeError as e:raise ValueError('candidate_financial_identity_type') from e
def audit_matches(path,expected):
 try:
  actual=read(path)
  if type(actual) is not dict or any(k not in actual or not same(actual[k],expected[k]) for k in ['commission','sites','devices','prior']):return False
  rr=actual['history'];got=financial_index(rr,('site','series','interval_start'));want=financial_index(expected['history'],('site','series','interval_start'))
  return len(got)==len(rr) and set(got)==set(want) and all(all(k in got[i] and same(got[i][k],v) for k,v in r.items()) for i,r in want.items())
 except (FileNotFoundError,ValueError,TypeError,KeyError):return False
def facts(run):
 reg=read(run/'runs.json');raw=Path(reg['raw']);cases=Path(reg['cases']);a=authority(raw);computed={};proof=[];errors={f'M{i:02d}':[] for i in range(1,15)};blocked=[];complete=read(run/'execution-status.json').get('execution_complete',False)
 audit=run/'prepare/model/audit.json'
 if not audit_matches(audit,a):errors['M01'].append('highest-revision/units/prior/devices/source audit differs')
 if not complete:errors['M02'].append({'code':'actual_programme_execution_incomplete','status':read(run/'execution-status.json')})
 casesmap={p.stem:read(p) for p in cases.glob('*.json')};expected={(c,s,d) for c in casesmap for s in a['sites'] for d in a['devices']};got={(r['scenario'],r['site'],r['device']) for r in reg['episodes']}
 if got!=expected or len(got)!=len(reg['episodes']):errors['M02'].append('full assigned episodes required')
 packetmap={};results=[];faults=[]
 for r in reg['episodes']:
  root=Path(r['root']);key=(r['scenario'],r['site'],r['device']);s=initial(a,r['site']);rr=[];case=casesmap[r['scenario']];rows=sqlsteps(root)
  if r['exit_code']!=0:
   errors['M02'].append({'episode':key,'native_exit':r['exit_code']})
   if (root/'failure.json').exists():
    actual=read(root/'failure.json');detail=actual.get('detail')
    if detail in ('battery_power_limit','soc_balance_bounds','terminal_soc_zero','action_power_finite_number'):errors['M03'].append({'episode':key,'actual_native_failure':actual})
    if detail=='confirmed_receipt_acknowledgement':errors['M10'].append({'episode':key,'actual_native_failure':actual})
   continue
  if len(rows)!=len(case['actual'][r['site']]):errors['M03'].append({'episode':key,'actual_rows':len(rows)});continue
  for row in rows:
   i=row['i'];p=json.loads(row['packet']);action=json.loads(row['action']);receipt=json.loads(row['receipt']);stored=json.loads(row['state']);expectedp=packet(a,case,r['site'],a['devices'][r['device']],i,s,rr)
   if not identical(p,expectedp):errors['M09'].append({'episode':key,'step':i,'code':'actual_authorized_packet_mismatch'})
   packetmap[(key,i)]=(p,action)
   try:sn,phys=transition(a,r['site'],a['devices'][r['device']],s,expectedp['current'],action)
   except (ValueError,KeyError,TypeError) as e:errors['M03'].append({'episode':key,'step':i,'code':str(e)});break
   if not same(stored,sn):errors['M03'].append({'episode':key,'step':i,'code':'confirmed_soc_and_cumulative_state'})
   original=receipt.get('row',{})
   for leaf,fields in [('M03',['soc_before','soc_after','power_kw','charge_kw','discharge_kw','dt_hours']),('M04',['import_kw','curtail_kw','critical_unserved_kw','flex_unserved_kw']),('M05',['month','peak_after']),('M06',['energy_cost','wear_cost'])]:
    for field in fields:
     if field not in original or not same(original[field],phys[field]):errors[leaf].append({'episode':key,'step':i,'field':field,'observed':original.get(field),'expected':phys[field]})
   if receipt.get('key')!=f"{r['site']}:{r['device']}:{i}":errors['M10'].append({'episode':key,'step':i,'code':'receipt_joint_identity'})
   s=sn;rr.append(receipt)
  if abs(s['soc'])>2e-5:errors['M03'].append({'episode':key,'code':'terminal_soc_zero','value':s['soc']})
  actual=read(root/'result.json');b=bill(a,r['site'],s)
  if not same(actual['bill'],b):errors['M06'].append({'episode':key,'code':'energy_demand_wear_unserved_bill'})
  if not same(actual['state'],s) or not same(actual['ledger'],rr):errors['M10'].append({'episode':key,'code':'exported_original_ledger_binding'})
  for create in root.glob('*/create.json'):
   stage=create.parent;ins=read(stage/'terminal-inspect.json');mounts=ins['Mounts'];expectedmounts={'/program':str((run/'sealed-program').resolve()),'/model':str((run/'prepare/model').resolve())}
   norm=lambda x:str(x).replace('\\','/').lower()
   if ins['HostConfig']['NetworkMode']!='none' or {x['Destination'] for x in mounts}!=set(expectedmounts) or any(x['RW'] or norm(x['Source'])!=norm(expectedmounts[x['Destination']]) for x in mounts):errors['M09'].append({'episode':key,'code':'actual_actor_mount_and_network_contract'})
   if ins['State']['Status']!='exited' or ins['State']['ExitCode']!=0:errors['M02'].append({'episode':key,'code':'actual_actor_native_exit','exit':ins['State']['ExitCode']})
  if r['fault']:
   initialowner=read(root/'owner-initial.json');res=read(root/'owner-resume.json');committed=read(root/'committed-before-exit.json');replay=read(root/'resume/replay.json');oldrow=rr[committed['i']]
   ok=initialowner['exit_code']==73 and res['exit_code']==0 and same(committed['receipt'],oldrow) and replay['response']=={'acknowledged':oldrow['key']} and same(replay['receipt'],oldrow) and len(rows)==len({x['i'] for x in rows})
   if not ok:errors['M10'].append({'episode':key,'code':'committed_receipt_state_resume'})
   faults.append({'episode':key,'owner_initial':73,'owner_resume':res['exit_code'],'committed_soc':committed['soc'],'committed_peaks':committed['peaks'],'steps':len(rows),'receipt':oldrow['key']})
  results.append({**{k:r[k] for k in ['scenario','probability','site','device']},'bill':b});proof.append({'episode':key,'actual_steps':len(rows),'native':r['exit_code']})
 if complete and len(faults)!=1:errors['M10'].append('one assigned real committed-write fault and original-state resume required')
 # Equal full observation prefixes must yield equal actions under the declared reproducible policy.
 for site in a['sites']:
  for device in a['devices']:
   for ca,cb in itertools.combinations(sorted(casesmap),2):
    for i in range(min(len(casesmap[ca]['actual'][site]),len(casesmap[cb]['actual'][site]))):
     x=packetmap.get(((ca,site,device),i));y=packetmap.get(((cb,site,device),i))
     if x and y and identical(x[0],y[0]) and not identical(x[1].get('power_kw'),y[1].get('power_kw')):errors['M09'].append({'site':site,'device':device,'paths':[ca,cb],'step':i,'code':'equal_complete_visible_prefix_different_action'})
 expectedcost={site:{d:sum(r['probability']*r['bill']['total'] for r in results if r['site']==site and r['device']==d) for d in a['devices']} for site in a['sites']};critical={site:{d:sum(r['probability']*r['bill']['critical_unserved_kwh'] for r in results if r['site']==site and r['device']==d) for d in a['devices']} for site in a['sites']}
 if complete:
  delivery=run/'delivery/result';study,parse_errors=financial_output(delivery/'study.json');errors['M07'].extend(parse_errors);cash=[];summaries=[];choices=[]
  for site in a['sites']:
   vv={}
   for device,dev in a['devices'].items():
    e=economic(a,dev,expectedcost[site]['ZERO'],expectedcost[site][device]);vv[device]=e['npv'];summaries.append({'site':site,'device':device,'expected_campaign_cost':expectedcost[site][device],'expected_critical_unserved_kwh':critical[site][device],'npv':e['npv'],'annual_initial_saving':e['annual_initial_saving']});cash.extend({'site':site,'device':device,**r} for r in e['cash'])
   best=min(vv,key=lambda d:(-vv[d],d));choices.append({'site':site,'selected':best,'npv':vv[best]})
  if study is None:blocked.append('M08')
  else:
   if 'expected_costs' not in study or not same(study['expected_costs'],expectedcost):errors['M07'].append({'field':'expected_costs','code':'candidate_actual_expected_costs'})
   for field,ex,keys in [('summaries',summaries,('site','device')),('cash',cash,('site','device','year'))]:
    try:
     rr=study[field];gotmap=financial_index(rr,keys);exmap=financial_index(ex,keys)
     if len(gotmap)!=len(rr) or set(gotmap)!=set(exmap) or any(any(k not in gotmap[i] or not same(gotmap[i][k],v) for k,v in r.items()) for i,r in exmap.items()):errors['M07'].append({'field':field,'code':'candidate_full_financial_components'})
    except (KeyError,ValueError) as e:errors['M07'].append({'field':field,'code':'candidate_financial_shape_invalid','detail':str(e)})
   try:
    cc=financial_index(study['choices'],('site',))
    if len(cc)!=len(study['choices']) or set(cc)!={(r['site'],) for r in choices}:errors['M08'].append({'code':'candidate_complete_unique_site_choices'})
    for r in choices:
     if (r['site'],) not in cc or any(k not in cc[(r['site'],)] or not same(cc[(r['site'],)][k],v) for k,v in r.items()):errors['M08'].append(r)
   except (KeyError,ValueError) as e:errors['M08'].append({'code':'candidate_choice_shape_invalid','detail':str(e)})
  required=['study.json','REPORT.md','commissioning.png','campaigns.csv','cashflows.csv','dispatch.csv','audit.json','source-map.json','sensitivity.json','TEACHER-OPERATOR-HANDOVER.md','reconciliation.json','historical-invoices.csv']
  for n in required:
   if not (delivery/n).is_file():errors['M13'].append({'required':n})
  if (delivery/'audit.json').is_file() and not audit_matches(delivery/'audit.json',a):errors['M13'].append('delivered source audit')
  if (delivery/'reconciliation.json').is_file():
   try:
    rr=read(delivery/'reconciliation.json');got=financial_index(rr,('scenario','site','device'));want={(r['scenario'],r['site'],r['device']):r['bill'] for r in results}
    if len(got)!=len(rr) or set(got)!=set(want) or any('recomputed_bill' not in got[k] or not same(got[k]['recomputed_bill'],v) or not numeric(got[k].get('max_physics_difference')) or not 0<=got[k]['max_physics_difference']<=2e-5 for k,v in want.items()):errors['M13'].append('actual independent reconciliation fields')
   except (ValueError,TypeError,KeyError):errors['M13'].append('candidate_reconciliation_shape_invalid')
  expected_dispatch=[]
  for r in reg['episodes']:
   if r['exit_code']!=0:continue
   for entry in read(Path(r['root'])/'result.json')['ledger']:expected_dispatch.append({'scenario':r['scenario'],'site':r['site'],'device':r['device'],**entry['row']})
  errors['M13'].extend(check_export_rows(delivery/'dispatch.csv',expected_dispatch,('scenario','site','device','step')))
  invoices=[{'site':site,'month':m,'prior_energy':v['prior_energy_usd'],'confirmed_peak_kw':peak,'demand_rate':a['sites'][site]['demand_per_kw'],'historical_invoice':v['prior_energy_usd']+peak*a['sites'][site]['demand_per_kw']} for site,v in a['prior'].items() for m,peak in v['peak_kw'].items()]
  for name,ex,keys in [('campaigns.csv',summaries,('site','device')),('cashflows.csv',cash,('site','device','year')),('historical-invoices.csv',invoices,('site','month'))]:errors['M13'].extend(check_export_rows(delivery/name,ex,keys))
 return {'authority':a,'cases':casesmap,'expected_costs':expectedcost,'critical':critical,'errors':errors,'proof':proof,'faults':faults,'complete':complete,'blocked':blocked}
def register(run,out):
 f=facts(run)
 if any(f['errors'][k] for k in ['M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M13']):fail('reference_not_qualified',f['errors'])
 save(out,{'format':'L10-registered-causal-reference/1','authority':f['authority'],'cases':f['cases'],'expected_costs':f['expected_costs'],'critical':f['critical'],'role':'author_causal_reachability_not_global_optimum','source_run':str(run.resolve())})
def assess(run,key):
 f=facts(run);k=read(key)
 if k['format']!='L10-registered-causal-reference/1' or not identical(f['authority'],k['authority']) or not identical(f['cases'],k['cases']):fail('facility_registered_input_mismatch',run)
 for site in f['authority']['sites']:
  for d in f['authority']['devices']:
   policy=f['authority']['commission'];limit=(1+policy['quality_cost_relative_allowance'])*k['expected_costs'][site][d]+1e-5;critical_limit=k['critical'][site][d]+policy['quality_critical_kwh_allowance']
   if f['expected_costs'][site][d]>limit:f['errors']['M11'].append({'site':site,'device':d,'observed':f['expected_costs'][site][d],'limit':limit})
   if f['critical'][site][d]>critical_limit:f['errors']['M12'].append({'site':site,'device':d,'observed':f['critical'][site][d],'limit':critical_limit})
 return f
def grade(runs,keys,rubric,review,out,role):
 definition=read(rubric);human={x['id'] for x in definition['leaves'] if x['assessment']=='independent'};leaves={};facility=[]
 rv={'ratings':{}}
 if review:
  try:
   rv=read(review)
   if type(rv) is not dict or rv.get('run_roots')!={k:str(Path(v).resolve()) for k,v in runs.items()}:raise ValueError('facility_review_actual_run_binding')
   ratings=rv.get('ratings')
   if type(ratings) is not dict or set(ratings)!=human:raise ValueError('facility_independent_review_leaf_set_invalid')
   for value in ratings.values():
    if type(value) is not dict or type(value.get('status')) is not str or value['status'] not in ('pass','fail') or not ((type(value.get('evidence')) is str and value['evidence'].strip()) or (type(value.get('evidence')) is list and value['evidence'])):raise ValueError('facility_independent_review_rating_invalid')
  except (ValueError,TypeError,KeyError,FileNotFoundError) as e:
   save(out,{'case':'L10/0.2.0-dev','role':role,'total':None,'good':None,'facility':[{'code':str(e),'source':'independent_review'}]});return 3
 for name,run in runs.items():
  try:f=assess(Path(run),Path(keys[name]))
  except (ValueError,KeyError,FileNotFoundError) as e:facility.append({'variant':name,'error':str(e)});continue
  for m,ee in f['errors'].items():
   leaves.setdefault(m,{'status':'pass','evidence':[]})
   if ee:leaves[m]['status']='fail'
   elif (m in f['blocked'] or not f['complete'] and m not in ('M01','M02')) and leaves[m]['status']!='fail':leaves[m]['status']='blocked_candidate'
   leaves[m]['evidence'].append({'variant':name,'errors':ee,'actual_episode_proof':f['proof'] if m=='M02' else None})
 if facility:save(out,{'case':'L10/0.2.0-dev','role':role,'total':None,'good':None,'facility':facility});return 3
 # This identity check binds the declared immutable submission across real input
 # controls. It is not a hash/source-style test of functional correctness.
 versions=[]
 for name,path in runs.items():
  source=Path(path)/'sealed-program';versions.append((name,{p.relative_to(source).as_posix():p.read_bytes() for p in source.rglob('*') if p.is_file()}))
 version_errors=[{'variant':name,'code':'submitted_programme_changed_between_assigned_inputs'} for name,v in versions[1:] if v!=versions[0][1]]
 if role!='error_control' and set(runs)!={'base','price','quote'}:version_errors.append({'code':'registered_source_controls_incomplete','assigned':['base','price','quote'],'observed':list(runs)})
 leaves['M14']={'status':'fail' if version_errors else 'pass','evidence':version_errors or 'Same original declared programme actually executed for the supplied input controls; immutable submission identity, not functional hash matching.'}
 for m,v in rv['ratings'].items():leaves[m]=v
 total=0;unassessed=[];critical=[]
 for leaf in definition['leaves']:
  i=leaf['id'];s=leaves.get(i,{'status':'unassessed','evidence':'actual assessment pending'});leaves[i]=s
  if s['status']=='pass':total+=leaf['weight']
  elif s['status']=='unassessed':unassessed.append(i)
  if leaf['critical'] and s['status']!='pass':critical.append(i)
 save(out,{'case':'L10/0.2.0-dev','role':role,'total':None if unassessed else total,'good':None if unassessed else total>=90 and not critical,'critical_not_passed':critical,'unassessed':unassessed,'findings':leaves,'limits':'Author simulation and nonblind AI review are not field certification, real service probabilities, fresh LLM scores or effective-hour evidence.'})
 return 4 if unassessed else 2 if critical or total<90 else 0
if __name__=='__main__':
 p=argparse.ArgumentParser();sub=p.add_subparsers(dest='cmd',required=True);r=sub.add_parser('register');r.add_argument('--run',type=Path,required=True);r.add_argument('--out',type=Path,required=True)
 g=sub.add_parser('grade');g.add_argument('--runs',type=Path,required=True);g.add_argument('--keys',type=Path,required=True);g.add_argument('--rubric',type=Path,required=True);g.add_argument('--review',type=Path);g.add_argument('--out',type=Path,required=True);g.add_argument('--role',default='candidate');a=p.parse_args()
 if a.cmd=='register':register(a.run,a.out)
 else:raise SystemExit(grade(read(a.runs),read(a.keys),a.rubric,a.review,a.out,a.role))
