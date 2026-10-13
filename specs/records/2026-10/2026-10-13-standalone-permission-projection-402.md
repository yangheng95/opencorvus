# 402 Standalone 会话权限批准投影

## Recall

2026-10-14 Root实施决定：403已完成普通关闭/重启与原5秒失败物理边界修复并提交，402按文末最终方案推进。audit_functionality负责精确后台允许清单、正式正向测试与完整SDK生成事务；audit_ui负责精确前端允许清单、静态类型与私有构建；Root负责共享文档、真实桌面交互/截图、实际模型端到端、归档和Git交付。仅此一层两agent，不再委托。原只读授权属于调查历史，最终批准从Root明确消息起生效。当前Question child准入不在本次改动范围；保留其现有Question回答、草稿与Task合同，不能把Permission修复扩大成未运行过的Question范围重构。

root在已授权395真实Sol验收看到global Base/Ask、稀疏Project配置与Settings Ask正确，但普通GlobalChat在真实外部read Ask后只有Running且无批准入口。授权先单层只读横审、独立方案落盘，不修改生产/UI、不开服务/模型/浏览器、不读凭据/提交/再委托。必须覆盖全部Chat/GlobalChat/Work/SideChat/Task/Mission、warm/cold/reconnect/正常决定、request occurrence与多Project/session tree，保留自然参与者消息与唯一Permission ledger。索引ops只提供给root，不直接编辑共享索引。

已读当前07-panel/07-panel-reactivity、395 Recall与真实pending公开观察、permission authority/decision/ledger、EngineInteraction/task-session-lineage、server Session hydrate/events/permission routes、Session mirror/ProtocolStore、Overlay conversation/tree-writer/sse/events/InteractionCard/Dialog/SideChat/Settings、CLI/ACP durable pending消费者、直接相关后台测试与历史。没有运行UI自动化或任何测试，未查看/操作真实页面；root提供并人工复核截图。402和403关闭异常分开调查；修复一处界面不意味着pending question/effect等所有关闭路径已修复。

## 已完成横向调查与实施前方案
### 直接根因：Main live与hydrate均未物化权限卡片

- overlay/services/tree-writer.ts:901–904将permission.asked/replied直接return；953的重复分支和“InteractionCard已处理”注释并不生成InteractionData。
- services/conversation.ts:688/699、720只提取/prepare/commit pendingQuestions；后端server/routes/session.ts:1087–1141的Session hydrate同样只返回pendingQuestions，board没有独立Permission interactions。
- tree-writer.ts:3927的conversationInteractions仅合并board.interactions与standaloneQuestionInteractions；card-tree没有当前permission seed。
- components/InteractionDialogHost.tsx:33只从cardTreeStore收集既有InteractionCard；CardParts.tsx:112虽能渲染permission card，但无输入不能产生按钮。这不是弹窗被dismiss、滚动位置或Tool展开状态造成。
- services/sse.ts:475–494收到session事件后进入routeSSEEvent；events.ts统一先writeToTree，event-policy.ts:107承认permission.asked，因此不是“后端根本没发/浏览器拒未知event”的证据。
- Settings PermissionsPanel只GET permission/grants与history，提供grant revoke；没有pending list或reply动作。Requested历史记录并非批准控件。

### 已排除仅旧392 bundle

实际复用393 private392 UI的main-QSwgWIyk.js已只读检索，公开摘录保存`permission-bundle-code-evidence.json`：字符390807/391424处明确相同permission.* noop，493690处只有pendingQuestions；1568874处是SideChat真正permission→InteractionData分支。共1709330bytes，摘录不是DOM/组件/UI自动化测试，也不是摘要身份门槛。当前源与已运行bundle在这条数据流上相同；无需假定重构建当前源即可恢复批准能力。

### 全入口与occurrence影响矩阵

| 入口/状态 | 权威数据与实际展示链 | 当前结论/实证边界 |
| --- | --- | --- |
| Global Chat /项目直接Chat | GlobalChat202自然创建assistant Session，Main BoardSource.kind=session；同一hydrate+SSE+tree-writer | 本次GlobalChat真实pending/无批准复现；直接Chat同函数路径，尚未单独实页复现。 |
| Work主会话 | BoardSource.kind=session且experience=work，仍同一Main projector | 没有独立permission bridge，可受同一缺口影响；未用Work真实模型复现。 |
| Mission主Session | kind=mission在Session hydrate中只增加artifact投影，pending仍仅Questions；无Task所有者时engine interaction不创建 | 同一Main缺口；不能把Task内子会话的成功路径推给独立Mission。 |
| Task根/执行轮次/Task子Session | EngineInteraction.subscribe→upsertPermission，resolveOwner按taskIDForSession遍历真实parent查engine_task.session_id；合法Task拥有者写engine interaction→board.interactions→InteractionCard→interaction reply | 现有独立权威投影存在；不为修Main创建假Task或双写permission。未在本次重新实页测试Task/worker。 |
| Side Chat独立自身Session | side-chat.ts:113–126把permission事件直接映射卡片，replyEndpoint=permission且传target.directory；SideChatPanel:486渲染 | 现成批准入口属于SideChat自己的session，不能批准当前Main请求。子Session权限事件被event.session_id===target.sessionID过滤，子树覆盖需后续精确核对，不外推为已验收。 |
| 公开Session API / SDK | GET /permission给durable Request；POST /permission/:id/reply使用PermissionAuthority.replyUser | 可以进行真实API决定，但不能冒充本轮UI Allow once验收。root决定是否独立backend继续，本agent未调用。 |
| CLI / ACP | permission/pending-projection.ts按exact session过滤真实permission.list；CLI run.ts:475/597、ACP agent.ts:338/674消费live+durable pending | 已有独立展示/回复通路，本轮未运行；不因Main问题删除或重写。 |
| 断开/重新选择/重启 | Session SSE先订阅再读取PermissionAuthority.list，按sessionTreeIDs过滤，1322/1363发送pendingPermissionEvents；Main仍丢弃 | 现有后端durable恢复不能修复Main缺失物化；重新选择/刷新不会产生这张卡。SideChat重连清pending后接收后端快照，已有自身Session恢复通路。 |
| 正常决定/重复事件/终态 | Authority唯一ledger，replyValidated settleDecision、releaseDecisionWaiters；已完成Tool/Message retirement；Mainpermission.replied仍noop | 后续应按requestID幂等、同一ledger决定删除/更新同卡，不创造影子授权事实。没有真实批准后不推断恢复成功。 |
| 串并行请求与多Project | ID绑定project/session/message/toolCall/fingerprint；SessionLoop恢复入口4756拒绝错Project；逐message continuations及原Prompt owner回收 | Main缺口影响每个合法pending；本次只1业务Project/1request，未进行串并行多项目真实运行。不得据单样本排除共享风险。 |

