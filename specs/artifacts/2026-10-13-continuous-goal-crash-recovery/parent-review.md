# 主 agent 独立复核

## 基线与生产入口

- 原29项目标合同在 `43a596c26` 上全部通过。该基线已包括完整工具结果的事务提交/恢复修复；没有把旧基线通过当成本次实时恢复证据。
- `cli/server-runtime.ts` 的 listener 准备调用 `Server.initializeGlobalAutomation`，后者注册 `initializeContinuousGoals`。重启后的全局目标发现不依赖人为打开项目。正常请求的 `InstanceBootstrap` 也使用相同注册函数，Scheduler 是共享实现。
- `engine/host-recovery.ts` 同时发现已启动未完成 Task、scheduler 待投递项目与 Mission recovery candidates；通过 `runWithInitializedIndependentProject` 进入原 Task control driver 和 Mission reconciliation。checker 应直接启动正式 serve，而不是在测试中手动调用 goal reconciler。
- `task-api/index.ts` 的 `deliverContinuousGoalMessage` 使用原 Task root Message/ingress；已有 ingress 重放只重新 dispatch，新增 receipt/Message/epoch 同事务写入。验证应分别核对原 logical input 和恢复后的 physical attempt，不能把新物理请求误计为新 goal turn。

## Mission 因果与完成判定

- `mission/process-recovery.ts` 持有生命周期租约，观察死亡 Prompt owner 后绑定原 openedEventID、deadOwnerGeneration 和 interrupted assistant frontier，持久化 author 为 `OpenCorvus runtime recovery` 的真实消息；随后原 SessionWake/Prompt 恢复。这条可见恢复消息是原生产合同，不能为强制旧 parentID 而删除或伪造。
- 正常完成来自 `panel_complete_mission` 的已完成工具结果。`mission/board.ts` 使用 `projectToolPartInTransaction` 结合 request/outcome 及 Permission result 验证 `MissionCompletionReceipt`，严格绑定 Mission、Session、assistant Message、tool call/part、summary 和当前 Task acceptance。
- 公共 `GET /mission/` 对应精确记录的 `boardLane=completed`、`outcome.kind=accepted`；`GET /mission/:missionID/status` 的 status 只有 running/inactive，完成需看其 outcome。有限协调无子 Task 时空 task_acceptances 合法。idle、普通最终文字及 execution.closed 都不能独自代替接受事实。
- 新工具结果可能仅有 `resultAttemptID`；原 projector 通过 `completedToolOutcomeOutput` 读取权威 Permission result。checker 不假定 raw outcome JSON 永远内联 output。

## 流与用量

- RealProviderAudit 的 requestContext 绑定 Session 与真实 stream request 身份；reader byte/chunk 计数可证明响应读取，未必证明已有模型正文。断点同时记录持久化 Message/Part 进度，明确具体覆盖点，不保存原始推理正文。
- 明确请求上限跨崩溃前后累计。第一进程的审计在物理终止前保存，第二进程只获得剩余额度；不能因 new audit 重置上限。
- `session/llm.ts` 在真实 stream 开始捕获目标；`UsageLedger.record` 插入权威 provider_usage_event，回调在同事务引用该 usage ID。验收以这些已结算事实求和，硬中断未返回 usage 的远端消耗标注未知，不编造 token。

## 待真实证据复核

Task run1 的 [独立证据复核](task-run1/parent-evidence-review.json) 已通过：旧 PID 83328 被 SIGKILL，PID 71272 的正式服务恢复同一 ingress/epoch1；中断 assistant 的生产错误为 ProcessExecutionInterruptedError，最终 Task completed 属于同 epoch。原 goal/continuation/controller Message 唯一，所有11次请求为实际 gpt-6.1-sol 流式200，恢复后4条请求全部EOF；三条新增已结算 usage 与原目标关联，累计212143 tokens。已人工阅读真实两阶段六项标准，每项均有证据和通过条件。模型正文自述“未收到明确恢复消息”没有被当作运行结论，结论来自物理进程、数据库及请求事实。

Mission run1 保留为失败：检查器强制要求额外 runtime-recovery Message，而真实调度器先恢复了原已接受的 goal input。旧 assistant 仍由生产恢复写入 ProcessExecutionInterruptedError，后续助手接受原controller Message。核对当前持续目标架构、controller、Mission admission 与 Prompt-owner generation事务后，没有发现“必须新增恢复消息”的公开约束；两种真实入口共享唯一物理Prompt权威，不能为测试制造额外消息。修正检查器为核对实际恢复输入的因果链，并预先保存新PID/new generation准入证据；同时以最终 reply stop 晚于Mission完成Tool来收束，修复step之间瞬时空闲的误判。失败记录不回写成功，完整新Mission run复测后再下结论。

检查器活动投影排除可续租字段和普通运行日志，避免纯heartbeat无限延后真实无活动超时。新增SQLite只读事务保证跨表取样一致。以上均为验收器修正，尚未确认需要产品生产代码变更。

Mission run2 的[独立证据复核](mission-run2/parent-evidence-review.json)通过：正文输出2字符后PID75032被SIGKILL，PID83872在新generation下恢复原input；退出后快照证明旧assistant尚未结算。最终原opened、goal、continuation、input及1次计数保持一致，正常Mission accepted receipt与最终stop相符。19条请求全部为真实流式200，第二进程8条请求均EOF，四条新增目标usage得到225103累计tokens。已人工阅读最终两阶段六项，符合实际内容目标。

同时如实保留模型可见性限制：最终模型文字称“未发生真实中断”，与SIGKILL、新PID、旧assistant的ProcessExecutionInterruptedError相矛盾。`SessionLoop`默认调用`Message.toModelMessages`不带preserveAssistantErrors；后者默认跳过一般错误assistant，只有带可见parts的AbortedError例外。因而原input恢复时，模型上下文不保证含中断事实，可以解释该错误自述。这是已有跨模式错误历史投影策略；本轮没有观察实际request body字节，也没有改全局上下文策略。物理恢复和完成结论只采用真实请求、数据库因果及完成回执，不以模型自述替代。
