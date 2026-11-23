# 对话内查找作者标签的真实桌面截图

四张基线来自独立开发入口 `40604/ui/` 的真实已保存对话。

| 画面 | 观察 |
| --- | --- |
| [01 英文原消息](01-baseline-en-authored-user-card.jpg) | 正文保留实际命令，气泡显示 User。 |
| [02 英文查找结果](02-baseline-en-search-shows-raw-role.jpg) | 同一个结果显示内部标识 `user`。 |
| [03 中文原消息](03-baseline-zh-authored-user-card.jpg) | 同一气泡显示「用户」，Shell 参与者标识仍为 `chat`。 |
| [04 中文查找结果](04-baseline-zh-search-shows-raw-role.jpg) | 中文日期和计数正常，结果作者仍为 `user`。 |

七张候选截图来自独立开发入口 `40606/ui/`，由本人操作、截图并复核。

| 画面 | 观察 |
| --- | --- |
| [05 候选原消息卡](05-candidate-en-authored-user-card.jpg) | 作者 User 和原命令显示正确，Shell 回执作者仍为 `chat`。 |
| [06 英文查找结果](06-candidate-en-search-localizes-user.jpg) | 同一作者投影显示 User、日期和原文。 |
| [07 英文进入结果](07-candidate-en-search-locates-original-and-restores-focus.jpg) | 原正文高亮，标题菜单获得焦点。 |
| [08 中文查找结果](08-candidate-zh-search-reports-localized-user.jpg) | 作者「用户」、本地日期和真实匹配数。 |
| [09 中文保留查询重读](09-candidate-zh-refresh-keeps-query-and-author.jpg) | 真实刷新后恢复同一查询及结果作者。 |
| [10 中文精确定位](10-candidate-zh-search-highlights-original.jpg) | 同一原文被高亮，标题操作焦点恢复。 |
| [11 中文零匹配](11-candidate-zh-empty-search-is-unchanged.jpg) | 继续正确显示空结果和计数。 |
