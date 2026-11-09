# 日志来源搜索证据

对应[Recall、实施前分析和验收](../../records/2026-11/2026-11-09-log-source-language-and-search.md)。截图均为本人查看的真实开发桌面 1280×720 原图。

- 前态：[01 中文界面仍显示并匹配 Server](01-before-raw-source-visible-and-searchable.jpg)、[02 中文来源词无匹配](02-before-chinese-source-has-no-match.jpg)。
- 后态：[03 中文徽标和查询](03-after-chinese-badge-matches-source-query.jpg)、[04 原来源标识继续匹配](04-after-canonical-source-query-still-matches.jpg)、[05 原始诊断详情](05-after-original-details-preserved.jpg)、[06 英文名称和查询](06-after-english-source-and-query.jpg)、[07 清除恢复原日志](07-after-clear-original-logs.jpg)。
- [前态接口](before-tcp.json)、[后态接口](after-tcp.json)各 3 项 HTTP 200/运行时 schema；[前态启动](before-startup.json)、[后态启动](after-startup.json)、[Git 基线](seed.json)、[数据核对](owned-final-check.json)、[接口检查器](check-project-tcp.mjs)和[数据核对脚本](audit-owned-data.py)。
