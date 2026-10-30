"""Public execution protocol. Actual records only: no private rubric or business oracle."""
import argparse,json,os,sqlite3,subprocess,shutil,tempfile,time,queue,threading,traceback
from pathlib import Path
from datetime import datetime,timezone
from logical_store import read,original,remote,CandidateDataError

def now():return datetime.now(timezone.utc).isoformat()
def dump(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def backup(src,dst):
    c=sqlite3.connect(src);d=sqlite3.connect(dst);c.backup(d);d.close();c.close()
def drop_identity(uid):
    def enter():os.setgroups([]);os.setgid(uid);os.setuid(uid);os.write(2,(json.dumps({'event':'process_identity','pid':os.getpid(),'uid':os.getuid()})+'\n').encode())
    return enter
def line_from(p,seconds=90):
    q=queue.Queue();threading.Thread(target=lambda:q.put(p.stdout.readline()),daemon=True).start()
    try:return q.get(timeout=seconds)
    except queue.Empty:raise ValueError('candidate_checkpoint_inactive_90s')

class Run:
    def __init__(self,source,raw,root):
        self.source=source;self.raw=raw;self.root=root;self.events=[];self.children=[];self.service=None;self.service_stream=None
        self.manifest=json.loads((source/'submission.json').read_text(encoding='utf-8'));self.mapping=json.loads((source/self.manifest['logical_map']).read_text(encoding='utf-8'))
        self.data=Path(tempfile.mkdtemp(prefix='l05-local-'));os.chown(self.data,10001,10001);self.data.chmod(0o700);self.db=self.data/'local.sqlite';backup(raw/'original-local.sqlite',self.db);os.chown(self.db,10001,10001)
        self.remote_db=root/'remote.sqlite';backup(raw/'original-remote.sqlite',self.remote_db)
        self.requests=Path(tempfile.mkdtemp(prefix='l05-requests-'));self.requests.chmod(0o755)
        dump(root/'original-facts.json',{'local':original(raw/'original-local.sqlite'),'remote':remote(raw/'original-remote.sqlite')})
    def start_service(self,hold=None):
        argv=['python','-B',str(self.raw/'l05_effects.py'),'--db',str(self.remote_db)]
        if hold:argv+=['--hold-once',hold]
        self.service_stream=(self.root/f'service-{sum(e.get("kind")=="service_start" for e in self.events)}.stderr.txt').open('w',encoding='utf-8')
        p=subprocess.Popen(argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.service_stream,text=True,encoding='utf-8');self.children.append(p);self.service=p;ready=json.loads(line_from(p));self.url=ready['url'];self.events.append({'kind':'service_start','argv':argv,'pid':p.pid,'ready':ready,'at':now()});dump(self.root/'events.json',self.events)
    def stop_service(self):
        if self.service and self.service.poll() is None:
            self.service.stdin.write('stop\n');self.service.stdin.flush();out,_=self.service.communicate(timeout=30);self.events.append({'kind':'service_terminal','pid':self.service.pid,'exit_code':self.service.returncode,'stdout':out,'at':now()});self.service_stream.close();self.service=None;dump(self.root/'events.json',self.events)
    def spawn(self,r,pause=None,legacy=False,db=None):
        index=len(self.events);req=self.requests/f'{index}.json';dump(req,r);req.chmod(0o444)
        if legacy:argv=['python','-B',str(self.raw/'frozen_sender.py'),'--url',self.url,'--request',str(req)]
        else:argv=self.manifest['app_argv']+['--db',str(db or self.db),'--url',self.url,'--request',str(req),'--input',str(self.raw)]
        if pause:argv+=['--pause-at',pause]
        p=subprocess.Popen(argv,cwd=self.source,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',preexec_fn=drop_identity(10001));self.children.append(p)
        event={'kind':'application','request':r,'argv':argv,'pid':p.pid,'legacy':legacy,'pause':pause,'started_at':now()};self.events.append(event);return p,event
    def finish(self,p,e,prefix='',release=False,kill=False):
        if kill:p.kill()
        out,err=p.communicate(input='\n' if release else None,timeout=90);e.update(stdout=prefix+out,stderr=err,exit_code=p.returncode,intentional_process_fault=kill,finished_at=now())
        try:e['response']=json.loads((prefix+out).strip().splitlines()[-1])
        except (ValueError,IndexError):e['response']=None
        dump(self.root/'events.json',self.events);return e['response']
    def call(self,r,db=None):
        p,e=self.spawn(r,db=db);answer=self.finish(p,e)
        if p.returncode:raise ValueError('candidate_native_failure:'+str(p.returncode))
        return answer
    def held(self,r,stage):
        p,e=self.spawn(r,pause=stage);line=line_from(p);obj=json.loads(line)
        if obj.get('event')!='checkpoint' or obj.get('name')!=stage or obj.get('pid')!=p.pid:
            self.finish(p,e,line);raise ValueError('candidate_checkpoint_contract_invalid')
        e['checkpoint']=obj;e['checkpoint_sql']={'local':read(self.db,self.mapping),'remote':remote(self.remote_db)};dump(self.root/'events.json',self.events);return p,e,line
    def fault(self,r,stage):
        p,e,line=self.held(r,stage);self.finish(p,e,line,kill=True)
    def snapshot(self,name):
        folder=self.root/name;folder.mkdir();backup(self.db,folder/'local.sqlite');backup(self.remote_db,folder/'remote.sqlite')
        dump(folder/'facts.json',{'local':read(folder/'local.sqlite',self.mapping),'remote':remote(folder/'remote.sqlite')});return folder
    def monitor(self,window,db=None):
        before={'local':read(db or self.db,self.mapping),'remote':remote(self.remote_db)};answer=self.call({'action':'monitor','window_id':window},db=db);self.events[-1]['monitor_before']=before;self.events[-1]['monitor_after']={'local':read(db or self.db,self.mapping),'remote':remote(self.remote_db)};dump(self.root/'events.json',self.events);return answer
    def close(self):
        if self.service:self.stop_service()
        for p in self.children:
            event=next((x for x in self.events if x.get('kind')=='application' and x.get('pid')==p.pid and 'exit_code' not in x),None)
            if event:
                killed=p.poll() is None
                if killed:p.kill()
                self.finish(p,event);event['cleanup_after_failure']=True;event['cleanup_killed']=killed

def need(answer,*statuses):
    if not isinstance(answer,dict) or answer.get('status') not in statuses:raise ValueError('response_contract_expected_'+str(statuses)+':'+str(answer))

def execute(run):
    r=run;need(r.call({'action':'init'}),'initialized');r.monitor('incident')
    original_wire=next(x for x in original(r.raw/'original-local.sqlite')['postings'] if x['source_kind']=='business' and x['source_id']=='Z');tenant,key=original_wire['tenant'],original_wire['event_id']
    r.stop_service();r.start_service(tenant+'/'+key)
    old,old_event=r.spawn({'action':'send_registered_wire','wire':json.loads(original_wire['payload'])},legacy=True);held=line_from(r.service);r.events.append({'kind':'held_http','line':held,'at':now()});held_value=json.loads(held)
    if held_value.get('status')!='held_before_apply':raise ValueError('facility_hold_handshake_invalid')
    need(r.call({'action':'pause','epoch':1,'repair_id':'incident'}),'paused')
    old_request=json.loads((r.raw/'legacy-delivery.json').read_text(encoding='utf-8'))['events'][0]
    for item,expected in [({'action':'ingest','epoch':1,'event':dict(old_request,request_id='paused-new')},'paused'),({'action':'ingest','epoch':1,'event':old_request},'duplicate'),({'action':'resume','epoch':1,'repair_id':'incident'},'repair_incomplete')]:need(r.call(item),expected)
    repair={'action':'repair','epoch':1,'repair_id':'incident'}
    r.fault(repair,'after_remote_receipt_before_confirm');r.fault(repair,'after_plan_commit');need(r.call(repair),'resumed');need(r.call(repair),'repair_complete')
    r.service.stdin.write('release\n');r.service.stdin.flush();old_response=r.finish(old,old_event);need(old_response,'sent')
    r.events.append({'kind':'late_http','service_lines':[line_from(r.service),line_from(r.service)],'at':now()});dump(r.root/'events.json',r.events)
    r.snapshot('repaired-incident');r.monitor('repaired')
    need(r.call({'action':'ingest','epoch':1,'event':dict(old_request,request_id='stale-new')}),'stale_epoch')
    incoming=json.loads((r.raw/'incoming-operations.json').read_text(encoding='utf-8'));future=incoming['events']
    # Commit of acceptance, followed by process death before its ACK, is independent
    # of the receiver's effect/receipt transaction.
    first={'action':'ingest','epoch':2,'event':future[0]};r.fault(first,'after_accept_commit');need(r.call(first),'duplicate')
    pair=[]
    for _ in range(2):pair.append(r.held({'action':'ingest','epoch':2,'event':future[1]},'before_accept_begin'))
    for p,e,line in pair:r.finish(p,e,line,release=True)
    for event in future[2:]:need(r.call({'action':'ingest','epoch':2,'event':event}),'accepted')
    need(r.call({'action':'adjustment','epoch':2,**incoming['adjustment']}),'approved');need(r.call({'action':'note','epoch':2,**incoming['note']}),'accepted')
    r.monitor('changed')
    senders=[r.held({'action':'reconcile'},'before_http') for _ in range(2)]
    for p,e,line in senders:r.finish(p,e,line,release=True)
    r.snapshot('repaired-current');r.monitor('current')
    r.stop_service();r.start_service();need(r.call({'action':'reconcile'}),'converged');r.monitor('after-restart');r.snapshot('final')
    empty=r.data/'empty.sqlite';need(r.call({'action':'init'},db=empty),'initialized');r.monitor('empty',db=empty);backup(empty,r.root/'empty-monitor.sqlite')
    # All irreversible external effects are only those in the cooperative local
    # receiver. No real recipient, payment or model service is involved.

def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--raw',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    if os.name!='posix' or os.geteuid()!=0:raise ValueError('facility_linux_owner_required')
    target=a.out.resolve()
    if target.exists():raise ValueError('output_directory_unavailable')
    private=Path(tempfile.mkdtemp(prefix='l05-owner-'));private.chmod(0o700);root=private/'facts';root.mkdir();r=Run(a.source,a.raw,root)
    dump(root/'registration.json',{'manifest':r.manifest,'source_files':{n:(a.source/n).read_text(encoding='utf-8') for n in r.manifest['files']},'logical_map':r.mapping,'started_at':now()})
    result={'status':'running'}
    try:r.start_service();execute(r);result={'status':'executed'}
    except Exception as e:result={'status':'candidate_execution_failed','error':str(e),'traceback':traceback.format_exc()}
    finally:
        r.close();backup(r.db,root/'local.sqlite');dump(root/'events.json',r.events);dump(root/'run.json',{**result,'finished_at':now()})
    projection=Path(tempfile.mkdtemp(prefix='l05-report-'));projection.chmod(0o711);facts=projection/'facts';shutil.copytree(root,facts)
    for file in facts.rglob('*'):file.chmod(0o555 if file.is_dir() else 0o444)
    facts.chmod(0o555);delivery=projection/'delivery';delivery.mkdir();os.chown(delivery,65534,65534);delivery.chmod(0o700)
    argv=r.manifest['report_argv']+['--evidence',str(facts),'--out',str(delivery/'product')]
    proc=subprocess.run(argv,cwd=a.source,capture_output=True,text=True,encoding='utf-8',preexec_fn=drop_identity(65534),env=dict(os.environ,HOME=str(delivery),MPLCONFIGDIR=str(delivery/'matplotlib')))
    dump(root/'report-native.json',{'argv':argv,'exit_code':proc.returncode,'stdout':proc.stdout,'stderr':proc.stderr,'finished_at':now()});dump(root/'isolation.json',{'owner_mode':oct(private.stat().st_mode&0o777),'projection_mode':oct(facts.stat().st_mode&0o777),'file_modes':sorted({oct(x.stat().st_mode&0o777) for x in facts.rglob('*') if x.is_file()}),'report_uid':65534,'actor_uid':10001,'receiver_db_not_given_to_actor':True,'scope':'Linux file permission boundary for this execution; not hostile OS security certification'})
    if (delivery/'product').exists():shutil.copytree(delivery/'product',root/'delivery')
    try:post_local=read(root/'local.sqlite',r.mapping)
    except CandidateDataError as e:post_local={'candidate_projection_error':str(e)}
    dump(root/'post-report-actual.json',{'local':post_local,'remote':remote(root/'remote.sqlite')});shutil.copytree(root,target)
    print(json.dumps({**result,'report_exit':proc.returncode}),flush=True)
if __name__=='__main__':main()
