"""One actual whole-tree native execution, including one committed-prefix restart.

No solver or component qualification is run. Future events remain on controller
stdin/in parent memory; episode-to-support labels are published after execution.
"""
from pathlib import Path
import argparse,csv,datetime,json,os,secrets,shutil,sqlite3,subprocess,sys,time,traceback,uuid,zipfile

HERE=Path(__file__).resolve().parent;CORE=HERE.parent/'qualification/current-source'
sys.path[:0]=[str(HERE/'source'),str(CORE)]
from tree_business import load_data,event,canonical

def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def write(p,x):p.write_text(json.dumps(x,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def capsule(folder,path):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted(folder.rglob('*')):
            if p.is_file():z.write(p,p.relative_to(folder).as_posix())

def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--project',type=Path,required=True);p.add_argument('--policy',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--python',type=Path,default=Path(sys.executable));a=p.parse_args()
    a.out.mkdir(parents=True,exist_ok=False);data,_=load_data(a.public);start=time.perf_counter()
    project=a.out/'sealed-project';shutil.copytree(a.project,project);public=a.out/'public';shutil.copytree(a.public,public)
    # The declared offline policy and actual actor implementation are separate
    # objects. The caller's complete programme/argv is preserved without rewriting.
    shutil.copy2(a.policy,a.out/'declared-policy.json')
    submission=json.loads((project/'submission.json').read_text(encoding='utf-8'))
    if submission.get('format')!='l06-online-submission/2' or not isinstance(submission.get('argv'),list):raise ValueError('declared programme submission required')
    capsule(project,a.out/'pre-execution-project.zip');capsule(public,a.out/'public-originals.zip')
    controller_source=a.out/'controller-source';controller_source.mkdir()
    shutil.copy2(Path(__file__),controller_source/'run_native_whole.py')
    shutil.copytree(HERE/'source',controller_source/'source')
    shutil.copytree(CORE,controller_source/'business-core',ignore=shutil.ignore_patterns('__pycache__'))
    capsule(controller_source,a.out/'pre-execution-controller-source.zip')
    write(a.out/'owner-started.json',{'at':now(),'pid':os.getpid(),'argv':sys.argv,'scope':'one actual8path online run, one commit-loss restart and one row-order control; no solver/retraining/component test','future_transport':'controller stdin only; not argv/env/worker source/files','OS_security':'same-user native process; no filesystem/memory/side-channel certification'})
    commands=[];episodes=[];journals={};env=dict(os.environ);env['PYTHONPATH']=str(controller_source/'source')+os.pathsep+str(controller_source/'business-core')
    def invoke(path,folder,db,raw,crash=None):
        argv=[str(a.python),'-u','-B',str(controller_source/'source/execute_policy.py'),'--project',str(project),'--public',str(raw),'--db',str(db),'--out',str(folder),'--python',str(a.python)]
        if crash is not None:argv += ['--crash-week',str(crash)]
        started=now();timer=time.perf_counter()
        result=subprocess.run(argv,input=json.dumps({'events':[event(path,t) for t in range(data['weeks'])]}),capture_output=True,text=True,encoding='utf-8',env=env,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        record={'argv':argv,'started_at':started,'finished_at':now(),'seconds':time.perf_counter()-timer,'native_exit':result.returncode,'stdout':result.stdout,'stderr':result.stderr,'out':folder.relative_to(a.out).as_posix()};commands.append(record);write(a.out/'actual-commands.json',commands)
        if result.returncode!=(73 if crash is not None else 0):raise RuntimeError('actual controller failed: '+canonical(record))
        worker=json.loads((folder/'worker-terminal.json').read_text())
        if worker['native_exit']!=0:raise RuntimeError('actual worker failed: '+canonical(worker))
        return record
    try:
        private_order=data['scenarios'].copy();secrets.SystemRandom().shuffle(private_order)
        for index,path in enumerate(private_order):
            episode=a.out/('episode-'+uuid.uuid4().hex[:12]);episode.mkdir();db=episode/'journal.sqlite3';phases=[];fault_prefix=None
            if index==0:
                phases.append(invoke(path,episode/'before-loss',db,public,7))
                with sqlite3.connect('file:'+db.as_posix()+'?mode=ro',uri=True) as con:
                    fault_prefix=con.execute('SELECT week,request_id,item_json FROM commits ORDER BY week').fetchall()
                    with sqlite3.connect(episode/'after-commit-original.sqlite3') as backup:con.backup(backup)
                if len(fault_prefix)!=8:raise RuntimeError('actual committed cut length')
                write(episode/'after-commit-original.json',fault_prefix)
            phases.append(invoke(path,episode/'completed',db,public))
            export=json.loads((episode/'completed/journal-export.json').read_text());journals[path['id']]=export['committed']
            with sqlite3.connect('file:'+db.as_posix()+'?mode=ro',uri=True) as con:
                actual=con.execute('SELECT week,request_id,item_json FROM commits ORDER BY week').fetchall()
            if len(actual)!=16:raise RuntimeError('actual final committed grid')
            if fault_prefix is not None:
                if actual[:8]!=fault_prefix:raise RuntimeError('original committed cut changed across native restart')
                receipt=json.loads((episode/'completed/resume-receipt.json').read_text())
                if not receipt['replayed'] or receipt['next_week']!=8 or canonical(receipt['receipt'])!=canonical(json.loads(fault_prefix[-1][2])['receipt']):raise RuntimeError('actual original receipt recovery')
            episodes.append({'path':path['id'],'directory':episode.relative_to(a.out).as_posix(),'commits':len(actual),'phases':phases,'has_real_commit_loss':fault_prefix is not None})
        control_public=a.out/'row-order-public';shutil.copytree(public,control_public)
        for f in control_public.glob('inputs/*.csv'):
            rows=f.read_text(encoding='utf-8').splitlines();f.write_text('\n'.join(rows[:1]+list(reversed(rows[1:])))+'\n',encoding='utf-8')
        control_data,_=load_data(control_public)
        if canonical(control_data)!=canonical(data):raise RuntimeError('author row-order control changed business semantics')
        control_path=secrets.choice(data['scenarios'])
        folder=a.out/('control-'+uuid.uuid4().hex[:12]);folder.mkdir();invoke(control_path,folder/'completed',folder/'journal.sqlite3',control_public)
        export=json.loads((folder/'completed/journal-export.json').read_text())
        def business(rows):return [{'week':v['week'],'event':v['event'],'action':v['action'],'receipt':{k:x for k,x in v['receipt'].items() if k!='request_id'}} for v in rows]
        if canonical(business(export['committed']))!=canonical(business(journals[control_path['id']])):raise RuntimeError('declared deterministic actor row-order business result mismatch')
        write(a.out/'journals.json',journals);write(a.out/'episodes.json',episodes)
        argv=[str(a.python),'-B',str(controller_source/'source/check_tree.py'),'--public',str(public),'--policy',str(a.out/'declared-policy.json'),'--journals',str(a.out/'journals.json'),'--out',str(a.out/'logical-and-journal-assessment.json')]
        result=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8',env=env);write(a.out/'actual-checker-command.json',{'argv':argv,'native_exit':result.returncode,'stdout':result.stdout,'stderr':result.stderr})
        if result.returncode!=0:raise RuntimeError('whole real online result failed policy/journal checker')
        write(a.out/'owner-terminal.json',{'status':'native_whole_completed','at':now(),'native_exit':0,'seconds':time.perf_counter()-start,'paths':8,'actual_commits':128,'control_commits':16,'worker_processes':len(commands),'actual_controller_exits':[v['native_exit'] for v in commands],'original_receipt_recovered':True,'row_order_control':folder.relative_to(a.out).as_posix(),'control_path_after_terminal':control_path['id'],'private_order_after_terminal':[v['path'] for v in episodes],'whole_case_review':'pending','score':None,'limits':'native dataflow and one controlled process-loss proof, no OS security/power-loss certificate or candidate hours'})
        print((a.out/'owner-terminal.json').read_text());return 0
    except Exception as error:
        write(a.out/'owner-error.json',{'at':now(),'error':str(error),'traceback':traceback.format_exc(),'completed_episodes':episodes,'action':'preserve all actual objects; no automatic replay or replacement'});raise
if __name__=='__main__':raise SystemExit(main())
