# 无项目 Chat 和 Work 创建：升级基线

[根因与迁移方案](../../records/2026-11/2026-11-10-global-conversation-creation-allocation.md)。所有图片来自本人隔离真实桌面并已人工查看。重复临时项目的 HTTP 与工作台证据见[项目内创建重发批次](../2026-11-10-project-conversation-creation-replay/README.md)。

| 图 | 版本 10，实际开发服务 39346 |
| --- | --- |
| [01](01-before-v10-conversations.jpg) | 版本 10 两个旧会话和一条已接受的旧分配会话可见，打开旧 Chat。 |
| [02](02-before-v10-work-selected.jpg) | 实际选择旧 Work，工作台切换中；完整旧身份由实际接口记录提供。 |

[原 Chat 与 Work](before-preserved-conversations.json) · [旧分配状态](before-owned-allocation-facts.json) · [版本与数据库](before-database.json) · [启动](before-startup.json) · [关停](before-shutdown.json)

| 图 | 版本 11，正常重启后的开发服务 39348 |
| --- | --- |
| [03](03-after-upgrade-global-chat.jpg) | 新 Chat 页头与项目树选中行一致，另一次明确新建有独立项目。 |
| [04](04-after-upgrade-legacy-work.jpg) | 从项目树点击旧 Work 后，其原名称和 Work 体验仍可见。 |
| [05](05-after-restarted-global-work.jpg) | 再点击重试过的新 Work，页头和对应项目树选中行一致。 |

[迁移备份及逐列对比](after-migration-integrity.json) · [实际重发、冲突及删除](after-initial-acceptance.json) · [重启后重发](after-restart-acceptance.json) · [重启前尚未接受的分配](prepared-v11-global-work.json) · [最后数据库状态](after-database.json) · [空库启动的创建回执](fresh-creation.json)及[数据库状态](fresh-database.json) · [桌面构建入口](after-asset.json)。

进程证据：[升级首次启动](initial-startup.json)及[关停](initial-shutdown.json)；[正常重启](after-startup.json)及[关停](after-shutdown.json)；[空库启动](fresh-startup.json)及[关停](fresh-shutdown.json)；[端口及进程最终状态](owned-cleanup.json)。

核对脚本：[实际接口](check-global-conversation.mjs)、[升级](check-upgrade.py)、[最终数据库](check-final-databases.py)。数据库、逐列快照、原始服务日志和配置留在隔离目录。截图是人工交互记录，没有运行界面自动化测试。

最终冻结片段重验：[隔离备份复制件 WAL 维护](fragment-maintenance.json)、[实际启动](fragment-startup.json)、[逐列结果](fragment-migration-integrity.json)及[关停](fragment-shutdown.json)。
