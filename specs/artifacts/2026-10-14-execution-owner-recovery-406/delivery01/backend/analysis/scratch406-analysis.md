# 406：Task Question 与 Permission 原执行 owner 恢复（只读建议）

## Recall 与范围

用户持续目标要求并行体验、根因分析先落规格、有证据修复、正式正向测试和真实验收，全部共享调度/恢复/并发/终态异常横审。Root 在405真正 Task red04与双活 live01后，要求下一406把 Question source发现/物理执行恢复与 Permission execution settlement 同一共享问题完整分析。**当前仅只读和本 scratch，未改生产、正式测试、spec、公共协议或SDK，未再启进程/服务/模型/浏览器，未委托。** Root先收405交付，再据本稿落406 Recall和精确授权。

已重读405 spec Recall与末尾授权、405 analysis/红态/当前架构 security-permission、02-data、03-control、task-control-plane、原404冻结Question恢复调查。新的定义/调用搜索见 `callers-permission.txt`、`callers-question.txt`、`tests-current.txt`；22组生产文件逐行选段见 `source-excerpts.json`（task-root-ingress-delivery追加独立扫描段，因此文件条目有同路径）；精确旧代码见`history-excerpts.jsonl`，原scope因果选定对象见`live01-causal-facts.json`。当前相关authority/question/interaction/control-lease/process-liveness相对HEAD无工作树差异，`analyzed-source-working-diff.patch`为空；读取HEAD `fedd04743bd2b936c9cbec18a1db399f1983efbc`。这只是当前源码定位，不用源码摘要冒验收，也不把未抓取的运行时lease行用源码反填。

405的所有证据在其独立目录和已冻结allowlist。本文与其候选方案不混入405归档。原5个scope均完全退出，original exec69526实际join1。

## 真实事实分层：三个问题不能混为一条“已通过的红测”

1. **普通Task死owner red04：正式0/1/13。** public Task202、Research Studio catalog/mounts200、自然baseline成功、精确Question Permission public AllowOnce200、原Tool/assistant.activation→lease→runtime_process→OS exact_live。原producer83728真实exit23并join；新65960正常Host恢复且oldOS dead_or_reused。原Tool真实 `ProcessExecutionInterruptedError`，time.end1791935846811（恰等原leaseexpiry，但死亡另有OS观察），Question `que_g0VXydjbi00suv3952UA`及Board仍pending，无terminal。第13断言失败；第14 Board断言未执行，Board pending仅独立API观察。exact Asked已经materialize，不是source-only证明。
2. **双活Question live01：原API集合错。** A PID86572、runtime occurrence62e6355f-0f33-4cda-a0ec-afc657ac92a8仍exact_live。B PID68708/occurrence6f31006f-11be-411b-8feb-623e042582c9正常同runtime bootstrap，公开 `/question` 完整返回A原 `que_g0VXykEQe00vD1YaYAO0` 加真正B control `que_g0VXykG1o00CATWZiooI`。B control由公开root Session/message和独立controlled streaming Provider产生，PromptOwner精确B；public reply200→真实Tool答案Maple→自然assistant stop。原完整集合断言未执行，不能标为正式红断言通过；这是保留完整对象的实际API观察。
3. **双活Permission live01：真实执行者的结果被恢复者抢写unknown。** 原request `per_hH5RlBJY02BuIhy7nBef`，attempt `per_h7QpS5pCf0kh4Bt0jMFu`。readonly原ledger四行时间为 requested1791937284978→allowed_once1791937285021→execution_started1791937285252→outcome_unknown1791937290052。B stderr59–61明确是自身 `permission.reconcile-interrupted-attempts` 阶段写unknown。A仍活；A自己 Question reply200、Board answered/Cedar/time1791937291555后，原Tool于1791937291757报 `SQLiteError: UNIQUE constraint failed: permission_ledger.outcome_slot`。Question答案已持久，失败的是实际Permission执行结果/Tool结果收敛，不能说用户答案没有保存。

live01正式 **0/1/1**，唯一expect为exits期望[0,0]实际[1,1]；后面所有assert未执行。A completed轮询看到真实error后30秒超时、普通stop自然1；B已回答成功但等A-answered标记至原reserve后普通stop自然1。父184.038秒结束；双child+父physical/output/request全部true，两Providerclosed、原runtime在物理退出后删除。原完整事实见 `../.tmp-task-question-recovery-405/live01-summary.md` 与 scope内原files。scope关闭前只读抓到permission_ledger四行，**未抓到effect lease原行**，所以其actual effect lease ID/owner未知。不能以这是检查器收尾失败抹掉已成立的实际错误链，也不能把独立API观察称已执行正式expect。

