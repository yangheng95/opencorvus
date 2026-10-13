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

## 实施跟踪与Root修复前页面证据

402最终实施方案独立提交`c9403b328ab59a6325937c3c498c49f35a428e08`并正常push；403交付`c71da54e53e769938d97edae37b987c7b4628547`也已push。Root分配11后台文件及聚焦正向测试给audit_functionality、六前端行为文件/两个正向协议fixture给audit_ui；额外批准InteractionDialogHost仅三行旧loadBoard说明更新，不改组件行为。subagent transcript parser不扩大pendingPermissions合同，真正交互消费者为Main hydrate/connected与SideChat connected。

Root真实修复前范围为`.tmp-standalone-permission-projection-402/manual-before-05`：Bun1.4、成熟owned_tree进程、独立运行目录/公开CSV/受控流式Provider，无用户凭据或真实模型。真实POST /global/config写唯一自有配置，再POST /global/chat/start自然产生Session `ses_hheDo7cTz3Pf6OWon5vq`、Project `prj_hKbuQucjy1aOUqNKtwOT`与read Permission `per_hrMDFckzk27ucXLuOdPX`（timeCreated1791916032681）；公开GET /permission确认待授权，Message/Tool原事实在messages-before-close.json。Root通过真实桌面选择该会话并展开read工具，实际显示Ask me、Running/waiting for result，Main没有决定控件。两张原JPEG和展开后AX已保存并人工查看，非UI自动测试或DOM断言；Tool展开排除了仅折叠隐藏入口的解释。使用401私有bundle，其Main该路径与本次修改前源相同，未将静态差异或过去395截图冒称本次页面。

新浏览器连接的原IAB2已不存在，实际inventory为同线程IAB4，Root按故障文档重新连接该IAB，未操作用户Chrome。自有tab1于2026-10-13T18:30:26.574Z关闭，早于原closeBy18:35:59.971Z；server/provider实际stop完成。原owned83312在18:31:08后自然exit1：工具脚本在自身SQLite进程尚未退出时删运行目录，db-shm EBUSY。外层原handle已join settled/outputSettled、输出drain并在物理退出后删除原parent runtime；closure-review.json确认。此为修复前UI复现证据，不能称正常Native exit0或真实Sol验收。Root修复脚本仅将目录清理收敛到原外层controller物理退出后，已保留05实际两脚本，下一fresh原页面流程必须重跑验证；不改产品/SQLite政策或放宽600s/closeBy。

更早准备失败保留：01路径分隔/监督器定位错误没有application；02误用不存在的handle.wait导致controller失败，没有application ready/页面，原target88348/helper87184/controller88196均独立查证已不在，ready/helper与closure.json保留，原精确临时根已清理（output join未确认，不能写完整成功）；03测试运行目录准入错误、04仅配置project inline而Global Chat未得到同一全局fixture模型，两原owner自然exit1并由外层清理。后者没有用户auth/models，不属于真实Provider凭据缺失；05改用正式global配置后得到正确模型/stream与自然pending。首次01没有保存准确bootstrap临时根，残留目录清理状态未知，不扫描/删除其它任务临时目录。这些本地启动器错误不覆盖原395失败，也不代替402产品修复后验收。

前端静态首版范围9文件：六行为、一个限定注释、两个既有纯transport/state正向协议fixture；标准Bun1.4隔离runner27测试/66断言与renderer-surface通过，SDK/typecheck/私有构建和所有修复后视觉仍待完成。后台首轮Session缺数组/Terminated及Project更改返回旧304得到红证据；另新HTTP夹具把server.stop放在自身Instance.provide尚未返回的租约中，造成60s自锁，必须保留原输入/失败并修夹具后重跑，同时横查生产同结构，不能算Board产品缺陷或增加deadline。此节为当前状态，不预写后续成功。

## 新增根因与实施前补充：Permission Request时间的唯一权威

