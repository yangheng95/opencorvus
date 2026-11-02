# 文件浏览项目语境验收

本轮按[调查方案](../../records/2026-11/2026-11-03-file-browser-context.md)在隔离原生开发页面38671/38672实际交互，13张截图均已人工查看。[验证记录](qualification.json)保存原数据、目标和资源结清结果。

文件工具现在直接说明当前项目名称与完整根目录；隐藏项目侧栏时也能区分相同的相对文件名。名称使用已有规范项目事实，搜索、打开和新建仍使用原目录及原动作。

| 截图 | 人工复核结果 |
| --- | --- |
| [01](01-before-files-without-project.png)、[02](02-before-same-filename-another-project.png) | 修改前：两个已有项目的文件工具只有相对路径，侧栏隐藏后无法直接辨认项目。读取范围本身正确。 |
| [03](03-after-office-project-context-en.png) | Office项目名称与完整原目录在工具内清楚呈现。 |
| [04](04-after-search-new-scope-en.png) | 搜索保留，新建仍为原根目录；随后取消，没有创建文件。 |
| [05](05-after-original-file-en.png)、[06](06-after-retained-search-context-en.png) | Enter打开原Office摘要，返回及关闭/重开工具区保留原搜索与说明。 |
| [07](07-after-renamed-project-context-en.png) | 已有自定义长项目名与完整目录自然折行，搜索属于该项目。 |
| [08](08-after-project-context-zh.png)、[09](09-after-source-search-zh.png) | 中文说明和控件同步；08有无关用量提示，09为无遮挡中文搜索。 |
| [10](10-after-original-project-source-zh.png) | 键盘打开915项目原简报，实际正文为915-after。 |
| [11](11-after-tree-keyboard-zh.png) | 清除查询后原文件树、目录、Left/Right和可见焦点正常。 |
| [12](12-after-selected-folder-scope-zh.png) | 中文新建仍确认所选文件父目录sources；随后取消。 |
| [13](13-after-switch-project-zh.png) | 原项目名称动作切回Office Home，文件工具的名称、路径与目录树准确更新。 |

本轮0新增模型请求、累计1319；未创建会话、目标、消息、项目或业务文件。四公共检查点15 Mission、4 Task状态/根会话、24 Mailbox及查询和原完整Goal（complete/345102/1轮、会话idle）保持，12次正式原文件读取合同保持。源库、105项目业务文件/Git与265附件/元数据文件保持。

before逐行检查明确发现两个项目在原终端默认配置初始化阶段更新记忆可用性代次和时间；具名身份、精确时间窗、一次代次增量以及全部其余文档/行字段均验证，未跳过记忆表。该阶段“全部行逐字保持”为false，“原业务内容保持”为true；after所有原行精确保持。规格记录代码链、日志及检查器失败/修复回执。

两实例公开关闭200、原句柄退出0及物理/输出/请求结清，四配对认证/完整模型目录副本退休。不操作现用窗口、真实用户数据库或发布；未运行UI自动化。
