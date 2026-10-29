# L06长工具触发idle：独立共享机制审计

结论：这是共享执行生命周期问题，不能据本次ProcessorUnsafeRetryError判数学候选失败。当前源存在三个可定位问题：受工具自身timeout治理的静默执行仍被父LLM暂停监测超时；暂停超时被误标为180秒Provider idle；普通和Scoped MCP（Model Context Protocol，模型上下文协议）入口漏传已有取消signal。影响不是L06专属，所有汇入SessionProcessor的Task/Mission/Session及工具族都应核对。

本审查支持“由真实、有限的工具执行治理事实延长父暂停观察”的方向，**不支持将任意execute Promise无限委托**。主方新有限lease构想仍有下述必需条件，尚未改源/测试，不是修复批准或新候选分。原L06候选/容器/服务未被本审查操作、取消、重启或读取业务成品；没有模型、solver、GPU、Docker或UI执行，没有再次委托。

## 事实、推断和范围

公开status-original.json的真实终态发生于1793306687927，即2026-10-29T20:44:47.927Z，session为ses_h1cLvoTSVyZcm6Py69aU，input为msg_g0VZTGgM100am0uTc1V7。原status保留ProcessorUnsafeRetryError及两个Part身份。前一streaming状态20:24:42.477，随后20:44:47.739进入idle，再发表error。摘录在status-extract.json，原文件完整副本保留。

主方另给工具20:24:46开始且原Docker CPU仍有效的观察，本审查不操作它核验CPU。结合当前20分钟maxPause源码，时间高度吻合暂停超时；原status自身没有留下原monitor的pause原因，故不把这个推断冒称底层timer独立trace。当前源码39份及另外6份审读相关源已分别快照，SDK实际安装源关键段也保存。当前磁盘HEAD和dirty状态记录不单独证明运行中后端的完整源码身份。所有证据采集命令都只读源/状态并写本审查目录，未执行生产代码或测试。

## 三个实质代码问题

**P1 IDLE-01：父LLM把有独立治理的Tool静默执行当父流停滞。**

`src/session/processor.ts:649`给LLMActivity设置session_llm_idle_ms与session_tool_idle_ms；`engine/config.ts:52`的默认值分别3分钟与20分钟。consumer在processor.ts:1164遇tool-call才run.pause，result/error在1243/1293一带恢复。`llm/activity.ts:706`把pause转给stream monitor；`util/stream-activity.ts`的pause timer到期终止。运行中仅`Session.appendToolProgress`真实新事实经loop.ts:3757 observeActivity可延期；Bash只在真实stdout/stderr采样时发metadata（bash.ts:397、416），没有输出的有效计算不会续该窗口。

Bash自身另有显式timeout及取消治理（bash.ts:566–603），所以一次合法长foreground操作同时被另一个较短父暂停timer截断。扩大180s不能修复此所有权冲突，扩大20min只是换下一个天花板。另一方面，移除全部pause保护会让无治理promise或SDK结果交接永远挂起，亦非根治。

另一个同根因边界是SDK实际execute可以早于consumer接受tool-call：processor.ts:954附近的execute包装只markToolExecutionStarted，无pause。实际安装AI SDK在model-call-end后执行已收集工具；现有processor-producer-boundary测试也明确覆盖先副作用后consumer准入。新治理必须从真实execute入口识别活动，而非仅靠晚到的流事件。保持已有副作用拒绝重放fence是正确的，不应为消掉错误而删除它。

**P1 IDLE-02：真实暂停原因被改成Provider idle。**

`util/stream-activity.ts`分别有trip和tripPause，后者原本保存maxPause及owners；但`llm/activity.ts:670–673`对任何monitor.timedOut都构造`LLMActivity idle > policy.idleMs`，抹去到底是普通流idle还是Tool pause、实际20分钟和owner。这解释为何最终文本的180000不能作根因证据。应保留既有分类的真实phase、触发阈值及cause/owner，仍走单一错误/终态机制，不需要另造平行重试协议。

**P1 CANCEL-01：普通/Scoped MCP丢失调用者取消signal。**

`mcp/index.ts:326`的convertMcpTool execute只接args，调用callToolWithTaskRecovery时没有SDK options.abortSignal；1158的callScopedToolDefinition和1172的callScopedTool也没有传signal。底层1610已经接收signal，并在callTool、callToolStream、recoverMcpTask的sleep/getTask/getTaskResult中使用它。对照`interactive-artifact/mcp-app-host.ts:344`实际传了input.signal。已全仓检索这些定义/调用点，不是缺底层能力，而是入口断链。

