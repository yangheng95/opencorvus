# 主 agent 二次复核

## Recall 与基线

用户要求继续独立测试和修复，沿用既有 worktree 与真实 Provider 隔离使用授权。本轮在 clean 的 `830972c0d` 上开始，独立 agent 负责方案、checker 和真实运行；主 agent 负责交叉审查、索引、回归和交付。生产运行期间不变更基线。

已重读上轮 `2026-10-13-continuous-goal-crash-recovery.md` 的 Recall、当前 continuous-goal 架构、根 AGENTS.md 和 benchmark-debug-template skill。相较上轮，已发布更新涉及权限消息恢复、压缩投影、引用保留和后台停机；continuous-goal 的 store/controller 未改变。没有因上轮通过而跳过新基线验证。

基线命令使用 Bun 1.4.0 和仓库隔离 runner：

```powershell
bun script/run-tests.ts test/continuous-goal.test.ts test/continuous-goal-independent.test.ts test/continuous-goal-process.test.ts test/continuous-goal-crash-checker.test.ts
bun script/run-tests.ts test/continuous-goal-runtime.test.ts
```

首组 33 项、189 断言通过；Chat 实际进程与 Prompt 重启集成另 1 项、4 断言通过。Chat 使用受控流式 Provider，只证明当前集成合同，不能替代本轮真实模型验收。原始 Chat 输出见同目录 `parent-chat-baseline.log`。

## 实施前的共享恢复审查

- Chat 与 Mission 的已接受目标输入通过 `SessionWake` 恢复；Task 使用既有 root ingress。共享 `SessionPromptOwner` 保持唯一物理所有权，目标本身不持有第二份队列。正式 serve 启动的 host recovery 与全局 Scheduler 提供项目发现。
- Mission `process-recovery.ts` 可以新建精确恢复 Message，也可以重放仍 actionable 的持久恢复 Message。后一种保留最初的 reason，并把当前 trailing incomplete assistant 合入实际 terminalization 集合。重复崩溃时，应分别证明恢复 Message 的原始因果及每次实际死进程/新 owner，不得强制改写旧 reason。
- 每次中断必须在旧进程真正退出后、新进程启动前保存事实；实际 reader、assistant、Prompt generation 与接受输入需绑定同一次执行。单纯 reader 字节、最终状态或模型自述不能证明命中断点。
- 生产 `missionTaskConditions` 同时限定 project、source、actor、Mission ID 和 canonical Session ID。子 Task 取证必须保持同样的身份边界，并包含 Task ingress、execution epoch、activation 与最终生命周期引用。
- Mission 完成依赖 `panel_complete_mission` 回执；子 Task 场景须核对完整当前子任务集合、真实产物读取引用及完成轮次。公共 accepted outcome 是生产侧复核后的结果，不能用文字“完成”代替。
- `session/llm.ts` 在每个 stream 开始时捕获继承目标，usage 在原账本写入事务中关联。子 Task 恢复后的新用量须按 Session 谱系和实际模型归到原目标；已中断但远端未返回的用量保持未知。
- 检查器初始化中已复制的 auth/models 也必须位于清理保护范围。凭据可用、目标投影、实际请求模型是三项独立事实。

上述结论已发送独立 agent，尚未作为真实场景通过结论。未发现有足够证据直接修改生产恢复实现的缺陷；后续失败须继续按全入口、正常/终态、重试/重启、串并行和项目隔离审计。

## 运行与最终复核

### Task repeated run1

独立读取保存事实的 `review-evidence.mjs` 已通过，结果为该 run 的 `parent-evidence-review.json`；复核脚本未调用生产 checker，也未发起 Provider 请求。

- 三代 PID 为54756、85060、84164，分别7、1、4个真实请求，共12。前两代在reading且新 Tool request已持久化时SIGKILL；每次退出后的assistant保持未完成，下一代由生产恢复结算为ProcessExecutionInterruptedError。
- 原目标 `pev_g0VXvxRAi00dEScMmcnv`、continuation `pev_hAlLrgvL0qmfiZUVegEh`、原输入及Task epoch1均保持。两代新控制输入分别引用刚中断的assistant，保持同一root ingress。最终goal complete、turnsAccepted=1且Task公共状态completed。
- 目标累计212967 token，原usage关联唯一、总和相等，第三代新增3条归属正确的已结算usage。中断且未返回的远端用量未知，没有补写。
- 人工读完公开正文：两阶段各三项，六项都有可观察证据和通过条件；实际先输出说明，再更新目标并完成Task。模型正文没有被用来证明物理崩溃。
- 三个服务均退出，第三代正常SIGTERM，去重端口不可访问，auth/models隔离副本已删除。所有请求使用精确gpt-6.1-sol且stream=true。

