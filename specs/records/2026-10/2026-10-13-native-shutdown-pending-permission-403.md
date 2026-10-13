# 403 Native serve 在 pending permission 下的关闭收敛调查

## Recall

2026-10-14实施授权：root完整审阅本记录148–193行、全部direct/CLI/restart调用后，批准按最终方案修改五个生产文件（server/stop、server/server、cli/server-runtime、cli/cmd/serve、server/restart-handoff），同步原server-restart-e2e诊断调用与聚焦正式正向后台测试。先保存源码/差异、正式红后绿、原Native1.3.14真实绿验；不增timeout，不改peer ProcessFacade/Supervisor/Session/Permission/UI/共享docs，不使用真实模型/凭据，不归档/提交/推送/再委托。root特别要求失败rollback后serve不可保留可再次释放的handoff缓存；共享原语必须join真实quiesce和settlement，shutdown/restart/restore共用原操作owner。本agent应用benchmark-debug-template技能，仅采用其分层证据闭环；已授权的原180/120物理owner上限和30s无活动均保留，不因技能的活动超时建议放宽物理预算。旧只读授权是历史，当前以本段为准。

用户持续goal要求共享控制/恢复/终态异常先全横审、证据落盘再实施。root在395 live-01正常HTTP shutdown发现listener quiesce 5000ms超时；授权本agent只读生产server/CLI/UI Session/Task/Mission、pending permission/question/effects、请求断开、重启恢复、串并行及多项目，并读自有scope canonical证据。本轮不改生产、不启动服务/模型/浏览器，不读凭据，不运行原HTTP checker，不再委托或提交。402负责Main权限批准投影，403独立负责关闭顺序，不能把402修复当作所有pending等待者的通用关闭修复。

已读server/server.ts、server/stop.ts、server/shutdown.ts、cli/cmd/serve.ts、cli/server-runtime.ts、server/restart-handoff.ts、runtime/memory-metrics.ts、session public prompt route、permission authority/SessionLoop恢复、257与385相关历史。全仓检索settleCurrentProcessExecution、beginRuntimeTransfer、stopServerWithTimeout及调用历史，生产上述server/serve文件当前无本agent或peer未提交diff；peer process-supervisor等在变动，禁止修改或把当前diff直接等同live源码。

## 原始事实和严格边界

395 Session ses_hxQa5jQTUbR8tnvMY6gA / Project prj_htaqdXH2yXa4W5BGreGP；真实read permission per_hnAtJviYIcPphDoaRGRp处于Ask。原HTTP sender15:41:40 fetch failed不是关闭根因证明。root实际PageClosed15:43:43.984，晚于closeBy15:43:15约29秒；不能称预留合规。HTTP shutdown-admission15:43:57.246，返回200/真实occurrence。stderr明确listener quiesce timeout 5000与Server stop timed out after5000；stdout仅shutdown requested，未见settled process-owned prompts行。Native88712+Host84240在15:44:02.509物理结束，Native exit1，outputDrain/requestCleanup/physical全true；15:44:05.426配对auth/models删除，原deadline15:44:15之前。shutdown handle25175 exit0只证明物理清理执行成功；launcher74529 exit1 OWNED_NATIVE_COMPLETION_INVALID是正确拒绝资格，不能改标准掩盖异常。

## 有界只读canonical探针计划

只打开已关闭395 scope的runtime/data/opencorvus.db，Bun sqlite readonly+BEGIN一致快照，读取指定business Session及其Message/Tool/Permission/Prompt/control/Runtime occurrence公开状态；不使用HTTP、不import生产初始化、不读取auth/models或别的用户项目。显式scope绝对路径，SQLite finally ROLLBACK/close，进程timer30000ms上限；日志写本403 scratch。先读取schema定位现存表，再精确读取必要列与canonical公开tool事实，不拷贝整个runtime或数据库。以此区分pending未获批、Tool未结束、HTTP失联、runtime未执行取消和物理exit。scope自身Provider审计只投影model/stream/status/EOF及Session身份，不归档原请求payload或秘密。

## 初始代码假设（待canonical/全入口审查收敛）

CLI serve requestShutdown串行先await beginRuntimeTransfer.quiesced，再settleRecoveringServerRuntime；quiesce最终await原Bun server.stop(true)。public POST/session message等待整个SessionPrompt且不把HTTP断开当作用户取消。直接Server.stop则已有onRuntimeCancellationRequested握手先启动settlement再quiesce。若未结束handler必须经Session/Permission取消才能返回，CLI先等待listener drain会阻断自己的取消入口。restart-handoff当前也是先await drained再settleExecution。需排除memory metrics主动采集阻塞、未关闭SSE、实际已终态Prompt等其它原因，不能仅凭最后timeout断言。

## canonical只读取证结果

唯一产物为395 scope的`terminal-observation.json`（26960 bytes），生成器`.tmp-native-shutdown-pending-permission-403/observe-terminal-395.ts`。Bun1.4独立有界只读进程exit0，BEGIN快照后ROLLBACK/close，timer清理；没有生产初始化、HTTP、secret读取、数据库复制或成功assert。公开config及原关闭receipt仅列独立引用，不混入虚构终态。

- 4条真实Message：首user→assistant stop/completed；第二user→assistant msg_g0VXwc6A300L3a9Twb3I没有finish/time.completed。
- read request Part prt_g0VXwc7Iz00stc5XSdnz、call_224d69aadbed492c98e67a29eea61ea3持久存在；tool outcomes为空。
- Permission ledger仅一条requested（per_hnAtJviYIcPphDoaRGRp，ask，15:36:39.758），没有任何决定或effect开始/结果。
- business Session Prompt owner仍指已死亡88712的原process instance/generation；整个scope有2条Prompt owner身份行。身份行残留本身不是“又一新bug”：本次应用关闭没有收敛，后续恢复以物理死亡与原occurrence为界，不在只读取证中初始化恢复。
- final-provider-audit选取7条请求，全部gpt-6.1-sol、streaming true、HTTP200、reader settled/eof，max20/exhaustedfalse；最后观察15:36:43.202。此证明Provider原流已经结束，不是read工具/第二答复已完成。没有overloaded或请求预算耗尽证据。

## 全共享入口、状态与恢复审计