### 不能只解除noop：live/恢复排序合同不一致

protocol/session-mirror.ts:196/204为permission asked/replied使用默认sessionOrderKey（取Session创建时间，domain=session）；question分支则明确生成interaction请求/答复orderKey。server/routes/session.ts的pendingPermissionProtocolSessionEvent已按request.timeCreated/id生成interaction key。Main card seed/interactionToCardSeeds要求interaction domain。因此直接照搬question处理器会让实时permission抛排序域错误，而重连permission表面又能通过，形成新的“双路”缺陷。

PermissionAuthority.Event.Replied当前字段没有timeResolved；后续若展示决定时间必须从已提交ledger的决定事实取得，不用UI Date.now或重放时间。实际允许一次仍由现有replyUser/API/决定事务控制，UI投影不得成为策略事实源。建议下一独立规格以同一Permission Request/ledger为权威完成session pending投影（hydrate/live/reconnect/decided），复用InteractionCard、interaction-reply和现有timeline primitive；Task继续其已有board.interactions所有者，不能重复发布同permission。是否需要完整已答卡片或仅移除pending应按当前可见消息合同设计，不先拼一个平行前端队列。

### 横审发现的额外边界与未知

Authority.list():1197未向requestedRows传projectID，公开GET /permission直接返回。CLI/ACP随后按exact session过滤，Session SSE按sessionTree过滤；history/grants显式使用permissionRequestOwnerBelongsToProject。replyValidated按requestID取requested，SessionLoop恢复阶段才核对Project。此是代码层值得验证的多项目准入/投影风险，当前没有跨Project实际错误回执；不能宣称已证实泄漏或跨Project执行。未来Main hydrate必须按已验证Session树和Project事实筛选，不能直接灌整个list。相关进一步行为调查应单独有界、无凭据，并在原scope完成正常收尾后安排。

已读恢复路径：PermissionAuthority.resumeApprovedContinuations按Instance.project.id查询；SessionLoop.resumePermissionContinuation区分已终态Tool/Message、Mission自己恢复owner、普通Session exact Prompt owner、多个同message获准continuation、finally释放再重读；Task engine interaction恢复保留真实pending Permission。当前并无充分运行证据认定这些owner/恢复代码有新错误，故本结论精确为共享人机批准投影缺口，仍记录控制全矩阵而非降级。

历史：permission noop可追溯65d0bfc98；pendingPermissionEvents后端加入见1f52b298a。本轮读取后台permission-transport-hydration、permission-continuation-recovery、permission-two-mode、engine-interaction-recovery及session permission-message-settlement相关case：已有durable CLI/ACP/protocol、Task恢复、精确message/Project和重复结果正向覆盖，没有证明Main按钮可见。未运行或修改任何测试，未发现/运行UI自动化。当前07-panel-reactivity约定的standalone恢复正文只写Question；07-panel的Permission InteractionCard承诺位于SideChat段，不能拿它证明Main已实现。

独立后续验收建议：正式后台正向覆盖真实Session hydrate+SSE（请求在订阅前、实时、重连重复、回复真实时间、跨Project/Session树、Task occurrence不重复），正常所有者close；UI只真实页面，至少GlobalChat/项目Chat与Work/Mission代表入口、Task原功能和SideChat自身回归，查看待授权、Allow once/deny正常决定、切会话重回、重连恢复、中文/英文与多个pending排序。必要一次实际Sol+外部公开read在fresh原预算scope复验，来源/配置/模型/ledger/工具终态分别查证。原395 live-01失败证据不能覆盖；修复批准前不实施、不创建UI自动化、不伪造消息。


## 实施边界与最小单源设计（待批准）

402的产品目标是Main会话对真实Permission ledger pending提供正常人工决定入口，并在warm/cold/reconnect与终态一致显示；不是新增授权策略或把permission改成auto approve。

优先复用现有standaloneQuestionInteractions/interactionToCardSeeds/InteractionCard/interaction-reply，将其拓展为同一standalone交互投影；不要增加第二前端permission队列、伪Task、合成user/assistant消息。后台同一Permission Request及已经提交的决定ledger提供请求/答复真实时间和interaction orderKey。hydrate和live/reconnect复用同一物化函数/shape，输出以真实requestID幂等，来源目录由已验证Session/Project绑定。事件不能靠工具名、文本或最后运行状态猜请求身份。Task-owned交互仍唯一来自board.interactions；Main session树需要明确Task归属策略，不能把一个request重复投影成Task卡与standalone卡。SideChat继续精确Session作用域，不通过切换SideChat批准另一个会话。

