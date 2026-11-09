# 日志刷新阅读位置证据

对应 [Recall、修改前根因和验收](../../records/2026-11/2026-11-09-log-reading-position-on-refresh.md)。图片是本人查看的真实 1280×720 桌面原图，仅展示隔离服务的受控日志。

- 前态：[01 初始尾部](01-before-initial-tail.jpg)、[02 手动向上读旧记录](02-before-scrolled-to-older-records.jpg)、[03 真实刷新跳到新尾部](03-before-refresh-replaces-reading-position-with-tail.jpg)。
- 后态：[04 初始尾部](04-after-initial-tail.jpg)、[05 等待读取时继续上滚](05-after-wheel-during-held-refresh.jpg)、[06 完整读取仍停在同一位置](06-after-refresh-keeps-older-reading-position.jpg)、[07 手动回到尾部](07-after-manually-returned-to-real-tail.jpg)、[08 回到底部后跟随新的实际记录](08-after-at-bottom-follows-new-actual-rows.jpg)。
- 筛选和中文：[09 收窄查询时定位最新匹配](09-after-query-lands-at-new-result-tail.jpg)、[10 改变级别时同样定位最新匹配](10-after-level-change-lands-at-real-tail.jpg)、[11 中文重开](11-after-chinese-reopen-lands-at-tail.jpg)、[12 原传输错误和重试](12-after-chinese-failure-keeps-retry.jpg)、[13 中文恢复后的真实最新日志](13-after-chinese-recovery-starts-at-current-tail.jpg)。
- [前态位置](before-observed.json)、[后态位置](after-observed.json)、[真实转发记录](after-proxy.jsonl)、[延后/截断代理](log-reading-delay-proxy.mjs)。完整的原始日志未收录。
- [前态真实接口](before-tcp.json)、[后态真实接口](after-tcp.json)、[有序日志检查器](check-log-reading-tcp.mjs)、[正式日志写入脚本](write-log-reading.mjs)和相应写入回执；[隔离项目基线](seed.json)、[原文件及端口核对](owned-final-check.json)和服务启动/关闭回执。