| 边界 | 当前生产事实 | 对本403的意义 |
| --- | --- | --- |
| HTTP /shutdown、Tauri supervisor、managed-parent watchdog、SIGINT/SIGTERM/SIGBREAK | 最终注册到serve.ts的requestShutdown；shutdownPromise幂等，先runtimeTransfer.quiesced再settleCurrentProcessExecution | 本次实际走http-client；其它来源共享同一先后顺序，不能归因为单UI窗口。重复关闭共享同Promise，不能靠多发shutdown解环。 |
| 直接Server.stop、listen失败回收、in-process CLI | server.ts:1090先启动settleCurrentProcessExecution，等onRuntimeCancellationRequested再quiesce；其后join/release handoff，失败保留聚合错误 | 该正确握手与CLI先quiesce不同；c358a2e94已解决直接stop的相关Mission依赖，却未将serve shutdown/restart统一纳入。 |
| 原生重启handoff | restart-handoff.ts:120–123先await quiesceListener drained，再settleExecution，releaseRuntimeState后重建listener/继任者；失败restore路径保留 | 同类顺序风险，原listener未drain则永远不到自己的取消入口。不可只修shutdown而留restart；也不能提前释放handoff让两个owner并行。 |
| 公开同步Session message/init/command | handler await executePublicSessionExecution→SessionPrompt；没有将HTTP disconnect作为用户取消；stream events的onAbort仅清SSE订阅 | 第二条sender连接15:41:40断开而Prompt/pending仍保留是当前控制合同；不能假设fetch失败自动完成服务器执行，也不能靠强关客户端解决后端等待。用户explicit Session.abort另有准入/取消/等待路径，区别于process shutdown。 |
| GlobalChat/Work/UI Session | GlobalChat首条用SessionWake自然准入、后续public prompt同canonicalSession；Root页关闭只结束前端连接，不等于取消请求 | 本样本一期自然首条已完成、第二条仍pending。402批准按钮缺失是触发持久等待的原因之一，但人工离开、合法长等待也必须能正常关闭。 |
| Task/worker occurrence | engine/writer.ts保存真实活跃Task recovery handoff，冻结受影响root ingress，再两阶段向所有物理owner发取消、abortOpenToolParts、等待全部Prompt；不把已idle最后输入乱写aborted | 若CLI先卡在listener，此整段不会到达。正常Task生命周期、不可变request和恢复wake不能因修监听器问题被重写/吞掉。 |
| Mission | 直接Server.settle gates与SessionLoop permission recovery区分Mission独有process recovery owner；运行取消须唤醒已有等待再join恢复 | 已有Mission专门收敛不能由孤立server.stop假fixture冒称整体覆盖。新计划需真实Mission原owner/closing与实际listener条件。 |
| Permission pending | Authority durablyrequested后waitForDecision等待；Instance disposer拒绝waiter PermissionPausedError；准入身份绑定project/session/message/toolCall/fingerprint | 本次Requested没有决定，必须保留真实待授权/中断事实；绝不在shutdown合成deny/allow或执行effect。 |
| Question pending | 现有Question/Bus/Instance owner同settlement里处理；Server注释明确disposal仍会发question terminal事实，protocol fence只能在其后 | 与权限同为可能持有handler的等待者；不能只在permission tool加临时abort补丁。 |
| Effect进行中与结果已写未Message终态 | Permission执行结果和ToolPart/Message各自有真实完成边界；resumeApprovedContinuations只读本Project request并按原Prompt owner/同message序列恢复 | 本次没有effect_started，因此不能外推正在外部effect的关闭安全。须保持unknown/failed/completed既有合同，不能为exit0伪称effect成功。 |
| 串并行与多Project | writer先收集所有ownedPromptSessionIDs，按真实directory/task做handoff；Promise.allSettled先取消所有，再等任何一个；Server还有scheduler/Bus/protocol/Instance settlement gates | 本次运行2Project（native预检与GlobalChat分配）且scope最终2owner行。未来验证需同Project多个pending与跨Project不同状态，确保一个等待者不阻断兄弟取消。 |
| 重启后恢复 | durablePermission pending list、恢复器按project过滤已批准continuation；SessionLoop检查物理owner/准确Message/Tool与Mission路径；Task正常recovery wake持久 | 本轮只读没有重新打开runtime，不触发真实恢复。不宣称死owner已经被回收或请求可以完整重跑。 |

## 已排除与尚未排除

已排除：不是395配置未生效（实际ask请求和原public config）；不是模型拒绝调用（canonical read request已持久）；不是Provider未EOF/overloaded/20预算耗尽（7stream200EOF）；不是工具实际已成功只缺UI刷新（无ToolOutcome、第二assistant无completed）；不是shutdown没有请求到原owner（HTTP200 admission、原pid/instance一致）；不是原native预算先杀导致5s日志（公共shutdown先进入，原deadline之前physical exit1）；不能称Pair泄漏（原owner receipts证实两个文件删除）。PageClosed晚29秒是root窗口管理错误，保留且不包装“预留合规”；它没有解释为什么合法pending会令应用shutdown分支不到runtime settle。

未排除quiesce内部具体await：其先await runtimeMemoryMetrics.stop，再unregister/mdns，最后await原Bun.stop(true)。固定安装Bun1.4.0官方声明serve.d.ts:911–923说明true立即终止in-flight连接，stop Promise等连接关闭，故不应仅凭“handler未结束”便断言一定卡在Bun.stop。memory metrics默认60s，stop等待当前collect；其中host-MCP connectionStats await所有已登记MCP state Promise，而Trace/compaction/supervised-processes都是同步快照。scope未声明MCP业务，但原过程没有每个quiesce阶段的回执，不能100%排除已有MCP状态初始化卡住metrics。MDNS在127.0.0.1明确不publish，可排除此样本的unpublish等待。Bun serve idleTimeout=0，不把5分钟sender断线直接归因服务器idle timeout；Node客户端/连接链具体原因仍未知，需要客户端cause或受控复现。

因此现有证据足以确认CLI shutdown未完成应用收尾、与直接stop使用不同的取消/监听器顺序；尚不足以把唯一底层等待点定死。最终最小修法必须在下一授权阶段用有界无凭据真实listener探针补证，不能通过扩大5000ms/延长native截止、强process.exit0、UI自动批准或跳过qualification掩盖。

## 最小后续方案与正式正向验收（待批准）

优先复用Server.settleCurrentProcessExecution已有onRuntimeCancellationRequested与settleRecoveringServerRuntime原recovery join，将CLI普通关闭和restart的生命周期顺序归到同一现有primitive：先关闭准入/请求实际owner取消，再允许listener/metrics drain与完整runtime join，最后唯一releaseHandoff/继任listener。具体生产范围预期server/server.ts、cli/server-runtime.ts、cli/cmd/serve.ts、server/restart-handoff.ts中的必要边界，必须先由root完整review实际Probe结论后批准；禁止碰并行ProcessFacade/ProcessSupervisor/shell进程补丁。若metrics单独证实持有初始化Promise，应按其真实观察合同修收集/停止所有者，而不是单个MCP名特殊处理。

阶段证据计划：fresh只用公开fixture、成熟隔离runner，原Bun1.4/native所属owner固定有界；真实HTTP listener含pending handler，通过生产public prompt与受控流式Provider替身自然产生Permission/Question/工具执行，不造completed消息。不使用真实Provider/凭据即可测应用关闭；先记录当前CLI红测：完整阶段时间/监听器请求/实际取消/Prompt与Tool及native退出回执。纯Bun pending-handler+stop(true)单独probe只能证明运行时语义，不冒充应用端到端。然后按单源修复跑正式绿：idle完成保持、合法pendingPermission/Question、已断客户端仍pending、两个并行Session/两个Project、进行中effect确定取消合同、Task recovery handoff、Mission独有恢复、directstop与CLI HTTP/signal/restart同事实边界。每个owner显式正常close/join，无残留服务，源码/日志出现新的调度恢复异常继续全横审。

旧server-lifecycle-occurrence测试主要覆盖HTTP admission/handler identity；permission-transport及385系列主要覆盖权限持久/恢复，不等于真实CLI listener停机。脚本server-restart-e2e里可见quiesceListener与空settle callback的helper分支，不能单独证明pending应用owner的顺序安全。重启需要验证旧listener/owner终态后新listener可绑定并读取同一未完成canonical事实，不发假回放结果。模型/桌面验收由root最后决定fresh最小范围；402/403分别提交，395保留有限交付及两失败事实。

## 下阶段最小无凭据listen探针与phase观测（待批准）

**版本纠正**：395原private Native是root确认的Bun1.3执行环境；本轮读取的bun-types1.4.0官方说明只用于发现“stop(true)理论上应终止连接”的反例，不能冒充1.3真实行为证据。正式Bun1.4 runner保持仓库测试工具链要求，待测child必须显式选395实际native可执行文件（读取其`--version`公开输出并记实际路径/版本）。不复制用户auth/models，不能因1.4对照通过就认定1.3生产链已通过。

### A：先做最小真实Bun listener语义探针

