"""Record a leaf-by-leaf design review, not a candidate grade."""
from decimal import Decimal
from fractions import Fraction
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')

# Public requirements are cited by exact phrase and line in the captured packet.
M={
'A01':('DATA.md','所有显式index','事实已独立还原；primitive已有，逐叶grader未有。','限制为目录ID/index/顺序；与供应/情景属性分工。完整目录对象可作单一结构谓词。'),
'A02':('TASK.draft.md','订单为非负整数包装数','报价、整包和条款全字段对照通过；已有事实证据。','定义本叶准确比较的属性集合，不将A01同一index错误重复计为属性错。'),
'A03':('TASK.draft.md','生产为非负整数件数','BOM、allowed、费用全部对照通过；同一叶含两类关系对象。','明确两子对象全真才满分，或者分叶；无需逐数据格膨胀评分叶。'),
'A04':('DATA.md','demand.csv','需求/容量/概率/facility全字段对照通过。','明确包含产品工时/售价/初存/体积/持有费及全局字段的评分归属；A01仅目录ID/index时这些字段不能落空。'),
'B01':('OUTPUTS.draft.md','每场景记录包含非负整数数组','计划域/覆盖primitive已有；不是完整逐叶适配。','定义必需决策张量的缺字段/额外场景/非整数为明确candidate错误，原始optional库存域另处理。'),
'B02':('TASK.draft.md','前`common_weeks`周','语义清楚，独立见证满足共同前缀。','单独检查三个动作前缀；不可因别的业务先报错就推定本叶通过。'),
'B03':('OUTPUTS.draft.md','每个值0或1','装运binary语义清楚；比整数包装格式恒真叶更实质。','B01只验整数/维度，本叶验0/1，避免重复同一域结果。'),
'B04':('TASK.draft.md','最低装运量','MOQ时序及单位公开，primitive可独立计算。','明确按供应商周合单、truck=1时下界，支持所有合法策略。'),
'B05':('TASK.draft.md','不能每种原料各自占用','共享volume语义公开且有真实绑定见证。','供应体积行独立评分，不能用候选自报体积替代采购包装重算。'),
'B06':('TASK.draft.md','产线—产品资格','语义和输入齐全。','逐生产坐标核对allowed；不要把总产量正确当资格正确。'),
'B07':('TASK.draft.md','全线共享工时约束','共享hours输入/约束齐全。','逐场景周产线检查；与B06分开。'),
'B08':('TASK.draft.md','禁止欠交','到货/BOM非负primitive已有，提前期参与该独立递推。','将所有原料及周纳入，写明对optional声明库存不一致的判定归属。'),
'B09':('TASK.draft.md','交付当周全部需求','履约谓词公开可计算。','期初+累计生产-累计需求非负逐周检查，不只看总产量。'),
'B10':('TASK.draft.md','原料到货后/生产前','v2阶段峰已明确定义，旧漏项得到实质修复。','按阶段峰，不按期末库存；与B08不混同。'),
'B11':('TASK.draft.md','成品生产后/交付前','v2阶段峰明确定义。','覆盖每场景每周；无需强迫该约束在每份好计划都绑定。'),
'C01':('OUTPUTS.draft.md','summary.json','P1：criterion仅期望成本，公开summary逐场景成本/最低/期末现金/AR没有完整评分落点。','明确拆/合为summary完整语义投影；为JSON数值与分子分母定精确解析合同，不能暗用binary float完全等。'),
'C02':('TASK.draft.md','每周都不得低于负信用额度','非末周信用与回款支出时序公开。','不与C03末周双计；独立实际每场景现金，不能期望现金替代。'),
'C03':('TASK.draft.md','末周余额须非负','终期还清与期中信用已分叶。','末周现金实际检查；AR不提前收回。'),
'C04':('TASK.draft.md','禁止下达计划周期之后','终期在途规则完整。','按正订单+lead逐供应商周判定，不因最后库存非负而放过未来到货。'),
'C05':('TASK.draft.md','最后一周期末成品必须0','终期成品语义清楚。','与逐周履约独立，允许原料剩余但无残值。'),
'C06':('TASK.draft.md','本稿拟以','硬freeze阻塞：L=null/资格pending，尚无已认证1%可达交付。','预注册有效正L、可达C<=1.01L、参考证据种类/数值容差与资格；不能用实时incumbent或native数值界直接代签。'),
'D01':('TASK.draft.md','评估会仅用提交源码','硬freeze阻塞：现有数学脚本/小smoke不是完整L06原材料→全部交付清洁参考。','给真实参考全链冷跑与依赖/退出/文件合同；可评估交付不能作为暗含所有内容错误的兜底扣分项。'),
'D02':('TASK.draft.md','将来输入变体','硬freeze阻塞：变体范围/成本资格未冻结；当前降价仅事实映射资格。','声明按每变体判可行或还判质量；预注册参考。用失效/遗憾能区分缓存策略的变体，而不强迫正确策略无意义翻转。'),
'D03':('OUTPUTS.draft.md','ledger.csv','P1：可拆表合理，但机器列/联合键/单位/manifest语义映射未规定。','公开最小字段语义或允许manifest声明列映射，raw/FG与阶段峰/初存到货耗料均有可核查归属。'),
'D04':('OUTPUTS.draft.md','ledger.csv','同上：生产、装运明细的粒度/关键字段未冻。','明确week+scenario+plant/product及supplier/raw索引语义，统一单位，避免暗猜作者列名。'),
'D05':('OUTPUTS.draft.md','ledger.csv','同上：费用账可拆表但无字段解析/完整覆盖ABI。','公开采购/运费/生产/持有四项及聚合语义，重算后逐字段对照。'),
'D06':('OUTPUTS.draft.md','ledger.csv','同上，且只评ledger不能自动覆盖summary财务误报。','给现金/回款/累计费用/期末AR的公开字段或语义映射，并补summary叶归属。'),
'D07':('DATA.md','提供人读的来源映射','公开要求可追溯，不是隐藏要求；评分待完整参考和人评校准。','full已有文件+联合身份+单位，half应具体界定何种缺漏/错误仍得1分。'),
'D08':('TASK.draft.md','任何正确建模方法','P1：算法自由与“真实原生solver状态”不完全一致，合法无外部solver算法无此字段。','公开algorithm/solver可空、状态种类与原生可选payload；不因不用特定库扣分。'),
'D09':('OUTPUTS.draft.md','未知值明确null/unknown','未知状态要求公开，但全已知时是否自动满足及与D08/F03范围不明。','按可行/界每个声明的证据归属评分；无未知事项无需虚构unknown。避免同一假最优错误重复惩罚。'),
'D10':('OUTPUTS.draft.md','run.json','run/manifest要求公开，尚缺稳定locator字段。','冻结输入目录、入口/参数、依赖版本和输出定位的最小语义，不能以源码hash代替身份。'),
'E01':('TASK.draft.md','基线若不可行','可执行且真实检查基线的要求公开；零动作等弱基线也可能满足当前full字面。','若要经济意义需在公开稿定义比较目的；否则不得暗扣合理但不可行基线。half与补救要求需对齐。'),
'E02':('TASK.draft.md','为什么某些周必须提前生产','已有真实停产/需求必要事实，目标可达，无需要求复现特定计划。','使用具体产品/周/同周上限和必要库存四项校准full/half；不要把“实际提前”误当“必须”。'),
'E03':('TASK.draft.md','供应中断时的动作改变','要求有来源，但最优策略未必表现为预设动作变化，因果措辞易强迫故事。','接受正确说明约束改变但动作无需变的情况；若坚持实际flip，须先证明该要求对合格策略可达。'),
'E04':('TASK.draft.md','现金瓶颈','有实际账可判断；不是仅靠关键词。','给实际最紧周/场景/金额与时序来源的具体partial anchors。'),
'E05':('TASK.draft.md','主要费用来源','有完整四分费用账可判断。','注册“主要”与比例/舍入尺度；不得要求报告使用参考特定叙述。'),
'E06':('TASK.draft.md','完整可行替代策略','可实测替代计划要求公开。','明确替代相对主方案需不同动作与精确费用；不暗加必须Pareto最优、必须第三份独立策略或特定风险目标。'),
'F01':('TASK.draft.md','共同承诺与情景后动作分开','交接准确性有公开依据。','以运营者能定位共同周/对象/数量/生产作full锚点；half须具体。'),
'F02':('TASK.draft.md','情景揭示后怎样行动','完全揭示scenario的条件政策有输入支持。','按对应分支真实动作检查；不要暗加未建模的预测/传感规则。'),
'F03':('TASK.draft.md','诚实的方法研究不等于','真实限制要求公开；与D08/D09有部分重叠。','保留业务含义/影响解释，原生事实归D08/D09；不新增采购稿没有的恢复交付要求。'),
'F04':('OUTPUTS.draft.md','实际查看图形','真实图形查看是明确公开要求；尚无完整参考图/人评。','规定可接受语义覆盖/数据连接与half示例，不以文件存在/代码字串/自动UI断言打分。'),
'F05':('OUTPUTS.draft.md','依赖/构建说明','有明确交接复跑依据；D01同跑可以同时支持不同结论。','D01判实际计算结果，F05判按文档独立执行的可操作性；不强迫无增益重复跑两次。'),
}

