# Native 外输出接收端共享机制调查

## Recall

用户要求持续批次并行调查UI（User Interface，用户界面）/功能，根因与影响先落盘，再有证据实施、真实桌面/聚焦正向测试、必要的授权GPT-6.1 Sol流式验收、范围commit/upstream merge/正常push后继续。用户没有停止。本轮上一批66f796d2283be1900a9859e4487c1188ad22f9f7已正常push0且上游ancestor0，92测试847断言、14图、前后普通退出0。当前Goal（持续目标）仍active；上一turn是有效进展，不宣称整项目或原Native疑点已完成。

原调查来源为本任务自有Native Host前态 before-failed 聚合异常，但其AggregateError子原因尚unknown，不能从最后标题或另一个deadline终态猜原分支。66outcome后态发生900秒deadline_exceeded/exit1，其Facade/Supervisor物理、输出、request结算fulfilled；fresh post普通退出0。链接批两个独立实例普通shutdown0，这些都不能排除断外sink（输出接收端）风险。禁止降级为偶发或模型行为。

开始git status、上轮Recall、原runtime事实与scope已核对。其它MCP（Model Context Protocol，模型上下文协议）、Provider、更新日志、压缩恢复和共享索引改动保持。原地当前分支；rootUI-owner批并行，Native本规格为调查，未授权产品修改或UI自动化。一层限定file_alias_audit准备scratch，不再委托；主agent已读全部controller/host/producer/evidence/physical observer源码以及原成熟native-host.ts，对照真实Facade、shell/process-supervisor、process-occurrence和当前架构接口。当前可定位的生产入口和完整矩阵由该只读审计逐点补证据。

## 现象、触发候选与控制流限度

1. 原temporary Native Host将Facade pipe stdout/stderr for-await转发自身process.stdout/process.stderr，用destination.write(chunk)，false才await once(destination,drain)，再allSettled(handle.settled,两external drains)。旧聚合错误可能来自原Facade物理/output/request分支或任一外drain；当时没有逐分支原cause，所以unknown。
2. 生产Facade的公开terminal/outputSettled/settled与raw Supervisor exited/outputSettled/settled不是相同角色；公开settled由adapter聚合。不能同一Promise又改名为独立Supervisor证明。若原Promise实际alias，则记录同reference ID与相同来源而不当独立证据。
3. 外parent Reader关闭是真实OS（Operating System，操作系统）管道行为；关闭日志文件或emit(error)不会证明sink损坏。默认全局stdout异步错误、once等待、Native文件转发/消费/EOF（End of File，文件结束）、deadline/owner退休的实际分支仍需运行事实，不能预设错误码或普通0。
4. 当前caller pipe转发与生产Facade inherit转发是不同路径；两基础实验只直接覆盖前者+真实生产Facade/Supervisor，不能冒称所有inherit/MCP/browser或Task/Mission/Session occurrence（执行轮次）已验证。若新证据发现生产入口缺陷，必须立即扩共享矩阵并先完成补充根因分析，不先加全局listener吞错误、猜完成或只改原fixture。

## 原来源和唯一实现约束

scratch host真实调用supervisedHostProcessFacade与原ProcessSupervisor/Windows Job，不复制adapter或NativeSupervisor算法。已导出的setWindowsRequestObserverForTest仅捕获真实request字段，不写request、assert准入或emit异常。一个透明非async tap调用原spawnHostCommand一次/原receiver/原args，并return原Promise；之后被动观察同handle和原Promise。观测Journal自身I/O（Input/Output，输入输出）异常不吞，也必须归为工具错误。该instrumentation两实验相同，可能改变微小时序，不能用它宣称精确性能。

Caller- supplied experimentID、Facade occurrenceID、Host runtime occurrenceID、Supervisor request_id、Target自身observed occurrence和PID（Process Identifier，进程标识符）/birth是不同角色；实际ready/request owner/helper/target字段建立关联，不强制UUID（Universally Unique Identifier，通用唯一标识符）相等，不用自算hash或消息合成身份。

