# 完整输出
prepare/model/model.json自定义公开派生模型及audit.json必须复原全部历史最高revision/状态/单位、设备、原峰与经济配置。report的study.json必须含expected_costs{site:{device:cost}},choices[{site,selected,npv,selection_rule}],summaries[{site,device,expected_campaign_cost,expected_critical_unserved_kwh,npv,annual_initial_saving}],cash逐site/device/year完整saving/om/replacement/residual/net/discounted。
必须交campaigns.csv（summaries同字段）、cashflows.csv（cash同字段）、dispatch.csv（全部实际动作逐step/site/device/scenario及物理账）、audit.json、原始资料、source-map.json、敏感性、报告/真实PNG和伴随数据/复建运维说明。形式等价的完整索引/JSON/表/公式可用于内容审查，机器接口上述字段固定。不能用正确底表洗掉报告中错误强声明。公式和原文都应让另一操作者定位原事实/动作/现金。每条receipt.row字段由实际plant生成，允许报告从原对象导出，禁止修改其历史。

报告还必须有reconciliation.json逐episode自行从真实telemetry/实际action重建的账及最大残差、historical-invoices.csv复原原既发账单，不授予最终host bill照抄。

审计机读形状：audit={commission:<原commission>,sites:<原site-terms>,devices:{id:{id,capacity_kwh,power_kw,eta_c,eta_d,capital,annual_om,replacement,residual}},prior:<原prior-bills>,history:[{site,series,interval_start,revision,status,power_kw,released_at}]}。history以site/series/start唯一，行序自由；最高missing的power_kw=null，最高valid按原单位转kW。顶层和history行可附来源metadata，不要求重复正文。
reconciliation为逐scenario/site/device唯一列表，每项max_physics_difference有限非负数、recomputed_bill={energy,demand,wear,critical_penalty,flex_penalty,total,critical_unserved_kwh,flex_unserved_kwh,peaks:{month:kw}}；是从真实telemetry和action重算结果，不是给控制器的新未来输入。historical-invoices.csv列site,month,prior_energy,confirmed_peak_kw,demand_rate,historical_invoice，最后一列为prior_energy+peak*rate。study的summaries/cash允许完整记录上的额外metadata；所要求业务格和必需值不能丢失、重复或换义。

固定机器文件完整清单：study.json, campaigns.csv, cashflows.csv, dispatch.csv, audit.json, source-map.json, reconciliation.json, historical-invoices.csv, sensitivity.json；报告与图形入口为REPORT.md、commissioning.png、TEACHER-OPERATOR-HANDOVER.md（该文件内容为模拟操作者交接）。内容叶接受这些入口定位的完整JSON/表/公式/附录，不因重复文句不足扣分。
