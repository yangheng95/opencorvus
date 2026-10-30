"""Thin L08 source-only native execution; no model calls or scheduling framework."""
import argparse,json,os,shutil,subprocess,time,zipfile
from pathlib import Path
from datetime import datetime,timezone
from l08_core import load,save,Facility
IMAGE='sha256:23ff8bfbf8055caa0b9fa5745ddb27cceea2f31d7d15b7a900c81112cdfe8ddf'
def now():return datetime.now(timezone.utc).isoformat()
def native(source,raw,out,argv,label):
 out.mkdir();name='oc-l08-'+label+'-'+str(time.time_ns());cmd=['docker','create','--name',name,'--network','none','--cpus','1','--mount',f'type=bind,source={source.resolve()},target=/program,readonly','--mount',f'type=bind,source={raw.resolve()},target=/raw,readonly','--mount',f'type=bind,source={out.resolve()},target=/results','-w','/program',IMAGE,*argv,'--source','/raw','--out','/results/result']
 started=now();clock=time.perf_counter();create=subprocess.run(cmd,capture_output=True,text=True)
 save(out/'create.json',{'argv':cmd,'exit_code':create.returncode,'stdout':create.stdout,'stderr':create.stderr})
 if create.returncode:raise Facility('docker_create')
 cid=create.stdout.strip();p=subprocess.run(['docker','start','-a',cid],capture_output=True)
 (out/'stdout.bin').write_bytes(p.stdout);(out/'stderr.bin').write_bytes(p.stderr)
 inspect=subprocess.run(['docker','inspect',cid],capture_output=True,text=True);(out/'inspect.json').write_text(inspect.stdout,encoding='utf-8')
 info=json.loads(inspect.stdout)[0]
 if info['State']['Running']:raise Facility('native_still_running')
 receipt={'started_at':started,'finished_at':now(),'wall_seconds':time.perf_counter()-clock,'argv':cmd,'cid':cid,'exit_code':info['State']['ExitCode'],'attach_exit_code':p.returncode}
 save(out/'native.json',receipt)
 with zipfile.ZipFile(out/'originals.zip','x',zipfile.ZIP_DEFLATED) as z:
  for folder,prefix in ((source,'source'),(raw,'raw'),(out,'execution')):
   for f in folder.rglob('*'):
    if f.is_file() and f.name!='originals.zip':z.write(f,prefix+'/'+f.relative_to(folder).as_posix())
 removal=subprocess.run(['docker','rm',cid],capture_output=True,text=True);save(out/'cleanup.json',{'cid':cid,'exit_code':removal.returncode,'stdout':removal.stdout,'stderr':removal.stderr})
 if removal.returncode:raise Facility('cleanup_failed')
 return receipt
def run(submission,public,out):
 out.mkdir();sealed=out/'sealed-source';sealed.mkdir();declaration=load(submission/'submission.json')
 if set(declaration)!={'files','programme_argv','component_argv'}:raise Facility('submission_contract')
 for name in declaration['files']:
  p=Path(name)
  if p.is_absolute() or '..' in p.parts or p.as_posix()!=name:raise Facility('source_path')
  f=submission/p
  if not f.resolve().is_relative_to(submission.resolve()) or not f.is_file():raise Facility('source_path')
  target=sealed/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(f.read_bytes())
 save(sealed/'submission.json',declaration);runs={}
 for variant in ('base','future_quote','new_scope'):
  root=out/variant;root.mkdir();raw=root/'raw';shutil.copytree(public/'source',raw)
  if variant=='future_quote':
   import csv
   with (raw/'quotes.csv').open(encoding='utf-8',newline='') as f:reader=csv.DictReader(f);fields=reader.fieldnames;data=list(reader)
   for x in data:
    if x['task']=='C00':x['start_fee']=str(int(x['start_fee'])+100)
   with (raw/'quotes.csv').open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(reversed(data))
  if variant=='new_scope':
   with (raw/'scope.csv').open('a',encoding='utf-8',newline='') as f:f.write('N01,New tenant handover,H06,1\n')
   with (raw/'quotes.csv').open('a',encoding='utf-8',newline='') as f:f.write('N01,brief,1,Di,0,0,0,12\n')
   import csv
   with (raw/'scope.csv').open(encoding='utf-8',newline='') as f:r=csv.DictReader(f);fields=r.fieldnames;data=list(r)
   for x in data:
    if x['task']=='C00':x['dependencies']+=';N01'
   with (raw/'scope.csv').open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(data)
   with (raw/'release-lines.csv').open('a',encoding='utf-8',newline='') as f:f.write('S13,West,new,1,2026-01-03T00:00:00Z,active,9\n')
  component=native(sealed,raw,root/'component',declaration['component_argv'],'component-'+variant)
  programme=native(sealed,raw,root/'programme',declaration['programme_argv'],'programme-'+variant)
  runs[variant]={'raw':str(raw.resolve()),'component':str((root/'component').resolve()),'programme':str((root/'programme').resolve()),'native_component':component['exit_code'],'native_programme':programme['exit_code']}
 save(out/'runs.json',{'runs':runs,'subject_role':'author_reference_or_candidate_as_declared_externally','whole_public':str(public.resolve()),'sealed_source':str(sealed.resolve())})
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--submission',required=True,type=Path);p.add_argument('--public',required=True,type=Path);p.add_argument('--out',required=True,type=Path);a=p.parse_args();run(a.submission,a.public,a.out)
