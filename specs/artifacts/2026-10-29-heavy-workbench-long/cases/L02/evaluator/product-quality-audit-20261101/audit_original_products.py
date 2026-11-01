"""Consume closed L02 predictions only; never invoke a candidate or case grader."""
from pathlib import Path
from decimal import Decimal
from fractions import Fraction
import collections,csv,datetime,json,shutil,sqlite3,sys,time,zipfile

PAIR=Path('D:/opencorvus-benchmark-runs/L02-paired-20261030-cb3a704d')
OUT=Path(__file__).parent
SOURCE=PAIR/'codex/evaluation/evaluator-source'
sys.path.insert(0,str(SOURCE))
from l02_scoring import score,load_study
from l02_quality import decision_metrics
from l02_study_data import extract_data,StudySource

def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,indent=2,ensure_ascii=False,default=str)+'\n',encoding='utf-8')
def archive_json(z,name,decimal=False):return json.loads(z.read(name),parse_float=Decimal) if decimal else json.loads(z.read(name))
def csv_out(path,rows):
    with path.open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)

started=datetime.datetime.now(datetime.timezone.utc).isoformat();timer=time.perf_counter()
materials={}
for system in ('codex','opencorvus'):
    with zipfile.ZipFile(PAIR/system/'evaluation/formal-run/registration.zip') as z:
        materials[system]={n:z.read(n) for n in z.namelist() if n.startswith('raw/') or n in ('study.json','material-contract.json')}
binding={n:{'bytes':len(value),'same_original_bytes':value==materials['opencorvus'].get(n)} for n,value in materials['codex'].items()}
write(OUT/'input-binding.json',binding)
if set(materials['codex'])!=set(materials['opencorvus']) or not all(v['same_original_bytes'] for v in binding.values()):
    raise ValueError('closed original data differ; common-input comparison not established')