预计必要生产定义范围：protocol/session-mirror.ts的Permission排序/ledger投影、server/routes/session.ts的当前Session树pending hydrate、Overlay services/conversation.ts与tree-writer.ts共同已有交互投影边界。若Permission.Replied需要公开timeResolved字段，必须先列Authority事件及SDK/OpenAPI所有消费者和生成变更，取真实settled ledger.time_created，不在UI自造时间；这部分尚未批准，不能先改schema。若只显示pending并在真reply后移除，也必须保留现存自然决策/ledger可见事实与重连一致性，不能藏住用户动作。InteractionCard/buttons/l10n本身已存在，预计不需新按钮副本或Settings平行批准面。

后台正向计划进入真实PermissionAuthority+公开Session hydrate/SSE，无UI自动化：warm请求、冷启动已有pending、订阅前后边界、重复事件同id、真实allow_once/deny决定和时间、已终态读取、同Session多工具/同message串并行、两Project及Session树精确过滤、Task occurrence单一投影及SideChat自身请求。所有消息经自然参与者/真实public handler/受控流式Provider产生，不伪造completed消息；局部stub与后端合同不能称真实Sol或UI验收。先红后绿，保留原差异；若backend共享恢复异常出现，先扩全横审而非把case删掉。

桌面必须由root通过实际页面：warm Main当前请求、切别Chat后返回pending、主动断线重连/重新打开自有页、allow_once后read/output/真实答复、deny明确错误合同；至少GlobalChat和Work/Mission共享代表，Task和SideChat现有功能回归。中文/英文控件/无障碍沿现有i18n，人工截图复核且记录具体入口，不扩不必要移动端。旧395 failed scope不重写；fresh模型scope仍成对stage+exactSol preflight+固定600s/20requests/180s无活动和root预留页面/按时正常关闭。402需与403关闭修复独立scope提交/验收，不把一方成功当另一方完成。

当前只有spec/scratch，生产/测试均未修改。全局索引、架构/CHANGELOG由root统一；本记录阶段没有完成新的HTTP/视觉/模型运行。

## Root下阶段审查用最终推荐（2026-10-14补充，未实施）

### 决定：Permission只展示pending，真实决定后移除

推荐采用现有SideChat的Permission合同：真实pending显示InteractionCard；收到同requestID真实permission.replied后移除，操作结果仍在原ToolPart/最终答复，授权历史仍由唯一Permission ledger/Settings呈现。Question保持现有answered/rejected文字卡片合同（用户答案是内容），不为了形式一致为Permission另造已答卡片或user/assistant Message。因此402**不新增timeResolved字段，不改Permission Reply公共schema，不伪造权限历史气泡**；之前关于ledger真实决定时间的分析保留为“只有将来需要已答Permission卡片才必须做”，本推荐不走该扩围。

这不免除请求排序修复：permission.asked live必须使用与hydrate/reconnect相同的`timelineOrderKey({domain:'interaction',time:request.timeCreated,id:request.id})`，否则Main现有interaction seed校验仍会拒绝live事件。permission.replied仅作为真实决定的移除通知，不生成时间位置，不要求responseOrderKey或timeResolved；不更改其它事件的排序合同。

### 公共pendingPermissions快照及唯一投影

1. 在现有engine/model.ts新增`SessionPendingPermission`（复用唯一Permission Request schema，增加orderKey）并把**必有数组**pendingPermissions加到SessionConversationHydration与SessionConversationConnectionSnapshot。GET session conversation和session.connected都使用同一实际Session树/Project筛选后的当前pending集合。不能仅在warm事件解除noop，否则cold请求看不到；也不能只在reconnect重发asked，因为离线期间已经决定/取消的旧卡需要完整快照清除。
2. protocol/session-mirror.ts的pendingPermissionSessionEvent/live asked共用请求orderKey物化；server/routes/session.ts复用该物化生成两个snapshot。Session SSE已有“订阅→读快照→drain→connected→释放缓冲”的当前序列，必须保留；请求在snapshot后产生通过buffer补上，决定在snapshot后通过replied移除，同request重复按id幂等。重连snapshot整体替换**当前source的pending权限集合**，不清除Question已答事实、用户draft或别的Project数据。
3. 权威筛选同时要求request.projectID等于已验证Instance Project、request.sessionID属于实际conversation Session树。Task拥有者以Request.taskID（来自Authority的taskIDForSession实际lineage）和已有Task board source为依据：Task source只保留board.interactions，不能再注入standalone Permission；进入独立Session source时只纳该source合法非Task pending，Task worker应通过其既有Task视图决定。不根据tool名、session ID命名或“可能属于Task”猜测。SideChat目前只呈现本身session；这次明确保持其自身边界，不能把Main或Task请求挂在SideChat。
4. Overlay复用一个standalone交互投影状态（当前standaloneQuestionInteractions可按类型扩展/重命名，而不是新建平行permission队列），共享permission Request→InteractionData normalizer供Main与SideChat。requestID、sessionID、choices、directory和orderKey保持实事实；`replyEndpoint:'permission'`复用既有interaction-reply互斥与公开POST，UI不直接写ledger。Main warm asked upsert、replied remove；hydrate/reconnect当前pending snapshot replacement走同一normalizer。已有Conversation authority/selectEpoch机制拒绝旧Project响应，不用额外影子epoch。
5. scope资源正文按当前Request.scope整体呈现，技术细节不从`scope.paths`猜；公开paths实际在scope.resource.paths。不能建立模糊双形状兼容。**追加横审已确认cancel/stale没有现成的Session主动重读通知，不能依赖Task recovery、heartbeat或下次切会话收敛。** 最终方案按下文从唯一ledger事务发布真实terminal通知；Session移除/换source仍沿现有reset。

