# OpenCorvus L02 — 候选完整研究独立初评

本次按收到的冻结 L02/0.2.0、L02-research-anchors/1 对候选原始交付完成38项研究叶初评：**38项 verified_pass**，原始评级已先封存，不代表Q26或总分通过。`review.json` 是正式可交主方评分器的原始证据评级；没有手写总分，也未根据作者参考评级替换候选结论。

绑定 assignment `bc342de1a5a84da99f45b928856428d2`；submission `OpenCorvus-L02-0b93788d6c56-20261030`；原run `b7ee82d7881946f8bfb0483e3c886af9`。原包完整按字节复制到本目录 `assignment.zip`，评级源定位均实际查过原ZIP成员。`initial-review.json` / `initial-review-seal.json` 保留15:35:10.681227Z初评，`review.json`为相同原字节。

## 实质核验与结果

原封存池为weekday同星期经验基线、weather-ridge扩展和真正no-weather消融。后者在训练、预测和三个伪origin校准中均移除天气值及缺测指示，保留其他方法机制。候选合法使用28/56/84日残差校准，不强迫其复制作者56/84/112或作者报告形式。完整121个原单元（108predict、12select、1report）的prepared/accepted源码与静态资产均等于首private预测前的同一registration，实际argv/CID/native/只读挂载/netnone/1CPU也逐原件核同。报告是这份事前封存记者的真正原生输出。

`audit_candidate.py` 不导入候选/作者core，只用标准库读原ZIP/CSV：

- 每个实际packet原行与注册archive逐业务键/全字段对应，授权集合完整，observed事件严格早于origin，release不晚于origin；predict没有labels/scale/完整archive额外挂载。
- 对全部实际fit重建365日合法历史和最高已发布版本（含missing），weekday最近同weekday和ridge有效行集合均相符。逐训练/预测特征与校准label引用核真实cutoff；历史特征t−39h，伪origin特征不能使用当前origin的晚发布事实。
- 实际校准41–42完整四leaf组，38组缺失/最高missing排除，评分格未删除。关闭A2的回归样本含所有分位/mean置零，末日天气缺测按公开中性值/指示处理；未读后来issue或actual。
- 全108 forecast均6节点×14完整未来UTC日，finite/domain/分位顺序、mean层级闭合通过；不要求边际quantile相加。
- 独立用Fraction重算12次inner最小MSE/ID tie、所有outer方法/node MSE/MAE/WIS及完整宏均值。选中weekday的实际切点为February和July，其余weather-ridge；没有因outer表现更好而改选扩展或消融。

`audit_report_binding.py` 补核原raw最高revision2终审、2023固定scale、原实际forecast→3024行report预测、50/80/95逐格覆盖/宽度及168分母summary、全部行动与loss summary。120个numeric窄来源的真实native时间/退出码和228原产物逐字节对应；报告original-results/provenance为原输入对象。

|实际方法/策略|scaled MSE|scaled WIS|
|---|---:|---:|
|weekday|0.0206683411338643|0.0543845213149694|
|weather-ridge|0.00569142857267646|0.0298467354860300|
|no-weather|0.00562525109748094|0.0294785738092777|
|真实selection policy|0.0146323987960670|0.0444096579591026|

这些是候选研究损失，不是bench分数或私有质量判断。报告如实保留扩展4/12切点弱于baseline、7/12弱于消融、宏扩展略弱于消融；也保留选择策略的较差表现。不得把其完整披露的负结果当成研究叶失败，Q26由主方独立比较固定参照。

完整行动账有12096行（三方法×12origin×14日×4leaf×三成本×quantile/mean两账），selected正式quantile子集2016格。独立按固定q.5/.75/.9与under1/3/9、over1重算全部action、truth、缺量、余量和费用一致。mean只是同格诊断，即使局部更好也没有换入正式策略。报告明确最重所选暴露June20/A1/under9，以及两组quantile平均损失高于mean的局部负结果。

## 报告、图与引用的真实边界

已实际view原accepted的三张新PNG：origin-losses是全部12切点三方法MSE/WIS；coverage是各节点50/80/95实际覆盖与nominal轴；worst-local明确July15/A2基线高估、truth0、95%边际带和两种回归mean。标签、单位、方法、truth/区间可读，原数据已独立绑定，未用路径或自动像素代替视觉。

报告把边际区间、有限残差/漂移、依赖层级/时间和描述性比较说清，没有联合路径或服务覆盖保证，没有p值或因果效应夸大；已发布A2关闭与未知A1转移量效分开。运营范围仅单期连续L，不外推库存、容量、跨站调拨或真实机构可靠性。

实际核读保存的Gneiting原PDF关于mean/平方损失与quantile/非对称线性损失段；WIS原HTML第2节及正式correction DOI1010592可核。对应主张映射在候选claims.json，未把获取失败captcha当读过的来源。原创合成数据/非真实机构来源亦如实说明。

## 初评限制

本审查是非盲AI-agent，熟悉作者先前材料/设计和开发校准；不冒称职业真人或统计成熟。未重新拟合每个系数：核的是原数据完整性/时点、完整训练集合、实际冻结计算路径和原生执行、原参数/诊断及全部结果/账表，不以fit文件自报单独证明训练。没有运行l02_sealed reader、新forecast/report/native、Docker、模型、solver、Provider、GPU或UI，没有改候选/原run/assignment或旧作者评分。全部结论仅对本次候选/固定锚点；Q26、自动C01/C02和总分等待主方真正grader。

实际工具命令与证据：`audit-command.json`（72.052秒纯只读核验）、`audit-complete.json`；`report-binding-command.json`（2.756秒纯读补核）、`report-binding-audit.json`；`literature-observation.json`和原PDF文字。检查观察数是重复行级核验，绝不当独立统计样本、难度或有效工作小时。
