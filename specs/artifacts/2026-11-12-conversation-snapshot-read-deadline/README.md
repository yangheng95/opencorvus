# 对话快照读取的真实桌面和请求

基线使用 `39841/ui` 和隔离开发服务 `39840`。代理只持有或截断原服务真实回复。

- [查找超过标准读期限仍等待](01-baseline-find-still-waiting.png)、[关闭后返回原会话](02-baseline-find-closed.png)、[导出超过标准读期限仍等待](03-baseline-export-still-waiting.png)、[切换到独立通用工作](04-baseline-export-switches-owner.png)。
- [通用工作查找显示诊断](05-baseline-find-failure.png)、[重试等待时诊断消失](06-baseline-find-retry-loses-diagnostic.png)、[完整回复确认真实空会话](07-baseline-find-retry-succeeds.png)。
- [正式响应及精确原会话](baseline-snapshot-evidence.json)。

首轮候选的[超时详情](10-candidate-find-timeout-diagnostic.png)显示了包装错误和编码路径。最终候选使用 `39845/ui` 与 `39844`，展示原诊断。

- [英文查找读取中](11-final-find-loading.png)、[原超时类型](12-final-find-timeout-diagnostic.png)、[重试期间保留已展开诊断](13-final-find-retry-keeps-diagnostic.png)、[完整匹配结果](14-final-find-retry-empty-result.png)、[Escape 归还焦点](15-final-find-escape-returns-focus.png)。
- [会话导出等待](16-final-export-loading.png)、[超时且保留原标题](17-final-export-timeout.png)、[原超时诊断](18-final-export-timeout-diagnostic.png)、[原会话下载](19-final-export-download-started.png)、[切换后独立工作会话](20-final-export-switches-owner.png)。
- [中文工作查找读取错误](21-final-chinese-find-failure.png)、[中文重试保留原诊断](22-final-chinese-find-retry-keeps-diagnostic.png)、[原空会话的完整结果](23-final-chinese-find-empty-conversation.png)。
- [正式回执、期限、取消及下载文件](final-snapshot-evidence.json)、[隔离数据状态](final-storage-evidence.json)。
