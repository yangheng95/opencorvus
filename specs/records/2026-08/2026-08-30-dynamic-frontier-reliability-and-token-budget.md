# Dynamic Frontier Reliability and Token Budget

## Recall

### 用户原始要求与纠正

用户要求新增 `dynamic` 专家团入口，像 Codex 和 Claude 一样轻量地按当前请求生成临时 Agent team 与 workflow 描述，不得被永久专家团生成算法拖慢；随后要求核算真实 case token 并跑一个端到端 case。

真实 Provider 端到端运行暴露出上一轮交付不可接受：Dynamic 虽然写出了两个并行成员，却只首次派发一个 Session；第二个 Session 需要人工纠偏后才创建，且两个 Session 没有重叠。整轮 Task 共 52 次模型调用、1,972,934 total tokens，耗时约 7 分 36 秒。用户进一步明确：简化的意义是可靠，不能交付仅靠提示词、实际会漏派发且消耗巨量 token 的实现。

用户随后纠正 Skill 策略：不得通过改变 Skill 的角色归属或投影来实现节流；应保留既有投影，并在 Mission 与 Orchestrator 核心 prompt 中明确禁止仅因 Skill 已挂载或可用就贪心加载。只有当前决策确实需要该 Skill 的专门方法或契约、且已渲染 prompt 与当前上下文尚未提供时，才调用 Skill loader。

### 本轮验收指标

1. Dynamic 的一个 dependency-ready frontier 必须由一次结构化 Tool 调用完整提交；两个或更多独立成员不再依赖模型在同一响应中生成多个 sibling tool calls。
2. frontier 中每个成员继续产生独立、完整可见的 `dispatch_agent` Tool Part、immutable dispatch lineage、worker Session、消息和终态；不得合成或隐藏参与者消息。
3. Host 只校验并并发执行模型明确列出的 exact dispatch requests，不按关键词选角色、不计算依赖、不创建第二个 workflow state、不自动补成员。
4. Dynamic scheduler 只投影调度所需的最小 Tool 面；`read_task_message` 只读取当前 Task-root control wake，`read_agent_message` 只按 Task 投影的全局唯一 Message 引用精确读取 worker 消息，并从持久化事实解析 Session 归属，`no_action` 在已有 sibling worker 独立继续时结算当前 lifecycle ingress 并立即 park；首次派发前不得加载 Skill、读取项目源文件或遍历 Artifact catalog。团队和 workflow 描述与 frontier Tool 调用仍处于同一条可见流式 assistant Message。
5. Dynamic 原有 scheduler、Generalist 与 Builder Skill 投影保持不变；Mission 与 Orchestrator 的核心 prompt 都必须表达同一个按需加载契约，并保留显式 `@mission(...)` 的既有必加载语义。
6. 聚焦正向测试必须从一个 frontier 调用产生至少两个同身份 sibling Session，并证明它们真实重叠、拥有不同 Session/dispatch/tool-part identity，且仍走现有 dispatch adapter、恢复与终态投递链。
7. 生成 payload checker 必须读取仓库真实 `packages/opencorvus/generated/expert-squad-payload.ts`，不得用另一个源文件伪装生成 payload fixture。
8. 真实 Provider 端到端 case 必须满足：无需 operator correction；首次 frontier 创建至少两个重叠 Session；Task terminal complete；结果事实正确；无 Provider retry；全 Task total tokens 不超过 750,000，Orchestrator total tokens 不超过 350,000，且相对失败基线至少下降 60%。
9. 首轮验证后必须由未参与实现的独立 agent 只读审查完整差异、测试、规格、真实验收和风险；有效发现全部修复并复验，直至无未解决发现。

### 硬约束

- 工作树已有用户或并行任务修改：`packages/opencorvus/src/session/index.ts`、`packages/web/src/content/expert-squad-distribution.generated.ts`、`packages/web/src/content/public-market-zh-01-35.ts`。本任务不得修改、回退或提交这些文件。
- 所有 Large Language Model（LLM，大语言模型）交互继续使用流式路径。
- `dispatch_agent` 仍是每个 worker occurrence 的唯一执行、lineage、Session 和终态实现；frontier 只能是其结构化并发组合层，不得复制 dispatch 生命周期。
- 不新增 Host 路由 gate、关键词匹配、自动 frontier、隐藏 workflow 状态或 package 特判。Dynamic 的 Orchestrator仍负责决定成员、目标 capability、instruction、work scope、worktree 和依赖。
- 不保留 Dynamic 的旧提示词并行路径作为 fallback。Dynamic 只使用新的 frontier Tool；其他固定专家团原有单个 `dispatch_agent` 契约不受影响。
- 不新增、修改或运行 User Interface（UI，用户界面）自动化测试。
- 真实 Provider 凭据与模型目录只可在显式 opt-in 的隔离 checker 中绑定；不得打印或写入仓库、spec、日志和结果。

