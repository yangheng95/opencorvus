from pathlib import Path
import subprocess,json,datetime,os,time
root=Path(__file__).resolve().parent;source=root/'source';registration=json.loads((root/'registration.json').read_text());pool=Path(registration['pool_registration']).parent;facts=json.loads((pool/'input-generation.json').read_text());results=[]
for item in facts['results']:
 label=item['registration']['label'];inputs=root/'inputs'/label;out=root/'outputs'/label;out.parent.mkdir(exist_ok=True)
 mapping={'model':str(inputs/Path(item['model']['model']).name),'raw_archive':str(inputs/Path(item['raw']).name),'instance':label,'out':str(out),'optimization_seconds':'180'}
 argv=[arg.format(**mapping) for arg in registration['manifest']['argv']];start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.perf_counter()
 with (root/(label+'.stdout.txt')).open('wb') as stdout,(root/(label+'.stderr.txt')).open('wb') as stderr:
  child=subprocess.Popen(argv,cwd=source,stdout=stdout,stderr=stderr);(root/(label+'.started.json')).write_text(json.dumps({'started_at':start,'argv':argv,'cwd':str(source),'wrapper_pid':os.getpid(),'launcher_pid':child.pid,'pid_scope':'Windows venv launcher; actual interpreter as candidate execution.json'},indent=2)+'\n');code=child.wait()
 record={'label':label,'native_exit':code,'started_at':start,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wrapper_seconds':time.perf_counter()-t,'output':str(out)};results.append(record);(root/(label+'.terminal.json')).write_text(json.dumps(record,indent=2)+'\n')
(root/'owner-terminal.json').write_text(json.dumps({'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results,'candidate_business_grade':None,'scope':'actual first source-only executions of captured original programme, no source repair/substitute'},indent=2)+'\n');print(json.dumps(results))