Root独立读authority authorize注册事务、appendEvent、requestFromRow、唯一authorizeAndExecute调用、assertAttemptIdentity/exactContinuation及外层执行context；完整委托审查在implementation/request-time-authority-review.md、request-consumers.txt/request-full-search.txt。真实初绿同ID Asked.timeCreated1791916977247/hydrate1791916977250和child1791916977260/1791916977262，证实不是仅格式或个别UI：Request draft先Date.now，append requested再Date.now，Asked发布draft而list/快照读取ledger，旧路径没有把已持久化原请求回绑所有消费者。

影响覆盖Session/Task/Mission、CLI/ACP实时与冷恢复、Main/SideChat的interaction时间及所有后续executionContext、outcome/completeExecution/replay hook。身份ID只取project/session/message/call/fingerprint，时间不参与；原policy/decision_slot/attempt/outcome/effect lease不改。同ID复用原requested时间，不更新不可变ledger行。所有生产都经过authorizeAndExecute且private authorize只有该一个调用者；多Project原owner校验、exactContinuation变更StaleContinuationError、attempt准入顺序全部保持。Question没有此本批新变动，公共schema/HTTP/SDK方法不因时间绑定新增协议。

Root最终批准最小方案：将原唯一Request注册事务从private authorize开头移到唯一caller原assertAttemptIdentity后/await authorize前。局部request const改let；事务先原assertRequestIdentity，existing pendingOrRequestedRequest已是canonical Request，直接返回；首个请求append原requested行后只对这条新LedgerRow用现成requestFromRow，返回canonical Request。之后authorize/Asked/所有执行context与结果共享该变量。原注册块删除，不新增primitive、缓存、并行注册或第二读取来源。内部未发布draft不是当前事实；公开Request始终来自唯一requested。Root否决只改authorize局部变量，因为外层仍draft；也不采用在caller事后重读decision owner的额外一读。早期试验3例通过但existing分支误把Request当LedgerRow，已按精确hunk撤回，其原输入/差异/输出保留，不能恢复该试验代码。

补正式正向：首Asked/list/hydrate/connected/requestOrderKey一致；同message/call/input在pending时重复执行自然Asked保持同ID/time，各waiter经真实决定收尾；完成后same-ID恢复真实原结果/owner；两个Project各自身份，Task child仍原source-backed卡。原permission-two-mode/continuation/message-settlement相关合同重跑；不用冻钟把两次取时偶然相等，也不用UI重写/修改ledger时间掩盖分叉。上述方案实施前已落盘，仍必须真实测试后记录结果。

TCP夹具60s自锁的横查另已完成：全src stop/Instance.provide调用证据在production-stop-callers.txt。生产ACP在provide退出后finally.stop，CLI/server-runtime不在同一个await stop的Project回调里；HTTP shutdown独立control route，Task/Mission无直接Server.stop调用。原403真实Native/Task/Mission/串并行证据为既有支持，不称本次重跑；修后同一真实TCP checker在lease外listen/fetch/stop，原红9.76s正常join/0 uncaught、初绿2项11断言且约3s正常stop。可以排除这个具体fixture self-await结构，不能据此排除整个产品所有关闭异常或豁免今后横审。

## Board公开读取的项目契约澄清（修改验收前）

Root先按helper局部Instance.current为空推测准入遗漏；随后独立补读transport-protocol TASK_RECORD_READ_ROUTE/routeRequiresProjectDirectory、Server最外层895–897直接next，以及requireRouteTaskInCurrentProject明确允许没有current。该GET是已有真实Task记录定位的全局读取，不进入PersistedProjectContext；目录头不是此请求的项目授权scope。历史65d0bfc98已有该分类，ea8ec4fa1抽取helper即保留current存在时才限制的合同。此前“另一目录头应该公开404”的推断撤回，不能以helper命名或中途链条当根因，也不能扩成改变45调用和所有Task公开读取。

