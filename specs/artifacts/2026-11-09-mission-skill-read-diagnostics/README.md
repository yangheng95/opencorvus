# 多步任务技能目录读取诊断证据

对应[Recall、实施前根因与验收](../../records/2026-11/2026-11-09-mission-skill-read-diagnostics.md)。截图为本人复核的真实开发桌面 1280×720 原图。

- 前态：[01 真实在线目录](01-before-online-project-catalog.jpg)、[02 刷新直接显示原始英文](02-before-offline-raw-error.jpg)、[03 离线误报专家团作用域](03-before-unavailable-scope-wrong-title.jpg)。
- 后态：[04 中文目录和项目筛选](04-after-online-localized-project-filter.jpg)、[05 本地化失败摘要](05-after-zh-read-error-keeps-filter.jpg)、[06 展开原始传输详情](06-after-zh-original-transport-details.jpg)、[07 英文已离线](07-after-en-disconnected-scope.jpg)、[08 中文已离线](08-after-zh-disconnected-scope.jpg)。
- 恢复：[09 同页手动刷新](09-after-recovered-refresh-preserves-query.jpg)、[10 原技能的实际路径](10-after-recovered-exact-project-file.jpg)、[11 已知目录的真正零结果](11-after-accepted-catalog-no-match.jpg)。
- [前态真实接口](before-tcp.json)、[后态真实接口](after-tcp.json)、[恢复真实接口](recovered-tcp.json)、[前态启动](before-startup.json)、[后态启动](after-startup.json)、[恢复启动](recovered-startup.json)、[项目原始数据](seed.json)、[最终持久化核对](owned-final-check.json)、[真实接口检查器](check-project-tcp.mjs)和[数据核对脚本](audit-owned-data.py)。
