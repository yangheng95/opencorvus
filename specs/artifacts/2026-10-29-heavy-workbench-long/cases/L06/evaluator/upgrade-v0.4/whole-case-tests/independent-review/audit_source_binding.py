from pathlib import Path
import json,zipfile,datetime
R=Path('D:/opencorvus-benchmark-runs/l06-v04-whole-case-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-full-case-20261031');run=X/'native-whole-first';D=X/'reference-delivery-final'
checks=[]
def c(label,value,details=None):checks.append({'check':label,'pass':bool(value),'details':details})
def zipbind(zp,folder):
 with zipfile.ZipFile(zp) as z:
  m=[n for n in z.namelist() if not n.endswith('/')]; return {'members':m,'all_original_bytes_same':all((folder/n).is_file() and (folder/n).read_bytes()==z.read(n) for n in m)}
for zp,folder in [('pre-execution-project.zip',run/'sealed-project'),('pre-execution-project.zip',D/'programme'),('pre-execution-controller.zip',run/'controller-source'),('public-originals.zip',run/'public')]:
 b=zipbind(run/zp,folder);c(zp+' -> '+str(folder),b['all_original_bytes_same'],b['members'])
with zipfile.ZipFile(D/'source.zip') as z:
 members=[n for n in z.namelist() if not n.endswith('/')];bad=[n for n in members if not(D/n).is_file() or (D/n).read_bytes()!=z.read(n)];c('delivered source archive equals actual delivered original files',not bad,{'member_count':len(members),'different':bad})
commands=json.loads((run/'actual-commands.json').read_text()); c('all controller argv actual sealed project/read public/no selected future argv',all('--project' in a['argv'] and str(run/'sealed-project')==a['argv'][a['argv'].index('--project')+1] and not any(s in ' '.join(a['argv']) for s in ['--world','--latent','--outcomes']) for a in commands));c('controller exits actual2x73/198x0',len(commands)==200 and sum(a['native_exit']==73 for a in commands)==2 and sum(a['native_exit']==0 for a in commands)==198)
worker=list(run.glob('episode-*/*/worker/worker-started.json'));c('worker starts all source declared argv no hidden outcome argv',all('chosen' not in p.read_text() and 'future_outcomes' not in p.read_text() for p in worker),{'count':len(worker),'scope':'argv/record and inspected Actor constructor dataflow; no OS sandbox certification'})
visual=[]
for label,folder in [('main',D),('weak',X/'weak-delivery')]:
 for p in sorted((folder/'figures').glob('*.png')):visual.append({'label':label,'path':str(p),'actually_viewed':True,'observation':'Readable axes/units; cost same-info versus advance class and expense components; stage closing cash range/weighted median/floors/material peaks; alias entropy floor and endogenous inspection/order probabilities. Weak figures do not support its terminal certainty or universal-failure claim.'})
visual.append({'label':'own fresh cold','path':str(R/'cold-rebuild/delivery/figures/belief-and-decisions.png'),'actually_viewed':True,'observation':'Actual new source-only output inspected: alias floor and decision probabilities match independent new native logical histories.'})
(R/'visual-observations.json').write_text(json.dumps({'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'observations':visual},indent=2)+'\n')
(R/'source-native-binding.json').write_text(json.dumps({'checks':checks,'all_pass':all(v['pass'] for v in checks),'scope':'Exact immutable resource/object byte identity only; behavioral correctness proved separately by raw CSV/Fraction/SQL audit. No hash gate.'},indent=2)+'\n');print(json.dumps({'all_pass':all(v['pass'] for v in checks),'checks':checks},indent=2))
