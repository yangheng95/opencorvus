# L02 相对参照质量与运营损失（未冻结）

本任务分别判断研究完成与数值质量。诚实解释负结果可以完成研究；方法、文档或高加权分不能补偿关键预测质量失败。本页是作者接受政策，当前有作者参考可达与错误对照，尚未完成整个候选grader/职业参考/评审校准和冻结。它不是统计显著性、通用成熟benchmark标准或真实供水保障。

## 独立固定参照

质量参照是固定seasonal-weekday-8方法，不是候选自带baseline或同名method_id。每次使用合法发布时间投影，最高已发布revision含missing为权威；在过去365日的有效历史取最近至多8个同weekday量作基础预测。用当前origin前56/84/112日的伪origin、相同14个未来日重建当时基础预测；残差标签仅用当前origin已发布的最高有效版本，完整leaf日期成对保留，至少14组。

未来leaf样本为基础量加配对残差后截在非负区间，aggregate先按同一组leaf样本加总。mean是样本均值，分位点采用有序样本间线性插值。固定参照不加入天气或运营特征，也不按关闭公告置零。实际注册实例每次42组残差；该事实不意味着其他方法必须采用经验残差校准。解析或贝叶斯分位点等方法可以按其真实数据流交付。

参照的原真实程序、冻结配置、完整1008格预测和原材料/日程/尺度/指标身份由评估侧注册并独立核对；候选不能替换参考、truth或scale。语义相同的行重排不改变资格；实际业务值/目标/信息规则漂移需要新注册，不能套旧分数。参照某个loss为0时直接比较原始loss，不除零或另加任意epsilon。

## 非补偿的质量条件

所有12个外层切点、全部节点与14日目标共同保留固定分母，质量只采用真实完整inner选择所得的外层方法，不看outer真值挑方法或拼节点。

- 六节点分别计算的完整平均scaled MSE、scaled WIS均不高于固定参照。
- 原既定leaf/aggregate各半的两个宏平均损失都严格低于固定参照。
- 下述四leaf三成本场景的完整平均损失分别不高于固定参照策略。

这是同一既定数据集上的确定性比较关系。不强迫每个origin或每个扩展都胜出；改进一个节点不能补偿另一节点退化。完整复制固定参照不满足严格宏提升。极小改善不意味着现实服务上的实质增益，所有原始loss和边界失败仍须报告。

## 合成单期行动

行动量是连续L。余量成本固定1合成cost-unit/L，缺量成本1、3、9合成cost-unit/L分别事前固定使用q0.5、q0.75、q0.9。行动直接等于已冻结预测中相应分位点；不能见truth后换q、换mean、删日或做事后整数化。

每格损失为`underage_cost × max(truth-action,0) + overage_cost × max(action-truth,0)`。每leaf/cost按12×14=168格平均；四leaf不能互相抵分。另交mean行动诊断成本、缺量/余量L及各自成本分量，忠实说明不同成本的敏感性，不强迫实际每格分位策略胜过mean。

该损失与相应分位点的pinball loss成比例，和WIS部分成分相关；不把它们说成独立统计证据。当前模型没有容量、库存、跨站调拨、联合尾风险或真实执行链，不能将其描述为供水调度验收。

mean/MSE与quantile/分段线性损失的目标匹配见[Gneiting原文](https://arxiv.org/abs/0912.0902)，区间评分见[WIS原论文](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)。本政策比较完整平均的原始loss，不把逐格skill比例改造成新的proper score；[Wheatcroft原文](https://www.lse.ac.uk/CATS/Assets/PDFs/Publications/Papers/2019/Interpreting-the-skill-score-form-of-forecast-performance-metrics.pdf)解释了skill变换的限制。
