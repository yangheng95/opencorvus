"""One case's complete source-only execution, three changes and real checker."""
import argparse,copy,json,shutil,subprocess,sys,uuid
from pathlib import Path,PurePosixPath
from datetime import datetime,timezone
from decimal import Decimal
from check import assess

class SubmissionError(ValueError):pass
def declared_source(submission,name):
    try:
        base=submission.resolve(strict=True);target=submission/name;resolved=target.resolve(strict=True)
    except OSError as e:raise SubmissionError('source_missing: '+name) from e
    if not resolved.is_relative_to(base) or target.is_symlink() or not target.is_file():
        raise SubmissionError('source_path_invalid: declared ordinary source must resolve inside submission: '+name)
    return target

def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def jsonl(path):return [json.loads(s) for s in path.read_text(encoding='utf-8').splitlines() if s.strip()]
def lines(path,values):path.write_text(''.join(json.dumps(v,ensure_ascii=False)+'\n' for v in values),encoding='utf-8')
def variants(original,run):
    result=[]
    for name in ['base','amount-change','new-period','late-correction']:
        dest=run/name/'input';shutil.copytree(original,dest)
        if name=='amount-change':
            p=dest/'documents.jsonl';v=jsonl(p)
            for r in v:
                if r['doc_id']=='I013' and r['revision']==0:r['lines'][0]['amount']=str(Decimal(r['lines'][0]['amount'])+Decimal('13.07'))
            lines(p,v)
        if name=='new-period':
            p=dest/'company.json';c=json.loads(p.read_text());c['months'].append('2025-04');save(p,c)
            p=dest/'fx.jsonl';v=jsonl(p);v.append({'source_id':'new-period-fx','currency':'CNY','rate_date':'2025-04-01','revision':0,'released_at':'2025-04-01T08:00:00Z','rate':'1.00'});lines(p,v)
            p=dest/'documents.jsonl';v=jsonl(p);v.append({'source_id':'new-period-doc','doc_id':'I-new-period','revision':0,'released_at':'2025-04-03T09:00:00Z','status':'posted','kind':'invoice','vendor':'NewVendor','department':'Engineering','currency':'CNY','rate_date':'2025-04-01','book_month':'2025-04','service_months':['2025-04'],'lines':[{'line_id':'new','amount':'317.29'}],'note':'new period source'});lines(p,v)
            p=dest/'budgets.jsonl';v=jsonl(p);v.append({'source_id':'new-period-budget','department':'Engineering','month':'2025-04','revision':0,'released_at':'2025-04-01T08:00:00Z','amount_minor':40000});lines(p,v)
        if name=='late-correction':
            p=dest/'documents.jsonl';v=jsonl(p);old=max((r for r in v if r['doc_id']=='I022' and r['released_at']<='2025-04-15T18:00:00Z'),key=lambda r:r['revision']);new=copy.deepcopy(old)
            new.update(source_id='late-correction-source',revision=old['revision']+1,released_at='2025-04-14T17:00:00Z');new['lines'][0]['amount']=str(Decimal(new['lines'][0]['amount'])+Decimal('19.23'));v.append(new);lines(p,v)
        result.append((name,dest))
    return result

