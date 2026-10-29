"""Additional structural facts and real explicit-error plan probes; not candidate work."""
from pathlib import Path
import csv
import json
import re
import sys
sys.dont_write_bytecode=True
from collect_review_evidence import OUT, PACKAGE, SNAP, command, load_module, read_csv, save

ref=load_module('structural_reference',PACKAGE/'reference_calculations.py')
check=SNAP/'script/benchmark/heavy_workbench.py'
facts={}
for cid in [f'H{i:02}' for i in range(2,11)]:
    rows=read_csv(PACKAGE/'inputs'/cid/'records.csv')
    if cid=='H03':
        facts[cid]={'values':{k:sorted({r[k] for r in rows}) for k in ('currency','fx','status')},
                    'all_original_amounts_integral':all(float(r['amount']).is_integer() for r in rows)}
    elif cid=='H04':
        facts[cid]={'customers':len({r['customer'] for r in rows}),
                    'unique_orders':len({r['id'] for r in rows}),
                    'fractional_total_examples':[r for r in rows if not float(r['total']).is_integer()][:4]}
    elif cid=='H05':
        identities={(r['tenant'],r['event_id']) for r in rows}
        facts[cid]={'distinct_joint_identities':len(identities),
                    'distinct_event_ids':len({r['event_id'] for r in rows}),
                    'extra_transmissions':len(rows)-len(identities),
                    'payload_conflict_identities':sum(len({r['amount'] for r in rows if (r['tenant'],r['event_id'])==k})!=1 for k in identities)}
    elif cid=='H06':
        facts[cid]={'sku_count':len({r['sku'] for r in rows}),
                    'unit_cost_constant_within_sku':all(len({r['unit_cost'] for r in rows if r['sku']==s})==1 for s in {r['sku'] for r in rows}),
                    'source_columns':list(rows[0]),'public_protocol':'unlimited same-week expedite, separate SKU capacities'}
    elif cid=='H07':
        text=(PACKAGE/'inputs/H07/study-dossiers.md').read_text(encoding='utf-8')
        pattern=r'研究身份：(R\d+)；设计：(\w+)；主要随访：(\d+)周；方向统一效应effect=([\d.-]+)；标准误se=([\d.-]+)；初步风险标签risk=(\w+)'
        parsed=re.findall(pattern,text);by={r['study']:r for r in rows};diff=[]
        for sid,design,weeks,effect,se,risk in parsed:
            row=by[sid]
            if not (row['design']==design and row['followup_weeks']==weeks and
                    float(row['effect'])==float(effect) and float(row['se'])==float(se) and row['risk']==risk):diff.append(sid)
        facts[cid]={'appendices_parsed':len(parsed),'appendix_csv_different_studies':diff,
                    'populations':sorted({r['population'] for r in rows}),
                    'source_kinds':sorted({r['source_kind'] for r in rows})}
    elif cid=='H08':
        roles=ref.outputs(cid,rows)['roles'];bounds=ref.outputs(cid,rows)['bounds']
        facts[cid]={'roles':roles,'dependency_bounds':bounds}
    elif cid=='H10':
        facts[cid]={'sites':sorted({r['site'] for r in rows}),
                    'tariffs':sorted({float(r['tariff']) for r in rows}),
                    'nonnegative_loads':all(float(r['kwh'])>=0 for r in rows),
                    'observed_columns':list(rows[0])}
save(OUT/'structural-facts.json',facts)

probes=[]
for cid,scenario,description in [('H06','stress','base plan re-used despite reduced supply capacity'),
        ('H08','base','dependency-only earliest dates used as resource-feasible schedule'),
        ('H10','efficiency','0.95 dispatch re-used under 0.90 physical efficiency')]:
    rows=read_csv(PACKAGE/'inputs'/cid/'records.csv')
    if cid=='H08':
        plan=ref.outputs(cid,rows)['earliest']
    else:plan=ref.feasible_witness(cid,rows,'base')
    dest=OUT/'structural-error-probes'/cid
    ref.write_table(dest/'plan.csv',plan)
    receipt=command([sys.executable,'-B',str(check),'verify-plan',cid,
        str(PACKAGE/'inputs'/cid),str(dest/'plan.csv'),'--scenario',scenario,
        '--out',str(dest/'verification.json')],f'{cid}-structural-error')
    result=json.loads((dest/'verification.json').read_text(encoding='utf-8'))
    probes.append({'case':cid,'description':description,'receipt':receipt,'result':result})
save(OUT/'structural-error-probes.json',probes)
print(json.dumps({'facts':facts,'probes':probes},ensure_ascii=False,indent=2))
