"""Source-only full-case execution. This module never repairs candidate programmes."""
import argparse,json,shutil,subprocess,sys,uuid,time,sqlite3
from pathlib import Path
from l10_core import read,save,authority
from l10_episode import IMAGE
def native(source,out,argv,mounts):
 out.mkdir(parents=True);name='oc-l10-native-'+uuid.uuid4().hex[:16];cmd=['docker','create','--name',name,'--network','none','--cpus','1','--mount',f'type=bind,src={source.resolve()},dst=/program,readonly','--mount',f'type=bind,src={out.resolve()},dst=/results','--workdir','/program']
 for src,dst in mounts:cmd+=['--mount',f'type=bind,src={src.resolve()},dst={dst},readonly']
 cmd+=[IMAGE,*argv];cid=subprocess.check_output(cmd,text=True).strip();save(out/'launch.json',{'argv':cmd,'cid':cid})
 p=subprocess.run(['docker','start','--attach',cid],capture_output=True,text=True,encoding='utf-8');(out/'stdout.txt').write_text(p.stdout,encoding='utf-8');(out/'stderr.txt').write_text(p.stderr,encoding='utf-8');ins=json.loads(subprocess.check_output(['docker','inspect',cid],text=True))[0];save(out/'terminal-inspect.json',ins)
 if ins['State']['Status']=='exited':subprocess.run(['docker','rm',cid],check=True,capture_output=True)
 return ins['State']['ExitCode']
def cleanup_fault(root):
 """Only the exact already-recorded actor from our deliberate owner exit."""
 cid=read(root/'initial/create.json')['cid'];code=int(subprocess.check_output(['docker','wait',cid],text=True).strip());obj=json.loads(subprocess.check_output(['docker','inspect',cid],text=True))[0];save(root/'initial/terminal-inspect.json',obj)
 (root/'initial/stdout-docker-log.txt').write_text(subprocess.check_output(['docker','logs',cid],stderr=subprocess.STDOUT,text=True,encoding='utf-8'),encoding='utf-8')
 if obj['State']['Status']=='exited':subprocess.run(['docker','rm',cid],check=True,capture_output=True)
 return code
def run(submission,raw,cases,out):
 submission=submission.resolve()
 for p in submission.rglob('*'):
  if not p.resolve().is_relative_to(submission):raise ValueError('programme_path_outside_submission')
 out.mkdir();program=out/'sealed-program';shutil.copytree(submission,program);manifest=read(program/'submission.json');start=time.monotonic();facts=authority(raw)
 modelroot=out/'prepare';code=native(program,modelroot,[*manifest['prepare_argv'],'--data','/raw','--out','/results/model'],[(raw,'/raw')]);save(out/'prepare-native.json',{'exit_code':code})
 if code!=0:return 2
 caseslist=sorted(cases.glob('*.json'));registry=[]
 for casefile in caseslist:
  case=read(casefile)
  for site in sorted(facts['sites']):
   for device in sorted(facts['devices']):
    target=out/'episodes'/casefile.stem/site/device;argv=[sys.executable,'-X','utf8','-B',str(Path(__file__).with_name('l10_episode.py')),'--source',str(program),'--raw',str(raw),'--model',str(modelroot/'model'),'--case',str(casefile),'--site',site,'--device',device,'--out',str(target)]
    fault=casefile.stem=='nominal' and site=='CLINIC' and device=='S8';cmd=argv+(['--crash-step','45'] if fault else [])
    p=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8');record={'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'expected_exit':73 if fault else 0};save(target/'owner-initial.json',record)
    if fault and p.returncode==73:
     cleanup_fault(target);p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');save(target/'owner-resume.json',{'argv':argv,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
    registry.append({'scenario':casefile.stem,'probability':case['probability'],'site':site,'device':device,'root':str(target.resolve()),'exit_code':p.returncode,'fault':fault});save(out/'runs.json',{'episodes':registry,'source':str(program.resolve()),'raw':str(raw.resolve()),'cases':str(cases.resolve())})
    if p.returncode!=0:save(out/'execution-status.json',{'execution_complete':False,'failed':registry[-1]});return 2
 # Reporter only sees completed original results after all policies executed.
 evidence=out/'report-evidence';evidence.mkdir();save(evidence/'authority.json',facts);runs=[]
 for r in registry:
  result=read(Path(r['root'])/'result.json');result.pop('bill')
  with sqlite3.connect((Path(r['root'])/'plant.sqlite3').resolve().as_uri()+'?mode=ro',uri=True) as db:telemetry=[json.loads(row[0])['current'] for row in db.execute('select packet from step order by i')]
  runs.append({**{k:r[k] for k in ['scenario','probability','site','device']},**result,'telemetry':telemetry})
 save(evidence/'results.json',{'episodes':runs});rc=native(program,out/'delivery',[*manifest['report_argv'],'--data','/raw','--evidence','/evidence','--out','/results/result'],[(raw,'/raw'),(evidence,'/evidence')]);save(out/'execution-status.json',{'execution_complete':rc==0,'report_exit':rc,'seconds':time.monotonic()-start,'episodes':len(registry),'role':'reference_or_candidate_as_assigned; not effective-hours evidence'})
 return 0 if rc==0 else 2
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--submission',type=Path,required=True);p.add_argument('--raw',type=Path,required=True);p.add_argument('--cases',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();raise SystemExit(run(a.submission,a.raw,a.cases,a.out))
