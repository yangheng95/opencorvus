"""Case-specific source-only tests using the Docker CLI; no persistent scheduler."""
from pathlib import Path,PurePosixPath
from datetime import datetime,timezone
from html import escape
import argparse,csv,json,shutil,subprocess,uuid
from review_rules import Document,read_json,table
from check import assess

class SubmissionError(ValueError):pass
def save(p,v):p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def source_file(root,name):
    rel=PurePosixPath(name)
    if not name.strip() or rel.is_absolute() or '..' in rel.parts or ':' in name or '\\' in name:raise SubmissionError('source_path_invalid')
    try:p=root/name;resolved=p.resolve(strict=True)
    except OSError as e:raise SubmissionError('source_missing') from e
    if not resolved.is_relative_to(root.resolve()) or p.is_symlink() or not p.is_file():raise SubmissionError('source_path_invalid')
    return p
def seal(submission,run):
    try:m=read_json(submission/'submission.json')
    except (OSError,ValueError) as e:raise SubmissionError('submission_manifest_invalid') from e
    if type(m) is not dict or m.get('format')!='l07-submission/1' or type(m.get('files')) is not list or not m['files'] or any(type(n) is not str for n in m['files']) or len(set(m['files']))!=len(m['files']) or type(m.get('argv')) is not list or not m['argv'] or any(type(x) is not str for x in m['argv']):raise SubmissionError('submission_manifest_invalid')
    source=run/'source';source.mkdir()
    for n in m['files']:
        p=source_file(submission,n);target=source/n;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
    save(run/'source-declaration.json',m);return source,m
def inputs(original,run):
    result=[]
    for name in ['base','mean-change','new-report']:
        dest=run/name/'input';shutil.copytree(original,dest)
        if name=='mean-change':
            p=dest/'archive/R01-MAIN.html';text=p.read_text(encoding='utf-8');doc=Document(text);row=next(r for r in doc.rows if r['row_id']=='R01-12-T')
            start=text.index('<tr id="R01-12-T">');end=text.index('</tr>',start)+len('</tr>');row['mean']='63.5'
            text=text[:start]+'<tr id="R01-12-T">'+''.join('<td>'+escape(row[h])+'</td>' for h in doc.head)+'</tr>'+text[end:];p.write_text(text,encoding='utf-8')
        if name=='new-report':
            index=table(dest/'archive/index.csv')
            for kind,suffix,published in [('registry','REG','2025-02-01T10:00:00Z'),('full_report','MAIN','2025-02-02T10:00:00Z')]:
                old=dest/'archive'/('R13-'+suffix+'.html');text=old.read_text(encoding='utf-8').replace('R13','R14').replace('<dd>M</dd>','<dd>N</dd>').replace('新独立M队列','新独立N队列')
                if suffix=='MAIN':text=text.replace('<td>58</td>','<td>60</td>')
                (dest/'archive'/('R14-'+suffix+'.html')).write_text(text,encoding='utf-8')
                index.append({'report_id':'R14-'+suffix,'file':'R14-'+suffix+'.html','kind':kind,'revision':'0','released_at':published})
            with (dest/'archive/index.csv').open('w',encoding='utf-8',newline='') as f:
                w=csv.DictWriter(f,fieldnames=['report_id','file','kind','revision','released_at']);w.writeheader();w.writerows(index)
        result.append((name,dest))
    return result

def run_once(source,manifest,raw,cell,image,variant):
    output=cell/'output';output.mkdir();name='oc-l07-'+uuid.uuid4().hex[:16]
    argv=['docker','create','--name',name,'--cpus','1','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
      '--mount','type=bind,src='+str(source.resolve())+',dst=/project,readonly','--mount','type=bind,src='+str(raw.resolve())+',dst=/input,readonly','--mount','type=bind,src='+str(output.resolve())+',dst=/output',
      '--tmpfs','/tmp:rw,nosuid,size=256m','--env','MPLCONFIGDIR=/tmp/mpl','--env','XDG_CACHE_HOME=/tmp/cache','--workdir','/project','--entrypoint',manifest['argv'][0],image,*manifest['argv'][1:]]
    p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');save(cell/'create.json',{'argv':argv,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
    if p.returncode:raise RuntimeError('facility_container_create_failed')
    cid=p.stdout.strip()
    with (cell/'stdout.txt').open('wb') as out,(cell/'stderr.txt').open('wb') as err:p=subprocess.run(['docker','start','-a',cid],stdout=out,stderr=err)
    original=subprocess.run(['docker','inspect',cid],capture_output=True,text=True,encoding='utf-8',check=True);(cell/'terminal-inspect.json').write_text(original.stdout,encoding='utf-8');state=json.loads(original.stdout)[0]['State']
    if state['Status']!='exited' or state.get('OOMKilled') or state.get('Error') or state['ExitCode']>=128:raise RuntimeError('facility_native_terminal_cause_unresolved; original CID preserved')
    a=assess(raw,output/'result');save(cell/'numeric-assessment.json',a)
    receipt={'variant':variant,'native_exit':state['ExitCode'],'container_id':cid,'native_started_at':state['StartedAt'],'native_finished_at':state['FinishedAt'],'start_command_exit':p.returncode,
      'source':str(source),'input':str(raw),'output':str(output/'result'),'verified':state['ExitCode']==0 and all(r['status']=='pass' for r in a['findings'][:10])};save(cell/'receipt.json',receipt)
    clean=subprocess.run(['docker','rm',cid],capture_output=True,text=True,encoding='utf-8');save(cell/'cleanup.json',{'argv':['docker','rm',cid],'exit':clean.returncode,'stdout':clean.stdout,'stderr':clean.stderr})
    if clean.returncode:raise RuntimeError('facility_owned_terminal_cleanup_failed')
    return receipt

def execute(submission,raw,run,image):
    run.mkdir(parents=True,exist_ok=False);source,manifest=seal(submission,run);receipts=[]
    for name,material in inputs(raw,run):receipts.append(run_once(source,manifest,material,run/name,image,name))
    execution={'format':'l07-case-execution/1','runs':receipts};save(run/'execution.json',execution)
    a=assess(run/'base/input',run/'base/output/result',execution);save(run/'assessment.json',a);print(json.dumps({'cold_runs':3,'all_verified':all(r['verified'] for r in receipts),'status':a['status'],'total':a['total'],'role':'execution_only_until_independent_review'}));return a
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--submission',type=Path,required=True);p.add_argument('--input',type=Path,required=True);p.add_argument('--run',type=Path,required=True);p.add_argument('--image',required=True);a=p.parse_args()
    try:r=execute(a.submission,a.input,a.run,a.image)
    except SubmissionError as e:print(json.dumps({'status':'candidate_submission_invalid','error':str(e)}));raise SystemExit(2)
    except (OSError,RuntimeError,ValueError,KeyError,TypeError) as e:print(json.dumps({'status':'facility_error','error':str(e)}));raise SystemExit(3)
    raise SystemExit(4 if r['total'] is None else 0 if r['good'] else 2)
