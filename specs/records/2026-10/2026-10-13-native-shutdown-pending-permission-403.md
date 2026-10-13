# 403 Native serve 在 pending permission 下的关闭收敛调查

## Recall

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
