# 同名附件来源的引用辨识证据

使用真实开发模式 `/ui`、隔离原生服务与内置浏览器手工操作，14 张截图均已呈现并人工查看。没有新增或运行 UI（User Interface，用户界面）自动化。

基线 `main-Cjs5Jyw6.js` / 38457，候选 `main-CB_Qh88y.js` / 38458。沿用833的真实四消息、两次 read 及两个不同原件；本轮没有新增模型调用或合成消息。

| 截图 | 实际观察 |
| --- | --- |
| [01 基线](01-before-identical-sources-en.png) | 两个工具小组的来源均显示 notes.txt / Attachment，打开及复制名称重复。 |
| [02 基线第一原件](02-before-source-bravo-en.png) | 第一来源打开 BRAVO / 29。 |
| [03 基线第二原件](03-before-source-alpha-en.png) | 第二来源打开 ALPHA / 17。 |
| [04 英文修复](04-after-distinct-source-references-en.png) | 原名保留，副标题分别为 Attachment · Reference 1 / 2。 |
| [05 第一引用](05-after-reference-one-bravo-en.png) | Reference 1 实际打开 BRAVO / 29，复制出现完成反馈。 |
| [06 第一引用真实粘贴](06-after-reference-one-real-paste-en.png) | 按 Ctrl+V 在未发送草稿中粘贴 bd5… 原完整路径；悬浮说明也含 Reference 1。 |
| [07 第二引用真实粘贴](07-after-reference-two-real-paste-en.png) | Reference 2 打开 ALPHA / 17，实际粘贴 c05… 原完整路径。 |
| [08 中文修复](08-after-distinct-source-references-zh.png) | 附件 · 引用 1 / 2；关闭右面板后布局与标签保持。 |
| [09 中文引用一](09-after-reference-one-bravo-zh.png) | 打开 BRAVO / 29。 |
| [10 中文引用二](10-after-reference-two-alpha-zh.png) | 打开 ALPHA / 17，悬浮说明含引用 2。 |
| [11 普通文件历史](11-after-ordinary-file-source-group-zh.png) | 原检索回复及“展开其余 7 条来源”保持。 |
| [12 普通来源展开](12-after-ordinary-file-sources-expanded-zh.png) | 八条来源保持原分组、行列号与组内序号。 |
| [13 网页历史](13-after-web-source-history-zh.png) | 两个 W3C 来源保留真实标题、域名、链接及摘要入口。 |
| [14 会话重开](14-after-reopened-conversation-zh.png) | 离开并重新加载原会话后，引用 1 / 2 仍对应原先顺序。 |

打开/复制名称、Tooltip（悬浮说明）及已有摘录入口共享由整张回复卡片派生的引用说明。原来源 `title/path/range/sourceId`、原件打开目标和复制位置保持；编号不表示上传顺序，不建立全对话缓存。普通文件/网页来源继续使用其原有呈现。

复制核对使用真实完成反馈后的 Ctrl+V。浏览器工具的 clipboard.readText 一度返回上一次 ALPHA 路径，与实际 Ctrl+V 的 BRAVO 原路径不同，因此该工具读值未作为产品复制结果。英文两份、中文引用一均通过页面实际粘贴人工确认；草稿随后清空，没有发送消息。

两scope均零新增模型请求，累计1124，739原用量事件保持。schema9/92表218548→218550→218552，全部旧业务行保持，每scope只增加一组正常control activation lease/grant。75旧附件及833已发送namespace的六文件共81个保护附件、十三旧Git项目28 tracked、两833会话各十原文件/Git事实、旧Task/Mission/Chat/Work、Goal/Sources及两个paused定义保持。

两scope均公开shutdown200、原执行句柄/native/launcher0、物理/输出/请求/出生身份结清后退休四配对副本；源auth元数据及完整models字节/元数据保持。余量分别3461103ms、2895272ms，共用首启固定60分钟deadline，未延长。用户服务/数据库/窗口未操作。

普通前端build/renderer、类型、双语2673键及十组真实公开数据回归通过。结构化结果见 [verification.json](verification.json)。本轮未生成新的流式回复或重复路径模型用例，未重设计历史用户附件条目，未验收原生Tauri；不把这些边界宣称为已完成。