### 精确候选文件与协议同步

后台：engine/model.ts（两个公开schema与复用Request）、protocol/session-mirror.ts、server/routes/session.ts。前端：services/conversation.ts、services/tree-writer.ts、services/side-chat.ts（复用normalizer），必要现有共享interaction工具模块；InteractionCard与reply service行为预期不变。Request schema目前位于Authority namespace，engine/model已采用`question/types.ts`轻量schema先例。若直接引用Authority引入运行初始化环，推荐把当前Identity/Mode/Request与其ProviderKind数据schema**搬入一个轻量permission/types.ts单源**并由Authority/invocation重导出，原定义同时删掉；不得复制一个第二Request schema。该必要性在实施前要以具体import环/类型检查反馈root，不以猜测提前扩文件。

两个新的公共pendingPermissions数组需要按现有SDK generation transaction更新`packages/sdk/openapi.json`、`packages/sdk/js/src/gen/types.gen.ts`及实际生成发生变化的SDK产物；消费者全仓搜索SessionConversationHydration、SessionConversationConnectionSnapshot、SessionConnectedEvent，范围包括Main、SideChat/Subagent snapshot解析、SDK调用与后台Session事件检查。只按当前生成脚本发布一份schema，不手改生成类型骗编译。由于本推荐不新增timeResolved，PermissionRequest/permission.reply既有API及ACP/CLI的调用体保持；若生成器显示其它无关漂移需拆分审查，不能并入402。

### 聚焦正向测试与真实页面门槛

正式后台先红后绿：真实Authority pending→GET conversation.pendingPermissions；已有pending再订阅SSE；live asked与snapshot同request/time/orderKey；断线期间实际allow_once/deny后重连snapshot返回当前集合；同会话多request与两个Project过滤；真实Task请求只出board.interactions一次；正式cancel/delete真实决定后会话快照收敛。产生状态走正常public Session/受控流式Provider与Authority，不直接写fakecompleted消息。请求排序和完整数组schema属于正向公开协议，不做UI源码/DOM/快照测试。相关ACP/CLI transport、Task交互/permission恢复的正向合同与核心/SDK/Overlay typecheck按实际变化复跑。

真实UI只由root直接交互/截图：GlobalChat冷/warm pending、切别Chat回返、重连后的pending与已答移除；确认本次允许后原read完成与模型答复；Work/Mission共享代表、Task既有入口与SideChat自身路径回归。界面事件关联原requestID/Project，不用额外手工API批准冒充UI成功。必要exactSol fresh scope需403正常关闭路径已可验证，仍原600s/20requests/180s无活动、两分钟页面窗口、deadline-60s主动close。上述为可审实施方案，不是已实施/验收。

## 两项待审边界的追加收敛（2026-10-14，只读）

### 轻量Request单源迁移已有实际值导入链证据

scratch `import-graph.mjs`用TypeScript官方AST读取整个可达源码的静态import/export，排除type-only，不执行生产模块；结果`import-graph.json`不是运行期失败探针。当前`engine/model.ts`到Authority没有值路径，但Authority已通过`authority.ts:5 → task-session-lineage.ts:6 → task-execution-capsule-binding.ts:15 → artifact.ts:19 → engine/model.ts`回到model。新增model值引用Authority.Request即闭环。invocation也通过`invocation.ts:8 → shell.ts:7 → process-supervisor.ts:16 → task-execution-capsule-binding.ts:15 → artifact.ts:19 → model`回返，所以只搬Request、再从invocation取ProviderKind仍有相同环。

因此最小必要迁移是一个轻量`permission/types.ts`持有原Identity、Mode、PermissionProviderKind和Request；只依赖zod、现有轻量Identifier及PermissionDecision。Authority引用并原名导出同一个schema；invocation引用并导出同一ProviderKind，ToolInvocationProviderKind仍在invocation由这个唯一enum构建。移除原定义，公共ref/字段/choices不变。engine/model只依赖轻量模块。不是复制schema或采用lazy/fallback回避初始化；也不扩大搬迁整个Authority、invocation、EffectClass。当前尚未实施，因此不声称已经运行过新schema入口或出现TDZ；实施正式核心/SDK类型和协议正向测试负责证明迁移正确。

### 取消/过期不是用户拒绝：新增唯一ledger派生terminal通知

精确pending定义是`Authority.list:1197`的requested且没有decision_slot。允许/拒绝由现有Replied结束pending；`settleStale:1450`及`cancelPendingForSessions:1563`真实写stale/cancelled decision_slot，却只releaseDecisionWaiters，不发布Bus。`retireContinuation:1290`及恢复身份变化的appendEvent(stale)是**已有获准continuation的退休事实**，不是新的pending决定：continuationReady要求已有非拒绝decision，exactContinuation只在恢复原获准request时进入。因此不要把每条stale ledger行都投影成pending取消，更不能重写已批准事实。Session删除自身会reset选中视图，但正常stop、stale、另一客户端取消均没有这一保证。

