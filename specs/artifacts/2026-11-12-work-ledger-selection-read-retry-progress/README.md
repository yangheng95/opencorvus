# 选中记录重试等待的真实桌面证据

- 英文[归档草稿第一次重试已发出，按钮仍显示 Retry](01-baseline-retry-appears-idle-while-held.png)。收到回执后[回到同一原请求](02-baseline-restored-read-before-tab.png)，[第一下 Tab 到恢复动作](03-baseline-first-tab-after-retry.png)。
- 另一项目 [Chat 第一次重试已发出，仍显示 Retry](04-baseline-chat-retry-waits-without-status.png)。
- [真实事件连接、两次重复读取和精确读回](baseline-retry-in-flight-evidence.json)。
- 首轮候选[等待中保留诊断与原请求](05-candidate-en-retrying-original-focused.png)、[回到原阅读页](06-candidate-en-retry-complete-reading.png)。真正的新通知在扣留期间到达，之后[显示最新标题](07-candidate-latest-title-after-real-event.png)。
- 最终英文[重试等待和焦点](08-final-en-retrying-focus.png)与[原请求和新标题](09-final-en-read-complete.png)。
- 最终中文 [Chat 等待状态](10-final-zh-retrying-focus.png)，[失败后原焦点与可重试状态](11-final-zh-retry-available-after-failure.png)，以及[完整读回的当前标题和输入区](12-final-zh-current-chat-title.png)。
- [候选真实请求、通知与正式接口](candidate-retry-in-flight-evidence.json)，[SQLite 完整性和数据计数](profile-candidate-db-evidence.json)。

本人复核截图。[根因、影响及方案](../../records/2026-11/2026-11-12-work-ledger-selection-read-retry-progress.md)
