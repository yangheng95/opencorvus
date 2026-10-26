# 直接用户命令的执行状态

## Recall

持续单agent（代理）自主体验、分析、修复、真实页面验证、独立提交与正常推送；后续单agent指令覆盖旧Goal（目标）中的Astra委托。用户已明确闪烁早已解决，不重复该问题，也不把整个产品工作缩成闪烁。上一批ef87cb623正常提交推送，2026-10-26 12:53:16 UTC（协调世界时）fresh fetch/merge（新鲜拉取/合并）后0/0，56项140断言、真实630–632中英文命令输出与停止保留已交付。所有运行/四个原命令结清，凭据/完整模型副本退休，真实gpt-6.1-sol流式请求累计207。当前177项同行清理、索引排序和发布记录保留，不改版本/发布，不操作18571或用户数据库/窗口，不新建分支或工作树。

本批线索是630实际公开session.shell（直接用户命令接口）执行完成后，参与者列表可能仍显示Pending（待处理）。原04截图证明Tool退出0和完整输出，但没有展开参与者列表，不能把该图单独当成Pending的视觉证据。先读原数据库事实、生产代码及真实读取，再决定改动。不开子agent，不新增/运行UI（User Interface，用户界面）自动化。

## 修改前分析与已读资料

已读现行03-control的物理Prompt（执行宿主）所有权/取消/直接shell合同、07-panel的执行轮次身份及规范生命周期合同；SessionShell、SessionPromptState、SessionStatus、SessionLoop、conversation/view、Session routes、conversation-agents store、前批原请求/响应与证据。全仓搜索beginExecutionOccurrence、SessionStatus.set、agent.execution.lifecycle以及shell生产入口、恢复和公开重放。尚未排除的共享边界必须继续读完才实施。

已证实的数据流缺口：SessionShell.persistClaimedMessagePair保存原用户输入、助手及工具请求，真实命令结束后在原lease（租约）事务中保存原终态并释放lease，最后由捕获的原AbortSignal完成物理Prompt。该生产模块没有beginExecutionOccurrence或SessionStatus.set调用。SessionLoop在接受原用户输入时登记执行轮次并发布生命周期；两者共享物理Prompt所有者而没有共享执行轮次发布。参与者projectConversationAgentView按原输入Message身份创建轮次，默认pending，只有原agent.execution.lifecycle事件改变状态，不应由界面根据Tool标题或最后错误猜测完成。

旧路径未治原因：此前直接shell修复覆盖实际退出、幂等重放、死亡所有者恢复、取消物理结清与输出，尚未在规范执行轮次读取中验证状态。消息完成字段与生命周期事件是不同合同，不能把Tool完成当成整次agent（代理）执行已完成，也不能在UI复制一个终态推断器。

影响面审计：必须横向核对Chat/Work、Task根/右侧会话、Mission/worker（工作者）、CLI（Command Line Interface，命令行界面）/ACP（Agent Client Protocol，代理客户端协议）、正常/错误/取消、前后连续输入、公开重放与进程重启恢复、附加Prompt callbacks（回调）、双项目并行。当前假设为直接用户shell生产者缺少规范执行事实；共享发布器与其它入口是否正确还未知。没有证据证明调度器应补造状态；禁止先改消费者或回填猜测的历史事件。

## 实施前方案及验收

