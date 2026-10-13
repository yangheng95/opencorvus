# 390 执行轮次的真实 Agent 身份

## Recall

最新人工指令只用单agent开发，旧goal的Astra文字不再执行。389为progress：0ea2a524b2f97e52b6416ccfef125cd4b43034d7已推送，成员读取失败/局部重试/限高键盘详情已真实验收。三scope已闭合，final首条服务过载Message保留，后续新输入才完成。本轮不派开发agent；产品端到端验收沿前轮单个只读测试成员方式，模型仍只用已授权gpt-6.1-sol流式。

已读389 Recall、完整AG389原始诊断/规范Message、当前persisted-session-identity、lifecycle-projection、message-bridge、session-mirror、ProtocolStore、task-event、conversation/view、Session fork/side、delegate_agent与全部assistant创建点。已读相关backend测试模式；不运行/新增UI自动化。工作区其他Provider、MCP、压缩、SDK、locale和文档修改保留。

## 已证现象及共享根因

389 after child ses_-zUS3zC9pzzy5IHqpHZ6、input msg_g0VXw0nrZ001EWPy1N54：MessageUpdated/PartUpdated声明agentID/sessionAgentID=work；同轮agent.execution.lifecycle声明agentID=assistant。新正文msg_g0VXw0pnZ00VV9i0ZJ9F已在规范DB完成，但15条delta观察因缺少messageIDs归属报错，父进展停在首段。只有起始hydrate，没有merge；发生在人工网络中断之前，排除本次刷新/旧快照覆盖解释。

delegate_agent真实writer保存kind=assistant并以agent=work运行。旧lifecycle-projection按Session类型/metadata/worker descriptor解析Actor，没有读取该轮真实输入Message；message-bridge则读取Message声明。二者在通用assistant下产生双源。全仓assistant生产入口包含Chat/Work、CLI、ACP、GitHub、Panel control、Automation/Event scheduler、wake、side fork和delegate，不能只按delegation.parentAgent补一个分支。普通Session可能有多轮输入，历史Actor不得从最新消息或当前配置反推。

## 横向审计与设计

| 路径 | 当前事实与修复边界 |
| --- | --- |
| 普通Session、Coding/Chat/Work、Side/委派 | 每轮inputMessageID绑定持久user Message及其agent；通用assistant只描述容器类型。复用同Session的不同轮次必须分别解析。 |
| Task worker及Orchestrator | 精确WorkerTurnDescriptor仍是绑定身份依据；声明输入须属于该Session并与该绑定一致，不能改为latest descriptor。 |
| Mission及helper/调用回执 | 主执行者与当前消息参与者区分；helper/mission caller receipt保留其真实author，sessionAgentID来自原执行输入。 |
| 正常、重试、idle、completed/error/cancelled | lifecycle与Message用同一轮次身份。只改读投影，不改状态机、唤醒、队列、重试或终态。 |
| 重启/回放与读取历史 | ProtocolStore从真实inputMessageID重新投影；原事件/Message不重写，没有迁移或兼容层。 |
| 并行与多项目 | Message必须属于精确Session，读取显式ID；不借全局最近执行或当前项目猜Actor。现有公开API authority准入不改。 |
| Session级通知/未执行容器 | 没有inputMessageID的config/diff/空Session仍是原Session级事实，不伪造执行轮次；本轮不把此类通知冒充模型参与者。 |

拟建立一个共享的持久执行身份读取入口：读取精确Session和所属user Message，结合该inputMessageID的descriptor，使用既有身份解析器；generic assistant采用真实input.agent，固定Chat/Work metadata与worker descriptor仍校验其约束。消息Bridge、lifecycle投影及Task execution projection复用此入口，不维护第二份Actor状态、不改UI匹配、不吞drift、不修改模型请求。root用户收件Session保留其既有控制身份，不能把它的寻址目标当成Root模型执行者。

Conversation read projection应使用已经规范化的message sessionAgentID或精确execution身份，移除基于assistant标签猜primary actor的旧补偿函数；无Message的Session仍使用现有ledger事实。API/SSE字段形状、channel、Message、Source、permission和数据库DDL不变。所有helper调用和正常/终态/恢复路径须随改动复核。

## 验收

先用真实数据库的聚焦backend正向测试确认旧路径把输入work投为assistant，覆盖coding/chat/work、委派/Side形态、同Session不同轮次、Task descriptor及Mission、完整ProtocolStore读取、重入恢复和独立项目。错误输入映射明确错误契约；不用负向调用/文案检查。mock/fixture只能作局部合同，不代替端到端。

