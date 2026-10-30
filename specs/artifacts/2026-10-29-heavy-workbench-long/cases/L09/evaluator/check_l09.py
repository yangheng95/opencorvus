import argparse,csv,json,zipfile
from pathlib import Path
from l09_lab import load,save,decode,canonical
from l09_protocol import evaluate,equal

class Facility(ValueError):pass
def facts(raw):
 c=load(raw/'course-contract.json');data={}
 for name in sorted({x for x in c['week_sources'].values() if x}):
  with (raw/name).open(encoding='utf-8',newline='') as f:rows=list(csv.DictReader(f))
  parsed=[]
  for row in rows:
   v,error=decode(row);parsed.append({'admitted':v} if not error else {'row_id':row.get('row_id'),'error':error})
  data[name]=sorted(parsed,key=canonical)
 return {'course_contract':c,'tables':data}
def learner_identity(student):
 d=load(student/'student.json');out={'declaration':d,'files':{}}
 for name in d['files']:
  p=student/name
  if not p.resolve().is_relative_to(student.resolve()):raise Facility('student_resource_path')
  out['files'][name]=p.read_bytes().hex()
 return out
def indexed(root,index,key):
 value=index[key]
 if not isinstance(value,str):raise ValueError('delivery_index_type:'+key)
 path=root/value
 if Path(value).is_absolute() or not path.resolve().is_relative_to(root.resolve()):raise ValueError('delivery_path:'+key)
 return path
def native_exit(root):
 try:
  x=load(root/'inspect.json')[0];return x['State']['ExitCode'] if x['State']['Status']=='exited' else None
 except (OSError,ValueError,KeyError,IndexError,TypeError) as e:raise Facility('native_capture_invalid:'+str(e)) from e
def key_registration(run,out):
 r=load(run/'runs.json')['runs'];q=load(run/'ground-truth-qualification.json')['values'];keys={'role':'registered_constructed_coursework_reference','values':q,'facts':{},'students':{},'good_alternatives':['Q17','Q41'],'limits':'Actual constructed functional work, pending/subject to independent reconstruction; not real people or candidate self-assessment.'}
 for variant,info in r.items():
  keys['facts'][variant]=facts(Path(info['raw']))
  for id,g in info['grades'].items():
   v=learner_identity(Path(g['student']))
   if id in keys['students'] and keys['students'][id]!=v:raise Facility('student_identity_changed')
   keys['students'][id]=v
 save(out,keys)