沿`script/server-restart-e2e.ts`现有`bootstrapIsolatedTestRuntime`/`applyIsolatedTestUserEnvironment`/`prepareTestProcessSupervisor`/`NodeProcess.spawn`父子owner方式，不复制整个live-Sol runner或另造factory。外层使用现有`script/run-with-inactivity.ts --inactivity-ms 30000 -- <Bun1.4> <scratch probe>`，其900000命令上限只是现成兜底；probe自身在开始固定**90000ms总deadline**，每个原生child固定**20000ms**且不随进度延长。每次通过127.0.0.1:0取得真实空闲端口，全部端口/PID/发生代只归该probe；不使用18506或用户端口。

只需三种顺序小样本：idle listener stop(true)；真实POST handler等待自有Promise时stop(true)；同一pending handler客户端先主动断开后stop(true)。不使用应用/模型/MCP。child打印/写phase JSONL：nativeVersion、listener-ready、request-enter、client-disconnected、stop-requested、request-signal-aborted、handler-released、stop-resolved、finally-close。待处理Promise在原started+4000ms固定释放，故即使stop等待handler也能正常结束，不为取得红测故意留下不可收回服务。它证明原Bun版本stop与handler/连接关系，**不冒充完整应用关闭验收**。

父进程按原deadline用现有受控Handle等待输出和`settled`，正常child释放gate、await server.stop(true)、关闭fetch reader、退出；父正常join并验证physical/output/request cleanup及原监听端口释放。只有child超过自己的20s/外层90s才通过其原ProcessSupervisor handle执行归属严格的dispose并join，记录超时失败，不把强制兜底写成正常exit0，也不关闭任何用户进程。三case合计应远小于90s；不连续tail，按独立完成/定时阶段摘要查看。

### B：再进入真实应用CLI关闭，仍无真实Provider/凭据

若A证明阻塞关系或排除原Bun等待，则准备一个正式后台文件通过真实public Session prompt与成熟`test/fixture/controlled-streaming-provider.ts`的公开本地流式响应产生read调用，生产SessionProcessor/Authority自然持久消息并进入Ask；不spy handler/authority/store、不造completed消息。使用显式公开fixture catalog/本地假Provider身份，若SDK要求apiKey仅可使用明确非秘密的公开fixture字面量，不访问任何用户auth/models；它是后台控制链合同，绝不称GPT-6.1 Sol E2E。直接`session.shell`不是替代品：该明确用户shell入口并非同一LLM工具Ask调用路径，不能拿它绕过待测权限等待。

app child必须跑真实serve入口和原native Bun版本；Provider fixture拥有独立finally正常close。固定单case120000ms、整阶段180000ms、30s无输出上限，声明所有owner，不扩默认5sstop timeout或原native生命周期。记录Global/project/session/request Tool身份、pending前后SQLite事实和原shutdown/requestDisconnect/host/target/output/request证据。依次做“pending直接shutdown”和“client断开后shutdown”即可确认最小应用路径；不要一开始跑巨大矩阵或真实Sol消耗。

### C：quiesce内部定位的可行边界

现有公开日志只有整体quiesce timeout，**没有现成的逐await phase hook**；不能宣称已观察到originalStop内部。源码可用的真实观察点是ServeRuntimeMemoryMetrics.start({logger})、MCP.connectionStats、Server.TestHooks.installBeforeRequest，以及既有runtime settlement日志/owner receipts。先用A+B和真实只读MCP状态/metrics完成时刻排除；若仍无法区分metrics.stop与Bun.stop，必须另行向root申请仅诊断期的pass-through phase观察方式，列精确插入点：metrics-stop-start/end、original-stop-start/end、runtime-cancel-requested、termination-joined。该诊断不得替换/提前resolve任何Promise，不得以mock stop作为成功；临时仪器化应独立scratch/source副本或明确受控TestHook且与正式未仪器化验收分开保存，不能偷偷修改正在并行变动的process代码。

后续根因修复以实际阶段证据决定最小文件范围；公共原5s/物理deadline不因观察方便而放宽。A无服务前置/无凭据且正常有界，建议优先批准A；B须先reviewfixture配置和owner脚本，C仅在A+B仍含未知时按精确必要性批准。当前只有方案，A/B/C均未运行。

## 阶段A批准与即将执行的精确命令

root已批准**仅A**无凭据真实Bun listener探针；B/C服务与生产变更仍未批准。测试child明确选择395原`.tmp-mcp-user-resource-input-393/live-attempt-01/bundle/bin/bun.exe`，先用同原生owner执行`--version`并保存stdout，不预设显示值。父driver在403 scratch，复用正式run-with-inactivity隔离、prepareTestProcessSupervisor及NodeProcess owned_tree。driver总deadline=首次启动+90000ms；每个原生child deadline≤该总deadline且从该次spawn前+20000ms；三个case顺序执行，每个pending gate固定child开始后4000ms释放。不会随日志/请求延期。

计划命令：Bun1.4执行`packages/opencorvus/script/run-with-inactivity.ts --inactivity-ms 30000 -- <Bun1.4绝对路径> <403scratch/listener-phase-a.ts> <403scratch/phase-a-01绝对路径> <原Native Bun绝对路径>`。结果包含版本/每个case phase JSONL、实际native ready身份、ProcessFacade settled receipt与两路output drain、精确request目录removed/端口release。所有服务listen127.0.0.1:0且只归该child；finally release自有gate、stop(true)、client reader终结、原handle join。超出20s的child由原handle terminate/dispose并join，记录为失败而不强称正常。无UI/真实Provider/凭据或auth/models接触。

## 阶段A实际完成：原Native Bun 1.3.14（2026-10-14）

正式命令按上段执行，外层session14623已join，退出码0。`phase-a-01.log/.exit`及`phase-a-01/driver.json`保存所有原receipt；`--version`真实输出1.3.14。父driver固定90000ms、每Native child固定20000ms均未延期。三个case顺序完成：

| case | 真实owner与端口 | 精确阶段 | 实际结论 |
| --- | --- | --- | --- |
| idle | PID52332，occurrence aec233e0-b270-4026-a821-6639c86c4ddc，53739 | start1791908178684；ready+321ms；stop-requested/resolved同+322ms | 空listener可立即正常关闭。 |
| pending | PID79648，occurrence ebe5ff51-6a36-4846-bbe0-a4cd2469c630，53773 | handler+325ms；stop+387ms；request signal abort+388ms；client socket closed+389ms；固定gate在+4009ms释放，handler release和stop resolved同+4009ms | 原Bun已经断连接，stop Promise仍等待未返回的真实handler，约3622ms。 |
| disconnected | PID76472，occurrence7dfcecc3-a263-4987-a03b-71c8f5349b49，53693 | handler+317ms；client abort+382ms，signal/terminal+383ms；stop+384ms；固定gate+4003ms，handler release/stop resolved+4004ms | 客户端预先断开也不解除handler等待，stop约3620ms后才完成。 |

每个child由自己的finally释放gate、await stop、join client，物理reason=exited/exitCode=0、stdout/stderr drain完成、唯一request目录removed=true、监听portReleased=true。未用紧急dispose伪装正常关闭。driver隔离runtime由原factory正常删除，无持续服务。日志记录的request-signal-aborted是Bun真实request.signal事件，不能据此断言生产SessionPrompt自动响应该信号。

A已经证明原Bun1.3.14的连接终止与handler Promise结束是不同边界，支持“CLI先await quiesce、后取消Prompt”的等待环候选；它**没有加载应用、metrics、Permission或SessionProcessor**，不是395完整根因/应用E2E，更不等于402批准入口修复。395是否另卡metrics仍未知。保持原395 timeout/exit1事实，不用本阶段正常exit0覆盖它。

## 阶段B已准备，等待root审阅与运行批准

