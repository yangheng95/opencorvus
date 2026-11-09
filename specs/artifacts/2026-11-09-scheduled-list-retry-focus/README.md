# 定时列表重试证据

对应 [Recall、根因与结果](../../records/2026-11/2026-11-09-scheduled-list-retry-focus.md)。图片均为本人查看的 1280×720 真实开发桌面。

- 前态：[01 原始失败](01-before-scheduled-list-failure.jpg)、[02 重试期间移除原焦点](02-before-retry-switches-to-loading-and-loses-focus.jpg)、[03 再次失败仍焦点在根](03-before-repeat-failure-keeps-focus-at-root.jpg)、[04 真实空列表返回但焦点未交接](04-before-real-empty-list-recovers-without-focus.jpg)。
- 英文后态：[05 原诊断入口](05-after-scheduled-list-failure.jpg)、[06 在途原诊断和焦点](06-after-pending-retry-keeps-diagnostic-and-focus.jpg)、[07 再次失败仍可从原焦点重试](07-after-repeat-failure-keeps-original-retry-focused.jpg)、[08 真实成功交给定时搜索](08-after-success-focuses-scheduled-search.jpg)、[09 原生键继续筛选](09-after-native-key-continues-in-restored-search.jpg)。
- 中文：[10 首读失败](10-after-chinese-scheduled-list-error.jpg)、[11 重试中](11-after-chinese-retry-progress-keeps-focus.jpg)、[12 真实成功保留用户选择的设置搜索焦点](12-after-chinese-success-keeps-chosen-settings-search.jpg)、[13 真实打开表单](13-after-chinese-can-open-new-form-without-saving.jpg)、[14 取消回真实空列表](14-after-cancel-returns-to-real-empty-list.jpg)。
- [前态观察](before-observed.json)、[英文后态](after-english-observed.json)、[中文后态](after-chinese-observed.json)、[前态真实响应](before-proxy.jsonl)、[后态真实响应](after-proxy.jsonl)及[透明代理](scheduled-list-delay-proxy.mjs)。
- [接口检查器](check-scheduled-list-tcp.mjs)、[前态](before-tcp.json)、[表单前](after-before-form-tcp.json)、[取消后](after-tcp.json)真实接口结构和数据。保留 [隔离项目](seed.json)、[原文件及端口核对](owned-final-check.json)及各自有进程启动和退出回执。
