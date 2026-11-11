# 归档恢复回执中断的桌面证据

- 基线英文[阅读页归档草稿](01-baseline-reader-archived-draft.png)在真实恢复后仍[只读并显示失败](02-baseline-reader-restored-state-with-error.png)。[设置归档的多步任务](03-baseline-settings-archive-row.png)恢复后[留在列表并显示失败](04-baseline-settings-restored-state-with-error.png)。[两个正式回执与精确读取](baseline-archive-restore-receipt-evidence.json)证明草稿均恢复到待办并保留原请求。
- 同名另一项目中的 [Chat 归档行](05-baseline-settings-chat-other-project.png)恢复后[同样留在列表并显示失败](06-baseline-settings-chat-restored-with-error.png)。[Chat 正式回执、空闲状态与项目隔离](baseline-chat-archive-restore-receipt-evidence.json)。
- [隔离服务重启后](restart-chat-archive-restore-receipt-evidence.json)三个身份仍已恢复，错误项目读取仍返回 404。[持久数据库检查](profile-baseline-db-evidence.json)显示三个 Session，消息、执行 Task、模型活动和许可账本均为零。

桌面截图由本人复核。[根因、影响及方案](../../records/2026-11/2026-11-12-archive-restore-receipt.md)