404 source-only red03另有价值：原Asked已commit而Interaction不存在，新bootstrap可以materialize Board但Question[]/reply404；它是直接固定ID/Task fixture，没有真实Tool/activation物理链。因此只证明source枚举/物化缺口，不证明可重建某个ordinary Tool调用栈。

## Permission 根因、旧路径与单一事实来源

### 当前控制流

- `authority.ts:903–970` 校验Project、descriptor、policy及canonical Request，调用authorize。`requestFromRow:463`从唯一requested恢复完整Project/Session/message/call/provider/scope/time；其他ledger行仅delta，不能直接读它们的nullable project字段作owner。
- `authority.ts:1051–1080` **先独立append execution_started，后独立acquireEffectLease**。两事务之间已有started而没有执行owner。对同request的重试通过deterministic attempt和唯一start槽相遇。
- `acquireEffectLease:296` 把新 `Identifier.ascending("call")` 存为effect lease owner，targetID为exact attempt；这是logical call标记，不是physical runtime occurrence。120秒lease/30秒renew不能证明进程死亡。
- `executeUnderEffectLease`只覆盖execute；`completeExecution:395`同事务assert exact effect fence、存durable result、写唯一execution_succeeded、release；error分支同样appendEffectOutcome+release。真实执行者这些正常结算检查本身有意义，不能为放行本红而去掉唯一约束或吞掉冲突。
- `reconcileInterruptedAttempts:1676`选**全库所有execution_started**，检查已有outcome和`currentTaskForAttempt`（这是MCP协议task，不是Engine Task），随后直接append outcome_unknown。没有Project过滤、effect lease、原physical owner或OS观察，也没有把检查与写入放同一CAS事务。
- 两个生产触发点为`authority.ts:159` lazy Instance state init、`project/bootstrap.ts:134`显式恢复stage。`InstanceBootstrap`先EngineInteraction恢复，再Permission扫，再Task-control；新backend或同backend打开另一个Project/刷新Instance也可触发，不代表原执行backend已经退出。
- `resumeApprovedContinuations`另有正确project filtering和SessionPrompt物理准入（e08017392），但它在后续Instance release阶段，且live01的unknown让continuationReady=false、replayed0。它不能修复此前恢复扫描已写错的终态。

### 历史证据

`43636df96`（2026-08-12）已引入同样全库started→缺outcome/MCPtask→unknown扫描。`627146cc3`（2026-08-15）添加effect lease与随机call owner以及正常outcome fence，没有把reconcile接入它。`e08017392`改善Permission续步的真实Prompt owner、Mission恢复、退休收敛，未修改这条前置扫描。`b3958bebf`（402）只改变canonical Requested注册/time及projection/denial继续，不产生此无owner unknown路径。当前security-permission架构既写“started without result becomes unknown”，也要求“live peer retains physical authority”；实现漏掉了真实interrupted的前提，不能拿前一句解释为允许终态活执行。

### 影响矩阵（源码覆盖；仅标明实际跑过的格）

