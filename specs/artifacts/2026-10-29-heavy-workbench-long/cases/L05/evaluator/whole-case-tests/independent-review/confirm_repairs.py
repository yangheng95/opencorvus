from pathlib import Path
import json,shutil,subprocess,time
R=Path(__file__).parent;X=Path('D:/opencorvus-benchmark-runs/l05-full-case-20261031');C=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L05');S=R/'case-repaired';(S/'evaluator').mkdir(parents=True);(S/'public').mkdir()
for n in ['logical_store.py','l05_effects.py','l05_transport.py']:shutil.copy2(C/'public'/n,S/'public'/n)
for n in ['check_l05.py','registered-inputs.json']:shutil.copy2(C/'evaluator'/n,S/'evaluator'/n)
shutil.copy2(C/'rubric.json',S/'rubric.json')
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def call(name,run):
 argv=['C:/Python314/python.exe','-X','utf8','-B',str(S/'evaluator/check_l05.py'),'--run',str(run),'--raw',str(X/'raw-closed-base'),'--registered',str(S/'evaluator/registered-inputs.json'),'--rubric',str(S/'rubric.json'),'--out',str(R/(name+'-repaired-result'))];st=time.monotonic();p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');receipt=dict(argv=argv,exit_code=p.returncode,seconds=time.monotonic()-st,stdout=p.stdout,stderr=p.stderr,scope='Pure checker replay of preserved actual capture or isolated object mutation; zero new actor/receiver/native.');(R/(name+'-repaired-command.json')).write_text(json.dumps(receipt,indent=2));return load(R/(name+'-repaired-result/assessment.json'))
checks={}
for name,leaf in [('monitor-object','M12'),('native-identity',None),('planned-wire','M10'),('new-epoch','M06'),('exports','M14')]:
 a=call(name,R/(name+'-mutation'));checks[name]=(a['status']=='run_invalid' and a['total'] is None) if leaf is None else a['findings'][leaf]['status']=='verified_fail'
target=R/'plan-wire-equivalent';shutil.copytree(X/'closed-main-base/results/run',target);events=load(target/'events.json');event=next(e for e in events if e.get('pause')=='after_plan_commit');row=event['checkpoint_sql']['local']['postings'][-1];row['payload']=json.dumps(dict(reversed(list(json.loads(row['payload']).items()))),ensure_ascii=False,indent=2);(target/'events.json').write_text(json.dumps(events,ensure_ascii=False,indent=2));a=call('plan-wire-equivalent',target);checks['equivalent_new_JSON_wire_accepted']=a['findings']['M10']['status']=='verified_pass'
a=call('restore-backup-current',X/'closed-restore_backup-base/results/run');restore={k:v['status'] for k,v in a.get('findings',{}).items()};(R/'repair-confirmation.json').write_text(json.dumps(dict(checks=checks,failures=[k for k,v in checks.items() if not v],restore_original_findings=restore),indent=2));print(json.dumps(dict(checks=checks,restore=restore),indent=2))