root只授权准备B，不授权启动；现有scratch `launch-phase-b.ts`、`serve-phase-b.ts`已写，TypeScript transpile-only诊断0，回执`phase-b-prepare-syntax.json`。这仅语法检查，**没有执行脚本、应用serve、Provider、凭据、模型或UI**。脚本全用当前成熟隔离runtime、prepareTestProcessSupervisor、NodeProcess与`runHostCommandWithInactivity`，未修改共享runner或生产代码。

拟运行：正式Bun1.4执行`<403scratch>/launch-phase-b.ts <fresh phase-b-01绝对路径> <原Native Bun绝对路径>`。launcher首次固定180000ms物理deadline，经现有runHostCommandWithInactivity传给driver，30s无活动；driver必须接受同一个原deadline，不能自行重开180s。每个Native应用owner固定min(caseStart+120000ms,原180sdeadline)，pending/disconnected两case顺序；若第二case不足30s直接保留准备失败，不延期。每case所有HTTP读20s上限，真实启动/Permission观察20s；读取等待每5秒仅打印阶段摘要，不持续tail。Native仍显式--version验证1.3.14，应用通过真正`src/index.ts serve --startup-receipt --startup-occurrence`启动，不用假的shutdown handler替代生产CLI。

### 公共输入、正常入口及owner

driver先沿factory固定HOME/OPENCORVUS_HOME/managed-config和环境白名单，再延迟import现有`test/fixture/controlled-streaming-provider.ts`。写一个新的公开空catalog `{}`并用显式config声明本地`@ai-sdk/openai-compatible` Provider与两个公开模型（业务session-prompt-owner-model、helper shutdown-helper-model），所有api指自有127.0.0.1随机端口，不读用户auth/models、不使用真实API key，也不从宿主继承Provider环境变量。Base/Ask明确，browser/computer关闭；公共外部CSV放同case project目录之外，天然进入read_local Ask。fixture只按已有firstPromptToolCall选项输出一次read工具流；产品实际SessionProcessor、Tool权限分类、Authority持久化和等待照常运行。该有意受控Provider合同不称自然模型推理或GPT-6.1 Sol验收。

每case一个原Native应用owner及一个driver进程内的官方成熟Provider fixture listener；应用随机端口先独占listen0取得、正常close再交Native绑定，不使用用户常用固定端口。startup frame验证exact PID；公开POST/session创建assistant，返回目录必须等于隔离project；公开POST/session/:id/message等待真实Prompt。只读GET/permission确认精确session/read已pending，再以SQLite readonly BEGIN读取canonical请求/ledger/Tool/owner。第一case保持业务HTTP连接，第二case仅abort自己的fetch并join，随后两个case都真实POST/shutdown→原Native settled→output drain→request目录清理→端口释放。read不可获批、不伪造结果、消息或Tool终态。产物记录native exit及runtime settle/quiesce timeout日志；即便application exit1，若如实完成观测，probe runner可以exit0，但不得写成应用关闭通过。

finally先对自有listener发送正常shutdown，最多在原deadline内等10s原handle；确实未退出才原handle.dispose并完整join，单独记录emergencySettlement为失败。Provider释放所有自有请求并等responded，再stop(true)/端口复核，最后factory删除自己的runtime。若物理/output settlement未确认，launcher保留原隔离目录并报失败，不强删。每case保存选定公开SQLite事实，数据库/runtime整体不复制；Provider审计只保留model/stream/toolNames/kind，不归档原payload。

### metrics的可观察排除条件与明确差异

B采用已有公开`OPENCORVUS_RUNTIME_MEMORY_METRICS_INTERVAL_MS=300000`配置；不是禁用metrics或修改实现。`ServeRuntimeMemoryMetrics.start`立即首轮collect，原logger的`runtime.memory.metrics`行只在await collect完成后产生。driver必须实际观察此PID成功完成行后才能启动业务；300s大于整个180s owner，因此该样本关闭前不会安排第二次collect。正常事件循环随后进入HTTP→pending→shutdown时，已无active collect等待。这可将B的监听器等待与metrics等待区分，且保留原metrics公开快照。

此策略**不同于395默认60s周期**，所以它只排除B中的metrics持有，不能反证395当时metrics没有卡住。若首轮没有真实完成行，B保留准备失败并正常收尾；不能改成0/删指标/假造完成行继续。没有额外C级pass-through仪器化，没有对Bun.stop/metrics.stop替换Promise。若B在上述前提下重现5s quiesce timeout，则结合A、public handler待权限与CLI先quiesce的代码，可进一步确认应用顺序共因；仍需root批准最小修复及正式绿测，重启/Task/Mission/并行多Project不由这两个最小case自动覆盖。

### B运行授权Recall与最终准备修正

root已实际审读两个B脚本并批准两个顺序case运行（C/生产改动仍未批准）。按root要求本地Provider的options.apiKey明确设为公开测试字面量`local-controlled-provider`；它不是用户秘密，不通过Auth.set写任何auth，不读取原auth/models。其余原30s无活动、每Native120s/总180s物理边界保持，finally正常shutdown/join优先，仅原归属handle可紧急dispose。运行命令为Bun1.4→launch-phase-b.ts→fresh `.tmp-native-shutdown-pending-permission-403/phase-b-01`，实际原Native1.3.14二进制为前述393 private bundle。保留应用exit1与probe观测完成的区别；不会因复现timeout而提高timeout或重试真实Provider。

### B01原始checker失败与收尾，B02仅修工具合同

B01实际原生87680（helper80464）成功listen64883；日志在16:33:58.797已给出首轮`message:'runtime.memory.metrics',data.pid:87680`，host-mcp projects0/connecting0。自有checker误按通用Pino的msg/顶层pid读取，导致20秒准备超时。此是checker真实错误，不是metrics挂起、Provider失败或403应用复现；未创建Session/未发Prompt/Provider requests=[]。原错误、log、case/launcher receipts全部保留，原实际脚本快照`phase-b-01/serve-phase-b.actual.ts`与`launch-phase-b.actual.ts`先保存再改。

finally实际POST/shutdown200，原Native正常exit0、输出join，`[serve] settled process-owned prompts sessions=0 toolParts=0`。launcher exit1并settlementConfirmed=true；Provider自身stop/portReleased=true。额外只读post-close-observation记录原request目录removed及64883已释放，不重写原失败case。修正只认当前唯一`message/data.pid`日志合同，没有并读fallback；同时launcher原字节输出只保留已有stdout/stderr文本和退出/settlement字段，不重复归档Uint8Array数千键。随后以fresh B02继续原授权两个case，各自固定新180s owner原deadline，不延长或重用B01。

B02正确读到metrics，Native84296/helper实际ready后POST/session却返回400 ProjectDirectoryIntegrityError。根因是自有helper误将x-opencorvus-directory URI编码；生产`server/directory.ts:6`原样返回header再Filesystem.resolve，成熟393 helper也直接使用原目录。这是本地工具错误，不是公开Session或配置回归；未创建Session、Provider请求0。原Native正常shutdown exit0，Provider stop/端口释放，probe exit1/outer settlementConfirmed true；独立post-close-observation保存exact request目录已删除及应用59509释放。已先保存B02实际两脚本原像，再仅将header改为原绝对directory，不加decode fallback、不改生产；fresh B03继续授权两个case，保留B01/B02的全部原失败，不把准备失败计作403复现。

B03目录入口已正确，POST/session被实际ConfigInvalidError500拒绝：自有config误设agent.memory.model，而Config.MemoryAgentOverride在1000行明确从NativeAgentOverride删除model。Native87192正常shutdown0、Provider0请求/关闭，probe1；未创建Session，不算关闭问题复现。原实际脚本/配置/错误先保留。现修helper删除不必要agent/model覆盖；仅保留Base/Ask、实际local model/small_model/provider和禁用的builtin MCP声明。当前Memory Organizer明确在project-memory-organizer.ts:209从configuredDefaultModelRef(config)选择模型，不能通过memory.model覆写；成熟fixture默认按完整Memory系统prompt精确分类，与model名称无关。明确Session标题使ensureTitle的现存默认标题准入提前返回，不建立新产品gate。