def execute(submission,raw,run,image,review=None):
    run.mkdir(parents=True,exist_ok=False)
    try:manifest=json.loads((submission/'submission.json').read_text(encoding='utf-8'))
    except (OSError,ValueError) as e:raise SubmissionError('submission_manifest_invalid: readable JSON required') from e
    if type(manifest) is not dict or manifest.get('format')!='l03-submission/1' or type(manifest.get('argv')) is not list or not manifest['argv'] or any(type(x) is not str for x in manifest['argv']):raise SubmissionError('submission_manifest_invalid: declared argv required')
    if type(manifest.get('files')) is not list or not manifest['files'] or any(type(n) is not str or not n.strip() for n in manifest['files']) or len(set(manifest['files']))!=len(manifest['files']):raise SubmissionError('submission_manifest_invalid: unique ordinary declared files required')
    source=run/'source';source.mkdir()
    for name in manifest['files']:
        rel=PurePosixPath(name)
        if rel.is_absolute() or '..' in rel.parts or ':' in name or '\\' in name:raise SubmissionError('source_path_invalid: ordinary declared relative source required')
        original=declared_source(submission,name)
        path=source/name;path.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original,path)
    save(run/'source-declaration.json',manifest)
    receipts=[]
    for name,input_root in variants(raw,run):
        cell=run/name;output=cell/'output';output.mkdir();container='oc-l03-'+uuid.uuid4().hex[:16]
        argv=['docker','create','--name',container,'--cpus','1','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
            '--mount','type=bind,src='+str(source.resolve())+',dst=/project,readonly','--mount','type=bind,src='+str(input_root.resolve())+',dst=/input,readonly',
            '--mount','type=bind,src='+str(output.resolve())+',dst=/output','--tmpfs','/tmp:rw,nosuid,size=256m',
            '--env','MPLCONFIGDIR=/tmp/mpl','--env','XDG_CACHE_HOME=/tmp/cache','--workdir','/project','--entrypoint',manifest['argv'][0],image,*manifest['argv'][1:]]
        created=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');save(cell/'create.json',{'argv':argv,'exit':created.returncode,'stdout':created.stdout,'stderr':created.stderr})
        if created.returncode:raise RuntimeError('container create failed; preserve original receipt')
        cid=created.stdout.strip();start=datetime.now(timezone.utc).isoformat()
        with (cell/'stdout.txt').open('wb') as out,(cell/'stderr.txt').open('wb') as err:
            native=subprocess.run(['docker','start','-a',cid],stdout=out,stderr=err)
        inspector=subprocess.run(['docker','inspect',cid],capture_output=True,text=True,encoding='utf-8');(cell/'terminal-inspect.json').write_text(inspector.stdout,encoding='utf-8')
        if inspector.returncode:raise RuntimeError('native terminal unavailable')
        state=json.loads(inspector.stdout)[0]['State']
        if state['Status']!='exited':raise RuntimeError('native still active; preserve and observe original container')
        if state.get('OOMKilled') or state.get('Error') or state['ExitCode']>=128:raise RuntimeError('facility/native termination cause unresolved; preserve original terminal, no candidate grade')
        assessment=assess(input_root,output/'result');save(cell/'numeric-assessment.json',assessment)
        verified=state['ExitCode']==0 and all(r['status']=='pass' for r in assessment['findings'][:14])
        receipt={'variant':name,'native_exit':state['ExitCode'],'native_started_at':state['StartedAt'],'native_finished_at':state['FinishedAt'],
            'container_id':cid,'source':str(source),'input':str(input_root),'output':str(output/'result'),'verified':verified,'start_command_exit':native.returncode}
        save(cell/'receipt.json',receipt);receipts.append(receipt)
        removed=subprocess.run(['docker','rm',cid],capture_output=True,text=True,encoding='utf-8');save(cell/'cleanup.json',{'argv':['docker','rm',cid],'exit':removed.returncode,'stdout':removed.stdout,'stderr':removed.stderr})
        if removed.returncode:raise RuntimeError('owned terminal cleanup failed; inspect exact ID')
    execution={'format':'l03-evaluator-execution/1','all_declared_runs_verified':all(r['verified'] for r in receipts),'runs':receipts};save(run/'execution.json',execution)
    final=assess(run/'base/input',run/'base/output/result',execution,review);save(run/'assessment.json',final)
    print(json.dumps({'status':final['status'],'cold_runs':len(receipts),'all_native_and_numeric_verified':execution['all_declared_runs_verified'],'total':final['total'],'good':final['good']}))
    return final
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--submission',type=Path,required=True);p.add_argument('--input',type=Path,required=True);p.add_argument('--run',type=Path,required=True);p.add_argument('--image',required=True);a=p.parse_args()
    try:value=execute(a.submission,a.input,a.run,a.image)
    except SubmissionError as e:print(json.dumps({'status':'candidate_submission_invalid','error':str(e)}));raise SystemExit(2)
    except (OSError,RuntimeError,ValueError,KeyError,TypeError) as e:print(json.dumps({'status':'facility_error','error':str(e)}));raise SystemExit(3)
    raise SystemExit(4 if value['total'] is None else 0 if value['good'] else 2)
