"""Native-process execution and durable business journal, no container dependency.

Only controller stdin supplies the chosen event sequence. Worker dataflow is
current history/public support; same-user OS/memory confinement is not certified.
"""
from pathlib import Path
import argparse,datetime,json,os,sqlite3,subprocess,sys
from tree_business import load_data,event,packet,replay,append,BusinessError,canonical

def save(p,x):p.write_text(json.dumps(x,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()

def main():
    p=argparse.ArgumentParser();p.add_argument('--project',type=Path,required=True);p.add_argument('--public',type=Path,required=True)
    p.add_argument('--db',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--python',type=Path,required=True)
    p.add_argument('--crash-week',type=int);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
    data,contract=load_data(a.public);private=json.loads(sys.stdin.read())
    if type(private) is not dict or set(private)!={'events'} or type(private['events']) is not list or len(private['events'])!=data['weeks']:raise BusinessError('controller_event_sequence_invalid')
    sequence=private['events']
    if not any(canonical(sequence)==canonical([event(s,t) for t in range(data['weeks'])]) for s in data['scenarios']):raise BusinessError('controller_event_sequence_invalid')
    a.db.parent.mkdir(parents=True,exist_ok=True);db=sqlite3.connect(a.db);db.execute('PRAGMA synchronous=FULL');db.execute('PRAGMA journal_mode=WAL')
    version=db.execute('PRAGMA user_version').fetchone()[0]
    if version not in (0,2):raise BusinessError('native_journal_schema_invalid')
    # Earlier unexecuted container-only source created no persistent native DB.
    db.executescript('CREATE TABLE IF NOT EXISTS meta(public_facts_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS commits(week INTEGER PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, item_json TEXT NOT NULL); PRAGMA user_version=2;')
    public_facts=canonical({'contract':contract,'data':data});identities=db.execute('SELECT public_facts_json FROM meta').fetchall()
    if not identities:db.execute('INSERT INTO meta VALUES(?)',(public_facts,));db.commit()
    elif identities!=[(public_facts,)]:raise BusinessError('public_facts_changed_on_resume')
    committed=[json.loads(row[0]) for row in db.execute('SELECT item_json FROM commits ORDER BY week')];state,_=replay(data,committed)
    for t,item in enumerate(committed):
        if canonical(item['event'])!=canonical(sequence[t]):raise BusinessError('committed_event_conflict',t)
    if committed:
        prior=committed[-1];same,receipt,replayed=append(data,committed,prior['event'],prior['action'],prior['request_id'])
        if not replayed or canonical(same)!=canonical(committed) or canonical(receipt)!=canonical(prior['receipt']):raise BusinessError('resume_receipt_invalid')
        save(a.out/'resume-receipt.json',{'replayed':True,'receipt':receipt,'next_week':state['next_week'],'committed_count':len(committed)})
    if state['next_week']==data['weeks']:
        save(a.out/'terminal.json',{'native_exit':0,'status':'already_complete','state':state,'committed_count':len(committed)});return 0
    submission=json.loads((a.project/'submission.json').read_text(encoding='utf-8'));command=submission.get('argv')
    if submission.get('format')!='l06-online-submission/2' or type(command) is not list or not command or any(type(v) is not str or not v for v in command):raise BusinessError('submission_command_invalid')
    mapping={'{python}':str(a.python.resolve()),'{project}':str(a.project.resolve()),'{public}':str(a.public.resolve())};argv=command.copy()
    for key,value in mapping.items():argv=[v.replace(key,value) for v in argv]
    worker_dir=a.out/'worker';worker_dir.mkdir()
    env={k:os.environ[k] for k in ('SystemRoot','WINDIR','PATH') if k in os.environ}
    env.update(TEMP=str(worker_dir.resolve()),TMP=str(worker_dir.resolve()),PYTHONPATH=str(a.project.resolve()),PYTHONNOUSERSITE='1',PYTHONUNBUFFERED='1',PYTHONDONTWRITEBYTECODE='1')
    with (a.out/'worker-stderr.txt').open('wb') as err:
        started=now();child=subprocess.Popen(argv,cwd=worker_dir,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True,encoding='utf-8',bufsize=1,close_fds=True,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        save(a.out/'active.json',{'at':started,'worker_pid':child.pid,'controller_pid':os.getpid(),'argv':argv,'cwd':str(worker_dir.resolve()),'environment':env,'format':'l06-native-worker/2','scope':'actual native dataflow; no OS filesystem/memory security claim'})
        with (a.out/'visible-exchange.jsonl').open('w',encoding='utf-8') as trace:
            for t in range(state['next_week'],data['weeks']):
                e=sequence[t];visible=packet(data,committed,e)
                trace.write(json.dumps({'direction':'to_actor','packet':visible})+'\n');trace.flush()
                child.stdin.write(json.dumps(visible)+'\n');child.stdin.flush();line=child.stdout.readline()
                if not line:raise BusinessError('actor_response_missing',t)
                response=json.loads(line);trace.write(json.dumps({'direction':'from_actor','response':response})+'\n');trace.flush()
                if type(response) is not dict or set(response)!={'format','request_id','action'} or response['format']!='l06-action-response/1':raise BusinessError('actor_response_invalid',t)
                new,receipt,duplicate=append(data,committed,e,response['action'],response['request_id'])
                if duplicate:raise BusinessError('current_week_duplicate',t)
                item=new[-1];db.execute('BEGIN IMMEDIATE');db.execute('INSERT INTO commits VALUES(?,?,?)',(t,response['request_id'],canonical(item)));db.commit();committed=new
                if a.crash_week==t:
                    # EOF closes the worker before the next state/ACK; preserve
                    # its actual terminal, then abruptly exit with the DB open.
                    child.stdin.close();child.stdout.close();code=child.wait()
                    save(a.out/'worker-terminal.json',{'started_at':started,'finished_at':now(),'pid':child.pid,'native_exit':code,'argv':argv})
                    save(a.out/'crash-after-commit.json',{'week':t,'request_id':response['request_id'],'receipt':receipt,'database_commit':True,'next_packet_sent':False,'planned_exit':73,'scope':'controller abrupt exit after durable commit before acknowledgement; no power-loss claim'})
                    os._exit(73)
            child.stdin.close();child.stdout.close();code=child.wait()
    save(a.out/'worker-terminal.json',{'started_at':started,'finished_at':now(),'pid':child.pid,'native_exit':code,'argv':argv})
    state,rows=replay(data,committed);save(a.out/'journal-export.json',{'format':'l06-committed-journal/1','committed':committed,'state':state,'weeks':rows})
    save(a.out/'terminal.json',{'native_exit':code,'status':'operation_completed' if code==0 else 'actor_native_failed','state':state,'committed_count':len(committed)})
    db.close();return code
if __name__=='__main__':raise SystemExit(main())
