# 多步任务技能刷新焦点证据

对应[Recall、实施前分析和真实验收](../../records/2026-11/2026-11-09-mission-skill-refresh-focus.md)。截图均为本人复核的真实开发桌面 1280×720 原图。

- 前态：[01 键盘到达刷新](01-before-refresh-keyboard-focus.jpg)、[02 成功后焦点落到页面根](02-before-success-loses-refresh-focus.jpg)。
- 后态：[03 真实等待期的刷新焦点](03-after-real-refresh-pending-focus.jpg)、[04 成功后仍聚焦刷新](04-after-success-keeps-exact-refresh-focus.jpg)、[05 Tab 进入搜索](05-after-next-tab-enters-existing-search.jpg)、[06 等待时主动移焦](06-after-user-moves-focus-during-read.jpg)、[07 完成后仍聚焦搜索](07-after-completion-respects-user-moved-focus.jpg)。
- 中文：[08 刷新保留项目、查询与焦点](08-after-chinese-refresh-retains-project-filter.jpg)、[09 真实离线禁用](09-after-offline-refresh-natively-disabled.jpg)、[10 同页面恢复](10-after-same-page-recovery-preserves-view.jpg)。
- [首轮键盘观察](first-keyboard-observation.json)、[忙碌窗口二次按键](pending-repeat-observation.json)、[等待中移焦](moved-focus-observation.json)、[请求关联结果](pending-verification.json)、[前态服务日志摘录](before-live-requests.json)、[后态服务日志摘录](after-live-requests.json)、[请求关联脚本](verify-keyboard-requests.py)、[日志摘录脚本](summarize-refresh-log.py)。
- [前态接口](before-tcp.json)、[后态接口](after-tcp.json)、[恢复接口](recovered-tcp.json)、[大目录真实响应](large-catalog-tcp.json)、[前态启动](before-startup.json)、[后态启动](after-startup.json)、[恢复启动](recovered-startup.json)、[原始项目身份](seed.json)、[最终持久化核对](owned-final-check.json)、[接口检查器](check-project-tcp.mjs)、[数据核对脚本](audit-owned-data.py)、[项目文件生成](seed-owned.py)、[大目录文件生成](prepare-large-catalog.py)。