修后正式项目开发/ui，优先复用389已完成正常前端构建（本轮预计无UI修改）。独立新scope及物理owner，auth/models完整成对、分别验证usable/projected/实际模型gpt-6.1-sol/stream=true。20次同进程累计请求含preflight/helper，180000ms无活动、600000ms Native资源上限，先准备再启动，不续期。通过真实页面产生一个bounded只读成员，观察首段、read Source、工具后最终正文在进展与成员全文一致，Sources真实打开，完成后刷新/重开仍为同规范Actor。若需要额外后端运行或一次失败，独立保留原scope事实，不能以传输EOF代表模型成功。

UI只用真实交互、截图和人工复核。数据checker读取真实持久Message/Tool/Source及协议Actor，必要被动诊断不写UI状态。检查types/聚焦测试/docs/架构，完整原句柄、Native Job/output/request、端口、页面和复制凭据闭合。归档原失败及完整脱敏证据，范围提交；fresh fetch/merge、审查全部待推送集合、正常push。原整体goal保持active，不发布。

## 实施准入补充

新backend正向测试修前0通过/4失败：coding/chat/work的message owner正确、lifecycle均错误为assistant；真实SessionStatus写入及ProtocolStore读取的coding→work两轮也均为assistant。原日志before-tests.log保留。第一次命令因相对目录落在package而未运行测试，已改明确仓库路径重跑；删除误建空目录的命令被自动审批以blocked by policy拒绝，未改用其他办法删除，空目录保留。

删除路径已补审：Session.removeMessage在真实删除事务中携带原info，用户Message删除后不能重新读取其已不存在行；assistant仍引用的输入由现行immutable-input删除约束保护。因此message-bridge对user事件用其真实原始snapshot和同一纯身份解析器，对assistant执行读取精确parent input。生命周期和Task执行投影始终读取其durable user Message；ProtocolStore现有orderKey本就要求该输入存在。helper/调用回执保留参与者author，owner来自该输入。新共用读取器不依赖message-bridge，避免ProtocolStore→lifecycle→bridge的模块环。

## 实施与真实验收

新增persistedExecutionIdentity共用读取精确输入；generic assistant的执行者取真实input.agent，固定Chat/Work和descriptor身份继续校验。lifecycle、assistant message bridge和Task execution projection共用该读取；conversation/view删除按主Agent角色猜测的旧补偿，读取已规范化sessionAgentID。Session级通知/空容器不伪造input，root控制收件行为不改。没有改协议字段、调度器、数据库或前端事件匹配。

正向backend验收覆盖coding/chat/work、同Session不同轮次、retry与completed/aborted/error终态、重新进入Project回放、两个独立Project、删除用户Message后真实事件、helper参与者与work owner、Task精确descriptor、Mission调用回执/唤醒。初次扩展运行25pass/1fail，失败是新测试直接拼装view时遗漏originSource；已改为实际projectPersistedSessionMessage并持久化正文Part，重跑7pass。补充retry/终态后最终9pass/0fail，另三文件17项在首轮通过。保留全部原日志。类型检查首次被同期配置类型改动阻断，重新检查结果写入月度记录；不把首次失败改写为通过。

真实Native scope使用当前开发后端和389-final正式前端静态包，通过localhost:18419/ui访问；本轮没有前端源码改动。模型凭据和完整models目录成对投影，预检usable/projected/实际gpt-6.1-sol/streaming全部确认。人工在产品里调用一次只读成员作为被测功能，没有开发子agent。共7次真实流式请求（含预检/helper），主成员分别完成stop，read和delegate结果completed。截图01读取中、02未刷新最终dock、03实时父进展、04Source选中2—3行、05刷新后重开；截图均实际查看。03已经显示最终正文进展，不再停在首段；Source入口正常且目标文件第2—3行正确。

child ses_-zUS3f1RWzzGYhiJ6sfA、input msg_g0VXwKyb3002di2ihcUN：规范Message、HTTP conversation、实时页面和SSE重连回放均以work归属，公共回放事件pev_g0VXwL3Il00I0e2k5Ne3保留原身份。规范checker逐条核对Source→Tool→Message→Session以及终态，不把HTTP200/EOF当作模型业务成功。Native Host84564/Target80480在306843ms内完成，Job/output/request及两份复制凭据清理确认；页面11关闭，launch69124和shutdown均exit0。

新发现待下一轮：刷新重开后父进展多出英文交接输入预览（03与05对照），成员dock的Handoff context仍折叠，正文和Source完整。当前修复不声称解决此独立显示差异，也不声称覆盖原Research Studio长历史。下一轮先审查实时inputPreview与HTTP恢复的来源/使用，再决定处理；禁止按英文关键字过滤或隐藏真实消息。整体goal保持active。
