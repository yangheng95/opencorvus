"""Snapshot and independently re-read repaired public schemas; no solver or candidate run."""
from fractions import Fraction
import json
from pathlib import Path
import shutil
import sys
sys.dont_write_bytecode=True
from build_review_matrix import M

ROOT=Path(__file__).resolve().parent
CASE=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06')

def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def load(p):return json.loads(p.read_text(encoding='utf-8'))

def main():
    stage='final' if '--final' in sys.argv else 'repaired'
    snap=ROOT/('snapshot-'+stage);snap.mkdir(exist_ok=False);copies=[]
    for src in sorted((CASE/'public').rglob('*'))+[CASE/'rubric.draft.json']:
        if not src.is_file():continue
        dest=snap/('rubric.draft.json' if src.name=='rubric.draft.json' else 'public/'+src.relative_to(CASE/'public').as_posix())
        dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
        copies.append({'source':str(src),'copy':str(dest.relative_to(ROOT)),'byte_equal_at_copy':src.read_bytes()==dest.read_bytes()})
    save(ROOT/(stage+'-source-inventory.json'),copies)
    rubric=load(snap/'rubric.draft.json');rows=[c for g in rubric['groups'] for c in g['criteria']]
    updates={
      'A01':('DATA.md','raw_materials.csv','修后显式覆盖目录全部数值属性，初轮字段归属问题已在文案关闭。','按A01列明的全部raw/product属性实现比较；需正向错误映射实例验证。'),
      'A04':('DATA.md','demand.csv','原始情景/需求/容量/设施事实独立投影准确；原料/产品属性现归A01。','需要逐叶投影grader，不能因全实例loader返回成功替候选normalized打分。'),
      'C01':('OUTPUTS.draft.md','JSON小数字面量','十进制精确值/有理对象合同已明确，接受数值与有理等价，避免binary float假错。','用Decimal读JSON数字到Fraction；实际reader/grade尚未实现。'),
      'D01':('OUTPUTS.draft.md','候选缺交','candidate_incomplete/blocked_candidate0与run_invalid不出分、固定100和critical均明确。','仍需真实完整L06源码→原资料→全部交付冷跑；为候选/设施失败分支建立适配。'),
      'D03':('OUTPUTS.draft.md','ledger.json','固定l06-ledger/1并纳入plan可选库存声明；原值/shape反例已独立真实CLI落D03，其余9叶保持。','完整47叶grader仍缺，当前仅10叶输出projection已局部实跑；不把声明错误归缺料。'),
      'D04':('OUTPUTS.draft.md','order_lots、truck_on、production','固定账字段与维度公开，机械决策投影不再猜CSV列名。','实现逐字段账比较，含hours/supplier_volume，明确每字段归属。'),
      'D05':('OUTPUTS.draft.md','purchase_cost、freight_cost','费用最小schema已公开。','需要实际reader/聚合与错误判定，schema文案不是grader资格。'),
      'D06':('OUTPUTS.draft.md','周t的receivable','现金/收款/每周AR字段及公式已公开；summary财务现独立C07-11。','真实lag4公式48行独立核算见receivable-schema-check；需实现projection。'),
      'D08':('OUTPUTS.draft.md','无外部solver的合法算法','algorithm终态和可空native_solver已修，不强迫某库。','真实日志/进程与run字段逐项对照；自写合法算法应能满分。'),
      'D10':('OUTPUTS.draft.md','manifest.json放在本次新输出根','outputs相对新输出根与README相对源码项目根已区分。','实现解析与真实命令定位；勿假设输出必须在源码项目下。')
    }
    fields={
      'C07':('total_cost_minor','总成本'), 'C08':('minimum_cash_minor','最低现金'),
      'C09':('final_cash_minor','末周现金'), 'C10':('final_receivable_minor','期末应收'), 'C11':('probability','概率')}
    for ident,(field,meaning) in fields.items():updates[ident]=('OUTPUTS.draft.md',field,'新增明确核对summary逐场景'+meaning+'，初轮缺口已在文案关闭。','必须逐场景独立核算、固定概率/整数金额/精确数值；本轮未实现正式评分器。')
    matrix=[]
    for c in rows:
        file,phrase,observation,required=updates.get(c['id'],M[c['id']] if c['id'] in M else (None,None,None,None))
        text=(snap/'public'/file).read_text(encoding='utf-8').splitlines()
        matches=[i+1 for i,line in enumerate(text) if phrase in line]
        if not matches:raise RuntimeError((c['id'],phrase))
        if c['method']=='independent_review':
            observation+=' 人评half已改为此叶具体部分条件；仍无真实多质量双评分校准。'
        matrix.append({'id':c['id'],'weight':c['weight'],'critical':c['critical'],'criterion':c['criterion'],
            'public_source':{'file':file,'line':matches[0],'phrase':phrase},'observation':observation,
            'required':required,'readiness':c['readiness'],'half_anchor':c['anchors'].get('half'),'candidate_score':None})
    save(ROOT/('leaf-review-'+stage+'.json'),matrix)
    lines=['# 修后47叶逐项设计复核（不是评分）','','公开依据均指snapshot-repaired/public行号。','',
      '| 叶 | 分/关键 | 公开依据 | 修后判断 | 剩余实施/资格 |','| --- | --- | --- | --- | --- |']
    for r in matrix:
        p=r['public_source'];lines.append('| '+r['id']+' | '+str(r['weight'])+('/critical' if r['critical'] else '')+' | '+p['file']+':'+str(p['line'])+' | '+r['observation']+' | '+r['required']+' |')
    (ROOT/('LEAF-REVIEW-'+stage.upper()+'.md')).write_text('\n'.join(lines)+'\n',encoding='utf-8')
    data=load(ROOT/'independent-normalized.json')
    # Existing independently checked action ledger only supplies observed receipts; formula is recalculated from public demand.
    ledger=load(Path('D:/opencorvus-benchmark-runs/l06-cpsat-independent-review-20261029/cpsat-full/business-check.json'))
    checks=[]
    for scenario in data['scenarios']:
        sid=scenario['id'];cumulative_sales=0;cumulative_received=0;lag=data['receipt_lag_weeks']
        for t in range(data['weeks']):
            cumulative_sales+=sum(q*p for q,p in zip(scenario['demand'][t],data['sales_price_minor']))
            cumulative_received+=ledger['scenarios'][sid]['weeks'][t]['receipts']
            ar=sum(scenario['demand'][k][j]*data['sales_price_minor'][j]
                for k in range(max(0,t-lag+1),t+1) for j in range(len(data['products'])))
            checks.append({'scenario':sid,'week':t,'formula_receivable':ar,'delivered_less_actual_collections':cumulative_sales-cumulative_received,
                'passed':ar==cumulative_sales-cumulative_received})
        checks.append({'scenario':sid,'field':'final_receivable','formula':ar,
            'actual_previous_independently_checked_summary':ledger['scenarios'][sid]['final_receivable_minor'],
            'passed':ar==ledger['scenarios'][sid]['final_receivable_minor']})
    save(ROOT/(stage+'-receivable-schema-check.json'),{'checks':checks,'all_passed':all(c['passed'] for c in checks),
       'scope':'new public formula reviewed against demand minus real collections; no new solver/candidate run'})
    human=[r for r in rows if r['method']=='independent_review']
    summary={'leaf_count':len(rows),'unique_ids':len({r['id'] for r in rows}),'total_weight':sum(r['weight'] for r in rows),
      'critical_count':sum(r['critical'] for r in rows),'critical_weight':sum(r['weight'] for r in rows if r['critical']),
      'human_leaves':len(human),'human_weight':sum(r['weight'] for r in human),'all_human_have_item_specific_half':all('部分正确证据' not in r['anchors']['half'] for r in human),
      'public_inputs_unchanged':all((ROOT/'snapshot/public/inputs'/p.name).read_bytes()==p.read_bytes() for p in (snap/'public/inputs').iterdir()),
      'receivable_formula_checks':len(checks),'receivable_formula_all_passed':all(c['passed'] for c in checks),
      'quality_reference':rubric['quality_reference'],'full_47_leaf_grader_implemented':False,'reference_full_chain_verified':False,
      'freeze_approved':False,'solver_calls':0,'model_calls':0,'new_candidate_scores':0}
    if stage=='final':
        d03=next(r for r in rows if r['id']=='D03')
        summary['D03_optional_inventory_declared']=('plan' in str(d03) and ('可选库存' in str(d03) or '库存声明' in str(d03)))
        summary['output_projection_primitive_implemented']=True
        summary['only_10_output_leaves_locally_qualified']=True
        summary['remaining_37_leaves_graded']=False
        summary['decimal_repair_independently_passed']=load(ROOT/'delivery-review/repair-assessment.json')['all_passed']
    save(ROOT/(stage+'-contract-checks.json'),summary)
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
