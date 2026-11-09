# 第 115 批：工作列表读取截止的桌面证据

在自有隔离 Windows 开发页真实搜索。代理把两种 `Ledger deadline` 查询各第一条原响应延后 24 秒，再完整转发，保持网页双向连接。候选超时关闭时，代理记录实际关闭，而不合成响应。

| 截图 | 人工复核 |
| --- | --- |
| [01](01-before-archive-still-loading-after-deadline.jpg)、[02](02-before-palette-still-loading-after-deadline.jpg) | 首轮代理后来不能完整交付正文，截图保留作工具调查，不计入产品验收。 |
| [03](03-before-fixed-proxy-archive-still-loading.jpg)、[04](04-before-fixed-proxy-palette-still-loading.jpg)、[05](05-before-archive-accepts-late-real-result.jpg)、[06](06-before-palette-accepts-late-real-result.jpg) | 修正代理后两页在约 22 秒仍加载，随后接受完整原结果。 |
| [07](07-after-archive-timeout-and-retry.jpg)、[08](08-after-palette-timeout-and-retry.jpg)、[09](09-after-chinese-archive-timeout-with-retry.jpg) | 候选两页的真实超时原因与重试，中文归档仍保留查询。 |
| [10](10-after-archive-retry-restores-all-results.jpg)、[11](11-after-palette-retry-restores-project.jpg)、[12](12-after-palette-project-opens-original-file.jpg) | 同查询真实重试读回三条归档和一个项目，从搜索结果打开原项目文件。 |
| [13](13-after-archive-opens-original-read-only-conversation.jpg)、[14](14-after-original-archived-conversation-stays-read-only.jpg) | 13 为转场观察，14 是完整原归档会话及只读提示。 |

[首次代理观察](first-proxy-observed.json)、[修正后基线](before-observed.json)及[候选](after-observed.json)提供操作时间。[代理](ledger-deadline-proxy.mjs) 用法为 `<代理端口> <服务端口> 24000`。[在线检查器](check-ledger-deadline-tcp.mjs)、[结果](after-ledger-tcp.json)与[对账](owned-ledger-deadline-audit.json)核对实际接口、请求、会话和退出。
