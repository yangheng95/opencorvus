"""Read frozen originals/receipts and perform bounded review arithmetic; no evaluator execution."""
import json,pathlib,collections,sys,re,difflib
from decimal import Decimal as D
sys.stdout.reconfigure(encoding='utf-8')
r=pathlib.Path(r'D:\opencorvus-benchmark-runs\gdpval-month-end-review-20261101')
pub=json.loads((r/'public-cell-inspection.json').read_text())
t=json.loads((r/'target-cell-inspection.json').read_text())
def pc(f,s,c):
    return next((x for row in pub[f][s]['rows'] for x in row if x['cell']==c),None)
out={'recorded_reports':{},'bounded_arithmetic':{},'source_cell_spots':{}}
for v in ['reference','wrong-stale-tb']:
    d=json.loads((r/'input'/v/'full-source-measurements.json').read_text())
    out['recorded_reports'][v]={
      'ledger':{k:len(x) if isinstance(x,list) else x for k,x in d['ledger'].items()},
      'ledger_categories':dict(collections.Counter(x['contract'] for x in d['ledger']['differences'])),
      'cash_categories':dict(collections.Counter(x['contract'] for x in d['cash_controls'])),
      'schedule_categories':dict(collections.Counter(x['dimension']+':'+x['contract'] for x in d['schedule_results'])),
      'retained_categories':dict(collections.Counter(x['contract'] for x in d['retained_source_inputs'])),
      'recorded_mismatches':[x for x in d['cash_controls']+d['schedule_results'] if x['contract']!='AMOUNT_MATCH']}
out['bounded_arithmetic']={
  'loan1_april_interest':str(D('18300000')*D('0.03')/365*30),
  'loan2_april_interest':str(D('13500000')*D('0.02')/365*30),
  'combined_april_interest':str((D('18300000')*D('0.03')+D('13500000')*D('0.02'))/365*30),
  'prepaid_165000_candidate_components':str(D('81000')+D('28000')+D('56000')),
  'legal_84000_candidate_components':str(-D('28000')-D('56000')),
  'payroll_6000_source_movement':str(D('159997.21')+D('161658.80')-D('198300')+D('236500')+D('20500')),
  'payroll_6000_GL_less_supplied_movement':str(D('388005.99')-(D('159997.21')+D('161658.80')-D('198300')+D('236500')+D('20500'))),
  'payroll_6305_GL_less_supplied_payroll':str(-D('8653.07')-D('12576.95')-D('5520.88')),
  'payroll_posted_less_130percent':str(D('236500')-D('236448.888')),
  'bonus_reference_10percent_vs_opening_adjusted_total':str(D('334593.73')-D('146302.636')),
  'actual_income_less_expenses':str(D('5003243.01')-D('4505763.20')),
  'rubric_asset_difference':str(D('33955902.02')-D('33906764.61')),
  'rubric_profit_difference':str(D('497479.81')-D('448342.40')),
  'rubric_legal_total_difference':str(D('870569.38')-D('435284.69')),
  'insurance_april_schedule_movement':str(D('5493.27')-D('49137.41')),
}
spots={
 'PPD1250-1.xlsx':{'PPD Exps #1250 (2025)':['BU20','BU36','BU37','BU47','BY8','BY17','BY22','BY23','BW40','BY40','BZ40','BV25','BW25','BX25','P50','S50']},
 'Aurisic_Prepaid_Expenses_4-25-1.xlsx':{'PPD Exps #1250':['BX9','BX53'],'PPD Ins #1251 (2024)':['A3','AR4','AT5','AT29','AT30','AT32']},
 'PPD1251-1.xlsx':{'PPD Ins #1251 (2025)':['AR4','AT5','AS29','AT29','AS30','AT30','AU30','AT32']},
 'Aurisic_Financials_3-25-1.xlsx':{'#3a) TB convert 3-31-25':['E6','E7','E27','E29','E61'],'#7) PPD Exps #1250 (2025)':['A38']},
 'Legal_Dump-1.xlsx':{'Legal Dump':['C55','M55','K55','C56','M56','K56','L57','L58','M59','L60','L62','L63']},
 'Aurisic_Corp_Payrolls_April_2025-1.xlsx':{'April 2025':['A16','E18','C18','D18']},
 'Payroll-1.xlsx':{'Payroll Accrual':['A16','E18','C18','D18','E29','F29']},
 'AccrBonus-1.xlsx':{'Bonus Accru #2401':['B13','A15','B15','B18','B19']},
 'AR_Accrual-1.xlsx':{'AR Accrual #1101':['A4','B4']},
}
for f,ss in spots.items():
    out['source_cell_spots'][f]={s:{c:pc(f,s,c)for c in cs}for s,cs in ss.items()}
(r/'spotchecks.json').write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
for v,x in out['recorded_reports'].items():
    print(v,json.dumps({k:a for k,a in x.items()if k!='recorded_mismatches'}))
    if v=='wrong-stale-tb':
        for x in x['recorded_mismatches']:print(json.dumps(x,ensure_ascii=False))
print('ARITHMETIC',json.dumps(out['bounded_arithmetic'],ensure_ascii=False))
print('SOURCE SPOTS',json.dumps(out['source_cell_spots'],ensure_ascii=False))
old=(r/'input/case/evidence/first-executed-programme.mjs').read_text(encoding='utf-8').splitlines()
new=(r/'input/case/build_package.mjs').read_text(encoding='utf-8').splitlines()
print('ORIGINAL PROGRAMME CHANGE TEXT')
for line in difflib.unified_diff(old,new,n=2):print(line)
