"""Present closed forecast losses without modifying old grades or rerunning methods."""
from pathlib import Path
from fractions import Fraction
import csv,datetime,json,shutil,sqlite3,zipfile

R=Path(__file__).parent;W=Path('D:/myhexin-local/opencorvus');B=W/'specs/artifacts/2026-10-29-heavy-workbench-long'
D=B/'cases/L02/evaluator/product-quality-audit-20261101';D.mkdir(parents=True,exist_ok=False)
PAIR=Path('D:/opencorvus-benchmark-runs/L02-paired-20261030-cb3a704d')
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def save(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def copy(source,name):target=D/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
a=read(R/'audit.json');rows=list(csv.DictReader((R/'actual-origin-metrics.csv').open(encoding='utf-8')));indexed={(v['system'],v['origin']):v for v in rows}
origins=a['systems']['codex']['origins'];paired=[]
for origin in origins:
    row={'origin':origin}
    for metric in ('scaled_mse','scaled_wis'):
        c=Fraction(indexed['codex',origin][metric]);o=Fraction(indexed['opencorvus',origin][metric])
        row[metric]={'codex':float(c),'opencorvus':float(o),'OC_minus_Codex_exact':str(o-c)}
    paired.append(row)
delta=sum(Fraction(v['scaled_mse']['OC_minus_Codex_exact']) for v in paired)
july=next(v for v in paired if v['origin']=='outer-20250715')
coverage={};selected_july={}
for system in ('codex','opencorvus'):
    local=a['systems'][system]['local'];coverage[system]={}
    for name in sorted({v['series_id'] for v in local}):
        rr=[v for v in local if v['series_id']==name];coverage[system][name]={'covered':sum(v['coverage80_count'] for v in rr),'targets':sum(v['coverage80_denominator'] for v in rr),'scope':'descriptive marginal coverage; no pass line, independence assumption or joint guarantee'}
    selected_july[system]=[v for v in local if v['origin']=='outer-20250715' and v['series_id']=='A2'][0]
derived={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'paired_origins':paired,'july_share_of_total_macro_MSE_difference_percent':float(Fraction(july['scaled_mse']['OC_minus_Codex_exact'])/delta*100),'selected_july_A2':selected_july,'selected_80pct_coverage':coverage,'comparison':a['comparison'],'interpretation':'descriptive decomposition of the original registered mean, not an estimated causal contribution, significance test or a new threshold'}
save(R/'descriptive-contrasts.json',derived)
for name in ('audit.json','descriptive-contrasts.json','input-binding.json','actual-origin-metrics.csv','actual-selected-points.csv','codex-node-origin.csv','opencorvus-node-origin.csv','audit_original_products.py','audit.stdout.txt','audit.stderr.txt'):
    copy(R/name,name)
copy(Path(__file__),'project_audit.py')
for system in ('codex','opencorvus'):
    for f in (R/system/'original-report').iterdir():copy(f,system+'/original-report/'+f.name)
    copy(R/system/'original-submission.json',system+'/original-submission.json')
with zipfile.ZipFile(D/'original-selected-outputs.zip','w',zipfile.ZIP_DEFLATED) as out:
    for system in ('codex','opencorvus'):
        for f in sorted((R/system/'original-selected-forecasts').glob('*.json')):out.write(f,system+'/'+f.stem+'/forecast.json')
        formal=PAIR/system/'evaluation/formal-run'
        with sqlite3.connect((formal/'runs.sqlite3').as_uri()+'?mode=ro&immutable=1',uri=True) as conn:
            for cell,identity in conn.execute('SELECT id,identity FROM cell ORDER BY id'):
                ident=json.loads(identity)
                if ident['kind']=='select':
                    with zipfile.ZipFile(formal/'cells'/str(cell)/'accepted.zip') as z:out.writestr(system+'/'+ident['outer_id']+'/selection.json',z.read('output/result/selection.json'))
with zipfile.ZipFile(PAIR/'codex/evaluation/evaluation-assignment/assignment.zip') as z:
    (D/'original-quality-policy.json').write_bytes(z.read('quality-policy.json'))
    import io
    with zipfile.ZipFile(io.BytesIO(z.read('reference.zip'))) as reference:(D/'original-scales.json').write_bytes(reference.read('facts/scales.json'))
(D/'original-study.json').write_bytes((R/'original-material-copy/study.json').read_bytes())
current=read(B/'CODEX-COMPARISON-RESULTS.json')
for pair in current['paired_results']:
    if pair['case']=='L02':
        for system,key in (('codex','Codex'),('opencorvus','OpenCorvus')):
            pair['systems'][key]['original_raw_loss_audit']='cases/L02/evaluator/product-quality-audit-20261101/audit.json'
            pair['systems'][key]['macro_scaled_mse']=a['systems'][system]['recomputed_losses']['macro.scaled_mse']
            pair['systems'][key]['macro_scaled_wis']=a['systems'][system]['recomputed_losses']['macro.scaled_wis']
current['latest_l02_product_inspection']={'at':derived['at'],'original_grade_unchanged':{'Codex':100,'OpenCorvus':100},'macro':{k:v for k,v in a['comparison'].items() if k.startswith('macro.')},'B1_underage9':a['comparison']['decision.B1.underage_9'],'july_share_of_total_macro_MSE_difference_percent':derived['july_share_of_total_macro_MSE_difference_percent'],'original_selected_forecasts_per_system':12,'point_rows_per_system':1008,'exact_original_losses_reproduced':True,'new_case_or_grade_execution':False,'report':'cases/L02/evaluator/product-quality-audit-20261101/README.md','limits':a['limits']}
current['latest_observation_at']=derived['at'];save(B/'CODEX-COMPARISON-RESULTS.json',current)
scope={'at':derived['at'],'meaning':'scientific projection of closed original products, not the complete pair workspace or a new execution','members':[{'path':f.relative_to(D).as_posix(),'bytes':f.stat().st_size} for f in sorted(D.rglob('*')) if f.is_file()],'external_only':['complete original workspace archives and original raw material registrations','all original inner/unselected cells, native lifecycle, databases, dependencies and references','old final-assessment and single independent reviews remain in original roots'],'pair_root':str(PAIR),'old_grades_unchanged':True,'new_grade':None,'heavy_qualification':False}
save(D/'scope.json',scope)
print(json.dumps({'report_root':str(D),'july_difference_share_percent':derived['july_share_of_total_macro_MSE_difference_percent'],'coverage':coverage}))
