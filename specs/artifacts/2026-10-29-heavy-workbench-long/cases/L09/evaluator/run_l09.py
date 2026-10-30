"""L09 clean native laboratories, unfamiliar coursework and teacher delivery."""
import argparse,csv,json,shutil,subprocess,time,zipfile
from pathlib import Path
from l09_lab import load,save
from l09_protocol import packet,evaluate
IMAGE='sha256:23ff8bfbf8055caa0b9fa5745ddb27cceea2f31d7d15b7a900c81112cdfe8ddf'
def native(program,out,argv,mounts):
 out.mkdir(parents=True);name='oc-l09-'+str(time.time_ns());command=['docker','create','--name',name,'--network','none','--cpus','1','-w','/program','--mount',f'type=bind,source={program.resolve()},target=/program,readonly','--mount',f'type=bind,source={out.resolve()},target=/results']
 for path,target,readonly in mounts:command+=['--mount',f'type=bind,source={path.resolve()},target={target}'+(',readonly' if readonly else '')]
 command += [IMAGE,*argv];start=time.perf_counter();created=subprocess.run(command,capture_output=True,text=True);save(out/'create.json',{'argv':command,'exit_code':created.returncode,'stdout':created.stdout,'stderr':created.stderr})
 if created.returncode:raise RuntimeError('facility_container_create')
 cid=created.stdout.strip();p=subprocess.run(['docker','start','-a',cid],capture_output=True);(out/'stdout.bin').write_bytes(p.stdout);(out/'stderr.bin').write_bytes(p.stderr)
 inspect=subprocess.run(['docker','inspect',cid],capture_output=True,text=True);(out/'inspect.json').write_text(inspect.stdout,encoding='utf-8');x=json.loads(inspect.stdout)[0]
 if x['State']['Status']!='exited':raise RuntimeError('facility_native_not_terminal')
 receipt={'argv':command,'cid':cid,'exit_code':x['State']['ExitCode'],'wall_seconds':time.perf_counter()-start};save(out/'native.json',receipt)
 with zipfile.ZipFile(out/'originals.zip','x',zipfile.ZIP_DEFLATED) as z:
  for folder,prefix in [(program,'program'),(out,'execution')]+[(path,'mount'+target.replace('/','_')) for path,target,_ in mounts]:
   if folder.is_file():z.write(folder,prefix+'/'+folder.name);continue
   for f in folder.rglob('*'):
    if f.is_file() and f.name!='originals.zip':z.write(f,prefix+'/'+f.relative_to(folder).as_posix())
 removed=subprocess.run(['docker','rm',cid],capture_output=True,text=True);save(out/'cleanup.json',{'cid':cid,'exit_code':removed.returncode,'stdout':removed.stdout,'stderr':removed.stderr})
 if removed.returncode:raise RuntimeError('facility_native_cleanup')
 return receipt['exit_code']
def copy_program(submission,out):
 out.mkdir();declaration=load(submission/'submission.json')
 if set(declaration)!={'files','lab_argv','grade_argv','deliver_argv'}:raise ValueError('submission_schema')
 for name in declaration['files']:
  p=submission/name
  if Path(name).is_absolute() or '..' in Path(name).parts or not p.resolve().is_relative_to(submission.resolve()) or not p.is_file():raise ValueError('source_path_invalid')
  q=out/name;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(p.read_bytes())
 save(out/'submission.json',declaration);return declaration
def variants(public,out):
 out.mkdir();result={}
 for name in ('base','amount_change','new_tenant'):
  raw=out/name;shutil.copytree(public/'source',raw);shutil.copy2(public/'course-contract.json',raw/'course-contract.json')
  if name=='amount_change':
   with (raw/'week1.csv').open(encoding='utf-8',newline='') as f:r=csv.DictReader(f);fields=r.fieldnames;data=list(r)
   for x in data:
    if x['tenant']=='North' and x['order_id']=='O1':x['amount']='19.75'
   with (raw/'week1.csv').open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(reversed(data))
   # The exact repeated wire in W3 must remain an exact transport replay of the changed source.
   with (raw/'week3.csv').open(encoding='utf-8',newline='') as f:r=csv.DictReader(f);data=list(r)
   for x in data:
    if x['tenant']=='North' and x['event_id']=='E1':x['amount']='19.75'
   with (raw/'week3.csv').open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(data)
  if name=='new_tenant':
   with (raw/'week1.csv').open('a',encoding='utf-8',newline='') as f:f.write('West-E1,West,E1,O1,1,2026-01-01T00:00:00Z,active,31.25,USD\n')
   with (raw/'week4.csv').open('a',encoding='utf-8',newline='') as f:f.write('West-old,West,late,O1,0,2025-12-31T00:00:00Z,active,999,USD\n')
   c=load(raw/'course-contract.json');c['principals']['west_reader']={'role':'tenant','tenant':'West'};save(raw/'course-contract.json',c)
  result[name]=raw
 return result