同一个自有两Project scope已实际确认：Task tsk_g00VXxQ8g100DNEFYJR0，在other目录头下正常200仍返回原Project prj_hqT21tgOoMZFHQHUpC0q和同Task；If-None-Match:*返回304。事实在canonical-and-project-boundary.log，不涉及用户实际项目或数据外泄证明。402验收按当前合同修正为公开已存在Task200/对应Project，星号304；不存在的有效Task身份404；真正Instance项目上下文里的内部getBoard错项目404。资源先getBoard才能条件返回仍成立，不能对未找到资源因星号直接304。命令/Session投影的真实Project准入不变，45调用分组继续只读核对，不改公共权限策略或header解释。错误测试预期和原失败记录保留，此澄清实施前已落盘。

## 后台实施冻结与页面验收前边界

后台17个自有文件（11生产、4聚焦测试、2真实生成文件）已冻结，精确清单为implementation/handoff.json。正式去重9个测试文件71用例/301断言通过，SDK生成后真实公开HTTP再验13用例/64断言通过；核心及SDK类型、diff检查均exit0。唯一完整SDK build发布六目标并清理staging/backup，tracked仅types.gen.ts新增83行、openapi.json新增311行，其余四目标无变化。没有手工复制生成内容或绕过stream必需请求体；所有原exec已join，当前没有自有后台服务或Provider。以上均非真实Sol或桌面验收。

Root独立审查了11生产差异与生成合同：新Request单源仍只来自原requested账本；取消/失效通知只由真实decision_slot赢家同事务owned Bus发布；Task终态通知校验原账本及已落盘Interaction后使用现成ephemeral失效事件；完整JSON Board一次物化、规范digest、同对象body/tag和成熟Hono条件请求保持一致。生产停机、目录头及类型循环的既有纠正不扩成新政策。

发现两个后续候选，不能写成本批已修复：其一，合法Task标题变更使完整Board标签更新、HTTP返回新title，但既有Brief cache signature没有标题输入，Brief可能仍旧标题；失败输入和原观察保留，当前测试以实际200/new title及当前完整投影为合同，不增加错误的Brief刷新要求。其二，pending Permission集合替换自身保留Question原对象；但完整重连仍发送Question Asked并创建新对象，可能使keyed Dialog重建而丢草稿，恢复更早Permission也可能切换当前Dialog。audit_ui已只读核对原对象/Solid代理/组件生命周期，未改Question行为；必须实际页面分别核验集合更新、完整重连与Dialog切换，不能笼统声称Question草稿在重连后保留。

## 真实后态与新增问题（修复前分析）

英文Main后态01正式private build/typecheck均0后启动：实际cold Dialog/inline可见，reload后重新选择原Session恢复原待Request，Root点击inline Allow Once→真实read完整公开CSV→助手finish stop，五张原JPEG人工查看。修复后的原runner exec4961 join/exited0/outputSettled，物理退出后唯一parent清理runtime，CIM确认原PID67224不在；原before05 EBUSY/exit1保留。此受控Provider不算真实Sol。

全新sol-after-01真实Native Bun1.3.14/402 UI/配对完整auth与models/精确GPT-6.1 Sol预检及业务通过：公开53B CSV自然Asked→中文Dialog本次允许→原账本四阶段→read成功→助手正确CEDAR402/Maple3/Iris4/合计7/原文件引用。Root原图人工复核及实际checker0，5实际200/stream true/reader settled EOF（含预检/helper，非5业务turn）。Root先关tab3，成熟shutdown0，原launch exec32239 join0；原Target1852/Host47908自然exit0、全部output/request完成/端口释放，原auth/models副本均removed，原600s/20请求/180s无活动/closeBy不变。说明和精确输入/输出在sol-after-01，公开归档不得带原Provider payload或凭据。

