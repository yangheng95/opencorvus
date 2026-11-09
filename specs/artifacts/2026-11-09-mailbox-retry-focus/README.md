# 收件箱重试、焦点和本地化证据

对应 [Recall、修改前根因和验收](../../records/2026-11/2026-11-09-mailbox-retry-focus.md)。以下是真实开发桌面的 1280×720 原图，由本人逐张复核。

- 前态：[01 指定查询失败](01-before-search-read-shows-generic-error.jpg)、[02 重试移除焦点所在按钮](02-before-retry-removes-focused-action.jpg)、[03 再次失败焦点仍在页面](03-before-repeat-failure-leaves-focus-at-page.jpg)、[04 读取成功焦点仍在页面](04-before-search-recovers-without-focus-target.jpg)。
- 排版：[首次候选窄列](layout-initial-06-retry-diagnostic-in-narrow-column.jpg)；调整后 [05 英文摘要和操作](05-after-mailbox-specific-failure.jpg)、[06 原诊断完整排版及在途焦点](06-after-pending-retry-keeps-focus-and-original-details.jpg)、[07 重复失败仍可重试](07-after-repeat-failure-keeps-same-retry.jpg)、[08 成功回到原查询输入](08-after-success-returns-focus-to-current-search.jpg)。
- 中文：[09 原读取失败](09-after-chinese-mailbox-error.jpg)、[10 进度和原焦点](10-after-chinese-retry-progress-and-focus.jpg)、[11 成功保留用户所选焦点](11-after-success-keeps-user-chosen-focus.jpg)、[12 换查询后呈现自己的空结果](12-after-new-query-retires-previous-retry.jpg)、[13 清除查询暴露旧文案](13-after-clearing-query-exposes-old-empty-copy.jpg)。
- [前态观察](before-observed.json)、[候选观察](after-observed.json)、[前态转发](before-proxy.jsonl)、[后态交互转发](interaction-proxy.jsonl)和[代理](mailbox-read-delay-proxy.mjs)，只控制特定真实响应的送达。保留 [原真实接口检查](interaction-tcp.json)、[接口检查器](check-mailbox-tcp.mjs)和[隔离项目基线](seed.json)。
- 终版：[14 清除搜索后正确本地化](14-final-cleared-query-shows-localized-empty-mailbox.jpg)、[终版观察](final-localized-observed.json)、[真实转发](after-proxy.jsonl)、[直接接口检查](after-tcp.json)、[原文件及端口核对](owned-final-check.json)。另保留启动探索的转发以及各自有进程启动和退出回执。
