# 对话快照读取的真实桌面和请求

基线使用 `39841/ui` 和隔离开发服务 `39840`。代理只持有或截断原服务真实回复。

- [查找超过标准读期限仍等待](01-baseline-find-still-waiting.png)、[关闭后返回原会话](02-baseline-find-closed.png)、[导出超过标准读期限仍等待](03-baseline-export-still-waiting.png)、[切换到独立通用工作](04-baseline-export-switches-owner.png)。
- [通用工作查找显示诊断](05-baseline-find-failure.png)、[重试等待时诊断消失](06-baseline-find-retry-loses-diagnostic.png)、[完整回复确认真实空会话](07-baseline-find-retry-succeeds.png)。
- [正式响应及精确原会话](baseline-snapshot-evidence.json)。