实时Main后态02在原tab4已选择/连接后才释放公开流式回复，自然Asked出现；实际Dialog Reject使原ledger denied、Tool error/operator denied，但Session随后报completed without a durable reply，最终Not running。原HTTP messages/conversation/history、前后JPEG和原进程日志保存；原exec52772 join0/目标68348自然exit0/parent运行目录清理，未把终态错误当验收通过。立即按共享控制共性进行全生产入口/Task/Mission/Session occurrence/正常终态/重试重启/串并行多Project横审，当前实现禁止在分析完成前修改。初始直接链：processor默认continue_loop_on_deny不是true→真实RejectedError设置blocked→提前返回stop；loop.finalizePrompt遇到仅有completed tool-calls、无真实control结果的assistant，严格completed-reply拒绝并抛缺持久回复。现成toModelMessages已有真实Tool error→模型output-error，不应假造assistant或放松durable reply；完整影响和取消/恢复合同待审。

### 实时权限正文覆盖：完整分析与批准方案

同02原图warm正文Permission requested: read，而cold/ledger原Request为read (read_local)。Root独立读mirror两dispatch与propsOf，audit_ui全链核对证明propsOf仅取payload/补真实身份，SideChat直接读payload，二者未改summary。原invocation生成业务summary→authority不可变ledger；Task Interaction、CLI、ACP和Settings直接读原事实不受影响。Session mirror Asked mapper先保留原Request，再返回诊断summary；dispatch payload先spread mapped.payload后写诊断summary，覆盖原业务字段，ProtocolStore又以已覆盖字段产生envelope.summary。Main独立GlobalChat/Chat/Work/Mission及SideChat暖流均受同因；两个pendingPermissions快照仍spread原Request，所以冷/重连正确。Request身份/时间/决定未变，不是模型语言或前端缺翻译。

已核当前10类mapped事件，仅Permission Asked的公开payload拥有顶层业务summary；其余无此字段，第二Task dispatch仅root config.changed。Root批准原session-mirror.ts两个已有payload组装处先写现有诊断summary、后spread canonical mapped.payload；Task分支仍最后赋canonical taskID。修共享组装优先级，真实业务payload不可被诊断默认值覆盖；不新增字段、前端特判、fallback或第二summary事实，SDK公共形状不变。扩既有session-permission-projection.test.ts的实际Authority→mirror→Session SSE正向，核Asked完整Request/summary和实际cold/connected摘要一致，先红后绿；既有transport mapper-only检查未经过覆盖点，不冒称这条链通过。使用原技术read (read_local)说明，不在UI改写事实。实施后重新采集Main/SideChat冷暖真实原图，旧02错误截图保留。

### 拒绝工具后的共享续步：完成分析与实施方案

Recall补充：本批真实桌面Reject发现跨入口终态合同冲突，按用户共享机制横审硬约束纳入本批根因修复，不能只交付批准卡而留下拒绝后的错误。原用户目标、流式/自然参与者/单源/正向测试/原deadline/范围提交同步不变。Root已独立读processor唯一flag读点/所有blocked影响、Config声明、completed-reply谓词、finalizePrompt及真实output-error转换；委托完整证据/入口矩阵在denied-tool-continuation-review.md，Task/child正常入口在task-child-public-entry-review.md。全仓与历史搜索发现源仅Config声明、processor消费、生成SDK及当前05-config文档；该gate在8/7保留基线65d0bfc98已存在，8c23dd0e3加入严格durable reply、fc8d498582抽取当前谓词时仍遗留，来源更早未知，不重建旧记录。权威AI SDK文档[Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)明确真实execute错误成为tool-error并可进入下一模型step；仓库现成toModelMessages的output-error是本次实现事实，不另接库或非流式请求。

