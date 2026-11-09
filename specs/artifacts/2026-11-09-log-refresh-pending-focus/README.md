# 日志刷新键盘焦点证据

对应 [Recall、根因和验收结果](../../records/2026-11/2026-11-09-log-refresh-pending-focus.md)。下列原图均为本人查看的 1280×720 实际桌面开发页。图片只显示隔离配置中专门写入的标识行，没有保存完整原始日志。

- 前态：[01 实际初始日志](01-before-filtered-real-server-log.jpg)、[02 等待时焦点移到页面根](02-before-refresh-loses-focus-while-reading.jpg)、[03 实际成功但焦点仍在页面根](03-before-refresh-completes-with-focus-at-root.jpg)。
- 后态正常路径：[04 实际初始日志](04-after-accepted-filtered-server-log.jpg)、[05 英文进度及原按钮焦点](05-after-refreshing-keeps-button-focused.jpg)、[06 新日志和原按钮焦点](06-after-successful-refresh-keeps-focus-and-new-log.jpg)。
- 原错误及恢复：[07 第二次实际刷新等待](07-after-second-refresh-stays-focused-in-flight.jpg)、[08 原故障摘要和重试焦点](08-after-refresh-failure-keeps-retry-focused.jpg)、[09 原诊断](09-after-refresh-failure-shows-original-diagnostic.jpg)、[10 同页重新读取实际日志](10-after-real-refresh-retry-restores-current-log.jpg)。
- 中文：[11 进度和原焦点](11-after-chinese-refresh-announces-progress.jpg)、[12 新日志到达后保留用户选择的焦点](12-after-refresh-does-not-steal-user-moved-focus.jpg)。
- [前态观察](before-observed.json)、[后态观察](after-observed.json) 与 [前态](before-proxy.jsonl)、[后态](after-proxy.jsonl)的转发记录配对；[代理](log-refresh-delay-proxy.mjs)仅调整实际读取响应的送达时间，后态第三次只送实际内容的前 32 字节。交互和截图为人工复核。
- [前态真实接口](before-tcp.json)、[后态真实接口](after-tcp.json)、[接口检查器](check-log-tcp.mjs)、[正式日志写入脚本](write-log-marker.mjs)及对应写入回执。保留了 [隔离项目基线](seed.json)、[项目原文件及端口核对](owned-final-check.json)和服务启动/退出回执。