### 已读资料

- 用户提供的仓库级 `AGENTS.md`
- `specs/current/architecture/01-agents.md`
- `specs/current/architecture/08-agent-tool-adapter.md`
- `specs/current/architecture/11-agent-oop-protocol.md`
- `specs/current/architecture/14-agent-runtime-mode.md`
- `specs/records/2026-08/2026-08-29-dynamic-expert-squad.md`
- `packages/opencorvus/src/orchestrator/dispatch-agent-tool.ts`
- `packages/opencorvus/src/orchestrator/tools.ts`
- `packages/opencorvus/src/orchestrator/decision-tool-names.ts`
- `packages/opencorvus/src/orchestrator/agent.ts`
- `packages/opencorvus/src/prompt/core/orchestrator-core.txt`
- `packages/opencorvus/src/prompt/core/mission-core.txt`
- `packages/opencorvus/src/tool/execution-mode.ts`
- `packages/opencorvus/src/tool/batch.ts`
- `packages/opencorvus/src/session/loop.ts`
- `packages/opencorvus/src/session/processor.ts`
- `packages/opencorvus/src/engine/dispatch-lineage.ts`
- `packages/opencorvus/src/agent/tool-pool-data.ts`
- `packages/opencorvus/test/expert-squad/dynamic-package.test.ts`
- `packages/opencorvus/test/scheduler-skill-loading-policy.test.ts`
- OpenAI 官方 Multi-agent 与 GPT-5.6 model guidance：<https://developers.openai.com/api/docs/guides/responses-multi-agent>、<https://developers.openai.com/api/docs/guides/latest-model>

### 全仓搜索与横向审计结果

