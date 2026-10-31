from pathlib import Path
import json,subprocess,shutil,zipfile,time,datetime
ROOT=Path(__file__).resolve().parent;P=ROOT/'author-project';C=ROOT/'publication-repair';C.mkdir(exist_ok=False)
REPO=Path('D:/myhexin-local/opencorvus');S=REPO/'specs/artifacts/2026-10-29-heavy-workbench-long/evaluator/l01-whole-case/reference-source/run_study.py'
def put(name,x):(C/name).write_text(json.dumps(x,indent=2)+'\n')
def run(argv):
 t=time.perf_counter();p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8',errors='replace');return {'argv':argv,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'seconds':time.perf_counter()-t}
original=json.loads((ROOT/'author-study/first-registered-cell/native-terminal.json').read_text());assert original['native_exit']==0
shutil.copy2(P/'run_study.py',C/'original-run_study.py');shutil.copy2(P/'work/results/manifest.json',C/'original-manifest.json');shutil.copy2(S,P/'run_study.py')
with zipfile.ZipFile(C/'amended-source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(P.rglob('*')):
  if p.is_file() and not p.is_relative_to(P/'work'):z.write(p,p.relative_to(P).as_posix())
argv=['docker','create','--name','oc-l01-publication-repair-20261031-a','--network','none','--cpus','1','--mount',f'type=bind,source={P},target=/project,readonly','--mount',f'type=bind,source={P/"work"},target=/project/work','sha256:366454c0a7b7f023131af29ec68696859c8d39f1a1b2a3a61e32c35ff03ae9dc','python','-u','-B','/project/run_study.py','--inputs','/project/inputs','--output','/project/work/results','--device','cpu','--close-segment']
c=run(argv);put('create.json',c);assert c['exit_code']==0;cid=c['stdout'].strip();start=run(['docker','start','-a',cid]);put('start.json',start);i=run(['docker','inspect',cid]);put('inspect.json',i);put('logs.json',run(['docker','logs',cid]));state=json.loads(i['stdout'])[0]['State'];assert not state['Running']
with zipfile.ZipFile(C/'metadata-native-originals.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in ('create.json','start.json','inspect.json','logs.json'):z.write(C/name,name)
 for p in (P/'work/results/metadata-close').iterdir():z.write(p,'metadata-close/'+p.name)
put('cleanup.json',run(['docker','rm',cid]));assert state['ExitCode']==0,state
a=run(['C:/Python314/python.exe','-X','utf8','-B',str(REPO/'script/benchmark/pinn_submission_check.py'),'--root',str(P),'--manifest','work/results/manifest.json','--profile',str(P/'inputs/profile.json'),'--out',str(C/'artifact-assessment.json')]);put('artifact-command.json',a);assert a['exit_code']==0,a
before=json.loads((C/'original-manifest.json').read_text());after=json.loads((P/'work/results/manifest.json').read_text());changes=[]
for old,new in zip(before['runs'],after['runs']):
 if old!=new:
  assert old['status']=='incomplete' and new['status']=='dependency_incomplete' and {k:v for k,v in old.items() if k not in ('status','reason')}=={k:v for k,v in new.items() if k not in ('status','reason')}
  changes.append(old['config_id'])
assert len(changes)==5 and before['solution_checkpoints']==after['solution_checkpoints']
put('repair-terminal.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'native_exit':0,'artifact_exit':0,'changed_dependencies':changes,'completed_training_records_preserved':True,'scope':'actual metadata-only producer repair; original first native remains its original source and facts; following segment uses explicitly amended source'})
print(json.dumps({'repair_native':0,'original_artifact_now':0,'changed_dependencies':len(changes)}))
