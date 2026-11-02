# 子任务直达（897）

真实CLI（Command Line Interface，命令行接口）38624/38625的`/ui/`，1280×720桌面，独立隐藏页面，不操作用户窗口。01—02为原版路径，03—16为main-DAgb7BYD.js实际交互；16图逐一人工查看，12/08保存原图另行复核。

|截图|人工复核对象|
|---|---|
|[01-before-child-preview.jpg](01-before-child-preview.jpg)|原卡片子任务文字仍属于父打开按钮|
|[02-before-child-click-opens-parent.jpg](02-before-child-click-opens-parent.jpg)|点击原子任务后实际是父Mission会话|
|[03-after-list-child-actions-en.jpg](03-after-list-child-actions-en.jpg)|独立子任务区域、原进度及状态|
|[04-after-completed-task-en.jpg](04-after-completed-task-en.jpg)|完成Task原身份与四份交付文件|
|[05-after-task-refresh-en.jpg](05-after-task-refresh-en.jpg)|只刷新本人页面仍恢复同一Task|
|[06-after-failed-task-keyboard-en.jpg](06-after-failed-task-keyboard-en.jpg)|键盘打开原失败Task及失败原文|
|[07-after-parent-remains-mission-en.jpg](07-after-parent-remains-mission-en.jpg)|父按钮仍打开原父Mission|
|[08-after-board-child-actions-en.jpg](08-after-board-child-actions-en.jpg)|英文Board中原两子任务可独立打开|
|[09-after-cross-project-task801-en.jpg](09-after-cross-project-task801-en.jpg)|原741切到801项目的完成Task及counter文件|
|[10-after-unfinished-task793-en.jpg](10-after-unfinished-task793-en.jpg)|原793未完成Task保持原Idle状态，只读打开|
|[11-after-search-prioritizes-child-en.jpg](11-after-search-prioritizes-child-en.jpg)|匹配子任务优先，原完成比例不变|
|[12-after-child-actions-zh.jpg](12-after-child-actions-zh.jpg)|中文独立子任务入口与真实状态|
|[13-after-completed-task-keyboard-zh.jpg](13-after-completed-task-keyboard-zh.jpg)|中文键盘打开同一完成Task|
|[14-after-board-child-actions-zh.jpg](14-after-board-child-actions-zh.jpg)|中文Board的子任务入口|
|[15-after-parent-blockers-zh.jpg](15-after-parent-blockers-zh.jpg)|原完整受阻事项仍由独立控件展开|
|[16-after-project-query-preserved-zh.jpg](16-after-project-query-preserved-zh.jpg)|特定项目、查询及List在往返后保留|

[原Task身份、实际请求与数据闭合](verification.json)：原完成/失败741、完成801、未完成793均通过真实Task ID/自己的项目目录打开，根Session由原公共TaskStatus核对。实际`GET /task/{id}/conversation`输入逐项与对应Task目录一致，次数分别1/4/1/1；原选择reader、SSE（Server-Sent Events，服务端事件流）和目标控制读取同一身份。页面定位和真实执行内容另有截图，不能只凭标题认定打开成功。

两次after完整公共读取都与before的15条MissionRecord和四份完整TaskStatus精确相等。原Task顺序、生命周期、活动、根Session、目标/验收数据均保留；0模型请求/累计1260。两个原exec句柄消费exit0、HTTP（Hypertext Transfer Protocol，超文本传输协议）关闭200、原生物理身份/输出/请求清理闭合，认证及完整模型目录配对副本退休。259652→259654→259656仅四条本轮控制租约，全部旧行/100项目文件与Git/229附件/源DB及认证目录元信息保全，schema9/92表不变。沿原75分钟绝对截止，最终退休余3481513ms，无重启、续期或加额。

类型、本地化2764键/两语言、CSS（Cascading Style Sheets，层叠样式表）9085引用/402TS或TSX、文档352操作/26组与Node.js构建通过。纯UI（User Interface，用户界面）无自动化、组件/源码文案/DOM（Document Object Model，文档对象模型）断言或截图测试；公共接口及请求归属核对证明实际身份和业务保全，不代替页面截图。未开始/停止/恢复任务或发消息，不声称模型验收；原最多2子任务，超过3项、父子目录不同、断线/失败、未保存输入冲突及其他尺寸未专项验收。正常提交/推送/fresh结果以本轮Git回执为准。
