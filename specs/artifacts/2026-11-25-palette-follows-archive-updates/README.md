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
