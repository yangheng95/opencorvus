"""Case-specific real actor/tree execution, SQLite receipts and two process cuts.

Only future laboratory outcomes reach the controller on stdin, never the actor.
No solver, rubric, reference policy, model call or general evaluation framework.
"""
from pathlib import Path
from fractions import Fraction as F
import argparse,datetime,json,os,queue,secrets,shutil,sqlite3,subprocess,sys,threading,time,traceback,zipfile
from model import load,canonical,exact,require,ContractError,posterior,predictive,packet,advance,belief_wire

def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def write(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def jsonable(x):
    if isinstance(x,F):return str(x)
    if isinstance(x,dict):return {k:jsonable(v) for k,v in x.items()}
    if isinstance(x,list):return [jsonable(v) for v in x]
    return x
def capsule(folder,path):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted(folder.rglob('*')):
            if p.is_file() and '__pycache__' not in p.parts:z.write(p,p.relative_to(folder).as_posix())

class Actor:
    def __init__(self,project,public,instance,python,where):
        self.where=where;where.mkdir(exist_ok=False,parents=True);self.q=queue.Queue()
        declaration=json.loads((project/'submission.json').read_text(encoding='utf-8'))
        require(declaration['format']=='l06-inspection-submission/1' and type(declaration['argv']) is list,'declared_actor_entry')
        values={'python':str(python),'project':str(project),'public':str(public),'instance':str(instance)}
        argv=[v.format(**values) for v in declaration['argv']]
        self.err=(where/'stderr.txt').open('w',encoding='utf-8');self.wire=(where/'wire.jsonl').open('w',encoding='utf-8')
        self.proc=subprocess.Popen(argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.err,text=True,encoding='utf-8',bufsize=1,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        write(where/'worker-started.json',{'at':now(),'pid':self.proc.pid,'argv':argv,'future_input':'none; complete current public packet only'})
        def read():
            for line in self.proc.stdout:self.q.put(line)
            self.q.put(None)
        threading.Thread(target=read,daemon=True).start()
    def ask(self,current):
        self.proc.stdin.write(canonical(current)+'\n');self.proc.stdin.flush()
        try:line=self.q.get(timeout=30)
        except queue.Empty:raise ContractError('actor_response_timeout_30s')
        require(line is not None,'actor_response_eof')
        response=json.loads(line);self.wire.write(canonical({'packet':current,'response':response})+'\n');self.wire.flush()
        require(type(response) is dict and set(response)=={'format','request_id','belief','action'} and response['format']=='l06-inspection-response/1','actor_response_shape')
        require(type(response['request_id']) is str and 0<len(response['request_id'])<=256,'request_identity')
        return response
    def close(self):
        if self.proc.stdin and not self.proc.stdin.closed:self.proc.stdin.close()
        try:code=self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:self.proc.terminate();code=self.proc.wait(timeout=5)
        self.wire.close();self.err.close();write(self.where/'worker-terminal.json',{'at':now(),'native_exit':code,'pid':self.proc.pid,'closure':'owned input EOF; no user process action'})
        return code

def response_check(data,current,response):
    weights=posterior(data,current['committed']);b=response['belief']
    require(type(b) is dict and set(b)==set(weights),'complete_mode_belief')
    require(all(exact(b[m])==v for m,v in weights.items()),'bayesian_original_observations')
    return weights

def append_item(data,history,response,observation):
    current=packet(data,history);state=current['state'];after=advance(data,state,response['action'],observation)
    return {'seq':len(history),'week':state['week'],'phase':state['phase'],'request_id':response['request_id'],
            'action':response['action'],'observation':observation,'post_state':after}

def discover(data,actor):
    leaves=[];nodes=[]
    def visit(history,probability):
        current=packet(data,history)
        if current['state']['terminal']:
            leaves.append({'history':history,'probability':str(probability),'cost':current['state']['cumulative_cost']});return
        response=actor.ask(current);weights=response_check(data,current,response)
        state=current['state'];v=response['action'].get('test') if state['phase']=='laboratory' else None
        outcomes=[(None,F(1))] if v is None else [('good',predictive(data,weights,v)),('reject',1-predictive(data,weights,v))]
        nodes.append({'packet':current,'response':response,'reach_probability':str(probability)})
        for observation,p in outcomes:
            require(p>0,'positive_tree_branch');item=append_item(data,history,response,observation)
            visit(history+[item],probability*p)
    visit([],F(1));require(sum(F(v['probability']) for v in leaves)==1,'complete_policy_probability_mass')
    return leaves,nodes

def controller(a):
    a.out.mkdir(parents=True,exist_ok=False);data=load(a.instance);world=json.loads(sys.stdin.read());a.db.parent.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(a.db);db.execute('PRAGMA journal_mode=WAL');db.execute('PRAGMA synchronous=FULL')
    db.execute('CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK(id=1), law TEXT NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS commits (seq INTEGER PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, receipt TEXT NOT NULL, packet TEXT NOT NULL, response TEXT NOT NULL)')
    law=canonical(jsonable(data));old=db.execute('SELECT law FROM meta WHERE id=1').fetchone()
    if old:require(old[0]==law,'journal_original_law')
    else:db.execute('INSERT INTO meta VALUES (1,?)',(law,));db.commit()
    original=db.execute('SELECT seq,request_id,payload,receipt,packet,response FROM commits ORDER BY seq').fetchall()
    history=[json.loads(row[3]) for row in original];actor=Actor(a.project,a.public,a.instance,a.python,a.out/'worker')
    write(a.out/'controller-started.json',{'at':now(),'pid':os.getpid(),'argv':sys.argv,'existing_rows':len(original),'future_transport':'parent stdin; not persisted or supplied to actor'})
    try:
        packet(data,history)
        if original:
            prior_packet=json.loads(original[-1][4]);response=actor.ask(prior_packet);response_check(data,prior_packet,response)
            require(response['request_id']==original[-1][1],'original_request_identity_after_process_loss')
            require(canonical({'action':response['action'],'belief':response['belief']})==original[-1][2],'original_payload_after_process_loss')
            recovered=db.execute('SELECT receipt FROM commits WHERE request_id=?',(response['request_id'],)).fetchone()[0]
            require(recovered==original[-1][3],'original_stored_receipt')
            write(a.out/'resume-receipt.json',{'request_id':response['request_id'],'original_receipt':json.loads(recovered),'next_seq':len(history),'replayed_existing_result':True,'new_sample_drawn':False})
        while not packet(data,history)['state']['terminal']:
            current=packet(data,history);response=actor.ask(current);response_check(data,current,response)
            expected=world['history'][len(history)]
            require(canonical(response['action'])==canonical(expected['action']),'deterministic_original_prefix_policy')
            observation=expected['observation'];item=append_item(data,history,response,observation)
            payload=canonical({'action':response['action'],'belief':response['belief']})
            row=db.execute('SELECT payload,receipt FROM commits WHERE request_id=?',(response['request_id'],)).fetchone()
            require(row is None,'new_stage_original_key_required')
            db.execute('INSERT INTO commits VALUES (?,?,?,?,?,?)',(item['seq'],response['request_id'],payload,canonical(item),canonical(current),canonical(response)));db.commit();history.append(item)
            cut=(a.crash_kind=='order' and item['phase']=='operations' and item['action']['order'] is not None) or (a.crash_kind=='laboratory' and item['phase']=='laboratory' and item['action']['test'] is not None)
            if cut:
                write(a.out/'original-prefix.json',db.execute('SELECT seq,request_id,payload,receipt,packet,response FROM commits ORDER BY seq').fetchall())
                write(a.out/'crash-after-commit.json',{'at':now(),'kind':a.crash_kind,'committed_seq':item['seq'],'original_key':response['request_id'],'observed_result':observation,'worker_exit_before_cut':actor.close(),'controller_actual_exit':73,'acknowledgement':'not emitted before this cut'})
                db.close();os._exit(73)
        write(a.out/'journal-export.json',history);write(a.out/'controller-terminal.json',{'at':now(),'native_exit':0,'rows':len(history),'terminal_state':history[-1]['post_state']});db.close();require(actor.close()==0,'actor_natural_terminal')
    except Exception as error:
        write(a.out/'failure.json',{'at':now(),'code':getattr(error,'code',type(error).__name__),'error':str(error),'actual_prefix':history,'traceback':traceback.format_exc()})
        db.close();actor.close();raise

def main(a):
    a.out.mkdir(parents=True,exist_ok=False);start=time.perf_counter();project=a.out/'sealed-project';public=a.out/'public';shutil.copytree(a.project,project);shutil.copytree(a.public,public,ignore=shutil.ignore_patterns('__pycache__'))
    capsule(project,a.out/'pre-execution-project.zip');capsule(public,a.out/'public-originals.zip')
    controller_src=a.out/'controller-source';controller_src.mkdir();shutil.copy2(Path(__file__),controller_src/'exercise.py');shutil.copy2(Path(__file__).with_name('model.py'),controller_src/'model.py');capsule(controller_src,a.out/'pre-execution-controller.zip')
    write(a.out/'owner-started.json',{'at':now(),'pid':os.getpid(),'argv':sys.argv,'scope':'complete actor-produced endogenous policy branches, original SQLite and two controller cuts; no solver/candidate useful hours'})
    commands=[];instances={};native_worlds=[];cut_done={'order':False,'laboratory':False};control_world=None
    def invoke(instance,world,folder,db,kind=None):
        argv=[str(a.python),'-X','utf8','-u','-B',str(controller_src/'exercise.py'),'--controller','--project',str(project),'--public',str(public),'--instance',str(instance),'--db',str(db),'--out',str(folder),'--python',str(a.python)]
        if kind:argv+=['--crash-kind',kind]
        started=now();r=subprocess.run(argv,input=canonical(world),capture_output=True,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        commands.append({'argv':argv,'started_at':started,'finished_at':now(),'native_exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr});write(a.out/'actual-commands.json',commands)
        return r.returncode
    try:
        for instance in sorted((public/'instances').iterdir()):
            if not instance.is_dir():continue
            data=load(instance);actor=Actor(project,public,instance,a.python,a.out/('discovery-'+data['id']))
            try:leaves,nodes=discover(data,actor)
            finally:actor.close()
            order=list(range(len(leaves)));secrets.SystemRandom().shuffle(order);world_records=[]
            for index in order:
                world=leaves[index];ident='episode-'+secrets.token_hex(8);folder=a.out/ident;folder.mkdir();db=folder/'journal.sqlite3';last=None
                if data['id']=='base' and not cut_done['order']:
                    for kind in ['order','laboratory']:
                        out=folder/('cut-'+kind);code=invoke(instance,world,out,db,kind)
                        require(code==73,'actual_controller_cut:'+kind);cut_done[kind]=True;last=out
                out=folder/'completed';require(invoke(instance,world,out,db)==0,'actual_controller_completion')
                actual=json.loads((out/'controller-terminal.json').read_text(encoding='utf-8'))
                require(actual['terminal_state']['cumulative_cost']==world['cost'],'actual_native_policy_cost')
                with sqlite3.connect(db) as connection:final_rows=connection.execute('SELECT seq,request_id,payload,receipt,packet,response FROM commits ORDER BY seq').fetchall()
                for kind in ['order','laboratory']:
                    saved=folder/('cut-'+kind)/'original-prefix.json'
                    if saved.exists():
                        original=json.loads(saved.read_text(encoding='utf-8'))
                        require([list(x) for x in final_rows[:len(original)]]==original,'all_original_rows_retained:'+kind)
                world_records.append({'directory':ident,'probability':world['probability'],'discovered_cost':world['cost'],'controlled_cuts':data['id']=='base' and last is not None})
                native_worlds.append({'directory':ident,'instance':data['id'],'original_leaf':index})
                if data['id']=='base' and control_world is None:control_world=world
            instances[data['id']]={'expected_cost_exact':str(sum(F(v['probability'])*v['cost'] for v in leaves)),'probability_mass':str(sum(F(v['probability']) for v in leaves)),'terminal_histories':len(leaves),'decision_nodes':len(nodes),'episodes':world_records}
            write(a.out/('policy-tree-'+data['id']+'.json'),{'leaves':leaves,'nodes':nodes})
        require(all(cut_done.values()),'both_observed_commit_cuts')
        reordered=a.out/'row-order-public';shutil.copytree(public,reordered)
        for p in (reordered/'instances/base').glob('*.csv'):
            import csv
            with p.open(encoding='utf-8',newline='') as f:rows=list(csv.reader(f))
            # Windows copytree preserves the input read-only bit; only the owned reordered copy is changed.
            import stat
            p.chmod(p.stat().st_mode | stat.S_IWRITE)
            with p.open('w',encoding='utf-8',newline='') as f:csv.writer(f).writerows(rows[:1]+list(reversed(rows[1:])))
        # The actor sees this supplied public copy through the ordinary placeholders.
        other=load(reordered/'instances/base');require(canonical(jsonable(other))==canonical(jsonable(load(public/'instances/base'))),'row_order_same_business')
        old_public=public;public=reordered;control=a.out/'row-order-control';control.mkdir();require(invoke(reordered/'instances/base',control_world,control/'completed',control/'journal.sqlite3')==0,'row_order_actual_completion');public=old_public
        actual_control=json.loads((control/'completed/journal-export.json').read_text(encoding='utf-8'))
        project_business=lambda h:[{k:v for k,v in item.items() if k!='request_id'} for item in h]
        require(canonical(project_business(actual_control))==canonical(project_business(control_world['history'])),'actual_row_order_business')
        write(a.out/'instances.json',instances);write(a.out/'worlds-after-terminal.json',native_worlds)
        terminal={'at':now(),'native_exit':0,'seconds':time.perf_counter()-start,'instances':instances,'controller_cuts':cut_done,'all_source_actor_branches_executed':True,'scope':'finite-model and two controlled process-loss proofs only; no OS/power-loss/candidate-hours certification'};write(a.out/'owner-terminal.json',terminal);print(canonical(terminal))
    except Exception as error:
        write(a.out/'owner-error.json',{'at':now(),'code':getattr(error,'code',type(error).__name__),'error':str(error),'traceback':traceback.format_exc(),'score':None,'action':'preserve original partial source/wires/native failures; no automatic retry'})
        raise

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--controller',action='store_true');p.add_argument('--project',type=Path,required=True);p.add_argument('--public',type=Path,default=Path(__file__).parent);p.add_argument('--instance',type=Path);p.add_argument('--db',type=Path);p.add_argument('--out',type=Path,required=True);p.add_argument('--python',type=Path,default=Path(sys.executable));p.add_argument('--crash-kind',choices=['order','laboratory']);a=p.parse_args()
    controller(a) if a.controller else main(a)
