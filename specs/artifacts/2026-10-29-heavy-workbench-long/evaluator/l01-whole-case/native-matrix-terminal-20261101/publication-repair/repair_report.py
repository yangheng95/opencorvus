"""Complete the original failed report stage; retain its failed native capsule."""
from pathlib import Path
import datetime,json,os,shutil,subprocess,time,zipfile

ROOT=Path('D:/opencorvus-benchmark-runs/l01-full-case-20261031')
PROJECT=ROOT/'author-project'
CASE=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/evaluator/l01-whole-case')
OUT=ROOT/'report-publication-repair'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(name,value):(OUT/name).write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8')
original=json.loads((ROOT/'author-study/native-remaining-registered-cells/execution.json').read_text())
assert original['state']=={'status':'exited','exit_code':1}
with zipfile.ZipFile(ROOT/'author-study/native-remaining-registered-cells/pre-execution-source.zip') as z:
    assert (PROJECT/'finish_study.py').read_bytes()==z.read('finish_study.py')
shutil.copyfile(PROJECT/'finish_study.py',OUT/'finish_study.before.py')
shutil.copyfile(CASE/'reference-source/finish_study.py',PROJECT/'finish_study.py')
with zipfile.ZipFile(OUT/'report-repair-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in sorted(PROJECT.rglob('*')):
        if f.is_file() and not f.is_relative_to(PROJECT/'work'):z.write(f,f.relative_to(PROJECT).as_posix())
config=PROJECT/'work/matplotlib-config';config.mkdir(exist_ok=True)
env={k:os.environ[k] for k in ('SystemRoot','WINDIR','PATH','TEMP','TMP') if k in os.environ}
env.update(MPLCONFIGDIR=str(config),OMP_NUM_THREADS='4',MKL_NUM_THREADS='4',OPENBLAS_NUM_THREADS='4',CUDA_VISIBLE_DEVICES='0',PYTHONNOUSERSITE='1',PYTHONIOENCODING='utf-8')
argv=['D:/opencorvus-benchmark-runs/native-science-l01-20261031/Scripts/python.exe','-u','-B',str(PROJECT/'finish_study.py'),'--project',str(PROJECT),'--inputs',str(PROJECT/'inputs'),'--output',str(PROJECT/'work/results'),'--analysis',str(PROJECT/'work/results/analysis-segments/18416')]
started=now();t=time.perf_counter()
save('started.json',{'at':started,'argv':argv,'original_execution':original,'environment':{k:env[k] for k in ('MPLCONFIGDIR','OMP_NUM_THREADS','MKL_NUM_THREADS','OPENBLAS_NUM_THREADS','CUDA_VISIBLE_DEVICES','PYTHONNOUSERSITE')},'scope':'same minimal native environment plus owned Matplotlib configuration directory; report stage only'})
with (OUT/'stdout.txt').open('wb') as stdout,(OUT/'stderr.txt').open('wb') as stderr:
    p=subprocess.run(argv,cwd=PROJECT,env=env,stdout=stdout,stderr=stderr,creationflags=subprocess.CREATE_NO_WINDOW)
save('terminal.json',{'started_at':started,'finished_at':now(),'argv':argv,'native_exit':p.returncode,'seconds':time.perf_counter()-t,'original_native_exit':1,'scope':'delivery repair only; no original native success or cold retraining claim'})
print(json.dumps({'native_exit':p.returncode,'seconds':time.perf_counter()-t,'terminal':str(OUT/'terminal.json')}))
raise SystemExit(p.returncode)
