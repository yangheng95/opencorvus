# Mission 首次启动重发的项目作用域和执行目标

[根因及方案](../../records/2026-11/2026-11-10-mission-first-wake-request-identity.md)。

- [01](01-before-first-wake-duplicates.jpg)：真实桌面任务列表中的两对重复启动。
- [02](02-before-one-initial-wake-open.jpg)：点击其中一条，实际 User Message、Session 和隔离模型诊断可见。

[实际串并行](before-wake-replays.json) · [显式目标及关闭对照](before-wake-explicit-and-terminal.json) · [四条独立执行身份](before-database.json) · [真实启动](before-startup.json)与[关停](before-shutdown.json)。

[实际请求脚本](check-before-first-wake.mjs) · [终态对照](check-before-terminal-wake.mjs) · [数据库查询](snapshot-first-wake.py)。截图均人工查看。明确的隔离模型配置不提供外部模型连接，没有使用用户凭据。

| 图 | 最终构建的真实桌面 |
| --- | --- |
| [03](03-after-form-ready.jpg) | 首次启动的实际请求、项目和 Work 模式。 |
| [04](04-after-lost-start-response.jpg) | 真实上游已经接受，截断的浏览器回执保留表单和重试按钮。 |
| [05](05-after-retry-opened-canonical-mission.jpg) | 重试后进入同一个 Mission Session，原 User Message 和隔离模型诊断可见。 |
| [06](06-after-single-mission-card.jpg) | 搜索此次桌面启动原文，真实看板显示唯一对应条目。 |

[实服串并行、跨项目、关闭和删除](after-initial.json) · [正常重启](after-restart.json) · [未提供键的独立启动](after-unkeyed.json) · [桌面真实两次请求与原消息](desktop-wake-acceptance.json) · [最终数据库](after-database.json)。

[初始启动](initial-startup.json)及[关停](initial-shutdown.json) · [重启](after-startup.json)及[关停](after-shutdown.json) · [代理关停](proxy-shutdown.json) · [真实构建入口](after-asset.json) · [所有验收进程已退出](owned-cleanup.json)。

复验脚本：[真实接口](check-after-first-wake.mjs)、[未传键](check-after-unkeyed.mjs)、[桌面回执](check-desktop-wake.mjs)、[本地截断代理](mission-wake-review-proxy.mjs)、[数据库](snapshot-after-first-wake.py)。未运行界面自动化测试。
