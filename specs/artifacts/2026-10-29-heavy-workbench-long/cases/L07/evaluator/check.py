"""Actual raw-corpus checker and fixed-denominator whole-case aggregation."""
from pathlib import Path
from fractions import Fraction as F
import argparse,json,math,stat
from review_rules import review,read_json,table,Document,group_fact
RUBRIC=read_json(Path(__file__).resolve().parents[1]/'rubric.json');LEAVES={r['id']:r for r in RUBRIC['leaves']}
if sum(r['weight'] for r in LEAVES.values())!=RUBRIC['denominator'] or len(LEAVES)!=len(RUBRIC['leaves']):raise ValueError('facility rubric registration invalid')

def quantity(v):
    if type(v) is str:return F(v)
    if type(v) is int:return F(v)
    if type(v) is float and math.isfinite(v):return F(str(v))
    raise ValueError('finite quantity or rational string required; bool is not quantity')

def norm(v,key=''):
    if key.endswith('_exact') and v is not None:
        return ['quantity']
    if key in ['lo','hi']:return ['interval_endpoint']
    if type(v) is dict:return {k:norm(x,k) for k,x in sorted(v.items())}
    if type(v) is list:return sorted([norm(x) for x in v],key=lambda x:json.dumps(x,sort_keys=True))
    return [type(v).__name__,v]

def equal(a,b,policy,key=''):
    if key.endswith('_exact'):
        if b is None:return a is None
        av,bv=quantity(a),quantity(b)
        return abs(av-bv)<=F(str(policy['numeric_absolute_tolerance']))+F(str(policy['numeric_relative_tolerance']))*abs(bv)
    if key in ['lo','hi']:
        if b is None:return a is None
        if type(a) not in [int,float]:return False
        av,bv=quantity(a),quantity(b)
        return abs(av-bv)<=F(str(policy['numeric_absolute_tolerance']))+F(str(policy['numeric_relative_tolerance']))*abs(bv)
    if type(b) is dict:return type(a) is dict and a.keys()==b.keys() and all(equal(a[k],b[k],policy,k) for k in b)
    if type(b) is list:
        if type(a) is not list or len(a)!=len(b):return False
        order=lambda x:json.dumps(norm(x),sort_keys=True)
        return all(equal(x,y,policy) for x,y in zip(sorted(a,key=order),sorted(b,key=order)))
    return norm(a,key)==norm(b,key)

def projection(result,id,policy,raw):
    def fields(row,names):return {k:row[k] for k in names.split()}
    index={r['report_id']:r for r in table(Path(raw)/'archive/index.csv')};cutoffs={s['id']:s['cutoff'] for s in policy['stages']}
    def source(row,registry,sid):
        r=index[row['report_id']]
        if r['released_at']>cutoffs[sid] or row['table_id']!='outcomes':raise ValueError('citation outside stage/table')
        doc=Document((Path(raw)/'archive'/r['file']).read_text(encoding='utf-8'));values=[g for g in doc.rows if g['row_id']==row['row_id']]
        if doc.meta['Registration record']!=registry or len(values)!=1:raise ValueError('citation identity missing/ambiguous')
        g=values[0];fact=group_fact(g,policy)
        return {'endpoint':g['endpoint'],'week':int(g['week']),'arm':fact['arm'],'n':fact['n'],'mean_points_exact':str(fact['mean']),'sd2_points_exact':None if fact['sd2'] is None else str(fact['sd2'])}
    def pooled(row):return {**fields(row,'status studies k mean_exact variance_exact q_exact i2_exact tau2_exact lo hi'),'weights':[fields(r,'registry weight_exact normalized_exact') for r in row['weights']]}
    out={}
    if id=='M10':
        rows=[]
        for c in result['changes']:
            studies=[]
            for r in c['studies']:studies.append({**fields(r,'registry before_status after_status before_md_exact after_md_exact before_variance_exact after_variance_exact'),'before_sources':[source(s,r['registry'],c['from']) for s in r['before_sources']],'after_sources':[source(s,r['registry'],c['to']) for s in r['after_sources']]})
            rows.append({**fields(c,'from to before_main_exact after_main_exact delta_main_exact'),'studies':studies})
        return rows
    for s in policy['stages']:
        d=result['stages'][s['id']]
        if id=='M01':value=[fields(r,'report_id registry kind revision released_at') for r in d['reports']]
        elif id=='M02':
            value=[]
            for r in d['studies']:
                if type(r['reason']) is not str or not r['reason'].strip():raise ValueError('screening reason required')
                value.append(fields(r,'registry report_ids population allocation cohort role registered_on status selected_endpoint selected_week main_representative'))
        elif id=='M03':value=[{'registry':r['registry'],'groups':[{**fields(g,'arm n mean_points_exact sd2_points_exact'),'source':source(g['source'],r['registry'],s['id'])} for g in r['groups']]} for r in d['studies']]
        elif id=='M04':value=[{'registry':r['registry'],'risk_facts':fields(r['risk_facts'],'randomized_n observed_n attrition_exact high_attrition concealment assessor')} for r in d['studies']]
        elif id=='M05':value=[fields(r,'registry md_exact variance_exact') for r in d['effects']]
        elif id=='M06':value=[fields(r,'registry icc_exact icc_status design_effect_exact') for r in d['effects']]
        elif id=='M07':value=pooled(d['analyses']['main_fixed'])
        elif id=='M08':value={k:pooled(d['analyses'][k]) for k in policy['analyses'] if k!='main_fixed'}
        elif id=='M09':value={k:pooled(v) for k,v in d['leave_one_out'].items()}
        else:raise ValueError('registered projection required')
        out[s['id']]=value
    return out

