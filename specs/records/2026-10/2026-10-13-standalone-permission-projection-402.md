# 402 Standalone 会话权限批准投影

## Recall

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
5. scope资源正文按当前Request.scope整体呈现，技术细节不从`scope.paths`猜；公开paths实际在scope.resource.paths。不能建立模糊双形状兼容。对合法cancel/stale而没有replied事件的状态，由现有当前会话recovery/hydrate重新读取authoritative pending集合收敛；Session移除/换source仍沿现有reset。必须在后台取消合同中核对实际事件触发重读，若缺已知恢复通知，先报告补齐同一ledger投影的必要边界，不擅自新增第二套permissions.changed事实源。

### 精确候选文件与协议同步

后台：engine/model.ts（两个公开schema与复用Request）、protocol/session-mirror.ts、server/routes/session.ts。前端：services/conversation.ts、services/tree-writer.ts、services/side-chat.ts（复用normalizer），必要现有共享interaction工具模块；InteractionCard与reply service行为预期不变。Request schema目前位于Authority namespace，engine/model已采用`question/types.ts`轻量schema先例。若直接引用Authority引入运行初始化环，推荐把当前Identity/Mode/Request与其ProviderKind数据schema**搬入一个轻量permission/types.ts单源**并由Authority/invocation重导出，原定义同时删掉；不得复制一个第二Request schema。该必要性在实施前要以具体import环/类型检查反馈root，不以猜测提前扩文件。

两个新的公共pendingPermissions数组需要按现有SDK generation transaction更新`packages/sdk/openapi.json`、`packages/sdk/js/src/gen/types.gen.ts`及实际生成发生变化的SDK产物；消费者全仓搜索SessionConversationHydration、SessionConversationConnectionSnapshot、SessionConnectedEvent，范围包括Main、SideChat/Subagent snapshot解析、SDK调用与后台Session事件检查。只按当前生成脚本发布一份schema，不手改生成类型骗编译。由于本推荐不新增timeResolved，PermissionRequest/permission.reply既有API及ACP/CLI的调用体保持；若生成器显示其它无关漂移需拆分审查，不能并入402。

### 聚焦正向测试与真实页面门槛

正式后台先红后绿：真实Authority pending→GET conversation.pendingPermissions；已有pending再订阅SSE；live asked与snapshot同request/time/orderKey；断线期间实际allow_once/deny后重连snapshot返回当前集合；同会话多request与两个Project过滤；真实Task请求只出board.interactions一次；正式cancel/delete真实决定后会话快照收敛。产生状态走正常public Session/受控流式Provider与Authority，不直接写fakecompleted消息。请求排序和完整数组schema属于正向公开协议，不做UI源码/DOM/快照测试。相关ACP/CLI transport、Task交互/permission恢复的正向合同与核心/SDK/Overlay typecheck按实际变化复跑。

真实UI只由root直接交互/截图：GlobalChat冷/warm pending、切别Chat回返、重连后的pending与已答移除；确认本次允许后原read完成与模型答复；Work/Mission共享代表、Task既有入口与SideChat自身路径回归。界面事件关联原requestID/Project，不用额外手工API批准冒充UI成功。必要exactSol fresh scope需403正常关闭路径已可验证，仍原600s/20requests/180s无活动、两分钟页面窗口、deadline-60s主动close。上述为可审实施方案，不是已实施/验收。
