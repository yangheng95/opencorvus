"""Full author review from original report corpus; not a model candidate."""
from pathlib import Path
from fractions import Fraction as F
import argparse,csv,json,math
from review_rules import review,read_json

def deliver(root,out):
    root=Path(root);out=Path(out);out.mkdir(parents=True,exist_ok=False);result=review(root);policy=read_json(root/'protocol.json')
    (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    tables={'extraction':[],'effects':[],'analyses':[],'change-log':[]}
    lines=['# 原创模拟培训：报告族与更新综述','',
      '本档不是现实成人培训研究，不提供真实人群/教育/医疗政策效果保证。问题、来源时点、构念/随访优先级、独立队列与模型按事前protocol。没有因效应负向、不能估计或未决重叠而静默删除研究。',
      '', '## 方法和来源','',
      '先按archive/index.csv的真实发布日期筛选；注册定义人群、比较、随机机制和角色，原报告outcomes表提供观察组。correction高于appendix/full_report/abstract，未来更正不回填初始结论。表的report_id/table_id/row_id为定位键，可在对应HTML原文直接核对。',
      '同注册的多报告只形成一个研究；A队列R01/R06有明确同人证据。R10/R12仅possible，主分析保守合组并保最早primary；assume_distinct才假设其独立，这不是已核清。满意度不替代迁移构念，12周优于8周醒目摘要/24周。SD与SE、points与proportion及errors方向均显式换算。',
      '多治疗组用人数/均值与组间项合并SD²，只用一次共享对照。classroom按DE近似，已报ICC保原值，缺ICC的.03是约定不是估出的真值，另做0/.10。固定逆方差为注册主计算，DL随机仅敏感性；两者都不能消除选择/失访/测量偏倚。见随包ENVIRONMENT的Cochrane章节6/10/23方法链接；这些是方法来源，不是本合成档案的研究引用。']
    for sid,data in result['stages'].items():
        m=data['analyses']['main_fixed'];lines+=['',f'## {sid}阶段','',f"报告{len(data['reports'])}份；注册研究{len(data['studies'])}项；主分析独立人群{m['k']}组。报告/注册/独立分析单位三个数量不可混同。",'', '|研究|状态|选中构念/周|主代表|失访/不明事项|','|---|---|---|---|---|']
        for s in data['studies']:
            risk=s['risk_facts'];lines.append(f"|{s['registry']}|{s['status']}|{s['selected_endpoint']} / {s['selected_week']}|{s['main_representative']}|失访{risk['attrition_exact']}；分配隐藏{risk['concealment']}；评估者{risk['assessor']}|")
            for g in s['groups']:tables['extraction'].append({'stage':sid,'registry':s['registry'],'status':s['status'],'endpoint':s['selected_endpoint'],'week':s['selected_week'],**g})
            if not s['groups']:tables['extraction'].append({'stage':sid,'registry':s['registry'],'status':s['status'],'endpoint':None,'week':None})
        lines+=['', '### 主分析与规定敏感性','', '|分析|独立k|均值差（点）|95%正态区间|Q|I²|tau²|','|---|---:|---:|---|---:|---:|---:|']
        for name,a in data['analyses'].items():
            tables['analyses'].append({'stage':sid,'analysis':name,**a})
            lines.append(f"|{name}|{a['k']}|{float(F(a['mean_exact'])):.6f}|[{a['lo']:.6f},{a['hi']:.6f}]|{float(F(a['q_exact'])):.6f}|{float(F(a['i2_exact'])):.6f}|{float(F(a['tau2_exact'])):.6f}|")
        for e in data['effects']:tables['effects'].append({'stage':sid,**e})
        loo=data['leave_one_out'];lo=min(float(F(a['mean_exact'])) for a in loo.values());hi=max(float(F(a['mean_exact'])) for a in loo.values())
        fixed,random=data['analyses']['main_fixed'],data['analyses']['random_DL']
        lines+=['',f"本阶段固定主区间是否排除零={fixed['lo']*fixed['hi']>0}；DL区间是否排除零={random['lo']*random['hi']>0}，DL tau²={float(F(random['tau2_exact'])):.6f}。模型假设可改变区间判断，不能只挑较窄的一个宣传所有假设下都稳健。",
          f'逐研究留一的合成点估计范围{lo:.6f}–{hi:.6f}点，完整移除ID/权重/区间在result.json，不把留一变化当新独立研究或显著性投票。',
          'R08缺组分散度：NR不是0，保not_estimable并向作者索取原SD/SE及对应观察数；R07按轮流入组不是随机，R11仅满意度，保排除理由。R09观察25/26相对随机50/50，失访49%，主分析保留但exclude_high_attrition另核。未报告隐藏/ICC不写成低风险。',
          'R05共享C组不重复计权；R03的ICC=.04是原注册已报近似输入，R04缺ICC采用.03并作范围敏感性。R10原SE与0–1错误率转换后方向为正；不能把SE当SD、直接合并反向错误率或把n放大为有效独立人数。']
    lines+=['','## 追加来源与更正差额','']
    for c in result['changes']:
        lines.append(f"{c['from']}→{c['to']}：主MD从{float(F(c['before_main_exact'])):.6f}变为{float(F(c['after_main_exact'])):.6f}，差{float(F(c['delta_main_exact'])):.6f}点。")
        for s in c['studies']:
            tables['change-log'].append({'from':c['from'],'to':c['to'],**s})
            if any(s['before_'+x]!=s['after_'+x] for x in ['status','md_exact','variance_exact','sources']):lines.append(f"- {s['registry']}：状态{s['before_status']}→{s['after_status']}；MD {s['before_md_exact']}→{s['after_md_exact']}；来源{json.dumps(s['before_sources'],ensure_ascii=False)}→{json.dumps(s['after_sources'],ensure_ascii=False)}。")
    lines+=['','## 结论边界与下一步','',
      '上述点估计和区间仅描述本合成档案在指定选择、近似与独立性假设下的计算，不证明现实有效、因果可推广或95%的某个个体保证。正向主结果不能覆盖负向单研究、新更正或敏感性；DL也不修复失访/重叠偏倚。区间未跨零也不自动意味着实际重要性。',
      '优先取得R10/R12可去标识的重叠核对，R04真实ICC及cluster分析信息，R08分散度，R09失访原因/随机组结局和缺失机制证据；核证前保留现有未决和敏感性。没有微观数据去验证缺失随机，也未实施完整RoB2/GRADE或职业专家确信裁定。',
      '', '## 复建与交接','',
      '按submission.json与ENVIRONMENT准备依赖：reference.py --input <含原archive/protocol/correspondence目录> --output <不存在新目录>。源码从原HTML重做全部阶段/族/组统计/分析和图，不读旧CSV或机器结果。主要分析合同之外的更好模型可另交，但不能回头替换预注册选择。',
      'extraction/effects/analyses/change-log与result.json互相索引；source定位对应原HTML的outcomes表及tr id。更新只追加新来源/修订，不删除旧档案、倒写旧阶段或只改结论段。未接受任何外部实际执行/现实委员会决策。']
    (out/'REVIEW.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    for name,rows in tables.items():
        fields=list(dict.fromkeys(k for r in rows for k in r))
        with (out/(name+'.csv')).open('w',encoding='utf-8',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in r.items()} for r in rows)
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig,axes=plt.subplots(1,len(result['stages']),figsize=(13,6),squeeze=False)
    for ax,(sid,data) in zip(axes[0],result['stages'].items()):
        a=data['analyses']['main_fixed'];by={e['registry']:e for e in data['effects']};ids=a['studies'];labels=[]
        for i,identity in enumerate(ids):
            e=by[identity];md=float(F(e['md_exact']));radius=float(F(policy['normal_critical']))*math.sqrt(float(F(e['variance_exact'])))
            ax.errorbar(md,i,xerr=radius,fmt='o',color='tab:blue');labels.append(identity+(' (ICC imputed)' if e['icc_status']=='imputed' else ''))
        ax.errorbar(float(F(a['mean_exact'])),len(ids),xerr=(a['hi']-a['lo'])/2,fmt='s',color='tab:red');labels.append('Registered fixed pool')
        ax.set_yticks(range(len(labels)),labels);ax.invert_yaxis();ax.axvline(0,color='grey',linestyle='--');ax.set_xlabel('Mean difference, points (positive = better)');ax.set_title(sid+' / independent cohorts');ax.grid(axis='x',alpha=.2)
    fig.tight_layout();fig.savefig(out/'forest.png',dpi=150);plt.close(fig)
    print(json.dumps({'status':'complete_reference_delivery','stages':list(result['stages']),'role':'author_reference_not_candidate'}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();deliver(a.input,a.output)
