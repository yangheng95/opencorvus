# 多步任务归档跨标签桌面证据

同一隔离工作台的两个真实桌面标签。多步任务只保存了草稿。

| 基线场景 | 截图 |
| --- | --- |
| 归档前打开原始草稿 | [草稿](baseline-mission-before-archive.jpg) |
| 操作者归档后，活动侧栏更新 | [操作者](baseline-writer-archived.jpg) |
| 同时打开的归档页仍显示零结果 | [归档后观察者](baseline-open-archive-stale.jpg) |
| 改动搜索文本后读到已归档的任务 | [重新查询](baseline-changed-query-finds-archive.jpg) |
| 操作者恢复后，当前归档清空 | [恢复回执](baseline-writer-restored.jpg) |
| 另一个标签仍显示可点的恢复按钮 | [恢复后观察者](baseline-open-archive-stale-after-restore.jpg) |

| 候选场景 | 截图 |
| --- | --- |
| 在线观察者更新为两条，焦点仍留在对照行 | [在线更新](candidate-online-two-archived.jpg) |
| 实时连接中断期间的原归档状态 | [断流期间](candidate-held-original-archive.jpg) |
| 实时连接恢复后补读到两条 | [重连补读](candidate-reconnected-two-archived.jpg) |
| 操作者恢复成功，保留原动作回执 | [恢复回执](candidate-writer-restored.jpg) |
| 观察者原焦点行消失，焦点回到搜索 | [恢复后的键盘落点](candidate-online-restored-focus.jpg) |
| 原已在搜索输入中的观察者保留搜索焦点 | [仍在编辑](candidate-reconnected-restored.jpg) |

真实服务读写、影响及验收方案见[调查记录](../../records/2026-11/2026-11-24-archive-cross-tab-refresh.md)。
