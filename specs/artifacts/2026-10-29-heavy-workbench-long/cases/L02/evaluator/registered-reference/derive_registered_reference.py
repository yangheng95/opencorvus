from pathlib import Path
from datetime import datetime, timezone
import json, sys, zipfile

R=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L02')
sys.path.insert(0,str(R/'evaluator/current-source'))
from material_contract import read_json, same_json_value
from l02_scoring import load_study
from l02_quality import load_quality_policy, load_registered_reference
from l02_study_data import StudySource
from l02_rubric import load_rubric

OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=False)
ORIGINAL=Path('D:/opencorvus-benchmark-runs/l02-quality-study-qualification-20261030/registered-reference-originals.zip')
STUDY=R/'public/study-contract.json';POLICY=R/'public/quality-policy.json'
with zipfile.ZipFile(ORIGINAL) as z:original={n:z.read(n) for n in z.namelist()}
oldstudy=json.loads(original['study-contract.draft.json']);oldpolicy=json.loads(original['policy-before-results.json'])
newstudy=read_json(STUDY,decimal_numbers=True);newpolicy=read_json(POLICY)
allowed={'study-contract.draft.json':{'status','scope','quality_floor'},'policy-before-results.json':{'status','scope'}}
changes={}
for name,old,new in [('study-contract.draft.json',oldstudy,newstudy),('policy-before-results.json',oldpolicy,newpolicy)]:
    if set(old)!=set(new):raise ValueError('metadata cannot add or remove contract fields')
    changed={k:{'old':old[k],'new':new[k]} for k in old if not same_json_value(old[k],new[k])}
    if not set(changed)<=allowed[name]:raise ValueError('numeric or scientific rule drift: '+name)
    changes[name]=changed
if original['material-contract.json']!=(R/'public/material-contract.json').read_bytes():raise ValueError('material contract identity changed')

derived=dict(original)
derived['study-contract.draft.json']=STUDY.read_bytes()
derived['policy-before-results.json']=POLICY.read_bytes()
# Fixed archive member names are format-1 keys. Only the current filesystem paths moved.
with zipfile.ZipFile(OUT/'registered-reference.zip','x',zipfile.ZIP_DEFLATED) as z:
    for n,v in derived.items():z.writestr(n,v)
with zipfile.ZipFile(OUT/'registration-source-objects.zip','x',zipfile.ZIP_DEFLATED) as z:
    z.writestr('old/study-contract.json',original['study-contract.draft.json'])
    z.writestr('old/quality-policy.json',original['policy-before-results.json'])
    z.writestr('current/study-contract.json',STUDY.read_bytes())
    z.writestr('current/quality-policy.json',POLICY.read_bytes())

expected=read_json(Path('D:/opencorvus-benchmark-runs/l02-source-bound-grade-qualification-20261030/reference-method.json'))
if not same_json_value(json.loads(original['fixed-reference-method.json']),expected):raise ValueError('independent method identity')
study=load_study(STUDY);policy=load_quality_policy(POLICY)
data=StudySource(Path('D:/opencorvus-benchmark-runs/l02-daily-loop-qualification-20261030/main/raw'),R/'public/material-contract.json',study)
ref,contexts,labels,origins=load_registered_reference(OUT/'registered-reference.zip',data,study,policy,expected)
rubric,criteria=load_rubric(R/'rubric.json')
oldrubric=json.loads(__import__('subprocess').check_output(['git','show','5b445d92b:specs/artifacts/2026-10-29-heavy-workbench-long/cases/L02/rubric.draft.json'],cwd='D:/myhexin-local/opencorvus'))
oldcriteria=[r for g in oldrubric['groups'] for r in g['criteria']]
def semantic(row):return {k:v for k,v in row.items() if k!='readiness'}
if not same_json_value([semantic(r) for r in criteria],[semantic(r) for r in oldcriteria]):raise ValueError('weights, critical, anchor, method or rule changed')
if not same_json_value(rubric['publication'],oldrubric['publication']):raise ValueError('comparison threshold changed')
result={'format':'l02-reference-metadata-derivation/1','recorded_at':datetime.now(timezone.utc).isoformat(),
 'parent_original':str(ORIGINAL),'current_reference':str(OUT/'registered-reference.zip'),
 'source_boundary':'New registry metadata, not a claim that historical native workers consumed the new public metadata. Original registry, native outputs, run, assignment, review and grade remain unchanged.',
 'changes':changes,'unchanged_archive_members':[n for n in original if n not in changes],
 'unchanged_member_count':sum(original[n]==derived[n] for n in original),'archive_member_count':len(original),
 'fixed_reference_forecast_count':len(ref),'forecast_cells':sum(len(ref[o]['forecast']['forecasts']) for o in origins),
 'semantic_fields_unchanged':True,'full_registered_reference_loader':'passed',
 'original_66_criterion_rules_weights_flags_anchors_and_publication':'unchanged',
 'rubric_status':rubric['status'],'profile_status':read_json(R/'public/profile.json')['status'],
 'native_executions':0,'new_prediction_or_quality_matrix':False,'candidate_score':None}
(OUT/'derivation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:result[k] for k in ['full_registered_reference_loader','fixed_reference_forecast_count','forecast_cells','semantic_fields_unchanged','rubric_status','native_executions']}))