| 入口/情形 | 共享路径与影响 |
|---|---|
| Main/GlobalChat/Work/Side/非Task子Session、CLI/ACP/channel/scheduled agent调用 | SessionLoop三个withTaskToolInvocation路径→唯一authorizeAndExecute。只要descriptor为permission-bearing，Ask或full_access都建started/effect；另一个Project/Server启动可抢unknown。ordinary builtin Question可无descriptor，不代表其他外部读/写安全。 |
| Task-root/worker/Expert Squad、Mission Session | 同wrapper和ledger，TaskID仅owner元数据；不是MCPtask因此不会被`currentTaskForAttempt`保护。live01实际覆盖Task-root projected/question。Task terminal/reopen不能授权重放旧effect；其精确message/call/attempt保持原轮次。 |
| MCP同步工具、插件/Skill/Browser/Computer/外部投影 | 同wrapper；普通非MCPtask结果都受影响。即使效果实际完成而result尚未提交，peer错误unknown也能阻断本owner合法提交。 |
| MCP App人工工具 | `interactive-artifact/mcp-app-host.ts:327`直接调用authority，真实Tool Part在原artifact Message下；不保证有当前SessionPromptOwner。因此不能凭Session当前owner补救effect owner。 |
| MCP durable task | 唯一mcp_task_created/status记录提供exact server task接续，reconcile目前跳过。其effect lease重新取得/handback仍须physical owner与same-attempt fence；不能改变为普通unknown或重复callTool。 |
| 普通成功/失败/abort | 原completeExecution/appendEffectOutcome是唯一terminal writer，保留result+outcome原子性、originalfailure和lease release。正常abort是否存在外部效果仍按原MCPtask合同，不根据abort字符串猜失败。 |
| 同ID重试/两个caller并行 | unique execution_started只确定一个attempt，不证明owner；当前start/lease间隙及恢复CAS缺失会出错。修复需原单一admission事务，不能增加in-memory锁作权威。 |
| 两backend同Project | live01真实证明错误；A成功Questionreply与B真实control均成立，A最终Tool被unknown占槽破坏。 |
| 同backend串行打开第二Project、两个Project并发 | `starts.all()`无Project限定且requestFromRow不限定Instance，代码路径可写foreign attempt；实际双Project过程尚未跑，不能宣称已验证。 |
| Server/CLI restart、managed/native、普通Project open/refresh | 最终均进入同InstanceBootstrap/lazy state，修唯一authority而非某CLI/HTTP入口。只改变启动顺序无法保护后续Project open。 |
| 已有terminal、retention/deletion、手工reconciliation | 原immutable outcomes、execution_result及requested owner始终保留。已被历史错误unknown占槽的记录不能自动覆盖为成功；外部效果未知仍须原显式reconcileExecution合同。 |

### 推荐最小Permission修法（尚未批准）

只改`permission/authority.ts`内部执行权威，不改generic control-lease、ProcessSupervisor、schema、配置或公开Request。复用`engine/process-liveness.ts`的 `joinProcessLiveness`/`observeProcessLiveness` 与原exact effect lease：

1. **真实physical绑定。** effect lease.owner_occurrence_id取当前runtime occurrence，并在执行owner存续期间持有现成liveness reference，使用原runtime_process receipt记录PID/processInstance；lease自身ID保持独立，targetID仍deterministic attempt。reference在所有正常结果、失败、MCP handback、竞争未获得lease路径完整release，不能只在execute结束就释放而让结果提交脱离owner。
2. **start和owner同一次写入。** 新attempt通过原immediate transaction重验canonical request/decision/attempt/start，原effect lease取得与唯一execution_started提交原子化。并发loser读取已存在canonical start/outcome转原existing-attempt路径。这样没有started但新合同owner还未落盘的窗口。无需另建owner表/cache或复制Request。current effect lease由exact attempt target定位，是现有唯一winner；不得用最新SessionPrompt或最新Task activation替代。
3. **按原Project选事实。** 恢复查询复用`permissionRequestOwnerBelongsToProject(Instance.project.id)`，以requested owner SQL限定，再选未terminal starts；不是仅在JS末端滤nullable delta.project_id。sameProject多个Session仍按原attempt独立。
4. **先原事实再OS再CAS。** 读取exact attempt当前effect lease和其physical receipt，在事务外观察OS。exact_live、unknown_live或缺少合法physicalreceipt都保留未terminal并返回/记录明确诊断；只死亡/复用才有interrupted证据。进入immediate transaction重新比较同一start、same lease ID/owner/current fence、MCPtask状态及outcome winner；原outcome已经提交则返回原事实，原owner/lease改变则重新观察而不是写unknown。真正dead且无MCP接续才能按唯一原outcome_slot写unknown，并同事务结算原lease。不能以忽略UNIQUE冲突、onConflictDoNothing后谎称成功掩盖错owner。
5. **MCP接续保持原合同。** 原exact MCPtask handback是实际持有者放弃当前effect lease，不能把“runtime还活”当所有明确已释放MCP task永远禁止接续。必须同读原lease/grant/release事实；新owner只接原server task。opaque历史lease或无lease的旧started不能从到期、Map为空、当前Session变代推断死；保留unreconciled和原数据定位，明确未知。若必须对这些旧记录自动恢复，需要另行授权数据维护，当前没有足够事实。

