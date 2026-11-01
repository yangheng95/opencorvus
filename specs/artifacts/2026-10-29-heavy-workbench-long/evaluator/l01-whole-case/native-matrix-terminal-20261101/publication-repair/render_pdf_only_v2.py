from pathlib import Path
import datetime,json,os,shutil,subprocess,time,zipfile
ROOT=Path('D:/opencorvus-benchmark-runs/l01-full-case-20261031');P=ROOT/'author-project';R=ROOT/'report-publication-repair'
SOURCE=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/evaluator/l01-whole-case/reference-source/finish_study.py')
shutil.copyfile(P/'finish_study.py',R/'finish_study.pdf-v2.py')
shutil.copyfile(P/'work/results/paper.pdf',R/'paper.v2.pdf')
shutil.copyfile(SOURCE,P/'finish_study.py')
with zipfile.ZipFile(R/'pdf-final-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in sorted(P.rglob('*')):
        if f.is_file() and not f.is_relative_to(P/'work'):z.write(f,f.relative_to(P).as_posix())
env={k:os.environ[k] for k in ('SystemRoot','WINDIR','PATH','TEMP','TMP') if k in os.environ}
env.update(MPLCONFIGDIR=str(P/'work/matplotlib-config'),OMP_NUM_THREADS='4',MKL_NUM_THREADS='4',OPENBLAS_NUM_THREADS='4',CUDA_VISIBLE_DEVICES='0',PYTHONNOUSERSITE='1',PYTHONIOENCODING='utf-8')
argv=['D:/opencorvus-benchmark-runs/native-science-l01-20261031/Scripts/python.exe','-u','-B',str(P/'finish_study.py'),'--project',str(P),'--inputs',str(P/'inputs'),'--output',str(P/'work/results'),'--analysis',str(P/'work/results/analysis-segments/18416'),'--pdf-only']
started=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.perf_counter()
with (R/'pdf-final.stdout.txt').open('wb') as stdout,(R/'pdf-final.stderr.txt').open('wb') as stderr:
    result=subprocess.run(argv,cwd=P,env=env,stdout=stdout,stderr=stderr,creationflags=subprocess.CREATE_NO_WINDOW)
receipt={'argv':argv,'started_at':started,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'native_exit':result.returncode,'seconds':time.perf_counter()-t,'scope':'PDF layout only; no redraw, structural control, training, numerical or recovery computation'}
(R/'pdf-final-terminal.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8');print(json.dumps(receipt))
raise SystemExit(result.returncode)

