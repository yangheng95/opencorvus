"""Whole L08 checker from raw facts and real native executions."""
import argparse,csv,json,math
from pathlib import Path
from l08_core import load,save,world,manifest,bound,replay,Candidate,Facility

def exact(a,b):
 if type(a)!=type(b):return False
 if isinstance(a,dict):return a.keys()==b.keys() and all(exact(a[k],b[k]) for k in a)
 if isinstance(a,list):return len(a)==len(b) and all(exact(x,y) for x,y in zip(a,b))
 return a==b
def list_order(a):
 if isinstance(a,dict):return {k:(sorted(v) if k in ('resources','source_ids') and type(v)==list else list_order(v)) for k,v in a.items()}
 if isinstance(a,list):return [list_order(x) for x in a]
 return a
def keyed(items,keys):
 if type(items) is not list:raise Candidate('rows_schema')
 result={}
 for row in items:
  if type(row) is not dict:raise Candidate('row_schema')
  k=tuple(row[x] for x in keys)
  if k in result:raise Candidate('row_duplicate')
  result[k]=row
 return result
def manifest_equal(a,b):
 if type(a)!=dict or a.keys()!=b.keys():return False
 try:
  return exact(list_order(keyed(a['states'],['tenant','item'])),list_order(keyed(b['states'],['tenant','item']))) and exact(keyed(a['invalid_rows'],['source_id']),keyed(b['invalid_rows'],['source_id'])) and exact(sorted(a['excluded_future']),sorted(b['excluded_future'])) and exact(a['totals_by_tenant'],b['totals_by_tenant'])
 except (KeyError,TypeError,Candidate):return False
def normalized_export(file,columns):
 with file.open(encoding='utf-8',newline='') as f:
  r=csv.DictReader(f)
  if r.fieldnames!=columns:raise Candidate('export_schema:'+file.name)
  return list(r)
