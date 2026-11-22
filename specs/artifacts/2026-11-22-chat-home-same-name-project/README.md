# 聊天首页当前项目范围的桌面验收

2026-11-22，独立项目开发服务和桌面浏览器的原图。

| 基线 | 人工观察 |
| --- | --- |
| [全局搜索](baseline-search.jpg) | 两个 `site-notes` 的真实完整目录在选择时可见。 |
| [南区首页](baseline-south-home.jpg) | 首页仅显示 `site-notes`，南区只存在于侧栏候选名称中。 |
| [南区文件浏览器](baseline-south-files.jpg) | 真实文件范围为 `south\site-notes`。 |
| [北区首页](baseline-north-home.jpg) | 北区切换后标题与南区相同。 |
| [北区文件浏览器](baseline-north-files.jpg) | 真实文件范围为 `north\site-notes`。 |
| [北区多步任务草稿](baseline-north-mission.jpg) | 草稿只显示 `Project context: site-notes`。 |

[基线项目与工作记录回执](baseline-projects.json) 保存了两个正式项目和搜索结果。

| 候选 | 人工观察 |
| --- | --- |
| [独名项目](candidate-en-unique.jpg) | 仍显示 `Let's work on explorer-review`。 |
| [英文南区](candidate-en-south.jpg) | 全局搜索按回车后，首页显示 `site-notes (south)`。 |
| [英文南区隐藏侧栏](candidate-en-south-sidebar-hidden.jpg) | 标题保留当前范围。 |
| [英文北区](candidate-en-north.jpg) | 鼠标选择北区后，首页改为 `site-notes (north)`。 |
| [英文北区文件浏览器](candidate-en-north-files.jpg) | 标题完整可见，文件浏览器显示 `north\site-notes` 的真实路径。 |
| [英文北区多步任务草稿](candidate-en-north-mission.jpg) | 草稿提示和标题均显示 `site-notes (north)`。 |
| [中文北区多步任务草稿](candidate-zh-north-mission.jpg) | 返回应用后保留北区范围，标题和草稿使用完整中文提示。 |
| [中文南区](candidate-zh-south.jpg) | 侧栏切换到南区，首页显示 `site-notes（south）`。 |
| [中文南区文件浏览器](candidate-zh-south-files.jpg) | 独立文件根目录为 `south\site-notes`，标题仍完整。 |
| [中文无项目首页](candidate-zh-global.jpg) | 新对话回到无项目原始提示。 |

[候选运行回执](candidate-runtime-proof.json) 含两个实际项目与工作记录在操作前后的原样回读、空 Mission 列表及其后隔离数据库的只读计数。
