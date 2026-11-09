# 用量自然周期日期证据

对应[Recall、根因与验收](../../records/2026-11/2026-11-09-usage-natural-period-date-range.md)。本人在真实开发 `/ui` 操作并复核全部原图。

- [01](01-before-en-today-repeated-date.jpg)–[03](03-before-zh-week-full-endpoints.jpg)：旧版中英文今日重复日期，中文周概要展示实际两个端点。
- [04](04-after-en-year-range.jpg)–[07](07-after-en-month-range.jpg)：最终英文日、周、月、年。
- [08](08-after-zh-month-range-kept.jpg)–[11](11-after-zh-today-single-date.jpg)：月份保持的语言切换，及中文周、年、日实际格式。
- [12](12-after-exact-hour-details.jpg)：实际 Tab/右箭头查看的完整小时段，保留原两个时刻和时区。

[旧版](before-online-tcp.json)、[改后](after-online-tcp.json)各四项实际 HTTP 200 运行时 schema 和原周期事实；[数据复核](owned-final-check.json)保留两个隔离原 Git 文件及数据库计数。无界面自动化、模型或配置过的官方凭据请求。
