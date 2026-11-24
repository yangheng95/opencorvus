# 同名定时计划的暂停、重启和恢复

## Recall

用户要求本人独立持续按批调查完整产品流程，先记录根因和影响，再做有证据的修复，进行真实桌面和截图复核、聚焦正向检查、范围提交、普通合并与推送。`6b872e83a` 与远端一致，原 177 项工作区状态保留。本批验证界面新建、自有服务重启、同名计划隔离和恢复，不触发实际运行。已读 [计划回执](2026-11-12-automation-status-receipt.md)、[精确时间](2026-11-12-scheduled-recurrence-readable-details.md)、[当前任务控制架构](../../current/architecture/task-control-plane.md)和最近的[定时任务浏览](2026-11-24-scheduled-unfiltered-navigation.md)。全仓查 `ScheduledAutomationsPanel` 的新建、项目选择、暂停与恢复，`global.automations` 的版本更新、计划触发和运行记录，以及 SQLite（嵌入式关系数据库）的当前投递索引。

## 验收记录

- `41740/ui/` 加载正式 `main-DPV2Gw9j.js`。先通过正式接口为西区保存 `Monthly handoff reminder`；随后从真实页面新建同名东区计划，选择唯一 `east-checkout`、录入独立指令和每月运行六次的 2099 年规则。页面显示东区 2099 年 12 月 1 日 09:15（Asia/Shanghai）、正确项目、原指令和无上次运行。同期西区使用不同项目、指令、规则和时刻。[桌面操作与正式证据](../../artifacts/2026-11-24-scheduled-lifecycle-across-projects/README.md)
- 实际暂停东区。正式列表确认东区的新暂停版本和西区原启用版本。当前投递记录由两项减为只有西区一项，原计划触发历史保留。通过实际关闭入口正常退出专用服务，新的进程连接同一隔离数据库，重新进入页面后东区仍显示暂停，可见原目标和原指令；正式读取也保持当时的版本和投递记录原身份。
- 在重启后的页面恢复东区。原计划标识、项目、原指令和 2099 年原时刻保留，新的启用版本拥有自己的未来投递记录；西区完整定义和投递记录一致。最终两个计划、四个版本、三个历史触发和两个未来投递记录。尝试、运行、会话、消息、执行任务和模型活动均为 0。截图逐张查看，两个浏览器标签和两个专用进程正常关闭。
- 已有聚焦检查 `real HTTP scope edits project the exact physical revision and survive database reopen` 通过（51 项断言）。本批没有产品代码变更。实际验收到创建、暂停、重启恢复和重新启用的持久行为；未来触发没有到期，未验真实交付或模型运行。