推荐最小新增事件为`PermissionAuthority.Event.Terminated` / `permission.terminated`，字段固定为`projectID, sessionID, requestID, ledgerEventID, status`，其中status只为`cancelled | stale`；身份和状态来自赢得唯一decision_slot的已提交ledger，不使用`decision:'deny'`、不带假userInput、不创建Message。它只指明pending已真正终止，**不新增timeResolved或responseOrderKey**；历史决定时间仍通过ledgerEventID对应的原time_created查询，Main只移除pending卡无需另造timeline位置。

发布位置收敛到当前`settleDecisionInTransaction`：将`settleDecision`复用这一现成事务写入器，而非保留appendEvent和transaction两个decision插入实现；在赢得insert后、同一数据库事务内通过现有`Bus.publishOwnedInTransaction`记入outbox，只为cancelled/stale写Terminated。唯一冲突的读取winner只包住decision insert；不能把outbox/shape失败吞成“已有人决定”。Bus的事务后owned publication/retry是原有持久投递机制，不增加权限状态表或影子队列。settleStale/cancel可以在事务提交后等待返回publication；cancel仍受原awaitWithinSessionDeletionDeadline，不改批次/lease/waiter/recovery或吞掉投递失败。原真正replyUser的Replied/userInput事务完整保留，不额外发Terminated重复正常用户决定。

全入口影响需精确区别：全仓搜索确认`cancelPendingForSessions`生产调用只有`task-api/index.ts:3481/3494`的deleteSession两阶段；单Session便利函数没有生产调用；`settleStale`目前由permission-two-mode后台测试直接覆盖，没有现存外部生产调用。**普通Session Stop不是已证实的cancelled ledger决定，不能因Stop按钮或Tool错误就假移除pending。** 本批事件严格汇聚真实决定写入器，不改取消策略或effect准入。Task interaction状态已经由ledger即时投影，`resolvePermission:352`只核对已决定和真实userInput，不另写终态；Terminated不调用其用户回复分支、不新建Task卡。Task控制/Board现有恢复保留，必要消费者只从同事件刷新当前Task投影，绝不双写。CLI/ACP只处理Asked并主动调用reply，durable pending仍来自原list；新事件加入SDK union但不要求把系统取消翻译成终端用户输入。HTTP permission.reply体和ACP决策合同不变。

具体新增接线：protocol/session-mirror映射Terminated到同Session协议流；engine/model的SessionProtocolEventType enum、Overlay event-policy白名单同步；tree-writer与SideChat对同requestID移除pending（SideChat仍exact session）。Session SSE由同一已验证树过滤，其ordered connected→buffer事件保证snapshot之后的Terminated不被旧HTTP结果覆盖。新增事件由Bus注册schema正常进入OpenAPI/SDK generation，与两个pendingPermissions数组一起生成；需检查`packages/sdk/openapi.json`和`packages/sdk/js/src/gen/types.gen.ts`及生成器实际受影响产物。全仓语义搜索覆盖authority/engine interaction/session mirror/session routes、cli run/ACP、overlay event-policy/tree-writer/side-chat和SDK，未发现另一个现有真实cancel/stale公共事件可复用。

后台新增正向合同必须同时证明：真实cancel/stale ledger赢家→同事务outbox→Session流确切status/ledgerEventID→GET/connected pending集合为当前值；重复/并发决定只有一个当前ledger终态，真实allow_once/deny仍原Replied/userInput；Task-owned请求不进入Main standalone集合；两个Project、合法子Session、原source切换后隔离。不测试UI源码，不以模型自述证明状态；不把retirement stale误认pending决定。这里是方案，未执行新测试。

### UI同事复核纳入：afterReply所有者与有序恢复

root独立委托的audit_ui完整反馈在`.tmp-standalone-permission-projection-402/ui-review.md`。确定补充：`InteractionCard.runAction:151–169`成功默认loadBoard，Main `CardParts:107–113`与`InteractionDialogHost:62`未传afterReply；`store/board.loadBoard:339–355`无activeTaskID即把board设null。402不能保持这个默认行为。最小统一回调在点击开始捕获source.kind/id、directory、ApiAuthority/selectEpoch；HTTP结束仅在原作用域仍当前时后处理。Task沿原loadBoard({authority})，Session不调用Task loadBoard、不resetWriter，真实Replied/Terminated和有序connected负责移除；SideChat保留原显式afterReply。不得在await后用当前activeTaskID决定刷新另一个会话。

唯一成熟重连提交原语是`mergeSessionConnectionSnapshot:447–469`，只替换standalone Map中Permission项，保留Question answered/rejected、draft、读位。`hydrateSessionConversation`会resetWriter，不作为每次回复刷新的工具；额外独立HTTP读会与同scope新asked/replied竞态，selectEpoch不足以解决，故本推荐不加。正常permission.asked须接受后端已验证的非Task子Session，不复制Question根id/mission gate造成warm丢弃。SideChat按exact target Session从新snapshot正规化；若移除旧asked重发必须一并接线。所有卡片共享一个strict normalizer和已有Map，带真实sessionID/timeCreated/interaction orderKey。

新增必要前端文件范围包括InteractionCard的统一source-aware默认后处理（或一个Main两调用点共用原语），不能通过泛化loadBoard契约补洞。`07-panel-reactivity`关于resolved双时间位置需由root限定为保留resolved的Question/Task交互，明确standalone Permission为pending-only；这只是架构说明，不添加timeResolved。audit_ui指出Dialog相同毫秒排序潜在边界，当前无实页证据，本批不扩为所有Dialog排序改造。