单加`if lease.expires_at>now return`不足：过期的live owner并不死亡；单加`SessionPromptOwner.current`也不足：MCP App没有Prompt且Session可进入新轮次。只把old unknown错误改成retry同样会重复外部效果。旧epoch结果合法结算仍遵守原已接受effect合同，不改Task调度策略。

## Question：唯一source、普通Promise与durable A2A必须分开

### 当前问题与已有正确primitive

`Question.publicationFacts`按exact Project/Session/request和原四terminal schema读取唯一Asked+实际terminal occurrence，404已统一live/cold/terminal-first。`projectQuestion`是Task Interaction request/outcome/userInput唯一单事务writer，保留原time/answers/origin/source。`Question.pendingSnapshotReader`表示本backend的实际物理pending。

但`EngineInteraction.reconcileRecoveredPendingWaiters`只枚举**已有Interaction**，在projectQuestion后无条件`Question.restore`；后者装`waiters:[]`、durable=true和timer。它没有实际Tool调用栈或Prompt/Task execution owner。live01实际B有A请求正来自这条路径；任一B timer还可能到期生产同原Question terminal，故不能只在GET/question过滤其展示。

`Question.ask`普通Tool/Task question/analyze_intent/panel均有真实Promise；进程死亡后无法恢复JS调用栈。A2A唯一生产fixed ID分支在`orchestrator/tools.ts:1902`，有deterministic action/Asked occurrence、exact Tool binding和同事务`assertActiveAgentCoordinationActionInTransaction`；`SessionLoop.recoverInterruptedAgentCoordinationPart:2619`按原running respond_agent_coordination重新进入同工具/action，是真正可以重接的continuation。恢复不能把二者都套empty-waiter。

### 唯一source发现与物化

在Question现有publication-facts边界增加一个accepted Asked页面reader，按project_id/event_type与稳定(time_created,occurrence_id)页游标，每页64，返回原完整Request/askedOccurrenceID/现存terminal；**从outbox原接受事实读，不能仅unfinished delivery**，因为Question仍pending时其Bus投递可能已完成。原outbox没有publisherPID；不将Bus logical occurrence当physical occurrence。

`EngineInteraction`现有bootstrap reconciliation首先遍历该reader、按真实Session ancestry/Task Project映射调用同projectQuestion，然后继续Permission/direct activity gate原分支。late Asked/terminal仍同subscriber。已有terminal立即投影原terminal，不建waiter；pending普通Source只物化Board，不推导可回答或执行接管。原Task-control可在materialize后按原owner发现请求重检，不引入全局Bus drain gate或每Project无条件restore。

删除旧Project-only `Question.restore`调用与仅为其服务的“所有Question retainedRecoverable”结果/分类。若A2A重入原ask足以安装真实Promise，删除通用restore入口和其过期空waiter测试，不留fallback wrapper。`recoverableAgentCoordinationQuestion`目前在restore之后才查action，且不决定是否恢复；应删除这套平行分类，让原A2A工具继续唯一验证action/epoch/Tool。

### 普通Question真实中断的终态

在**原执行owner已被精确证明死亡或原本地owner正常结算**且原Tool确已写入合法ProcessExecutionInterruptedError的边界，按同Project/Session/message/call读取绑定的accepted Asked；其terminal若已经存在必须保持原payload/occurrence/time，不能再生成Abandoned。否则复用唯一原terminal writer发布infrastructure，timeResolved取**实际已提交Tool outcome.time.end**，不另取当前时间或从leaseexpiry凭空造终态。不得把整个Task普通文字当typed completion。

恢复还须处理“Tool interruption已commit、Question terminal前crash”的cut：accepted-source重检必须可看到该Tool真实terminal并使用原end补齐同一个terminal，不能只在新updatePart后做一次内存effect。原terminal lookup与new terminal接受应同一writer事务，竞争用户reply先赢时保留真实reply而非冲突重写；物理waiter若仍属于本owner应按原terminal结算。

### 全部原owner入口不能只以函数注释放行

