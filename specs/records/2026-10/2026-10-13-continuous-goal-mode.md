# Chat、Task、Mission 持续目标模式

## Recall

- 原始要求：“验证给chat，task和misson模式支持goal模式，先调查现状形成可通过评审的方案再实施和测试”。
- 已确认：“是，新增持续目标模式”，即持续推进、暂停、恢复及预算；不是既有 Goal 交付切片。
- 追加要求：“在新worktree实施”。使用本聊天新建的 managed worktree；不改动原工作区未提交内容。
- 单 agent；先分析后实现；全部模型请求流式；真实参与者消息可见；不靠关键词或隐藏提示路由；不新增 UI 自动化；非 UI 正向合同测试；真实 checker 与模型验收分别标注；有修改必须提交并按规定合并 upstream、检查待推送集合和推送。完成后将本任务提交收敛回 main。
- 目标交付：三种原模式共用一套持久化持续目标合同、普通模型工具与公开接口、真实自动续跑路径、暂停/恢复/完成/阻塞/预算停止，以及轮次和项目隔离。既有 Delivery Slice 的 Goal 定义保持原职责。
- 当前进度：统一实现、三个真实 Provider 场景、桌面截图与聚焦合同已完成并收敛 main。普通推送使用原 pre-push 检查，实际回执见本次交付说明。具体证据和覆盖边界见末节。
- 已获用户授权：“授权使用现有配置做隔离验收”。auth.json 与 models.json 成对复制到私有临时运行根，验证后删除，不提交凭据或模型原始推理内容。
- 未委托其他 agent。

## 已读证据和全仓搜索

已读根 AGENTS.md、两级 package.json、specs 索引，以及 current/architecture 的 02-data、03-control、04-extensions、task-control-plane、07-panel/07-panel-reactivity 和 05-config 中相关合同。

搜索覆盖 packages、当前架构及历史记录中的 goal mode、goal_mode、create_goal、update_goal、token_budget、持续目标/目标模式；排除生成 payload 和二进制后复核运行时代码。结论：
1. engine/goal-graph-projection.ts、pipeline/goal-contract.schema.ts 及既有 add_goal/modify_goal 属于 Delivery Slice；不是持续执行状态。
2. chat/global-chat-start.ts + session/wake.ts + session/loop.ts：Chat 有真实 Message、持久化 wake receipt、物理 Prompt owner 和 standby，但没有持续目标定义及结束后的自动续跑授权。
3. task-api/index.ts、engine/task-root-ingress-{source,delivery,reducer}.ts、task-intent-open.ts：Task 由持久化 ingress（输入入口）、FIFO（First In First Out，先进先出）及租约驱动；当前重新打开权限只有显式 operator Message 和精确 Mission acceptance resume。
4. mission/execution-closure.ts/schema.ts、mission/completion.ts：Mission 的完成判断与 execution opened/closing/closed（执行开启/关闭中/已关闭）边界不同；非 operator wake 仅能进入当前 opened occurrence。
5. session/prompt/owner.ts 具备跨进程物理活性观察；不能用进程内 SessionStatus 或最后一条历史 streaming 当作全局执行事实。
6. protocol/store.ts + protocol.sql.ts 已提供追加事件、项目归属、事务与重放；scheduler/index.ts 已有调度和关闭所有权；不建立平行数据库、定时器生命周期或私有队列。
7. usage/usage.sql.ts 的 provider_usage_event 是真实 token（模型计量单元）账本，带 session_id；以它计量，不累加模型自述、估算文本长度或重复 Message 汇总。
8. agent/tool-pool-data.ts、tool/global-tools.ts、tool/tool-id-catalog.ts、orchestrator/agent.ts/tools.ts 是工具声明、投影和实际执行三处接入；只加 registry 不足以令 Task 可调用。
9. server/routes/app.ts 聚合公开路由；Session/Task/Mission 主入口、CLI（Command Line Interface，命令行界面）、Panel、scheduler 和恢复共用上述持久化 owner。
10. 原工作区的 network/config/text-file/Overlay 与索引有并行改动，不归本任务。实际 worktree 基线以 git rev-parse HEAD 记录。

