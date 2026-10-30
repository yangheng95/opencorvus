"""Source-only whole L08 reference. All project days are simulated indices."""
import argparse,csv,json,subprocess,sys
from pathlib import Path
from ortools.sat.python import cp_model
from l08_core import world,scenario,starts,bound,replay,manifest,save,Facility

def solve(w,event):
 proof,active=bound(w,event);off,modes=scenario(w,event);model=cp_model.CpModel();opts={};allopts=[]
 for task in w['tasks']:
  opts[task]=[]
  for name in sorted(active[task]):
   a=modes[task][name]
   for s in starts(w,a,off):
    end=s+a['duration']
    if end>proof['finish_lower_bound']:continue
    b=model.new_bool_var(f'{task}_{name}_{s}');o=dict(task=task,mode=name,start=s,end=end,a=a,b=b)
    opts[task].append(o);allopts.append(o)
  expr=sum(o['b'] for o in opts[task])
  if w['tasks'][task]['mandatory'] or (task=='F01' and proof['optional_possible']):model.add(expr==1)
  else:model.add(expr==0)
 def time(t,k):return sum(o[k]*o['b'] for o in opts[t]) if t in opts else w['history'][t][k]
 for t,a in w['tasks'].items():
  for d in a['deps']:
   if a['mandatory']:model.add(time(d,'end')<=time(t,'start'))
   else:
    for o in opts[t]:model.add(time(d,'end')<=o['start']).only_enforce_if(o['b'])
 for o in opts.get('F01',[]):model.add(o['end']<=time('C00','start')).only_enforce_if(o['b'])
 model.add(time('HANDOFF','end')==proof['finish_lower_bound'])
 for r in w['rates']:
  for day in range(12,proof['finish_lower_bound']):
   terms=[o['b'] for o in allopts if r in o['a']['resources'] and o['start']<=day<o['end']]
   if terms:model.add(sum(terms)<=1)
 tr=w['treasury'];finish=proof['finish_lower_bound']
 model.add(w['past_cost']+sum(o['a']['cost']*o['b'] for o in allopts)+tr['overhead_per_day']*(finish-12)<=tr['budget_total'])
 for day in range(12,finish):
  receipt=sum(tr['client_milestone']['amount']*o['b'] for o in opts['R02'] if o['end']+tr['client_milestone']['delay']<=day)
  costs=sum((o['a']['commit_fee']+(o['a']['start_fee'] if o['start']<=day else 0)+o['a']['daily']*max(0,min(day+1,o['end'])-o['start']))*o['b'] for o in allopts)
  model.add(w['cash']+(tr['funding']['amount'] if tr['funding']['day']<=day else 0)+receipt-costs-tr['overhead_per_day']*(day+1-12)>=0)
 solver=cp_model.CpSolver();solver.parameters.num_search_workers=1;solver.parameters.random_seed=20261030
 status=solver.solve(model)
 if status not in (cp_model.FEASIBLE,cp_model.OPTIMAL):raise Facility('reference_witness_failed:'+solver.status_name(status))
 plan={'tasks':[{k:o[k] for k in ('task','mode','start','end')} for o in allopts if solver.boolean_value(o['b'])]}
 actual=replay(w,event,plan,True)
 if actual['errors']:raise Facility('reference_replay:'+str(actual['errors']))
 return plan,proof,{'status':solver.status_name(status),'wall_seconds':solver.wall_time,'objective':'feasibility at independently relaxed date bound; not exact cost optimization'}