- `dispatch_agent` 的 model-facing schema 只接受一个 `{ dispatch }`。核心动态提示进一步写死“with one target-discriminated dispatch object”，与 Dynamic overlay 的“同一 Turn 派发全部 ready members”形成冲突；真实模型遵循了单次工具契约而不是 overlay 愿望。
- `ToolTurnExecutionCoordinator` 和 durable reducer 已允许同一 assistant Turn 的多个 completed `dispatch_agent` decision Parts；detached dispatch pipeline 也能并行。但这只能在模型确实生成多个 sibling calls 时生效，不能证明模型一定完整提交 frontier。
- 失败 case 的首个 Orchestrator assistant Turn 在 worker 创建前调用了 Skill、Read 和 Artifact 工具；首个成员前共 21 次 Tool 调用、约 843,021 tokens。整轮 Orchestrator 35 次模型调用、1,681,175 total tokens，是总成本的主要来源。
- Dynamic scheduler 当前 `inherit_base_tools: true`，还显式包含 `read`，所以模型能够在应该先委托的阶段自行遍历源文件和 Artifact。将其改为 exact minimal surface 可消除该错误能力，而无需行为 gate。
- 通用 `batch` Tool 只接收 ordinary registry tools，排除 decision tools；并且 `dispatch_agent` 在 registry materialization 后才作为 Orchestrator private Tool 注入，因此不能安全地通过现有 batch 开关复用。
- 每个 dispatch lineage 强制绑定一个 exact `tool_part_id` 与 `tool_call_id`，`findDispatchLineageByToolExecution` 明确拒绝一个 Tool occurrence 对应多个 lineage。因此 frontier 外层不能用一个共享 Tool Part 代替子 dispatch receipts；必须先持久化每个真实 `dispatch_agent` 子 Part，再调用现有 executor。
- 正常路径：frontier 预校验完整数组、先持久化全部 child running Parts，再并发调用同一个 `dispatch_agent` executor。每个 executor 继续创建 descriptor、Session、lineage、detached pipeline 和 terminal delivery。
- 终态与恢复路径：outer Tool Part 的持久化 input 是唯一重放输入；每个 child Part/Call ID 由 outer Part 与 frontier index 确定性派生。恢复器复用 completed child 的 canonical outcome，对 running 或尚未建立 lineage 的 child 以同一 Tool identity 重放现有 `dispatch_agent` admission/recovery，并在全部 child 收敛后完成 outer Part。外层 frontier 不成为第二个 lineage authority。
- Task、Mission、ordinary Session 隔离：新 Tool 只进入 Orchestrator private/projectable catalog，且仅由 Dynamic manifest 显式投影。Coding、Chat、Mission 和 projected worker 不获得该 Tool。
- Dynamic 的 scheduler、Generalist 与 Builder 原有 package Skill 投影均保留。防贪心行为由 Mission/Orchestrator prompt 统一约束，不以撤销投影、缩窄角色能力或 Host gate 实现。
- 真实 checker 对首个 frontier 前的 Orchestrator Tool 做精确分类：当前 control wake 的 `read_task_message` 是允许的 control read；`skill`、Artifact、项目读取和其他非 control Tool 均使验收失败。
- 第二次真实运行进一步暴露共享投影缺口：仓库已有 `read_agent_message` 实现，Task 描述契约也明确要求按精确 Session/Message 引用读取 payload，但 Orchestrator Tool pool 没有投影它。调度器只能从 terminal lifecycle Engine Artifact 得到 `final_message_id`，不能看到 participant-authored 正文，随后把 worker 正确报告的 `amber` / `violet` 错汇总为 `blue` / `purple`。这不是局部模型偶发，而是所有依赖 worker final Message 做验收的 scheduler 共用能力缺口。
- 修复消息读取能力后的真实运行正确并行派发、读取 final Messages、汇总五个事实并完成 Task，但首条可见消息仍可能漏掉自然语言 team/workflow 块。这说明必须把当前 frontier 描述纳入同一个模型生成的结构化 Tool 输入。`dispatch_agents` 因而要求与 `dispatches` 按索引对齐的 `team` rows，携带 Task-local name、target、responsibility、boundary、expected result 和 settled predecessors；Host 只校验对齐，不生成消息、不计算依赖，也不保存第二份 workflow 状态。
- 第四次真实运行正确创建了两个并行 Session，但 `read_agent_message` 同时要求模型抄写 `session_id` 与 `message_id`。两个 sibling Session ID 高度相似，模型把它们重组成不存在的混合 ID，在多次失败读取后又续派已完成 worker。该 Task 的 Orchestrator 达到 31 次模型调用、1,307,146 total tokens；这是精确引用 API 形状的共享可靠性缺陷，不是 Skill 加载或 Dynamic 角色归属问题。`message_id` 本身全局唯一，因此 Tool 收敛为只接收该精确引用，由持久化 Message 反查 Session 并校验 Task 归属；不选 latest、不猜测 payload、不保留双参数 fallback。
- 第五次真实运行证明两个 worker 均在首个 frontier 中并行创建并分别以 canonical final Message `msg_g0VTi8Ejf000F2XzqTz1` 与 `msg_g0VTi8GJD00qbP96bDiY` 完成，但第二个 terminal lifecycle fact 在处理第一个 lifecycle ingress 的物理 Orchestrator Turn 期间到达。该事实必须排队成为下一次 ingress，不能注入正在流式生成的 Message。Dynamic 的 exact Tool 面却漏投影了当前架构唯一的非变更决策 `no_action`；模型无法结算当前 ingress 并 immediate-park，于是 6 次读取旧 intermediate Message、累计 17 次 Provider 调用，并在最后一次流中连续输出等待叙述，直到真实 checker 的 4 分钟无进展边界关闭运行。Provider activity 最终记录的是 checker shutdown 触发的 `external_abort`，不是 Provider 重试或 worker 未完成。修复必须把 `no_action` 恢复到 Dynamic scheduler 的单一投影，不能增加流式超时、Host 自动 park、latest Message fallback 或 worker polling。
- 第六次真实运行在约两分钟内自行完成 Task：首个 frontier 创建两个重叠 worker，Orchestrator 精确读取两条 canonical final Message，并正确提交 `ORION_CODE=17`、`ORION_COLOR=amber`、`NEBULA_CODE=29`、`NEBULA_COLOR=violet` 与 `CODE_SUM=46`。checker 仍正确拒绝交付，因为 `complete_task.evidence_locators` 只绑定了两个 terminal lifecycle Engine Artifact，没有绑定实际支撑汇总的 participant-authored Messages。公共 locator schema 已支持 `{source:"session_message",session_id,message_id}`，`read_agent_message` 也返回这对 exact identity；缺口是 `complete_task` 的 model-facing 字段描述只教模型命名 Artifact，核心完成提示也没有明确把依赖的 worker final Message 纳入 evidence locators。修复应统一这两个声明面，不由 Host 自动推断已读 Message，也不放宽 checker。
- 串并行与多项目隔离：frontier 仅执行 Orchestrator给出的数组；共享可变面仍由 prompt 要求串行。每个 child 调用继承当前 Task root Session、Project identity 和 package revision，现有 `Instance`、Task ownership 与 dispatch admission 校验保持唯一事实来源。
- OpenAI 官方 Multi-agent 当前把并发 subagent、focused context、spawn/message/wait primitives 和 `max_concurrent_subagents` 作为运行时能力，并明确提示多 Agent 可能增加 token；官方 model guidance 要求暴露最少相关 Tool、精简重复提示，并在代表性任务上同时比较正确性、total tokens、延迟、调用数和重试。该证据支持“结构化运行时原语 + 最小 Tool 面 + 实测预算”，不支持“只靠更强提示词”。

