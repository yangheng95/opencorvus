"""Final source/archive closure. No source digest is used as a correctness test."""
import csv,datetime,json,sys,zipfile
from pathlib import Path
from fractions import Fraction as F
r=Path(__file__).resolve().parents[1];public=r.parent/'public'
# Byte equality proves identity of specific sealed source objects, not policy quality.
source_checks=[]
for run in ['native-run-01','native-run-02']:
    for path in sorted((r/'programme').rglob('*')):
        if path.is_file():
            rel=path.relative_to(r/'programme');sealed=r/run/'sealed-project'/rel
            assert path.read_bytes()==sealed.read_bytes(),(run,str(rel));source_checks.append({'run':run,'file':str(rel),'sealed_source_equal':True})
    for path in sorted(public.rglob('*')):
        if path.is_file():assert path.read_bytes()==(r/run/'public'/path.relative_to(public)).read_bytes(),('public-original',run,str(path))
original=(public/'exercise.py').read_text(encoding='utf-8');repaired=(r/'runner/exercise.py').read_text(encoding='utf-8')
addition="            # Windows copytree preserves the input read-only bit; only the owned reordered copy is changed.\n            import stat\n            p.chmod(p.stat().st_mode | stat.S_IWRITE)\n"
assert repaired.replace(addition,'')==original and repaired.count(addition)==1
with (r/'stage-ledger.csv').open(encoding='utf-8',newline='') as f:rows=list(csv.DictReader(f))
summary=json.loads((r/'summary.json').read_text());groups={}
for row in rows:groups.setdefault((row['instance'],row['path']),[]).append(row)
for ident,entry in summary['instances'].items():
    mass=F(0);cost=F(0);count=0
    for (iid,path),cells in groups.items():
        if iid!=ident:continue
        cells.sort(key=lambda x:int(x['seq']));assert [int(x['seq']) for x in cells]==list(range(16));p=F(1);terminal_p=F(cells[0]['probability_exact'])
        for cell in cells:
            assert F(cell['node_probability_exact'])==p;p*=F(cell['conditional_probability_exact']);assert F(cell['probability_exact'])==terminal_p
            b=json.loads(cell['belief_json']);assert F(b['A1'])/F(b['A2'])==F(1,3);assert F(b['B1'])/F(b['B2'])==F(3)
        assert p==terminal_p;mass+=p;cost+=p*int(cells[-1]['cumulative_cost']);count+=1
        assert entry['receivables_by_path'][path]=={'8':24,'9':12}
    assert mass==1 and cost==F(entry['expected_cost_exact']) and count==entry['terminal_histories']
original_failures=[str(p.relative_to(r)) for folder in [r/'native-run-01',r/'native-run-02'] for pattern in ['failure.json','owner-error.json'] for p in folder.rglob(pattern)]
assert original_failures==['native-run-01\\owner-error.json'] or original_failures==['native-run-01/owner-error.json']
closure={'format':'l06-source-delivery-closure/1','status':'passed','exact_sealed_source_comparisons':source_checks,'public_original_bytes_equal_to_both_retained_copies':True,'owned_runner_difference':'only retained row-order CSV writable-permission addition','actual_ledger_rows':len(rows),'exact_terminal_paths':len(groups),'conditional_prefix_terminal_probabilities':'independently reconciled products','within_class_ratios':'exact A1:A2=1:3 and B1:B2=3:1 at every stage','original_native_failure_records':original_failures,'archive_scope':'source, declared programme, public originals, derivation certificates, machine exports, figures and handoff; actual native traces and local plotting dependencies/caches remain in full submission','external_author_review':'after candidate natural terminal, outside this candidate self-certification'}
(r/'delivery-closure.json').write_text(json.dumps(closure,indent=2)+'\n',encoding='utf-8')
include=[]
for folder in ['programme','source','runner','specs','derivation/build-01','native-run-02/public','figures']:
    include += [p for p in (r/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
for name in ['README.md','REPORT.md','HANDOFF.md','REVIEW-INDEX.md','REPRODUCE.ps1','DEPENDENCIES.txt','requirements-plot.txt','plot-dependency-versions.json','summary.json','stage-ledger.csv','episodes.json','execution-index.json','recovery-index.json','delivery-closure.json','derivation/independent-bellman-review.json','derivation/rebuild-reconciliation.json']:
    include.append(r/name)
include=sorted(set(include))
freeze={'format':'l06-development-freeze/1','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_frozen':True,'archive':'source-archive.zip','original_actor_entry':'programme/actor.py','declaration':'programme/submission.json','source_members':[{'path':p.relative_to(r).as_posix(),'bytes':p.stat().st_size} for p in include],'source_identity_verification':'full byte equality against each pre-execution sealed programme; not a policy-quality digest','correctness_evidence':'exact rational Bellman certificates, independent transition verifier, native branch execution and original audit','independent_author_whole_case_review':'external post-terminal process; not claimed by candidate','score_claim':None}
(r/'FREEZE.json').write_text(json.dumps(freeze,indent=2)+'\n',encoding='utf-8');include.append(r/'FREEZE.json')
with zipfile.ZipFile(r/'source-archive.zip','x',zipfile.ZIP_DEFLATED) as z:
    for path in include:z.write(path,path.relative_to(r).as_posix())
with zipfile.ZipFile(r/'source-archive.zip') as z:
    assert z.testzip() is None
    for path in include:assert z.read(path.relative_to(r).as_posix())==path.read_bytes()
(r/'archive-verification.json').write_text(json.dumps({'status':'passed','members':len(include),'archive_bytes':(r/'source-archive.zip').stat().st_size,'verification':'ZIP protocol integrity and direct archived-member equality with specific original source files; does not substitute for functional proof'},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'frozen-and-archived','source_members':len(include),'archive_bytes':(r/'source-archive.zip').stat().st_size,'actual_terminal_paths':len(groups),'actual_stages':len(rows),'original_failures_preserved':original_failures}))
