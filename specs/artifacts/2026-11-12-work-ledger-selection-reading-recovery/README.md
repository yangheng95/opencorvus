# 精确读取中断时的真实桌面证据

- 已归档多步任务的[原请求](01-baseline-archived-original-request.png)在精确读取中断后[消失](02-baseline-archived-request-disappears.png)。原位[重试恢复标题和原请求](03-baseline-archived-original-request-retried.png)。
- 另一项目 Chat 的[原名](04-baseline-chat-before-read-cut.png)在精确读取中断后变成[通用对话标题](05-baseline-chat-title-lost-after-read-cut.png)。[重试读取](06-baseline-chat-title-retried.png)得到准确新标题。
- 真实恢复写入已经提交，回执和两个精确读被截断后，[恢复反馈的 Retry](07-mixed-feedback-does-not-retry-read.png)在传输恢复后[仍停在同一错误](08-mixed-retry-leaves-same-error.png)。
- [真实截断、重试与正式持久读回](baseline-selection-read-evidence.json)。英文未归档草稿的基线见[上一批候选截图](../2026-11-12-work-ledger-selection-invalidation/17-final-own-read-failure.png)。

桌面截图由本人复核。[根因、影响和方案](../../records/2026-11/2026-11-12-work-ledger-selection-reading-recovery.md)
