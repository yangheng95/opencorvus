# 演进证据状态本地化实页证据

规格：[用当前界面语言阅读演进证据状态](../../records/2026-11/2026-11-10-evolution-evidence-localized-status.md)。截图来自手动查看隔离开发桌面，公开接口证据记录同一精确比较和原始状态。

[真实回执](receipts.json)记录两组独立 200 的请求身份、完全相同的原始状态、Task（任务）、比较、证据分组、评分器和维度路径。基线服务 39451，候选 39452。以下 10 张均已人工复核。

| 实页截图 | 人工观察 |
| --- | --- |
| [中文基线头部](baseline-zh-catalog-labels.jpg) | 包摘要、制品目录及冻结计划仍混用英文。 |
| [中文基线比较](baseline-zh-raw-comparison-confidence.jpg) | 置信度和运行、评测保留文案仍使用底层英文。 |
| [中文基线证据尾部](baseline-zh-raw-evidence-statuses.jpg) / [两组与视觉复核](baseline-zh-both-arms-and-review.jpg) | 复核状态、证据分组和评分状态直接显示代码。 |
| [英文候选比较](candidate-en-comparison-labels.jpg) / [证据矩阵](candidate-en-evidence-statuses.jpg) | 产品状态用可读英文，`case-a`、`quality` 等身份原样。 |
| [中文候选头部](candidate-zh-catalog-labels.jpg) | 能力包摘要、制品目录修订号和冻结文案完整中文。 |
| [中文候选比较](candidate-zh-comparison-labels.jpg) / [证据矩阵](candidate-zh-localized-both-evidence-arms.jpg) | 低置信度、不适用、两组和缺失状态都按中文呈现，原技术路径保留。 |
| [中文候选空历史](candidate-zh-empty-history-preserves-brand.jpg) | 中文说明按实际安装给出，保留 Evolution Lab 品牌。 |
