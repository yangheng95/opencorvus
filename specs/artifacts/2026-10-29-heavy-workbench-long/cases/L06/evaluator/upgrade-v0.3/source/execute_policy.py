"""Case-owned real stdio actor execution and immutable business journal.

Only this parent knows the actual path. The Docker actor receives a fixed public
mount and current packets through stdin; diagnostic localization is neutral.
"""
from pathlib import Path
import argparse,datetime,json,os,sqlite3,subprocess,time,uuid
from tree_business import load_data,event,packet,replay,append,BusinessError,canonical

IMAGE='sha256:23ff8bfbf8055caa0b9fa5745ddb27cceea2f31d7d15b7a900c81112cdfe8ddf'

def save(p,x):p.write_text(json.dumps(x,indent=2,allow_nan=False)+'\n',encoding='utf-8')

def main():
    p=argparse.ArgumentParser();p.add_argument('--project',type=Path,required=True);p.add_argument('--public',type=Path,required=True)
    p.add_argument('--db',type=Path,required=True);p.add_argument('--path-id',required=True);p.add_argument('--out',type=Path,required=True)
    p.add_argument('--crash-week',type=int);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
    data,_=load_data(a.public);path=next(s for s in data['scenarios'] if s['id']==a.path_id)
    a.db.parent.mkdir(parents=True,exist_ok=True);db=sqlite3.connect(a.db);db.execute('PRAGMA synchronous=FULL');db.execute('PRAGMA journal_mode=WAL')
    if db.execute('PRAGMA user_version').fetchone()[0] not in (0,1):raise BusinessError('journal_schema_invalid')
    db.executescript('CREATE TABLE IF NOT EXISTS episode(private_path TEXT NOT NULL); CREATE TABLE IF NOT EXISTS commits(week INTEGER PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, item_json TEXT NOT NULL); PRAGMA user_version=1;')
    identities=db.execute('SELECT private_path FROM episode').fetchall()
    if not identities:db.execute('INSERT INTO episode VALUES(?)',(a.path_id,));db.commit()
    elif identities!=[(a.path_id,)]:raise BusinessError('episode_identity_conflict')
    committed=[json.loads(row[0]) for row in db.execute('SELECT item_json FROM commits ORDER BY week')];state,_=replay(data,committed)
    if committed:
        prior=committed[-1];same,receipt,replayed=append(data,committed,prior['event'],prior['action'],prior['request_id'])
        if not replayed or canonical(same)!=canonical(committed) or canonical(receipt)!=canonical(prior['receipt']):raise BusinessError('resume_receipt_invalid')
        save(a.out/'resume-receipt.json',{'replayed':True,'receipt':receipt,'next_week':state['next_week'],'committed_count':len(committed)})
    if state['next_week']==data['weeks']:
        save(a.out/'terminal.json',{'native_exit':0,'status':'already_complete','state':state,'committed_count':len(committed)});return 0
    submission=json.loads((a.project/'submission.json').read_text(encoding='utf-8'))
    command=submission.get('argv')
    if submission.get('format')!='l06-online-submission/1' or type(command) is not list or not command or any(type(v) is not str or not v for v in command):raise BusinessError('submission_command_invalid')
    name='oc-l06-v03-operation-'+uuid.uuid4().hex[:12]
    argv=['docker','create','-i','--name',name,'--network','none','--cpus','1','--env','PYTHONDONTWRITEBYTECODE=1',
        '--mount',f'type=bind,source={a.project.resolve()},target=/project,readonly',
        '--mount',f'type=bind,source={a.public.resolve()},target=/public,readonly','--workdir','/project',IMAGE,
        *command]
    c=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');save(a.out/'create.json',{'argv':argv,'exit_code':c.returncode,'stdout':c.stdout,'stderr':c.stderr})
    if c.returncode:raise RuntimeError('owned actor create failed')
    cid=c.stdout.strip();save(a.out/'active.json',{'cid':cid,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':argv,'owner_pid':os.getpid(),'scope':'actual future path stays solely in this parent/database, not actor argv/env/mounts'})
    with (a.out/'actor-stderr.txt').open('wb') as err:
        child=subprocess.Popen(['docker','start','-ai',cid],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True,encoding='utf-8',bufsize=1)
        with (a.out/'visible-exchange.jsonl').open('w',encoding='utf-8') as trace:
            for t in range(state['next_week'],data['weeks']):
                e=event(path,t);visible=packet(data,committed,e)
                trace.write(json.dumps({'direction':'to_actor','packet':visible})+'\n');trace.flush()
                child.stdin.write(json.dumps(visible)+'\n');child.stdin.flush();line=child.stdout.readline()
                if not line:raise BusinessError('actor_response_missing',t)
                response=json.loads(line);trace.write(json.dumps({'direction':'from_actor','response':response})+'\n');trace.flush()
                if type(response) is not dict or set(response)!={'format','request_id','action'} or response['format']!='l06-action-response/1':raise BusinessError('actor_response_invalid',t)
                new,receipt,duplicate=append(data,committed,e,response['action'],response['request_id'])
                if duplicate:raise BusinessError('current_week_duplicate',t)
                item=new[-1];db.execute('BEGIN IMMEDIATE');db.execute('INSERT INTO commits VALUES(?,?,?)',(t,response['request_id'],canonical(item)));db.commit();committed=new
                # Actual process exits after durable business commit and before
                # the next packet/acknowledged state reaches the actor.
                if a.crash_week==t:
                    save(a.out/'crash-after-commit.json',{'week':t,'request_id':response['request_id'],'receipt':receipt,'database_commit':True,'next_packet_sent':False,'planned_exit':73})
                    os._exit(73)
            child.stdin.close();child.stdout.close();code=child.wait()
    state,rows=replay(data,committed);save(a.out/'journal-export.json',{'format':'l06-committed-journal/1','committed':committed,'state':state,'weeks':rows})
    save(a.out/'terminal.json',{'native_exit':code,'status':'operation_completed' if code==0 else 'actor_native_failed','state':state,'committed_count':len(committed)})
    db.close();return code
if __name__=='__main__':raise SystemExit(main())