def deliver(source,out,weak=False):
 out.mkdir(parents=True,exist_ok=False);w=world(source)
 command=[sys.executable,'-B',str(Path(__file__).resolve()),'--source',str(source),'--out',str(out/'component-run'),'--component-only']
 proc=subprocess.run(command,capture_output=True,text=True)
 save(out/'component-native.json',{'argv':command,'exit_code':proc.returncode,'stdout':proc.stdout,'stderr':proc.stderr})
 if proc.returncode!=0:raise Facility('reference_component_native')
 actual=json.loads((out/'component-run/manifest.json').read_text(encoding='utf-8'))
 if actual!=manifest(source):raise Facility('reference_component_semantics')
 save(out/'manifest.json',actual);save(out/'history.json',list(w['history'].values()));save(out/'paid-ledger.json',w['payments'])
 plans={};proofs={};runs={};ledgers={}
 for e in w['events']:
  plan,proof,native=solve(w,e);plans[e['id']]=plan;proofs[e['id']]=proof;runs[e['id']]=native
  ledgers[e['id']]=replay(w,e,plan,True)
 save(out/'plans.json',plans);save(out/'bounds.json',proofs);save(out/'solver-runs.json',runs);save(out/'execution.json',ledgers)
 with (out/'cash-ledger.csv').open('w',encoding='utf-8',newline='') as f:
  wr=csv.DictWriter(f,fieldnames=['scenario','day','inflow','expense','cash_end','cumulative_cost']);wr.writeheader()
  for scenario_id,a in ledgers.items():
   for row in a['cash_ledger']:wr.writerow(dict(scenario=scenario_id,**row))
 with (out/'schedule.csv').open('w',encoding='utf-8',newline='') as f:
  wr=csv.writer(f);wr.writerow(['scenario','task','mode','start','end','resources'])
  for scenario_id,plan in plans.items():
   for a in plan['tasks']:wr.writerow([scenario_id,a['task'],a['mode'],a['start'],a['end'],';'.join(w['modes'][a['task']][a['mode']]['resources'])])
 import matplotlib;matplotlib.use('Agg')
 import matplotlib.pyplot as plt
 fig,axes=plt.subplots(2,2,figsize=(14,11));colors={'Ada':'#2f6ab1','Ben':'#bb6424','Cy':'#168069','Di':'#7c4e9b','Vendor':'#666666'}
 for ax,e in zip(axes.flat,w['events']):
  plan=plans[e['id']];ordered=sorted(plan['tasks'],key=lambda a:(a['start'],a['task']))
  for i,a in enumerate(ordered):
   r=w['modes'][a['task']][a['mode']]['resources'][0];ax.barh(i,a['end']-a['start'],left=a['start'],color=colors.get(r,'#777777'))
  ax.set_yticks(range(len(ordered)),[a['task'] for a in ordered],fontsize=7);ax.invert_yaxis();ax.axvline(33,color='#b00020',linestyle='--');ax.set_xlim(11,40);ax.grid(axis='x',alpha=.2)
  v=ledgers[e['id']];ax.set_title(f"{e['id']} finish {v['finish']} | cost {v['total_cost']} | F01 {v['optional_retained']}",fontsize=9);ax.set_xlabel('Simulated business-day index')
 fig.suptitle('L08 feasible forecast schedules; historical work remains unchanged');fig.tight_layout();fig.savefig(out/'gantt.png',dpi=140);plt.close(fig)
 fig,ax=plt.subplots(figsize=(10,4))
 for e,a in ledgers.items():ax.step([r['day'] for r in a['cash_ledger']],[r['cash_end'] for r in a['cash_ledger']],where='post',label=e)
 ax.axhline(0,color='black');ax.set_xlabel('Simulated business-day index');ax.set_ylabel('End-of-day cash (cost units)');ax.legend();ax.grid(alpha=.2);fig.tight_layout();fig.savefig(out/'cash.png',dpi=140);plt.close(fig)
 report=['# L08 controlled reconstruction','All source archives are original fictional material. Four known scenarios are independent forecasts from day12, not an online surprise experiment.',f"Historical paid cost {w['past_cost']}; checkpoint cash {w['cash']}. H04 delivered defective software; its invoice remains sunk. A08 deposit is retained, not refunded.",'## Actual limited acceptance',f"Repaired component executed as a real child process: exit {proc.returncode}. Tenant totals {actual['totals_by_tenant']}. Identity errors, invalid units and conflicts are quarantined with sources; future rows withheld. This validates the manifest contract, not an entire product or all underlying records. R01 and R02 remain scheduled new work; client cash is conditional on this limited acceptance.",'## Date, cost and scope decisions']
 for e,a in ledgers.items():
  p=proofs[e];report.append(f"- {e}: minimum finish {a['finish']}, request +{a['extension_requested']} days; approval remains pending ({a['extension_approved']}). Cost {a['total_cost']} <= {w['treasury']['budget_total']}; minimum daily cash {min(x['cash_end'] for x in a['cash_ledger'])}. F01 retained={a['optional_retained']}.")
  report.append(f"  Independent relaxed earliest ends {p['relaxed_earliest_ends']}; minimum fixed cost {p['minimum_fixed_cost']}. Removed modes: {p['removed_modes']}. Conditional cost lower bounds include sunk costs and the unavoidable overhead at the current valid finish lower bound. Recompute until stable; ignored resource collisions make the relaxed date optimistic. A feasible actual schedule reaches this lower bound, proving minimum finish within the stated modes/calendar. This proves no exact cost optimum.")
 report+=['## Draft decision and operating handover','Project office requests the listed deadline extensions; no approval is fabricated. Client sponsor must approve revised dates; procurement owns A08 balance and supplier slot; Ada owns repair/integration; Cy owns regression/certification and raw-data exception evidence; Di owns training and final handover. Preserve original actuals/payments and track new scope changes separately. F01 may be deferred only where the exact budget/date tests require it.','If source conflicts are resolved, rerun manifest and acceptance evidence before claiming their release; source ownership sits with the tenant data steward. Funding at16 and conditional receipt depend on their specified contracts, not a guaranteed real-world collection forecast. If receipt or supplier slot changes, stop using this cash plan and recompute. Certification and sole-trainer absence are distinct triggers.','## Rebuild and artifacts','Run the declared programme with --source and --out on a clean directory; component-only uses the same inputs and emits manifest.json. schedule.csv is one feasible forecast; cash-ledger.csv is every daily inflow/outflow/cumulative cost; execution.json binds facts, resources, scope and approval status; bounds.json records the mathematical argument. gantt.png and cash.png are generated from these actual plans and ledgers. Historical and future records remain distinct. Native solver status only witnesses a feasible schedule at an independently derived bound.']
 if weak:report+=['## Management guarantee','All extensions are already approved and the entire production platform has passed every quality and security gate. The client is guaranteed to pay on schedule.']
 (out/'REPORT.md').write_text('\n\n'.join(report),encoding='utf-8')
def main():
 p=argparse.ArgumentParser();p.add_argument('--source',required=True,type=Path);p.add_argument('--out',required=True,type=Path);p.add_argument('--component-only',action='store_true');p.add_argument('--weak-report',action='store_true');a=p.parse_args()
 if a.component_only:a.out.mkdir(parents=True,exist_ok=False);save(a.out/'manifest.json',manifest(a.source))
 else:deliver(a.source,a.out,a.weak_report)
if __name__=='__main__':main()