### Mission repeated run1 失败与共享审查

第三代真实runtime recovery在输出六项说明并完成goal后，仍在Mission正常结算过程中被120000ms恢复绝对期限取消。服务PID58308仍存活，原模型请求仍有真实活动，后续MessageAbortedError却写为process.shutdown；没有取得panel_complete_mission回执，不能以goal complete宣称场景通过。失败run保留，后续用新run复测，不修改原预算。

原始事实独立核对：恢复terminalization时间1791896592918，异常assistant完成时间1791896712944，相隔120026ms；最后reader字节时间1791896712543，reader aborted时间1791896712924，仅隔381ms。checker在后续180秒真实无活动后判失败，共23次请求；最终才SIGTERM收束第三代服务。三个进程、端口及配对副本均已清理。这些时序直接排除了“无输出超时”和“checker提前关机”的解释。

父级独立跟踪了以下控制流：

- `mission/process-recovery.ts` 的默认绝对deadline信号从恢复前准备传到SessionWake，直到等待整个reply completion后才清理。timer没有以真实reader活动刷新，也没有在activation后结束职责。
- `session/wake.ts` 的caller signal直接取消RuntimeExecutionSettlement reservation，其onCancel无条件生成process.shutdown来源。实际关机gate与单个caller取消共享这一回调，故持久化的“进程关闭”不能证明物理进程死亡。
- 全仓生产gate requestCancellation只有`server/server.ts`的收束入口（包含session_wake_loop）和protocol publication后段；其余SessionWake caller取消来自目标控制器、调度、Mission公共入口和恢复等不同authority。已有typed cancellation origin应保留。
- Task原root-ingress的absolute_deadline由已持久化明确policy决定；Chat和目标原input恢复没有Mission这条默认整轮120秒截止。Mission关闭/保留的120秒针对有界副作用收束，web工具时限针对具体HTTP请求，不应与活跃模型恢复整轮混同。
- 执行期已有EngineConfig活动设置、stream-activity reader/tool进度与owner生命周期。不新增第二套活动计时器；准入完成后清除恢复计时器，同时保留caller/lease取消和真实owner收束，是本轮拟采用的职责边界。