1. 从已关闭632只读检查630原用户shell消息、原Tool、Protocol（协议）事实与终态；读取全部相关当前定义/调用、测试和历史决策，完成上述共享审计。先用真实公共接口/规范投影的后端正向测试复现明确错误状态，不以静态字符串或模型自述替代。
2. 若证据确认生产者遗漏，复用唯一SessionStatus发布器及原输入/捕获Prompt所有者，令真实开始与原物理/输出/进度/终态结清一致。取消及错误保留其原typed（具名类型）原因、回执与最后消息身份；附加回调和后续新输入必须保持各自轮次，不以当前Session状态覆盖旧轮次。lease失效/重启恢复只能基于原持久终态发布，不凭PID（进程标识）或最后显示内容猜测。具体实现须在审计和合格红测试后补充确定决策。
3. 聚焦后端正向测试覆盖当前成功、明确失败/取消、连续命令、重放/恢复、双项目以及相关共享生命周期合同。遇到本地工具失败先修复运行器并重跑原验收。当前schema（结构）、HTTP（Hypertext Transfer Protocol，超文本传输协议）/SDK（Software Development Kit，软件开发工具包）形状原则上不变；确需变化须先列出合同影响。
4. 最终实际页面通过自有开发CLI /ui和普通Node冻结前端，查看真实运行命令与完成后的参与者/工具，再实际重开核对同一轮次。公开API（Application Programming Interface，应用程序接口）执行与UI读取分别标注，不宣称不存在的直接UI命令入口。若需要Provider（模型服务），成对复制授权auth及完整models，分别预检凭据、目录和实际gpt-6.1-sol/stream=true；启动前另落盘请求预算、原exec、20分钟物理边界/十分钟关闭目标/至少五分钟结算，完成后原进程/输出/请求全部结清并退休副本。
5. 当前合同和三个索引/脱敏事实同步，真实截图人工复核；独立精确暂存、提交、fresh fetch/merge、完整待推集合审查、正常hooks（钩子）推送。没有修复证据就不宣称修复；整体Goal保持active（活动），继续其它页面/功能，不重查旧闪烁。

## 原事实、共享审计与确定决策

632关闭数据库中，630原用户输入msg_630_unicode_beb69e453de04cd980311be39cd2964f、原助手msg_g0VZ9inC0009NFpbAmqq的finish=stop及created/completed时间完整，原命令退出0；对应生命周期事件为0。首次私有查询误用了不存在的sequence列，修正只读查询后取得这些事实，不把查询故障当产品根因。合格红测试通过真实SessionShell子进程及公开conversation读取，0通过、3失败、5断言：运行/完成都实际返回pending，双项目终态读取为undefined。原exec48440退出1并确认物理/输出结清。

生产入口审计：SessionPrompt.shell是SessionShell的原别名；当前源码只有公开Session shell路由调用它，CLI/ACP没有第二个直接shell实现。Mission公开入口明确返回MissionSessionAuthorityError；投影worker由原descriptor拒绝该入口并要求task-scoped operator-steer，root及其它固定运行时角色必须通过原message-identity的精确runtime contract。普通Chat/Work及合法Coding Assistant使用同一个直接shell实现。Task根、worker、Mission及Scheduler的模型轮次由SessionLoop/runner发布，恢复/领域终态统一使用status-publication；原生命周期消费者按输入身份读取，不需要改动。相同Session串行新输入由beginExecutionOccurrence替换当前轮次，项目隔离由原Session身份和当前Project合同保持。直接shell重放走convergeShellExecution：精确live owner/child/lease保持原执行，死亡所有者进入terminalizeInterruptedOccurrence；完成重放直接返回原不可变结果。

确定沿同一SessionStatus.beginExecutionOccurrence在输入/工具图持久化后绑定原捕获AbortSignal，启动前await规范streaming发布。正常、明确错误和恢复均在原物理命令/输出/进度及原Tool/Message终态提交后，复用publishSettledSessionTerminalStatusInCurrentProject发布原输入的terminal及final_message_id；把该现行通用函数的taskID改为可选，不为独立Session虚构Task身份。该函数已有当前Project验证、首终态权威和旧输入不覆盖较新输入合同。正常非零命令退出仍为completed；原用户abort或规范MessageAbortedError映射aborted；原执行失败/中断映射error。附加callbacks及原finish/resume流程不改，后续SessionLoop仍自行绑定它实际接收的新输入。

恢复只发布本次已收敛的原Message终态，不改原消息/失败或补造历史起点；已完成旧历史且从未发布状态的记录没有自动回填，不把新执行通过夸大为旧历史重写。需要补充正向恢复/错误检查及已有共享生命周期/取消合同回归；界面仍只读同一规范事实，不改UI代码、状态文案或布局。

## 实现与验收准备

