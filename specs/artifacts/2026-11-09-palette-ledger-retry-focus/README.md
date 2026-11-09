# 全局搜索重试焦点证据

对应 [Recall、修改前根因和验收结果](../../records/2026-11/2026-11-09-palette-ledger-retry-focus.md)。以下均为本人查看的实际 1280×720 桌面原图。

- 前态：[11 查询失败](11-before-palette-ledger-error.jpg)、[12 等待丢失焦点](12-before-palette-retry-replaces-diagnostic-and-loses-focus.jpg)、[13 再失败焦点回输入](13-before-repeat-failure-focuses-search-instead-of-retry.jpg)、[14 完整读取显示原项目](14-before-palette-recovers-original-project.jpg)。
- 英文后态：[15 查询失败](15-after-palette-original-query-error.jpg)、[16 在途保留焦点和原诊断](16-after-pending-retry-keeps-diagnostic-and-focus.jpg)、[17 再次失败仍聚焦 Retry](17-after-second-failure-keeps-retry-focused.jpg)、[18 成功回查询并显示真实项目](18-after-current-project-restores-query-focus.jpg)、[19 实际键盘接受该项目](19-after-keyboard-opens-original-project-result.jpg)。
- 中文后态：[20 重试入口](20-after-chinese-retry-entry.jpg)、[21 在途焦点](21-after-chinese-retry-stays-focused.jpg)、[22 新查询返回自己的真实项目](22-after-new-query-owns-real-project-result.jpg)、[23 本地日志命令照常可查](23-after-local-log-command-remains-searchable.jpg)。
- [前态观察](before-observed.json)、[后态观察](after-observed.json)、[前态真实响应](before-proxy.jsonl)、[后态真实响应](after-proxy.jsonl)及[延后/截断代理](palette-ledger-delay-proxy.mjs)。
- [接口检查器](check-palette-ledger-tcp.mjs)、[前态](before-tcp.json)、[后态](after-tcp.json)核对实际项目和工作记录接口；保留 [隔离项目基线](seed.json)、[原文件与端口核对](owned-final-check.json)及自有进程启动/关闭回执。
