# 附件、三题回答与文件交付实页

2026-11-06，单人隐藏独立内置浏览器页面，原生开发服务 `/ui/`；未操作用户现用窗口或真实数据库。所有截图均已本人实际查看，不是界面自动化断言或截图基线。

## 已交付的呈现修复

附件的来源摘录优先显示原文件名和保存正文。原来默认占三行的内部内容地址，改为本地化且默认收起的“附件存储位置”；可用鼠标、Enter（回车）展开，用 Space（空格）收起。完整位置、原摘录、复制与只读打开身份仍取原来源。普通项目文件的位置继续直接显示。

| 真实页面证据 | 复核结果 |
| --- | --- |
| [修复前附件摘录](12-original-attachment-saved-excerpt.png) | 原名下铺开内部存储路径，正文空间被占用 |
| [修复后中文默认](17-after-chinese-attachment-location-collapsed.png) | 原名、中文说明与摘录优先，位置默认收起 |
| [中文键盘展开](18-after-chinese-location-keyboard-expanded.png) | 完整路径可展开，键盘焦点清晰，路径换行 |
| [英文默认](15-after-english-attachment-location-collapsed.png)、[展开](16-after-english-location-expanded.png) | 控件与说明接入当前语言，原文件名/原文保持真实内容 |
| [只读原附件](19-after-original-attachment-readonly.png) | 打开相同原附件，保留原名并明确显示“只读” |
| [普通项目文件](20-project-file-excerpt-and-current-file-action.png) | 原路径直接显示，“阅读当前文件”含义明确 |

## 自然模型与实际回答

本人实际上传2815字节、60行的明确虚构资料，精确 `gpt-6.1-sol` 流式读取全文、提出三题，本人通过页面回复后创建唯一511字节/21行的中文 Markdown 文件并回读。7次流式请求全部200且读到流末尾，其中6次工作请求、1次现有项目记忆请求，没有委托。末次只读页面重用这份真实事实，新增模型请求为0。

| 真实交互 | 证据 |
| --- | --- |
| 原文件上传和实际请求 | [首页](01-chinese-chat-home.png)、[附件与请求](02-uploaded-original-and-request.png) |
| 按题计数0/3→1/3→2/3→3/3 | [待答](03-pending-three-questions.png)、[自由文字](04-one-of-three-answered.png)、[单选](06-two-of-three-selected.png)、[多选和自定义](07-three-questions-five-answer-values.png) |
| 三题、五个回答值 | [已提交的实际回复](08-actual-three-question-reply.png)；“事实表、行动清单、附来源说明”仍属于第三题 |
| 唯一文件修改，新增21行、删除0行 | [自然空闲](09-idle-delivery-and-one-file.png)、[修改详情](10-one-file-review-summary.png)、[修复后摘要与预览](21-after-chinese-file-summary-and-readable-delivery.png) |
| 五条来源事实与全部回答进入两张表 | [实际交付预览](11-current-delivery-readable.png) |
| 全文与保存摘录各有真实身份 | [原名只读全文](13-full-original-readonly-attachment.png)、[第60行](14-original-attachment-last-line.png)；保存摘录为实际读取窗口的前20行 |
| 刷新后保留原题与实际回答 | [原题明细](22-after-refresh-three-question-details.png)、[多选和已答计数](23-after-refresh-multiple-choice-and-actual-reply.png) |

[05](05-hidden-input-hit-did-not-select.png)保留一次未命中选中的实际观察：直接操作视觉隐藏的1像素原生输入没有选择成功，可见选项标签随后成功。因此没有据此修改单选控件，不能把这张图当成已填写2/3的证据。

## 数据、工具与退役

[资格记录](qualification.json)汇总真实数据库、磁盘、HTTP（超文本传输协议）/SSE（服务端事件流）、Markdown解析、完整工具结果与原始模型传输检查。源库318075行/133项目/307物理附件，新增自然流程后319826行/134项目/311物理附件，最终只读退役319828行；结构仍为10/92表。23类新增业务表均归属于唯一新验收项目/会话；额外4个物理文件为原始上传及元数据、生产能力目录及元数据。两个原已过期容量槽按实际运行所有者和获取/释放时间验证，其余原行及全部原项目文件、Git（版本控制）、配置、附件和源库均保全，零文件系统豁免。最终只读阶段只新增一个原生运行租约及对应授权行。

原六会话28个完整工具结果与11个来源继续通过真实接口核对。新流程的3题/5值、附件原字节、20行保存摘录、60行实际读取、唯一文件及自然空闲，已在末次只读页面刷新后再次核对。

实际失败记录保留于私有验收目录：依赖检查曾错误并行启动；继承的只读检查曾误期望整个自然阶段模型请求仍为0；附件检查曾误期望只读内容接口返回原名。分别修正依赖顺序、与真实自然流程请求数对齐、按已有Source标题/工作台目标的原名合同检查后，原场景通过。没有为迁就检查而改动产品接口、模型事实或数据库。

普通Node.js生产构建、类型、双语言2909项、渲染器公共面、352个接口文档与20份当前架构索引检查通过。两次本人页面已关闭，原生服务/启动器正常退出，公开关闭接口200，四份成对认证/模型目录副本已退役；共同截止未延长。未分配额外模型重放阶段，未发布版本，也未宣称完成全产品审计。
