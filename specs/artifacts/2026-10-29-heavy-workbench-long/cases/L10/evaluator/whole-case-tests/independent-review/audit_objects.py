from pathlib import Path
import json,csv,sqlite3,zipfile,datetime
R=Path(__file__).parent;X=Path('D:/opencorvus-benchmark-runs/l10-full-case-20261031')
def j(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
checks=[]
def ck(k,v,detail=None):checks.append(dict(check=k,pass_=bool(v),detail=detail))
def blobtree(p):return {f.relative_to(p).as_posix():f.read_bytes() for f in p.rglob('*') if f.is_file()}
# Direct actual source/input object identity and precisely observed terminal state.
refs={};native=[]
for variant in ('base','price','quote'):
 p=X/f'final-{variant}-run';refs[variant]=j(p/'delivery/result/study.json');rr=j(p/'runs.json')['episodes'];cases={q.stem:j(q) for q in (X/'cases'/variant).glob('*.json')}
 for stage in ('prepare','delivery'):
  ins=j(p/stage/'terminal-inspect.json');launch=j(p/stage/'launch.json');m={a['Destination']:a for a in ins['Mounts']};expected={'/program','/results','/raw'}|({'/evidence'} if stage=='delivery' else set());ck('native preparation/report permissions',set(m)==expected and all(not v['RW'] for k,v in m.items() if k!='/results') and m['/results']['RW'] and ins['HostConfig']['NetworkMode']=='none' and ins['HostConfig']['NanoCpus']==1000000000 and ins['State']['ExitCode']==0 and ins['Id']==launch['cid'],(variant,stage));native.append(dict(variant=variant,stage=stage,id=ins['Id'],started=ins['State']['StartedAt'],finished=ins['State']['FinishedAt'],exit=ins['State']['ExitCode'],mounts=m))
 ck('report source exact raw delivery',blobtree(X/'raw'/variant)==blobtree(p/'delivery/result/original-source'))
 packetinput=j(p/'report-evidence/results.json')['episodes']
 for r in packetinput:
  root=p/'episodes'/r['scenario']/r['site']/r['device'];res=j(root/'result.json');db=sqlite3.connect((root/'plant.sqlite3').as_uri()+'?mode=ro',uri=True);tele=[json.loads(q[0])['current'] for q in db.execute('select packet from step order by i')];db.close();ck('report actual input telemetry ledger binding','bill' not in r and r['ledger']==res['ledger'] and r['state']==res['state'] and r['telemetry']==tele)
for variant in ('price','quote'):
 for rel in blobtree(X/'raw/base'):
  if (X/'raw/base'/rel).read_bytes()!=(X/'raw'/variant/rel).read_bytes():checks.append(dict(check='original changed raw member',pass_=True,detail=(variant,rel)))
price0={p.stem:j(p) for p in (X/'cases/base').glob('*.json')};price1={p.stem:j(p) for p in (X/'cases/price').glob('*.json')};quote1={p.stem:j(p) for p in (X/'cases/quote').glob('*.json')}
ck('quote cases unchanged',quote1==price0)
price_changes=[]
for case in price0:
 for site,series in price0[case]['actual'].items():
  for i,a in enumerate(series):
   b=price1[case]['actual'][site][i]
   if a!=b:price_changes.append((case,site,i,a['price'],b['price']));ck('price control current single field',set(k for k in a if a[k]!=b[k])=={'price'} and site=='CLINIC' and abs(b['price']-a['price']-.3)<1e-12)
 for site,series in price0[case]['forecasts'].items():
  for i,a in enumerate(series):
   b=price1[case]['forecasts'][site][i]
   if a!=b:ck('price control forecast same release/identity',set(k for k in a if a[k]!=b[k])=={'values'} and {k for k in a['values'] if a['values'][k]!=b['values'][k]}=={'price'} and site=='CLINIC')
# Controlled weak and idle are real separate native programmes; judge text, not names.
controls={}
for name in ('weak','idle'):
 controls[name]={}
 for variant in ('base','price','quote'):
  p=X/f'{name}-{variant}-run';text=(p/'delivery/result/REPORT.md').read_text();ck(name+' real native complete',j(p/'execution-status.json')['execution_complete'] and j(p/'execution-status.json')['episodes']==18)
  study=j(p/'delivery/result/study.json');manifest=j(p/'sealed-program/submission.json');allzero=True;samemain=True
  for r in j(p/'runs.json')['episodes']:
   root=Path(r['root']);db=sqlite3.connect((root/'plant.sqlite3').as_uri()+'?mode=ro',uri=True);aa=[json.loads(a[0])['power_kw'] for a in db.execute('select action from step order by i')];db.close();allzero&=all(a==0 for a in aa)
   if name=='weak':
    original=X/f'final-{variant}-run/episodes'/r['scenario']/r['site']/r['device'];samemain&=j(root/'result.json')==j(original/'result.json')
  if name=='weak':ck('weak original numerical objects same',samemain and study==refs[variant]);ck('weak actual false declaration',all(s in text for s in ['all real clinic loads','electrically certified','returns are guaranteed']))
  else:
   ck('idle actually zero action',allzero and '--mode' in manifest['control_argv'] and 'idle' in manifest['control_argv']);ck('idle method/report contradiction','causal16-step LP' in text)
  controls[name][variant]=dict(control_argv=manifest['control_argv'],report_argv=manifest['report_argv'],same_main_numerical=samemain if name=='weak' else None,all_actions_zero=allzero,actual_report_text=text)
ck('rubric total and IDs',sum(a['weight'] for a in j(R/'rubric-initial.json')['leaves'])==100 and len({a['id'] for a in j(R/'rubric-initial.json')['leaves']})==19)
out=dict(checks=checks,failures=[c for c in checks if not c['pass_']],native=native,controls=controls,price_current_changes=price_changes)
(R/'object-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(dict(checks=len(checks),failures=len(out['failures']),native_records=len(native))))
# Seal this reviewer's one already-completed cold run after its runner saved and
# cleaned exact owned terminal containers. No new native or cleanup is performed.
with zipfile.ZipFile(R/'own-cold-originals.zip','w',zipfile.ZIP_DEFLATED) as z:
 for directory in ('cold-run','cold-program','cold-input','cold-evaluator'):
  for p in (R/directory).rglob('*'):
   if p.is_file():z.write(p,p.relative_to(R).as_posix())
(R/'own-cold-seal.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),members=len(zipfile.ZipFile(R/'own-cold-originals.zip').namelist()),scope='One own source-only cold execution; all inspect/log/SQLite/source/input records retained. Runner saved each terminal before exact owned docker rm. ZIP collected after runner return, not retroactively claimed pre-cleanup ZIP.'),indent=2))