可观察真实事实：02 requested per_hLx9HLMTNmA8CrBdDeDd→denied赢家per_g0VXxY1XE00xYDXHhQLd，Tool error已落盘，assistant time.completed1791919599555/finish tool-calls/无assistant.error或真实control结果；SessionWake实际failed，cold board terminal/pending[]，后续截图Not running、原runnerexit0。因此这是错误终态/缺持久回复，不是已经证明的永不退出、UI决定失败或Provider传输失败。原精确user/assistant/call/Project及日志保留。

直接触发/控制根因：EffectiveConfig absent或false的experimental.continue_loop_on_deny使shouldBreak true；真实PermissionAuthority.RejectedError写Tool错误同时设置processor局部blocked；该flag禁用普通/Task-root retention continuation，完成assistant后返回stop；loop.finalizePrompt要求接受原输入的真实settled reply，正确排除无完成control结果的tool-calls，因而报错。terminalizeIncompleteAssistant正确跳过已completed消息，无法补出模型回复。旧UI补投影、成功工具存储、approved恢复、最终文本守卫均未删除这个共享gate，故不根治。不能改finish、伪造assistant、弱化completed-reply或把合法Tool拒绝硬提升整个Prompt错误。

影响面横审已覆盖公开Session同步/async/command、GlobalChat真实SessionWake接纳与同输入重试、Main/SideChat/合法非Task child、CLI/ACP/GitHub/control-message、delegate_agent child、Task根Orchestrator、所有投影worker/专家团、Mission dispatch/wake/recovery、scheduler与continuous goal。均共享Prompt/processTurn；GlobalChat没有另一个GlobalChatOwner，202只是持久接纳，不证明回答完成。compaction的第三processor入口只准备只读证据reader，未证明权限拒绝可达，显式summary/stop合同保持。approved恢复直接工具执行路径有独立已批准合同，denied本来被排除，禁止恢复成批准。静态入口可达矩阵不是每个入口都已运行。

正常/终态/恢复/隔离：普通成功/Tool错误本来进入下一真实模型步；typed park/handoff仅真实完成control tool，保持。真实Prompt取消由同occurrence AbortSignal/ExecutionCancellationError控制，先abort再删除Session/settle取消/等待原producer，删除Tool gate不得越过信号。cancelled/stale给仍live且未abort的Prompt同一Tool error，可自然解释；已abort仍真实取消。旧denied消息已completed，Mission启动恢复只扫未completed，不能声称重启自动修复；显式同message重试可使用唯一原user/真实Tool-error历史取得真实回答，保留旧账本/消息，不回写历史。blocked原本是每processor局部状态、不是全局跨Project状态；任何并行Tool拒绝会结束整Prompt并可能拒绝同Session已接纳的后续callbacks，需正向串行/并行及两Project验证。身份准入、policy、decision/outcome slots、lease、真实效果授权、Provider budget与Task/Mission occurrence均不改。

批准最小生产范围：processor.ts删除唯一blocked/shouldBreak/特定RejectedError停止分支及由此无消费者的EffectiveConfig/PermissionAuthority imports；其余真实failure、abort、compaction、park、handoff、stopAfterAssistantCompletion/retention合同保留。config.ts删除唯一continue_loop_on_deny字段；不只改default true、不加兼容读/平行策略。旧experimental对象已有通用非strict未知key处理，沿用这一现成配置primitive，不加迁移、影子配置或第二reader；当前公开生成/文档同步删除旧字段。新增聚焦真实TCP streaming正向测试（可复用成熟fixture）：实际read→HTTP deny→真实下一请求携带同call错误→模型真实final→canonical reply；含同输入重试、后续已接纳输入/串行、两Project并行denial/allow、真实abort关闭；必要Task-root retention primitive与现成控制结果/取消/approved恢复回归。输入、输出和红绿失败原始证据保留；不新增UI自动化或核心负向断言。

