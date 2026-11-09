# Mission 手动草稿创建重发

[根因与验收方案](../../records/2026-11/2026-11-10-mission-draft-creation-replay.md)。

- [01](01-before-mission-draft-duplicates.jpg)：真实 Tasks 看板，四条待办、两对重复草稿。
- [02](02-before-one-duplicate-open.jpg)：点击其中一张，进入带原始请求的独立草稿会话。

[真实重复请求与列表](before-draft-replays.json) · [真实数据库](before-database.json) · [真实请求核对脚本](check-before-draft.mjs) · [启动](before-startup.json)及[关停](before-shutdown.json)。截图已人工查看，未运行界面自动化测试。

| 图 | 最终构建的真实桌面 |
| --- | --- |
| [03](03-after-desktop-draft-ready.jpg) | 实际填写并准备保存。 |
| [04](04-after-lost-draft-response.jpg) | 上游已保存，浏览器响应被截断；原表单与重试保留。 |
| [05](05-after-real-save-retry.jpg) | 重试成功；迁移库另有已删除会话导致列表读取失败。 |
| [06](06-after-retained-delete-breaks-readers.jpg) | 打开侧栏诊断，两个列表报告同一个已删除 Session。 |
| [07](07-clean-desktop-lost-response.jpg) | 干净档另一次保存回执截断，保留选择与重试。 |
| [08](08-clean-one-draft-after-retry.jpg) | 成功后 Backlog 只有一张草稿卡片，Open Mission 可用。 |
| [09](09-clean-open-accepted-draft.jpg) | 点击 Open Mission 后显示对应会话与原始待执行请求。 |

[升级及旧行保留](after-upgrade.json) · [实际串并行、编辑、归档、删除重发与项目迁移](after-initial.json) · [正常重启](after-restart.json) · [迁移档实际浏览器两次保存](desktop-draft-acceptance.json) · [干净档实际浏览器两次保存及真实列表](clean-desktop-draft-acceptance.json) · [两档最终数据库](after-database.json)。

独立后续问题：[真实旧草稿首次删除及对照 abort](retention-initial-failures.json)、[新草稿删除错误的服务日志摘录](retention-close-diagnostics.json)、[重启后读取回执](retention-reader-receipts.json)。终态事件来自最终数据库；前一次删除 500 与后台实际提交同时有证据。

[最终页面构建](after-asset.json) · [迁移服务首次启动](initial-startup.json)、[关停](initial-shutdown.json)、[重启](after-startup.json)、[关停](after-shutdown.json) · [空档启动](clean-startup.json)、[关停](clean-shutdown.json) · [迁移档代理退出](after-proxy-shutdown.json)、[空档代理退出](clean-proxy-shutdown.json) · [进程及端口最终检查](owned-cleanup.json)。

复验脚本：[真实草稿](check-mission-drafts.mjs)、[桌面回执与实际列表](check-desktop-drafts.mjs)、[本地回执截断代理](mission-draft-review-proxy.mjs)、[旧草稿删除](reproduce-retention-context.mjs)、[真实升级](check-upgrade.py)、[最终数据](check-final-databases.py)。原库、完整逐列快照和配置留在验收临时目录。
