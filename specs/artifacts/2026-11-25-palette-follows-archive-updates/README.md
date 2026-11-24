# 会话归档和恢复的全局搜索证据

基线服务 `41770/ui/` 使用 `main-DDsvwfvj.js` 和自建项目。以下截图取自实际桌面页并经人工查看。

| 步骤 | 可见结果 |
| --- | --- |
| [归档前](baseline-matching-active-conversation.jpg) | 全局搜索命中准确的另一项目会话。 |
| [归档后保持搜索](baseline-archived-conversation-remains-selectable.jpg) | 侧栏退出原会话，打开的活动查找仍显示该结果。 |
| [档案正式读取](baseline-confirmed-archive-entry.jpg) | 档案显示原名称和实际项目。 |
| [恢复已经确认](baseline-archive-restore-confirmed.jpg) | 档案显示恢复成功。 |
| [恢复后保持搜索](baseline-restored-conversation-missing-from-open-search.jpg) | 侧栏已再次显示原会话，打开的查找仍无匹配。 |

[归档正式读回](baseline-archive-accepted-queries.json)、[恢复正式读回](baseline-restore-accepted-queries.json)、[普通会话实际通知](baseline-archive-stream-events.json)和[多步任务草稿四次实际通知](baseline-mission-archive-stream-events.json)保留身份、请求回执和写入序列。

候选 `main-C6gLaLEb.js` 经隔离中转连接真实开发服务。观察页保持打开并保留原词，操作页使用正式归档控件。

| 步骤 | 可见结果 |
| --- | --- |
| [归档后旧结果退出](candidate-archiving-removes-the-active-result.jpg) | 活动查询自动重读，原输入保持。 |
| [独立项目继续命中](candidate-other-project-result-remains-active.jpg) | 另一项目的记录仍在当前结果。 |
| [档案恢复后原会话出现](candidate-restore-adds-same-conversation-to-active-search.jpg) | 不改查询即可再次选择同一会话。 |
| [键盘打开原会话](candidate-keyboard-opens-restored-conversation.jpg) | 同一项目及原会话标题，状态空闲。 |
| [草稿首次归档前](candidate-unstarted-mission-before-archive.jpg)、[归档后](candidate-mission-archive-clears-current-results.jpg)及[还原草稿后](candidate-mission-restore-reinstates-the-original-draft.jpg) | 同一个草稿退出再进入活动搜索，原请求正文保留。 |

[已归档会话](candidate-archived-conversation.json)、[恢复后会话](candidate-restored-conversation.json)、[首次多步任务归档](candidate-mission-initial-archive.json)、[多步任务恢复](candidate-mission-restore.json)、[真实自动搜索请求](candidate-query-traffic.json)、[桌面身份与焦点](candidate-desktop-state.json)和[持久事实与公开接口](candidate-durable-and-schema.json)记录实际回执。
