# 与成熟 benchmark 的方法对照

访问日期：2026-10-29。本包自行定义的阈值不得归因给引用项目；分数与难度不能跨项目直接比较。

| 参考与直接来源 | 采纳的方法 | 本包证据 | 当前差距 |
| --- | --- | --- | --- |
| [PaperBench论文](https://arxiv.org/html/2504.01848v1)、[官方说明](https://openai.com/index/paperbench/) | 按结果分解可判定评分叶项，复现包含实际执行，单独验证评分器 | suite内200叶；4类诊断/16类领域产物；清洁复跑合同 | 缺原领域作者参与、完整专家参考、真实多质量复现校准；不能宣称PaperBench等效 |
| [GDPval论文](https://arxiv.org/html/2510.04374v1)、[官方说明](https://openai.com/index/gdpval/) | 真实工作物、专业人员复核可行性、盲评最终交付 | 10题完整委托/输入/最终成品；证据定位双评格式 | 原创合成组织场景；未取得职业专家交付与专业盲评，不能称专家质量 |
| [TheAgentCompany官方评估说明](https://github.com/TheAgentCompany/TheAgentCompany/blob/main/docs/EVALUATION.md)、[论文](https://arxiv.org/abs/2412.14161) | 预置任务环境、checkpoint（检查点）与轨迹、隔离被测者和评估器 | 明确导出边界、执行事实、结果与设施错误分列 | 目前只有导出和离线评分，尚未完成正式执行适配/系统隔离资格；不能声称安全隔离已验收 |
| [仓库Inspect边界](../../current/architecture/inspect-benchmark.md) | 现有执行器负责运行与重试、事实驱动无活动窗口、新occurrence | 不新造调度器，复用现有契约，固定资料与任务身份 | 没有注册本题的生产task/solver；本地comparable始终false |

设计审查、工具行为验证与经验效度分别列账。独立agent审查可发现设计和实现问题，但不能替代职业专家、真实系统运行或独立人类评分校准。