def labs(program,declaration,raw,root,route):
 root.mkdir();state=root/'state';state.mkdir();codes={}
 for lab in range(1,7):
  data=root/f'packet{lab}';packet(raw,lab,data)
  if lab==3:
   out=root/'lab3-commit-exit';codes['crash']=native(program,out,[*declaration['lab_argv'],'--data','/packet','--state','/state','--out','/results/result','--route',route,'--crash-after-commit'],[(data,'/packet',True),(state,'/state',False)])
  out=root/f'lab{lab}';codes[str(lab)]=native(program,out,[*declaration['lab_argv'],'--data','/packet','--state','/state','--out','/results/result','--route',route],[(data,'/packet',True),(state,'/state',False)])
 seed=root/'lab3-commit-exit/result/checkpoint.json';restored=root/'restored-state';restored.mkdir()
 if seed.is_file():codes['restore']=native(program,root/'restored-lab4',[*declaration['lab_argv'],'--data','/packet','--state','/state','--out','/results/result','--route',route,'--restore','/seed/checkpoint.json'],[(root/'packet4','/packet',True),(restored,'/state',False),(seed.parent,'/seed',True)])
 else:codes['restore']=None
 # A behavior collection is a projection of actual captured results, not a second state source.
 collected=root/'collection';collected.mkdir();save(collected/'collection.json',{'native_codes':codes,'route':route})
 for name in [f'lab{i}' for i in range(1,7)]+['lab3-commit-exit','restored-lab4']:
  if (root/name/'result').is_dir():
   shutil.copytree(root/name/'result',collected/name);original=load(root/name/'native.json');argv=original['argv'];save(collected/name/'actual-native.json',{'argv':argv[argv.index(IMAGE)+1:],'exit_code':original['exit_code'],'wall_seconds':original['wall_seconds'],'scope':'sanitized actual native receipt projection; original immutable inspect/argv is evaluator side'})
 return collected
def run(submission,public,students,out):
 out.mkdir();program=out/'sealed-program';d=copy_program(submission,program);raws=variants(public,out/'raw');registry={};keys={}
 for variant,raw in raws.items():
  root=out/variant;root.mkdir();routes={}
  for route in ('guided','challenge'):routes[route]=str(labs(program,d,raw,root/route,route).resolve())
  grades={};keys[variant]={};grading=root/'grading';grading.mkdir()
  for student in sorted(students.iterdir()):
   if not student.is_dir():continue
   target=grading/student.name;rc=native(program,target,[*d['grade_argv'],'--student','/student','--data','/raw','--out','/results/result'],[(student,'/student',True),(raw,'/raw',True)])
   grades[student.name]={'native_exit':rc,'root':str(target.resolve()),'student':str(student.resolve())}
   actual_work=target/'result/actual-work'
   if actual_work.is_dir():keys[variant][student.name]=evaluate(raw,actual_work)
  # Only original execution/grade results enter the frozen reporter, not benchmark keys/weights.
  evidence=root/'report-evidence';evidence.mkdir()
  for route,path in routes.items():shutil.copytree(Path(path),evidence/route)
  for name,g in grades.items():
   path=Path(g['root'])/'result/grade.json'
   if path.is_file():(evidence/(name+'-grade.json')).write_bytes(path.read_bytes())
  report=root/'delivery';rc=native(program,report,[*d['deliver_argv'],'--source','/raw','--evidence','/evidence','--out','/results/result'],[(raw,'/raw',True),(evidence,'/evidence',True)])
  registry[variant]={'raw':str(raw.resolve()),'routes':routes,'grades':grades,'delivery':str(report.resolve()),'delivery_native':rc}
  save(out/'runs.json',{'runs':registry,'sealed_program':str(program.resolve())});save(out/'ground-truth-qualification.json',{'role':'author_qualification_pending_independent_reconstruction','values':keys,'limits':'These keys derive from actual constructed student work; must be independently checked/frozen, not candidate self-rating.'})
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--submission',required=True,type=Path);p.add_argument('--public',required=True,type=Path);p.add_argument('--students',required=True,type=Path);p.add_argument('--out',required=True,type=Path);a=p.parse_args();run(a.submission,a.public,a.students,a.out)