实现后唯一完整SDK六目标生成，核心/SDK/Overlay类型与必要私有build按最终差异执行；05-config/current reply契约、双语Unreleased、索引及docs由Root更新。Root新服务重验Main真实warm Reject→Tool error→模型回答与无错误终态，SideChat/child/Task批准/拒绝入口及切源在真实页面按实际可达完成；必要新Sol仍原完整配对/精确模型/流式/600s预算。未测入口、已completed历史自动恢复、Question重连草稿及大Board性能明确不宣称。所有本批自有生产/测试/生成/docs最终合为同一范围清晰提交并正常上游同步推送，随后进入下一批。


## Root最终真实验收与交付边界（2026-10-14）

### 完整实现与聚焦正向检查

唯一Permission Request schema、canonical requested时间、必有pendingPermissions快照、真实Terminated通知、Task不可变ledger校验后现成invalidate、Main/Side共享adapter、提交前捕获原source/目录/selection authority已实施；Question公开合同不扩围。Board完整可见JSON一次物化并计算真实HTTP弱实体标签，同一物化返回200或由当前Hono中间件处理304。移除旧Board聚合计数签名。原Tool拒绝host停止gate和continue_loop_on_deny配置删除，真实Tool错误进入下一流式模型请求；保留真实abort、typed control和完整reply准入，不修写旧completed历史。

正式后台原组9文件71测试/301断言；deny组含9文件89测试/297断言，其中7相关文件79/247（Task-root多步3/7、精确取消4/9、approved恢复8/25、Tool settlement10/22及控制/producer/activity）。两组含重复，不相加为总覆盖。warm canonical summary组Permission8/39＋transport1/4，共9/43；SDK后原公开合同重复10/50；Bun matcher原错误已保留，clonefix后TCP3/30重新通过。前端两个纯transport/state文件27/66及renderer-surface检查通过；没有源码文案、DOM、组件、snapshot、Playwright或像素测试。最后当前共享工作树重复结果另见归档final-root-recheck，不将重复次数当新增覆盖。

最后四个正式文件重跑22测试/113断言、runner16987 join0。core首轮56306在20:31:19–20:32:08UTC join2：另一任务当时正在编辑的compaction.ts:97报TS4114，LLM将可空maxOutputTokens传入number合同。原日志/退出/失败后观察输入保存，但当时没有原子源码快照。后续把旧97行解释成当前data缺override是错误归因，明确撤回：NamedError基类没有data字段，当前data无须override；20:37peer已经补name override和实际maxOutputTokens默认。20:50正常push声明typecheck八包全cache miss、52.057秒全部通过，80384按同一包声明/同一TS5.8.2/cwd/tsconfig在20:56重复join0；当前源前后观察一致。Root未覆盖peer文件。SDK工作树后来出现新Provider schema生成差异；Root提交只应用已保存402完整生成事务两文件patch，保留后来其它SDK差异，不整文件纳入本批。

完整SDK生成六目标事务已join0，所有stage/build/backup与generator owner关闭。唯一tracked SDK变化为types+83/-4与OpenAPI+311/-4；旧Config字段删除由唯一生成器产生。核心/SDK source/实际published declarations类型通过；最终Overlay types与Node私有构建通过，全部owner已join。实际使用ui-after-final；真实Sol02把它复制到自己Native exe相邻ui，原Sol01旧UI移到自有ui-first-allow-01保留。未覆盖共享dist、未新建branch/worktree、未启用用户Browser。

### 实际桌面与消息证据（原JPEG人工查看）