root要求下一轮前先完整离线预检，不再靠反复Native启动试错。新scratch `phase-b-input.ts`只在自有helper内提供一份公开配置/请求输入，供实际B与`preflight-phase-b.ts`共用；不修改生产或共享runner。预检沿成熟隔离factory，先清Provider环境变量、使用新公开空catalog，再以Config.Info解析、实际global config.json+稀疏project文件→Config.snapshotForProject验证累计Base/Ask/model/small_model；Session.create.schema及当前公开PromptInput的确切omit组合验证请求。读取server/directory真实header映射、Memory默认模型与controlledProviderRequestKind两个正向结果。预检不创建Session/消息、不listen、不调用Provider；finally关闭Instance/Database并删除原隔离runtime。预期输出成功后才开始fresh B04，原180/120/30不延长。

其它输入输出已重新核对：Session create200、public PromptInput删私字段且messageID必需；permission GET原Request[]；shutdown admission200/occurrence；SQLite现存session/message/tool_part_request/tool_part_outcome/permission_ledger/session_prompt_owner。没有新增UI自动测试。前三轮准备错误明确是本地helper问题，不属于产品失败证据，也不算已完成B。

离线预检已完成：preflight-01/02分别揭露helper对project/global配置路径的旧假设，原错误保留且没有任何应用/Provider服务。修正后直接使用当前ConfigPaths.projectFile和CANONICAL_FILE_NAME；preflight-03实际exit0，Info合法、snapshotForProject累计Base/Ask/精确local model+small_model/稀疏username、两个builtin MCP disabled。public create/message schema输出正确，Memory精确默认模型与fixture memory/prompt分类均正向，明确Session title为非default符合原ensureTitle准入。最终输入从同一个scratch phase-b-input.ts供预检和实际B消费，不存在两份配置。Instance/Database finally正常close/隔离删除。root已收到完整JSON/log/exit；接下来fresh B04才重启原授权两个应用case，仍180/120/30原预算。

## B04真实应用复现与最终实施前结论

原launcher started1791909910946/deadline1791910090946，driver finished1791909969253（约58.3s）。外层exec87677已join、probe exit0/settlementConfirmed true，表示两个调查case正常取得并收尾；**两个产品Native均exit1，应用关闭验收失败**。B04实际脚本/输入原像与`summary.json`、两个pending/terminal只读SQLite观察、stdout/stderr、startup/shutdown/owner/cleanup均保存于scratch phase-b-04，未复制数据库或整个runtime。

| case | 精确业务/owner | 实际顺序与canonical终态 |
| --- | --- | --- |
| 保持连接 | Native89728；Session ses_-zUS36Zm5zzuLpd4pJ2E；Project prj_hVC2XoPRJKHYi7eANdNZ；Permission per_hMatpuMAvp5jf0YEpZog | 首轮metrics16:45:21.419完成；permission requested16:45:25.119；shutdown200 16:45:25.180；原Native约5s后exited/1，quiesce timeout真实、无runtime-settled行。 |
| 预先断开client | Native70276；Session ses_-zUS36Pa7zzNJL9GMR4s；Project prj_hpFnplD1GvWR6Wgrjafc；Permission per_hUgFABwoMSaf8nOGjiyf | 首轮metrics16:45:42.891完成；permission requested16:46:03.948；自己的fetch已abort/join16:46:04.089；shutdown200 16:46:04.104；约5s后同样exited/1及quiesce timeout，无runtime-settled行。 |

每case是真实用户输入→SessionProcessor→fixture流→实际read Tool/PermissionAuthority：两条Message（user+未completed assistant）、一条tool request、tool outcome为空、ledger仅requested、原Prompt owner仍指该已死Native。两个fixture各收到2条stream:true精确session-prompt-owner-model请求，实际分类为memory再prompt，证明本次Memory没有抢业务firstPrompt。两Native outputDrainComplete、唯一requestCleanup.removed、application portReleased全true；driver内两个Provider分别56133/61637均正常stop且portReleased=true，所有隔离runtime由原factory收回，无活跃服务。

本阶段由首轮实际完成+300000ms周期排除**B04**的active metrics collect；127.0.0.1无MDNS；A证明原Bun1.3.14 stop(true)虽关闭socket但继续等待handler。B04公开POST/message仍await整个Prompt，而CLI未开始真实settlement就await quiesce；canonical正是待Permission、没有工具/assistant终态。这组真实数据和代码足以确认共享关闭顺序共因，不必执行C仪器化。395原scope是否额外存在metrics等待仍未知，不能从B04反推原scope每个await。B01–03及两个离线路径前置错误属于自有helper错误，完整保留，不冒产品失败或成功。

## 最终最小单源实施方案（root审阅后方可实现）

### 一个取消握手原语，三类关闭路径共用

将`Server.stop`现有onRuntimeCancellationRequested握手提取到现有`server/stop.ts`，例如`settleRuntimeAndQuiesceListener<T extends { releaseHandoff(commit?: boolean): unknown }>`；接受`settle(onRuntimeCancellationRequested):Promise<T>`和`quiesce():Promise<void>`，返回两者已join后的原settlement结果。名称可按现有命名收敛，但合同固定：**启动真实settlement→收到它原有真实cancel-requested callback→启动listener quiesce→join listener与完整runtime/recovery→返回唯一handoff**。不自行发取消、不伪造ready，不延迟/提前改Bus、Task、Session occurrence或Permission决定。

握手Promise由callback解决；settlement在callback前失败则同一错误拒绝握手，不能把失败当ready；quiesce只在实际通知后开始。开始后的两个Promise都必须被观察并完整join，不能因一个先reject留下另一个unhandled或后台悬挂。成功只返回同一settlement结果，由原owner在已有唯一位置commit/release。direct stop、CLI shutdown、restart都用该原语，删除direct stop原重复手写握手与CLI独立先quiesce顺序，不保留两个当前策略。

### 精确生产文件/接口与所有调用调整

1. `server/stop.ts`：在现有stopServerWithTimeout旁加入上述生命周期握手原语；保持timeout函数、原5000ms及错误回调语义。该模块当前无重运行初始化依赖，抽取不引入Server/CLI循环。
2. `server/server.ts`：直接`server.stop`的confirm/failRuntimeCancellation、termination/await/quiesce重复块改为调用共享原语；settle仍原Server.settleCurrentProcessExecution，quiesce仍原runtimeMemoryMetrics→MDNS→原Bun.stop。stopOperation/quiesceOperation幂等、listenerStopped、cleanupFailures、releaseRuntimeHandoff语义保留。beginRuntimeTransfer继续只提供真实quiesce handle，不替换它为并行listener或fake stop。
3. `cli/server-runtime.ts`：`settleRecoveringServerRuntime` input增加可选onRuntimeCancellationRequested并直接转交Server.settleCurrentProcessExecution；仍先完整runtime settle，再join startedTaskRecovery，再返回同一handoff，不反转到先await recovery。传递的是已经存在的事实通知，不增第二状态源。
4. `cli/cmd/serve.ts`：当前processExecutionSettlement幂等owner仍唯一；其首个创建者把真实通知传至上述helper。抽取一个当前listener的`settleAndQuiesce`操作供正常shutdown和restart共同调用：启动原settlement、握手后在原stopServerWithTimeout中beginRuntimeTransfer/quiesced；成功后设置listenerTransferred，join后保存唯一releaseProcessExecutionHandoff。正常shutdown的最后release、managedLifecycle.release和exit0沿原位置；任何失败exit1。HTTP、Tauri、managed-parent-watchdog、SIGINT/SIGTERM/SIGBREAK全部已经汇聚requestShutdown，不能只修HTTP。恢复listener时同时重置这一次的操作Promise，不能复用旧listener的成功缓存。
5. `server/restart-handoff.ts`：将目前分离且有错误顺序的quiesceListener/settleExecution回调合同合为`settleAndQuiesce`，由serve提供同一操作；beginRestartHandoff先await它完成，之后唯一releaseRuntimeState→waitForReleasedListener→spawn继任者→原waiting/bind/ready/transfer协议。删除原await drained后才settleExecution的路径，不保留旧签名fallback。返回drained对应这个已完成原操作，仍可供serve最终requestShutdown幂等调用。

