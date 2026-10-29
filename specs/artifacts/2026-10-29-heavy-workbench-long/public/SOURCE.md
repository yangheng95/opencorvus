# 来源、许可与派生范围

原论文：Pratik Rathore, Weimu Lei, Zachary Frangella, Lu Lu, Madeleine Udell. **Challenges in Training PINNs: A Loss Landscape Perspective.** Proceedings of the 41st International Conference on Machine Learning, PMLR235:42159–42191, 2024. [出版原页](https://proceedings.mlr.press/v235/rathore24a.html)，[arXiv v2](https://arxiv.org/html/2402.01868v2)。原论文及论文图保留作者与出版社归属，按[CC BY4.0](https://creativecommons.org/licenses/by/4.0/)使用，不能将其重新标为本项目原创或MIT；归属与原链接须随重分发保留。

随包paper.md、paper.pdf、assets、addendum、blacklist、config来自公开`openai/frontier-evals`，固定提交`b78dab1da774a6456b1ed9c48c9ff194ee3ff36d`，路径`project/paperbench/data/papers/pinn/`。原始媒体未修改；原Markdown抽取存在OCR误差，表格和数学定义以实际PDF为准。评估包保存逐文件来源与真实发布者Git-LFS对象身份，身份核验不是功能正确性门槛。

[上游PaperBench](https://github.com/openai/frontier-evals/tree/b78dab1da774a6456b1ed9c48c9ff194ee3ff36d/project/paperbench)代码/基准资料MIT许可文本保留于UPSTREAM-LICENSE.md；论文第三方版权单独保留。[PaperBench官方说明](https://openai.com/index/paperbench/)描述了作者共建的层级rubric与实际代码/实验复现。**本题没有取得原作者对派生范围和新权重的背书。**

本任务公开改动：固定width100；19个注册基础run和4续训分支；固定采样种子与统一数据；明确拼接条件损失；129×65公开评价网格；特定早停、优化器计数、GD/NNCG范围和恢复试验。原论文及原addendum供阅读；本题合同不同处以本题最终冻结profile/TASK为准，必须在报告对照表列出差别。没有复现的原文部分明确排除，不能按原文全研究或官方原rubric声称完成。

禁止使用作者实现，具体仓库见paper/blacklist.txt。可读随包论文、已有通用库文档和标准科学依赖；不得读取原作者黑名单代码或通过其他镜像获得它。

本题数据由公开规则生成，不含真实受试者/企业私有数据，不依赖外部数据下载、账号或私有凭据。环境PyTorch2.7.1/CUDA12.8，NumPy1.26.4，SciPy1.15.3，Matplotlib3.10.3，ReportLab4.4.0，pypdf5.5.0；本地镜像`opencorvus-benchmark-science:20261029`可直接运行。GPU为RTX5090，32GiB；图形/PDF须真实渲染和查看。