data_root=OUT/'original-material-copy';data_root.mkdir(exist_ok=False)
extract_data(materials['codex'],data_root)
study=load_study(data_root/'study.json');data=StudySource(data_root/'raw',data_root/'material-contract.json',study)
with zipfile.ZipFile(PAIR/'codex/evaluation/evaluation-assignment/assignment.zip') as z:policy=archive_json(z,'quality-policy.json')
systems={};all_points=[];all_origins=[]
for system in ('codex','opencorvus'):
    root=PAIR/system/'evaluation';formal=root/'formal-run'
    old=read(root/'final-assessment/assessment.json');quality=old['quality'];origins=quality['origin_ids']
    with sqlite3.connect((formal/'runs.sqlite3').as_uri()+'?mode=ro&immutable=1',uri=True) as conn:
        cells=[{'cell_id':i,'identity':json.loads(identity),'phase':phase,'native_exit':exitcode} for i,identity,phase,exitcode in conn.execute('SELECT id,identity,phase,exitcode FROM cell ORDER BY id')]
    selected={};forecasts={};accepted={}
    for cell in cells:
        ident=cell['identity'];path=formal/'cells'/str(cell['cell_id'])/'accepted.zip'
        if ident['kind']=='select':
            with zipfile.ZipFile(path) as z:selected[ident['outer_id']]=archive_json(z,'output/result/selection.json')['selected_method_id']
    for cell in cells:
        ident=cell['identity']
        if ident['kind']=='predict' and ident['level']=='outer' and selected.get(ident['outer_id'])==ident['method_id']:
            path=formal/'cells'/str(cell['cell_id'])/'accepted.zip'
            with zipfile.ZipFile(path) as z:
                raw=z.read('output/result/forecast.json');forecast=json.loads(raw,parse_float=Decimal)
            origin=ident['outer_id'];forecasts[origin]=forecast
            target=OUT/system/'original-selected-forecasts'/f'{origin}.json';target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
            accepted[origin]={'method_id':ident['method_id'],'cell_id':cell['cell_id'],'accepted_archive':str(path),'member':'output/result/forecast.json','original_phase':cell['phase'],'original_native_exit':cell['native_exit']}
    if set(forecasts)!=set(origins):raise ValueError('incomplete original selected outer outputs')
    scored={};decisions={};local=[]
    for origin in origins:
        context,labels,_=data.context_and_labels(origin);forecast=forecasts[origin];method=selected[origin]
        scored[origin]=score(forecast,context,labels,method,study)
        decisions[origin]=decision_metrics(forecast,context,labels,study,policy)
        truth={(v['series_id'],v['target_tick']):Fraction(v['value']) for v in labels}
        rows=forecast['forecasts']
        for node in context['series_catalogue']:
            name=node['series_id'];points=[p for p in rows if p['series_id']==name];n=len(points)
            covered=sum(Fraction(p['quantiles']['0.1'])<=truth[name,p['target_tick']]<=Fraction(p['quantiles']['0.9']) for p in points)
            local.append({'origin':origin,'method_id':method,'series_id':name,'truth_mean_litres':str(sum(truth[name,p['target_tick']] for p in points)/n),'forecast_mean_litres':str(sum(Fraction(p['mean']) for p in points)/n),'coverage80_count':covered,'coverage80_denominator':n,**scored[origin]['node_metrics_exact'][name]})
        for p in rows:all_points.append({'system':system,'origin':origin,'method_id':method,'series_id':p['series_id'],'target_tick':p['target_tick'],'truth_litres':str(truth[p['series_id'],p['target_tick']]),'mean_litres':str(p['mean']),'q10':str(p['quantiles']['0.1']),'q50':str(p['quantiles']['0.5']),'q90':str(p['quantiles']['0.9'])})
        all_origins.append({'system':system,'origin':origin,'selected_method_id':method,**scored[origin]['metrics_exact']})
    recalculated={}
    for metric in ('scaled_mse','scaled_wis'):recalculated['macro.'+metric]=sum(Fraction(scored[o]['metrics_exact'][metric]) for o in origins)/len(origins)
    for node in data.grid['series_catalogue']:
        name=node['series_id']
        for metric in ('scaled_mse','scaled_wis'):recalculated['node.'+name+'.'+metric]=sum(Fraction(scored[o]['node_metrics_exact'][name][metric]) for o in origins)/len(origins)
        if node['kind']=='leaf':
            for cost in policy['decision']['underage_cost_to_quantile']:recalculated['decision.'+name+'.underage_'+cost]=sum(Fraction(decisions[o]['node_mean'][name][cost]['loss']) for o in origins)/len(origins)
    previous={v['id']:Fraction(v['candidate_loss']) for v in quality['leaves']}
    exact={k:value==previous[k] for k,value in recalculated.items()}
    systems[system]={'original_grade':old['total_score'],'grade_source':str(root/'final-assessment/assessment.json'),'original_quality_success':old['quality_success'],'origins':origins,'selected':accepted,'recomputed_losses':{k:{'exact':str(v),'value':float(v),'equals_original_record':exact[k]} for k,v in recalculated.items()},'local':local,'all_recomputed_losses_equal_original':all(exact.values())}
    csv_out(OUT/f'{system}-node-origin.csv',local)
    report_cell=next(c for c in cells if c['identity']['kind']=='report')
    archive=formal/'cells'/str(report_cell['cell_id'])/'accepted.zip'
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            if name.startswith('output/result/') and name.count('/')==2 and (name.endswith('.md') or name.endswith('.png') or name.endswith('-summary.csv') or name.endswith('selection-trace.csv')):
                target=OUT/system/'original-report'/name.rsplit('/',1)[1];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
    systems[system]['original_report_archive']=str(archive)
    shutil.copyfile(PAIR/system/'completed/submission/submission.json',OUT/system/'original-submission.json')
comparison={}
for key,record in systems['codex']['recomputed_losses'].items():
    codex=Fraction(record['exact']);oc=Fraction(systems['opencorvus']['recomputed_losses'][key]['exact'])
    comparison[key]={'codex':float(codex),'opencorvus':float(oc),'codex_relative_change_percent_of_OC':float((codex-oc)/oc*100) if oc else None,'lower_loss_system':'codex' if codex<oc else 'opencorvus' if oc<codex else 'equal'}
csv_out(OUT/'actual-selected-points.csv',all_points);csv_out(OUT/'actual-origin-metrics.csv',all_origins)
result={'started_at':started,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'seconds':time.perf_counter()-timer,'scope':'one read-only exact consumption of original selected predictions and original labels; no candidate, matrix, prepare, grade or independent review execution','consumer_source':str(SOURCE),'functions':['StudySource.context_and_labels','l02_scoring.score','l02_quality.decision_metrics'],'same_original_materials':binding,'systems':systems,'comparison':comparison,'old_grades_changed':False,'new_grade':None,'model_resource_comparability':False,'limits':'same frozen task and inputs, 12 temporally related original origins; no significance, model-wide causal ranking or new heavy qualification; single-period L losses are not full inventory/cash outcomes'}
write(OUT/'audit.json',result)
print(json.dumps({'seconds':result['seconds'],'same_materials':all(v['same_original_bytes'] for v in binding.values()),'exact_original_match':{k:v['all_recomputed_losses_equal_original'] for k,v in systems.items()},'macro':{k:v for k,v in comparison.items() if k.startswith('macro.')},'B1_high_underage':comparison['decision.B1.underage_9'],'audit':str(OUT/'audit.json')}))
