"""Actual L03 output checker; source execution is an evaluator-owned receipt."""
import argparse,json,stat
from collections import defaultdict
from fractions import Fraction
from pathlib import Path
from closing_rules import close,parse

RUBRIC=parse((Path(__file__).resolve().parents[1]/'rubric.json').read_text(encoding='utf-8'))
LEAVES={r['id']:r for r in RUBRIC['leaves']}
if len(LEAVES)!=20 or set(LEAVES)!={*[f'M{i:02}' for i in range(1,16)],*[f'H{i:02}' for i in range(1,6)]} or sum(r['weight'] for r in LEAVES.values())!=100:raise ValueError('complete fixed rubric required')
if any(type(r['weight']) is not int or r['weight']<=0 or type(r['critical']) is not bool for r in LEAVES.values()):raise ValueError('typed positive weights and critical flags required')
NUMERIC_KEYS=[('M01','documents'),('M02','document_values'),('M03','allocations'),('M04','bank'),('M05','settlements'),('M06','unallocated'),
 ('M07','journal'),('M08','monthly'),('M09','vendors'),('M10','departments'),('M11','decision'),('M12','break_even'),('M13','cash'),('M14','exceptions')]
MACHINE=[(i,k,LEAVES[i]['criterion'],LEAVES[i]['weight']) for i,k in NUMERIC_KEYS]
HUMAN=[(i,LEAVES[i]['criterion'],LEAVES[i]['weight']) for i in [f'H{n:02}' for n in range(1,6)]]

def canonical(value,key=''):
    if key.endswith('_exact') and value is not None:
        if type(value) is not str:raise ValueError('exact values require rational strings')
        return ['rational',str(Fraction(value))]
    if type(value) is dict:return {k:canonical(v,k) for k,v in sorted(value.items())}
    if type(value) is list:
        rows=[canonical(v) for v in value]
        return rows if key=='service_months' else sorted(rows,key=lambda r:json.dumps(r,sort_keys=True,ensure_ascii=False))
    if type(value) not in (str,int,bool,type(None)):raise ValueError('typed JSON required')
    return [type(value).__name__,value]
def journal_sum(rows):
    totals=defaultdict(int)
    for r in rows:
        if type(r) is not dict or any(type(r.get(k)) is not str for k in ['source_type','source_id','month','account']) or type(r.get('amount_minor')) is not int:raise ValueError('typed journal row')
        totals[r['source_type'],r['source_id'],r['month'],r['account']]+=r['amount_minor']
    return [dict(zip(['source_type','source_id','month','account'],k),amount_minor=v) for k,v in totals.items() if v]
def projected(result,key):
    def fields(row,names):
        if type(row) is not dict:raise ValueError('typed row object required')
        return {k:row[k] for k in names.split()}
    def objects(name):
        value=result[name]
        if type(value) is not list or any(type(r) is not dict for r in value):raise ValueError('typed row array required')
        return value
    def table(name,names):return [fields(r,names) for r in objects(name)]
    if key=='documents':return [{k:r.get(k) for k in ['doc_id','revision','status','vendor','department','book_month','service_months']} for r in objects('documents')]
    if key=='document_values':
        result_rows=[]
        for r in objects('documents'):
            value={k:r.get(k) for k in ['doc_id','gross_minor','currency','native_minor','fx_revision','lines']}
            if value['lines'] is not None:
                if type(value['lines']) is not list:raise ValueError('typed line array required')
                value['lines']=[fields(line,'line_id native_minor base_minor') for line in value['lines']]
            result_rows.append(value)
        return result_rows
    if key=='allocations':return {'source':[r for r in journal_sum(result['journal']) if r['source_type']=='doc'],'months':table('monthly','month service_expense_minor prepaid_close_minor')}
    if key=='bank':return table('bank','bank_tx_id month amount_minor fee_minor allocated_minor unallocated_minor status')
    if key=='settlements':return table('settlements','bank_tx_id doc_id month native_minor book_minor cash_minor fx_minor')
    if key=='unallocated':return table('bank','bank_tx_id unallocated_minor status')
    if key=='journal':return journal_sum(result['journal'])
    if key=='monthly':return table('monthly','month cash_open_minor cash_out_minor cash_close_minor service_expense_minor fees_minor fx_minor expense_minor prepaid_close_minor ap_net_close_minor ap_payable_close_minor vendor_advance_close_minor suspense_close_minor budget_minor variance_minor open_commitments_minor overdraft_used_minor overdraft_headroom_minor')
    if key=='vendors':return table('vendors','vendor month net_ap_minor payable_minor advance_minor')
    if key=='departments':return {'rows':table('departments','department month expense_minor budget_minor variance_minor'),'legacy_bridge':table('legacy_bridge','month legacy_expense_minor corrected_expense_minor expense_adjustment_minor legacy_cash_close_minor corrected_cash_close_minor cash_adjustment_minor')}
    if key=='cash':return table('monthly','month cash_open_minor cash_out_minor cash_close_minor')
    if key=='exceptions':return [fields(r,'kind identity revision status' if r['kind']=='document_conflict' else 'kind identity amount_minor status evidence_status') for r in objects('exceptions')]
    decision=result['decision']
    if key=='break_even':return [{'pair':sorted([r['left'],r['right']]),'volume_exact':r['volume_exact']} for r in decision['break_even']]
    if key=='decision':return {'available_cash_minor':decision['available_cash_minor'],'selected':decision['selected'],
        'options':[fields(r,'id capacity_ok cash_ok minimum_new_funding_minor expected_cost_exact') for r in decision['options']],
        'funding_scenarios':[fields(r,'funding_id status additional_cash_minor funding_fee_minor available_cash_minor selected_plan expected_total_cost_exact') for r in decision['funding_scenarios']],
        'conditional_recommendation':None if decision['conditional_recommendation'] is None else fields(decision['conditional_recommendation'],'funding_id plan_id expected_total_cost_exact')}
    raise ValueError('unknown criterion projection')

