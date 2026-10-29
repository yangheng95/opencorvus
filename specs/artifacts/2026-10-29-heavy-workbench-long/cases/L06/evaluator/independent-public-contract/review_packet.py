"""Read-only contract snapshots and independent stdlib business-fact projection."""
from datetime import datetime,timezone
from fractions import Fraction
from itertools import product
import csv
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time
sys.dont_write_bytecode=True

ROOT=Path(__file__).resolve().parent
REPO=Path('D:/myhexin-local/opencorvus')
CASE=REPO/'specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06'
BASE=Path('D:/opencorvus-benchmark-runs/l06-procurement-qualification-20261029')
PYTHON='C:/Python314/python.exe'

def save(p,v):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def load(p):return json.loads(p.read_text(encoding='utf-8'))

def command(argv,label,expected=0):
    stamp=datetime.now(timezone.utc).isoformat();start=time.perf_counter()
    p=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
    dest=ROOT/'commands'/label;dest.parent.mkdir(parents=True,exist_ok=True)
    dest.with_suffix('.stdout.txt').write_text(p.stdout,encoding='utf-8');dest.with_suffix('.stderr.txt').write_text(p.stderr,encoding='utf-8')
    receipt={'argv':argv,'cwd':str(ROOT),'started_utc':stamp,'seconds':time.perf_counter()-start,'exit_code':p.returncode,'expected_exit_code':expected}
    save(dest.with_suffix('.json'),receipt)
    if p.returncode!=expected:raise RuntimeError(receipt)
    return p,receipt

def table(folder,name):
    with (folder/(name+'.csv')).open(encoding='utf-8',newline='') as f:
        reader=csv.DictReader(f);return reader.fieldnames,list(reader)

def write_table(folder,name,columns,rows):
    with (folder/(name+'.csv')).open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=columns);w.writeheader();w.writerows(rows)

def independent_projection(folder):
    provenance=[];counts={}
    def directory(name,index,identity):
        columns,rows=table(folder,name);counts[name]=len(rows)
        indexed={int(r[index]):r for r in rows}
        assert len(indexed)==len(rows) and set(indexed)==set(range(len(rows)))
        ordered=[indexed[i] for i in range(len(rows))]
        assert len({r[identity] for r in rows})==len(rows)
        return ordered,[r[identity] for r in ordered]
    def relation(name,fields,expected):
        _,rows=table(folder,name);counts[name]=len(rows)
        lookup={tuple(r[k] for k in fields):r for r in rows}
        assert len(lookup)==len(rows) and set(lookup)==set(expected),(name,'coverage')
        return lookup
    def number(row,field):return int(row[field])
    raws,R=directory('raw_materials','raw_index','raw_id')
    prods,J=directory('products','product_index','product_id')
    plants,P=directory('plants','plant_index','plant_id')
    suppliers,S=directory('supplier_terms','supplier_index','supplier_id')
    scenarios,A=directory('scenarios','scenario_index','scenario_id')
    facility=load(folder/'facility.json');T=facility['weeks']
    q=relation('supplier_quotes',('supplier_id','raw_id'),product(S,R))
    routes=relation('routes',('plant_id','product_id'),product(P,J))
    bom=relation('bom',('product_id','raw_id'),product(J,R))
    demand=relation('demand',('scenario_id','week','product_id'),product(A,map(str,range(T)),J))
    supply=relation('supplier_capacity',('scenario_id','week','supplier_id'),product(A,map(str,range(T)),S))
    capacity=relation('plant_capacity',('scenario_id','week','plant_id'),product(A,map(str,range(T)),P))
    d={'format':'l06-feasibility-instance/2',**{k:v for k,v in facility.items() if k!='format'},
       'raw_materials':R,'products':J,'plants':P,
       'raw_volume':[number(r,'volume') for r in raws],'raw_holding_minor':[number(r,'holding_minor') for r in raws],
       'initial_raw':[number(r,'initial_units') for r in raws],
       'product_volume':[number(r,'volume') for r in prods],'product_holding_minor':[number(r,'holding_minor') for r in prods],
       'initial_products':[number(r,'initial_units') for r in prods],
       'production_hours':[number(r,'hours') for r in prods],'sales_price_minor':[number(r,'sales_price_minor') for r in prods],
       'allowed':[[number(routes[(p,j)],'allowed') for j in J] for p in P],
       'production_cost_minor':[[number(routes[(p,j)],'production_cost_minor') for j in J] for p in P],
       'bom':[[number(bom[(j,r)],'units') for r in R] for j in J],
       'suppliers':[{'id':r['supplier_id'],'lead_weeks':number(r,'lead_weeks'),'freight_minor':number(r,'freight_minor'),
            'minimum_volume':number(r,'minimum_volume'),'pack_units':[number(q[(r['supplier_id'],m)],'pack_units') for m in R],
            'price_minor':[number(q[(r['supplier_id'],m)],'unit_price_minor') for m in R]} for r in suppliers],
       'scenarios':[{'id':r['scenario_id'],'probability_numerator':number(r,'probability_numerator'),
          'demand':[[number(demand[(r['scenario_id'],str(t),j)],'units') for j in J] for t in range(T)],
          'supplier_capacity_volume':[[number(supply[(r['scenario_id'],str(t),k)],'volume') for k in S] for t in range(T)],
          'plant_capacity_hours':[[number(capacity[(r['scenario_id'],str(t),p)],'hours') for p in P] for t in range(T)]} for r in scenarios]}
    return d,counts