### 独立 agent 反馈

实施前：无。

首轮实现后由未参与实现的只读 agent 审查，结论为 NOT PASS。有效发现为：repair surface 不能按 Tool 名称误删具有 canonical `dispatch_agent` decision declaration 的 frontier；进程中断点必须覆盖 durable child Part 已写、部分 child 已完成和全部完成的确定性重放；异常清理必须尝试收敛全部 child 并同时保留 primary 与 settlement errors；真实 E2E 的“无 retry”和“并行”必须来自持久化 Provider activity receipt，而不是进程内事件或 Session 消息时间；凭据清理必须从复制前开始受统一 `finally` 保护；Dynamic Tool 面测试必须精确断言平台强制 Artifact tools。

已完成的闭环：repair surface 改为读取实际 decision declaration；frontier child Part/Call ID 由 outer Part 与 index 确定性派生，恢复器重放 outer persisted input，复用 completed child，并仅恢复 running/missing occurrence；聚焦测试分别覆盖 preparation interruption、partial completion replay、all-completed replay、preparation settlement 和多错误 cleanup；Provider terminal activity 持久化 `attempt_count`，真实 E2E 用 Provider request/outcome 区间判定跨 Session overlap；隔离资源和凭据统一进入外层 `try/finally`；Tool 面改为 exact list。后续真实运行又分别关闭 canonical worker final Message、`no_action` park 和 completion `session_message` evidence 三个共享契约缺口；最终真实 Provider E2E 已通过，完整差异终审仍待完成。

第二轮只读审查继续发现两个有效问题：恢复的 Task/Session authority、配置和 pinned projection preflight 位于 outer terminal settlement 边界之外；replay settlement 会用本轮时间覆盖已有 running child 的 durable start。现已把完整 preflight、Tool 重建、执行和 outer completion 纳入统一 catch/settlement，调用方 abort 保留给后续 owner，确定性失败结算 exact outer Part 后由同一 Session recovery 结算 remaining child；已有 pending/running child 的 terminal receipt 精确保留原始 `time.start`。新增正向测试覆盖无 Task authority 的 deterministic preflight failure，以及跨 60 秒 replay 后原 start 不变。第三轮终审待完成。

第三轮只读审查确认上述两个问题已关闭，但发现 frontier 会把 child caller-abort 包装为新的 `AggregateError`，使 outer recovery 无法只靠 reason identity 识别取消。现已在 child settlement、frontier aggregate 和 outer recovery 三个边界统一执行 caller signal `throwIfAborted()`：取消时抛 exact abort reason，outer 和尚未完成的 child 保持 running，下一 owner 可继续确定性恢复；非取消失败仍进入 durable error settlement。新增正向测试验证 exact reason identity 以及 outer/child 均保持可恢复。第四轮终审待完成。