def assess(input_root,output_root,execution=None,review=None):
    expected=close(input_root);output_root=Path(output_root);findings=[]
    if review is not None and (review.get('case')!=RUBRIC['version'] or Path(review.get('output_root','')).resolve()!=output_root.resolve()):raise ValueError('trusted review must identify this case and actual output object')
    try:
        candidate=output_root/'result.json';info=candidate.lstat()
        if not stat.S_ISREG(info.st_mode) or getattr(info,'st_file_attributes',0)&getattr(stat,'FILE_ATTRIBUTE_REPARSE_POINT',1024):raise ValueError('ordinary result file required')
        actual=parse(candidate.read_text(encoding='utf-8'))
        if type(actual) is not dict or actual.get('format')!='l03-close-result/1':raise ValueError('format')
        for id,key,title,weight in MACHINE:
            try:good=canonical(projected(actual,key))==canonical(projected(expected,key))
            except (ValueError,TypeError,KeyError,ZeroDivisionError):good=False
            findings.append({'id':id,'weight':weight,'critical':LEAVES[id]['critical'],'status':'pass' if good else 'fail','criterion':title})
    except (OSError,ValueError,TypeError,KeyError):
        status='fail' if (output_root/'result.json').exists() else 'missing'
        findings=[{'id':i,'weight':w,'critical':LEAVES[i]['critical'],'status':status,'criterion':t} for i,k,t,w in MACHINE]
    execution_status='unassessed'
    if execution is not None:
        runs=execution.get('runs',[])
        valid=execution.get('all_declared_runs_verified') is True and len(runs)==4 and {r.get('variant') for r in runs}=={'base','amount-change','new-period','late-correction'}
        valid=valid and all(r.get('verified') is True and type(r.get('native_exit')) is int and r['native_exit']==0 for r in runs)
        valid=valid and next((Path(r['output']).resolve()==output_root.resolve() for r in runs if r['variant']=='base'),False)
        execution_status='pass' if valid else 'fail'
    findings.append({'id':'M15','weight':LEAVES['M15']['weight'],'critical':LEAVES['M15']['critical'],'status':execution_status,'criterion':LEAVES['M15']['criterion']})
    for id,title,weight in HUMAN:
        rating=None if review is None else review.get('findings',{}).get(id)
        if rating is not None and (rating.get('status') not in ['pass','fail','missing'] or not rating.get('basis') or not rating.get('sources')):raise ValueError('invalid trusted review evidence')
        findings.append({'id':id,'weight':weight,'critical':LEAVES[id]['critical'],'status':'unassessed' if rating is None else rating['status'],'criterion':title})
    pending=[r['id'] for r in findings if r['status']=='unassessed'];failed=[r['id'] for r in findings if r['critical'] and r['status'] in ['fail','missing']]
    total=None if pending else sum(r['weight'] for r in findings if r['status']=='pass')
    return {'case':RUBRIC['version'],'status':'incomplete_assessment' if pending else 'graded','findings':findings,'total':total,'critical_failures':failed,
        'good':None if pending else total>=RUBRIC['good_score_at_least'] and not failed,'scope':'synthetic management close; not professional financial certification or candidate-hour evidence'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--assessment',type=Path,required=True)
    p.add_argument('--execution',type=Path);p.add_argument('--review',type=Path);a=p.parse_args()
    try:
        execution=None if a.execution is None else json.loads(a.execution.read_text());review=None if a.review is None else json.loads(a.review.read_text())
        value=assess(a.input,a.output,execution,review);a.assessment.parent.mkdir(parents=True,exist_ok=True);a.assessment.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'status':value['status'],'numeric_pass':sum(r['status']=='pass' for r in value['findings'][:14]),'total':value['total'],'good':value['good']}));raise SystemExit(4 if value['total'] is None else 0 if value['good'] else 2)
    except (OSError,ValueError,KeyError,TypeError) as e:
        print(json.dumps({'status':'facility_error','detail':str(e)}));raise SystemExit(3)