def assess_variant(info):
 checks={f'M{i:02}':{'pass':True,'evidence':[]} for i in range(1,15)}
 def setcheck(code,ok,evidence):
  if not ok:checks[code]['pass']=False
  checks[code]['evidence'].append(evidence)
 def blocked(codes,evidence):
  for code in codes:
   if checks[code]['pass'] is True:checks[code]['pass']=None
   checks[code]['evidence'].append(evidence)
 def read(code,path):
  try:
   if not path.resolve().is_relative_to(path.parent.parent.resolve()):raise Candidate('output_path_outside:'+path.name)
   return load(path)
  except (ValueError,OSError,Candidate) as ex:setcheck(code,False,{'code':'candidate_delivery_invalid','file':path.name,'detail':str(ex)});return None
 def equal_rows(code,actual,wanted,key):
  try:return exact(list_order(keyed(actual,[key])),list_order(keyed(wanted,[key])))
  except (Candidate,KeyError,TypeError,ValueError) as ex:setcheck(code,False,{'code':'candidate_rows_invalid','detail':str(ex)});return False
 root=Path(info['programme']);component=Path(info['component']);raw=Path(info['raw']);w=world(raw);expected=manifest(raw)
 # Native state comes from captured Docker inspect, not candidate JSON.
 for folder in (root,component):
  try:inspect=load(folder/'inspect.json');state=inspect[0]['State'];native=load(folder/'native.json')
  except (ValueError,OSError,KeyError,TypeError,IndexError) as ex:raise Facility('native_capture_invalid:'+str(ex)) from ex
  setcheck('M01',state['Status']=='exited' and state['ExitCode']==0 and native['exit_code']==state['ExitCode'],{'folder':str(folder),'state':state['Status'],'exit_code':state['ExitCode']})
 result=root/'result'
 if not result.resolve().is_relative_to(root.resolve()) or not (component/'result').resolve().is_relative_to(component.resolve()):
  setcheck('M02',False,{'code':'candidate_output_path_invalid'});blocked([f'M{i:02}' for i in range(3,15)],{'code':'output_dependency_unavailable'});return checks
 actual_component=read('M02',component/'result/manifest.json');actual_manifest=read('M02',result/'manifest.json')
 setcheck('M02',manifest_equal(actual_component,expected) and manifest_equal(actual_manifest,expected),{'expected':expected,'actual_component':actual_component})
 component_ok=manifest_equal(actual_component,expected)
 history=read('M03',result/'history.json');paid=read('M04',result/'paid-ledger.json');plans=read('M05',result/'plans.json');reported=read('M13',result/'execution.json')
 setcheck('M03',equal_rows('M03',history,list(w['history'].values()),'task'),{'history':history})
 setcheck('M04',equal_rows('M04',paid,w['payments'],'payment_id'),{'past_cost':w['past_cost'],'checkpoint_cash':w['cash']})
 ids={e['id'] for e in w['events']};setcheck('M05',type(plans)==dict and set(plans)==ids,{'scenario_ids':sorted(plans) if isinstance(plans,dict) else None})
 setcheck('M13',type(reported)==dict and set(reported)==ids,{'execution_ids':sorted(reported) if isinstance(reported,dict) else None})
 if type(plans)!=dict:
  blocked([f'M{i:02}' for i in range(6,15)],{'code':'plans_dependency_unavailable'});return checks
 if type(reported)!=dict:reported={}
 derived={}
 for e in w['events']:
  p=plans.get(e['id'],{'tasks':[]})
  try:a=replay(w,e,p,component_ok)
  except (Candidate,KeyError,TypeError,ValueError) as ex:
   setcheck('M05',False,{'scenario':e['id'],'code':'plan_invalid','detail':str(ex)});blocked([f'M{i:02}' for i in range(6,15)],{'scenario':e['id'],'code':'plan_dependency_unavailable'});continue
  derived[e['id']]=a;codes={x['code'] for x in a['errors']}
  setcheck('M05',not(codes&{'mode_identity','duplicate_task','duration','mandatory_missing','work_after_handoff'}),a['errors'])
  setcheck('M06','calendar_or_release' not in codes,a['errors'])
  setcheck('M07',not(codes&{'dependency','optional_dependency'}),a['errors'])
  setcheck('M08','resource_overlap' not in codes,a['errors'])
  if a['finish'] is None:blocked(['M09','M10','M11','M12','M13','M14'],{'scenario':e['id'],'code':'handoff_dependency_unavailable'});continue
  setcheck('M09','cash_negative' not in codes and len(a['cash_ledger'])==a['finish']-12,{'cash_ledger':a['cash_ledger']})
  setcheck('M10','budget' not in codes and a['total_cost'] is not None,{'total_cost':a['total_cost'],'budget':w['treasury']['budget_total']})
  proof,_=bound(w,e)
  setcheck('M11',a['finish']==proof['finish_lower_bound'],{'finish':a['finish'],'relaxed_bound':proof['finish_lower_bound'],'extension_requested':a['extension_requested']})
  setcheck('M12',a['optional_retained']==proof['optional_possible'],{'retained':a['optional_retained'],'possible':proof['optional_possible']})
  # Row order and rational explanations are free; the actual execution facts must be exact integers/bools.
  r=reported.get(e['id'],{})
  if type(r)==dict and isinstance(r.get('tasks'),list) and isinstance(r.get('history'),list) and isinstance(r.get('paid_ledger'),list):
   r=dict(r);want=dict(a)
   try:
    for field,key in [('tasks','task'),('history','task'),('paid_ledger','payment_id')]:r[field]=keyed(r[field],[key]);want[field]=keyed(want[field],[key])
    setcheck('M13',exact(list_order(r),list_order(want)),{'scenario':e['id'],'derived':a,'reported':reported[e['id']]})
   except (Candidate,KeyError,TypeError,ValueError) as ex:setcheck('M13',False,{'scenario':e['id'],'code':'execution_schema','detail':str(ex)})
  else:setcheck('M13',False,{'scenario':e['id'],'error':'execution_schema'})
 try:
  for name in ('schedule.csv','cash-ledger.csv'):
   if not (result/name).resolve().is_relative_to(result.resolve()):raise Candidate('export_path_outside')
  schedule=normalized_export(result/'schedule.csv',['scenario','task','mode','start','end','resources']);cash=normalized_export(result/'cash-ledger.csv',['scenario','day','inflow','expense','cash_end','cumulative_cost'])
 except (Candidate,ValueError,OSError,KeyError,TypeError) as ex:setcheck('M14',False,{'code':'export_invalid','detail':str(ex)});return checks
 expected_schedule=[];expected_cash=[]
 for sid,a in derived.items():
  for row in a['tasks']:expected_schedule.append({k:str(v) for k,v in dict(scenario=sid,task=row['task'],mode=row['mode'],start=row['start'],end=row['end'],resources=';'.join(row['resources'])).items()})
  for row in a['cash_ledger']:expected_cash.append({k:str(v) for k,v in dict(scenario=sid,**row).items()})
 for row in schedule+expected_schedule:row['resources']=';'.join(sorted(row['resources'].split(';')))
 try:setcheck('M14',exact(keyed(schedule,['scenario','task']),keyed(expected_schedule,['scenario','task'])) and exact(keyed(cash,['scenario','day']),keyed(expected_cash,['scenario','day'])),{'schedule_rows':len(schedule),'cash_rows':len(cash)})
 except (Candidate,KeyError,TypeError,ValueError) as ex:setcheck('M14',False,{'code':'export_schema','detail':str(ex)})
 return checks