截至本段：402仅spec/scratch修改，未运行服务、模型或UI测试，生产仍待root批准。root后续真实页需补inline/Dialog Allow once、点击后切源、真实ledger取消/stale及时消失、多pending互不误清、Question草稿、Task/SideChat原路径；395旧失败不可覆盖。普通Stop后是否仍有合法恢复等待、是否需要单独退休请求，必须用实际canonical事实按共享取消合同判断；本轮未运行Stop探针，不把它混同新terminal通知或擅改Session取消。

## Root补充横审：Task终态刷新、child准入与实施允许清单

2026-10-14 Root在独立实读Authority、mirror及Main/SideChat后，要求audit_ui继续只读核对Task-owned权限的cancelled/stale展示和合法child Session过滤。完整调用摘录与建议保存在`.tmp-standalone-permission-projection-402/task-terminal-ui-review.md`。本节只有spec/scratch修改，没有生产、测试、SDK生成、服务、浏览器、模型、凭据或Git操作；401产品修改已冻结交Root另行验收。

### 不能只让Main/SideChat移卡：Task读取正确但没有通知

`engine/store.ts:758–785`每次投影Permission Interaction都实时读取唯一`decision_slot`：cancelled/stale沿现有显示合同投影为`rejected`，response为`decision:deny`，resolved/updated时间来自真实ledger。它同时明确拒绝ledger决定和EngineInteractionOutcome双终态。这是已有展示映射，不能由此宣称系统取消是用户拒绝。

`EngineInteraction.subscribe:32–38`目前只有Permission Asked/Replied。`resolvePermission:352–365`只验证已经完成的ledger投影并在真正userInput存在时捕获作者证据，不发Task刷新。Session mirror的普通assistant/mission事件投影到`aggregate:session`；选中Task SSE订阅`aggregate:task,taskID`（`routes/orchestrator.ts:615–646`），因此新增Terminated若仅映射Session流和前端移卡，当前Task页面仍没有这一刷新入口。读取时能得到终态与在线视图收到刷新是两件事。

已有成熟消费链是：Task `interaction.resolved`→Task SSE→tree-writer.handleInteraction重投影旧Board→event-policy `interaction.*`失效→events.scheduleBoard→GET Task board→`listInteractions`重新读真实ledger。静态定位为tree-writer 888/2078、event-policy 127–131、events 402/525、board.loadBoard 339–417、workbench/board 56–78。只调用handleInteraction仍是旧board，必须让原Board刷新分支运行。

最小建议在`engine/interaction.ts`增加独立Terminated订阅，沿Bus的durable occurrence合同；不调用resolvePermission，不传假userInput，也不调用resolveEngineInteractionRequest。读取事件指向的ledgerEventID和其requested原事实，校验Project/session/request、真实decision_slot和cancelled/stale类型，再找原permission Interaction及其Task Project。普通standalone没有Interaction就没有Task通知；存在时必须符合原身份，不创建新的Task卡或owner。

对存在的原Task Interaction，复用`ProtocolStore.dispatchEphemeral`发Task范围的既有`interaction.resolved`投影失效通知，其status取现有投影的rejected、真实时间/排序依据取原ledger。summary应描述真实permission cancelled/stale，不写“operator rejected”。该primitive本就用于事实存在其他表的live投影（protocol/store 738–790），保留Task liveSequence/liveEpoch及重连buffer；重复投递可以重复刷新，却不会写第二终态或伪Task状态。冷重启依旧读同一ledger，原Task控制/工具waiter收敛不因该显示通知改变。本批不能据此宣称普通Stop或所有Task控制调度已修复。

### Board缓存标签的具体边界（新增范围待Root批准）

`workbench/board.ts:391–398,426–447`的Interaction标签只有count与max(time_updated)。`routes/orchestrator.ts:1310–1318`仅比较该tag决定304，loadBoard会带原If-None-Match。同毫秒requested→cancelled/stale时，count及最大时间可以完全相同；真实status已变但旧tag仍相等。因此不能仅凭“发出Task通知”宣称所有在线终态已展示。持久化一个新interaction.resolved事件也不会自动补足它：latestTaskProtocolSequence只在board payload，未进入boardTag，协议发布也不更新Task时间。

上述阶段曾建议只增加Interaction状态计数，Root已否决并撤回：两个request状态互换仍有相同计数；随后只对Interaction做完整指纹的建议也被否决，因为Project/topology/execution/incidents/brief/lastSequence等真实响应仍可能改变而旧标签相同。最终替换方案以下节完整Board响应身份为准，禁止实施这两项中间提议。

### 合法非Task child的唯一生产准入

全仓没有现成统一nonTask交互谓词。已有`sessionLineageIdentity`持久祖先/Project校验和`taskIDForSession`权威Task归属可复用；`includeSessionTreeEvent`只校验selected祖先和Project，hydrate/replay pendingQuestions目前只检查tree set，Main `isSelectedStandaloneSession/handleStandaloneQuestion`仍是根ID/已知Mission例外。不能把后者复制给Permission，也不能用前端sessions Map暂时缺child而丢弃合法warm请求。

建议在现有`engine/task-session-lineage.ts`增加一个共享非Task交互Session谓词：对expected Project读取真实lineage，Project匹配且`taskIDForSession`为空才接纳；missing/foreign leaf返回false，损坏/跨Project祖先链保留现有明确错误。Session树成员条件继续由原`Session.treeInProject/includeSessionTreeEvent`负责。Question与Permission hydrate/replay及Session mirror仅对交互事件复用该谓词，不改普通Transcript/lifecycle树传播。Permission再按真实Request.projectID/taskID校验一致性；不能通过只看Request.taskID字段绕过持久归属。

