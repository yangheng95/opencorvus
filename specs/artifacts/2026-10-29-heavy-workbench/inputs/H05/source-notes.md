# 原创方法备忘与真实来源定位

本备忘是任务作者的原创简述，不是外部论文全文。所有业务记录虚构。以下是有限的方法参考资料，不能引用为真实业务结果或实验发现。

1. NIST/SEMATECH e-Handbook, Two-Sample t-Test: https://www.itl.nist.gov/div898/handbook/eda/section3/eda353.htm 。两组均值差的不确定性取决于组内变异和独立样本单位；学校分配实验的学生不能直接当作独立随机分配单位。本文的简化normal诊断不是完整因果估计。
2. Hyndman & Athanasopoulos, Forecasting: Principles and Practice, Time series cross-validation: https://otexts.com/fpp3/tscv.html 。滚动预测应保持训练早于预测目标，多个切点可揭示时变误差。
3. Cochrane Handbook, Chapter 10: https://training.cochrane.org/handbook/current/chapter-10 。合成效应需要明确权重和模型，异质性与偏倚会影响解释；固定效应诊断不自动支持跨人群政策推断。
4. SQLite, Atomic Commit: https://sqlite.org/atomiccommit.html 。数据库事务的持久化与原子提交是故障恢复设计依据；需要在目标环境真实演练，接口成功不等于全部用户数据已保留。

离线任务允许准确引用此备忘所给作者/标题/URL及有限事实，不能编造页码、DOI或未提供的研究结果。扩展检索须进入单独开放赛道并保存实际检索内容和时间。
