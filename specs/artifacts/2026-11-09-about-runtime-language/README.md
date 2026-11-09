# 关于页运行宿主证据

对应[Recall、实施前分析和验收](../../records/2026-11/2026-11-09-about-runtime-language.md)。截图取自 1280×720 的独立真实开发 `/ui`，由实施者逐张查看。

- [01 英文前态](01-before-en-browser-host.jpg)；[02 中文仍为 Browser](02-before-zh-browser-untranslated.jpg)。
- [03 英文修复后](03-after-en-browser-and-technical-facts.jpg)；[04 中文「浏览器」](04-after-zh-localized-browser-host.jpg)；[05 同页切回英文](05-after-en-restored-language.jpg)。
- [前态接口](before-tcp.json)、[后态接口](after-tcp.json)共四项 HTTP 200，均按真实运行时 schema 核对；[前态健康](before-health.json)、[后态健康](after-health.json)显示独立服务返回的 Core 版本 `local`。
- [前态启动](before-startup.json)、[后态启动](after-startup.json)、[隔离 Git 基线](seed.json)与[关闭后的数据核对](owned-final-check.json)；[接口检查器](check-project-tcp.mjs)和[数据核对脚本](audit-owned-data.py)。