| 入口 | 当前原事实与所需准入 |
|---|---|
| Task-root ordinary Question | Request.tool→原Message.activationID→exact task_root_ingress lease→lease.owner_occurrence_id→runtime_process→OS。`terminalizeExpiredTaskRootAssistants:992`当前只按expiry选Message，未核OS；应在该原caller补exact live/unknown保护，再调用共享terminalizer。过期只表示写fence，不表示物理死亡。 |
| Task worker | 原Message/accepted user/WorkerTurnDescriptor→exact DispatchLineage/delivery_owner与dispatch_admission；沿`dispatchDeliveryOwnerRecheckAt`的已实现OS/本机真实registry合同。不能取该Session最新lineage。`recordAbandonedDispatchSettlement`已控制原Tool中断；必须携同一原消息/派发事实给Question结算，不能泛扫历史Question。 |
| A2A ask_user | 原action/epoch/Question/Tool、exact owner与原acceptanceEffects。只通过现成recoverInterruptedAgentCoordinationPart重入原Tool；先物化原Asked/Interaction，才能复用原expiry/time而不创建不同Request。若已经terminal，原action按真实答案或拒绝/到期结算。 |
| Main/GlobalChat/Work/Side/非Task child | 404当前physical pending+SessionPromptOwner准入保持。不得把新Task source扫描扩成普通Session“恢复所有Question”。正常当前请求仍可public200回答；旧accepted历史仍保留。 |
| Mission | `mission/process-recovery:340`已按lifecycle lease、原dead owner/exact frontier及wake write-ahead调用shared terminalizer。不能先由generic Session start消耗Mission原dead证据。Question收敛使用此实际原Tool结果，不另添Mission恢复协议。 |
| panel_create_work/mission前确认 | Question属于原caller Session，未来Task/Mission尚未创建。不能从后续目标推其Question恢复权威。 |
| compaction helper恢复 | SessionLoop:583同session_control exact source user/control lease，通常不是Question producer；不把这种helper时间授权为任意同Session Question。若实际未来存在QuestionTool仍必须原Tool/owner事实，不用新工具名白名单教LLM。 |
| normal stop/dispose/deadline/operator reply | 本物理owner继续原四terminal+slot合同，不以shutdown等同进程崩溃。真实deadline timeExpires/timeResolved不改变；已有terminal先胜。 |

Task-root 额外必须随同原caller核查：`reconcile`循环1868在terminalize返回0后仍会进入reducer；reducer383仅以未到期lease维持leased，后续可能ready/exhausted/reconcile_required。故**不能只给terminalize函数加一个live分支然后返回0**，那会继续让下游按过期lease归约。精确live/unknown必须反馈到同一Task控制扫描的既有有限recheck/physical-owner分支，让这一轮在真实owner未结算时保留当前authority；复用原heartbeat与wake集合，不新增超时/队列/LLM流程gate。已经由immutable assistant/effect receipts证明原activation consumed的正常后继准入保持原contract。当前live01没有等到Task lease expiry，属于源码证据与必须覆盖的正向边界，不能称已实际复现该后继问题。

### durable标志与旧数据

当前`durableContinuation = input.requestID !== undefined`过宽。production唯一需要跨进程的A2A已有`acceptanceEffects + acceptanceOccurrenceID`成对检查，且effect同原Ask接受事务验证真实active action。建议在原ask内把“可保留的durable pending”严格收敛到**已执行成功的该owner-admitted acceptance**，而非仅传fixed ID；这不新增公共Request字段、不靠ID前缀或工具名猜权威。只要未来其他producer需要durability，必须同样提供真实已持久continuation准入，不因RequestID就获得它。需要用实际A2A checker证明恢复时间/expiry不变后才删除旧restore。

无Tool、无原physical绑定、opaque历史输入（404red03）只有source/Task locator，无法无损恢复ordinary Promise。保持原Asked/Board并明确missing-continuation-authority诊断，不造Abandoned、不装空waiter、不据Map空猜globaldead。原red03依然是未满足要求，不改成404预期冒修复。如产品要求无绑定输入自动可答，必须另立接受时唯一continuation/owner持久合同，Root额外规格授权后再做。

## 建议最小生产文件与删除范围（未获实施授权）