Main当前Session流在已有ApiAuthority/generation校验后可接收合法child交互，Question也沿同入口修正根ID限制并保留answered/rejected/draft合同；Task source继续唯一board.interactions，SideChat仍exact target Session。实际本地child生产者`tool/delegate-agent.ts:124–129`创建assistant+parentID，权限可到达；但它第28行明确禁用question，不能把它当自然child Question实页样本。合法child Question后台合同可走真实Session/Question API，但不能伪称模型delegate已经问过。assistant/mission的现有Session镜像范围已覆盖真实本地child，不借此放开所有Task worker角色。

### 精确产品与SDK范围建议

后台允许清单建议为：`permission/types.ts`（新轻量单源schema）、`permission/invocation.ts`、`permission/authority.ts`、`engine/model.ts`、`engine/task-session-lineage.ts`、`protocol/session-mirror.ts`、`server/routes/session.ts`、`engine/interaction.ts`；另`workbench/board.ts`为上述已具体说明的缓存边界待批准。除新types文件外均复用现有模块，不复制Authority Request或另建决定源。

前端建议为：`services/tree-writer.ts`、`services/conversation.ts`、`services/side-chat.ts`、`services/event-policy.ts`、`components/InteractionCard.tsx`，以及唯一共享`utils/permission-interaction.ts`（建议新文件，Root若选已有合适模块只保留一个实现）。它只正规化Main/SideChat重复的Request→InteractionData，不拥有队列。Main inline与Dialog从InteractionCard共用source-aware默认afterReply，SideChat保留显式回调；CardParts、InteractionDialogHost、interaction-reply无需分别复制后处理。`services/events.ts`现成interaction.*已可刷新Task，不应新增平行路径。

预期tracked生成结果为`packages/sdk/openapi.json`和`packages/sdk/js/src/gen/types.gen.ts`；协议只增加两个pending数组和事件union，原则上不改变SDK method URL/请求body，最终以真正生成差异为准，不手改生成文件。完整生成必须运行`packages/sdk/js`的既有`bun run build`事务：OpenAPI源生成→临时client生成→保留现成流取消/required body修正→format→tsc→`replaceGeneratedArtifactsAfterSuccessfulBuild`。该事务六个真实发布目标相对`packages/sdk`为`js/dist`、`js/src/gen`、`js/src/defaults.ts`、`js/src/route-policy.ts`、`js/src/platform-artifact-tool-ids.ts`、`openapi.json`；即便只有两项tracked内容改变，也不能绕事务手工复制。无须修改生成器；并行生成的无关差异必须与原owner协调，不能整仓回退或合并伪装成402。

Authority事件/Request公开schema同步，不改HTTP permission.reply、ACP/CLI请求体、Settings按钮、Task reducer/status模型、Bus或ProtocolStore实现，也不增加依赖。原`permission/pending-projection.ts`是CLI/ACP exact Session durable list，不是当前Main Session树准入函数，不能直接挪来吞child。

### 本轮新增的聚焦后台正向合同

- 真实pending→GET/connected/warm Asked返回同request/session/timeCreated/interaction orderKey；snapshot/live overlap对应一个真实ID。
- 同Project合法非Task child的Question/Permission进入选中祖先快照及流；真实Task拥有者沿原单张Task Interaction，foreign/sibling集合严格按公开范围返回，损坏lineage对应明确错误。
- 真实cancelled/stale winner的同事务outbox与通知保留exact ledgerEventID/status；重试/并发返回同一个实际决定，已批准continuation退休stale仍独立，不当pending终态。
- Task原permission+真实终态→Task SSE失效通知→GET Board原interaction ID、rejected、ledger真实时间；同毫秒条件GET应200与当前数据。用户证据仍只来自真正Replied，而非系统通知。
- connection snapshot读/缓冲边界留下snapshot之后的真实事件；离线终态后connected集合清除权限，Question事实/草稿保留，不加第二HTTP权限快照。
- 原allow_once/deny HTTP路径继续产生真实userInput、Tool结果或明确错误；Source切换隔离仍用现有authority/selectEpoch。

拟复用后台测试路径：`packages/opencorvus/test/permission-two-mode.test.ts`、`permission-transport-hydration.test.ts`、`engine-interaction-recovery.test.ts`、`server/session-event-connection-snapshot.test.ts`；若没有现成Board条件GET套件，新增有界后台case而不是Overlay源码/组件/DOM断言。此次没有新增、修改或运行测试。Root还需独立审定Board标签增补及共享helper位置，然后实际实现/协议检查/SDK事务/桌面前后态；没有据静态调用链宣称Task SSE、同毫秒HTTP、child Question或全部跨项目路径已验收。

## Root最终实施方案：完整响应版本与权限单源投影

### 新增已读资料、搜索和委托反馈

Root重读本Recall、403完整交付、permission authority/decision/ledger、Session mirror/routes、task-session-lineage、Main tree-writer/conversation、InteractionCard、SideChat和当前07-panel-reactivity/security-permission；独立读取安装Hono4.13.7 etag实现及既有canonical-digest。audit_ui完整反馈为`.tmp-standalone-permission-projection-402/full-board-validator-review.md`，已列全部getBoardTag/boardTag/boardTagForTask调用、compileBoard的getProgress/Mission/会话消费者、opaque snapshotVersion/ETag前端消费者和SDK string合同、历史代码决策、SQL成本与brief缓存边界。Root不接受计数或部分响应的校验方案。参考权威[RFC 9110 §8.8](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8)及[§13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2)，此处摘要用于实际HTTP资源身份，非无效源码校验门槛。