通过[Node readable.destroy合同](https://nodejs.org/api/stream.html#readabledestroyerror)和[events.once合同](https://nodejs.org/api/events.html#eventsonceemitter-name-options)核对使用成熟API（Application Programming Interface，应用程序接口）。本机实际Node25.7/Bun1.4/Windows行为仍由运行验证，不能以官方当前版本推断错误或收尾结果。

## 首轮具体范围与验收

1. 仅两个新owned实例：native-sink-baseline-01a133-v1与native-sink-reader-01a133-v1，放既定C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-13下；new mkdir要求不存在、真实父目录非reparse，home/runtime/temp/evidence独立，无Provider/模型/凭据。Node controller隐藏spawn本人Bun1.4 Host→生产Job finite producer，期限45秒，生产收尾预算沿原实现。
2. 真实ready后bound Parent/Host/Target PID+birth、request当前owner/runtime、各occurrence角色；通过producer唯一/health/<experimentID>校验实际身份。ready写原独立文件，不依赖stdout。producer仅接受绑定自己的/POST shutdown一次，200响应后200ms写同一65,536字节UUID首尾内容与独立stderr尾，再正常exit-intent0；intent不当物理退出证明。
3. baseline两个reader正常排空。fault仅stdoutReader===this child.stdout调用无Error参数destroy()，等待自己的close，记录真实destroyed/closed与stderr仍有效，再同一次normal shutdown。禁止全局异常处理器、stdout.error吞噬、注错hook、换stderr目标或改变原drain算法。
4. 逐个具名记录：Facade terminal/outputSettled/settled，raw Supervisor spawnPromise/exited/terminalFact/outputSettled/settled、Native external stdout/stderr两个drain、controller Host exit/close与其两个reader drains，原request markers/目录、真实owner metrics退休及Target birth观察。原错误code/cause/stack/Aggregate子errors全部保留，pending/unavailable/unknown不算成功。
5. baseline资格必须实际normal terminal0、两raw/output/settled真实fulfilled、Host exit0、原owner退休、Target dead_or_reused、同request身份、完整stdout尾和正常200。fault controller0仅表示观察报告收齐，不能等同Host/production普通0；fault不设伪造pass，主agent根据真实branch判断。stdout被closed后保留实际parent drain错误，不把它藏进日志。
6. 同一normal shutdown的dispatch事实先记录；响应未知或JSON（JavaScript Object Notation，数据交换格式）解析失败后不得!mutation盲重发。仅尚未dispatch且ready完全绑定时可作setup failure普通cleanup；所有首次失败保留。Host awaiting wholeAllSettled超过观察期限记录pending，不kill用户进程、不重启、不因观察timeout认定Target terminal。第一轮controller join观察上限为45s+20s；工具返回session继续同一handle，有进展时不持续tail无变化日志。
7. 独立read-only physical observer仅在需要并经root授权后读取该原ready birth，用生产observeRuntimeProcessOccurrence，证明Host/Target exact_live或dead_or_reused；不替代output/request结算，不创建假settled。若自有Target仍live，只能按已绑定同scope生产Facade deadline/原owner清理合同处理；没有精确判断时保留事实并扩分析，禁止猜PID kill。

## 必须横审的共享矩阵与当前缺口

| 生产范围 | 必查正常/终态/失败/重试恢复/串并行与隔离 | 本轮资格 |
| --- | --- | --- |
| 生产Facade Host/Task pipe及Native Job | terminal、输出完整性、request cleanup、owner真实退休，目标退出与external sink失败分开 | 首轮真实Host有限producer；Task尚未跑 |
| Facade inherit stdout/stderr | actual forward Promise与目标sink错误怎样进入settled，nullable stream不是成功证明 | 只读调用面，需actual继承实验 |
| shell/工具命令与host探测 | callback和output consumer是否完整await，deadline/cancel/exit原原因，重试occurrence独立 | 入口清单补审，未运行全部 |
| browser launcher | 本人launcher stdio/HTTP正常close及真实断sink；不操作用户浏览器/进程 | 未运行 |
| MCP transport Host/Task authority | actual inherit stderr及readonly pipe response，client断连、Task退休和request排空 | 未运行 |
| Task/Mission/Session durable轮次 | 正常、终态、中断、恢复、重启/orphan原PID/birth/marker/disposition，旧cause保留 | 基础fixture不得冒称E2E（End-to-End，端到端） |
| 同backend两个Project串/并行 | shared temporary base但唯一request_id/owner，两项目一坏一健康；不可用两个独立runtime代替 | 未运行 |
| 凭据/真实模型必要条件 | 如后续需要Sol，auth和models成对、凭据可用/目标projection/实际请求model分别资格，所有LLM交互流式 | 本轮0模型/0凭据，无必要性 |

只有代码、真实持久化/marker与实际运行排除共享根因后才能判局部工具问题。正常baseline不是排除，刻意断pipe结果也不是自动产品bug；需要按真实contract和生产caller归属判断，工具故障先修工具并重跑原验收。未知外sink异常保留为未解决，不能用“已修UI/测试通过”代替。

## 文档、提交与当前阶段

本规格与artifact唯一入口进入root/month/artifact README，当前package docs检查同步。首轮只修改scratch与自有输入，不授权产品改动；真正修复须再落盘根因/影响及聚焦正向功能/真实checker，删除旧重复实现。原脚本/数据/log/failed/output/exit/具名facts归档gzip原bytes；禁止删失败或hash门槛。调查可与UI批分开范围commit，正常fresh fetch/merge审查全待推送集合与push，未完成共享矩阵明确保留后续，Goal不会complete。

准入时主agent读脚本、要求单一dispatch事实与严格baseline资格并重读后授权；当前已执行v1工具失败与修正后的两个v2/observer，见后续原事实。尚未产品修复或排除完整矩阵，下一批继续新共享候选。

## 首轮执行准入与入口补审

### v1工具资格失败及修复后的v2准入

baseline v1实际controller86732/owned Host85812 exit与close均1，stdout0B/stderr915B原样保留。错误为OpenCorvusTestRuntimeIsolationError / INVALID_OPENCORVUS_TEST_RUNTIME：scratch isolateEnvironment错误设置OPENCORVUS_TEST_HOME却没有test-runtime preload及OPENCORVUS_TEST_PROCESS_ROOT，Global在原Supervisor import/spawn前拒绝。Hostready、Target、raw和request均unavailable；host-events为空，shutdownDispatched=false，没有关闭reader。不把此失败认定产品sink或原Aggregate复现。五脚本旧原字节保存validation/baseline-v1-source，修前与修后node --check均五项0，仅删测试专用OPENCORVUS_TEST_HOME一项，普通HOME/USERPROFILE/OPENCORVUS_HOME仍独立，v1目录不可重用。

主agent重读修后environment后限定授权新的native-sink-baseline-01a133-v2，完全结算后才native-sink-reader-01a133-v2；真实exe/45秒期限/同一shutdown准入/原错误与全部分支资格不变。optional observer只读绑定这两个v2原ready，不能重启观察超时的实例。v1 failure仍独立保留；全部矩阵与原Aggregate原因继续未知，不降低验收。

主agent已重读修改后controller87–98/151–214、host29–77及其余全部脚本：真实fetch前持久记录shutdownDispatched，只有ownershipBound且未dispatch可setup普通cleanup；baseline要求原raw/public每分支、Facade实际terminal0、rawPromise/同handle、原durable request/native ready/helper request关联、request目录实际ENOENT、metrics退休count0、Target dead_or_reused和两个controller drains/完整尾部。fault仍保实际Host/drain错误，不把controller报告状态当生产成功。允许先node --check五个本任务MJS（JavaScript模块）纯语法，再一次baseline v1；对照完全结算后才一次close-stdout-reader v1，固定45秒期限。Node隐藏进程、Bun1.4原exe及五文件均已读；无其它process/window授权。optional birth observer只用于这两精确run的结算后只读核对，可按原ready记录运行一次；所有来源原样保留。

独立审计全仓生产入口补证：util/process-facade.ts69–85、util/process.ts119/188/199与cli/cmd/session.ts208（Host/Task/inherit/pager）；mcp/browser/node-launcher.ts44/58/59/193（stdio/http）；mcp/index.ts1781/1785/1799（Host/Task stderr inherit/custom/protocol stdout）；shell/shell.ts188/198/377/387、tool/bash.ts384、session/shell-exec.ts583；file/ripgrep.ts210、browser/runtime/node-executor.ts220/244、engine/codebase-tools.ts202、execution-capsule/file-broker.ts104、expert-squad/package-tool-capsule.ts500、tool/plugin-tool-host.ts152；plugin/index.ts181/543与shell/command-inactivity.ts34/40。监督的Task正常/取消/终态在shell/process-supervisor.ts422/596/627/639/666与task-api/index.ts3203，owner/request在同Supervisor224/1167/1870/1940，restart/orphan853与server/restart-handoff.ts126；lineage/epoch恢复在engine/task-session-lineage.ts158、session/prompt/owner.ts287、mission/process-recovery.ts135/199、server/server.ts363。

这些位置只读核对，不当真实运行排除。Node adapter owned_process/detached及ACP（Agent Client Protocol，代理客户端协议）stdout writer是另一生产边界。现process-checkpoint-lifetime/process-shutdown-task-lifecycle测试仅作结构参考，未运行、未认为覆盖external目的端失败或完整两个Project隔离。首轮仍不能归因旧Aggregate子分支或宣称完整Mission/Session恢复正确。

## v2实际运行、新共享候选与下一矩阵

baseline v2 controller76512/Host85880/Target80288实际0，原request05de591c-db67-4b1b-92dc-46c969468b37，raw/public/native/parent所有具名分支fulfilled，stdout65,536B等同原明确输入、独立stderr61B完整，真实唯一shutdown200/requestDir ENOENT/ownercount0/Target原birth dead_or_reused，baselineQualification=true；只读physical observer0。故障v2 controller80168/Host81060实际1而Target13496 exited0，requestca047e46-c804-404b-9f6c-907720ac13c6；仅关闭本人reader后唯一普通shutdown200。原write13:13:23.593Z返回false，once(drain).594Z以EPIPE(-4047/write)拒绝（不是同步write throw）；退出for-await source iterator destroy继发ABORT_ERR，经Supervisor包装原Error ref14，raw output与Facade output Promise ID5同来源，不作为独立证明。双settled拒绝同原错误；Native stdoutDrain EPIPE、stderr61B完整；父stdoutDrain ERR_STREAM_PREMATURE_CLOSE/0B、stderr61B完整，Host exit/close实际1。原聚合两cause[EPIPE,ABORT_ERR包装]完整保存。request最终清理、owner0，另一次observer0原Host/Target birth dead_or_reused；都早于45秒截止，不重启/kill。

立即横向审计的新共享candidate已具代码和运行证据：util/process-facade.ts74使用Promise.all([terminal,outputSettled,supervisorSettled])，任何失败会提前拒绝；Host/Task唯一spawner69/70共用。通用util/process.ts390–410即使allSettled，raw.settled已经是提前拒绝的adapter，无法恢复原Supervisor等待。实际Facade rejected .624Z/Host aggregate .626Z，而rawSupervisor.settled rejected/request ENOENT .629Z/registry退休.647Z。后续cleanup错误可能不进入先前公开cause，本次cleanup成功故该错误分支未知。原Supervisor1940–1951以allSettled收物理/输出后cleanup，registry224/1167和Task lease422等待原handle而非公开adapter。严格dispose/terminate1271–1315及runProcess.finally650等待四路，可与单独await publicsettled分开；自动abort/deadline后台terminate仍须实际组合矩阵，不能借成功路径证明。

生产inherit仅stream.pipe(process.stdout/stderr)、未纳目的sink结算；本次for-await EPIPE→sourceabort不能当inherit原行为。CLI Child.exited只是physical，browser/MCP strictclose与exit notification不同，MCP stderr直接write、不waitdrain；全部入口与原因在artifact分析报告。当前server-runtime-readiness合同只允许complete settlement清理isolated runtime，公开reject不是完整cleanup证明。原matureUI Host catch写fact后exit1允许早退候选，但写盘时序与旧nested/markers缺失，不能倒填旧Aggregate或断言旧request被截断。新scratch最后bounded metrics给raw多约20ms，须保此资格限度。

81份原facts/causes/scripts/检查与v1源码归档artifact，所有失败原bytes保留；未修改产品。下一正式方案必须明确publicsettled错误barrier/原cause去重唯一实现，追审全部Host/Task pipe/inherit/normal/错误/取消/期限/重试execution epoch/restart orphan与同backend两Project，先补必要真实checker证据再修。原未知和完整共享矩阵继续未完成，本阶段仅完成首轮调查，不称整体完成。Git结算待后续。

本批最后文档检查docs:check348 operations/26 groups exit0、architecture-index19docs0。调查记录及原artifact与Explorer批次同一明确范围提交（没有Native产品修复），Git/push以真实后续receipt为准；旧根因与矩阵未完成明确留作下一批，Goal持续active。
