# 保留删除的 Project 执行所有权与列表可见性

[根因、横向审计与方案](../../records/2026-11/2026-11-10-retained-execution-owner-and-readers.md)。

[01 修改前真实桌面](01-before-retained-readers-failed.jpg)：隔离开发服务 39364。任务看板和侧栏均引用同一已删除 Session；本人打开侧栏详情并人工复核。

[真实启动](before-startup.json) · [Mission 与列表](before-baseline.json) · [Task 删除](before-task-stop.json) · [Session 对照和空分页](before-session-stop.json) · [实际堆栈与持久事件](before-terminal-facts.json)。

[Mission 取证](check-before-retention.mjs) · [Task 取证](check-before-task-stop.mjs) · [Session 取证](check-before-session-stop.mjs) · [日志与数据库核对](snapshot-before-terminal.py)。无界面自动化。

| 图 | 最终真实桌面（已正常重启） |
| --- | --- |
| [02](02-after-retained-readers-restored.jpg) | 两个原故障读者恢复，项目、侧栏和任务列表正常显示。 |
| [03](03-after-filtered-board.jpg) | 用真实搜索筛选并切换 Board，唯一匹配的保留草稿可见。 |
| [04](04-after-opened-live-mission.jpg) | 从看板实际打开，页头、左侧选中、原始草稿请求一致。 |

[实际首次与并行删除、活动/归档分页](after-initial.json) · [正常重启后重发](after-restart.json) · [第二项目首次删除和可见读取](after-other-project.json) · [实际数据库终态与关系](after-terminal-facts.json)。

[修改前关停](before-shutdown.json) · [候选启动](candidate-startup.json)与[关停](candidate-shutdown.json) · [正式首次启动](initial-startup.json)与[关停](initial-shutdown.json) · [重启](after-startup.json)与[关停](after-shutdown.json) · [真实桌面构建](after-asset.json) · [所有进程退出](owned-cleanup.json)。

复验脚本：[实服删除与读取](check-after-retention.mjs)、[另一个项目](check-after-other-project.mjs)、[数据库终态](snapshot-after-terminal.py)。数据文件、运行配置和日志留在隔离目录；脚本只使用本地验收服务。