1. `permission/authority.ts`：上述唯一physical effect admission/recovery/Project filtering；复用现有process-liveness/control-lease，保持所有正常/outcome/MCP结果合同。
2. `question/index.ts`：同publicationFacts的accepted source reader、exact原Tool interruption terminal、原owner-admitted durable标志；删除无owner restore，增强原terminal writer的已赢家重放准入。不新增timer/cache或第二terminal数据。
3. `engine/interaction.ts`：source-first projectQuestion；删除unbound restore及平行A2A分类/旧结果承诺；保留Permission与direct控制gate事实。
4. `project/bootstrap.ts`：仅按最终同一reconcile返回合同改名/诊断时必要的单一调用调整；不能加“先阻塞Bus直到所有投递完成”。
5. `engine/task-root-ingress-delivery.ts`：原Task-root expiry caller核exact physical death/live/unknown；worker如需将已获权的exact派发事实传给Question结算，只在原路径内，不能放宽普通Task admission。
6. `session/loop.ts`：原ordinary Tool interruption后的same-source terminal收敛与retry cut；保持现成A2A、recoverCompletedToolResult、dispatch/panel/scheduled效果恢复顺序，不扩大真正可重执行工具集合。

若实现需要变更Question公开schema、storage DDL、SessionPromptOwner、Mission协议、ProcessSupervisor或新增通用recovery框架，**暂停并给Root具体缺失事实**，本建议不隐式授权。既有control-lease/channel ingress其他effect调用共享基础表，但不使用Permission ledger，不能顺手改变其所有权语义。

## 聚焦正向验证建议与交付限制

先保留现有5个scope原source/错误，不复写。正式新增的后台真实process checker须覆盖：

- 原red04同真正public Task/Provider/Permission/Question，生产120秒lease、原Asked窗口，death另OS证实；重启原Tool interruption+Question infrastructure+Board同terminal/time，原Asked/Tool identity保持。
- 双活sameProject同live01，A原Permission开始后B正常bootstrap；B真正独立root control组成完整正向canonical集合；A自己的reply200、Question/Permission execution_succeeded+exact durable result+Tool完成；B自己的reply200+Tool/naturalfinal。父在断言前先真实双方答复/完整收尾，失败不能只留exits而丢原facts。
- 新同DB两Project串行open和并行backend，真实permission-bearing Tool由各自owner运行；完整每Projectledger/result集合与API归属、两边实际结果，不能用“未写other”负向核心代替正确全集。
- 同request并发与重复输入按唯一start/result收敛，正常失败/abort/owner handback；原error类别/receipt明确定义，不能镜像内部function调用次数作核心。
- 真dead effect→unknown、OS unknown→明确unreconciled、旧opaque/missing→明确未证明死亡诊断；原已commit result重启物化同Tool而不重执行效果（用实际原结果/receipt验证）。
- A2A真正accepted-but-unmaterialized→源先物化→exact action/owner恢复原Promise→public reply200→原Tool/action/outcome；四terminal已commit cut保持原时间/答案/userInput；普通/worker/Mission/Task reopen/epoch superseded按各自真正权威验证。不能用fixed-ID普通fixture宣称A2A全链通过。

复用正式Bun1.4 isolated runner/成熟controlled streaming Provider/NodeProcess owned_tree/managedtmp。原已批准模型fixture只给公开数据；每freshscope父600秒、child180、HTTP30、留60结算，不延时等待目标通过。现有直接套件优先question-publication-projection、question-process-projection、question-process-recovery、engine-interaction-recovery、permission-continuation-recovery、permission-two-mode、session/permission-message-recovery及settlement、session-loop-tool-authority-integration、control-lease-settlement；改动触及的旧restore fixture按新正向owner合同替换，不全量bun test、不运行UI自动化。

当前没有生产实现、正式绿测、上述新406scope、真实模型或视觉验收。UI/必要Sol在source/正式后台收敛后Root另行组织；405已完成的界面历史/Side恢复不证明这里的Task/Permission恢复。所有未知旧记录、跨Project实际未跑、A2A/worker/Mission过程未跑及effectlease原行未取证均保持显式边界。

## Phase P 实施前设计附录：仅 Permission authority（Root待规格授权）

本附录回应Root四项复核。生产建议限定`permission/authority.ts`；Question、UI及前文其他生产路径暂不实施。以下只读设计不代表已运行测试。

### P1. 死owner、自然过期lease的恢复CAS

普通执行成功/失败仍用原`assertControlLeaseInTransaction`要求合法未过期fence；**恢复已死亡者不是执行者继续提交**，不能借用这个assert。恢复先读canonical requested/start、exact effect target=attempt的current lease及其runtime receipt，事务外获取真实OS dead_or_reused，再在一个immediate transaction重读并比较：原start id/request/attempt、原lease id/target/target_id/owner_occurrence_id、same Project owner、current outcome slot和MCP task事实。已出现terminal即返回原winner；start/lease/owner变更则本观察不授权写入，转下一轮重新读取；不拿另一个新lease去替原观察。

