# 文本附件恢复证据

对应[根因、实施和验收](../../records/2026-11/2026-11-09-text-preview-failure-recovery.md)。本人逐一查看实际开发桌面 1280×720 原图；附件均为此批创建的隔离样本。

- 前态：[01 编码错误附带无效重试](01-before-encoding-error-offers-futile-retry.jpg)、[02 重试只重复解码结果](02-before-retry-repeats-same-decoding-error.jpg)、[03 真实读取 404](03-before-real-read-failure-offers-preview-retry.jpg)、[04 简略诊断](04-before-http-diagnostic-only-stringifies-error.jpg)、[05 恢复文本但焦点丢失](05-before-real-retry-restores-text-but-loses-focus.jpg)。
- 第一轮：[06 编码指导与原件下载](06-after-encoding-error-offers-original-download.jpg)、[07 完整读取诊断](07-after-real-404-shows-complete-preview-diagnostic.jpg)、[08 再次真实失败保留焦点](08-after-repeated-404-keeps-preview-retry-focused.jpg)、[09 真实响应待定](09-after-delayed-retry-retains-diagnostic-and-focus.jpg)、[10 成功交接](10-after-success-focuses-recovered-readonly-text.jpg)、[11 方向键阅读](11-after-keyboard-reading-moves-to-second-line.jpg)。
- 中文：[12 编码指导](12-after-chinese-encoding-error-offers-download.jpg)、[13 主动移到关闭](13-after-user-moves-focus-to-close-during-retry.jpg)、[14 恢复后焦点仍在关闭](14-after-chinese-success-keeps-user-chosen-close-focus.jpg)。
- 第二轮：[15 重试焦点](15-second-build-retry-pending-with-keyboard-focus.jpg)、[16 外描边被裁切](16-second-build-external-ring-is-clipped.jpg)、[17 键盘阅读](17-second-build-keyboard-reading-with-clipped-ring.jpg)、[18 中文指引](18-second-build-chinese-encoding-guidance-and-download.jpg)。
- 最终：[19 成功恢复与完整焦点边框](19-final-recovered-text-shows-complete-border.jpg)、[20 方向键到第二行](20-final-keyboard-reads-second-line-with-visible-focus.jpg)、[真实 404](final-true-404.json)、[实际项目接口和三份原件](final-project-and-originals.json)。
- [原件下载字节核对](download-original.json)、[真实前态 404](before-true-404.json)、[前态恢复字节](before-restored.json)、[第一轮请求和延迟](after-proxy.jsonl)、[第二轮请求和延迟](second-build-proxy.jsonl)、[第一轮真实接口和原件](after-project-and-originals.json)、[第二轮真实接口和原件](second-build-project-and-originals.json)。
- [项目基线](seed.json)、[最终数据核对](owned-final-check.json)、[实际接口检查器](check-attachment-origins.mjs)、[原件与数据检查器](audit-owned-data.py)、[真实响应延迟代理](attachment-response-delay.mjs)。
