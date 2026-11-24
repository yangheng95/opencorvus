# 收件箱刷新失败的阅读证据

- [刷新之前可读、已选中的原通知](baseline-mailbox-message-readable.jpg)。
- [读取失败隐藏原正文和列表](baseline-mailbox-error-hides-accepted-message.jpg)。原查询和页头选择仍在，实际焦点为页面主体。
- [重试成功后原正文再次可读](baseline-mailbox-retry-rebuilds-original-message.jpg)，焦点交给搜索输入。
- [同一连接、实际读写及前后原通知](baseline-mailbox-refresh-receipts.json)。

## 候选复核

- [首版保住焦点但正文下缘暂时出视口](candidate-initial-error-keeps-focused-message.jpg)。[最终修正后完整正文、勾选与阅读焦点均可见](reviewed-error-keeps-full-reading-position.jpg)。
- [真实重试在途时的诊断与列表](reviewed-retry-keeps-diagnostic-and-messages.jpg)，[同一查询成功读回原正文和活动计数](reviewed-retry-returns-live-mailbox.jpg)。
- [新查询使用首次失败诊断](reviewed-new-query-uses-initial-error.jpg)，重试后[确认为零匹配](reviewed-initial-retry-confirms-empty-query.jpg)。
- [中文页面保留原正文](reviewed-zh-keeps-original-mailbox-body.jpg)，[中文失败说明及重试动作与原结果并存](reviewed-zh-localized-mailbox-refresh-error.jpg)。
- [两套候选的真实响应、版本和最终原通知](candidate-mailbox-refresh-receipts.json)。