只有同原dead owner、同原lease/start仍成立且无MCP接续/terminal，才append唯一outcome_unknown。**已自然expired的lease不改expires_at、不续租、不伪造新lease**；未expired的同原lease，在写outcome的同一事务调用原release primitive，使它真实结束。两并发恢复者在原写事务下观察同一个winner，第二个读到原terminal返回；保留正常执行者错误检查，不能吞UNIQUE后虚称自身成功。OS观察不放在SQLite写锁内，写前精确重验观测对象；一个已证实死亡的PID+processInstance不会被后来PID复用“复活”。

### P2. MCP handback与自然expiry的原事实判别

`control-lease.ts`在acquire/每次renew的同事务向`engine_control_activation_lease_grant`追加immutable ordinal/expires_at；release只在原lease未到期且id/owner精确时，把mutable lease.expires_at缩至release时刻，**不追加grant**。因此对同exact current lease读取latestGrant（按该lease_id最高ordinal）：

| 原lease与原latestGrant | 真实含义和当前准入 |
|---|---|
| `lease.expires_at === grant.expires_at`且未到期 | 仍持有原授予期限；peer不能抢。 |
| 相等且自然到期 | 没有明确交还事实。OS exact_live/unknown_live继续保护，即使已过期；不能把时钟当死亡。 |
| `lease.expires_at < grant.expires_at` | 原持有者通过exact release缩短期限，是真实handback/terminal release事实。先看outcome；已有terminal直接读取。若无terminal且同attempt有合法MCPtask，则可按原协议task接续，不要求原runtime死亡。 |
| 缺grant、lease.expires_at大于grant、owner缺合法physicalreceipt | 当前数据证据不完整或冲突；明确unreconciled/error，不把它推断为handback/dead，不补造grant/owner。 |

判别和接管都以**same current lease**为对象，不能读历史上某个曾handback的lease放行现在仍活的owner。原MCPtask须绑定该execution attempt，`MCP.callToolWithTaskRecovery:1622`收到execution.task就进入getTask/getTaskResult，保留同taskId；新owner不重新callTool创建第二个远端效果。明确handback后原owner仍活允许接续，是原lease放弃物理执行权的事实，不是第二种policy。若原release失败，expires_at仍等于grant，按未交还处理；不要将原错误日志当作成功release。

对原opaque owner，即使看起来提前缩短也不能自行放宽上表缺physicalreceipt的当前合同；先保留明确unknown。若Root决定合法旧MCPhandback可以仅凭原release+exact remote task接续，需另写接受合同，不在Phase P潜入旧协议fallback。

### P3. physical reference完整生命周期

使用唯一`currentRuntimeOccurrenceID()`，与已有Task/Session deletion owner一致，再用`joinProcessLiveness`取得真实reference。新start和effect lease仍在同一immediate transaction提交，事务内`reference.assertOwnedInTransaction`校验physical receipt；返回原current lease fence，不复制PID到ledger当第二身份源。

- descriptor无需Permission、operator拒绝/尚待批准等路径不提前持有effect reference。
- 真正尝试effect admission时获得reference；新start+lease事务失败或并发loser必须在本调用finally release，loser不能release胜者lease。
- 已获lease的reference覆盖执行、renew、durable result序列化、result+outcome+lease release commit；不能在`executeUnderEffectLease`仅清heartbeat的finally内先释放reference。
- execute throw、结果序列化throw、outcome事务throw、fence丢失，都先完成当前已有的真实错误/handback规则，再finally release本reference。失败保持原错误；没有合法terminal时保留原start/lease为后续调查，不伪execution_failed覆盖已实际完成但持久化失败的效果。
- MCP仍working/input_required的transport错误，先尝试原`abandonEffectLease`并保留其真实release失败诊断，再release本reference；新owner的独立reference只有在新exact lease admission成功后用于执行，旧reference不转移。
- 已有success/result replay、已有明确失败/unknown的错误返回，不创建新的执行lease；临时用于竞争检查的reference同样归本次finally。异步等待其他owner时不得把本reference误作其执行证据。

`reference.release()`只释放本进程本调用的admission引用，原runtime_process receipt仍持久；它既不表示process死亡，也不修改别的Project引用。generic control-lease/process-liveness生产文件保持不改。