权威语义核对：[Node.js AbortSignal.any](https://nodejs.org/api/globals.html#static-method-abortsignalanysignals)保留触发输入的reason，[AbortSignal.timeout](https://nodejs.org/api/globals.html#static-method-abortsignaltimeoutdelay)按固定delay触发。库不会自动把绝对期限解释为无活动时间，错误归因来自本仓调用代码。

重复Mission修后原场景与子Task尚待完成。新正向测试须验证跨准入期限仍能正常结算、准入前超时的明确错误、激活后原caller取消及真实关机的来源；并复核不同Project的Session所有权边界。

### Mission repeated run2 修后复核

`review-evidence.mjs`对新run逐代物理事实与公开结果复核通过：PID78608、85144、38668，分别12、1、11次请求，共24次，目标365132 token。两个cut都有正文且退出后保持未完成；第二代重放原目标输入，第三代按第二cut的exact opened/generation/assistant新建runtime recovery Message。目标、continuation与一个自动轮次保持。

第三代中断结算时间1791897446262，最终Mission完成回执时间1791897647090，相隔200828ms，确实跨过旧120秒故障点后正常完成。所有请求精确流式模型一致，6条第三代目标usage与原账本关联一致。公共outcome accepted绑定同一完整Tool回执，随后最终assistant正常stop。已人工读完两阶段六标准和最终回复，证据/通过条件齐全。三个服务及配对凭据已清理，端口关闭。

父级另在生产修复后独立运行20项共享合同（运行时结算17、调度Message身份2、Chat进程恢复1），43断言通过，见`parent-wake-regression.log`。这些是后台合同/受控集成，真实Provider证明来自单列的run2。

### 附带恢复集成用例诊断

已运行的`mission-streamed-recovery.test.ts`失败：脚本化模型完成producer恢复后，root只执行no_action，tester尚未启动，最终公共Mission outcome未accepted。这个用例通过真实工具/调度和脚本化模型验证Task失败后人工接受缺口恢复，并没有调用本轮Mission process-recovery；不能仅凭末态判断生产根因，也不能忽略已发现的本地测试问题。

已读完整用例、dispatch outcome/settlement、build adapter与临时Git项目fixture，并搜索同语义调用。直接分支要求latest producer dispatch settlement为terminal_success，当前旧诊断只保存Tool状态，缺少该判定实际输入。主agent先补充失败时的dispatch lineage/settlement及相关artifact事实，再重跑同一用例定位；暂不修改其编排逻辑或生产代码。若确认旧fixture与当前合同不符则修fixture后复测；若发现调度缺陷按共享机制继续审计。原失败日志保留。

补诊断后单次、两次顺序以及两份独立隔离实例并发重跑，共5次均通过（每次1项、34断言）。通过样本中第4次root决策读取到producer continuation的terminal_success，此后真实陈旧continuation错误、正确重试、tester和Mission接受均按原合同完成。原首次失败只保存了Tool状态，临时数据库已由旧fixture清理，无法反推其dispatch settlement究竟是partial、infrastructure_failure或尚未提交。当前没有证据把首次失败归于本轮deadline修复，也没有足够证据排除所有共享调度根因。

因此仅保留失败时root决策输入与完整Task artifact诊断改进，成功路径、75秒旧用例等待预算和Mock模型决策均未变。首次失败根因仍未证实，作为未闭合观察保留；5次绿不替代根因结论，也不将它包装为“已修复”。对应原失败为backend-focused日志，复跑为parent-streamed-diagnostic、repeat和concurrent-1/2日志。

独立agent再次复核确认了另一个确定的checker缺陷：该用例用启动后的75秒固定总等待，到期后直接把仍active的状态交给最终审计，既没有真实无活动判断，也没有记录超时事实。原79732ms失败与此采样边界吻合，但缺失旧活动轨迹，不能据此断言初次失败全部由它导致。修正计划为复用现有benchmark活动窗口和SessionStatus真实活动读取，以Session/Tool进度、Task生命周期与artifact前沿刷新同一75秒无活动窗口；固定轮询/续租不刷新。到期显式记录最后活动与当前因果事实并报错，不再伪装成正常最终审计。Mock决策及生产调度不变；修改后重跑原用例。首次生产根因未知的边界继续保留。

### 后续复现：活跃 worker 的领域结算被提前替代（修改前分析）

新无活动checker重新捕获失败并保住了关键事实：第三个producer continuation `art_hQDYkP29g59aZWOHvFh4`在1791898639396被写入`partial / recover_dispatch_domain_settlement`；同一final Message `msg_g0VXw84bJ00BxgpR3M2x`的正常`build_host_observation`在1791898641404成功写入，晚2008ms。root依据真实partial结束当前输入，tester尚未派发，之后确有75000ms无业务活动。原始完整日志及提取事实为`parent-streamed-inactivity-fixed.log.gz`、`parent-streamed-failed-dispatch-facts.json`。这次并非仅靠失败末态推断。

控制流根因：`reconcileAbandonedDispatches`在检查delivery owner前先调用`reconcileTerminalAgentLifecycleDelivery`。Session terminal只证明模型/Session执行已结束，Build adapter仍可在同一活跃pipeline内收集Git观察并写领域结果；terminal recovery却在缺domain settlement时先写partial。正常adapter之后经first-committer-wins读取到该partial，不能再发布terminal_success。旧路径只在nonterminal分支检查owner，因此终态前后出现不同保护。

全仓调用面已查：terminal lifecycle delivery生产入口只有共享scanner和dispatch-agent的正常/失败delivery回调；后者的`run`或异常处理先写真实settlement再交付。所有adapter、单次dispatch与collection都通过该scanner，Mission子Task同样继承；Chat普通Session不产生此Task dispatch入口。现有`dispatchDeliveryOwnerRecheckAt`已统一本机pipeline/Prompt、最新admission transfer owner、真实进程occurrence的live/unknown/dead观察，且跨project按确切lineage与descriptor查找。已有settlement可以安全重放delivery；只有缺settlement时才需要在恢复领域终态前验证owner已丢失。取消、重开epoch和collection的原有准入/预算/去重合同保持。

实施计划：把现成owner recheck移到missing-settlement分支的terminal recovery之前，继续保留已settled delivery的优先重放；不增加状态、后备实现或新所有权来源，也不改写已有partial。独立agent在新聚焦文件验证活跃本机pipeline/peer的有界重查、之后真实terminal_success交付，以及dead owner缺domain时仍正常恢复partial。主agent重跑原streamed完整合同并复核当前架构。原用例的120秒外层安全上限不足以覆盖75秒无活动诊断后的物理清理，调整为180秒独立测试安全上限；75秒业务无活动值不变，原失败不续跑。

### 共享所有权修复后的验证

生产修改仅前移既有owner检查，原streamed完整合同随后通过1项34断言（`parent-streamed-owner-fixed.log`），Mock决策没有改变。父级独立复跑新terminal-owner三项和既有abandoned-dispatch五项，共8项130断言通过（`parent-final-task-control.log`）。新三项绑定真实本机detached pipeline、物理peer进程存活及退出，明确验证30秒有限重查、正常terminal_success的exact settlement交付、死owner缺domain时的partial及exact lifecycle来源；既有五项覆盖collection部分准入、epoch终结后重开、跨descriptor分页和预算耗尽。

新测试初跑的数值比较失败已单独定位到Bun1.4.0 matcher行为：`toMatchObject({wakeAt:expect.any(Number)})`会将被测对象的wakeAt原地改为`Any<Number>`对象。父级与独立agent均用最小独立程序复现，见`bun-matcher-observation.md`。先保存原数字再断言，使测试保留原来的完整有限重查合同；生产时间值与定时常量未变。另一fixture来源断言修为真实成功settlement的engine_artifact与死owner恢复的protocol_event，并绑定精确ID。

当前完整root typecheck的8个实际检查workspace均通过（`root-typecheck-final.log.gz`）；docs:check为348个操作、26组，architecture-index为19份当前架构文档，均通过。首次缺少settlement证据的旧失败仍不能倒推出唯一原因；后续捕获的同类共享竞争具有直接时序证据并完成修复及正向回归，二者的证据边界分别保留。

### Mission 子 Task 独立复核

`mission-child-run1`实际Task和目标完成，但第65次请求被事先冻结的64次上限拒绝，未完成Mission正常回执，因此保留failed。没有续跑或修改该run的额度；新run2事先固定为96次，原输入、模型、一次物理cut、180秒无活动、1600000 token和3个自动轮次准入预算不变。

`mission-child-run2`完整通过。父级通过`capture-session-lineage.ts`对已停止私有数据库执行只读查询，独立导出4条精确project的Session谱系；再用`review-evidence.mjs`读取持久化文件，未调用生产checker或Provider，输出`parent-evidence-review.json`。PID79780在真实7字符正文后SIGKILL，新PID85072正式启动，通过Task ingress自动恢复同一子Task `tsk_g00VXwDWps00q3xF6qSs`；原goal `pev_g0VXwD29900rrvj5dD3B`及cut continuation `pev_hg9UNMOPvlyfEHLRXNZ9`保持。两代14+36，共50次请求，均为精确流式gpt-6.1-sol。

子Task公共completed epoch1与Mission接受的terminal event `pev_g0VXwG0fh00sROQKq1Fl`一致。创建Tool来自接受原goal-controller输入的Mission assistant；public Mission accepted outcome、完成Tool回执和随后final stop对应同一身份。父级人工读完Mission公开正文及实际Artifact读取输出：正式交付8466字节、独立报告11308字节，分别读取0–8190和剩余字节，两页无间隙直至complete。六项标准均包含可观察证据和通过条件；报告当时保留的完成决定关联由后来真实Task交付决定补齐。文本用于验收内容，物理恢复、模型和完成状态另由真实事实证明。

独立重建child Session后代集合，与原Provider usage账本逐ID比较：子Task已结算1270875 tokens全部关联原goal，且恢复进程新增child usage；goal总计2110219 tokens与账本求和相等。1600000是新自动轮次准入阈值，已经接受的Task生产、独立复核与当前Mission输入可以继续结算，因此不能把它解释为进行中执行的硬费用上限。中断但Provider未返回usage的成本仍为unknown。

两个服务均退出，去重端口关闭，auth/models隔离副本已清理。原始审计目录的递归删除曾被自动审批以“blocked by policy”拒绝，没有给出更具体原因；没有重试或绕过，保留本地原目录，仅提交逐JSON解压校验后的归档及关键独立证据。

### 合并后的交付复核

实现与五次真实运行证据提交为`47623d693`。随后合并已发布的`origin/main`至`f6c93a756`，只出现三份spec索引的新增条目冲突，均保留双方条目；合并提交`5dc7c0c2f`。上游改动为Provider配置/发现投影、Session fork/附件和UI，未改动本轮三个生产修复点。真实Provider运行按前述锁定基线记录，不伪称在后来合并版本重新执行。

在合并后的代码上完成25项、92断言聚焦复测，全部通过：Mission真实进程driver10/19；Chat进程恢复1/4；terminal owner3/18；完整streamed恢复1/34；Mission恢复与跨Project发现4/8；checker6/9。完整日志为`integrated-mission-driver.log`和`integrated-goal-control.log`。正常工具/调度链、caller取消、重复死亡接管、关闭及删除恢复和精确项目隔离均按本次相关范围复测。

部分原始日志包含运行器输出中的行尾空白，按原字节压缩为`.log.gz`后逐字节解压比较，未裁剪失败内容；原日志继续保留本地。提交文件排除全部原始`*-audit`目录，只保留其完整压缩归档、receipt及独立关键事实。
