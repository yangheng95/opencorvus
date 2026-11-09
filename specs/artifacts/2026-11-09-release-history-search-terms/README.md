# 更新日志组合搜索证据

对应[Recall、实施前分析和验收](../../records/2026-11/2026-11-09-release-history-search-terms.md)。截图均为本人查看的真实开发桌面 1280×720 原图。

- 前态：[01 单独版本号](01-before-version-only-finds-current.jpg)、[02 单独功能词](02-before-keyword-only-finds-current.jpg)、[03 组合输入遗漏](03-before-combined-query-empty.jpg)。
- 后态：[04 组合命中](04-after-combined-query-finds-current.jpg)、[05 键盘打开原详情](05-after-open-keyboard-current-detail.jpg)、[06 返回恢复查询和行焦点](06-after-return-retains-query-and-row-focus.jpg)。
- [07 规范 beta 和大写词](07-after-normalized-beta-and-uppercase-keyword.jpg)、[08 独立版本不合并](08-after-distinct-versions-do-not-combine.jpg)、[09 清空恢复全部](09-after-clear-restores-all-versions.jpg)。
- [10 中文词与本地日期](10-after-chinese-terms-and-date.jpg)、[11 中文原始详情](11-after-chinese-original-release-detail.jpg)。
- [前态接口](before-tcp.json)、[后态接口](after-tcp.json)各两项，均 HTTP 200/运行时 schema；[前态启动](before-startup.json)、[后态启动](after-startup.json)、[Git 基线](seed.json)、[数据核对](owned-final-check.json)、[接口检查器](check-project-tcp.mjs)和[数据核对脚本](audit-owned-data.py)。
