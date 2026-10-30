# 独立方法原文核读

- [Gneiting，Making and Evaluating Point Forecasts v2](https://arxiv.org/abs/0912.0902v2)：原文说明预测统计对象应与事前评分相配，均值和分位点对应不同一致评分族。支持本报告MSE与均值、非对称单期损失与q的解释，不保证有限实现中q必胜mean。
- [Bracher等，WIS原文](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008618)，尤其2.2：区间分数同时包含宽度与两侧漏覆盖惩罚，WIS将median和多个中央区间结合。支持报告指标解释；本题三个水平与固定尺度来自本题合同，未复制论文示例。
- [2022更正](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1010592)：原页面实际说明示例WIS值及相应图/代码信息的更正；本报告没有采用这些示例数值作为自己的结果。
- [FPP官方教材5.10](https://otexts.com/fpp3/toolbox.html)：滚动origin的训练/测试时序及多步扩展。一般时序原则不能替代本题逐行release/revision核验，本轮另外以原packet/CSV核对。

实际访问由本轮web工具完成，没有把标题、引用数量或论文存在当成程序正确性证明。报告的源码/数据权限、实际拟合来源和数值另审；本记录不宣称职业文献系统综述或独立重拟合。