def grade(run,key_file,rubric_path,out,review=None,role='candidate'):
 authority=load(key_file);rubric=load(rubric_path);registry=load(run/'runs.json')['runs'];findings={f'M{i:02}':{'status':'pass','evidence':[]} for i in range(1,14)};by_variant={v:{f'M{i:02}':True for i in range(1,14)} for v in registry}
 def setcheck(k,ok,evidence):
  if not ok:findings[k]['status']='fail'
  if isinstance(evidence,dict) and evidence.get('variant') in by_variant and not ok:by_variant[evidence['variant']][k]=False
  findings[k]['evidence'].append(evidence)
 def block(keys,evidence):
  for k in keys:
   if findings[k]['status']=='pass':findings[k]['status']='blocked'
   if isinstance(evidence,dict) and evidence.get('variant') in by_variant and by_variant[evidence['variant']][k] is True:by_variant[evidence['variant']][k]=None
   findings[k]['evidence'].append(evidence)
 if set(registry)!=set(authority['facts']):raise Facility('registered_input_set')
 for variant,info in registry.items():
  raw=Path(info['raw'])
  if not equal(facts(raw),authority['facts'][variant]):raise Facility('registered_input_facts_changed:'+variant)
  for route,path in info['routes'].items():
   collection=Path(path)
   for name,wanted in [(f'lab{i}',0) for i in range(1,7)]+[('lab3-commit-exit',73),('restored-lab4',0)]:
    capture=collection.parent/name
    if capture.is_dir():setcheck('M02',native_exit(capture)==wanted,{'variant':variant,'route':route,'cell':name,'native':native_exit(capture),'expected_exit':wanted})
    else:setcheck('M02',False,{'code':'cell_unexecuted','cell':name})
   try:a=evaluate(raw,collection)
   except (OSError,ValueError,KeyError,TypeError,AttributeError) as ex:
    setcheck('M02',False,{'code':'lab_output_invalid','detail':str(ex)});block(['M03','M04','M05','M06','M07','M08'],{'variant':variant,'route':route,'code':'lab_dependency_invalid'});continue
   setcheck('M03',a['domains']['D']==5,{'variant':variant,'route':route,'items':{k:v['points'] for k,v in a['items'].items() if k.startswith('D')}})
   setcheck('M04',a['domains']['S']==5,{'variant':variant,'route':route,'items':{k:v['points'] for k,v in a['items'].items() if k.startswith('S')}})
   setcheck('M05',all(a['items'][k]['points']==1 for k in ('R1','R2','R3')),{'variant':variant,'route':route,'items':{k:v['points'] for k,v in a['items'].items() if k.startswith('R')}})
   setcheck('M06',a['items']['R4']['points']==1,{'variant':variant,'route':route,'restore_points':a['items']['R4']['points']})
   setcheck('M07',a['domains']['A']==5,{'variant':variant,'route':route,'items':{k:v['points'] for k,v in a['items'].items() if k.startswith('A')}})
   # Integration is checked from original source/state, not from a report saying the final ledger is correct.
   setcheck('M08',all(v['points']==1 for v in a['items'].values()),{'variant':variant,'route':route,'actual_behavior_points':a['total']})
  student_grades={}
  if set(info['grades'])!=set(authority['students']):raise Facility('registered_coursework_set')
  for id,g in info['grades'].items():
   if learner_identity(Path(g['student']))!=authority['students'][id]:raise Facility('registered_coursework_identity:'+id)
   root=Path(g['root']);code=native_exit(root);setcheck('M09',code==0,{'variant':variant,'work':id,'native':code})
   try:
    path=root/'result/grade.json'
    if not path.resolve().is_relative_to((root/'result').resolve()):raise ValueError('grade_path')
    actual=load(path);wanted=authority['values'][variant][id];student_grades[id]=actual
    points=actual['items'];expected_points={k:v['points'] for k,v in wanted['items'].items()}
    typed=set(points)==set(expected_points) and all(type(v.get('points')) is int and v['points'] in (0,1) and type(v.get('maximum')) is int and v['maximum']==1 for v in points.values())
    correct=typed and {k:v['points'] for k,v in points.items()}==expected_points and equal(actual['domains'],wanted['domains']) and type(actual['total']) is int and actual['total']==wanted['total']
    setcheck('M09',correct,{'variant':variant,'work':id,'actual_domains':actual.get('domains'),'expected_domains':wanted['domains']})
    sums={d:sum(v['points'] for k,v in points.items() if k.startswith(d)) for d in ('D','S','R','A')} if typed else None
    setcheck('M11',typed and actual['domains']==sums and actual['total']==sum(sums.values()) and all(isinstance(v.get('evidence'),(str,dict)) and bool(v['evidence']) for v in points.values()),{'variant':variant,'work':id,'code':'atomic_primitive_sum_and_evidence'})
   except (OSError,ValueError,TypeError,KeyError) as ex:setcheck('M09',False,{'variant':variant,'work':id,'code':'coursework_grade_invalid','detail':str(ex)});setcheck('M11',False,{'work':id,'code':'grade_evidence_invalid'})
  setcheck('M10',all(student_grades.get(id,{}).get('total')==20 for id in authority['good_alternatives']),{'variant':variant,'correct_different_SQL':{id:student_grades.get(id,{}).get('total') for id in authority['good_alternatives']}})
  delivery=Path(info['delivery']);setcheck('M13',native_exit(delivery)==0,{'variant':variant,'native':native_exit(delivery)})
  try:index=load(delivery/'result/delivery-index.json');course=load(indexed(delivery/'result',index,'course'))
  except (OSError,ValueError,KeyError,TypeError) as ex:setcheck('M01',False,{'variant':variant,'code':'course_index_invalid','detail':str(ex)});block(['M06','M13'],{'variant':variant,'code':'delivery_index_dependency'});continue
  try:
   sessions=course['sessions'];profiles=course['diagnostics'];original=load(raw/'diagnostics.json');ok=len(sessions)==6 and {x['lab_id'] for x in sessions}==set(range(1,7)) and all(type(x['hours']) in (int,float) and x['hours']==5 for x in sessions) and sum(x['hours'] for x in sessions)==30 and len(profiles)==len(original)==24 and {x['learner_id'] for x in profiles}=={x['learner_id'] for x in original}
   original_by_id={x['learner_id']:x for x in original};ok=ok and all(x['observed_task']==original_by_id[x['learner_id']]['observed_task'] and isinstance(x.get('rationale'),str) and x['rationale'] and x.get('route_recommendation') for x in profiles)
   setcheck('M01',ok,{'variant':variant,'sessions':len(sessions),'profiles':len(profiles),'learner_hours':sum(x['hours'] for x in sessions)})
  except (KeyError,TypeError,ValueError) as ex:setcheck('M01',False,{'code':'course_manifest_invalid','detail':str(ex)})
  try:
   root=delivery/'result';checkpoint=load(indexed(root,index,'handover_checkpoint'));wanted=load(Path(info['routes']['guided'])/'lab3-commit-exit/checkpoint.json')
   setcheck('M06',equal(checkpoint,wanted),{'variant':variant,'code':'actual_intermediate_checkpoint_source'})
   delivered=load(indexed(root,index,'functional_grades'));setcheck('M13',equal(delivered,student_grades),{'variant':variant,'code':'reporter_uses_actual_grades'})
   forms=load(indexed(root,index,'forms'));setcheck('M13',{x['id'] for x in forms['forms']}=={'pre','post'} and all({q['domain'] for q in x['items']}=={'D','S','R','A'} for x in forms['forms']),{'variant':variant,'code':'fixed_construct_coverage'})
   paths=[indexed(root,index,k) for k in ('report','handover_instructions')]+[root/name for k in ('student_pack','teacher_pack','figures','figure_data') for name in index[k]]
   setcheck('M13',all(p.resolve().is_relative_to(root.resolve()) and p.is_file() and p.stat().st_size>0 for p in paths) and len(index['student_pack'])==len(index['teacher_pack'])==6,{'variant':variant,'code':'complete_indexed_real_teaching_artifacts','count':len(paths)})
  except (OSError,ValueError,TypeError,KeyError) as ex:setcheck('M13',False,{'variant':variant,'code':'delivery_artifact_invalid','detail':str(ex)})
 # No export or prose absence rewrites independent native/state findings.
 dependencies=['M02','M03','M04','M05','M07','M08','M09','M10','M11']
 transformed=[by_variant[v][k] for v in ('amount_change','new_tenant') if v in by_variant for k in dependencies]
 findings['M12']={'status':'fail' if set(registry)!={'base','amount_change','new_tenant'} or False in transformed else ('blocked' if None in transformed else 'pass'),'evidence':{'code':'actual_changed_amount_and_new_tenant_full_chain','dependencies':dependencies,'scope':'changed raw-input behavior; independent base artifact delivery is not silently re-penalized'}}
 trusted=load(review) if review else None
 if trusted and (Path(trusted['run_root']).resolve()!=run.resolve() or trusted.get('role')!='independent_evaluator'):raise Facility('review_assignment')
 for i in range(1,6):
  k=f'H{i:02}';r=trusted['ratings'][k] if trusted else {'status':'unassessed','evidence':'whole-case actual independent pedagogy/visual review pending'}
  if r['status'] not in ('pass','fail','unassessed') or not isinstance(r['evidence'],str):raise Facility('review_rating')
  findings[k]=r
 pending=[k for k,v in findings.items() if v['status']=='unassessed'];score=sum(x['weight'] for x in rubric['leaves'] if findings[x['id']]['status']=='pass');critical=[x['id'] for x in rubric['leaves'] if x['critical'] and findings[x['id']]['status']!='pass'];total=None if pending else score;good=None if pending else total>=rubric['good_minimum'] and not critical
 result={'case':rubric['case'],'role':role,'run_root':str(run.resolve()),'total':total,'good':good,'business_success':None if pending else not critical,'critical_not_passed':critical,'unassessed':pending,'findings':findings,'limits':'Constructed programmes and nonblind AI review are not real learner outcomes, professional certification, LLM candidate evidence or effective-hour proof.'};save(out,result);return 4 if pending else (0 if good else 2)
if __name__=='__main__':
 p=argparse.ArgumentParser();s=p.add_subparsers(dest='cmd',required=True);k=s.add_parser('register-key');k.add_argument('--run',required=True,type=Path);k.add_argument('--out',required=True,type=Path);g=s.add_parser('grade')
 for n in ('run','key','rubric','out'):g.add_argument('--'+n,required=True,type=Path)
 g.add_argument('--review',type=Path);g.add_argument('--role',choices=['candidate','reference_qualification','error_control'],default='candidate');a=p.parse_args()
 try:
  if a.cmd=='register-key':key_registration(a.run,a.out)
  else:raise SystemExit(grade(a.run,a.key,a.rubric,a.out,a.review,a.role))
 except Facility as e:save(a.out,{'status':'run_invalid','facility_error':str(e),'total':None,'good':None});raise SystemExit(3)