### P4. 精确正向测试与真正过程边界

**现有集中合同扩展建议**：`packages/opencorvus/test/permission-two-mode.test.ts`。这里已有真实authority正常Ask/FullAccess/重复结果/显式reconcile合同，可增加same-attempt owner/start/lease/result全集、MCP明确handback后同taskId真实result、自然expired但live owner保留原明确ledger全集、缺/opaque owner报明确未证实死亡诊断。当前750起显式operator reconciliation测试是合法用户确认未知结果，不应当成“裸started恢复”删掉。若触及旧裸started fixture，期望为原requested/decision/start的**完整精确集合**加诊断，不能补造owner或期待自动unknown；真实dead证明由过程测试承担。

MCP集中合同用真实authority execute callback中的原`recordMcpTask/requireMcpExecutionContext`记录公开fixture协议事实，核第二次执行上下文同taskId、recovering=true及最终原result/lease/ledger全集，不直接插入伪成功outcome；这只证明authority/接续合同，**不称官方SDK远端task服务端到端**。若要该额外真实协议验收，应在后续授权单独增加有界SDK服务，不把本Phase P网页fetch过程冒为MCP过程。

**新过程文件建议**：`packages/opencorvus/test/permission-execution-owner-process.test.ts`及仅服务它的`test/fixture/permission-execution-owner-process-worker.ts`。复用已正式交付question-process-projection的NodeProcess owned_tree/isolated runner/managedtmp/原process identity与现成controlled streaming Provider；不复用Question作为Phase P目标，不改Provider fixture。采用普通公开Session create/prompt_async→真实webfetch工具→自有公开回环HTTP资源：资源接到真实请求即证明效果已开始，暂持同响应，父协调peer bootstrap后原样返回CSV；各public API≤30s、资源自己的hold≤30s。原消息/Tool/Permission只由真实参与者产生，不直写完成消息/ledger。

每case fresh parent600s、child≤180s、HTTP30s、父60sreserve，全部物理/output/request/Provider/资源owner关闭后才删runtime；双活与崩溃case分别fresh，不能叠加/延长旧scope。

1. **双活同Project与两Project隔离**：A真实public Ask/AllowOnce→webfetch接收；B正常同runtimebootstrap先打开自己的Project，再开A Project。保存两Project完整canonical ledger、exact attempt lease/grant/runtime OS；A仍exact_live。父释放A资源，A实际CSV Tool结果+自然assistant stop+execution_succeeded/result/lease真实release。B自己的独立public Session/不同CSV同样完成。两边完整各自事实为正向核心；不把“foreign row未被写”作为单一absence断言。
2. **真OSdead，lease尚未到期与已自然到期**：A真实资源请求开始，保存原start/lease/grant/physical identity后自己deliberate23；父先物理join。新B正常bootstrap实际OS dead_or_reused→同attempt outcome_unknown。expired变体由父在原600内等待原120s lease真实到期再启动B，不改时钟/期限；原资源/Provider按actual aborted请求结算。核同start/owner、正确unknown时间/原因、原lease自然expiry值与grant保持，未过期变体核同事务实际release时间。plain text不算Taskcomplete，Phase P不承诺Task/Question恢复。
3. **未知边界**：真实过程只证明exact_live/dead；不会为制造unknown_live去操作受保护/用户进程，也不伪造OS观察。authority的缺/opaque owner输入是受控持久化错误合同，原事实完整保留；现存`test/process-liveness-owner.test.ts:148`已以primitive的显式observer参数验证unknown_live值保留，仅作局部契约不冒充真实OS。若Root要求authority unknown_live分支独立动态覆盖，可另批准最窄测试依赖注入；当前不先新增生产hook。

**直接回归建议**：permission-two-mode、permission-continuation-recovery、session/permission-message-settlement、session/permission-message-recovery、process-liveness-owner；需要实际Task/Mission结果cut时再选现有session/permission-message-process-recovery，明确其现有fixture构造合同不是新的public HTTP全链。`control-lease-settlement.test.ts`发现旧`.not.toBe`核心断言144行，Phase P不改generic primitive，暂不纳运行/修改以免扩大；若最终需触及则先按当前正向lease身份合同替换并向Root报scope。上述均未执行。

Phase P完成也只允许声明Permission原owner/结果收敛，不得把尚未批准的Question source/empty-waiter/ordinary interruption或UI修复称已实现。
