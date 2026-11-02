# 收件箱项目上下文验收（904）

本轮在开发CLI（Command Line Interface，命令行接口）的38639/38640/38641 `/ui/`使用本人隐藏页面210/211/212；用户18571页面未操作。19张图均来自真实交互并已人工查看，没有UI（User Interface，用户界面）自动化测试。14–19是最终main-W0LNQ_yy.js产物，01–13保留调查及修正过程。

| 截图 | 实际证据 |
| --- | --- |
| [01 真实改名](01-before-renamed-project.jpg) | 通过项目菜单保存名称，侧栏显示新名；悬停说明仍保留原目录。 |
| [02 名称不一致](02-before-mailbox-old-name.jpg) | 项目页已改名，收件箱分组仍取project短名且被父路径挤压。 |
| [03 名称查找为空](03-before-name-search-empty.jpg) | 按已保存自定义名搜索没有匹配。 |
| [04 原目录查找](04-before-directory-search.jpg) | 原目录片段可以找到同一项目原两条消息。 |
| [05 第一轮分组](05-after-mailbox-project-heading.jpg) | 项目名读取原规范名称，名称和父路径分行。 |
| [06 名称搜索修复](06-after-name-search.jpg) | 自定义名命中原两条消息，全局计数保持24。 |
| [07 折叠保留](07-after-collapse-retained.jpg) | 折叠后切换侧栏再返回，原查询和折叠状态保持。 |
| [08 待更新查询](08-after-pending-new-name-query.jpg) | 保持尚未保存的新全名查询，真实结果为空。 |
| [09 改名后自动命中](09-after-rename-query-refreshed.jpg) | 经真实项目菜单改为新全名，原查询自动得到两条原通知，没有重新输入或刷新页面。 |
| [10 第一轮中文](10-after-cn-query.jpg) | 中文搜索/消息种类和原正文保持。 |
| [11 第一轮全局列表](11-after-cn-global-inbox.jpg) | Escape恢复原24条未读及全局分组。 |
| [12 父路径仍裁切](12-after-original-later-groups.jpg) | 两个project组的父路径仍被截为相似的code-task…，因此继续修正。 |
| [13 冻结资源调查](13-republication-still-frozen.jpg) | 只复制文件并刷新未更新启动时冻结的资源；这不是最终验收图。 |
| [14 最终分组](14-final-readable-project-context.jpg) | 新实例启动时绑定正确产物，名称均衡换行、父路径最多两行，原数量和指示可读。 |
| [15 最终原目录](15-final-later-project-context.jpg) | 英文界面可读code-task-commit-authority-737与code-task-delivery-734原末段。 |
| [16 最终名称搜索](16-final-name-search.jpg) | 正确最终样式下，原项目名仍命中两条原消息。 |
| [17 最终中文搜索](17-final-cn-name-search.jpg) | 中文控件与原项目/消息文本，保留原全局24计数。 |
| [18 最终中文全局](18-final-cn-global-inbox.jpg) | 原24条未读和项目分组完整保留。 |
| [19 最终同名项目](19-final-cn-distinct-parent-paths.jpg) | 两个同名project的不同原目录末段可以直接区分。 |

[验证摘要](verification.json)仅作数据/交付补证。真实改名后的原查询重读发生在2026-11-02T11:48:32.317Z，规范项目PATCH在11:48:32.181Z，截取该证据时尚未进行改名后的诊断API（Application Programming Interface，应用程序接口）读取。服务器搜索的六项正向合同及同一事件流分派合同均通过；局部测试不能替代上面的视觉验收。

三轮服务均shutdown200、原99310/71708/89120执行句柄exit0，物理/输出/请求结清，六份认证及完整模型目录副本退休。首次75分钟共同期限保持，0个实际模型请求，累计1260。源库及所有未触及业务行、100项目文件/Git（版本管理）和229附件保持；只有本人隔离801项目的name/time_updated经过两次明确的真实重命名，原身份、目录及其它字段严格保持。最终轮次不改任何原业务行，仅增加两条本人服务控制租约。

边界：桌面当前系统深色主题、中英文；本轮未操作原消息的展开、已读、删除或会确认已读的“打开任务”，未验收隐式项目通知、其它设备/缩放/主题、断线/竞态或新的模型执行。原Task（任务）状态和身份已通过公开API完整核对。目录/名称过长仍受两行上限约束，完整原文保留在折叠标题的title（悬停说明）和无障碍内容中。收件箱筛选中的批量选择操作栏仍有代码线索，尚未实页复现，留作下一轮调查，不宣称已验证或已修复。