def diff(a,b,path='$'):
    if type(a)!=type(b):return [{'path':path,'actual':a,'expected':b}]
    if isinstance(a,dict):
        result=[]
        for k in sorted(set(a)|set(b)):
            result.extend(diff(a.get(k),b.get(k),path+'.'+k))
        return result
    if isinstance(a,list):
        if len(a)!=len(b):return [{'path':path,'actual_length':len(a),'expected_length':len(b)}]
        return [r for i,(x,y) in enumerate(zip(a,b)) for r in diff(x,y,path+'['+str(i)+']')]
    return [] if a==b else [{'path':path,'actual':a,'expected':b}]

def leaf_count(x):
    if isinstance(x,dict):return sum(leaf_count(v) for v in x.values())
    if isinstance(x,list):return sum(leaf_count(v) for v in x)
    return 1

def main():
    snap=ROOT/'snapshot';snap.mkdir(exist_ok=False);inventory=[]
    def copy(src,dst):
        dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
        inventory.append({'source':str(src),'copy':str(dst.relative_to(ROOT)),'bytes':dst.stat().st_size,'byte_equal_at_copy':src.read_bytes()==dst.read_bytes()})
    (ROOT/'Recall.md').write_text('''# Recall\n\n独立只读审查完整L06公开合同与42叶草案。标准库核对11CSV+facility和原始full JSON的全部事实，审公开要求、评分原子性、critical、证据与评分适配成熟度。不运行solver/Provider/GPU/UI，不恢复暂停任务、不再次委托，不改主仓、不替主方提交。原始事实投影/小资格仅局部支持，不认可小时级、1%或重型冻结。\n\n已读TASK/DATA/OUTPUTS/ENVIRONMENT/SOURCE/profile/rubric与最新资格Recall。关注summary逐场景遗漏、输出ABI、missing/unassessed、任何算法与native状态叶、变体反投机及逐叶适配/人评锚点。\n''',encoding='utf-8')
    command(['git','-C',str(REPO),'status','--short'],'git-status-start')
    for p in (CASE/'public').rglob('*'):
        if p.is_file():copy(p,snap/'public'/p.relative_to(CASE/'public'))
    copy(CASE/'rubric.draft.json',snap/'rubric.draft.json')
    copy(REPO/'specs/records/2026-10/2026-10-29-heavy-workbench-l06-qualification.md',snap/'qualification-record.md')
    for n in ('l06_packet.py','qualify_packet.py','l06_input.py','check_l06.py'):copy(BASE/n,snap/'source'/n)
    copy(BASE/'v2/inputs/full.json',snap/'original-full.json')
    copy(BASE/'v2/business-packet-qualification/receipt.json',snap/'author-packet-receipt.json')
    copy(Path('D:/opencorvus-benchmark-runs/l06-cpsat-independent-review-20261029/source-snapshot/cpsat-full/plan.json'),snap/'reference-constant-policy.json')
    save(ROOT/'source-inventory.json',inventory)
    d,counts=independent_projection(snap/'public/inputs')
    original=load(snap/'original-full.json');metadata={'status','qualification_variant'}
    expected={k:v for k,v in original.items() if k not in metadata}
    changes=diff(d,expected);save(ROOT/'independent-normalized.json',d)
    save(ROOT/'fact-projection.json',{'all_business_fields_equal':not changes,'differences':changes,'scalar_business_facts':leaf_count(d),
       'table_rows':counts,'independent_formula_source':'manual mapping from public DATA semantics; did not import l06_packet or use its expected output',
       'excluded_original_keys':sorted(set(original)&metadata),'excluded_keys_are_qualification_metadata':True})
    executions=[]
    def read_cli(folder,name,expected=0):
        out=ROOT/'cli-output'/(name+'.json')
        p,receipt=command([PYTHON,'-X','utf8','-B',str(snap/'source/l06_packet.py'),'--mode','read','--input',str(folder),'--output',str(out)],name,expected)
        executions.append(receipt)
        return load(out) if expected==0 else json.loads(p.stdout)
    base=read_cli(snap/'public/inputs','base-public-read')
    assert base==d
    reorder=ROOT/'controls/all-rows-reordered';shutil.copytree(snap/'public/inputs',reorder)
    for p in reorder.glob('*.csv'):
        cols,rows=table(reorder,p.stem);write_table(reorder,p.stem,cols,list(reversed(rows)))
    assert read_cli(reorder,'all-csv-rows-reordered')==d
    changed=ROOT/'controls/price-change';shutil.copytree(snap/'public/inputs',changed)
    cols,quotes=table(changed,'supplier_quotes');target=next(r for r in quotes if r['supplier_id']=='A' and r['raw_id']=='R0')
    prior=int(target['unit_price_minor']);target['unit_price_minor']=str(prior-1);write_table(changed,'supplier_quotes',cols,quotes)
    altered=read_cli(changed,'single-price-change')
    exact_changed=diff(altered,d)
    assert exact_changed==[{'path':'$.suppliers[0].price_minor[0]','actual':24,'expected':25}],exact_changed
    duplicate=ROOT/'controls/duplicate-quote';shutil.copytree(snap/'public/inputs',duplicate)
    cols,quotes=table(duplicate,'supplier_quotes');write_table(duplicate,'supplier_quotes',cols,quotes+[quotes[0]])
    dup=read_cli(duplicate,'duplicate-key',2);assert dup['error']=='packet_invalid' and dup['where']=='supplier_quotes'
    missing=ROOT/'controls/missing-demand';shutil.copytree(snap/'public/inputs',missing)
    cols,demands=table(missing,'demand');write_table(missing,'demand',cols,demands[:-1])
    miss=read_cli(missing,'missing-demand',2);assert miss['error']=='packet_invalid' and miss['where']=='demand'
    # A cheaper price cannot by itself force a different feasible policy: demonstrate with existing action evidence.
    _,receipt=command([PYTHON,'-X','utf8','-B',str(snap/'source/check_l06.py'),'--input',str(ROOT/'cli-output/single-price-change.json'),
        '--plan',str(snap/'reference-constant-policy.json'),'--out',str(ROOT/'controls/constant-policy-under-cheaper-price.json')],'constant-policy-price-variation')
    constant=load(ROOT/'controls/constant-policy-under-cheaper-price.json')
    rubric=load(snap/'rubric.draft.json');leaves=[c for g in rubric['groups'] for c in g['criteria']]
    human=[c for c in leaves if c['method']=='independent_review']
    structural={'leaf_count':len(leaves),'unique_ids':len({c['id'] for c in leaves}),
       'weight_total':sum(c['weight'] for c in leaves),'critical_count':sum(c['critical'] for c in leaves),
       'critical_weight':sum(c['weight'] for c in leaves if c['critical']),
       'human_review_count':len(human),'human_review_weight':sum(c['weight'] for c in human),
       'group_weights':{g['id']:sum(c['weight'] for c in g['criteria']) for g in rubric['groups']},
       'quality_reference':rubric['quality_reference'],'readiness':rubric['readiness']}
    save(ROOT/'rubric-structure.json',structural)
    save(ROOT/'cheap-cli-receipt.json',{'actual_packet_cli_commands':len(executions),'commands':executions,
       'independent_public_projection_equal':base==d and not changes,'all_rows_reorder_equal':True,'price_change_exact_differences':exact_changed,
       'duplicate_error':dup,'missing_error':miss,'constant_policy_cheaper_price':{
          'business_feasible':constant['business_feasible'],'expected_cost_exact':constant['expected_cost_exact'],
          'same_action_file_as_base_49032_9_witness':True,'quality_assessed':False,
          'interpretation':'frozen qualified price decrease preserves feasibility of unchanged actions; does not prove variant quality or policy flip'},
       'scope':'input factual qualification and one fixed action feasibility control; no optimization or candidate grade'})
    command(['git','-C',str(REPO),'status','--short'],'git-status-end')
    print(json.dumps({'fact_changes':changes,'table_rows':counts,'scalar_business_facts':leaf_count(d),
       'rubric_structure':structural,'packet_clis':len(executions),'unchanged_policy_cheaper_cost':constant['expected_cost_exact'],
       'new_solver_calls':0,'new_model_calls':0,'GPU':False,'freeze_approved':False},ensure_ascii=False,indent=2))
    if changes:raise SystemExit(1)

if __name__=='__main__':main()
