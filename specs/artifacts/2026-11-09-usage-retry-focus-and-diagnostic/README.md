# 用量读取失败及重试证据

对应[Recall、根因与验收](../../records/2026-11/2026-11-09-usage-retry-focus-and-diagnostic.md)。本人在隔离项目真实桌面 `/ui` 操作并查看全部原图。

- [01](01-before-online-today.jpg)–[04](04-before-recovered-retry-focus-lost.jpg)：旧版真实日用量、离线中英文主文与重试成功后丢失的键盘焦点。
- [05](05-after-online-today.jpg)–[08](08-after-zh-summary-with-original-diagnostic.jpg)：新构建真实今日数据、错误摘要、展开原诊断并保持语言切换。
- [09](09-after-retry-focus-on-refresh.jpg)、[10](10-after-keyboard-hour-inspection.jpg)：同页恢复后的重试、常驻刷新焦点及 Tab/右箭头进入实际零值小时段。

[旧版在线](before-online-tcp.json)、[旧版恢复](before-recovered-tcp.json)、[修复后在线](after-online-tcp.json)、[修复后恢复](after-recovered-tcp.json)各三项 HTTP 200/当前运行时 schema。[数据复核](owned-final-check.json)含原 Git 文件、持久计数和配置清单。脚本不驱动浏览器；无模型或已配置的官方凭据使用。