全仓接口搜索实际命中：beginRestartHandoff除定义只有serve及`script/server-restart-e2e.ts`受控诊断调用；后者必须同步新合同，不能留旧noop settle造成错误测试。settleRecoveringServerRuntime除定义只有serve及`test/runtime-startup-recovery.test.ts`。beginRuntimeTransfer只有serve shutdown/restart两个实际调用。stopServerWithTimeout只有serve；新helper由server.stop和serve引用。这里预计5个生产文件、一处现存诊断脚本、直接聚焦后台测试；不改peer ProcessSupervisor/ProcessFacade、Session/Permission取消策略、Provider或UI。若实现中发现额外文件必要性先报root，不能扩大现有授权。

### 失败、回滚、恢复与物理责任

- quiesce失败或原5s超时：仍观察/join已经启动的runtime/recovery settlement；若其成功返回handoff，在原返回值上`releaseHandoff(false)`回滚一次后上抛原错误。若settlement也失败，保留两个真实原因；若rollback失败再以AggregateError附加，不能仅打印后exit0。已在Server内部失败并回滚的settlement没有返回handoff，外层不得再伪造release。原quiesce操作仍由原listener owner持有，不能丢弃其最终错误或另起监听器掩盖。
- settlement先失败：callback前失败不启动quiesce；callback后与已启动quiesce一起join并聚合。不得仅await最快失败就启动继任服务。listener已经成功停止但其它cleanup失败时仍保持原cleanupFailures明确报错，不将物理端口释放包装成runtime完成。
- restart失败：已有child未转移时由原handle正常dispose/join；不确定物理所有权继续原ServerRestartOwnershipUncertainError且保留证据。只有原settlement/rollback责任已得到明确结果后进入既有restoreListener，保留waitForReleasedListener与实际恢复运行时步骤；restore也失败则聚合，不能去启动第二个假恢复服务。正常路径一定在旧listener与runtime/recovery均已终态且唯一handoff释放后才spawn，保留已转移owner的当前成功处理。
- timeout不是修法：不提高5000、Native120s/总180s、真实Sol600s或其它owner预算；不将HTTP disconnect接成用户取消，不自动批准/拒绝Permission。原Prompt/Task/Mission/Question/effect通过原settlement primitive产生其自然终态，跨Project不会只取消当前UI Session。

### 必须完成的正向验证矩阵

先把已保存B04两Native1作为正式实现前实测红证据；新增聚焦正式后台检查走当前runner/Bun1.4。共享原语的局部正向合同要验证明确phase序列、成功handoff只由caller释放、真实quiesce错误/settlement错误/双错误/rollback错误的类型和聚合内容，不以“不调用旧函数”等负断言为核心；局部controlled Promise只证明原语，不冒充真实应用。

应用矩阵至少：idle已有完成消息；Permission pending；Question pending；客户端预断开；同Project多个Session和两个Project并行等待者；真实Task root/worker occurrence与Mission原恢复owner；effect完成与明确aborted/unknown边界；direct Server.stop、CLI HTTP/signal/managed source共同入口、restart旧owner结束后新listener可绑定。使用成熟受控流式Provider产生真实参与者消息和Tool/Question/Permission，不手写completed结果。每项核查实际canonical Message/Tool/Permission/Prompt owner与控制回执，Permission仍按原暂停/恢复合同，不能为通过而写假deny。

相关现有正向检查：runtime-startup-recovery、runtime-execution-settlement、server-lifecycle-occurrence、session-deletion/Permission/Question恢复按实际调用影响收敛；同步server-restart-e2e的source/真实Native owner边界。当前检索未运行任何UI自动化，所有UI由root真实交互。

最后复用B实际入口在原Native1.3.14 fresh绿验，维持初始metrics实际完成与300s周期观察条件、120/180/30预算；要求应用exit0、真实settled日志和canonical自然终态、physical/output/request/Provider/端口全部收尾。重启还要实际旧owner/继任者所有权协议与关闭证明。当前B只证明两种Session等待的红态，Task/Mission/Question/并行/restart尚未实测，不外推成功。root决定的fresh GPT-6.1 Sol+页面之后才可验收402完整批准链；本403与402生产目前都未修改。

## 已批准实施中的验证进度

实施前已保存五生产文件/诊断脚本原像、scope-before与全部workspace-before差异；其它Session/compaction/UI并行diff保留。共享原语落在server/stop.ts，direct stop及CLI共用，restart回调旧签名已删除；serve只有共享操作成功后才公开canonical completedSettlement，quiesce失败的内部rollback无法留下可再次释放的缓存。**这一阶段曾采用“5s检测后只依赖外层物理deadline继续join”的中间语义，root审查已否决并撤回；它不是最终合同。** 最终以后一节的原CLI自持5s失败物理退出为准，正常与有限失败仍完整join。

正式新增server-runtime-quiesce红测8例：1pass/7fail/3 assertions，exit1；实现后8pass/17 assertions，exit0。包含phase先后、原对象身份、listener/runtime单/双错误、rollback错误、timeout后真实stop join及晚错误聚合。原runtime-startup-recovery的真实callback正向检查已同步；相关三文件已exit0，核心typecheck exit0。所有日志在scratch implementation。接下来原Native1.3.14 fresh B05复用B04实际公开入口与固定120/180/30，核查真实应用exit0及canonical终态，不把局部phase测试代替Native绿验；未运行真实Provider或UI。

### 5s超时的原CLI物理owner合同（root复核后进一步收敛）

已确认普通独立serve不保证有外层ProcessSupervisor/benchmark deadline。仅把stopServerWithTimeout的race改为超时后无限join，会削弱原CLI在5000ms明确失败退出的合同，不能保留。root明确批准使用原onTimeout回调落实同一CLI process-owned失败终态；不扩ProcessSupervisor、不另起监控owner、不提高timeout。

最终分层：正常和有限失败路径仍由共享原语完整观察/join实际settlement与quiesce，handoff按唯一原结果提交/回滚；若真实quiesce在原5000ms仍不结束，serve唯一生产调用的onTimeout在**同一原process**同步写明超时失败诊断、记录原shutdown/restart请求来源，随后`process.exit(1)`。这是原CLI原本已有的失败物理退出边界前移至其真实计时owner，不是把未join Promise称成功。其日志/Native exit1/host物理receipt须明确未完成逻辑join，当前process自我结束，绝不操作用户其它PID。直接Server.stop没有这条CLI定时退出，保持其原调用者拥有的join合同。

restart在5s未知listener状态时同样由旧process失败退出；共享quiescePromise没有成功返回，beginRestartHandoff到不了releaseRuntimeState、spawn或catch后的restore，因此不绑定/重试尚未证明释放的端口，也不产生继任owner。正常restart HTTP是lifecycle.ts的25ms异步admission，路由先返回200/connection:close，真正执行handler并非Bun正在等待的HTTP handler；仍必须实际restart/transfer/rebind诊断验证。managed-parent/信号/Tauri共用同一serve回调；退出1由既有host识别为失败，启动恢复仍只看原canonical unfinished/physical dead，不新增假Message/Permission决定。

