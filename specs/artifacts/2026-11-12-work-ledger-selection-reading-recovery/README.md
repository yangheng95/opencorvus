# 精确读取中断时的真实桌面证据

- 已归档多步任务的[原请求](01-baseline-archived-original-request.png)在精确读取中断后[消失](02-baseline-archived-request-disappears.png)。原位[重试恢复标题和原请求](03-baseline-archived-original-request-retried.png)。
- 另一项目 Chat 的[原名](04-baseline-chat-before-read-cut.png)在精确读取中断后变成[通用对话标题](05-baseline-chat-title-lost-after-read-cut.png)。[重试读取](06-baseline-chat-title-retried.png)得到准确新标题。
- 真实恢复写入已经提交，回执和两个精确读被截断后，[恢复反馈的 Retry](07-mixed-feedback-does-not-retry-read.png)在传输恢复后[仍停在同一错误](08-mixed-retry-leaves-same-error.png)。
- [真实截断、重试与正式持久读回](baseline-selection-read-evidence.json)。英文未归档草稿的基线见[上一批候选截图](../2026-11-12-work-ledger-selection-invalidation/17-final-own-read-failure.png)。
- 候选英文 Chat 的[读取前态](09-candidate-chat-before.png)、[暂时中断时保留标题](10-candidate-chat-retained-after-cut.png)及[读取重试后的新标题](11-candidate-chat-retried.png)。
- [首次跨项目读取错误](12-candidate-cold-different-owner.png)归属原多步任务的目标页。中文归档草稿经首次重试的[原请求和状态](13-candidate-archived-before-cut.png)随后在[暂时中断中继续可读](14-candidate-archive-retained-after-cut.png)，[再次重试](15-candidate-archive-read-retried.png)接受准确新标题。
- 混合故障保留[原请求和读取重试](16-candidate-mixed-read-retry.png)及[三次传输的诊断](17-candidate-mixed-real-diagnostics.png)。[键盘重试](18-candidate-mixed-keyboard-retry.png)读取当前状态并[恢复原草稿与输入](19-candidate-mixed-original-restored.png)。
- 最终中文[首次读取反馈](20-final-cold-zh-copy.png)和[重试读回](21-final-cold-zh-read-retried.png)。[候选真实回执与接口](candidate-selection-read-evidence.json)、[最终跨项目验证](final-cold-selection-evidence.json)和[SQLite 检查](profile-candidate-db-evidence.json)。

桌面截图由本人复核。[根因、影响和方案](../../records/2026-11/2026-11-12-work-ledger-selection-reading-recovery.md)
