"""Copy a declared small projection; complete training capsules remain external."""
from pathlib import Path
import datetime,json,shutil,zipfile
R=Path('D:/opencorvus-benchmark-runs/l01-full-case-20261031');P=R/'author-project';F=R/'report-publication-repair'
D=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/evaluator/l01-whole-case/native-matrix-terminal-20261101')
D.mkdir(exist_ok=False)
members=[]
def cp(source,relative):
    target=D/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
    members.append({'path':relative,'bytes':target.stat().st_size,'original':str(source)})
N=R/'author-study/native-remaining-registered-cells'
for name in ('execution-started.json','execution.json','owner-terminal.json','first-retained.json','runtime-packages.json','stderr.txt','stdout.txt','owner-source.py'):
    cp(N/name,'original-native/'+name)
for name in ('manifest.json','work-ledger.json','study-error.json','summary.csv','selected-quality.json','paper.md','paper.pdf','references.json','reproduction.md'):
    cp(P/'work/results'/name,'results/'+name)
for f in sorted((P/'work/results/runs').glob('*/metrics.json')):cp(f,'results/run-metrics/'+f.parent.name+'.json')
for f in sorted((P/'work/results/analysis-segments/18416/diagnostics').glob('*.json')):cp(f,'diagnostics/'+f.name)
for f in sorted((P/'work/results/figures').glob('*.png')):cp(f,'results/figures/'+f.name)
cp(P/'work/results/analysis-segments/18416/structure-controls/actual-results.json','results/structure-controls.json')
for name in ('repair_report.py','render_pdf_only.py','render_pdf_only_v2.py','started.json','terminal.json','stdout.txt','stderr.txt','pdf-terminal.json','pdf-final-terminal.json','pdf.stderr.txt','pdf-final.stderr.txt','prepare-argv.json','prepare-terminal.json','prepare.stdout.txt','prepare.stderr.txt','prepare-corrected-argv.json','prepare-corrected-terminal.json','prepare-corrected.stdout.txt','prepare-corrected.stderr.txt','paper.v1.pdf','paper.v2.pdf','finish_study.before.py','finish_study.report-v1.py','finish_study.pdf-v2.py'):
    cp(F/name,'publication-repair/'+name)
for name in ('assessment.json','actual-facts.json','binding.json'):
    cp(F/'original-full-prepare-corrected-path'/name,'original-full-checker/'+name)
cp(F/'original-full-prepare/assessment.json','publication-repair/first-facility-path-error.json')
for folder in ('pdf-pages','pdf-pages-approved'):
    for f in sorted((F/folder).glob('*.png')):cp(f,'visual/'+folder+'/'+f.name)
external=[]
for f in (N/'native-originals.zip',N/'pre-execution-source.zip',F/'report-repair-source.zip',F/'pdf-repair-source.zip',F/'pdf-final-source.zip',R/'local-transition/first-segment-receipt-v2.zip'):
    with zipfile.ZipFile(f) as z:info=z.infolist();external.append({'path':str(f),'bytes':f.stat().st_size,'members':len(info),'uncompressed_bytes':sum(v.file_size for v in info)})
scope={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'meaning':'declared scientific projection, not a full workspace or all native bytes','members':members,'projected_bytes':sum(v['bytes'] for v in members),'external_closed_objects':external,'external_only':['all optimizer .pt states, complete original NPZ vectors and attempt/closure traces','original source/input assets and all environment/wheel/cache bytes','full checker extraction and unreviewed assignment'],'original_native_exit':1,'report_repair_exit':0,'full_prepare_exit':4,'score':None,'heavy_qualification':False}
(D/'scope.json').write_text(json.dumps(scope,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'projection':str(D),'bytes':scope['projected_bytes'],'external_native_bytes':external[0]['bytes']}))