后续只读审查又发现两个有效 P2：真实 checker 曾以相邻 Message 的“最后一条”近似 canonical worker final；`read_agent_message` 缺少跨 Task authority 的正向错误契约。现已由 terminal `SessionStatus.final_message_id`、exact lifecycle input、`completedReplyToUserMessage` 和 participant Message identity 共同选择唯一 final；checker 额外放置 later adjacent assistant Message 验证不会漂移。跨 Task 测试创建真实 foreign Task/Session/Message 并验证 Tool 返回明确的 Task ownership error。该轮复审输入随后又因真实 Provider 暴露的生命周期投影与结构化 team 契约修复而更新，最终完整差异仍需重新终审。

最新终审发现一个有效 P1：exact final Message 修复把所有 terminal lifecycle 都无差别要求 `final_message_id`，但 `error` / `aborted` worker 可以在尚未产生 assistant final Message 时合法发布终态。若进程切断发生在 lifecycle durable publication 与 dispatch settlement 之间，恢复器会永久对同一事实抛错。横向核对确认正常 detached failure 路径已经使用 `infrastructure_failure` settlement、exact dispatch occurrence authority 和受 epoch budget 约束的 infrastructure ingress；缺口只在跨进程 terminal lifecycle recovery。修复设计按 reason 分支：`completed` / `coordinated` 继续强制并验证 exact final Message；`error` / `aborted` 禁止猜 Message，从 exact lifecycle、Worker Turn descriptor 和 dispatch lineage 构造 deterministic infrastructure fact 与 typed failure outcome，使用 lifecycle emitted time 保持重放 payload 稳定，并经同一 infrastructure ingress gate 交付。正向 process-cut 测试必须分别覆盖无 final Message 的 `error` 与 `aborted`，核验唯一 settlement、descriptor/input/dispatch authority、唯一 ingress、重复 sweep 幂等，以及其他 Task、Session occurrence 和正常成功分支不受影响。

该 P1 已按上述设计关闭：新增 process-cut 测试同时跑 `error` / `aborted` 两个真实 durable lifecycle reason，并在重复 control-plane sweep 后验证唯一 typed settlement 与唯一 infrastructure ingress。该文件 5/5 通过；相邻 abandoned dispatch、Goal Workload startup recovery、fresh worker authority 和 infrastructure budget 共 32/32 通过；OpenCorvus typecheck 通过。修复后的完整输入仍需再次独立终审。

再次复审确认 P1 已闭合，同时发现一个有效 P2：失败/取消 lifecycle 若携带 exact `final_message_id`，恢复 outcome 曾无声丢弃该 authority。现已把成功与失败分支共用同一个 exact Message 校验 primitive：ID 必须属于 exact child Session、接受 descriptor 的 exact input Message、且为已完成并带 finish 的 assistant reply；失败 recovery 在 ID 缺省时保持无 Message outcome，在 ID 存在时把同一 ID 写入 `infrastructure_failure.final_message_id`。新增 process-cut 正向测试旁置一个 later adjacent completed assistant Message，验证 settlement 仍保留 lifecycle 指定的 exact ID、唯一 ingress 和重复 sweep 幂等。该文件现为 6/6，OpenCorvus typecheck 再次通过。修复后的完整输入已经独立只读终审，结论为 FINAL PASS，P0/P1/P2/P3 均为 0。

## 根因结论

### 可观察现象

失败不是第二个 worker 慢，而是第二个 dispatch occurrence 根本没有在第一轮产生。Session A 完成后 36.95 秒仍不存在 Session B；只有 operator correction 后才创建，因此不存在并行重叠。随后一次错误的测试 fixture 又把源 `builtin/index.ts` 当成生成 payload，产生“payload 缺 Dynamic”的假结论。

### 直接触发点

模型看到的 canonical Tool schema 每次只能派发一个成员；它在完成第一个 `dispatch_agent` 后结束了该决策。Dynamic overlay 对多 tool-call emission 的要求没有结构化承载，也没有结果契约可验证“声明的 team 是否全部提交”。

### 数据与控制流根因

当前机制把一个必须可靠的集合决定拆成 N 次独立模型 tool-call 生成。运行时可以并行执行收到的 calls，却不知道模型原本声明的集合边界，因此既不能一次接收完整 frontier，也不能证明漏掉成员。与此同时，过宽 scheduler Tool 面允许 Orchestrator 自己读取大量上下文，使 cache-read token 在每次模型回合重复累积。

### 旧路径为何没有根治

旧聚焦测试由测试代码手工创建三个 `dispatch_agent` Parts，再 `Promise.all` 调用 executor。它证明了 runtime primitive 能并发，却绕过了真实缺口：模型是否会产生完整的多 call set。规格把“运行时允许”错误提升成“模型会可靠使用”。真实 E2E 才否定了这一推断。

