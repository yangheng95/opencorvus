# 更新日志日期搜索桌面证据

对应[Recall、根因与验收](../../records/2026-11/2026-11-09-release-history-date-search.md)。全部为本人查看的真实开发桌面 1280×720 原图。

- 前态：[01 列表已有发布日期](01-before-version-list-shows-published-dates.jpg)、[02 标准日期遗漏](02-before-iso-date-does-not-find-listed-releases.jpg)、[03 英文显示日期遗漏](03-before-visible-english-date-does-not-find-listed-releases.jpg)、[04 中文显示日期遗漏](04-before-visible-chinese-date-does-not-find-listed-releases.jpg)。
- 英文候选：[05 标准日期](05-after-iso-date-finds-two-releases.jpg)、[06 英文显示日期](06-after-visible-english-date-finds-two-releases.jpg)、[07 日期加功能词](07-after-date-and-feature-find-one-release.jpg)、[08 键盘打开详情](08-after-enter-opens-original-detail.jpg)、[09 查询和焦点保留](09-after-return-restores-query-and-row-focus.jpg)、[10 空结果提示](10-after-conflicting-version-shows-date-hint.jpg)、[11 清空恢复全表](11-after-clear-restores-all-versions.jpg)。
- 中文候选：[12 切语言保留标准日期结果](12-after-switch-locale-retains-iso-results.jpg)、[13 中文显示日期](13-after-visible-chinese-date-finds-two-releases.jpg)、[14 日期加版本](14-after-chinese-date-and-version-find-one-release.jpg)、[15 中文原详情](15-after-chinese-original-release-detail.jpg)、[16 返回并保留查询和焦点](16-after-chinese-return-retains-query-and-focus.jpg)、[17 中文空结果提示](17-after-chinese-empty-state-explains-date-search.jpg)。
- [前态接口](before-tcp.json)、[候选接口](after-tcp.json)、[接口检查器](check-release-date-tcp.mjs)、[项目基线](seed.json)、[原文件和运行数据核对](owned-final-check.json)、[核对脚本](audit-owned-data.py)。
- [前态启动](before-startup.json)、[前态关闭](before-shutdown.json)、[候选启动](after-startup.json)、[候选关闭](after-shutdown.json)。
