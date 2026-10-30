from pathlib import Path
import subprocess,json,shutil,zipfile,time,datetime
ROOT=Path(__file__).resolve().parent;REPO=Path('D:/myhexin-local/opencorvus');CASE=REPO/'specs/artifacts/2026-10-29-heavy-workbench-long';CONTROL=ROOT/'counting-error-native';CONTROL.mkdir(exist_ok=False);PROJECT=ROOT/'counting-error-project'
def run(argv):
    t=time.perf_counter();p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8',errors='replace');return {'argv':argv,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'seconds':time.perf_counter()-t}
def put(name,v):(CONTROL/name).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
r=run(['C:/Python314/python.exe','-X','utf8','-B',str(CASE/'evaluator/l01-whole-case/build_reference.py'),'--repo',str(REPO),'--out',str(PROJECT)]);put('build.json',r);assert r['exit_code']==0
shutil.copy2(PROJECT/'run_study.py',PROJECT/'correct_driver_support.py');shutil.copy2(ROOT/'counting_error_programme.py',PROJECT/'run_study.py');(PROJECT/'work').mkdir()
with zipfile.ZipFile(CONTROL/'source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(PROJECT.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(PROJECT).as_posix())
argv=['docker','create','--name','oc-l01-counting-error-20261031-a','--network','none','--cpus','1','--mount',f'type=bind,source={PROJECT},target=/project,readonly','--mount',f'type=bind,source={PROJECT/"work"},target=/project/work','sha256:366454c0a7b7f023131af29ec68696859c8d39f1a1b2a3a61e32c35ff03ae9dc','python','-u','-B','/project/run_study.py','--inputs','/project/inputs','--output','/project/work/results','--device','cpu','--only','convection-lbfgs-s345-lrnone']
r=run(argv);put('create.json',r);assert r['exit_code']==0;cid=r['stdout'].strip();r=run(['docker','start','-a',cid]);put('start.json',r)
i=run(['docker','inspect',cid]);put('inspect.json',i);put('logs.json',run(['docker','logs',cid]));native=json.loads(i['stdout'])[0]['State'];assert native['Running'] is False
with zipfile.ZipFile(CONTROL/'execution.zip','w',zipfile.ZIP_DEFLATED) as z:
    for name in ('create.json','start.json','inspect.json','logs.json'):z.write(CONTROL/name,name)
    for p in sorted((PROJECT/'work/results').rglob('*')):
        if p.is_file():z.write(p,'results/'+p.relative_to(PROJECT/'work/results').as_posix())
put('cleanup.json',run(['docker','rm',cid]));put('terminal.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'native_exit':native['ExitCode'],'scope':'one actual CPU method/count error control, no full CUDA matrix or positive research result'})
assert native['ExitCode']==0,native
out=CONTROL/'whole-checker-prepare';argv=['C:/Python314/python.exe','-X','utf8','-B',str(CASE/'evaluator/l01-whole-case/check_l01.py'),'prepare','--source',str(CONTROL/'source.zip'),'--execution',str(CONTROL/'execution.zip'),'--profile',str(CASE/'public/profile.json'),'--rubric',str(CASE/'rubric.draft.json'),'--targets',str(CASE/'public/quality-policy.draft.json'),'--subject-id','L01-real-counting-error-20261031','--role','error_control','--scope','partial','--out',str(out)]
result=run(argv);put('whole-checker-command.json',result)
print(json.dumps({'native_exit':native['ExitCode'],'checker_exit':result['exit_code'],'stdout':result['stdout'],'stderr':result['stderr']}))
raise SystemExit(0 if result['exit_code']==4 else 1)