## 设计

### 单一 frontier Tool

新增 Orchestrator private Tool `dispatch_agents`：输入是 1–8 个完整、按现有 `dispatch_agent` schema 校验的 request。模型用一个调用提交它已经决定的整个 dependency-ready frontier。

执行顺序：

1. Zod 在任何副作用前校验整个数组；
2. 为每个 request 创建同一 assistant Message 下独立、可见、running 的 `dispatch_agent` child Tool Part；
3. 所有 child Parts 就绪后，通过同一个现有 `dispatch_agent.execute` 并发执行；
4. 每个 child 独立写 completed 或 typed error Part；
5. 外层结果按输入顺序返回所有 DispatchOutcome，并以 decision command `dispatch_agent` 参与现有 Turn conflict contract。

`dispatch_agents` 不解析可见 team 文本、不比较角色、不补齐 member、不推断 dependency，也不保存 workflow。它只是把一个模型已经结构化声明的集合变成现有 dispatch primitive 的并发调用，类似函数调用层的 `all`，不是调度器。

### Dynamic exact Tool surface

Dynamic scheduler 改为 `inherit_base_tools: false`，只显式请求：

- `dispatch_agents`：提交完整 frontier；
- `read_task_message`：读取当前授权的 Task-root control Message；
- `read_agent_message`：按 Task 描述投影的 exact globally unique message ref 读取真实 worker final Message，并由持久化事实解析 Session 归属；
- `manage_task`：在证据完成后提交 Task lifecycle；
- `no_action`：已有 sibling worker 独立继续时结算当前 lifecycle ingress 并 immediate-park，使期间排队的下一 terminal lifecycle fact 进入新的可见 Turn；不创建 timer、wait 或影子状态；
- `skill`：保留 scheduler 已投影 Skill 的按需加载能力；是否加载仅由核心 prompt 的当前决策契约约束。

Dynamic 原有 scheduler、Generalist 与 Builder 的 package-local Skill 投影保持不变。Mission 与 Orchestrator 核心 prompt 统一要求：不得仅因 Skill 已挂载或可用就调用 loader；只有当前决策确实需要其专门方法或契约，且已渲染 prompt、Mission state 或 Task context 未提供时才加载。Dynamic 的四条紧凑编排规则已直接位于 scheduler prompt，因此首个 frontier 不需要重复加载该 Skill；这是模型决策契约，不是 Host gate。

平台强制的 Task Artifact tools 若仍由统一 resolver 注入，Dynamic prompt 明确只在 worker 返回 locator 或 completion evidence 需要时读取，首次 frontier 前不得调用。Terminal lifecycle Artifact 只证明 worker 已终止并提供精确引用；任何依赖 worker 报告的综合或完成决策都必须先用 `read_agent_message` 读取对应 participant-authored final Message，不能从 locator、生命周期摘要或模型记忆猜正文。

所有 scheduler 的 `complete_task.evidence_locators` 使用同一公共 typed locator 契约。完成结论依赖 worker final Message 时，Orchestrator 必须把 `read_agent_message` 返回的 exact `session_id` / `message_id` 成对写成 `session_message` locator；生命周期 Artifact 可同时作为终态证据，但不能替代 participant Message。Host 继续只校验 Task ownership 和持久化身份，不自动收集“曾经读过”的 Message。

### Prompt 和当前架构收敛

- Dynamic overlay 删除“多个 dispatch_agent calls”的实现暗示，改为“一个 dispatch_agents call 包含全部 ready members”。
- 核心 active projected worker guidance 根据 scheduler 实际 Tool surface 渲染 singular 或 frontier contract，避免提示不存在的 `dispatch_agent`。
- Session repair instruction 使用“active dispatch Tool”表述，不再强迫 parallel sibling calls。
- 当前架构说明 `dispatch_agent` 仍是单 occurrence primitive；显式 frontier Tool 可以组合多个 exact requests，但 Host 不计算 frontier。

### 真实 E2E checker

新增 opt-in checker，使用隔离 Home、真实 Provider、精确目标模型和 public HTTP Task 路径：

