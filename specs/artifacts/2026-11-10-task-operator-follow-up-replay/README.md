# Task 跟进重发复用已接受的消息与轮次证据

- [基线真实桌面](01-before-task-duplicate-follow-ups.jpg)：同一 Task 的两组真实重复用户跟进。
- [串行、并行、第二项目和严格输入回执](before-task-follow-up.json)；[失败后重发两次的真实轮次](before-terminal-replay.json)；[不可变 ingress 与真实 Message 所在 Session](before-database.json)。
- [独立开发服务启动](before-startup.json)、[关停](before-shutdown.json)、[所有基线进程退出](before-cleanup.json)。
- [真实请求检查](check-before-task-follow-up.mjs)、[真实终态检查](check-before-terminal-replay.mjs)、[SQLite 只读核对](snapshot-task-follow-up.py)。

## 修复后

| 本人查看的实际桌面 | 结果 |
| --- | --- |
| [02](02-after-task-draft.jpg) | 已结束的第二项目 Task、准确模型和原草稿。 |
| [03](03-after-task-lost-receipt.jpg) | 上游已接受、回执中断；原消息和可重发原稿可见。 |
| [04](04-after-task-replay.jpg) | 在实际结束后重试，只看到一条原跟进，输入清空且仍处于原失败终态。 |

[候选首次并发](candidate-smoke.json) · [终态、模型目录变更、取消、删除及分项目回执](after-initial.json) · [重启](after-restart.json) · [v12 备份和实服 v13 持久事实、真实桌面两次发送](after-database.json) · [全新 v13 接受](fresh-acceptance.json)与[持久证据](fresh-database.json)。

[真实请求检查](check-after-task-follow-up.mjs) · [物理移交和备份核对](check-task-follow-up-database.py) · [新库检查](check-fresh-task-follow-up.mjs) · [本地透明代理](task-follow-up-proxy.mjs)。

[第一次候选启动](candidate-startup.json)与[关停](candidate-shutdown.json) · [真实迁移与重开](migration-startup.json) · [最终重启](after-startup.json)、[真实构建](after-asset.json)及[关停](after-shutdown.json) · [全新服务](fresh-startup.json)、[迁移](fresh-migration-startup.json)和[关停](fresh-shutdown.json) · [代理关停](proxy-shutdown.json) · [全部进程退出](owned-cleanup.json)。
