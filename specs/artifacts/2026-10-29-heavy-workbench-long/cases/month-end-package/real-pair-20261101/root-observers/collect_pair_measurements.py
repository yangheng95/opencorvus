"""Read existing original measurements for the final comparison; no solver/build/model runs."""
from pathlib import Path
from datetime import datetime, timezone
import importlib.util, json, hashlib
from decimal import Decimal

ROOT=Path(__file__).parent
CASE=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/month-end-package')
spec=importlib.util.spec_from_file_location('current_month_end_consumer',CASE/'check_package.py')
checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
_,wanted,_,_,_=checker.expectations(ROOT/'frozen-public',ROOT/'original-source-arithmetic.json')
ledger_wanted=checker.original_accounts(ROOT/'frozen-public')
D=lambda x:Decimal(str(x))
controls=['payroll.opening','payroll.rollforward','payroll.gl','payroll.gap']
result={'assembled_at':datetime.now(timezone.utc).isoformat(),'stage':'original_products_with_explicit_posthoc_measurement_repair','candidates':{},'aggregate_score':None,'ranking_established':False}
for name in ['codex','opencorvus']:
    data=json.loads((ROOT/'posthoc-measurement'/name/'assessment.engine.json').read_text())
    assessment=json.loads((ROOT/'posthoc-measurement'/name/'assessment.json').read_text())
    first=json.loads((ROOT/'evaluation'/name/'assessment.json').read_text())
    values=data['baseline'];basis=assessment['accounting_basis']['payroll_liability_controls']
    numeric=[]
    for claim,expected in wanted.items():
        actual=values[claim];normalized=-D(actual) if claim in controls and basis=='credit_positive' else D(actual)
        numeric.append(dict(claim=claim,source_expected_signed=str(expected),actual=actual,normalized_signed=str(normalized),absolute_error=str(abs(normalized-D(expected)))))
    ledger=[]
    for row in data['tables']['ledger']:
        identity=tuple(int(row[k]) for k in ['division','account']);expected=ledger_wanted[identity]
        ledger.append(dict(division=identity[0],account=identity[1],period=row['period'],ytd=row['ytd'],expected_period=str(expected['period']),expected_ytd=str(expected['ytd']),period_error=str(abs(D(row['period'])-expected['period'])),ytd_error=str(abs(D(row['ytd'])-expected['ytd'])),name=row['name'],classification=row['class']))
    manifest=json.loads((ROOT/name/'sealed/manifest.json').read_text())
    target=next(x for x in manifest['files'] if x['path']=='submission/Aurisic_Financials_4-25-1.xlsx')
    original=ROOT/name/'project'/target['path'];actual_hash=hashlib.sha256(original.read_bytes()).hexdigest()
    integrity=dict(file=str(original),sealed_sha256=target['sha256'],current_sha256=actual_hash,immutable_original_same=target['sha256']==actual_hash,bytes=original.stat().st_size,scope='Same sealed original identity only; not financial acceptance')
    result['candidates'][name]=dict(original_integrity=integrity,original_frozen_consumer=dict(native_exit=json.loads((ROOT/'evaluation'/name/'execution.json').read_text())['native_exit'],errors=first['errors']),posthoc_consumer=dict(native_exit=json.loads((ROOT/'posthoc-measurement'/name/'execution.json').read_text())['native_exit'],errors=assessment['errors'],basis=basis),source_reproduction=json.loads((ROOT/'source-reproduction'/name/'result.json').read_text()),source_reproduction_consumer=json.loads((ROOT/'source-reproduction'/name/'independent-consumer.execution.json').read_text()),numeric_claims=numeric,ledger=ledger,refresh=data['refresh'],max_numeric_absolute_error=str(max(D(x['absolute_error']) for x in numeric)),max_ledger_absolute_error=str(max(max(D(x['period_error']),D(x['ytd_error'])) for x in ledger)),source_inputs_checked=assessment['source_inputs_checked'])
usage=json.loads((ROOT/'opencorvus/evidence/usage.json').read_text())
keys=['input_tokens','output_tokens','reasoning_tokens','cache_read_tokens','cache_write_tokens','total_tokens','cost_usd']
groups={}
for group,rows in [('all_recorded',usage['rows']),('preflight_session',[r for r in usage['rows'] if r['session_id']=='ses_hF35Lf0b2Lxei8R7YSgT']),('task_lineage',[r for r in usage['rows'] if r['session_id']!='ses_hF35Lf0b2Lxei8R7YSgT'])]:
    groups[group]={'rows':len(rows),**{k:sum(r[k] or 0 for r in rows) for k in keys}}
result['usage']={'opencorvus':groups,'codex':None,'scope':'Recorded usage events; internal cost=0 is not external free. Codex actual model/usage unknown; no equal-resource or same-model inference. Cached/context totals are not active work hours.'}
out=ROOT/'whole-product-review/measurement-comparison.json';out.write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({k:{'max_numeric_error':v['max_numeric_absolute_error'],'max_ledger_error':v['max_ledger_absolute_error'],'original_same':v['original_integrity']['immutable_original_same']} for k,v in result['candidates'].items()}))
print(json.dumps(result['usage']))