### 根因、旧路未根治原因与影响

现有Board标签把部分计数/最大时间拼为未加引号字符串，既遗漏各request身份/状态和值，也遗漏已经公开的Project名称/工作树、拓扑、执行/故障、brief和lastSequence。路由先getBoardTag再getBoard，后者还重复算旧tag，条件请求和正文可来自不同物化结果。只发Task失效通知或只修改Permission排序不能修正错误304。本次完整替换唯一版本源，删除旧tag查询和手写条件比较，不添加影子序号、假的Task更新时间、旧协议兼容或快速后备。

compileBoard仍用于Task、Mission状态、会话hydrate和getProgress；其新增CPU/内存成本相关。既有compileBrief首次/失配可插入派生缓存，不能称GET完全无数据库写入；其业务策略和缓存签名不在本批重写范围。无Provider调用、配置变更、数据库schema迁移、Task调度或权限策略改变。大Board尺寸、并发cache生成和性能尚未运行，属于未知，验收必须记录实测范围；完整版本忠实描述当前返回brief，不承诺解决其所有生成政策。

### 唯一完整弱实体标签

`compileBoard`一次buildBoard得到完整对象，排除唯一自指snapshotVersion，按现有HTTP JSON语义物化一次（undefined对象成员省略，数组顺序保留）。对完整JSON可见对象调用既有`canonicalDigestSource`，固定域`opencorvus.task-board-json.v1`，产生`W/"task-board-v1:<sha256>"`。规范对象键只用于语义身份；正文保留原JSON字段顺序。同一已物化对象加snapshotVersion后返回，路由设置同一ETag，不能另一查询重算。weak明确表明语义资源身份，不声称压缩/对象键插入顺序的字节强身份。

精确新增后台范围：`workbench/board.ts`、`task-api/index.ts`、`server/routes/orchestrator.ts`。删除getBoardTag、boardTag、boardTagForTask、旧专用taskSessionTreeVersion及其确定无消费者的imports。复用安装`hono/etag({weak:true})`作为Board路由唯一条件请求实现，预设完整标签避免第二digest；先真实getBoard准入，再由middleware处理GET/HEAD的列表、星号和弱比较。Root及audit_ui补读完整Context链：etag先读c.res，Context.res setter在替换304时合并旧头（除content-type），随后etag过滤非retained头。单看局部new Response会误判旧头丢失，RETAINED_304_HEADERS常量本身也不能替代运行证据。当前Board无内置压缩，server/sse.ts独立压缩合同不改；外层CORS与request-id实际304行为需真实HTTP确认。若实际必需头缺失，以现有外层响应机制修真实边界，不增加平行条件请求实现。

### 权限与问题边界

维持前文轻量Permission schema单源、两个mandatory pendingPermissions数组、ordered connected→buffer、pending-only原Map/共享严格normalizer、自然Asked/Replied与实际cancelled/stale事务Terminated。后端根据持久Session lineage/Project/真实Task归属筛选Permission：合法非Task child进入所属会话树，Task卡仍只来自board.interactions。此次不扩大Question child准入或重写其既有answered/rejected/draft行为。删除旧connected的Permission Asked重发必须同时接好Main和SideChat的新数组；不可留下两种快照源。Task Terminated仅校验唯一ledger事实后用现成ephemeral失效通知，不写第二终态或假用户输入。

Main默认afterReply在点击前捕获source/directory/API authority/selection epoch，原Task仍当前才刷新原Board；Session依赖自然Replied/Terminated与connected清卡，不调用无Task loadBoard。SideChat显式回调保持。与本范围有关的UI自动化若实际检索发现，按仓库约束删除其明确UI测试及专用fixture，不运行；backend协议/状态测试不能因命名含UI被误删。未检索到路径无需额外扫描。

### 验收与交付

正式后台正向先红后绿，涵盖真实Authority→hydrate/connected/warm事件、request/time/orderKey、两Project与合法child、Task唯一卡、原allow_once/deny、真实cancelled/stale赢家及outbox、Task事件→条件GET200/current terminal。新增完整Board公开HTTP检查证明首200/body/ETag一致、未变304、列表/星号/强写法弱比较、不同标签200、HEAD、正确Project准入、真实同毫秒状态与等数量身份变化、合法Project/Task/其它响应变化、重复brief时间稳定、CORS/Vary/request-id。不可重算同函数摘要冒充业务正确性或以“不调用/不存在”断言为核心。全SDK六目标生成事务、核心/SDK/Overlay类型及docs:check按实际最终变化执行。

Root真实桌面需前后截图和人工复核：Main inline/Dialog自然待批准、Allow once/deny、切源返回/回复期间切源、cold/reconnect、多个pending、Question草稿、Task与SideChat现有入口、中英文。必要GPT-6.1 Sol用全新配对auth/models目录、分别验证凭据/模型目录/实际stream:true请求；保留原模型600秒/20请求/180秒无活动和页面关闭预留，不覆盖395失败。不能把受控Provider、局部测试、构建或静态审查宣称真实模型/UI通过。任何scope都join原物理/输出/请求清理并删除配对资料；共享控制异常立即再横审。Root完成证据、当前架构/双语日志/索引、范围提交、fresh upstream merge与正常push后继续下一批，整体goal active。