def main():
    rubric=load(ROOT/'snapshot/rubric.draft.json');leaves=[c for g in rubric['groups'] for c in g['criteria']]
    assert set(M)=={c['id'] for c in leaves}
    rows=[]
    for c in leaves:
        file,phrase,status,repair=M[c['id']]
        lines=(ROOT/'snapshot/public'/file).read_text(encoding='utf-8').splitlines()
        matches=[i+1 for i,s in enumerate(lines) if phrase in s]
        assert matches,(c['id'],phrase)
        rows.append({'id':c['id'],'weight':c['weight'],'critical':c['critical'],'criterion':c['criterion'],
            'public_source':{'file':file,'line':matches[0],'phrase':phrase},'declared_readiness':c['readiness'],
            'independent_design_observation':status,'required_repair_or_check':repair,'candidate_grade_issued':False})
    save(ROOT/'leaf-review.json',rows)
    out=['# 42叶逐项设计审查（不是候选评分）','','每行引用本次snapshot/public原文行号。当前完整评分器不存在，下表不推定任何候选通过。','',
         '| 叶 | 分/关键 | 公开依据 | 当前证据/问题 | 必要明确或核验 |','| --- | --- | --- | --- | --- |']
    for r in rows:
        s=r['public_source'];out.append('| '+r['id']+' | '+str(r['weight'])+('/critical' if r['critical'] else '')+' | '+s['file']+':'+str(s['line'])+' | '+r['independent_design_observation']+' | '+r['required_repair_or_check']+' |')
    (ROOT/'LEAF-REVIEW.md').write_text('\n'.join(out)+'\n',encoding='utf-8')
    # This is a prospective parser-contract probe; no production grader exists or is claimed to fail.
    value=json.loads('49032.9');canonical=Fraction(490329,10)
    save(ROOT/'decimal-contract-probe.json',{
      'publicly_allowed_json_number_literal':'49032.9','intended_exact_cost':'490329/10',
      'binary_float_as_fraction':str(Fraction(value)),'binary_float_fraction_equals_exact':Fraction(value)==canonical,
      'decimal_lexeme_as_fraction':str(Fraction(json.loads('49032.9',parse_float=Decimal))),
      'decimal_lexeme_fraction_equals_exact':Fraction(json.loads('49032.9',parse_float=Decimal))==canonical,
      'scope':'illustrates needed future JSON numeric parser semantics; no current grader bug asserted'})
    normalized=load(ROOT/'independent-normalized.json');facts=[]
    for s in normalized['scenarios']:
        for t,row in enumerate(s['demand']):
            for j,needed in enumerate(row):
                capacity=sum(s['plant_capacity_hours'][t][p]//normalized['production_hours'][j]
                    for p in range(len(normalized['plants'])) if normalized['allowed'][p][j])
                if capacity<needed:facts.append({'scenario':s['id'],'week':t,'product':normalized['products'][j],
                    'demand':needed,'same_week_upper_even_ignoring_other_products':capacity,'necessary_prior_inventory_at_least':needed-capacity})
    save(ROOT/'necessary-prebuild-facts.json',{'no_solver_run':True,'facts':facts,'scope':'necessary bounds, not complete optimal policy or arbitrary plan matching'})
    print(json.dumps({'leaf_reviews':len(rows),'decimal_binary_contract_is_ambiguous_without_rule':Fraction(value)!=canonical,
        'independent_necessary_prebuild_facts':len(facts),'candidate_scores':0,'freeze_approved':False},ensure_ascii=False))

if __name__=='__main__':main()
