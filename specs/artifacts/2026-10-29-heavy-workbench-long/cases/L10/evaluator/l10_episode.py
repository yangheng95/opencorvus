"""One real, isolated controller and a durable authoritative plant ledger.

The controller Docker never mounts this module, private case, SQLite or host path.
"""
import argparse,json,os,sqlite3,subprocess,time,uuid,sys
from pathlib import Path
from l10_core import read,save,authority,initial,packet,transition,bill
IMAGE='sha256:23ff8bfbf8055caa0b9fa5745ddb27cceea2f31d7d15b7a900c81112cdfe8ddf'
def run(a):
 src=a.source.resolve();out=a.out.resolve();out.mkdir(parents=True,exist_ok=True);db=sqlite3.connect(out/'plant.sqlite3')
 db.execute('pragma journal_mode=WAL');db.execute('pragma user_version=1');db.execute('create table if not exists step(i integer primary key,packet text not null,action text not null,receipt text not null,state text not null)');db.execute('create table if not exists meta(key text primary key,value text not null)')
 facts=authority(a.raw);case=read(a.case);dev=facts['devices'][a.device];ident={'site':a.site,'device':a.device,'raw':facts,'case':case}
 old=db.execute('select value from meta where key=?',('identity',)).fetchone()
 if old is None:db.execute('insert into meta values(?,?)',('identity',json.dumps(ident,sort_keys=True)));db.commit()
 elif json.loads(old[0])!=ident:raise ValueError('durable_episode_identity_mismatch')
 prior=db.execute('select i,receipt,state from step order by i').fetchall();state=json.loads(prior[-1][2]) if prior else initial(facts,a.site);receipts=[json.loads(r[1]) for r in prior]
 stage=out/('resume' if prior else 'initial');stage.mkdir();name='oc-l10-actor-'+uuid.uuid4().hex[:16]
 cmd=['docker','create','--name',name,'--interactive','--network','none','--cpus','1','--mount',f'type=bind,src={src},dst=/program,readonly','--mount',f'type=bind,src={a.model.resolve()},dst=/model,readonly','--workdir','/program',IMAGE,*read(src/'submission.json')['control_argv']]
 cid=subprocess.check_output(cmd,text=True).strip();save(stage/'create.json',{'argv':cmd,'cid':cid,'mode':'readonly source/model only; private cases/plant never mounted'})
 log=(stage/'stderr.txt').open('w',encoding='utf-8');proc=subprocess.Popen(['docker','start','--attach','--interactive',cid],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=log,text=True,encoding='utf-8',bufsize=1)
 def call(p):
  proc.stdin.write(json.dumps(p,allow_nan=False)+'\n');proc.stdin.flush();line=proc.stdout.readline()
  if not line:raise ValueError('controller_eof_before_response')
  v=json.loads(line)
  if type(v) is not dict:raise ValueError('controller_response_object')
  return v
 try:
  if prior:
   ans=call({'kind':'receipt_replay','receipt':receipts[-1]});save(stage/'replay.json',{'receipt':receipts[-1],'response':ans})
   if ans.get('acknowledged')!=receipts[-1]['key']:raise ValueError('confirmed_receipt_acknowledgement')
  for i in range(state['next'],len(case['actual'][a.site])):
   p=packet(facts,case,a.site,dev,i,state,receipts);act=call(p);s,row=transition(facts,a.site,dev,state,p['current'],act);receipt={'key':f'{a.site}:{a.device}:{i}','row':row}
   db.execute('insert into step values(?,?,?,?,?)',(i,json.dumps(p),json.dumps(act),json.dumps(receipt),json.dumps(s)));db.commit();state=s;receipts.append(receipt)
   if a.crash_step==i:
    save(out/'committed-before-exit.json',{'i':i,'receipt':receipt,'soc':s['soc'],'peaks':s['peaks'],'contract':'actual SQLite commit before process exit73 and lost acknowledgement'});os._exit(73)
  proc.stdin.close();native=proc.wait(timeout=30)
  if native!=0:raise ValueError('controller_native_failed:'+str(native))
  if abs(state['soc'])>2e-5:raise ValueError('terminal_soc_zero')
  save(out/'result.json',{'site':a.site,'device':a.device,'state':state,'bill':bill(facts,a.site,state),'ledger':receipts,'steps':len(receipts)})
 finally:
  try:proc.stdin.close()
  except (ValueError,BrokenPipeError):pass
  if proc.poll() is None:proc.wait(timeout=30)
  log.close();db.close()
  inspect=json.loads(subprocess.check_output(['docker','inspect',cid],text=True))[0];save(stage/'terminal-inspect.json',inspect)
  (stage/'stdout-docker-log.txt').write_text(subprocess.check_output(['docker','logs',cid],stderr=subprocess.STDOUT,text=True,encoding='utf-8'),encoding='utf-8')
  if inspect['State']['Status']=='exited':subprocess.run(['docker','rm',cid],check=True,capture_output=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--raw',type=Path,required=True);p.add_argument('--model',type=Path,required=True);p.add_argument('--case',type=Path,required=True);p.add_argument('--site',required=True);p.add_argument('--device',required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--crash-step',type=int,default=-1);a=p.parse_args()
 try:run(a)
 except Exception as e:save(a.out/'failure.json',{'error':type(e).__name__,'detail':str(e)});raise
