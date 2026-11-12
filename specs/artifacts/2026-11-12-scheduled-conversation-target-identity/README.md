# 定时任务绑定会话的桌面证据

基线真实桌面 `39818/ui` 连接 `39817`。两个正式定时定义各绑定一个独立项目中的空会话。

- [同名列表](01-baseline-indistinguishable-conversation-schedules.png)、[详情只有通用范围](02-baseline-detail-omits-conversation-target.png)、[删除确认省略会话](03-baseline-delete-omits-linked-conversation.png)。
- [编辑显示第一会话的真实标识](04-baseline-edit-shows-session-identity.png)，[第二会话真实标题搜索无结果](05-baseline-conversation-title-search-empty.png)。
- [正式列表、会话、计划触发与运行历史](baseline-conversation-target-evidence.json)。

候选真实桌面 `39820/ui` 连接 `39819`。本人逐张检查截图，确认和编辑均取消。

- [英文两个会话标题](06-candidate-conversation-titles-in-list.png)、[搜索原会话标题](07-candidate-search-by-bound-title.png)、[详情中的会话和路径](08-candidate-exact-session-and-path-in-detail.png)、[删除确认](09-candidate-delete-confirms-linked-conversation.png)和[编辑中的原会话](10-candidate-edit-retains-project-session.png)。
- 中文的[会话改成同名后各自保留标识](11-candidate-zh-same-session-title-exact-identities.png)、[按真实路径搜索](12-candidate-zh-search-by-session-path.png)、[改名后的精确详情](13-candidate-zh-renamed-exact-conversation-detail.png)、[确认对话框](14-candidate-zh-confirmation-retains-conversation.png)及[删除会话后首轮列表](15-candidate-zh-missing-session-retains-id.png)。
- 最终构建的[英文列表](16-final-en-missing-state-and-exact-id.png)、[中文列表](17-final-zh-missing-state-and-exact-id.png)、[搜索原标识](18-final-zh-search-by-exact-id.png)、[不可用详情](19-final-zh-missing-conversation-detail.png)和[编辑提示](20-final-zh-missing-conversation-edit.png)。
- [正式会话改名和删除、原定义与正式计划历史](candidate-conversation-target-evidence.json)、[实际重启后的列表与计划](candidate-final-evidence.json)、[版本、绑定会话与前沿的只读对账](candidate-database-evidence.json)。