| Scope | 真实路径和结果 | 明确限制 |
| --- | --- | --- |
| manual-before-05 | 原Main Ask只有Running/无决定控件，展开read同样如此。 | 父owner最终清理；原child自删SQLite-shm发生EBUSY/natural1，保留。不是正常Native成功。 |
| manual-after-01 | 英文Dialog/inline、重载后重新选择原Session恢复pending，实际AllowOnce，read三行与真实流式provider reply2/stop。 | 受控Provider；首次Escape重载时重开原因未知，稳定后Escape正常；未称真实Question重连。 |
| sol-after-01 | Native Bun1.3.14，配对preflight usable/projected/exact gpt-6.1-sol/stream；中文Dialog本次允许，requested→allowed_once→execution_started→execution_succeeded，模型正确读取CEDAR402/Maple3/Iris4/合计7并引用文件。 | 本次允许，旧第一次UI。5个累计200/EOF请求含preflight/helper，不是5业务turn。原Target1852/Host47908 natural0，全部drain/请求/配对复制清理。 |
| manual-after-02 | warm正文被transport诊断summary覆盖，实际Reject后真实Tool denied、assistant tool-calls completed，SessionWake MissingDurableReply，最终Notrunning/error。 | 两个本批根因的原失败，不称成功或永久Running。 |
| manual-after-03 | 真实Question自定义输入Public 402 draft Cedar并提交，真实question答复/模型stop；独立SideChat root正常用户消息/模型stop。 | 只验证草稿输入/回答，未真正重连Question或草稿保留；Side普通消息不是Side权限。 |
| manual-after-04 | 旧缓存warm Side正文错误，关闭/reopen读取mandatory快照正确read(read_local)，实际Side AllowOnce、read/自然reply2。 | pre-summaryfix缓存，不称最终warm成功；完整三行当时部分在composer下方，HTTP/AX可核但图片未全呈现。 |
| manual-after-05 | 最终UI、隔离语言切换与Settings实际500；原服务在closeBy20:15:08.331Z正常停止，页面20:15:55.344Z才关闭。 | Root未完成批准且违反自己页面关闭预留；保留未完成/时序失败，未延deadline、未真实Sol。outer10QXEp/PID88776均已移除。 |
| manual-after-06 | 新页列表/work-ledger等500，SyntaxError运行时Provider导出缺失；保存错误截图，页面20:17:19.096Z关闭，原PID89100 natural0/outerNEHfNu删除。 | 三个Provider文件正在另一任务未提交修改；HEAD三者自洽，此进程先载旧operations后惰性载新route。当前磁盘补齐后fresh07通过；不改peer导入、伪称HEAD缺件或热修旧owner。 |
| manual-after-07 | 最终Main连接后release真实warm read，Dialog及inline均canonical read(read_local)，实际Reject→真实Tool failure→provider reply2/assistant stop→Notrunning，截图与原HTTP事实保存。 | Root两次checker错猜history camelCase/Tool.state.error；真实字段为snake_case/request_id绑定及Tool.state.failure.message。原输入/输出保留，显式saved-facts checker修复并通过，离线核对不是新E2E。PID86152自然0/parent清理。 |
| manual-after-08 | 公开API真实parent child-one/child-two并行stream；父会话连续Dialog先Reject再AllowOnce，两个child各自真实reply2/stop。UI创建独立Side root，公开可见用户输入显式side模型，warm权限canonical summary/AllowOnce→实际read三行，滚动后原图完整可见＋Sources/自然reply2。Task research-studio公开202，唯一board Permission answered/allow_once，现成Task Dialog含AllowforTask。 | 非实际delegate_agent调用；Side独立根parentID为空且sourceSessionID精确，未称child权限属于Side。Task外部D文件被C进程根TaskProcessBoundaryError拒绝，随后fixture普通文本缺真实调度control，active epoch1/idle/exhausted semantic_limit，未Task completed。早期Git基线错误和Memory空正文仍未知。 |
| sol-after-02 | 当前final source/final UI，Native真Sol精确preflight，实际英文Dialog Reject，per_h756VGiw2YWYJ5RFN9NT requested→denied，Tool明确拒绝；真实assistant msg_g0VXxnMDQ00HptnHsJ0T中文尊重决定/finish stop，Root人工查看原图。canonical checker0，累计5请求均实际gpt-6.1-sol/stream/200/EOF。 | 英文产品UI＋原用户/模型中文原文；不据模型自述推执行事实。原Target43048/Host43800 natural0，output/request settled、端口释放、auth2194B/models9155406B复制均removed/presentAfterfalse；原exec24600 join0在deadline1791923770626前。PowerShell脚本不保证设置LASTEXITCODE，原空exit文件保留，实际exec0与production physical receipt单独存证。 |

