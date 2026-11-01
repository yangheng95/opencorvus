"""Read original supplied paper and contracts; no numerical experiment or grading."""
from pathlib import Path
import datetime,json,shutil
from pypdf import PdfReader
W=Path('D:/myhexin-local/opencorvus');B=W/'specs/artifacts/2026-10-29-heavy-workbench-long';C=B/'evaluator/l01-whole-case';D=C/'contract-calibration-20261101'
R=Path('D:/opencorvus-benchmark-runs/l01-full-case-20261031/contract-calibration-audit-20261101')
pdf=PdfReader(B/'public/paper/paper.pdf')
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
profile=read(B/'public/profile.json');policy=read(B/'public/quality-policy.draft.json')
facts=read(C/'native-matrix-terminal-20261101/original-full-checker/actual-facts.json')
evidence={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'source/contract calibration audit only; no native training, solver, checker or candidate execution','paper_source':{'path':'public/paper/paper.pdf','title':'Challenges in Training PINNs: A Loss Landscape Perspective','authors':'Rathore et al.','year':2024,'url':'https://proceedings.mlr.press/v235/rathore24a.html','license_and_upstream':'public/SOURCE.md; CC BY4.0 paper, fixed frontier-evals commit for supplied materials'},'table1':{'pdf_page':5,'reported_hybrid_rows':[line for line in pdf.pages[4].extract_text().splitlines() if line.startswith('Adam+L-BFGS ')]},'table2':{'pdf_page':8,'reported_rows':[line for line in pdf.pages[7].extract_text().splitlines() if line.startswith('Adam+L-BFGS')]},'addendum_source':'public/paper/addendum.md','addendum_lines':[line.strip() for line in (B/'public/paper/addendum.md').read_text(encoding='utf-8').splitlines() if any(token in line for token in ('smallest L2RE','width of 200','Best seeds','additional 2000'))],'current_contract':{'task':'public/TASK.md','profile':'public/profile.json','solution_selection':profile['solution_selection'],'continuation_parent_selection':profile['selection'],'continuations':profile['continuations'],'quality_basis':policy['basis'],'quality_status':policy['status'],'quality_targets':policy['targets']},'actual_quality':facts['quality'],'inference':'The paper is not an attainability witness for the derived fixed-width/seed/selection/budget contract at its independent 1% target. Different grids preclude directly grading paper numbers. No proof of impossibility follows. Original thresholds and failures remain.'}
(D/'evidence.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
shutil.copyfile(R/'original-table2-08.png',D/'original-table2-08.png')
shutil.copyfile(Path(__file__),D/'extract_sources.py')
print(json.dumps({'paper_pages':[5,8],'table1_rows':evidence['table1']['reported_hybrid_rows'],'table2_rows':evidence['table2']['reported_rows'],'evidence':str(D/'evidence.json')}))