def grade(run,rubric_path,out,review=None,role='candidate'):
 rubric=load(rubric_path);registry=load(run/'runs.json');findings={};variants={}
 for variant,info in registry['runs'].items():
  try:variants[variant]=assess_variant(info)
  except Facility:raise
  except Candidate as ex:raise Facility('unclassified_output_contract:'+str(ex)) from ex
 for i in range(1,15):
  leaf=f'M{i:02}';states=[a[leaf]['pass'] for a in variants.values()]
  findings[leaf]={'status':'fail' if False in states else ('blocked' if None in states else 'pass'),'evidence':{v:a[leaf] for v,a in variants.items()}}
 transformations=set(variants)=={'base','future_quote','new_scope'}
 changed_dependencies=['M01','M02','M05','M06','M07','M08','M09','M10','M11','M12','M13']
 transformed=[variants[v][k]['pass'] for v in ('future_quote','new_scope') if v in variants for k in changed_dependencies]
 status='fail' if not transformations or False in transformed else ('blocked' if None in transformed else 'pass')
 findings['M15']={'status':status,'evidence':{'contract':'same sealed programme recomputes the changed quote and new mandatory tenant/scope; base export completeness is M14, independent historical records are M03/M04','changed_dependencies':changed_dependencies,'registered_inputs':sorted(variants)}}
 trusted=None
 if review:
  trusted=load(review)
  if Path(trusted['run_root']).resolve()!=run.resolve() or trusted.get('role')!='independent_evaluator' or set(trusted['ratings'])!={f'H{i:02}' for i in range(1,6)}:raise Facility('review_binding')
 for i in range(1,6):
  key=f'H{i:02}';r=trusted['ratings'][key] if trusted else {'status':'unassessed','evidence':'actual whole-case independent review pending'}
  if r['status'] not in ('pass','fail','unassessed') or not isinstance(r.get('evidence'),str):raise Facility('review_rating')
  findings[key]=r
 unassessed=[k for k,v in findings.items() if v['status']=='unassessed'];score=sum(x['weight'] for x in rubric['leaves'] if findings[x['id']]['status']=='pass')
 critical_failed=[x['id'] for x in rubric['leaves'] if x['critical'] and findings[x['id']]['status']=='fail'];critical_not_passed=[x['id'] for x in rubric['leaves'] if x['critical'] and findings[x['id']]['status']!='pass']
 total=None if unassessed else score;good=None if total is None else total>=rubric['good_minimum'] and not critical_not_passed
 report={'role':role,'run_root':str(run.resolve()),'case':rubric['case'],'total':total,'good':good,'business_success':None if unassessed else not critical_not_passed,'critical_failed':critical_failed,'critical_not_passed':critical_not_passed,'unassessed':unassessed,'findings':findings,'limitations':'author reference and nonblind AI review are not a model candidate score, professional certification or effective-hour evidence' if role=='reference_qualification' else 'candidate score under development-pilot contract; effective hours separate'}
 save(out,report);return 4 if unassessed else (0 if good else 2)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--run',required=True,type=Path);p.add_argument('--rubric',required=True,type=Path);p.add_argument('--out',required=True,type=Path);p.add_argument('--review',type=Path);p.add_argument('--role',choices=['candidate','reference_qualification','error_control'],default='candidate');a=p.parse_args()
 try:raise SystemExit(grade(a.run,a.rubric,a.out,a.review,a.role))
 except Facility as e:save(a.out,{'status':'run_invalid','facility_error':str(e),'total':None,'good':None});raise SystemExit(3)