技术依据：沿用现有 Database.immediateTransaction；SQLite 官方 [事务文档](https://www.sqlite.org/lang_transaction.html) 明确只有一个并发 writer，BEGIN IMMEDIATE 在读取决策前取得写事务。事务只覆盖验证与落盘，不持有到 Provider 或工具执行结束。

## 现象、根因、旧路径和影响面

这是能力缺失，尚未据真实运行证明现有调度故障。可观察的静态证据是三种模式都没有 continuous goal 的创建、状态、预算或续跑授权合同。直接触发点是 assistant 最终回复/Task terminal 后，原输入已结算；无人再提供新输入。根因不是 prompt 缺少“坚持”，而是缺少用户授予的、可撤销的持续执行意图及其与真实 occurrence 的绑定。

现有 Goal 面板解决交付拆分和验收，Todo 解决工作清单，schedule 解决用户指定的定时/事件输入；它们均不能承担目标完成判定与持续授权。扩展这些对象会制造双重 lifecycle 或把普通调度变成终态重开后门，故不采用。

影响定义/调用/数据：新增 continuous-goal 独立语义，存储复用 protocol_event；触及 owner 解析、工具投影、系统上下文、真实 wake 和 Task continuation 的窄接口、项目 bootstrap、公开路由及文档/SDK（Software Development Kit，软件开发工具包）。
测试：持久化 reducer、身份冲突、预算、暂停、重启、串并行和跨项目；受控 Provider 只证明本地协议链，不能替代真实模型行为。
UI（User Interface，用户界面）：自然语言调用和真实工具结果是第一入口；任何新增控制组件均需本地化及真实 /ui 人工截图，不做 UI 自动化。现有 Delivery Slice 界面不改为连续执行状态。
交付：不改版本、不发布 Release；提交完整代码/正向测试/规格与当前架构，再收敛 main。
风险：自动模型消耗、终态误重开、重复唤醒、预算重复计量、暂停后旧 wake 激活、故障后的重复外部副作用。以下约束针对这些风险。

## 公开语义和评审决定

1. 持续目标是附着于现有 owner 的执行策略，不是第四种 Chat/Task/Mission，也不是 Delivery Slice。
2. 一个 owner 至多一个未完成目标。主 Chat Session、独立 Task、Mission Session 分别是唯一 owner；Task/Session 子执行继承读取上下文和预算，不能另建平行目标或改写父目标。
3. 显式用户请求才能创建；工具说明不得从普通任务推断目标。创建保留原目标与可选 token 预算、自动续跑轮数预算；未指定的预算不猜测。目标措辞由用户输入/被授权 agent 产生。
4. 状态为 active、paused、blocked、complete、budget_limited。完成必须由 agent 根据实际结果显式声明并说明证据；Host 不按文案、工具名单或任务“completed”自动猜测成功。blocked 保存具体外部阻塞及未完成事项，恢复必须显式进行。
5. 暂停是停止新的自动目标轮次，当前已接受的流式轮次及不可撤销工具结果允许结算。取消仍由原 Chat/Task/Mission 控制负责；取消/归档/删除优先于 goal，旧 goal 不能撤销它们。
6. 恢复沿用同一目标与累计消耗；预算提高只能来自用户明确操作。完成目标后可创建新目标；历史事实保留。
7. token 预算按该 owner 树内创建目标后的 ProviderUsageEvent 计算，包含真实子执行；预算是新自动续跑的准入上限，不承诺撤回已接受请求或把并行在途消耗压成精确 token 硬上限。界面/工具合同必须直接说明这项边界。自动续跑轮数预算在同一事务预占，最多接受指定轮数。
8. 目标不授予额外工具、外部写入、凭据、跨项目权限。三种 owner 获得同一通用目标工具；worker 只读继承上下文。完成或暂停目标不能伪造 Task/Mission 的完成证据。

## 单一数据与执行机制

- 在真实 owner 的 protocol_event aggregate 上追加 continuous_goal.created / updated / continuation_requested；当前状态、轮数、最近请求均从事实归约，不写回 shadow status。
- 每次写入携带 request identity 与前一 revision；同一请求重放得到同一结果，冲突返回明确错误合同。创建、更新与每次 continuation 都在 immediate transaction 内重读 owner、当前 goal、预算和 occurrence。
- continuation_request 绑定 goal identity、其当前 revision、上一个已结算输入/输出事实及目标 owner execution epoch。派生确定 Message/Part/control ID，提交后通过原真实入口激活；进程在提交前后退出都恢复同一请求。
- 新的 goal-controller 是实际编排参与者。它提交可见的目标续跑消息，记录 why/goal/budget/前轮身份；不伪装用户，不重写原消息，不建立模型/界面双轨。
- Chat：SessionWake + 原 SessionPromptOwner；Mission：同一路径并使用 admitMissionExecutionWake 精确绑定当前 opened occurrence；关闭或取消后投影停止原因。
- Task：经现有 Task root Message/ingress、dispatchPersistedTaskLoop 和 FIFO 进入；若原 occurrence 已 completed/failed，只有当前 active goal 的精确 continuation receipt 可以原子追加下一 epoch。cancelled/deleted 不自动重开；普通 scheduler 输入权限保持原样。
- 只在当前输入已结算、物理 owner 安静、没有待处理 Interaction/dispatch/wait 时续跑；正在处理的原输入和真实恢复优先。等待工具/权限/用户输入时保持等待，不能用 goal 绕过。
- 项目打开恢复与正常定时 hint 调用同一 reconciler。使用原 Scheduler 的所有权/关闭机制；重复 hint 可丢弃，业务唯一性在持久化事实和真实 owner，不能靠内存 Set 保证。
- 续跑不引入新 Provider 通道。目标上下文进入现有 LLM（Large Language Model，大语言模型）流式请求，工具声明/实际请求/持久化输出一致。

## 横向验收矩阵

| 维度 | 明确通过证据 |
| --- | --- |
| Chat | 创建后至少两轮真实流式执行，再显式 complete；原 Session 身份保持 |
| Task | 原 root ingress 进入执行，目标跨 completed/failed occurrence 绑定 epoch+1；最终目标与 Task 结算各有事实 |
| Mission | 同一 Mission opened occurrence 上持续协调，子 Task 消耗计入；关闭边界得到明确停止投影 |
| 普通模式 | 未附着目标的原入口仍通过其已有正向合同 |
| 暂停/恢复 | paused 返回明确状态；旧 pending request 的激活返回 superseded/paused；恢复同一目标、保留用量 |
| 预算 | 精确 round 预算与真实账本 token 总量；达到后 budget_limited；提高后继续累计 |
| 并发 | 同一 request 多进程重放同一 continuation/Message/epoch；不同 owner 并行 |
| 重启 | 请求提交后/消息提交后/物理输出结算后重启，恢复同一事实和输出归属 |
| 隔离 | 不同项目/同名标题只访问精确 owner；子执行只影响其父目标预算 |
| 终态 | complete/blocked/paused/budget_limited、cancelled、archived、deleted 有明确投影；过期轮次返回精确错误 |
| 消息 | 原用户、模型、工具和 goal-controller 的真实来源、正文与 ID 可在 transcript 中核对 |

## 实施顺序和验证

1. 先评审此记录：逐项核对单源、授权、生命周期、预算边界和可测试性；修正缺口后再改生产代码。
2. 实现 schema/store/reducer 和正向真实数据库测试。
3. 实现统一 reconciler、三种 owner adapter、真实参与者消息与恢复/去重测试。
4. 接入工具声明/投影、动态上下文、公开路由和当前架构；检查完整公共接口引用。
5. 通过当前 package runner 运行聚焦测试；运行后端 typecheck、docs:api（公共接口变化时）、docs:check、check:architecture-index 与相关拓扑检查。
6. 隔离真实 Provider 验收须先获得凭据使用授权。若复制，auth.json 与 models.json 成对，仅在私有临时位置，先核对凭据可用/目标模型投影/实际请求模型。默认不接触用户正在运行的窗口、进程或生产数据。
7. 真实页面检查使用项目 dev 的 /ui；人工交互和截图检查真实多轮目标、工具结果与状态，记录截图和实际观察，不使用 UI 自动化测试。
8. 记录所有通过/失败/未知，提交本任务文件；fetch + merge upstream、审查全部 outgoing commits、验证后普通 push；新 worktree 的交付必须回到 main。

## 待完成与证据

- [x] 语义澄清及静态调查。
- [x] 方案复核和精确 worktree 基线。
- [x] 持久化、工具、三个生产入口与恢复实现。
- [x] 正向数据库/真实 Provider 流式路径/多进程事实验收（故障覆盖边界见末节）。
- [x] 授权后的真实模型与桌面人工验收。
- [x] 当前架构、生成接口、文档检查、提交与 main 收敛；普通 push 保留原 hook。

本记录截至此处是实施前方案，不声称任何新功能已实现或验收通过。

## 实施前复核修订

- Worktree 基线为 b3f5c6ad38b18a125cc3ca8b3cad1e0b98be8554，分支 codex/continuous-goal-mode；安装 frozen lockfile 依赖成功。
- 用量不能依赖创建/完成时间窗口：并行在途请求和完成后普通消息会被错归。改为每次 Provider 请求开始时捕获 goal identity；UsageLedger 写入真实 usage 行时，同事务追加只引用 usage ID 的目标归属事件。统计 join 原账本，不复制 token。启动目标的那个已在途请求不追溯计入；complete 后已接受请求的真实结算仍计入原目标。此规则覆盖创建、暂停、恢复、新目标、并行和重启事实。
- 参数与 API 中的 Mission owner ID 明确使用 canonical Mission Session ID；展示 missionID 来自现有 metadata，不能以名字推断。

## 实页发现后的共享事件复核

Task 模型与正常 lifecycle 已完成，但真实 /ui 选择 Task 后正文为空。该隔离运行日志明确返回
`conversation event has no projection owner: "continuous_goal.created"`；真实 conversation HTTP
响应含 9 条 transcript、9 条 view message 和 35 个事件，因此根因在新事件未登记到 Overlay
event-policy，而不是消息丢失或模型未输出。已横向读取 events.ts 的实时入口、
conversation.ts 的初始/分页 replay 共用 commitConversationEvents、Session protocol mirror
和 Task conversation reader。三个持续意图事件是控制事实，其可见内容已由普通 Message/Tool
事件独立拥有；登记到现有明确 no-op owner，不能重复造卡、隐藏真实消息或绕过未知事件错误。
Task/Mission/Chat 的实时、重开和重连均须使用相同登记；usage 关联属于独立 stream aggregate。
只修改事件归属，不引入 UI 自动化。检索到的 event-policy.test.ts 是纯事件分类函数测试，
无 DOM、组件渲染或源文案断言，本任务不改写或运行它来冒充视觉验收。

Task 正文恢复后，截图显示自动续跑的真实 author=goal-controller 被标题标作 User。
公开消息和 MessageInfo 已保留正确 author；丢失点是 tree-writer 把 main channel 投影成
user stage 后只保留 agentID，而 ChatBubble 按 stage 显示 User。横向核对实时消息、
part-first、hydrate 和 regroup 四条路径，均经过同一 turn card 投影。修复保留独立的
真实 author 字段；main 输入按 author 分段，标题及分段边界显示真实非用户参与者身份，
普通用户标题继续本地化。执行 role、接收 channel、agentID、生命周期和工具权限不改。
该字段只从已校验的持久化 origin 投影，不通过正文关键词推断来源；不新增伪 agent。

最终状态复核发现：原预算派生可覆盖显式 paused/blocked，令恢复分支把已暂停目标当作
budget_limited 处理。统一状态优先级为 complete、owner 停止边界、显式 paused/blocked、
active 的预算派生。三种 owner 共用同一归约器和恢复入口；增加预算耗尽后暂停/阻塞、
显式恢复后仍保留累计消耗的正向合同，避免只修 Chat 或 UI。

## 实施和验收结果

- 持续意图、用量关联与轮次全部使用现有 protocol_event / UsageLedger / SessionWake / Task ingress；无新增数据库表、迁移或平行调度队列。
- API（Application Programming Interface，应用编程接口）和 SDK 由公开 schema 生成；补齐 API 文档路由分组的中英文入口，docs:api 初次报 missing route group 后修复并重跑成功。
- 实际模型均为 openai/gpt-6.1-sol，实际请求为流式。Chat 133432 token、Task 318405 token、Mission 506000 token，各接受 2 次自动续跑后明确 complete。Task 首场设置180000预算，超出来自已获准的在途轮次；未提高预算，不能描述为硬预算内完成。
- 同一 Task 在上个目标完成后接受新目标，真实 task.execution.reopened 将 epoch=1 推进到2，再完成；目标消耗169443 token、1次自动续跑。记录包括精确旧 terminal 与新 opened event identity。
- Mission 首次180000预算场景在1次自动轮次后实际达到313606，派生 budget_limited；后续独立600000预算场景完成。Provider 首次 Chat 预检过载、checker 初次 Session.tree 返回类型误读、Task 请求缺少 promptProfile、review 进程根配置错误均保留为失败，不计入成功场景。
- 正向测试最终13项核心60断言、1项多进程4断言、2项既有流式用量4断言、12项既有 Task ingress17断言。新增批处理输入测试最初违反 parentID 必须等于 acceptedInputMessageIDs 尾项的既有合同，修正测试数据后通过，没有修改该公共约束。
- 本机默认 Bun1.3.14 已用于早期验收；按 packageManager 要求改用隔离 npm Bun1.4.0 重新执行聚焦测试和提交检查，不修改用户全局运行时。
- 后端/Overlay typecheck、Overlay build、check:module-topology、check:ai-runtime、api:routes-check、docs:check、check:architecture-index 均通过。没有新增或运行 UI 自动化测试；视觉结论来自真实 /ui 页面的点击、滚动和截图。
- [可审查证据](../../artifacts/2026-10-13-continuous-goal-mode/README.md)保存脱敏运行摘要、真实 Provider 请求模型/流式/结算事实、Task 重开事件和最终桌面截图。

### 覆盖边界

多进程测试证明同一数据库中的并发预占与新进程读取相同暂停 revision；三种真实运行证明普通流式执行和终态结算；重开页面使用原隔离数据库、新服务进程和零模型请求上限。它们不等同于在每个流式/外部工具执行点强杀进程的完整故障注入矩阵，本轮未执行该穷举。Mission 子 Task 的计量/重叠所有权由真实数据库合同验证；真实 Mission 验收按明确预算采用负责人直接交付，未另跑有子 Task 的真实模型场景。

### 使用入口

在 Chat、Task 或 Mission 中明确说“开启持续目标模式，目标是……，最多自动续跑 N 轮，token 预算 M”，模型调用相同三项通用工具；可继续明确要求暂停或恢复。外部客户端使用同一 project directory 作用域的 GET/POST/PATCH /continuous-goal/{kind}/{ownerID}，带 requestID；修改需先读取 goalID/revision。预算可省略；没有新增第四种会话模式或强制默认预算。

### 集成复核

实现提交56e1c0a06；合并 origin/main 至2fcaa85d6，仅文档索引有新增条目冲突，逐项保留双方内容；UsageLedger 的目标关联事务与远端时间统计改动自动合并后复核并重跑11项核心/流式用量测试通过。全工作区8个类型检查成功；对已提交612357ef5执行的模块拓扑为1146模块、5863运行时边和4项 clean import，通过，区别于早期默认 HEAD 检查的基线结果。

main 已快进至9ab8687f5。主工作区三个重叠索引的未提交差异已先保存、核对并保留；其他并行文件没有纳入本任务提交。待推送集合只有本任务实现、正常 upstream merge 和本次验收记录，未使用 rebase、force 或跳过 hook。隔离验收服务全部正常关闭，三个最终复查进程均0模型请求且凭据/模型目录副本已删除。

### 取消后重新打开的边界复核

最终横向审计发现：owner boundary 原先只看 Task/Mission 当前生命周期或 Chat 最后一条状态事件；新 operator 输入重新打开 owner 后，旧 active intent 的暂停投影可能消失。根因为停止边界没有绑定目标最后一次显式 revision。统一以 protocol event seq 保留该 revision 之后的 Chat aborted、Task cancelled、Mission closing/closed 事实；重开 owner 不清除旧目标暂停，显式 update active 才建立新 revision 并重新准入。使用事件顺序而非毫秒时间避免同毫秒取消/恢复混淆。三种入口共用此规则，不增加暂停影子字段。

同次审计覆盖归档：Session.setArchived 和 EngineService.setTaskArchived 在终态归档时可只改当前 archived 字段，restore 又清除它，故不能依赖 cancellation 一定存在。归档写入事务中同步追加原有 continuous_goal.updated paused 意图，author=owner-control、reason=owner_archived；恢复列表可见性不恢复持续目标。精确主 Session/Task 匹配，归档子 Session 不暂停整个父目标；沿用既有 goal revision，不建立平行 archive 事件协议。删除保持 owner unavailable，新身份不继承旧目标。

新增回归最终13项、60断言全部通过，包括真实 SessionStatus/消息 bridge 写入的 Chat 取消、Task epoch2 和 Mission 重开、真实 Session/Task 归档入口与恢复、子 Session 归档、重复归档和显式恢复。最初测试未初始化生命周期 bridge 且手工输入缺少既有 order_key/inputMessageID 合同，改为真实生命周期发布链后验证，不削弱生产约束。所有正向合同合计28项、85断言。第一批实现及集成记录已正常推送至f452ed44d；此补充以独立修复提交交付，并再次执行原 pre-push 检查。