所有成功/失败Scope互不替代，只有自有隔离页面和服务；manual与真实Sol区别明确。截图保持FF D8原JPEG，不重新编码/裁切。原启动工具链修复、首SDK/末SDK、温热正文红绿与deny红绿均保留原输入/输出，不用源码摘要、换行或自算期望当功能门槛。

### 横审、风险与下一批

Settings /expert-squad/catalog与skill/mounts两个500为active Base完整投影要求其manifest Browser，而受控global配置明确禁用Browser。NativeChat的disabled空MCP投影合同不同；目录不是遍历inactive包，resolver/manifest/routes/mounts均无402差异。历史702e030d4禁用时拒provider替换合同保留。研究工作Task明确选已内置ResearchStudio，能力只有普通tool/platform sets，无需启Browser或虚假fallback；真实202已证明接纳，但不能证明所有Task完成。

Task边界、typed-control与文件guards横审覆盖全生产调用、Task/Session/Mission/worker、epoch/正常/终态/取消/恢复/串并行/多Project；实际Task AllowOnce不改变Task root authority，因此外部文件错误合法。其受控模型没有真实orchestrator调度决策，exhausted/semantic_limit是正常边界结果，不伪造completed。早于权限的Git HEAD '$GIT_DIR' too big与受控Memory空markdown独立记录未知根因，下一批先调查，不用本批permission修复解释。

未满足的扩展验收：Work/Mission各自桌面入口、真正Question reconnect/draft、真实Task全链完成、queued输入与全入口排列、大Board性能及cached Brief标题失效、已completed历史自动修复均未证明。已验证的是上述明确入口和同源数据契约，不能宣称全部模式/恢复/性能无缺陷。公开完整Board tag忠实已有可见Brief缓存；Task title变更200真实新title已验证，旧Brief缓存另列候选。

公开产物及准确输入/输出见[402归档](../../artifacts/2026-10-14-standalone-permission-projection-402/README.md)。仅明确allowlist公开日志/夹具/差异/报告和原JPEG，排除运行目录、数据库、auth/models内容、二进制/UIbundle、peer全仓diff与真实Provider raw payload；Native只保存已审计公开身份/reader/预算投影。当前Git交付完成后另补精确提交与push事实；Goal仍active，持续下一批。

### 已提交与正常推送首轮（2026-10-14）

实现、当前架构、实质双语Unreleased、原485公开产物/31原JPEG已提交`b3958bebfd9728c43c42c8f7ba4b9d9af53beb72`，527文件、8072增/289删。临时Git index只含本任务精确code/tests/spec与共享文档hunk；SDK从原完整生成事务patch应用，peer后续SDK/生产改动保留。Windows首次Git add全部文件名超过命令行上限ENAMETOOLONG，原输入/log保留；按本机git add帮助改用NUL pathspec文件，重跑原范围check/准备/正常commit通过，未缩减交付或绕hook。

fresh fetch/merge上游已最新，完整pending集合只有b3958bebf且diff-check0。正常push原43534失败：声明全仓types八包实际全部cache miss/0，随后api:routes-check发现当前另一个任务刚增加ProviderConnectionTestResult.output而生成OpenAPI尚未对应；此前docs:check也见同任务新Provider error schema的API文档差异。两种原失败/input/output分别保留，未Root伪补peer schema、未no-verify、未创建worktree规避。当前核心已复验0，API/文档生成需按其唯一事务收敛后重跑并重新fetch/merge/完整pending审计/正常push；尚未宣称远端交付成功。新增证据/归因更正在归档delivery-review，旧错误报告保留为历史。