第一轮5文件当前生产合同全部通过，原exec9778结清；包括三个原合格失败、实际命令输出/非零exit、原公开重放/lease fence（租约围栏）/死亡所有者恢复、共享Session轮次和历史输入终态发布。源码类型首轮拒绝无必要的Error强制转换，已删除该转换。补充原重放、恢复和spawn（进程创建）失败的原生命周期断言；第一次新增错误断言误把原Message的“Error: spawn refused”简写为“spawn refused”，修正为明确比较原Message.error.data.message，保留原生产错误文本。新增可选payload的类型收窄也按真实可选合同修复，没有更改生产错误来迁就期望；两次原未通过日志仍保留。

633启动前从已关闭632复制92表22351行及12组原附件，完整逐行保持，目标38138；最终前端未修改，沿用普通Node构建main-DqXsnf2O.js。计划通过原公开session.shell实际运行中文长命令，在真实参与者列表查看running，点击原UI停止后查看原aborted/skipped，再运行一个自然完成命令并查看completed及重开记录。命令经公开API提交、界面真实阅读/停止，不冒充UI命令提交入口。成对认证/完整models由受审启动器复制，必须先通过凭据/模型目录/实际gpt-6.1-sol流式预检；最多4模型请求含预检/辅助，累计207起上限211。20分钟物理边界、十分钟关闭目标和至少五分钟结算，关闭后收集原exec/native/launcher及所有原命令精确身份的物理/输出/请求承诺，退休认证/模型副本。

## 633实际页面与恢复边界复核

57项159断言及完整后端/触及测试类型通过，原exec75432/71935均0。633真实页面01确认原命令、Live output中文、Running及原Stop按钮；点击原Stop后原公开接口返回相同助手、实际退出1和原User aborted说明，参与者轮次skipped，02真实tooltip为Stopped。随后同一Session原自然完成命令退出0，公开读取completed，03真实tooltip为Completed；刷新自建页面后04仍为同一原完成输出/Completed。API发起命令与UI实际停止/读取分开标注；这次刷新只是renderer（渲染页面）重开，不伪称原生服务重启。历史630未观察轮次仍Pending，未回填旧执行事实。

4次实际gpt-6.1-sol流请求全部200/EOF settled，累计207→211，用于既定预检及现有辅助行为；两个直接用户命令本身不经过LLM（Large Language Model，大语言模型）生成。tab16关闭，public shutdown200，原exec32077/native/launcher均0，提前847470ms关闭；两个原命令的terminal/output/settlement全部fulfilled且精确OS实例dead_or_reused。配对认证/完整models副本退休，源元数据与模型字节保持；源92表22351行和目标640条关键事实保持，仅原Chat活动时间推进。当前没有付费运行存活。

提交前深度复核发现已有“不可变completed助手下仍有open Tool”的恢复用例：原恢复会把该Tool写为process-execution-interrupted，但不能改写原已完成助手。当前新增终态映射若只看Message.error，会把这个已收敛失败错误发布completed。须由同一直接shell生产者同时读取它刚收敛的原Tool失败事实，发布error及原终态Message身份；不改原不可变助手，也不让通用UI根据任意Tool推断Agent状态。新增该原恢复用例的正向终态断言后修复。633覆盖的正常/用户停止分支不变，恢复边界新增资格单独由聚焦正向合同证明，不称该异常历史分支已在实页重演。

## 最终当前源码与交付

恢复边界已按原失败事实补齐，当前8文件57项160断言全部通过，原exec11821退出0，实际物理/输出结清；后端源码与两份触及测试完整类型原exec62951退出0。最终文档检查原exec正常退出0，351 operations（操作）/26 groups（分组）。此后只补文档/原图说明，没有继续改执行行为。现行03-control说明原输入、fenced（有租约围栏的）Tool终态及共享发布器合同；SessionStatus注释明确直接shell也属于streaming，未新增协议枚举或改变HTTP/SDK形状，schema仍8。

四张实图、原公开请求/读取、原数据库生命周期事件、精确原命令handle及退休/关闭回执已脱敏汇总；最终恢复边界与633实页资格分别记录。三个索引只插入本批独立行；同行177项删除/排序/发布记录保持。完成精确差异、范围提交、fresh fetch/merge、完整待推集合复核及正常hooks推送后，Git回执保存在本批私有目录；不把整体产品Goal标为完成。