def assess(raw,output,execution=None,content=None):
    raw=Path(raw);output=Path(output);policy=read_json(raw/'protocol.json');expected=review(raw);findings=[]
    if content is not None and (content.get('case')!=RUBRIC['version'] or Path(content.get('output_root','')).resolve()!=output.resolve()):raise ValueError('facility trusted review object mismatch')
    actual=None
    try:
        p=output/'result.json';info=p.lstat()
        if not stat.S_ISREG(info.st_mode) or getattr(info,'st_file_attributes',0)&getattr(stat,'FILE_ATTRIBUTE_REPARSE_POINT',1024) or not p.resolve().is_relative_to(output.parent.resolve()):raise ValueError('ordinary result file inside actual output required')
        actual=read_json(p)
        if type(actual) is not dict or actual.get('format')!='l07-review-result/1':raise ValueError('result format')
    except (OSError,ValueError):actual=None
    for id in ['M'+str(i).zfill(2) for i in range(1,11)]:
        good=False
        if actual is not None:
            try:good=equal(projection(actual,id,policy,raw),projection(expected,id,policy,raw),policy)
            except (ValueError,KeyError,TypeError,ZeroDivisionError):good=False
        findings.append({'id':id,'status':'pass' if good else 'missing' if not (output/'result.json').exists() else 'fail'})
    status='unassessed'
    if execution is not None:
        runs=execution.get('runs',[])
        good=execution.get('format')=='l07-case-execution/1' and len(runs)==3 and {r.get('variant') for r in runs}=={'base','mean-change','new-report'}
        good=good and all(r.get('verified') is True and type(r.get('native_exit')) is int and r['native_exit']==0 for r in runs)
        good=good and next((Path(r['output']).resolve()==output.resolve() for r in runs if r['variant']=='base'),False)
        status='pass' if good else 'fail'
    findings.append({'id':'M11','status':status})
    for id in ['H01','H02','H03','H04','H05']:
        rating=None if content is None else content.get('findings',{}).get(id)
        if rating is not None and (rating.get('status') not in ['pass','fail','missing'] or not rating.get('basis') or not rating.get('sources')):raise ValueError('facility trusted rating requires actual sources/basis')
        findings.append({'id':id,'status':'unassessed' if rating is None else rating['status']})
    for r in findings:r.update(weight=LEAVES[r['id']]['weight'],critical=LEAVES[r['id']]['critical'],criterion=LEAVES[r['id']]['criterion'])
    pending=any(r['status']=='unassessed' for r in findings);total=None if pending else sum(r['weight'] for r in findings if r['status']=='pass');fail=[r['id'] for r in findings if r['critical'] and r['status'] in ['fail','missing']]
    return {'case':RUBRIC['version'],'status':'incomplete_assessment' if pending else 'graded','findings':findings,'total':total,'critical_failures':fail,'good':None if pending else total>=RUBRIC['good_score_at_least'] and not fail,'scope':'original simulated review; no real population or candidate-hour certification'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--assessment',type=Path,required=True);p.add_argument('--execution',type=Path);p.add_argument('--review',type=Path);a=p.parse_args()
    try:
        result=assess(a.input,a.output,None if a.execution is None else read_json(a.execution),None if a.review is None else read_json(a.review));a.assessment.parent.mkdir(parents=True,exist_ok=True);a.assessment.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':result['status'],'numeric_pass':sum(r['status']=='pass' for r in result['findings'][:10]),'total':result['total'],'good':result['good']}));raise SystemExit(4 if result['total'] is None else 0 if result['good'] else 2)
    except (OSError,ValueError,TypeError,KeyError) as e:print(json.dumps({'status':'facility_error','error':str(e)}));raise SystemExit(3)
