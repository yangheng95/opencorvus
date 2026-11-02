# 全局查找结果阅读验收（903）

本轮使用开发CLI（Command Line Interface，命令行接口）的38637/38638 `/ui/`，本人独立隐藏页面208/209，未操作用户18571页面。下列17张图来自真实操作并已人工查看；没有运行UI（User Interface，用户界面）自动化测试。

| 截图 | 实际观察 |
| --- | --- |
| [01 原最近记录](01-before-recents.jpg) | 工作标题与右侧短项目说明挤在单行；前三条确实属于同一801项目。 |
| [02 原长标题](02-before-long-titles.jpg) | PREFLIGHT真实查询的标题被右侧说明进一步裁切。 |
| [03 原工作种类](03-before-work-kinds.jpg) | 同名Mission（多步任务）/Task（任务）种类正确，但项目只有短名。 |
| [04 改后最近记录](04-after-recents.jpg) | 标题和完整项目上下文分行；原自定义项目名保留。 |
| [05 键盘高亮](05-after-keyboard-scroll.jpg) | 原工作行的高亮覆盖标题及换行目录。 |
| [06 键盘滚动](06-after-local-command-scroll.jpg) | 移动到末尾Settings时列表实际滚动，本地命令仍为紧凑单行。 |
| [07 中文长标题](07-after-cn-long-titles.jpg) | 中文种类、匿名项目原身份后缀和完整目录换行。 |
| [08 加载末页](08-after-loaded-last-results.jpg) | 实际点击加载更多，从12条到17条，再滚动查看末尾。 |
| [09 中文种类](09-after-cn-work-kinds.jpg) | 原同名多步任务与子任务分别显示种类和目录。 |
| [10 原多步任务](10-after-mission-shortcut.jpg) | Ctrl+1实际进入801原Mission会话。 |
| [11 选中原子任务](11-after-task-keyboard-selection.jpg) | Down选中第二行子任务，高亮覆盖完整结果。 |
| [12 原任务打开](12-after-task-opened.jpg) | Enter回到原`tsk_g00VZT7V7400TdQ2J6Sj`，原交付文件仍可见。 |
| [13 名称查询](13-after-named-project-results.jpg) | 自定义项目、原多步任务、普通对话和通用工作共享结果层次。 |
| [14 项目打开](14-after-project-opened.jpg) | Ctrl+3进入原Project journey 773项目首页。 |
| [15 普通对话](15-after-conversation-opened.jpg) | Ctrl+4进入原759对话，身份及原内容正确。 |
| [16 本地命令](16-after-local-search.jpg) | 中文界面下`settings general`仍检索原设置命令，保留两组标题和单行布局。 |
| [17 通用工作](17-after-work-opened.jpg) | 最近记录Ctrl+6进入原877-after通用工作，显示原已完成持续目标和交付。 |

补充真实操作：最近记录中的Settings经键盘Enter实际打开通用设置；中文通过原外观设置切换；关闭查找Escape后焦点实际返回原对话输入框。API（Application Programming Interface，应用程序接口）事实仅作数据/身份补证，不能替代上述视觉复核。

[验证摘要](verification.json)记录两个原生进程正常退出、四份认证/完整模型目录副本退休、原259678行及源数据库、100项目文件/Git（版本管理）和229附件保全，0模型请求；工作四组完整查询、原24条收件箱响应、15原Mission及四份完整任务状态在初末完全一致。类型、语言、样式标记、文档及Node.js构建检查均通过，构建仍有既有大分块提示。

边界：原服务标题最长80字符，包含其本来保存的省略号；本轮没有补写标题。最多两行是呈现上限，不承诺显示未保存在原标题中的消息全文。仅桌面当前系统深色主题及中英文；未验收移动端、其它缩放/主题、服务错误/断线/竞态、文件离开提示或新的模型执行。收件箱只完成公开数据核对，未展开原消息或修改已读状态，其项目名称线索留待后续实页调查。
