# 日志读取失败证据

对应[Recall、实施前分析和验收](../../records/2026-11/2026-11-09-log-tail-failure-feedback.md)。截图均为本人查看的真实开发桌面 1280×720 原图。

- 前态：[01 正常加载服务日志](01-before-online-search-real-server-rows.jpg)、[02 离线原始错误](02-before-offline-raw-failure-in-empty-list.jpg)、[03 清除查询后错误原样](03-before-cleared-query-same-raw-error.jpg)。
- 后态：[04 同一查询加载真实日志](04-after-online-original-log-query.jpg)、[05 英文失败提示](05-after-en-offline-localized-feedback.jpg)、[06 中文失败提示](06-after-zh-offline-localized-feedback.jpg)、[07 原始错误详情](07-after-original-error-disclosure.jpg)、[08 清除查询保留诊断](08-after-clear-query-preserves-diagnostic.jpg)。
- 同页恢复：[09 原按钮刷新读到新进程日志](09-after-same-page-refresh-recovered-logs.jpg)、[10 正常无匹配](10-after-recovery-normal-no-match.jpg)、[11 清除查询恢复日志](11-after-clear-shows-recovered-loaded-rows.jpg)。
- 真实项目和日志尾部：[前态](before-tcp.json)、[后态](after-tcp.json)、[重连](recovered-tcp.json)，各 3 项 HTTP 200，均按运行时 schema 核对。只保留路径和行数，不保存整个日志。
- 自有服务：[前态启动](before-startup.json)、[后态启动](after-startup.json)、[重连启动](recovered-startup.json)、[隔离 Git 基线](seed.json)、[数据核对](owned-final-check.json)、[接口检查器](check-project-tcp.mjs)和[数据核对脚本](audit-owned-data.py)。
