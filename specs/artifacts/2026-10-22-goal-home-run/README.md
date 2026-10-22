# Goal 默认页与真实执行证据

见[Recall、分析与实际结果](../../records/2026-10/2026-10-22-goal-home-run.md)。单agent，两个真实Chat Goal共5次自动续跑，验证Home创建、调整预算、轮次间暂停/恢复、完成及完成后普通聊天。修复Goal controller沿人类窄卡片排版，以及同一Goal弹窗换页丢失键盘焦点；26张实际页面截图均已呈现并人工复核，没有UI自动化测试。

- [默认Home入口](26-home-close-return.png)：原首次打开及Escape关闭焦点合同保持；[使用说明](02-how-it-works.png)。
- [修复前控制消息](10-controller-before-header.png)与[修复后原文](15-controller-after-reading.png)：相同四条真实消息身份/作者/完整正文保留，shell约547→760px；[普通人类输入](23-human-visible-at-end.png)维持原右侧卡片。
- [修复前完成表单](11-completion-before-focus.png)丢焦至BODY；[修复后evidence焦点](18-completion-after-focus.png)、[原生键盘输入](19-evidence-native-keyboard.png)、[键盘完成](21-completed-by-keyboard.png)。[原地新Goal表单](16-new-goal-focus.png)同样自动接续焦点。
- `*-goal.json`是实际HTTP/SQLite检查结果的公开投影，保留真实Goal/Session/事件/可见原文与Part身份，省略非文本运行payload。`*-focus.json`及`*-layout.json`为实际只读DOM观测，不能单独替代上述视觉证据。
- [资源摘要](resource-summary.json)：before6/16、after5/16，11次实际gpt-6.1-sol流式请求均HTTP200/原EOF；5次自动续跑、1次普通聊天，其余为真实preflight与memory。两原始服务句柄exit0、公开shutdown200、物理/output/request/launcher闭合，两页关闭，8份配对凭据/catalog成员退休。
- `*-physical-terminal-and-pair-cleanup.json.gz`是原生结算与wire model/EOF的最小投影；请求payload/headers省略。`*-recheck.json`核对既有终态，不重新启动或重建凭据。原错误固定8预算检查及退休元数据留存，实际启动/审计上限始终16；after第二处相同常量在删除private副本前失败，已修正并真实重跑。
- `data-preservation-observation.json.gz`核对两完整90表副本、全部原行/源bytesmtime、schema3及完整canonical。目标分别2/5条自然运行字段更新，绝非全字段零差异；原全库/全行快照及凭据留在Git外。`scan-final.mjs`与`credential-scan.json`提供本范围实际凭据值扫描。
- `before/after-build.log.gz`为Node正式构建；实际加载的修复后资产main-Z57QblQm.js/main-CZNy5wdP.css。其余helpers为本批隔离准备、只读事实检查与资源结算记录，依赖成熟私有监督链；不是UI自动化测试。

图04为导航中间帧，图22仍在旧阅读位置，均不充当对应成功证明。暂停发生于第三回复完成后851ms，没有流中暂停新资格。旧四轮消息可读不等于已验证独立旧Goal定义/完成证据导航。Task/Mission、其他参与者和焦点保护分支仅共享代码复核；手动发送后的阅读位置行为待另批调查。Sources/Rendering长期目标仍开放。
