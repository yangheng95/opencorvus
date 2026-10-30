from pathlib import Path
import json,sys,subprocess,zipfile,types,copy
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'checker-focused-contracts';OUT.mkdir(exist_ok=False)
REPO=Path('D:/myhexin-local/opencorvus');CASE=REPO/'specs/artifacts/2026-10-29-heavy-workbench-long'
sys.path.insert(0,str(CASE/'evaluator/l01-whole-case'));import check_l01 as c
def put(name,x):(OUT/name).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with zipfile.ZipFile(ROOT/'reaction-transfer/native-originals.zip') as z:
    (OUT/'actual-trace.jsonl').write_bytes(z.read('execution/run/nncg/attempts.jsonl'))
    result=json.loads(z.read('execution/run/result.json'))
actual=result['execution'];record={'trace':'actual-trace.jsonl','phases':{'nncg':{'attempts':actual['attempts'],'accepted_updates':actual['accepted_updates']}},'costs':actual['costs']};spec={'method':'nncg','value':.01,'updates':200}
facts=c.trace_facts(OUT,record,spec);put('actual-trace-assessment.json',facts)
assert facts['line_count']==200 and facts['phases']['nncg']['accepted_updates']==200
argv=[sys.executable,'-X','utf8','-B',str(ROOT/'produce_bad_trace.py'),'--source',str(OUT/'actual-trace.jsonl'),'--out',str(OUT/'bad-writer-output')]
p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');put('bad-writer-native.json',{'argv':argv,'native_exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0
expected={'duplicate_attempt':'trace_attempt_sequence','boolean_cost':'trace_cost_type','accepted_bad_pcg':'trace_pcg_explicit_residual','invented_armijo_bound':'trace_armijo_bound','continue_after_zero':'trace_after_terminal'};errors={}
for name,code in expected.items():
    bad=copy.deepcopy(record);bad['trace']='bad-writer-output/'+name+'.jsonl'
    try:c.trace_facts(OUT,bad,spec)
    except c.TraceContract as e:errors[name]=str(e);assert code in str(e),(name,str(e))
    else:raise AssertionError('purposeful error accepted:'+name)
put('actual-error-contracts.json',errors)
profile=c.load(CASE/'public/profile.json');rubric=c.load(CASE/'rubric.draft.json');policy=c.load(CASE/'public/quality-policy.draft.json');leaves,quality,semantic=c.authorities(profile,rubric,policy)
invalid=copy.deepcopy(policy);invalid['targets']['wave']['l2re']=False
try:c.authorities(profile,rubric,invalid)
except c.Facility as e:assert str(e)=='facility_quality_target'
else:raise AssertionError('boolean authority target accepted')
binding={'synthetic_protocol_control_only':True,'contract':semantic};qids={v['id'] for v in quality};ratings={v['id']:{'status':'verified_pass','evidence':['SYNTHETIC arithmetic/precedence protocol control, not an actual research judgment']} for v in leaves if v['id'] not in qids}
review=OUT/'synthetic-review.json';review.write_text(json.dumps({'binding':binding,'ratings':ratings}),encoding='utf-8')
a=types.SimpleNamespace(review=review,freeze=None,role='synthetic_protocol_control_only')
fake_facts={'prerequisites':{},'quality':{key:{'status':'verified_pass'} for key in qids}}
fake_facts['quality']['L01-R-reaction-solution-error']={'status':'verified_fail','reason':'synthetic precedence probe, not any actual selected checkpoint'}
r=c.assess(a,OUT,binding,fake_facts,leaves,quality,rubric,policy)
assert r['total'] is None and r['fixed_denominator']==100 and r['study_complete'] is True and r['solution_reproduced'] is False and r['good'] is False
put('synthetic-outcome-control.json',{'total':r['total'],'fixed_denominator':r['fixed_denominator'],'study_complete':r['study_complete'],'solution_reproduced':r['solution_reproduced'],'good':r['good'],'scope':'synthetic protocol only; never a candidate/reference score'})
bad_review={'binding':binding,'ratings':{**ratings,'L01-R-reaction-solution-error':{'status':'verified_pass','evidence':['invalid attempted machine override']}}};review.write_text(json.dumps(bad_review),encoding='utf-8')
try:c.assess(a,OUT,binding,fake_facts,leaves,quality,rubric,policy)
except c.Facility as e:assert str(e)=='facility_review_leaf_coverage'
else:raise AssertionError('machine quality override accepted')
put('summary.json',{'actual_positive_trace_rows':200,'actual_trace_errors':errors,'typed_target_error':'facility_quality_target','machine_override_error':'facility_review_leaf_coverage','outcome_split':'synthetic study true/solution false/good false/total null','scope':'new focused case-checker contracts; no registered full study/independent whole-case review/freeze/score certification'})
print(json.dumps({'actual_trace':'verified200','writer_native':0,'errors':errors,'whole_case_complete':False}))