为了不让一般回调异常成为timer里的uncaught错误，stopServerWithTimeout创建原timeout Error后try/catch onTimeout；若回调throw，则以包含timeout及回调错误的AggregateError保存，并按其正常局部合同等实际stop终态。若随后stop也reject，三个原因保留。生产onTimeout的finally自我exit1保证诊断写入失败也不能悬住旧listener。新增正向错误合同验证该回调抛出路径；Node/Bun物理退出只能由真实子进程证据证明，单元测试不mock process.exit冒称。

回调错误已正式先红后绿：新增第9例，红8pass/1fail/1error（原timer callback uncaught且返回undefined）；修正后9pass/20 assertions/0error，exit0。core typecheck此前0，后续最终重跑。关联三文件37pass/68 assertions，四文件owner矩阵12pass/73 assertions，均exit0。后者含真实listener对Task tail、两Project Question abandonment、串/并行后台文件flush-close以及Mission实际恢复控制链（模型transport受控），不是真实Sol。

实际restart验收复用现存`script/server-restart-e2e.ts`的source profile，选择同原Native Bun1.3.14为进程宿主；诊断已有成熟WMI standalone精确instance owner、真实restart200→waiting/bind/ready/transfer、旧owner dead→后继HTTP/file读写、失败restore与所有finally shutdown/join。脚本本身先检查当前checker不在Windows Job；若环境不符则保留前置失败，不能把它当产品restart失败。只在自有SERVER_RESTART_RESULT记录，隔离factory不读用户配置/凭据、不调用Provider；沿原HTTP5s、bind/交接/physical观测15/30s、capture120s边界，不修改这些等待预算。所选诊断运行会覆盖两次串行restart及两个独立Project并行、managed/owned-tree拒绝合同和失败子进程restore；不能把它与B05待权限Native混同为已经验收pending重启。

### restart早期失败边界：以真实quiesce通知代替开始settlement的猜测

root发现原`listenerQuiesceStarted=true`仍在新settleAndQuiesce调用之前，旧“调用quiesce即开始关listener”的假设已失效。若settlement在cancellation readiness前拒绝，旧listener仍真实监听；此时强行restore会waitForReleasedListener并把仍可用listener误认丢失。最小修法在当前回调增加`onListenerQuiesceStarted`参数，由serve的**Server.beginRuntimeTransfer真正返回handle后**调用；restart owner只在这个通知中设置原flag。失败前未收到通知时原catch清理自己尚未spawn的context并返回原错误，保留原listener，不发restore或后继spawn。

serve仍用真实transfer handle而非另建权限/生命周期事实作为已开始边界：该handle尚未建立且共享操作已经失败/完成rollback时，退役这次failed operation缓存，保留同一个监听器，后续新正常生命周期可重试；已经建立transfer的失败继续由restart原restore路径恢复新listener，然后统一清空旧操作缓存。failed handoff从未发布至completedSettlement，不会重复rollback/release。正常路径及shutdown/restart并发继续共用同一原Promise，不在其未settled时重置。

原server-restart-e2e诊断加入一个正向pre-cancellation failure case：实际Bun listener先提供HTTP正文；传入在通知前明确失败的settlement回调，保留错误类型/消息；之后同一listener对象/port、同一真实process occurrence继续返回相同HTTP正文。该例只证明handoff错误合同与listener可用性，不称完整应用恢复或模型E2E。既有失败replacement case在真的stop后调用通知，仍进入原restore合同；source profile会从12例增为13例。共享helper已有正式“readiness前原错误”例，实际diagnostic补足物理listener证据。

重启诊断native-restart-01确实在Windows Job检查前置失败，cases=[]，无服务，原JSON/log/exit1保留。root批准沿诊断本身WMI/ShowWindow=0入口准备薄launcher，只负责原脚本进程身份/文件输出/固定owner期限，不复制factory或验收。scratch launch-restart-standalone.ps1将原Native1.3.14 checker用Start-Process Hidden运行在WMI创建的Job外PS owner下，stdout/stderr重定向自有文件，记录PID+win32 birth和原canonical checker occurrence；从启动固定600000ms总deadline，提前45000ms进入正常关闭，绝不随日志延期。沿自有privateTemp内明确allowlist的startup/launcher-started/ready/helper/restart-ready/admitted/child-phase原事实收集exact owner，不读auth/models或任意JSON。只对匹配PID+birth且端口实际由该PID监听的自有loopback发正常shutdown；必要时在原deadline内仅关闭这些严格匹配的自有实例，并标强制失败，不能写成正常join。正常执行依赖原诊断自己的finally关闭全部子例；薄层只在全部可证明owner dead且输出文件关闭后写终态。未删除Job前置、未改Supervisor或用户进程。

native-restart-02的原Native1.3.14 checker已经真实13/13 passed（两Project各两次restart/transfer/原owner结束/HTTP和file读写；所有错误restore及pre-readiness同listener可用合同均通过），且薄层观测全部native owner dead、未强制退出。薄层自身却把checkerExitCode读成null，因此terminal正确失败，不推断真实0。自有只运行`process.exit(0)`的5s有界PS进程探针实际复现：未pin Handle的88304物理退出但ExitCode=null；立即pin Handle的83724同样实际退出且ExitCode=0。不是产品restart问题。已保存02实际薄脚本与原诊断源码，修复薄层仅在Start-Process后立即持有其真实Handle；fresh native-restart-03按同600s/closeBy原预算完整重跑，02原事实不覆盖。探针及两个checker scope均不使用凭据或真实Provider。

### 最终原生重启结果与5s失败物理合同探针授权

native-restart-03原owner started1791912756836/deadline1791913356836，实际finished1791912802861；Native checker78392（win32:639275095569067051）真实exit0、13/13 source cases passed，薄层79332也已退出。terminal原证据中全部ownerDispositions为dead_or_reused、forced=[]、outputFilesClosed=true；原600s未延长。最终core typecheck-final.exit=0，exec句柄11179已join。此组是实际Native重启/所有权合同，不冒称真实模型或pending Permission重启验收。

root随后明确批准一项自有Native1.3.14真实5s timeout探针：只用既有Server.TestHooks.installBeforeRequest，在单个公开自有`/__403_hold`请求前持有一个不响应取消的Promise，再调用实际CLI `/shutdown`，不改生产、不替换memory metrics、不使用Provider/凭据。唯一预期是原serve的5000ms onTimeout确实同步记录失败并自行exit1；这不是正常业务完成，逻辑quiesce未join必须保留。自有Native物理owner从启动固定20000ms、外层成熟runHostCommandWithInactivity固定60000ms及30000ms无活动上限，均不续期。checker必须核对自然reason=exited/exitCode1、实际超时文本、原shutdown200、原request根清理、物理/输出join和端口释放；若20s外层导致终止则判探针失败。finally只使用原handle收尾，所有工具失败保留且不能改产品绕过。实际脚本和命令只落自有scratch；无服务常驻、用户PID操作、浏览器或UI自动测试。

timeout-01的hook真实进入、request.signal在shutdown后abort，但仅一个无活动句柄/无后续resolve的Promise没有使此Bun应用listener持续等待：Native84656自然exit0，shutdown后约323ms完成，physical/output/request/port全部关闭，probe因预期exit1未达成而exit1。不把它包装成超时合同通过，也不改生产迎合探针。已保存01实际三脚本及原始日志/receipts；自有hook修为A已真实证明的计时器持有Promise，固定15000ms后释放，仍远超生产5000ms但不延长Native20000ms物理owner。fresh timeout-02才重新验证相同超时错误合同。