- 从真实 generated payload 安装 Dynamic，并核对 package revision；
- 创建两个小而独立的只读事实源，要求 Dynamic 并行调查后综合；
- 从持久化 DB 核验 outer `dispatch_agents`、两个 child `dispatch_agent` Parts、跨 Session 的真实 Provider request/outcome interval overlap、无 operator correction、terminal completion、预期事实和 usage；
- 从每次持久化 Provider terminal activity 的 `attempt_count` 核验所有模型调用均为单次 attempt；
- 逐角色输出 model calls 与 input/output/reasoning/cache-read/total tokens；
- 默认拒绝运行，只有显式 real-provider opt-in 且 auth 与 models projection 同时可用时启动；结束时清理隔离凭据副本与服务。

## 风险与排除项

- 若模型把有依赖的成员错误放进同一 frontier，Host 不替它改图；这是 Orchestrator语义错误，应由结果验收发现，而不是新增 Host workflow engine。
- frontier 上限 8 是单次载荷与轻量团队的完整性约束，不是 Task 全局 Agent 数或 workflow state。
- 本轮不把所有固定专家团迁移到 `dispatch_agents`；它们仍使用当前 package workflow 与单 occurrence dispatch contract，避免扩大未实测变更面。
- 本轮不采用 OpenAI hosted Multi-agent beta，因为 OpenCorvus 必须保留自己的 Provider、Session、Tool/Result、Artifact、permission 和 Task lifecycle authority；参考其轻量运行时形状，而不是导入另一个事实源。

## 验证记录

当前验证：

- Dynamic package、frontier durable recovery/settlement、repair surface、Tool projection、Provider activity 持久化与 E2E contract 共 22 个正向测试通过；worker canonical final Message、completion `session_message` evidence 和语义 idle/network retry 的 `attempt_count` 各有一个聚焦正向测试通过。
- 生成 payload 已从真实生成器刷新；OpenCorvus `typecheck` 通过。
- 最终真实 Provider case：Task `tsk_g00VTiE64900ZrcQPt2O`，模型 `openai/gpt-5.6-luna`，总耗时 98,609 ms。首个 `dispatch_agents` 产生两个不同 child Tool Parts 与 worker Sessions；持久化 Provider request/outcome 区间重叠 5,802 ms；首次 frontier 前 non-control Tool、Skill load 和 operator correction 均为 0。
- Orchestrator 精确读取两个 canonical final Messages，并把 `ses_-zUWHlnYNzzURQuVj3UU:msg_g0VTiEGwD00MHqLJlrj4` 与 `ses_-zUWHlnYMzzRqw3qVdZh:msg_g0VTiEH4400tOlLDfdPP` 作为 completion `session_message` evidence。Task 自行完成并正确提交五个预期事实。
- 所有持久化 Provider activity 的 `attempt_count` 均为 1。Orchestrator 6 calls / 132,428 tokens，两个 Generalist 合计 8 calls / 137,343 tokens，全 Task 14 calls / 269,771 tokens；相对 1,972,934 失败基线下降 86.3264%，同时满足 750,000 Task、350,000 Orchestrator 与至少 60% 降幅预算。
- checker 成功退出后隔离 runtime root 已删除；`auth.json` 与 `models.json` 副本均不存在。

结构化 team 与 exact lifecycle authority 收敛后的最新真实 Provider case：Task `tsk_g00VTiPCWK00rRJKM257`，模型 `openai/gpt-5.6-luna`，总耗时 83,734 ms。首次可见 `dispatch_agents` Tool 输入包含两个与 dispatches 对齐的结构化 team rows，名字分别为 `orion-reader` 和 `nebula-reader`，两者 `depends_on=[]`；首次 frontier 前 Orchestrator Tool 调用为 0。两个 worker Provider 区间重叠 5,843 ms，Orchestrator 精确读取 canonical final Messages `msg_g0VTiPNot00Gm7omSw5J` 与 `msg_g0VTiPNA700QFB6qtwpC`，并把这两条 participant Message 绑定为 completion evidence。Task 无人工纠偏自行完成并提交全部五个正确事实。全部 Provider activity 均为单次 attempt；Orchestrator 4 calls / 98,675 tokens，两个 Generalist 合计 10 calls / 173,641 tokens，全 Task 14 calls / 272,316 tokens，相对失败基线下降 86.1974%。隔离 runtime、auth 和 models 副本均已删除。

完整差异独立只读终审已完成，结论为 FINAL PASS，P0/P1/P2/P3 均为 0；commit 与 push 证据在本次交付完成后补记。
