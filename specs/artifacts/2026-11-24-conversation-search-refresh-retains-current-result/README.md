# 对话内查找真实刷新桌面证据

- 英文 100% 的[触发前 DR-13](baseline-en-before-activating-refresh.jpg)、[真实响应尚未交付](baseline-en-refresh-removes-all-accepted-results.jpg)、[完整响应后回到 DR-01](baseline-en-refresh-restores-results-at-first-row.jpg)及[截短响应与重试](baseline-en-failed-refresh-shows-original-retry.jpg)。
- 中文 160% 的[触发前 DR-13](baseline-zh-before-activating-refresh.jpg)、[等待时结果退场](baseline-zh-refresh-removes-all-accepted-results.jpg)及[完整响应后 DR-01](baseline-zh-refresh-restores-results-at-first-row.jpg)。
- [原始会话和回执](baseline-conversation.json)、[英文完整响应](baseline-held-response.json)、[中文完整响应](baseline-zh-held-response.json)及[截短接收记录](baseline-truncated-response.json)。响应由真实开发服务产生；截图由本人操作与查看。
- [直接连接的旧版定位了新增原消息](baseline-direct-appended-message-highlight.jpg)，见[追加后的会话](baseline-after-append-conversation.json)。
- 候选英文 100% [等待刷新保留 DR-13](candidate-en-loading-retains-current-result.jpg)、[完整接受后保持位置](candidate-en-refreshed-keeps-current-result.jpg)，见[接收记录](candidate-en-held-response.json)。
- 候选简体中文 160% [等待时保持 DR-13](candidate-zh-loading-keeps-accepted-dispatch-position.jpg)、[新快照接受后 16 条](candidate-zh-new-snapshot-adds-result-keeps-current.jpg)、[精确定位新增 DR-16](candidate-zh-locates-new-original-dispatch-message.jpg)以及[刷新等待中定位已接受的 DR-16](candidate-zh-locates-accepted-message-during-refresh.jpg)。见[最终会话消息](candidate-conversation.json)、[新快照接收](candidate-zh-held-response.json)和[定位时取消读取](candidate-refresh-cancelled-by-location.json)。
- 中文[显示原始解析诊断](candidate-zh-failed-read-retains-query-and-original-error.jpg)、[等待重试时保留诊断](candidate-zh-waiting-for-retry-keeps-original-diagnostic.jpg)与[重试接受 16 条](candidate-zh-retry-accepts-all-sixteen-results.jpg)，见[截短](candidate-truncated-response.json)和[完整重试接收](candidate-retry-response.json)记录。

[调查和验收方案](../../records/2026-11/2026-11-24-conversation-search-refresh-retains-current-result.md)。
