# 关于页 Core 版本证据

对应[Recall、实施前根因分析和验收](../../records/2026-11/2026-11-09-about-core-version.md)。全部为实施者查看的真实开发桌面 1280×720 原始截图。

- [01 已连接而 Core 不可用](01-before-connected-core-unavailable.jpg)。
- [02 英文显示 local](02-after-en-current-core-version.jpg)；[03 同页切中文](03-after-zh-current-core-version.jpg)。
- [04 实际离线后 Core 不可用](04-after-offline-core-unavailable.jpg)；[05 同页自然恢复后显示新进程版本](05-after-same-page-recovered-version.jpg)。
- 真实接口检查：[前态](before-tcp.json)、[后态](after-tcp.json)、[重连](recovered-tcp.json)各三项；健康原值：[前态](before-health.json)、[后态](after-health.json)、[重连](recovered-health.json)。
- 自有进程回执：[前态](before-startup.json)、[后态](after-startup.json)、[重连](recovered-startup.json)。[Git 隔离基线](seed.json)、[数据核对](owned-final-check.json)、[接口检查器](check-project-tcp.mjs)和[数据核对脚本](audit-owned-data.py)。
