# 附件原件下载重试证据

对应[Recall、根因和验收](../../records/2026-11/2026-11-09-original-download-retry-focus.md)。截图均为本人复核的 1280×720 真实隔离开发桌面原图。

- 前态：[01 诊断只显示简略错误](01-before-download-diagnostic-truncates-request-facts.jpg)、[02 原生禁用导致焦点丢失](02-before-native-disabled-loses-focus-while-retrying.jpg)、[03 成功链接未接收焦点](03-before-recovered-download-link-has-no-keyboard-focus.jpg)。
- 英文候选：[04 实际方法和请求编号](04-after-download-diagnostic-shows-real-method-and-request-id.jpg)、[05 真实再次失败后仍可继续重试](05-after-repeated-real-error-retains-download-retry-focus.jpg)、[06 等待中保留诊断和焦点](06-after-pending-download-keeps-original-diagnostic-and-focus.jpg)、[07 焦点落在实际下载链接](07-after-success-focuses-the-named-download-link.jpg)。
- 中文候选：[08 同一下载失败动作](08-after-chinese-download-failure-retains-named-retry.jpg)、[09 等待时用户移到关闭](09-after-user-moves-focus-to-close-while-download-retries.jpg)、[10 成功后仍留在关闭](10-after-chinese-success-preserves-user-chosen-close-focus.jpg)、[11 键盘进入具名下载链接](11-after-chinese-keyboard-reaches-named-original-link.jpg)。
- [英文下载字节](english-download.json)、[中文下载字节](chinese-download.json)。
- [前态真实 404](before-true-404.json)、[前态真实请求](before-proxy.jsonl)、[候选真实请求](after-proxy.jsonl)、[前态项目和原件](before-project-and-originals.json)、[候选项目和原件](after-project-and-originals.json)、[数据核对](owned-final-check.json)、[接口检查器](check-attachment-origins.mjs)、[延迟代理](attachment-response-delay.mjs)、[原件核对脚本](audit-owned-data.py)。
