"""Resume an owned exercise episode using its original SQLite and source.
Never copies, rewinds or edits journal rows. Parent-only outcome sequence.
"""
import argparse,json,os,subprocess,sys,datetime
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--run',type=Path,required=True);p.add_argument('--episode',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
worlds=json.loads((a.run/'worlds-after-terminal.json').read_text(encoding='utf-8'));record=next(x for x in worlds if x['directory']==a.episode)
world=json.loads((a.run/f"policy-tree-{record['instance']}.json").read_text(encoding='utf-8'))['leaves'][record['original_leaf']]
a.out.mkdir(parents=True,exist_ok=False)
argv=[sys.executable,'-B','-u',str(a.run/'controller-source/exercise.py'),'--controller','--project',str(a.run/'sealed-project'),'--public',str(a.run/'public'),'--instance',str(a.run/'public/instances'/record['instance']),'--db',str(a.run/a.episode/'journal.sqlite3'),'--out',str(a.out/'controller'),'--python',sys.executable]
proc=subprocess.Popen(argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
stdout,stderr=proc.communicate(json.dumps(world,separators=(',',':')))
(a.out/'invocation.json').write_text(json.dumps({'argv':argv,'pid':proc.pid,'native_exit':proc.returncode,'stdout':stdout,'stderr':stderr,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'database':'same original journal; no rewind or copied receipt import','transport':'world only to parent controller stdin; actor only full observed packet'},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'native_exit':proc.returncode,'record':str(a.out/'invocation.json')}));sys.exit(proc.returncode)
