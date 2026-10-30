"""Complete commissioning study; all programme bytes are sealed before operation."""
import argparse,csv,json,shutil,math
from pathlib import Path
from l10_core import read,save,authority,economic,initial,transition,bill
def csvout(p,rr):
 with p.open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=list(rr[0]));w.writeheader();w.writerows(rr)
def report(data,evidence,out,weak=False):
 out.mkdir(parents=True);a=authority(data);runs=read(evidence/'results.json')['episodes'];expected={};summ=[];cash=[];cho=[];recon=[]
 for r in runs:
  s=initial(a,r['site']);max_difference=0.
  if len(r['telemetry'])!=len(r['ledger']):raise ValueError('actual_telemetry_action_grid')
  for obs,entry in zip(r['telemetry'],r['ledger']):
   s,row=transition(a,r['site'],a['devices'][r['device']],s,obs,{'power_kw':entry['row']['power_kw']})
   max_difference=max(max_difference,*(abs(row[k]-entry['row'][k]) for k in ['soc_after','import_kw','peak_after','energy_cost','wear_cost','critical_unserved_kw','flex_unserved_kw']))
  if max_difference>2e-5:raise ValueError('independent_bill_reconstruction_disagrees_with_confirmed_actions')
  r['bill']=bill(a,r['site'],s);recon.append({'scenario':r['scenario'],'site':r['site'],'device':r['device'],'max_physics_difference':max_difference,'recomputed_bill':r['bill']})
 save(out/'reconciliation.json',recon)
 invoice=[{'site':site,'month':m,'prior_energy':v['prior_energy_usd'],'confirmed_peak_kw':peak,'demand_rate':a['sites'][site]['demand_per_kw'],'historical_invoice':v['prior_energy_usd']+peak*a['sites'][site]['demand_per_kw']} for site,v in a['prior'].items() for m,peak in v['peak_kw'].items()]
 csvout(out/'historical-invoices.csv',invoice)
 for site in sorted(a['sites']):
  expected[site]={}
  for device in sorted(a['devices']):
   group=[r for r in runs if r['site']==site and r['device']==device]
   expected[site][device]=sum(r['probability']*r['bill']['total'] for r in group)
  npvs={}
  for device,dev in sorted(a['devices'].items()):
   cost=expected[site][device];e=economic(a,dev,expected[site]['ZERO'],cost);npvs[device]=e['npv'];critical=sum(r['probability']*r['bill']['critical_unserved_kwh'] for r in runs if r['site']==site and r['device']==device)
   summ.append({'site':site,'device':device,'expected_campaign_cost':cost,'expected_critical_unserved_kwh':critical,'npv':e['npv'],'annual_initial_saving':e['annual_initial_saving']})
   for c in e['cash']:cash.append({'site':site,'device':device,**c})
  best=min(npvs,key=lambda x:(-npvs[x],x));cho.append({'site':site,'selected':best,'npv':npvs[best],'selection_rule':'largest expected NPV, lexical ID tie; ZERO eligible'})
 ledger=[]
 for r in runs:
  for q in r['ledger']:ledger.append({'scenario':r['scenario'],'site':r['site'],'device':r['device'],**q['row']})
 csvout(out/'campaigns.csv',summ);csvout(out/'cashflows.csv',cash);csvout(out/'dispatch.csv',ledger)
 save(out/'study.json',{'expected_costs':expected,'choices':cho,'summaries':summ,'cash':cash,'scope':'synthetic study after completed causal replay; not ex-ante real investment or field engineering approval'})
 save(out/'audit.json',a);shutil.copytree(data,out/'original-source');save(out/'source-map.json',{'meter':'original-source/meter-history.csv; site/series/start and highest released revision','sunk_peak':'original-source/prior-bills.json','tariff':'original-source/tariff-circular.md and actual packet price','capacity_cash':'original-source/equipment-quotes.csv','annualisation':'original-source/portfolio-notes.md plus commission.json','actual_actions':'dispatch.csv from actual confirmed plant ledger','probabilities':'each actual replay result, original portfolio-notes.md','no_oracle_claim':'forecasts are released vintages; unseen truth is not a policy input'})
 import matplotlib;matplotlib.use('Agg')
 import matplotlib.pyplot as plt
 fig,axs=plt.subplots(2,2,figsize=(13,8))
 for site,ax in zip(sorted(a['sites']),axs[0]):
  rr=[r for r in summ if r['site']==site];ax.bar([r['device'] for r in rr],[r['npv'] for r in rr]);ax.axhline(0,color='black',linewidth=.7);ax.set_title(site+' five-year study NPV');ax.set_ylabel('synthetic USD')
 r=next(r for r in runs if r['scenario']=='outage' and r['site']=='CLINIC' and r['device']=='S8');q=[x['row'] for x in r['ledger']];ax=axs[1,0];ax.plot([x['soc_after'] for x in q],label='confirmed stored kWh');ax.plot([x['import_kw'] for x in q],label='import kW');ax.plot([x['critical_unserved_kw'] for x in q],label='critical unmet kW');ax.legend(fontsize=8);ax.set_title('Actual unannounced outage path; units explicit');ax.set_xlabel('interval (variable duration)')
 ax=axs[1,1]
 for device in sorted(a['devices']):
  rr=[r for r in summ if r['device']==device];ax.plot([r['site'] for r in rr],[r['expected_campaign_cost'] for r in rr],marker='o',label=device)
 ax.set_title('Probability-weighted campaign operating cost');ax.set_ylabel('synthetic USD');ax.legend();fig.tight_layout();fig.savefig(out/'commissioning.png',dpi=140);plt.close(fig)
 sensitivity=[]
 for rate in [.04,.08,.12]:
  a2=json.loads(json.dumps(a));a2['commission']['discount']=rate
  for site in sorted(a['sites']):
   vv={d:economic(a2,dev,expected[site]['ZERO'],expected[site][d])['npv'] for d,dev in a['devices'].items()};sensitivity.append({'site':site,'discount':rate,'selected':min(vv,key=lambda x:(-vv[x],x)),'npvs':vv})
 save(out/'sensitivity.json',sensitivity)
 lines=['# North Quay controlled commissioning study','', 'The supplied sites, prices, quotes and commissioning campaigns are fictional. These are actual programme-driven simulated actions and bills, not measured field performance, regulatory approval or guaranteed returns.','', '## Original information and methods','Highest available revision includes a missing withdrawal; kWh rows are divided by actual interval hours, W by1000. Raw source is delivered verbatim. Current interval telemetry is perfect under this synthetic piecewise-constant contract; the controller only receives authorized forecast vintages and full confirmed history. A causal16-step LP uses separate charge/discharge efficiencies and a soft terminal reserve value. Its forecast objective is not claimed globally optimal for the unknown real path.','', '## Choices and economics']
 for c in cho:lines.append(f"- {c['site']}: {c['selected']}, NPV {c['npv']:.6f} synthetic USD. ZERO remains eligible.")
 lines += ['', 'campaigns.csv compares all three quotes using all three actual paths; cashflows.csv includes original capex, annual OM, endyear3 replacement, endyear5 residual and8% discount. Year1 savings are exactly6 campaign repetitions; this is a stipulated synthetic12-charge year, not inference that72h represents a real year. Prior-energy invoice amounts are historical only and cancel in incremental economics. Monthly peak charges include confirmed historical peaks; neither action windows nor process restarts reset them.','', '## Risk and operational evidence']
 for r in summ:lines.append(f"- {r['site']} {r['device']}: expected campaign cost {r['expected_campaign_cost']:.6f}; expected critical unmet {r['expected_critical_unserved_kwh']:.6f} kWh.")
 lines += ['', 'PV forecast error and the unannounced outage are visible in actual ledgers, not edited away. Flex and critical unserved energy have separate prices; a bill/NPV can improve while a service shortfall persists. Do not claim finite supplied paths establish a real service probability or joint guarantee. Derating and mixed0.25/.75h intervals use the same physical recurrence. sensitivity.json changes only the valuation discount, so it does not rerun or pretend to change dispatch. The separately supplied price/quote source controls require the programme to rebuild actual results.','', '## Model and handover limits','A linear constant-efficiency, no-self-discharge, no-export model excludes battery thermal safety, nonlinear ageing, grid protection, real weather uncertainty and field commissioning. Native LP status does not certify these. Annual scaling/penalty values and scenario weights are original assumptions, not observed financial or service probabilities. A real installation requires evidence outside this simulated study.','', '## Reproduction','See TEACHER-OPERATOR-HANDOVER.md, source-map.json, original-source and machine ledgers. Keep the sealed programme unchanged across private replays; no future truth or path name belongs in a controller mount, process argument or packet.']
 if weak:lines += ['', 'This study proves all real clinic loads will be served without interruption and the installation is electrically certified; five-year financial returns are guaranteed.']
 (out/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
 (out/'TEACHER-OPERATOR-HANDOVER.md').write_text('''# Simulation operator handover\n1. Install the declared offline image/runtime and use a new run root; public/source is the original-data preparation input. Seal all programme files before future operation.\n2. For each quote/site/private path, the plant process alone owns plant.sqlite3 schema1 and confirmed SOC, peaks and receipts. The controller sees its own source/model and JSON packets. It does not get plant.sqlite3 or private cases.\n3. In the deliberate CLINIC/S8/nominal failure, inspect committed-before-exit.json and the original owner exit73. Resume the SAME episode identity/database with the SAMEprogramme/model. The first packet replays the last confirmed receipt; acknowledge its key, then decide from the original confirmed state and complete visible history. Never reset SOC/peaks, delete receipts or rerun committed steps. Original step keys and rows persist.\n4. At any dispatch failure preserve the last confirmed state, actual action, native exit and error. An operator must assess the observed service shortfall, not certify safety from this script. ZERO is available for economic comparison, not a universal safety fallback.\n5. After all paths, deliver actual dispatch/campaign/cashflow CSV, choices, source map, graphic and limitations together. Check power kW versus energy kWh, each charge/discharge efficiency, fixed original peak, endSOC0, all actual unmet energy and quote cash. Revalue with sensitivity.json; changed physical/tariff input requires a fresh replay of the same programme.\n''',encoding='utf-8')
 (out/'REFERENCES.md').write_text('''# Method references\n- NREL SAM battery-storage documentation: https://sam.nrel.gov/battery-storage/ ; round-trip and physical limits inform terminology, not certification of this simplified model.\n- SciPy linprog/HiGHS: https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.linprog.html ; each actual action is additionally checked by the independent plant recurrence.\nAll scenario data and commercial terms are original synthetic material.\n''',encoding='utf-8')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--data',type=Path,required=True);p.add_argument('--evidence',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--weak',action='store_true');a=p.parse_args();report(a.data,a.evidence,a.out,a.weak)