## 最终实现与已完成验证（Root范围复核及公开证据归档）

五生产文件保持批准范围。最终共享原语返回原canonical settlement对象；正常和有限错误路径完整join，quiesce失败在同handoff上rollback一次后聚合错误。serve只在共享操作成功后保存completedSettlement，唯一handoffRelease Promise收敛并发release；pre-cancellation失败按实际transfer尚未建立清除失败缓存，restart restore成功后统一退役旧listener全部缓存。restart的listenerQuiesceStarted仅由真实beginRuntimeTransfer返回后通知，不以settlement启动猜测。原5000ms CLI失败退出合同及回调错误聚合以本记录后半段最终说明为准，前述中间outer-only策略已明确撤回。

| 正式后台检查 | 明确数量与退出 | 证据（自有scratch implementation） |
| --- | --- | --- |
| 新共享握手/错误/rollback/timeout callback | 9 pass / 20 assertions / exit0；初始红1pass/7fail、回调扩展红8pass/1fail/1 uncaught均保留 | red.log、green-unit.log、red-timeout-callback.log、green-timeout-callback.log、final-focused.log及同名.exit |
| 原runtime-startup-recovery真实取消通知 | 12 pass / 23 assertions / exit0 | related.log、final-focused.log |
| runtime-execution-settlement | 17 pass / 32 assertions / exit0 | related.log |
| server-lifecycle-occurrence | 8 pass / 13 assertions / exit0 | related.log |
| process-shutdown-task-lifecycle | 3 pass / 8 assertions / exit0 | ownership-matrix.log |
| instance-background-shutdown | 4 pass / 23 assertions / exit0 | ownership-matrix.log |
| mission-process-recovery | 4 pass / 8 assertions / exit0 | ownership-matrix.log |
| mission-streamed-recovery | 1 pass / 34 assertions / exit0 | ownership-matrix.log |
| core TypeScript检查 | exit0；最终句柄11179已join | typecheck-final.log/.exit |

去除重复执行后共8文件58用例161断言；正式命令使用Bun1.4 PATH和`bun run --cwd packages/opencorvus test`逐文件隔离runner。所有局部测试明确只证明其当前backend合同：Task测试使用真实canonical生命周期夹具；Mission streamed是实际恢复链加受控模型transport；都不冒充真实Sol。最后own scope `git diff --check` exit0。

### B05：原Native1.3.14真实待权限关闭绿态

沿B04相同本地受控流式Provider、真实公开Session/Prompt/Tool/Permission路径，fresh phase-b-05原started1791911320990/deadline1791911500990，实际finished1791911348655。pending Native11504与disconnected Native30184都自然exit0；各原shutdown200后约0.65s/0.47s得到终态。实际canonical assistant补完time.completed并记录MessageAbortedError/cancellation.source=process.shutdown，ToolOutcome为failed/process-execution-interrupted，session_prompt_owner为0。Permission仍原requested，没有伪造allow/deny/cancel。两个Provider各memory+prompt真实stream:true，物理/输出/request目录/应用端口/Provider端口全部关闭。独立只读`check-native-green.mjs`核查这些原SQLite观察和真实owner receipts，green-check.json passed=true，implementation/native-green-check.exit=0。

B05先于最终onTimeout异常处理与真实quiesce-start flag小修执行；其正常关闭主路径未再变化。最终代码由native-restart-03实际13场景和timeout-02覆盖新增边界，未把两组证据混成“pending restart已通过”。B04原两个Nativeexit1、B01–03工具前置失败及离线预检错误原像完整保留。

### 最终重启与真实5s失败退出

native-restart-03的final-observation明确13/13 passed、25/25已观测owner dead_or_reused、forced0、scanErrors=[]、checkerExitCode0、输出文件已关闭、WMI launcher也dead。原Native1.3.14运行最终源码；含两Project并行各两次串行restart后的真实HTTP/file读写、失败替换restore、pre-cancellation原listener继续服务、managed/owned/tree所有权拒绝、原owner过早死亡与SDK owner合同。正常shutdown和restart物理证据均来自原checker而非单元mock。

timeout-02原Native86240 / win32:639275101955217418 / occurrence1f850a07-93ac-40c2-ba49-ecc3b5f37a36，从1791913395412固定deadline1791913415412。实际hook进入1791913400585、shutdown200起始1791913400626、socket signal abort1791913400845；原CLI输出`listener quiesce timeout, escalating: 5000`及`Server stop timed out after 5000ms`，1791913405989自然reason=exited/exitCode1，距shutdown5363ms且早于原20s。physical/output/request cleanup/port全部true；outer固定60000ms/30000ms inactivity runner exit0、settlementConfirmed=true。runtime-settled日志真实完成，但注入handler逻辑drain仍未完成，记录`unfinished-by-injected-uncooperative-handler; process-owned-failed-exit`；这是预期错误合同成功，不是正常业务完成。scope保留原实际三脚本、phase、stdout/stderr/result、原launch与exit，timeout-01原失败未覆盖。

### 当前边界与交接

已完成根因修复、聚焦后台正向合同、实际Native正常关闭/重启/失败物理退出及核心类型检查。未执行真实GPT-6.1 Sol或GUI；没有把局部/受控Provider当模型端到端。尚未实际覆盖“待Permission的完整CLI restart模型流程”，其它平台、原395具体metrics内部等待也未从本批反推。原真实395失败及402 Main批准卡缺口分别保留，403没有更改Permission终态策略、Session/Task/Mission控制实现、UI或ProcessSupervisor。当前没有403活跃服务/模型/页面；所有exec、Native、WMI owner均已收尾。由root负责最终全差异复核、公开allowlist归档、共享索引和独立提交/上游同步；本agent不自行归档或提交。

root最终复核要求检查已修改的runtime-startup-recovery全文件。只发现两个过期核心断言用`fetch(...).rejects.toThrow()`表达旧listener不可连接；这没有明确错误合同且以“不连接”为核心。按当前规则，保留原实际恢复错误的精确断言，将这两个物理释放验收改为在原host/port真正绑定replacement listener并得到HTTP200和确切正文，finally正常stop。两处复用该测试文件内同一小检查函数，不改产品、不扫描无关UI/测试；测试数量和断言数仍12/23，须正式runner重跑此文件并复验类型。

上述正向修正已正式复跑final-positive-review：12pass/23assertions/exit0；typecheck-positive-review.exit=0，exec句柄78361已join。distinct总数仍58/161，重复运行不增加覆盖。仅这一个已触及测试文件变更，五生产文件继续冻结。最终exact源文件和公共证据清单由scratch `handoff-403.json`列出，root可逐项归档；明确排除owned-temporary/runtime/db/auth/models和workspace-before的并行改动，不做目录整体复制。

## Root交付复核

Root独立读取完整五生产差异、restart诊断新phase合同、正式测试及handoff原事实；另指出并收敛CLI超时不可依赖outer、restart启动标记不可先于真实quiesce，以及两处泛化fetch失败断言。当前范围为8代码/测试文件和本spec；[明确公开证据归档](../../artifacts/2026-10-13-native-shutdown-pending-permission-403/README.md)保留207原证据与交接，共208个gzip源。原A/B工具失败、B04业务红态、restart01/02启动器失败及timeout01不成立的夹具均未覆盖。

Root采用exact允许清单、原字节gzip恢复和有限凭据模式扫描，只证明证据保存，不替代功能检查或使用无效源码hash门槛。归档不复制owned-temporary/runtime/db/auth/models、二进制或peer workspace-before改动；公开local-controlled-provider仅为测试值。真实Sol/UI与待权限完整restart、其它平台及395 metrics内部时序仍未验收。共享当前runtime readiness与双语未发布日志同步本次合同，提交/上游同步/正常push使用本批Git回执。
