# 多步任务草稿编辑回执的真实桌面证据

- [编辑原草稿](01-baseline-edit-original-draft.png)后，截断真实已提交的回执使编辑框[继续显示传输失败](02-baseline-committed-edit-still-reports-error.png)。[正式精确读](baseline-edit-evidence.json)已保存新请求。
- 原样点击保存后[列表确认同一请求](03-baseline-replayed-edit-shows-current-request.png)。[真实重放及更新时间](baseline-edit-replay-evidence.json)证明原回执丢失后的重放按当前契约返回同一结果。
- [明确并发冲突仍保留本地输入](04-baseline-explicit-conflict-preserves-edit.png)，[另一连接的真实写回执](baseline-concurrent-edit.json)。
- 候选英文[完整回执](05-candidate-complete-edit-receipt.png)，[等待真实回执](06-candidate-en-edit-awaits-receipt.png)后截断并[精确确认原草稿](07-candidate-en-confirmed-exact-draft.png)。
- 中文[保存与确认读取同时中断](08-candidate-zh-save-unconfirmed.png)，可展开[两次真实传输诊断](09-candidate-zh-save-diagnostics.png)，原样重试后[看板显示准确文本](10-candidate-zh-saved-board.png)。
- 真实并发冲突[保留本地编辑](11-candidate-zh-conflict-keeps-editor-text.png)，展开看到[请求编号](12-candidate-zh-conflict-diagnostics.png)与[结构化错误](13-candidate-zh-conflict-structured-error.png)。
- [候选实际回执、精确读回与正式任务列表](candidate-draft-edit-receipt-evidence.json)，[SQLite 检查](profile-candidate-db-evidence.json)。

截图由本人复核。[根因、影响及方案](../../records/2026-11/2026-11-12-mission-draft-edit-receipt.md)
