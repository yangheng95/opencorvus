"""Explicitly continue only remaining registered cells, after environment returns."""
from pathlib import Path
import subprocess,json,datetime,time,zipfile,os,traceback
ROOT=Path(__file__).resolve().parent;P=ROOT/'author-project';STUDY=ROOT/'author-study';C=STUDY/'remaining-registered-cells'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def run(argv):
 t=time.perf_counter();p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8',errors='replace');return {'argv':argv,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'seconds':time.perf_counter()-t,'finished_at':now()}
def put(p,v):p.write_text(json.dumps(v,indent=2)+'\n')
def main():
 env=run(['docker','info','--format','{{.ServerVersion}}']);put(ROOT/'continuation-environment-check.json',env)
 if env['exit_code']!=0:print(json.dumps({'started':False,'error':'docker_engine_unavailable','action':'no Docker or WSL restart attempted'}));return 3
 first=json.loads((STUDY/'first-registered-cell/native-terminal.json').read_text());repair=json.loads((ROOT/'publication-repair/repair-terminal.json').read_text());assert first['native_exit']==0 and repair['artifact_exit']==0
 C.mkdir(exist_ok=False)
 put(C/'owner-started.json',{'at':now(),'pid':os.getpid(),'argv':__import__('sys').argv,'source_amendment':str(ROOT/'publication-repair/amended-source-final.zip'),'first_segment_source':str(STUDY/'pre-execution-source.zip'),'scope':'only pending original registered cells, first41000 retained; explicit different publication-source version, no hotpatch'})
 with zipfile.ZipFile(C/'pre-execution-source.zip','w',zipfile.ZIP_DEFLATED) as z:
  for p in sorted(P.rglob('*')):
   if p.is_file() and not p.is_relative_to(P/'work'):z.write(p,p.relative_to(P).as_posix())
 argv=['docker','create','--name','oc-l01-author-remaining-20261031-a','--network','none','--gpus','all','--cpus','4','--mount',f'type=bind,source={P},target=/project,readonly','--mount',f'type=bind,source={P/"work"},target=/project/work','sha256:366454c0a7b7f023131af29ec68696859c8d39f1a1b2a3a61e32c35ff03ae9dc','python','-u','-B','/project/run_study.py','--inputs','/project/inputs','--output','/project/work/results','--device','cuda','--continue-study']
 try:
  create=run(argv);put(C/'create.json',create);assert create['exit_code']==0;cid=create['stdout'].strip()
  put(STUDY/'active.json',{'at':now(),'stage':'remaining-registered-cells','cid':cid,'owner_pid':os.getpid(),'project':str(P),'results':str(P/'work/results'),'actual_argv':argv,'scope':'original pending cells after explicit metadata-source amendment'})
  put(C/'start.json',run(['docker','start','-a',cid]));inspect=run(['docker','inspect',cid]);put(C/'inspect.json',inspect);put(C/'logs.json',run(['docker','logs',cid]));state=json.loads(inspect['stdout'])[0]['State'];assert not state['Running']
  with zipfile.ZipFile(C/'segment-native-originals.zip','w',zipfile.ZIP_DEFLATED) as z:
   for p in C.iterdir():
    if p.is_file() and p.name!='segment-native-originals.zip':z.write(p,p.name)
   for p in sorted((P/'work/results').rglob('*')):
    if p.is_file():z.write(p,'results/'+p.relative_to(P/'work/results').as_posix())
  put(C/'cleanup.json',run(['docker','rm',cid]));put(C/'native-terminal.json',{'at':now(),'native_exit':state['ExitCode']})
  if state['ExitCode']!=0:raise RuntimeError('remaining segment native failed; no repeat/replacement')
  argv=['C:/Python314/python.exe','-X','utf8','-B','D:/myhexin-local/opencorvus/script/benchmark/pinn_submission_check.py','--root',str(P),'--profile',str(P/'inputs/profile.json'),'--manifest','work/results/manifest.json','--out',str(C/'artifact-assessment.json')]
  result=run(argv);put(C/'artifact-command.json',result)
  if result['exit_code']!=0:raise RuntimeError('remaining segment artifact failure; preserve original outputs')
  put(C/'owner-terminal.json',{'at':now(),'native_exit':0,'artifact_exit':0,'scope':'execution complete only; not independent review/quality/frozen score'})
  put(STUDY/'active.json',{'at':now(),'stage':None,'cid':None,'meaning':'all requested native segments terminal; whole-case review pending'})
  return 0
 except Exception as e:
  put(C/'owner-error.json',{'at':now(),'error':str(e),'traceback':traceback.format_exc(),'action':'preserve original source/results; no automatic restart or new matrix'});raise
if __name__=='__main__':raise SystemExit(main())
