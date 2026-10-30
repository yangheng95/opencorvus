"""Whole case executor: actual app processes, commit handshakes and live SQLite observations."""
import argparse,json,os,shutil,sqlite3,subprocess,time,traceback,tempfile,stat
from datetime import datetime,timezone
from pathlib import Path

def now():return datetime.now(timezone.utc).isoformat()
def dump(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def snapshot(path):
    c=sqlite3.connect(path.resolve().as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
    try:
        tables=[r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        return {'tables':{t:[dict(r) for r in c.execute('SELECT * FROM "'+t+'"')] for t in tables},'schema':[list(r) for r in c.execute('SELECT type,name,sql FROM sqlite_master ORDER BY type,name')],'integrity':c.execute('PRAGMA integrity_check').fetchone()[0],'foreign_keys':[list(r) for r in c.execute('PRAGMA foreign_key_check')]}
    finally:c.close()

class Trial:
    def __init__(self,root,source,raw,manifest):
        self.root=root;self.source=source;self.raw=raw;self.manifest=manifest;self.events=[];self.children=[];root.mkdir();self.db=root/'live.sqlite';shutil.copy2(raw/'app-v1.sqlite',self.db)
    def request(self,r):
        n=len(self.events);p=self.root/f'request-{n:03d}.json';dump(p,r);return p
    def spawn(self,r,legacy=False,pause=None):
        req=self.request(r);argv=(['python','-B',str(self.raw/'legacy_app.py')] if legacy else self.manifest['app_argv'])+['--db',str(self.db),'--authority',str(self.raw/'identity-authority.json'),'--request',str(req)]
        if pause:argv+=['--pause-at',pause]
        p=subprocess.Popen(argv,cwd=self.source,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8');self.children.append(p)
        event={'request':r,'argv':argv,'pid':p.pid,'started_at':now(),'legacy':legacy,'pause':pause};self.events.append(event);return p,event
    def finish(self,p,event,prefix='',release=False,kill=False):
        if kill:p.kill()
        out,err=p.communicate(input='\n' if release else None);event.update(stdout=prefix+out,stderr=err,exit_code=p.returncode,finished_at=now(),intentional_process_fault=kill)
        try:event['response']=json.loads((prefix+out).strip().splitlines()[-1])
        except (ValueError,IndexError):event['response']=None
        dump(self.root/'events.json',self.events);return event['response']
    def call(self,r,legacy=False):
        p,e=self.spawn(r,legacy);out=self.finish(p,e)
        if p.returncode!=0:raise ValueError('native_failure:'+str(len(self.events)-1))
        return out
    def fault(self,r,pause):
        p,e=self.spawn(r,pause=pause);line=p.stdout.readline();e['checkpoint_line']=line
        value=json.loads(line)
        if value.get('event')!='checkpoint' or value.get('name')!=pause or value.get('pid')!=p.pid:raise ValueError('checkpoint_invalid')
        e['at_checkpoint_sql']=snapshot(self.db);self.finish(p,e,line,kill=True)
        e['after_fault_sql']=snapshot(self.db);dump(self.root/'events.json',self.events)
    def stop(self):
        for p in self.children:
            if p.poll() is None:
                p.kill();p.communicate()

def require(r,status):
    if not isinstance(r,dict) or r.get('status')!=status:raise ValueError('response_expected_'+status+':'+str(r))

def scenario(root,source,raw,manifest,name):
    t=Trial(root/name,source,raw,manifest);result={'scenario':name,'status':'running','started_at':now()}
    try:
        dump(t.root/'initial-sql.json',snapshot(t.db))
        if name.startswith('ambiguous'):
            c=sqlite3.connect(t.db)
            if name=='ambiguous_entry':c.execute("INSERT INTO legacy_entries VALUES('',7,'USD','1.00',NULL)")
            else:c.execute("INSERT INTO write_receipts VALUES(NULL,'{}','{}')")
            c.commit();c.close();dump(t.root/'ambiguous-before-sql.json',snapshot(t.db));result['response']=t.call({'action':'upgrade'});dump(t.root/'final-sql.json',snapshot(t.db));result['status']='completed';return result
        require(t.call({'action':'status'},legacy=True),'ok');require(t.call({'action':'get','entry_id':'O1'},legacy=True),'ok');require(t.call({'action':'list'},legacy=True),'ok');require(t.call({'action':'notes'},legacy=True),'ok')
        pre={'op_key':'pre-'+name,'entry_id':'PRE-'+name,'customer_id':7,'currency':'CNY','amount':'8.13','epoch':3}
        require(t.call({'action':'write','write':pre},legacy=True),'accepted');require(t.call({'action':'write','write':pre},legacy=True),'duplicate')
        c=sqlite3.connect(t.db);b=sqlite3.connect(t.root/'backup.sqlite');c.backup(b);b.close();c.close()
        dump(t.root/'pre-upgrade-sql.json',snapshot(t.db))
        if name in ('before','after'):t.fault({'action':'upgrade'},'before_commit' if name=='before' else 'after_commit')
        held=[]
        if name=='cutover':
            for i in range(2):
                w={'action':'write','write':{'op_key':f'stale-{i}','entry_id':f'STALE-{i}','customer_id':7,'currency':'USD','amount':'4.31','epoch':3}}
                p,e=t.spawn(w,legacy=True,pause='before_begin');line=p.stdout.readline();e['checkpoint_line']=line
                if json.loads(line).get('name')!='before_begin':raise ValueError('old_writer_handshake_invalid')
                held.append((p,e,line))
        require(t.call({'action':'upgrade'}),'already_current' if name=='after' else 'upgraded')
        for p,e,line in held:t.finish(p,e,line,release=True)
        require(t.call({'action':'upgrade'}),'already_current')
        dump(t.root/'migrated-sql.json',snapshot(t.db))
        require(t.call({'action':'status'}),'ok')
        # Public old operations remain queryable even though old binary writes are fenced.
        for key in ('published-ack-0','published-ack-1','published-ack-2','pre-'+name):require(t.call({'action':'receipt','op_key':key}),'ok')
        w={'op_key':'v2-'+name,'entry_id':'V2-'+name,'customer_key':'C-ALPHA','currency':'USD','amount_minor':531,'fee_minor':17,'epoch':4}
        require(t.call({'action':'write','write':w}),'accepted');require(t.call({'action':'write','write':w}),'duplicate')
        require(t.call({'action':'write','write':dict(w,amount_minor=532)}),'operation_conflict')
        refund=dict(w,op_key='refund-'+name,entry_id='REFUND-'+name,amount_minor=-131,fee_minor=3,reversal_of=w['entry_id'])
        require(t.call({'action':'write','write':refund}),'accepted')
        require(t.call({'action':'write','write':dict(refund,op_key='too-much-'+name,entry_id='EXCESS-'+name,amount_minor=-401)}),'refund_exceeds')
        require(t.call({'action':'write','write':dict(w,op_key=None,entry_id='NULL-KEY')}),'invalid_request:op_key')
        require(t.call({'action':'write','write':dict(w,op_key='bool',amount_minor=True)}),'invalid_request:amount_minor')
        require(t.call({'action':'write','write':dict(w,op_key='old',epoch=3)}),'stale_epoch')
        require(t.call({'action':'write','write':dict(w,op_key='unknown-customer',entry_id='UNKNOWN',customer_key='NO-SUCH-CUSTOMER')}),'constraint_error')
        require(t.call({'action':'note','note_id':'POST-'+name,'entry_id':w['entry_id'],'text':'升级后原用户批注\n\u0000尾部 / 追加不可丢'}),'accepted')
        if name=='clean':
            for phase in ('before_commit','after_commit'):
                x=dict(w,op_key='fault-'+phase,entry_id='FAULT-'+phase,amount_minor=707,fee_minor=11)
                t.fault({'action':'write','write':x},phase)
                require(t.call({'action':'write','write':x}),'accepted' if phase=='before_commit' else 'duplicate')
        for action in ({'action':'get','entry_id':w['entry_id']},{'action':'balance'},{'action':'notes'},{'action':'export'}):require(t.call(action),'ok')
        c=sqlite3.connect(t.db);c.execute('DROP INDEX entries_customer_currency');c.commit();c.close()
        dump(t.root/'pre-recover-sql.json',snapshot(t.db))
        recovery=t.call({'action':'recover','backup':str(t.root/'backup.sqlite')});result['recovery_response']=recovery
        # Keep evidence even when an intentionally wrong programme rolls the schema back.
        dump(t.root/'recovered-sql.json',snapshot(t.db))
        require(recovery,'forward_repaired')
        final=dict(w,op_key='continued-'+name,entry_id='CONTINUED-'+name,amount_minor=901,fee_minor=5)
        require(t.call({'action':'write','write':final}),'accepted')
        require(t.call({'action':'get','entry_id':final['entry_id']}),'ok')
        response=t.call({'action':'export'});require(response,'ok');dump(t.root/'export.json',response)
        c=sqlite3.connect(t.db);c.execute('PRAGMA foreign_keys=ON');probes=[]
        for label,entry,customer,currency,amount,fee in [('valid','SQL-VALID','C-ALPHA','USD',100,0),('null_id',None,'C-ALPHA','USD',100,0),('empty_id','','C-ALPHA','USD',100,0),('foreign_customer','SQL-FK','UNKNOWN','USD',100,0),('currency','SQL-CUR','C-ALPHA','EUR',100,0),('fee','SQL-FEE','C-ALPHA','USD',100,-1),('fraction','SQL-FRAC','C-ALPHA','USD',1.5,0)]:
            try:
                c.execute('BEGIN');c.execute('INSERT INTO entries VALUES(?,?,?,?,NULL,?,NULL)',(entry,customer,currency,amount,fee));probes.append({'name':label,'status':'accepted_in_rolled_back_probe'})
            except sqlite3.IntegrityError as e:probes.append({'name':label,'status':'constraint_error','sqlite_errorname':e.sqlite_errorname})
            finally:c.rollback()
        c.close();dump(t.root/'constraint-probes.json',probes)
        dump(t.root/'final-sql.json',snapshot(t.db));result['status']='completed'
    except Exception as e:
        result.update(status='candidate_execution_failed',error=str(e),traceback=traceback.format_exc());dump(t.root/'failure-sql.json',snapshot(t.db))
    finally:
        t.stop();result['finished_at']=now();dump(t.root/'scenario.json',result);dump(t.root/'events.json',t.events)
    return result

def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--raw',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    if os.name!='posix' or os.geteuid()!=0:raise ValueError('facility_linux_container_owner_required')
    target=a.out.resolve()
    if target.exists():raise ValueError('output_directory_unavailable')
    private=Path(tempfile.mkdtemp(prefix='l04-private-'));private.chmod(0o700);a.out=private/'evidence';a.out.mkdir(mode=0o700)
    manifest=json.loads((a.source/'submission.json').read_text(encoding='utf-8'))
    for n in manifest['files']:
        path=a.source/n
        if Path(n).is_absolute() or not path.is_file() or path.is_symlink() or a.source.resolve() not in path.resolve().parents:raise ValueError('candidate_source_file_invalid')
    dump(a.out/'registration.json',{'manifest':manifest,'started_at':now(),'source_files':{n:(a.source/n).read_text(encoding='utf-8') for n in manifest['files']},'source':str(a.source),'raw':str(a.raw)})
    outcomes=[scenario(a.out,a.source,a.raw,manifest,n) for n in ('clean','before','after','cutover','ambiguous_entry','ambiguous_receipt')]
    dump(a.out/'run.json',{'status':'executed','scenarios':outcomes,'finished_at':now()})
    # A completed-facts projection is physically read-only to the report uid. Original
    # requests, native receipts and live databases remain under the private owner root.
    report_root=Path(tempfile.mkdtemp(prefix='l04-report-'));report_root.chmod(0o711);projection=report_root/'facts';shutil.copytree(a.out,projection)
    for path in projection.rglob('*'):path.chmod(0o555 if path.is_dir() else 0o444)
    projection.chmod(0o555);delivery=report_root/'delivery';delivery.mkdir();os.chown(delivery,65534,65534);delivery.chmod(0o700)
    argv=manifest['report_argv']+['--evidence',str(projection),'--out',str(delivery/'product')];start=now()
    def report_identity():
        os.setgroups([]);os.setgid(65534);os.setuid(65534)
        os.write(2,(json.dumps({'event':'report_identity','pid':os.getpid(),'uid':os.getuid(),'gid':os.getgid()})+'\n').encode())
    environment=dict(os.environ,HOME=str(delivery),MPLCONFIGDIR=str(delivery/'matplotlib'))
    r=subprocess.run(argv,cwd=a.source,capture_output=True,text=True,encoding='utf-8',preexec_fn=report_identity,env=environment)
    dump(a.out/'report-native.json',{'argv':argv,'started_at':start,'finished_at':now(),'exit_code':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
    dump(a.out/'report-isolation.json',{'private_root_mode':oct(stat.S_IMODE(private.stat().st_mode)),'projection_directory_mode':oct(stat.S_IMODE(projection.stat().st_mode)),'projection_file_modes':sorted({oct(stat.S_IMODE(x.stat().st_mode)) for x in projection.rglob('*') if x.is_file()}),'report_uid':65534,'report_gid':65534,'identity_stderr_first_line':r.stderr.splitlines()[0] if r.stderr else None,'original_evidence':'private owner-only directory; copied to final output after report terminated','limitations':'not an arbitrary malicious operating-system process security certification'})
    if (delivery/'product').exists():shutil.copytree(delivery/'product',a.out/'delivery')
    for name in ('clean','before','after','cutover','ambiguous_entry','ambiguous_receipt'):dump(a.out/name/'post-report-sql.json',snapshot(a.out/name/'live.sqlite'))
    dump(a.out/'export-receipt.json',{'private_execution_root':str(a.out),'exported_to':str(target),'exported_after_report_terminal':now()})
    shutil.copytree(a.out,target)
    print(json.dumps({'status':'executed','scenario_states':{x['scenario']:x['status'] for x in outcomes},'report_exit':r.returncode}),flush=True)
if __name__=='__main__':main()
