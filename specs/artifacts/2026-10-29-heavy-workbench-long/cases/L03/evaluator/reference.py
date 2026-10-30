"""Complete author source-only delivery; never an LLM candidate score."""
import argparse,csv,json
from pathlib import Path
from fractions import Fraction
from closing_rules import close

def deliver(root,out):
    result=close(root);out=Path(out);out.mkdir(parents=True,exist_ok=False)
    (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for name in ['monthly','vendors','departments','bank','settlements','journal','exceptions','legacy_bridge']:
        values=result[name];fields=list(dict.fromkeys(k for row in values for k in row))
        with (out/(name+'.csv')).open('w',encoding='utf-8',newline='') as f:
            w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(values)
    totals=result['monthly'];d=result['decision'];unknown=result['exceptions']
    lines=['# 合成管理账结账与交接','',
        '本报告采用给定的合成管理政策，不构成法定会计、税务或真实采购建议。原始凭证/银行/结算证据独立保存；最高已发布版本决定本次重述，未知匹配没有按金额猜配。',
        '', '## 结账与现金','', '|期间|服务费用|汇兑|手续费|期末现金|应付|供应商预付|未解释款|预算差额|', '|---|---:|---:|---:|---:|---:|---:|---:|---:|']
    for r in totals:lines.append('|'+ '|'.join(str(r[k]) for k in ['month','service_expense_minor','fx_minor','fees_minor','cash_close_minor','ap_payable_close_minor','vendor_advance_close_minor','suspense_close_minor','variance_minor'])+'|')
    lines+=['','金额均为CNY最小单位分；不是元。月度分录按来源追踪，借贷平衡只是必要条件，journal.csv/settlements.csv和result.json保完整来源和跨期关系。逐行换汇到分后按服务月份分配，不能先加原币再舍入；部分结算采用累计账面价值之差消除分次舍入余数。贷项可使同供应商净额为负，列供应商预付，不将它抹成零。',
        '', '## 原管理账到重述结果','', 'legacy-close.csv只是原管理导出；不把它当权威答案。下列是全模型差额，不将单个原因冒充全部归因：']
    for r in result['legacy_bridge']:lines.append(f"- {r['month']}：费用{r['legacy_expense_minor']}→{r['corrected_expense_minor']}（调整{r['expense_adjustment_minor']}）；期末现金{r['legacy_cash_close_minor']}→{r['corrected_cash_close_minor']}（调整{r['cash_adjustment_minor']}）。")
    lines+=['原导出与逐行源核对可见：I-cancelled的已发布撤销应生效；I-resolved的更高唯一版本解除旧冲突；I-conflict的最高版仍冲突，不能取旧低值；USD一月汇率按已发布修订重述；同bank_tx_id的重复导出不是第二笔付款。费用服务期、银行现金与结算证据各有时点，不能仅以账平认定原账正确。',
        '', '## 证据与未决事项','',f'本次有{len(unknown)}条未决事项，详见exceptions.csv。冲突版本及不充分银行证据保留未决，不据此省略确定业务。确认结算只按公开advice，费用确认与银行现金是不同事件；汇兑差额、手续费和未解释款分别入账。',
        '', '## 有条件的管理方案','',f"扣除最低现金储备和正应付款后，可用现金{d['available_cash_minor']}分；在公开工作量概率及容量/预付款限制下，选择{d['selected']}。没有可行方案时selected为null，不编造可行性。",'']
    for r in d['options']:lines.append(f"- {r['id']}：容量许可={r['capacity_ok']}，现金许可={r['cash_ok']}，期望费用={r['expected_cost_exact']}分。")
    choices=json.loads((Path(root)/'choices.json').read_text(encoding='utf-8'));plans={r['id']:r for r in choices['options']};maximum=max(r['units'] for r in choices['scenarios'])
    lines+=['','两两线性费用交点与可行范围（数量单位）：']
    for r in d['break_even']:
        a,b=plans[r['left']],plans[r['right']];limit=min(a['capacity'],b['capacity']);volume=None if r['volume_exact'] is None else Fraction(r['volume_exact'])
        inside=volume is not None and 0<=volume<=limit
        funding='；'.join(f"{f['funding_id']}下两者预付款同时许可={max(a['upfront_minor'],b['upfront_minor'])<=f['available_cash_minor']}" for f in d['funding_scenarios'])
        lines.append(f"- {r['left']} / {r['right']}：交点{r['volume_exact']}，共同容量区间[0,{limit}]，交点位于该区间={inside}；本次最大工作量{maximum}，两者均能覆盖全部场景={limit>=maximum}；{funding}。")
    lines.append('交点不在共同容量内，或其中一方案不能覆盖当前全部场景时，不能据交点宣布可选方案翻转。预付款许可还依赖尚未落实的融资，不能用未接受报价替代实际现金。')
    lines+=['','## 资金缺口与附条件选择','',f"当前末月净银行余额为{totals[-1]['cash_close_minor']}分，已用透支{totals[-1]['overdraft_used_minor']}分，额度余量{totals[-1]['overdraft_headroom_minor']}分。负银行余额不能写成现有可用现金，也不隐瞒在图表中。"]
    for r in d['funding_scenarios']:lines.append(f"- {r['funding_id']}（{r['status']}）：新增资金{r['additional_cash_minor']}，费用{r['funding_fee_minor']}，可选方案{r['selected_plan']}，总期望成本{r['expected_total_cost_exact']}分。")
    funded=[r for r in d['funding_scenarios'] if r['selected_plan'] is not None]
    for i,a in enumerate(funded):
        for b in funded[i+1:]:
            pa,pb=plans[a['selected_plan']],plans[b['selected_plan']];slope=pa['unit_minor']-pb['unit_minor']
            cross=None if slope==0 else Fraction(pb['fixed_minor']+b['funding_fee_minor']-pa['fixed_minor']-a['funding_fee_minor'],slope)
            lines.append(f"- 融资与方案整体比较{a['funding_id']}/{pa['id']}与{b['funding_id']}/{pb['id']}：包含融资费后的费用交点为{cross}，共同容量上限{min(pa['capacity'],pb['capacity'])}；当前方案选择只在原题场景、现金和报价条件下有效，改变工作量应重算全部可行方案。")
    lines.append('条件性建议为'+str(d['conditional_recommendation'])+'；offered_unaccepted仅为报价，必须得到批准/落实资金才可采用，不把它记作已经到账或新的实际银行交易。该约束只核预付款，不证明未来全部货款偿付。available采用已确认应付口径，未决单据不代表责任为零，须取证后重算并保留储备。')
    lines+=['','每项未决的后续动作：']
    for r in unknown:
        action='向单据发行方取得明确替代版本，保留当前冲突原件；不能择较小金额结账' if r['kind']=='document_conflict' else '取得银行明细或可核付款分配通知后确认；当前保留未解释款，不猜配同金额发票'
        lines.append(f"- {r['kind']} / {r['identity']}：{action}。来源位于documents.jsonl或bank.jsonl/advice.jsonl对应业务键；本次未擅自解除。")
    lines+=['','工作量概率是题设管理假设，不是从资料识别的因果效应；该比较不包含未建模的质量/供应风险，也不能把平均成本最优解释成所有场景最低。',
        '', '## 清洁复建和更新','', '使用declared source从新目录运行`reference.py --input <原材料目录> --output <不存在目录>`。所有数值由同一模型重算；新增期间、有效金额或截止前更正须重新运行，不能只改展示或读取旧缓存。CSV/JSON是可复核机器账，图是同一月度模型的呈现。没有工作簿公式缓存被当成计算证据。']
    (out/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig,axes=plt.subplots(1,3,figsize=(15,4));labels=[r['month'] for r in totals]
    axes[0].plot(labels,[r['expense_minor']/100 for r in totals],marker='o',label='Recognised cost')
    axes[0].plot(labels,[r['budget_minor']/100 for r in totals],marker='s',label='Budget');axes[0].set_ylabel('CNY');axes[0].set_title('Period costs and budget');axes[0].legend()
    axes[1].plot(labels,[r['cash_close_minor']/100 for r in totals],marker='o',label='Cash');axes[1].set_ylabel('CNY');axes[1].set_title('Closing cash');axes[1].legend()
    for key,label in [('ap_payable_close_minor','Payable'),('vendor_advance_close_minor','Vendor advance'),('suspense_close_minor','Unallocated cash')]:
        axes[2].plot(labels,[r[key]/100 for r in totals],marker='o',label=label)
    axes[2].set_ylabel('CNY');axes[2].set_title('Working-capital balances');axes[2].legend();fig.tight_layout();fig.savefig(out/'dashboard.png',dpi=150);plt.close(fig)
    print(json.dumps({'status':'delivery_complete','months':len(totals),'documents':len(result['documents']),'unresolved':len(unknown)}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();deliver(a.input,a.output)