这项是源级确定的传播缺口；本轮没有运行MCP证明具体远端泄漏，也不能由远端容器仍活推断它。尤其recoverMcpTask可以反复得到working，单个poll的RPC timeout不能限制整条等待；若泛化无限委托，会放大既有缺口。修复需统一入口/类型和真实正向取消收据，不能只给某一种MCP或工具名字豁免。

## 横向覆盖与边界

| 生产路径 | 共享事实/审读位置 | 当前判断 |
| --- | --- | --- |
| 原生Task root | task-root-ingress-delivery.activate在精确ingress lease后runner；orchestrator/agent.ts:917进入SessionPrompt | 同一Tool/Provider生命周期；不是独立L06执行器 |
| Task worker/Build | agent/runner.ts:1743 continuePersistedPrompt；loop.ts:1967建processor、2460 process | 当前错误所在族；相同配置影响其他worker |
| Mission | SessionWake.prompt/loop与Mission opened/closing occurrence绑定；execution-closure.ts:638 cancelOwned | 同样汇入loop；关闭取消需保留exact owner，不按当前status猜归属 |
| Session公开prompt/命令 | server/routes/session.ts的executePublicSessionPrompt/SessionPrompt及prompt/run.ts | 同一normal loop；普通Chat/Code/Work不是旁路 |
| 自动化与事件唤醒 | scheduler/automation-service.ts:2521/2799已有owner completion runDelegated；event-service只交付wake receipt | 可以复用有真实owner才委托的原则，不能把每个scheduler准备await都当执行owner |
| 直接Session shell | shell-exec.ts独立进程ownership/lease/abort，非Provider stream | 不能为修父LLM而改其租约语义或把lease定时续期充作语义进展 |
| 权限续跑 | loop.ts:4841后重建表面，直接recoveredTool.execute(...abortSignal) | 当时可能无活动Provider monitor；取消/治理仍必须有效，不能要求虚构run/heartbeat |
| Compaction与文本辅助 | compaction.ts:1106也建processor；标题/记忆/VCS用collectLLMText；Provider连通性与metric judge另有有限timeout/idle | 改共享activity要保留这些非长Tool流原有保护；不能全局禁idle |

枚举原件在production-stream-entry-sites.txt、entry-call-sites.txt、activity-call-sites.txt。不是只按Task/某专家团名称判断。表中是源/契约覆盖，没有冒称这些入口均在本轮重新E2E执行。

正常/错误终态由processor完成Part和assistant，catch会convergeOpenToolParts并保留failure occurrence。external cancel经SessionPromptState.cancelMatch同时abortActivityMonitor与exact prompt AbortController，activity composite进入SDK，原生工具的options.abortSignal成为ctx.abort，Bash请求supervisor terminate并finally等真实exit/disposal。Task按project约束的Session树收集、后代先取消；Mission按opened occurrence取消。重启恢复使用durable owner的exact_live/unknown_live/dead_or_reused判断，并结算已弃Provider/Tool facts；不能拿单纯静默当进程死亡。不同Session和occurrence已有独立owner/registry；新的lease不能改成进程全局计数。

需要分清：abortableIterable在abort时为了不被不可信iter.return卡死而不await上游return；这不证明正在执行的工具已物理收尾。processor持久Tool error、原生监督进程退出、外部效果是否仍在是三份事实。Docker daemon运行的container也不是docker CLI的操作系统子进程，CLI树被取消并不自动撤销daemon侧计算。本次container仍活本身不能证明ctx.abort丢失；取消与副作用存续须各自取证。不得据此按docker命令文本建立host旁路。

## 对拟有限execution lease的裁决

该方向可针对共同根因，且不增加用户Task总额度：它只是**某次工具已实际建立的有限timeout/取消合同的事实投影**。必须满足：

