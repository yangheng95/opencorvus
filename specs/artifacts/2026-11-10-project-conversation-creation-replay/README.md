# 项目内 Chat 与 Work 创建重发：基线

[根因与方案](../../records/2026-11/2026-11-10-project-conversation-creation-replay.md)。截图来自自有隔离真实桌面页面，均人工查看；公开接口负责产生受控请求，页面负责验证真实项目导航投影。

| 图 | 旧版 39342，main-BoLVp90r.js |
| --- | --- |
| [01](01-before-duplicate-conversations.jpg) | 两个具名项目分别有重复 Chat/Work，四个匿名项目也已显示。 |
| [02](02-before-second-project-chat.jpg) | 点击项目 A 另一条同名 Chat，实际进入第二条独立会话。 |
| [03](03-before-project-work-duplicates.jpg) | 点击项目 B Work 后的切换画面，重复行仍可见；实际持久身份由公开接口和数据库记录证明。 |

[实际请求、状态及会话身份](before-creation-replay.json) · [真实数据库](before-database.json) · [服务启动](before-startup.json) · [关停](before-shutdown.json) · [退出检查](before-cleanup.json)

| 图 | 最终候选 39344，main-BLiwZ7Zz.js |
| --- | --- |
| [04](04-after-restarted-work-ledger.jpg) | 重启后项目 A 的一条重送创建和一条独立创建，项目 B 的唯一 Work 及独立 Chat。 |
| [05](05-after-independent-chat-selected.jpg) | 实际点击另一次明确创建的 Chat，导航到它的独立身份。 |
| [06](06-after-project-work-selected.jpg) | 实际切换到项目 B 的唯一 Work，等待地址和标题完成。 |

[基线检查器](check-before-creation.mjs) · [候选接口检查器](check-after-creation.mjs) · [初次真实验收](after-initial-acceptance.json) · [重启真实验收](after-restart-acceptance.json) · [候选数据库](after-database.json) · [首次候选启动](initial-startup.json) · [首次候选关停](initial-shutdown.json) · [重启](after-startup.json) · [最终资源](after-asset.json) · [最终关停](after-shutdown.json) · [退出检查](owned-cleanup.json)
