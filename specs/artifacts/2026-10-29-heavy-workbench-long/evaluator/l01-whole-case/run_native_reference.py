"""Continue the original unexecuted author cells on the user's native runtime."""
from pathlib import Path
import argparse,datetime,json,os,shutil,subprocess,time,uuid,zipfile
import numpy as np

def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(p,x):p.write_text(json.dumps(x,indent=2,allow_nan=False)+'\n',encoding='utf-8')

def main():
    p=argparse.ArgumentParser();p.add_argument('--python',type=Path,required=True);p.add_argument('--project',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--locator',type=Path,required=True);a=p.parse_args()
    a.out.mkdir(parents=True,exist_ok=False);project=a.project.resolve();results=project/'work/results'
    original=json.loads((results/'manifest.json').read_text());first=next(v for v in original['runs'] if v['config_id']=='convection-lbfgs-s345-lrnone')
    if first['status']!='max_updates' or first['phases']['lbfgs']['accepted_updates']!=41000:raise ValueError('original completed first cell must be retained')
    if any(v['status'] not in ('incomplete','dependency_incomplete') for v in original['runs'] if v['config_id']!=first['config_id']):raise ValueError('unexpected additional completed cells; inspect original run before a new owner')
    save(a.out/'original-first-record.json',first);old_arrays={k:v.copy() for k,v in np.load(project/first['checkpoints']['final'],allow_pickle=False).items()}
    shutil.copy2(Path(__file__),a.out/'owner-source.py')
    with zipfile.ZipFile(a.out/'pre-execution-source.zip','w',zipfile.ZIP_DEFLATED) as z:
        for f in sorted(project.rglob('*')):
            if f.is_file() and not f.is_relative_to(project/'work'):z.write(f,f.relative_to(project).as_posix())
    freeze=subprocess.run([str(a.python),'-m','pip','freeze'],capture_output=True,text=True,encoding='utf-8');save(a.out/'runtime-packages.json',{'argv':[str(a.python),'-m','pip','freeze'],'exit_code':freeze.returncode,'stdout':freeze.stdout,'stderr':freeze.stderr})
    argv=[str(a.python),'-u','-B',str(project/'run_study.py'),'--inputs',str(project/'inputs'),'--output',str(results),'--device','cuda','--continue-study']
    env={k:os.environ[k] for k in ('SystemRoot','WINDIR','PATH','TEMP','TMP') if k in os.environ}
    env.update(OMP_NUM_THREADS='4',MKL_NUM_THREADS='4',OPENBLAS_NUM_THREADS='4',CUDA_VISIBLE_DEVICES='0',PYTHONNOUSERSITE='1',PYTHONIOENCODING='utf-8')
    started=now();timer=time.perf_counter();execution_id='native-'+uuid.uuid4().hex
    with (a.out/'stdout.txt').open('wb') as stdout,(a.out/'stderr.txt').open('wb') as stderr:
        child=subprocess.Popen(argv,cwd=project,stdout=stdout,stderr=stderr,env=env,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        context={'format':'l01-controlled-execution/2','execution_id':execution_id,'backend':'windows-native','pid':child.pid,'pid_scope':'native Windows process','owner_pid':os.getpid(),'project_root':str(project),'argv':argv,'started_at':started,'finished_at':None,'state':{'status':'running','exit_code':None},'scope':'native local source-only continuation, first original Linux cell retained; no OS/network confinement claim'}
        context['runtime_limits']={k:env[k] for k in ('OMP_NUM_THREADS','MKL_NUM_THREADS','OPENBLAS_NUM_THREADS','CUDA_VISIBLE_DEVICES','PYTHONNOUSERSITE')}
        save(a.out/'execution-started.json',context);save(a.out/'owner-started.json',{'at':started,'pid':os.getpid(),'argv':__import__('sys').argv,'child_pid':child.pid})
        active=results.parents[2]/'author-study/active.json';save(active,{'at':started,'stage':'native-remaining-registered-cells','pid':child.pid,'owner_pid':os.getpid(),'argv':argv,'evidence_root':str(a.out),'scope':'native user-authorized continuation; no prior cell rerun'})
        locator=json.loads(a.locator.read_text());locator.update(at=started,phase='native_remaining_registered_cells_running',owner_pid=os.getpid(),native_pid=child.pid,native_evidence=str(a.out),environment_block=None);save(a.locator,locator)
        code=child.wait()
    context.update(finished_at=now(),state={'status':'exited','exit_code':code},seconds=time.perf_counter()-timer);save(a.out/'execution.json',context)
    after=json.loads((results/'manifest.json').read_text());retained=next(v for v in after['runs'] if v['config_id']==first['config_id'])
    arrays=np.load(project/first['checkpoints']['final'],allow_pickle=False)
    same=retained==first and set(arrays.files)==set(old_arrays) and all(np.array_equal(arrays[k],v) for k,v in old_arrays.items())
    save(a.out/'first-retained.json',{'original_record_equal':retained==first,'actual_original_arrays_equal':same,'original_accepted_updates':41000})
    with zipfile.ZipFile(a.out/'native-originals.zip','w',zipfile.ZIP_DEFLATED) as z:
        for f in sorted(a.out.iterdir()):
            if f.is_file() and f.name!='native-originals.zip':z.write(f,f.name)
        for f in sorted(results.rglob('*')):
            if f.is_file():z.write(f,'results/'+f.relative_to(results).as_posix())
    save(a.out/'owner-terminal.json',{'at':now(),'native_exit':code,'first_retained':same,'scope':'actual native completion only; quality/full study review not certified'})
    locator.update(at=now(),phase='native_reference_terminal_review_pending' if code==0 and same else 'native_reference_failed_originals_preserved',owner_pid=None,native_pid=None);save(a.locator,locator)
    save(active,{'at':now(),'stage':None,'pid':None,'evidence_root':str(a.out),'native_exit':code,'first_retained':same})
    return 0 if code==0 and same else 2
if __name__=='__main__':raise SystemExit(main())