1. 实际执行器用同一个固定绝对deadline武装timeout/abort，再通过唯一受信任进展事实发布；不能每条metadata、working轮询或定时器把deadline改成now+timeout。Bash当前timer及投影须用同一变量并明确有界cleanup，考虑宿主timer取值范围，不能投影一个实际未武装的远期值。
2. generic metadata是任意字典，不能凭远端/包返回某个deadline键就获得受管lease。应在现有invocation/Tool progress路径用类型化、身份绑定的host治理事实验证。普通metadata仍只是数据；来源可信度不能靠工具名称白名单。可在现有共享执行/PhysicalOperationScope/ProcessSupervisor上抽出实际deadline+signal+发布的小primitive，不再复制第二套timer或状态队列。
3. 无可信固定治理事实的promise仍有原有限guard。Package RPC现在只有真实RPC/进程输出驱动的inactivityMs，并无固定总执行deadline，不能直接声称已有绝对deadline。MCP请求timeout只治理那一次RPC；逐次getTask成功或working不等于整条工具任务有执行截止。
4. **MCP TTL不是执行治理证据。** 安装SDK类型的ttl注释是保留信息；官方Task规范允许TTL后删除Task/结果，并不保证停止底层执行。不能以createdAt+ttl投影execution lease，也不能将null当无限受管执行。[MCP Task TTL规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks#ttl-and-resource-management)
5. 早execute立刻进入可观察有限暂停，真实完成/抛错finally释放；consumer晚tool-call与result已就绪但SDK/发布挂起须回到有限交接guard。工具返回background PID后已完成此调用，不能继续无限委托父Provider。
6. 每call/attempt/session/generation精确所有权；并行A结束不能解除B，迟到旧attempt释放/metadata不能续新attempt。实际开始但尚无治理事实、同步throw、已abort前调用、结果后挂起都要覆盖。
7. 早execute若先于consumer首chunk，当前run.pause既不会停firstByteTimer，也不让后来创建的monitor继承pauseOwners。新实现必须覆盖此顺序，让真实已开始Tool事实参与first-byte/monitor安装，而不是加假heartbeat。所有delegate/lease结束后first-byte/idle/total的有限保护恢复。
8. 保留ProcessorUnsafeRetryError的副作用fence；失败后不能在同一assistant自动重放已执行工具。后续真实新LLM occurrence可读取失败/工具收据决定继续，这是另一生命周期，不能混称SDK安全重试或保证业务“未执行”。

AsyncIterable工具还须注意实际安装SDK允许execute返回异步输出迭代器：仅await返回迭代器对象会过早认为执行结束。当前自有native工具主要为Promise，未发现此处具体生产反例，但共享包装应保留SDK返回契约，或明确校验只支持当前规范的Promise；不要在改造时悄悄改变现有AITool契约。

## 必要聚焦正向验收（尚未执行）

| 场景 | 必须观察的明确结果 |
| --- | --- |
| silent受管工具超过短父pause、在自身deadline前真实完成 | 真实子进程exit0/输出收据、持久Tool completed、activity done、实际副作用计数1 |
| 无受管lease的never-settling工具 | 有限guard给真实pause错误/owner；不能永久无终态 |
| SDK先execute、consumer tool-call晚到 | 执行期有限治理成立；执行完成后的挂起仍能给明确guard错误 |
| execute在consumer首chunk前启动 | 首字节/monitor安装次序正确；工具完成后恢复有限流idle |
| 两真实并行工具不同deadline | A完成后B的真实治理仍有效；两份独立结果/owner结算；到期的是对应call |
| 工具已返回、SDK result/hook或发布挂住 | 工具执行lease已结束，交接窗口到期有真实phase/阈值，副作用仍1次 |
| 工具自身timeout/同步throw/异常返回 | 真实退出或错误收据；所有者释放并恢复guard，assistant/Part依当前契约收敛 |
| external abort在受管工具中 | 相同typed取消原因抵达工具/监督器；明确物理exit/settled及Provider aborted；不把持久error当已回收资源 |
| 普通MCP、Scoped、MCP App取消 | 底层请求/Task恢复收到同signal并给明确取消收据；远端Task结果与传输取消分开 |
| 新prompt、重启、两项目/串并行 | 旧owner释放/metadata不改新occurrence；live owner不因输出静默被当dead；弃置事实结算且业务工具收据保留 |
| 无Tool正常文本/真实Provider停滞 | 保留首字节、语义idle、total及原重试策略的明确终态 |

可在现有非UI测试位置聚焦补充：test/llm/activity.test.ts、stream-activity-pause-bound.test.ts、session/processor-producer-boundary.test.ts、processor-llm-activity-retry.test.ts、bash-live-progress.test.ts及MCP调用契约。现有“工具已commit但consumer hook挂住”测试应继续给unsafe-retry错误，不能为新长工具路径放宽。SDK/Provider夹具只证明局部合同；至少一条新目录真实标准库子进程+真实checker/持久收据必须覆盖工具执行边界，不能用source字符串或仅mock结束本次修复验收。

## 阶段结论

源码共享影响面与上述确定缺口已反馈主方；有限可信治理事实的方向可进入精确方案，但MCP TTL、package“已有固定deadline”、任意metadata可信性三点必须纠正。当前未改生产、未跑修后测试，也未重跑原候选，所以状态为 **shared_source_audit_complete_fix_and_verification_pending**。本报告不评价L06数学质量、不发布候选成绩、不代签未来修复或重型benchmark成熟度。
