# Scheduling Algorithm Razor Audit

## Recall

### 用户原始要求

用户要求多个独立 agent 对当前项目调度算法做拆解分析，重点寻找过度工程、系统设计矛盾和不符合奥卡姆剃刀原则的部分；分析必须迭代，直到找不出新的有效问题。

### 验收指标

1. 审计覆盖生产调度入口，而不是只看名为 `scheduler` 的目录：Task control driver、Mission/Task/Session execution occurrence、Orchestrator dispatch、恢复与终态投递、scheduled automation、delayed wake、重试、重启恢复和多项目隔离均在范围内。
2. 每个问题必须绑定具体代码、数据或契约证据，并说明可观察后果、直接触发点、控制流根因、为何属于必要复杂度或偶然复杂度，以及旧路径为何未根治。
3. “过度工程”不得以文件多、代码长或主观审美判定；必须证明存在重复事实源、重复状态机、跨层补偿、无消费者抽象、失配协议、不可达分支、无界恢复环、复杂度成本大于被证明需求，或更简单设计能保留同等安全与可观察性。
4. 建议必须保持当前架构硬约束：流式 Large Language Model（LLM，大语言模型）交互、真实参与者消息完整可见、immutable facts（不可变事实）与 reducer projection（归约投影）权威、queue as hint（队列只作提示）、exact occurrence identity（精确执行轮次身份）、fenced lease（带围栏租约）、单一当前实现和无兼容 fallback（后备路径）。
5. 至少三条相互独立的审查线进行首轮审计，主 agent 回到全仓调用图、当前工作区差异和架构规格逐项核验，不直接采信 agent 结论。
6. 后续轮次必须拿已有问题清单做反证、遗漏搜索与交叉审查。饱和条件是：完成一整轮覆盖全部审查面和生产入口的复查后，没有新增通过证据核验的问题；纯改写、同根因实例和证据不足猜测不计新增。
7. 最终报告区分：已证实问题、设计张力但当前合理、证据不足的未知项、建议删除/合并的机制、建议保留的必要复杂度，并按风险与简化收益排序。
8. 报告完成后，由未参与报告写作的独立 agent 只读审查完整交付物、代码证据、遗漏面、文档和结论强度；全部有效发现修正后再复核，直至没有未解决发现。

### 硬约束

- 当前 `v0.0.55beta` 工作树已有大量用户或并行任务改动，涉及 Dynamic Expert Squad、`dispatch_agents` frontier、Session、Task control、Mission closure、LLM retry 和对应测试。本审计把这些工作区内容视为“当前设计”读取，但不修改、不回退、不暂存、不提交它们。
- 本轮是架构与算法分析，不授权修改生产实现、运行真实 Provider、操作用户窗口或进程、创建发布/tag/Pull Request。
- 不运行任何 User Interface（UI，用户界面）自动化测试。
- 结论必须区分 `HEAD` 既有实现和工作区未提交设计；未提交设计不得被写成已经交付的生产事实。
- 本报告只提出可独立验证的收敛方向，不为保持旧路径而建议双读写、兼容层或第二套调度权威。

### 已读资料

- 用户提供的仓库级 `AGENTS.md`
- `specs/current/architecture/03-control.md`
- `specs/current/architecture/15-agent-facts-and-turns.md`
- `specs/current/architecture/18-scheduled-automations.md`
- `specs/current/architecture/99-principles.md`
- `specs/current/architecture/task-control-plane.md`
- `specs/records/2026-08/2026-08-30-dynamic-frontier-reliability-and-token-budget.md`
- Memory registry 中关于 `Projection = Reduce(...)`、`Queue = Hint(...)`、Mission acceptance resume 和 direct dispatch fan-out 的历史边界；历史结论只作检索线索，仍以当前仓库证据复核。

### 全仓搜索基线

- 名义 scheduler 位于 `packages/opencorvus/src/scheduler/**`，但 Task 调度核心分散在 `engine/task-control-driver.ts`、`engine/agent-coordination.ts`、`orchestrator/dispatch-*.ts`、`session/loop.ts`、`mission/process-recovery.ts`、`mission/execution-closure.ts` 与 runtime occurrence/settlement 模块。
- 当前工作区新增 `dispatch_agents` frontier 与恢复器，并修改 Session loop、Task driver、Mission closure 和 Provider activity facts；它们必须与单 occurrence `dispatch_agent`、durable lineage、Turn decision reducer 和 restart recovery 一起审查，不能当成独立 helper。
- 当前架构声明 queue 不是真相、re-entry callback 内工作必须全部 await、owner liveness 必须 durable、每个 `continue` 必须消耗严格下降的度量、每个非终态必须拥有 finite wake 或 operator-visible surface。这些声明将作为实现反证的主要不变量。

### 独立 agent 反馈

实施前：无。方案落盘后委托了三条互不重叠的只读审查线：

- 权威与状态最小化：围绕 facts、projection、queue、registry、lease、timer、receipt、lineage、Message/Part 与 lifecycle 建立写读关系；
- 收敛、并发与恢复：覆盖 Task/Mission/Session occurrence、正常与终态、重试、重启、串并行、多 backend 和多项目；
- 抽象、协议与产品入口：从 HTTP、Tool、Session prompt、Expert Squad、Automation/Event、operator ingress 和 startup recovery 反向审查实际消费者。

各 agent 均禁止修改文件、运行测试和再次委托。它们的候选项由主 agent 回到当前代码、工作区差异和架构契约逐条复核；重复实例按共同根因合并，不直接按 agent 数量累计问题。

专题分析收敛后，另委托一名未参与分析与写作的独立agent审查完整报告、索引、Git差异、关键代码证据、严重度和验证边界。该reviewer首次发现A2架构表述、A12 promotion语义、B10 lost-wake反证、统计口径和精确提交边界五项交付问题；主agent逐项回查并修正。再次复核没有发现新的算法根因、严重度或代码证据问题，只要求把这次纠错本身写入迭代记录并再次闭环；记录和标题修正后的最终只读复核结论为“无未解决发现”。

## 审计方法

### 审查线 A：权威与状态最小化

建立事实、投影、队列、内存 registry、lease、timer、receipt、lineage、Session Message/Part 和 lifecycle 的写入者/读取者矩阵。寻找同一业务判断由多个可变面重复保存或通过跨层 repair 同步的地方，并验证能否删去一个面而不损失安全性。

### 审查线 B：调度与良基收敛

从所有生产入口追踪 request、scan、wake、dispatch、settlement、completion、retry、restart recovery 和 cancellation。为每条循环标注单调度量、预算、wake ownership、终态和失败可见面，寻找无界循环、重复 wake、lost wake、head-of-line blocking 与把观察性故障升级为调度故障的路径。

### 审查线 C：抽象与协议剃刀

逐层比较 Mission、Task、Session、frontier、workflow node 与 scheduled automation 的需求是否真正不同。寻找因 API/Tool/prompt 不匹配而增加的新状态机、通用化但只有一个消费者的抽象、Host 对模型行为的补偿、以及同一 primitive 被包装后再次实现 recovery/settlement 的结构。

### 审查线 D：调用方与真实产品语义

从 HTTP/API、Session prompt、Mission orchestration、Expert Squad、automation fire、operator message 与 startup reconciliation 反向追踪。检查复杂机制是否有真实生产调用方、是否把不同 provenance（来源）错误合并，或相反把同一种 occurrence 人为拆成多套实现。

### 证据与严重度

每个候选项记录：代码位置、生产调用链、违反或拉扯的不变量、现实故障模式、建议的最小权威、删除/迁移顺序、验证方式和不确定边界。严重度分为：

- P0/P1：可能破坏精确一次外部效果、跨项目隔离、终态收敛或造成持续资源消耗；
- P2：导致重复调度、恢复不可靠、显著 token/延迟成本或维护者无法安全推理；
- P3：当前正确但存在无收益复杂度、重复契约或高变更成本。

## 迭代记录

### 第一轮：独立拆解

三条审查线首轮合计提出 23 个候选。主 agent 复核后形成第一版 15 个运行时或算法问题、2 个当前架构文档问题和 1 个系统级设计背景；后续合并清单复查识别、校正并去除误报后，最终确认34项运行时或算法根因，另列2项当前架构文档矛盾和1组不计缺陷的设计背景/未知项：

- 多个 agent 独立命中的 `dispatch_agents`、Mission recovery marker、Task named wait、容量模型和 Mission close 问题按共同根因去重；
- “Event 与 Automation 分开”不计问题：时间 recurrence 与 event fire 的 provenance 和 retry identity 确实不同；问题是它们没有共享物理 execution admission/settlement primitive；
- `SessionWake` physical receipt 与业务 settlement、Task/Mission/Session 三层 ownership、immutable request/outcome、fenced lease、heartbeat lost-edge backstop 均被保留为必要复杂度；
- 未提交 `provider_activity_outcome.attempt_count` 只有 checker 消费，但它可能是无法从终态重建的真实执行证据，证据不足，不列缺陷。

### 第二轮：各线反向入口复查

- 收敛线新增两个有效问题：Automation retry 改变 logical fire identity，以及 bounded worker 使用 poll 开始时的 stale `now` 创建后续 lease；
- 权威线与抽象线没有新增独立根因，补强了 Agent Coordination mutable projection 与 dispatch durable owner 缺失的证据；它们提出的 Mission non-operator wake fence 候选在最终交叉挑战中被反证删除；
- `dispatch_agents` 被进一步确认不是缺失的 fan-out primitive：HEAD reducer、Tool coordinator 和正向测试都已允许同一 assistant 的多个 sibling `dispatch_agent`。

### 第三轮：分线饱和复查

三条线重新覆盖所有生产入口、`while`/timer/lease/retry/`Promise.all`、restart recovery 和终态路径。没有新增独立根因；命中项均可归入第二轮前的清单、必要 provenance 分离，或缺少生产证据的猜测。

### 第四轮：合并清单交叉挑战

主 agent 将完整问题清单发回三条审查线，要求只报告新的独立根因、误报、应合并项和严重度异议。两条线返回零新增，第三条线发现 activity-triggered wait 的 Bus delivery 与 Automation→Task ownership transfer 存在独立 crash cut。主 agent 复核 `Bus` subscriber durability、Task ingress identity、Automation fail/retry 和 due path 后确认该 P1，记为 A5。

该轮同时删除了“Mission non-operator wake fence 分散”这一误报：`SessionWake` 已提供原子 `preflightBundle` / `commitBundle` 扩展面，Automation 与 Event 读取各自 source authority 是必要 provenance 校验，当前没有生产 caller 漏 fence 的证据。其余反馈用于合并重复实例、降低没有运行数据支撑的严重度。

### 第五轮：新增根因后的再饱和

三条线以 A5 为新输入，重新覆盖 Session/Task wait、Bus durable delivery、Automation claim/tombstone/fail/retry/restart、Task ingress acceptance 与相邻产品入口。两条线确认相邻命中均属于 A5；第三条线发现 Task prompt 对 scheduled wait 另建了一个不读 tombstone/epoch 的 current projection。主 agent 复核后确认即使 A5 完全修复，已正常 fired/consumed 的 wait 仍会被描述为 future wake，记为独立 P1 A6。

### 第六轮：Prompt projection 新根因后的再饱和

三条线以 A6 为新输入，重新覆盖 Task description、prompt snapshot、scheduler current projection、tombstone/revision/epoch、`no_action` authority 与相邻入口。复查发现 A6 不只是读模型遗漏：Task wait registration与真实 due execution同样没有绑定 execution epoch。主 agent复核创建、terminal/reopen、retry、fire identity和 ingress acceptance后确认旧 epoch wait可实际进入新 epoch，记为独立 P1 A7。

### 第七轮：Execution epoch 新根因后的再饱和

三条线以 A7 为新输入，重新覆盖 wait create/claim/fire/retry/tombstone、Task terminal/reopen/cancel、新旧 epoch ingress 与相邻 delayed effects。一条线补充了永久 target absence没有 absorbing disposition，该项并入 B6 的 retry/disposition根因；另一条线发现所有 Tool-created scheduled definition都存在 definition commit→Tool outcome 的独立 crash cut。主 agent复核 wait、schedule与Event创建及Session interruption recovery后确认该 P2，记为 A9。

### 第八轮：Scheduled Tool effect 新根因后的再饱和

三条线以 A9 为新输入，重新覆盖全部 Tool-created durable effect、request/outcome causation、process interruption/replay/dedupe 与相邻 Tool。`schedule run`、update/pause/resume/delete和Event cancel均被归入A9，因为修复都是 exact Tool occurrence request/outcome；另一条线发现 `panel.create_task` 虽已有Task request replay primitive，却没有默认把 `ctx.callID` 接到 request identity。主 agent复核后确认同一Tool意图可创建两个真实Task，记为独立 P1 A10。

### 第九轮：Task creation identity 新根因后的再饱和

三条线以 A10 为新输入，重新覆盖 Task creation全部入口、owner/idempotency、Tool outcome/replay、sibling calls、UI/control/external request ID与相邻 create effects。`panel.wake_mission`与`wake_work`的随机目标Session被归入A10同一Tool-request根因；另一条线发现Global Task create在durable acceptance后把首轮dispatch fault误作Project creation failure并删除幂等事实。主 agent复核route、GlobalTaskService、Task commit/dispatch和Project deletion后确认该 P1，记为A11。

### 第十轮：Global Task acceptance 新根因后的再饱和

三条线以 A11 为新输入，重新覆盖 Global Task create、implicit Project allocation、route `202 Accepted`语义、commit/dispatch边界、cleanup/replay与相邻Project create入口。Global route不转发稳定request header被归入A11 accepted/replay契约；复查另发现 carrying Project在业务aggregate前已结算并丢弃creation journal，以及Task replay没有canonical create fingerprint。主 agent复核后记为A12与A13。

### 第十一轮：Global allocation 与 replay fingerprint 新根因后的再饱和

三条线以 A12/A13 为新输入，重新覆盖 global allocation/promotion/replay、Task create全部持久字段、request/channel replay分支、conflict契约与Global Chat现有正确实现。复查发现channel identity虽有DB唯一索引，但create owner只有进程内锁，跨backend concurrent loser没有channel collision recovery；同时requestID与channelBinding可并存，却按channel-first短路、没有交集一致性。主 agent复核后分别记为A14与A15。

### 第十二轮：Channel create owner 新根因后的再饱和

三条线以 A14 为新输入，重新覆盖Task create request/channel双identity、跨进程owner、unique collision recovery、winner payload conflict与全部create调用方。该轮收到A15，并发现per-project request owner既未按Project分区、又把完整首轮Provider Turn包在锁内，记为A16；因此其余零新增结果不足以结束审计。

### 第十三轮：Composite identity 新根因后的再饱和

三条线以 A14/A15/A16 的最终证据为新输入，再次覆盖所有Task create owner、identity组合、owner partition/lock boundary、collision recovery与调用方。复查发现create在durable winner前把完整IntentBundle写进随机Task runtime root，failure/loser/crash均无回收，记为A17；因此其余零新增结果不足以结束审计。

### 第十四轮：Precommit projection 新根因后的再饱和

三条线以 A17 为新输入，重新覆盖Task create全部precommit filesystem/CAS/process-binding side effect、winner publication、failure/replay、GC与delete边界。该轮形成了删除契约与runtime cleanup不一致的初版A18候选；第二十三轮事实反证纠正其错误调用链，并拆成当前A18a/A18b。

### 第十五轮：Physical deletion 新根因后的再饱和

三条线以 A18 为新输入，重新覆盖全部Task/Session delete、tombstone/physical delete、Project delete、runtime root/CAS/tool-output、cleanup receipt/recovery与公开删除契约。并行回传还确认Task aggregate与canonical `task.created` event分两次commit且无replay owner，记为A19；该轮结果不足以结束审计。

### 第十六轮：Aggregate event publication 新根因后的再饱和

三条线以 A19 为新输入，重新覆盖所有aggregate commit→Protocol event/SSE/outbox的 `Database.effect` 边界、replay/ensure与Task/Mission/Session lifecycle publication。删除语义轮又发现ordinary Project deletion把整个user-authored `.opencorvus` config root当runtime target，记为A20；该轮结果不足以结束审计。

### 第十七轮：Project ownership deletion 新根因后的再饱和

三条线以 A20 为新输入，重新覆盖Project delete ordinary/anonymous、cleanup candidates/admission/quarantine/recovery/rollback、runtime-vs-config owned roots与公开契约。复查发现Project支持worktree+多sandbox registered roots，但delete manifest强制单target且只清primary，记为A21；因此其余零新增结果不足以结束审计。

### 第十八轮：Multi-root Project ownership 新根因后的再饱和

三条线以 A21 为新输入，重新覆盖多root Project ownership、sandbox register/unregister/promotion/delete、manifest multi-target去重/嵌套/rollback/recovery与GC。复查发现Project deletion admission让Task delete在Build observation cleanup前early return，随后cascade删除cleanup owner，记为A22；因此其余零新增结果不足以结束审计。

### 第十九轮：External cleanup owner 新根因后的再饱和

三条线以 A22 为新输入，重新覆盖Project/Task delete前全部external resources与cleanup owners（Git refs、worktrees、Model Context Protocol credentials、artifacts、content-addressed storage、processes）、foreign-key cascade、owner handoff与recovery。复查发现public worktree remove可删除仍被durable Session引用的sandbox并解除注册，记为A23；因此其余零新增结果不足以结束审计。

### 第二十轮：Sandbox durable lineage 新根因后的再饱和

三条线以 A23 为新输入，重新覆盖worktree/sandbox create/register/use/remove/GC、Session/Task/Mission durable directory引用、Instance closure、Project delete与rehome约束。复查补充了Project-owned Workspace/managed worktree registry与branch残留；它与Build observation refs同属Project deletion绕过Git external child cleanup owner，归入A22，不另计根因。

### 第二十一轮：Git external child cleanup 合并项再饱和

三条线以A22的Build observation refs、Workspace与managed worktree三个实例为输入，重新覆盖Git registry/branch/private refs、foreign-key cascade、Project deletion manifest handoff与Worktree GC。复查发现Workspace自身create/remove primitive也没有共同durable lifecycle owner，记为A24；因此其余零新增结果不足以结束审计。

### 第二十二轮：Workspace lifecycle 新根因后的再饱和

三条线以A24为新输入，重新覆盖Workspace create/remove/readiness、Git多阶段mutation、sandbox CAS、branch-only/registry-only residue、retry/recovery/GC与Project delete复用。两条线直接返回零新增；第三条线把`Worktree.remove`在registry prune后丢失唯一branch identity列为候选。主agent复核后确认它与create侧的ready-worktree-without-Workspace-row窗口共享同一缺失事实：Workspace/Worktree外部资源没有跨阶段durable lifecycle occurrence，因此补强A24而不另计根因。

### 第二十三轮：全清单事实反证与专题搜索初步饱和

三条线从全部生产入口重新反证A1-A24与当时的B1-B10。收敛线与抽象线零新增且无拆分；权威线指出旧A18把`deleteTasks=true`误写成Task/Session physical delete。主agent回查`task-api/index.ts:2180-2265,3004-3185`后确认：Task/Mission-bound路径只写tombstone，普通无Task Session才物理删row；于是把A18纠正为两个必须独立修复的子项A18a/A18b，并保留普通Session漏写`session.deleted`为A19。纠正后的完整清单再次交叉复核，三条专题线均返回零新增、无必须拆分；这证明专题搜索达到初步饱和，但不替代后续未参与分析者对事实强度和误报的独立交付复核。

### 第二十四轮：最终独立交付复核与误报清除

未参与前23轮的独立reviewer抽查完整报告、关键生产调用链、current architecture、工作区差异与检查输出，确认三项有效结论纠偏：A2不是实现单方面违反架构，而是durable-owner总则与仍用于新写入的optional-owner/grace例外自相矛盾；A12没有权威契约证明request ID跨Project promotion永久幂等，故删除该子结论并降为P2，只保留pre-aggregate allocation crash cut；原B10没有完成lost-wake安全反证，与current architecture明确的跨pass最小wake契约一致，故从问题清单删除并归入必要复杂度。同步把统计从35校正为34项运行时/算法根因，并确认两个README必须通过精确index排除并行Dynamic改动。

修正后再次独立复核，没有发现新的算法根因、严重度或代码证据问题；只指出本轮纠错记录尚未写入报告。补齐本节与“独立agent反馈”、修正第23轮标题后，再次送回同一独立reviewer作最终只读复核，结论为“无未解决发现”。

## 最终问题清单

### A. 合并前必须处理的高风险问题

#### A1. 未提交 `dispatch_agents` 是平行协议，且宣称的 frontier 原子性不成立

**状态：工作区未提交；严重度：P1 设计阻断项，不是已发布事故。**

HEAD 已允许同一 assistant Message 内的多个 sibling `dispatch_agent` 构成一次合法 fan-out：

- `packages/opencorvus/src/engine/task-root-ingress-reducer.ts:170-177` 归约同一 Message 的多个同命令决策；
- `packages/opencorvus/src/tool/execution-mode.ts:90-114` 允许连续 `dispatch_agent`，拒绝的只是混合 lifecycle decision；
- `tool-decision-coordination.test.ts:53-61`、`task-root-ingress-reducer.test.ts:44-58` 和 `orchestrator-tool-surface-contract.test.ts:156-160` 已锁定该正向契约。

工作区仍同时暴露 `dispatch_agent` 与 `dispatch_agents`（`orchestrator/tools.ts:2659-2660`），并在 `dispatch-agents-tool.ts:34-315` 增加 outer Tool Part、Host 生成的 child call/Part、硬编码上限 8、`Promise.allSettled` 聚合和 outer settlement；`dispatch-agents-recovery.ts:30-126` 与 `session/loop.ts:2376-2394` 又增加专用恢复分支。

它只在启动 worker 前验证数组 shape；真正的 workflow、lineage 和 admission 校验到每个 canonical child execute 才发生。部分 child 可以完成并被 reducer 接纳，另一 child 失败后 outer Part 报错；Tool coordinator又会释放 outer decision claim。此时耐久 decision 已存在而 outer decision 被视为失败，后续模型可能重复 frontier 或提交不同 lifecycle decision。这不是不可分的 prepare/commit，而是 outer + N 个 synthetic child occurrence 的额外 crash cut。

旧路径没有缺少 fan-out；真实需求是“模型稳定提交完整 ready set”。新设计把 prompt/Provider 行为问题下沉成 Host 状态机，却仍不能证明数组没有漏成员。最小路线是删除 wrapper、专用 recovery 和工具名特判，保留 canonical sibling `dispatch_agent`；若真实 Provider 证明确需结构化 batch，则应一次性把 canonical dispatch occurrence 升级为集合事实，以 `(frontier occurrence, member index)` 表达成员，不再合成模型没有调用的 child Tool Parts，也不长期保留两套协议。

#### A2. Dispatch optional-owner grace从历史例外扩散为当前写入路径

**状态：HEAD；严重度：P1。**

`engine/dispatch-lineage.ts:114-163` 捕获 `currentRuntimeOccurrenceID()` 失败并省略 `owner_process_occurrence_id`；生产 `orchestrator/tools.ts:2552-2576` 没有显式传 owner。随后 `task-root-ingress-delivery.ts:1353-1380` 在 peer backend 看不到本地 pipeline 时，只按 commit time 给一段 grace，之后可把仍活着但没有 durable owner identity 的 worker 判为 abandoned。

`task-control-plane.md:280`一方面要求owner liveness必须durable、每条lineage记录exact process occurrence，另一方面又允许“claim存在前写入的lineage”按commit time存活一个lease周期；当前writer不是只读历史兼容，而是仍可为新dispatch持续制造这种ownerless row。共享数据库中的backend不能在worker可能仍活着时仅凭“本地registry没有+grace已过”证明远端owner死亡，故这是current architecture总则与grace例外自身的矛盾，不是实现单方面偏离文档。

最小路线：process occurrence/lease成为新dispatch admission前置，lineage owner对新写入必填；无法建立身份时readiness或dispatch typed fail。升级时用一次原子迁移枚举ownerless历史lineage：能从terminal lifecycle/settlement分类的直接收敛，其余写typed infrastructure interruption/reconciliation fact；迁移后删除optional writer和commit-time grace，不能保留双读。

#### A3. Mission `closing` occurrence 重启后可能永久悬置，后续请求还会错配来源

**状态：HEAD；严重度：P1。**

`mission/execution-closure.ts:394-417` 先写 `mission.execution.closing` 再执行外部取消；`mission/session.ts:347-400` 与 `engine/host-recovery.ts:126-161` 的 startup candidate 不覆盖 latest pure `closing`。若进程在 closing 后、child Task/Session 收敛前崩溃，Mission 没有自动 resume owner，non-operator wake 又会被 closing 拒绝。

以后再来一个 abort/archive 请求时，`execution-closure.ts:401-418` 返回旧 closure 却运行新请求捕获的 `input.close`；route callback 在 `server/routes/mission.ts:152-225` 使用新 handle/origin，而最终 `closed` event 在 `execution-closure.ts:504-515` 仍记录旧 source/request ID。最小路线：closing fact 持有完整取消 provenance；首次执行与重启都进入同一个 `resume(closing)`；startup 显式枚举 latest closing，实际效果只能从 durable occurrence 派生。

#### A4. Mission process recovery 是第二恢复队列，首次 claim 存在跨 backend 竞态且 attempt 无界

**状态：HEAD；严重度：P1。**

`mission/process-recovery.ts:16-69` 的可变 SessionControl marker 复制 occurrence、attempt、interrupted assistant 和 wake Message/TextPart/Control IDs；`119-214` 同时扫描 Message、旋转随机 IDs、terminalize assistant、发 wake，再靠 completion callback 清 marker。相同 wake reason 又存在于 Message.extra 与 `wake_reason` Control。

首次 marker 只是普通 create，没有 pending-per-Session 唯一事实或 fenced claim。两个共享数据库的 backend 可同时读到 `previous === undefined`，各自生成不同 marker/wake；之后 `pendingMarker` 看到多个只会抛错。attempt 只递增，没有 Mission execution epoch 预算或 exhausted operator surface。

marker 修补的 terminalize→wake crash cut 是真实需求，但不需要第二可变队列。最小路线：用 exact interrupted/process occurrence 确定性派生唯一 immutable recovery request 和 wake identity，跨进程 fenced claim；复用真实 wake/reply receipt，并把有限预算绑定 Mission execution occurrence。

#### A5. Task wait supersede authority 错绑到物理 Bus 事件，且 ownership transfer 有 crash cut

**状态：HEAD；严重度：P1。**

Session 的 Message/Part 写入会在同一数据库事务中建立 durable Bus publication，但 `automation-service.ts:967-1006` 用没有 `durableID/effect` 的普通 runtime-local subscriber 处理 user Message 与 terminal Tool Part。`bus/index.ts:687-739,784-789,1214-1246` 显示普通 subscriber的 callback失败会结算为 `ignored`，没有稳定 occurrence-idempotent effect receipt。启动通常会先安装新订阅再 replay durable outbox，因此不能笼统断言“每次重启都丢 activity”；已确认的是显式 callback failure会终结这次物理 projection，而且 crash/replay无法保持同一个 supersede effect identity。

正常、无故障路径也不覆盖 canonical Task ingress。Task wait只写 `task_id`，不写 `session_id`（`scheduler/delayed-wake-schedule.ts:77-103`）；Message handler先清 Session wait，遇到真实 operator Task-root Message立即 return（`automation-service.ts:976-992`），root Session也不满足 `taskIDForDirectSchedulerActivity` 的“直属 orchestrator child”条件（`1009-1018`）。与此同时 Task API 已在 `task-api/index.ts:1078-1102` 原子提交 operator Message + root ingress 并立即 dispatch。现成 `consumePendingTaskWaits`（`automation-service.ts:755-783`）没有生产调用。因此真实输入已经唤醒 Task 后，旧 wait仍保持 active，到期会再产生第二个 Orchestrator ingress。

Task early-activity path 还有第二个独立 crash cut：`automation-service.ts:819-857` 先 claim wait，再调用 `dispatchTaskLoop`；`task-root-ingress-delivery.ts:1745-1794` 先独立提交 `taskWaitActivity` ingress，再运行可能失败的 reconcile；Automation tombstone 与 lease release直到 `automation-service.ts:859-905` 才逐 job提交。若 reconcile 在 ingress accepted 后抛错，catch 会在 `855-857,1881-1890` 把 wait写回 retry；若进程直接崩溃，lease到期后也可重新 claim。随后 due path在 `1709-1759` 以另一 `automationRunID` 原子写 `taskWaitWake` ingress与tombstone。early activity 使用 inline/wait hash，due wake 使用 automation run identity（`task-root-ingress-delivery.ts:190-212,287-300`），两者不会查重，故同一个 wait 可产生 activity ingress I 与 due ingress J 两个语义 Turn。

旧 due path 已正确把 ingress acceptance、current revision tombstone 与 lease fence 放在同一事务，并把后续 delivery failure解释为“ingress仍已接受”；early path重新实现了一套更弱协议。最小路线：把 qualifying canonical Task ingress acceptance 定义为 supersede authority，并在同一 fenced transaction 完成 current wait revision consume/tombstone；如果仍由 Bus activity触发，则必须贯穿 exact durable occurrence identity。事务后的 reconcile只负责 delivery，失败不得把已消费 wait排回 Automation retry。删除根据 Message/Tool 物理事件猜测业务活动的 Host 补偿；Session wait cancellation同样必须是 durable、occurrence-idempotent effect。

#### A6. Task scheduled-wait prompt 使用不读 tombstone/epoch 的第二 current projection

**状态：HEAD；严重度：P1。**

Scheduler 的 canonical definition projection 在 `automation-service.ts:204-244` 读取 `AutomationDefinitionTombstoneTable`，已 fired/consumed wait 会追加 revision tombstone并不再发火。但 `engine/describe.ts:436-448` 的 `describeTaskScheduledWaits(taskID, floor)` 只扫 `AutomationTable`、按 definition选最新 immutable row，再调用不含 tombstone的 projection；传入的 `floor=task.time_started` 完全未使用。原 definition row仍是 `status=active`，所以已 fired、activity-consumed、甚至旧 Task execution epoch 的 wait继续被标为 `enabled=true`。

`describe.ts:1054-1070` 明确告诉模型 pending entry 是 future wake source；`orchestrator-core.txt:275-277` 又允许存在 active scheduled wait 时以 `no_action` 结束 ingress。于是 wait D已经正常 tombstone后，后续 Task snapshot仍显示 D pending，Orchestrator可依公开契约合法 `no_action`，但实际没有 worker、Interaction、successor ingress或 scheduled wake，Task不再收敛。projection cap为5且按最早 due排序，五条历史 tombstoned wait还可永久遮住真正当前 wait。

该问题独立于 A5：即使 ownership transfer完全原子，成功 tombstone后仍稳定复现。最小路线：Scheduler、Task description与API共用唯一 tombstone-aware current-wait projection；Task wait绑定 exact execution epoch/occurrence，旧 epoch只作为 run/history evidence，不得从 immutable active definition推断 future authority。

#### A7. Task wait 的真实执行 authority 不绑定 execution epoch

**状态：HEAD；严重度：P1。**

`scheduler/automation.sql.ts:7-38` 的 delay definition只有 `task_id/due_at`，没有 execution epoch；`delayed-wake-schedule.ts:77-103` 创建 Task wait时也只校验 Task/root Session后写 `task_id`。Task reopen在 `engine/task-intent-open.ts:14-33` 与 `engine/state.ts:188-197` 只追加新 lifecycle epoch，不 retire旧 wait；`consumePendingTaskWaits`只有定义、没有生产调用。

wait到期时 due path只重新校验 Task/Project/Session；`task-root-ingress-delivery.ts:215-250` 随后读取执行当下的 current lifecycle epoch并接受 ingress。`task-wait-fire-identity.ts:1-5` 也只由 job ID派生，没有 epoch fence。因此 E1 创建的 wait D在 Task terminal→reopen为 E2 后，会被写成 E2 的合法 `taskWaitWake`；若 D先在 terminal间隙触发，Automation fail/retry还会保留它，reopen后再次执行。

这独立于 A6：Prompt完全正确也挡不住真实旧 wake。最小路线：Task wait registration必须持久化 exact execution epoch，due claim/ownership transfer同事务验证仍为该 epoch；stale wait只结算为 terminal-inapplicable/disposition，不创建 ingress。若按 B3 把 wait迁移为 Task-native fact，epoch应成为必填 occurrence key。

#### A8. Exhausted ingress 的 operator surface 写失败后仍被永久 memoize

**状态：HEAD；严重度：P2。**

`task-root-ingress-delivery.ts:1088-1140` 明确说 unsurfaced settlement 等同静默丢输入，但 `surfaceOperatorGatedTaskRootIngress` 捕获持久化错误后只记录日志、不返回成功状态。`1543-1549` 随后无条件把 exhausted ingress 加入 process-local `settledIngressIDs`；该进程以后不再重试 surface。

这与注释“only a surfaced gate may be memoized”自相矛盾，也破坏“每个非终态有 finite wake 或 operator-visible surface”。最小修复不是增加另一个恢复器，而是让 surface 返回 durable acknowledgement；只有成功后 memoize，失败则保留有限 retry/wake 并按统一 infrastructure budget 收敛到可见错误。

#### A9. Schedule/wait/Event 的耐久 definition、mutation 与 manual fire 不绑定 exact Tool occurrence

**状态：HEAD；严重度：P1（manual fire），其余 mutation 为 P2。**

Session processor先持久化 running Tool Part（`session/processor.ts:892-919`），Tool execute返回后才由后续 `tool-result` 写 completion outcome（`961-1006`）。但 `wait` 在 execute内立即以随机 Automation ID创建 Task/Session wait（`tool/wait.ts:31-48`、`scheduler/delayed-wake-schedule.ts:47-103`）；`schedule` 同样在 execute内创建 recurring Automation或Event job（`tool/schedule.ts:109-136,195-213`）。这些 definition没有 Message/call/Tool Part causation locator。

若进程在 definition commit后、Tool result commit前崩溃，`session/loop.ts:2395-2440` 会把 pending/running Tool Part终结为 `process-execution-interrupted` error，但已创建 definition仍会发火。模型根据失败结果重试时，随机 definition ID无法 dedupe，产生重复 future wake或长期 Automation/Event effect。`Tool.Context` 已有 exact `callID`，SessionLoop也有 `toolPartID`，问题不是身份不存在，而是 effect没绑定它。

最小路线：所有 Tool-created scheduled definition使用 exact Tool call/Part occurrence作为 immutable causation，并采用 deterministic definition identity或唯一 causation约束；恢复必须从该 definition重建成功 outcome，或通过统一 effect request/outcome primitive收敛。HTTP/API create保留自己的 request idempotency contract，不与Tool来源混为一谈。

同一根因也覆盖已存在 definition上的 mutation/manual execution。`tool/schedule.ts:149-193,225-233` 没有把 persisted Tool invocation传入 update/pause/resume/delete/cancel；最危险的 `action=run` 直接调用 `AutomationService.runNow`，`automation-service.ts:561-590,1158-1170` 每次用新 `Date.now()` 生成 manual owner与 fire identity。第一次真实 fire已产生Session/Message/外部效果、但Tool outcome前崩溃时，重试会生成第二个 fire并重复执行。manual fire必须以 exact Tool occurrence原子 reserve；相同调用只能resume/返回既有 fire receipt，changed payload必须冲突。update/delete等作为同一 request/outcome causation问题的低严重度实例，不另造状态机。

#### A10. Panel Tool 的 Task/Mission/Work create effects 没有绑定 persisted Tool request authority

**状态：HEAD；严重度：P1。**

`panel/capability.ts:329-348` 让 `request_id` 可选。Mission Tool execution在 `tool/panel.ts:440-455` 已持有 `ctx.callID` 并写入 creator provenance，但真正创建输入在 `990-1016` 只使用可选参数、Control request或 `ctx.extra.requestID`，不默认使用当前 Tool call ID。Task API虽在 `task-api/index.ts:1668-1693` 已有 `findTaskByRequest` replay primitive，只有 requestID存在才启用；`engine/task-creation-owner.ts:13-35` 也会在无key时无锁执行。

Task ID随机生成，Task/root Session/creation ingress在 `task-api/index.ts:1733-1843` 提交后才运行可能失败的 `dispatchPersistedTaskLoop`。因此 Tool call C省略 request_id，T1已提交但Tool outcome前崩溃或post-commit dispatch抛错后，恢复将Tool标为失败；重试同一意图会创建随机T2，两个真实Task可同时执行。

最小路线：所有非UI `panel.create_task` 默认以 exact persisted Tool call ID作为 request identity；显式 external request ID只能作为定义清楚的外部幂等键，不能替代 sibling Tool-call identity。replay还必须校验 creator Session/Message/Tool call与immutable creation payload。UI/HTTP来源保留各自request契约，不加跨来源fallback。

同一 adapter根因也存在于相邻create effects。`panel.wake_mission` 在 `tool/panel.ts:567-569,1080-1125` 先用随机mission ID创建Session，之后才把 `ctx.callID` 传给限定在“本次新sessionID”内的 execution-open；caller receipt没有Tool invocation唯一约束。`panel.wake_work` 在 `1212` 每次创建随机Work Session，再依次overlay/wake/handoff。任一durable commit后、Tool outcome前崩溃，重放都会再建并唤醒一个Mission/Work Session。修复应以 exact `(sessionID,messageID,callID/toolPartID)` reserve panel handoff/create request，让目标ID、caller attachment、execution-open与wake从同一request收敛；payload变化冲突。

#### A11. Global Task create 在 durable acceptance 后把 dispatch fault 误补偿为 Project deletion

**状态：HEAD；严重度：P1。**

`POST /global/tasks` 宣称 `202 Accepted`（`server/routes/orchestrator.ts:280-311`），但 `task-api/global-task-service.ts:50-72` 的一个 `try/catch` 同时包住 implicit Project创建、Task durable commit和首轮调度，任何错误都调用 `deleteProject`。`task-api/index.ts:1821-1843` 已先原子提交 Task/root Session/creation ingress，`1873-1875` 才同步等待 `dispatchPersistedTaskLoop`；单Task reconcile明确传播Provider/Agent/Tool/lease故障。

因此请求R已得到Project P与Task T的durable acceptance，首轮Turn甚至可能已有持久/外部效果，后续fault却触发 `project/delete.ts:285-320` 删除Task与Project；最终 `EngineTaskTable` 删除也抹掉 `request_id` replay事实。同一R重试后 `findGlobalTaskByRequest` 查不到，分配新P'/T'并重新执行。

最小路线：Task+creation ingress提交后立即返回accepted；调度fault只由durable Task control/recovery收敛。cleanup只能发生在Task commit前，或依赖另一个不可删除的allocation/request outcome恢复；绝不能删除已接受Task及其幂等事实。

同一 accepted/replay契约在HTTP adapter还有一个前置缺口：项目内 `POST /task` 会把调用方 `x-opencorvus-request-id` 回填到body，但 `POST /global/tasks` 在 `server/routes/orchestrator.ts:279-312` 原样传递validated body；`CreateTaskInput.requestID` 可选时，GlobalTaskService完全绕过global owner/replay。于是无需触发cleanup bug，正常202响应丢失后的稳定header重试也会新建Project/Task。global route必须采用与project route一致的caller identity规则；若宣称安全重试，identity必须是可发现输入，不能依赖响应成功后才知道的server随机ID。

#### A12. Global carrying Project allocation 缺少 request-owned aggregate occurrence

**状态：HEAD；严重度：P2。**

`project/implicit-project.ts:1171-1223` 持久化Project后立即commit creation occurrence；`implicit-project-creation.ts:99-141` 的 `settleAndForget` 将责任明确止于“Project row exists”并删除journal。`task-api/global-task-service.ts:50-56` 与 `chat/global-chat-service.ts:17-35` 在它返回后才创建Task/Session，两次commit之间没有durable request→Project binding。进程在此崩溃时，startup没有open occurrence，request replay又只查Task/Session，故重试创建P'，旧P永久残留且Project/Task不由GC回收。

最小路线：normalized global request identity持有唯一durable allocation occurrence，记录payload digest、Project ID、aggregate kind与最终Task/Session ID；同一未结算allocation的replay回到该Project继续canonical创建，aggregate accepted后才结算。dead owner且aggregate确认未接受时才可删除P。

#### A13. Task replay 不校验 canonical create payload

**状态：HEAD；严重度：P1。**

`task-api/index.ts:379-403` 的 `assertTaskCreationReplayMatches` 只比较Expert Squad package/profile digest和execution capsule；request replay在 `1668-1693` 额外只比较product pillar与Artifact import set。首次 `persistTask` 在 `1823-1843` 实际持久化title、request正文、attachments、source、priority、budget、metadata、channel binding、creator projection等更多字段。

因此公开 `/task`、`/global/tasks` 或显式requestID复用同一identity但改变正文、标题、模型、附件、预算、checks、metadata或creator intent时，不会得到409 conflict；系统直接redispatch旧creation ingress并返回旧Task，却告诉调用者新payload已accepted。`chat/global-chat-start.ts:60-69,115-129` 已提供正确反例：完整请求fingerprint，同key异payload明确冲突。

最小路线：首次accepted commit保存canonical create-request fingerprint，所有request/channel/recovery replay分支统一比较；不要继续在三处逐字段补丁式扩展判断。

#### A14. Channel-binding Task create 的跨进程 loser 不收敛到 durable winner

**状态：HEAD；严重度：P2。**

`engine/task-creation-owner.ts:10-35` 的channel owner只是进程内 `Map + withKeyedLock`；跨进程唯一性只由 `engine.sql.ts:591-607` 的 `(platform,channel,thread)` unique index保证。两个backend可在 `task-api/index.ts:1646-1666` 同时读到binding absent后竞争insert；winner提交Task/root Session/creation ingress，loser进入catch。

但 `task-api/index.ts:1844-1871,2392-2397` 只识别并恢复 `(project_id,request_id)` unique error，不对channel collision重读winner、执行A13 fingerprint/Artifact/package/project校验或replay creation ingress。因此同一真实channel的loser返回constraint/500，而不是相同TaskAccepted；调用方必须额外重试才可能命中winner。

最小路线：把channel identity纳入跨进程durable create owner/request aggregate；或在精确识别channel unique collision后重读winner，执行完整canonical fingerprint与authority校验，再返回/replay同一Task。changed contract必须typed conflict，不能仅吞unique error。

#### A15. `requestID + channelBinding` 没有“必须解析到同一Task”的交集不变量

**状态：HEAD；严重度：P1。**

`CreateTaskInput` 允许两种identity同时存在，`engine/task-creation-owner.ts:13-35` 也同时获取两个owner key；`panel.create_task` 可真实组装二者。但 `task-api/index.ts:1646-1666` 先查channel，一旦命中就dispatch并return，只有channel miss才在 `1668-1694` 读取requestID。Task row的 `request_id` 与独立channel binding table没有约束要求同指一个Task。

因此R已指Task A、channel C已指Task B时，`create(R+C)` 静默返回B，单独replay R又返回A；R尚未绑定而C已存在时，`create(R+C)` 返回B却不durable绑定R，之后R可再创建T2。对已有channel的新消息，这个“成功create”还可能让本轮文字/附件没有进入Task message ingress。

最小路线：先解析所有提供的identity再求winner集合；零winner才创建，一个winner时每个identity的canonical fingerprint/aggregate必须验证并绑定到该winner，多个不同winner返回typed identity conflict。channel只是routing/binding key还是第二primary identity必须一次性定清，不能继续靠分支优先级。

#### A16. Per-project request owner 未按Project分区，并持锁跨完整首轮Provider Turn

**状态：HEAD；严重度：P2。**

数据库在 `engine.sql.ts:143-150` 只要求 `(project_id,request_id)` 唯一，相同requestID在不同Project合法独立；`engine/task-creation-owner.ts:13-22` 却只生成进程级 `request:${requestID}` key。`task-api/index.ts:1588` 用它包住全部create，new/replay在 `1868,1873-1875` 都要等待 `dispatchPersistedTaskLoop`，可能包含完整Agent/Provider Turn。

于是Project A请求R取得全进程owner，Task已commit但长Turn未结束时，同进程Project B合法同名R在进入自身lookup/commit前被阻塞；若分属两个backend则完全不阻塞，隔离与延迟语义随进程布局改变。

最小路线：per-project owner identity包含canonical projectID，与DB约束一致；owner只覆盖lookup、commit与canonical-winner settlement，creation ingress durable后不得继续持有owner等待调度Turn。A14若补跨进程channel owner，也必须按真实作用域分区。

#### A17. Task create 在accepted winner前写入最终IntentBundle，loser/failure留下不可达明文请求

**状态：HEAD；严重度：P2。**

`task-api/index.ts:1733-1789` 先生成随机Task ID并把完整request与attachment manifest通过 `IntentBundle.write` 写入 `.opencorvus/.r/tasks/<task-id>/intent/request.md`，`1821-1843` 才提交Task/root Session/creation ingress。`intent/bundle.ts:73-76,120-140` 自己说明DB Task request才是事实源，文件只是deterministic projection。

失败catch在 `task-api/index.ts:1844-1851` 只在特定artifact import条件下调用 `removeTaskArtifactRoot`；该函数与artifact recovery只删 `<task>/artifacts`，不删sibling `intent/`。Project GC只覆盖snapshot/session_diff，ownership扫描也跳过没有Session owner marker的孤儿Task root。因此persist failure、A14 channel loser、request unique loser或process-binding失败都会留下不存在Task对应的完整明文请求目录；winner返回成功也不会暴露该残留。

最小路线：以已提交Task row为唯一事实，在creation ingress dispatch/reconcile前幂等 `ensureIntentProjection(committedTaskID)`；或直接从committed request/attachments投影prompt。若必须预写，只能进入有durable owner的staging namespace，commit后原子publish，startup回收无DB owner的完整stage/root。

#### A18a. Task/Mission-bound delete 对外承诺永久删除，实际只写tombstone并保留完整事实图

**状态：HEAD；严重度：P2；若该契约被用于数据擦除则为P1。**

`server/routes/session.ts:1415-1459` 声明delete会永久移除全部associated data/messages/history；Mission与right-sidebar delete也分别声称删除conversation history。`tool/panel.ts:1491-1497`固定传`deleteTasks=true`。但`task-api/index.ts:3097-3135`只要存在bound Task或root.kind为Mission，就append Task/Session deleted boundary后提前返回，不删除Task、Session、Message、effect或runtime root；`deleteTask`在`2180-2265`同样明确是tombstone-only并保留完整replayable fact graph。

这是API/产品契约与事实保留模型的直接矛盾，不是“物理删除后漏清一个目录”。最小路线必须先选一个单一语义：若delete是审计tombstone，公开契约和UI必须明确数据仍保留，并另设需要确认的真实erase occurrence；若delete承诺永久删除，则用durable deletion occurrence清Task/Mission完整DB与runtime graph，不能把projection隐藏当删除成功。

#### A18b. 普通Session physical delete没有conversation runtime-root cleanup owner

**状态：HEAD；严重度：P2。**

真正可达的physical branch仅是`tasksForDelete.length === 0 && root.kind !== "mission"`。此时`task-api/index.ts:3137-3185`向`deleteRowsThenTaskArtifacts`传空Task数组，事务删除Session tree rows后没有任何filesystem target或cleanup receipt。与此同时，`project/runtime-paths.ts:197-212`定义普通conversation的`conversations/<session-id>/tool-output`和`work-artifacts` runtime roots，`tool/truncation.ts:190`也会在无Task identity时真实写入该tool-output目录。

因此API成功并删除canonical DB history后，conversation runtime data仍可驻留且没有startup recovery owner。最小路线是让普通Session physical delete在DB commit前持久化exact deletion occurrence及受管runtime targets，DB rows与全部conversation roots完成后再settle；失败必须返回committed residue receipt并由startup/retry继续，而不是复用空Task artifact cleanup。

#### A19. Domain aggregate/fact 与canonical Protocol event publication没有统一commit边界

**状态：HEAD；严重度：P2。**

`engine/pipeline.ts:90-174` 的transaction已写root Session、Task、package/process binding、imports、lifecycle与creation ingress；`175-184` 才注册post-commit `Database.effect(() => EngineProtocol.emit(TaskCreated))`。`storage/db.ts:1475-1497` 对effect失败只记录、不向create caller传播，进程也可在Task commit后、event append前退出；`EngineProtocol.emit` 在另一transaction append Protocol event。

request/channel replay只校验并redispatch既有creation ingress，不ensure/reconstruct `task.created`；全仓没有该event recovery。于是Task可正常运行和返回accepted，但ProtocolEvent/SSE/event-log永久缺created事实。

同一根因还出现在 `engine/interaction-request.ts:28-123` 的request/outcome→`InteractionRequested/Resolved`，以及 requirements/architect artifact→`TaskUpdated`：domain fact先commit，再用 `Database.effect` 另事务emit。普通无Task/Mission Session的physical delete则在 `task-api/index.ts:3137-3185` 完全漏写现成 `appendSessionDeletedBoundaryInTransaction` 和Bus outbox，成功响应后没有durable `session.deleted`/SSE。

`engine/protocol.ts:98-104` 已提供 `emitInTransaction`，Session与ProtocolStore也已有同事务durable outbox正确路径。最小路线是让domain writer transaction同时写canonical Protocol event/outbox；下游SSE继续从durable publication投影，不新建post-commit补偿或逐入口ensure队列。

#### A20. Ordinary Project delete 把user-authored `.opencorvus` config root当runtime root递归删除

**状态：HEAD；严重度：P1。**

`project/runtime-paths.ts:51-56` 明确config root是 `.opencorvus`、runtime root是 `.opencorvus/.r`；`session/prompt/system.txt:7` 与 `current/architecture/05-config.md:12-16` 把 `opencorvus.jsonc`、agents、commands、tools、plugins、themes定义为用户项目输入。`server/routes/project.ts:107-125` 却承诺delete只移除OpenCorvus state/task history/project-local runtime，不删workspace source。

实际 `project/delete.ts:55-65,116-123,285-352` 对ordinary Project只接受 `ProjectRuntimePaths.projectConfigRoot`，将整个 `.opencorvus` quarantine后递归清理；`project/deletion-cleanup.ts:75-92` 又把该错误target固化为唯一合法cleanup source。Global Task的A11补偿删除也会走此路径。

最小路线：ordinary Project cleanup target改为 `projectRuntimeRoot` 加少数逐项证明属于runtime的legacy roots；任何config/agents/skills/plugins等user input禁止进入cleanup authority。anonymous carrying Project本身是专属目录，可继续按整个root删除，但必须与ordinary workspace contract分开。

#### A21. Multi-root Project delete只清primary，所有sandbox runtime永久残留

**状态：HEAD；严重度：P2。**

`project/project.ts:938-991` 将 `[project.worktree,...project.sandboxes]` 都定义为registered directories；`project/delete.ts:156-168,274-277` 的delete admission与Instance closure也覆盖全部根。生产代码以 `Instance.directory` 在sandbox的 `.opencorvus/.r` 写Session diff、Mission state等。

但 `project/delete.ts:116-123,285-313` 只为primary `currentProject.worktree` 创建一个filesystem plan，`project/deletion-cleanup.ts:18-31,105,162-169` 还强制manifest最多一个target。Project row删除后GC更无法发现sandbox residues。

最小路线：manifest允许多个精确owned runtime targets；ordinary Project为每个 `[worktree,...sandboxes]` 列 `projectRuntimeRoot`，做去重、嵌套冲突、quarantine、rollback与recovery；anonymous carrying Project仍只删除唯一专属root。

#### A22. Project deletion绕过Git external child cleanup owners并级联销毁唯一receipt

**状态：HEAD；严重度：P2。**

`task-api/index.ts:2228-2250` 在settle Task ingress/Session后，只要有 `projectDeletionAdmission` 就在枚举/settle `buildObservationCleanupRowsForTask` 前return；`project/delete.ts:289-295` 对每个Task稳定传该admission，随后删除Task/Project rows。cleanup owner与receipt都以Task foreign key cascade，删除后恢复器无法再发现。

真实外部资源是source repository `.git/refs/opencorvus/build-observations/<observation-id>/*`（`engine/build-observation-cleanup.ts:127-154`），不在A20/A21 runtime cleanup内。普通Project API承诺保留source/`.git`，所以hidden refs永久固定commit/object并保留已从DB删除的历史内容，delete仍可返回committed且不报告residue。

最小路线：Project runtime-settlement必须先让所有现有Build cleanup owner取得complete receipt，再允许Task/Project row commit；若允许DB先删，则必须在同事务把未完成owner转交给不依赖Task FK的deletion manifest。复用现有Git-ref cleanup，不造第二套GC。

同一根因也影响Project-owned Workspace/managed worktree。`workspace/workspace.ts:50-78,119-140` 的正常删除会先调用 `Worktree.remove`，后者执行 `git worktree remove/prune`并删除managed branch；`WorkspaceTable.project_id` 却对Project cascade。Project delete不枚举Workspace、不调用Worktree primitive，只把 `.opencorvus/.r/project/worktrees` 当目录递归rm，source repository的 `.git/worktrees/*` registration与 `refs/heads/opencorvus/*` branch仍在；Project row删除后Worktree GC无法再发现。修复应在同一runtime-settlement穷尽所有Git child owners，或原子handoff exact directory/branch/Git-dir到独立manifest。

#### A23. Worktree release/GC只验证瞬时owner，忽略durable directory authorities

**状态：HEAD；严重度：P1（Project不可删/Session不可恢复）；数据重复风险待运行验证。**

`server/routes/project.ts:308-330` 公开worktree delete直接调用 `Worktree.removeProjectWorktree`；候选/removal在 `worktree/index.ts:947-1119` 只检查locked/current prompt与active Task process/ownership marker，之后物理删除并 `Project.removeExactSandboxes`，不查询或迁移Session rows。

Session创建时把 `Instance.directory` durable写入row；已结束prompt的Task/Chat/Mission Session仍可引用该sandbox，却满足removable。删除后Session无法再建立原directory Instance；`project/delete.ts:142-168` 又要求每个Project Session.directory位于当前 `[worktree,...sandboxes]`，sandbox已unregister后每次Project delete稳定报 `directory escapes its registered roots`。

漏判还包括可reopen的terminal Task immutable process binding，以及没有active prompt但仍存在cache/background/lease的Instance directory。Worktree GC共享相同瞬时owner判断。最小路线：统一directory release admission，查询全部未物理删除Session、Task process binding与Instance lifecycle；有引用则typed 409，或先按明确产品语义迁移/物理删除aggregate并提交，再unregister和删目录。只查运行中prompt/marker不足。

#### A24. Workspace/Worktree aggregate与external Git lifecycle没有共同durable owner

**状态：HEAD；严重度：P2。**

`workspace/workspace.ts:50-78` 先完整 `Worktree.create`（readiness、`git worktree add`、sandbox registration、populate、ready receipt），后插 `WorkspaceTable`；中间crash留下ready worktree/branch/sandbox却无Workspace row。readiness receipt只按directory表示物理ready，不知道Workspace ID且已terminal；重试又调用无稳定identity的`Worktree.create(undefined)`并随机创建第二worktree，GC则因durable sandbox registration继续保留旧孤儿。

remove反向先 `Worktree.remove`，后删Workspace row。physical directory、readiness、Git registry/branch、sandbox binding、Workspace row是一个多阶段occurrence，却没有durable owner。`worktree/index.ts:2012-2124` 先删目录与readiness，再prune registry，最后才从局部变量`entry.branch`删branch；registry消失后的crash或branch delete失败会丢失唯一branch identity，重试进入`!entry`成功分支并释放sandbox，永久留下managed branch。`removeManagedProjectWorktreeDirectory` 的preservation也只存在于返回值，上层还可压成boolean；其他crash cut会留下phantom sandbox或phantom Workspace。

最小路线：以Project+Workspace ID在Git mutation前持久化creating/deleting occurrence与canonical directory/branch；各阶段append receipt，startup/retry重放到全部settled。`Worktree.remove` 保留preservation contract并接受expected branch/primary repo；全部外部与sandbox阶段完成后才retire Workspace row。A22 Project delete必须复用增强后的domain settlement。

### B. 明确的系统设计矛盾与偶然复杂度

#### B1. Task-root decision repair 用 Host gate 教模型选择流程

**状态：HEAD，工作区扩大适用面；严重度：P2。**

`session/loop.ts:187-221,1868-1889,2165` 根据 semantic gap 注入 repair prompt、先强制 `toolChoice: "required"`，再移除 inspection/read tools，只保留 decision surface。当前工作区又用 decision declaration 把 `dispatch_agents` 纳入这个隐藏集合。

该实现把同一判断分散在 reducer gap、SessionLoop rung、prompt、Provider toolChoice 和 tool filtering 五处，并直接违反仓库“不得用 Host gate/路由旁路/工作流状态机教 LLM 选择工具与流程”的硬约束。有限 liveness budget 可以保留；应删除中途改写工具面的 rung，用稳定 prompt、上下文、工具契约和明确的 typed no-decision/exhaustion outcome 解决。

#### B2. Agent Coordination 把 reducer projection 写回 mutable Artifact，形成四重权威

**状态：HEAD；严重度：P2。**

`engine/agent-coordination.ts:44-129,846-866,957-1219,1262-1355` 让 request 自身保存 mutable `status`、response/action pointers 和 last failure；同时另有 response Artifact、action Artifact 与 Protocol Event。action 失败又把 request 从 responded 改回 pending，构成第二套 retry 状态机；`engine.sql.ts:440-444` 的唯一性还依赖 mutable JSON status。

response（模型决策）与 action（Host 效果）应该分离，但 request 应 immutable。pending/responded/cancelled/failed 应从 request + response + append-only action attempt/outcome 按 causation ID 归约，唯一约束绑定 immutable occurrence；删除 request 回写与脆弱回指。

#### B3. Task named wait 被塞入完整 Automation 状态机，又由 blanket Bus 监听补偿

**状态：HEAD；严重度：P2。**

调用链为：`wait` Tool（`tool/wait.ts:12-81`）→ `scheduler/delayed-wake-schedule.ts:77-103` 写 `AutomationTable(kind=delay, task_id)` → `automation-service.ts:1129-1258,1694-1767` 的 definition/lease/run/receipt/tombstone → `task-root-ingress-delivery.ts:287-360` 再转为 Task ingress。

`architecture/18-scheduled-automations.md:31-40` 却明说 Task named wait 是独立 Orchestrator scheduling fact。由于 Tool 没有 exact activity selector，AutomationService 又在 `819-1006` 监听所有 user Message 与 terminal Tool Part，任意活动都可抢占 wait 并额外制造 `task_wait_activity` Turn。

这把一个 Task reducer 本可表达的 absolute due fact 穿过两套 occurrence/settlement。最小路线：直接持久化 immutable Task wait registration，Task driver 用已有 earliest timer/heartbeat；真实新 ingress 自然 supersede/absorb 旧 wait，删除 Automation `task_id` delay 分支与 blanket Bus compensation。Session delay 与 public recurrence 保持各自 provenance。

#### B4. Mission close 的竞争 join 是无界 busy poll，实际 callback 又不传播 AbortSignal

**状态：HEAD；严重度：P2。**

`mission/execution-closure.ts:420-441` 未获 lease 的调用每 10–100ms 无限轮询；owner 在 `471-493` 每 40 秒续 120 秒 lease。续租失败只 abort controller，但 `server/routes/mission.ts:152-220` 的真实 close callback 不接收/传播 signal，逐个 cancel/await 仍可继续。

durable closing/closed 与 lifecycle lease 必须保留；应删除 busy-poll join。竞争者返回 typed `closing`，或有界等待 exact closure event/lease expiry；为 owner 设置 deadline，并把 AbortSignal 贯穿 Task cancellation 与 Session wait。

#### B5. Scheduler Message 跨独立 recipient 串行，Task/Event 又无界 fan-out，容量模型相互矛盾

**状态：HEAD；严重度：P2。**

`protocol/scheduler-message.ts:347-378` 在 project 内逐个 await unanswered wake、Mission recipient 与 Task recipient；一个 recipient 会等待完整 Provider reply（`178-344`），造成无依赖收件人的 head-of-line blocking。相反，Task startup/heartbeat 在 `task-root-ingress-delivery.ts:1611-1669` 和 `task-control-driver.ts:231-249` 对全部 live Task `Promise.all`；EventService 在 `580-629` 只做 per-job tail、job 间无全局上限；只有 Automation 在 `1044-1068` 使用 bounded slots。

不同业务需要 key 内 FIFO，但不需要四套互相矛盾的容量政策。最小路线是一套按 Provider/project/resource class 配置的 bounded work-conserving admission：key 内 FIFO、key 间公平；scan/heartbeat 可以无遗漏发现 ready work，但物理 Provider activation 必须有界。实际资源风暴严重度仍需生产负载验证，但算法无上限和 HOL 已由代码确认。

#### B6. Automation retry 混淆 logical fire identity、transient retry 与 absorbing disposition

**状态：HEAD；严重度：P2。**

`automation-projection.ts:53-69` 把 `latest.retry_at` 投影为新 `next_run`；`automation-service.ts:1165-1169` 再从变化后的 `next_run` 生成新 fire ID。一次 F1 已提交 wake、但 reply/settlement 失败后，会以 F2 新 run/session/message 重试，不能用 F1 receipt 查重；持续 poison occurrence 还会永久挡住后续 RRULE。

EventService 已采用更一致的 same-fire retry（`event-service.ts:1050-1175`）。应固定 immutable `scheduled_due_at`/fire ID，attempt receipt 全部追加到同一 logical occurrence，成功或显式 disposition 后才推进 recurrence。

相同错误分类还让不可逆 target disappearance永久重试：Session/Task delete事务会 dead-letter scheduler-message delivery并写 deletion boundary，但不 retire Automation；`automation-service.ts:1071-1110` 的 lineage NotFound与terminal Task ingress rejection都进入 `failBeforeLease`/`fail`，`1877-1979` 只有最多五分钟退避，没有最大 attempt、terminal receipt或definition tombstone，且会不断创建 failure run。target deleted、Task terminal、epoch mismatch应写一次 absorbing stale/disposition并retire one-shot definition；需要保留的Session-target recurring Automation也必须进入明确paused/terminal-target状态。该子问题与 fire identity同属“attempt没有固定 occurrence与终结分类”的根因，不另计一套调度机制。

#### B7. Automation bounded queue 用 stale poll time 创建后续 lease

**状态：HEAD；严重度：P2。**

`automation-service.ts:1033-1066` 一次 poll 只取一个 `now`；后续 slot 等前项结束后仍把旧值传给 `claim`，`1138-1154` 由它生成 `time_activated`/`expires_at`。队列等待超过 lease duration 时，job 会在真实时间已经过期的 lease 下启动，第一道 fence 即失败，失败 receipt 也无法用该 lease 提交。

due snapshot 可保留 `scheduledNow`；每次实际 claim 必须取新的 `claimNow = Date.now()`，同时保持 fire scheduled due identity immutable。

#### B8. `engine_workflow_node_occurrence` 与 immutable `dispatch_lineage` 重复 admission 事实

**状态：HEAD；严重度：P3。**

`engine.sql.ts:448-469` 的独立表与 `dispatch-lineage.ts:168-219` 同时保存 Task/workflow/node/initial dispatch/child Session；`workflow-node-occurrence.ts:59-224` 又同时读取两边，生产消费者仅为该 admission 路径。

如果 SQLite JSON expression/partial unique index 能满足 `(task, workflow, node)` 唯一约束，应以 lineage 为唯一事实并删除表。若性能证明必须保留，它只能被定义为可从 lineage 单向重建的 materialized admission index，不能再被当作第二业务权威。

#### B9. 热路径反复归约无界历史，并靠进程内 shadow memo 避免部分工作

**状态：HEAD；严重度：P3。**

Task heartbeat 每 30 秒扫描所有 active Task；`task-root-ingress-delivery.ts:1208-1235` 对每 Task 枚举全部 dispatch settlements 与 lineage，再用 `closedDispatchIDs` 跳过本进程已见 history。重启后 memo 为空，历史重新枚举。Automation projection 在 `automation-projection.ts:53-68` 每次为 definition 读取所有 revisions/runs，并为 runs 继续投影 receipt/lease；Event projection也在 fire/recovery热路径重复读取 causation与 receipt。

immutable facts 不等于每次全表重放。应使用以 unresolved exact occurrence 为键的索引查询，或可从 facts 单向重建、同事务维护的 current projection；禁止建立另一可独立修改的 truth。该项是 scale 风险，尚无生产数据量证据，故不升到 P2。

### C. 当前架构文档与实现的矛盾

#### C1. `current/architecture` 仍描述不存在的 `TaskQueueService`

`17-code-work-agent-platform.md:129,144,811,829,1094,1203` 六处把它写成当前组件，但 `packages/opencorvus/src` 没有定义、import 或生产调用，bootstrap 只初始化 AutomationService 与 EventService。应删除幽灵组件或把未来设计移出 current architecture。

#### C2. Scheduled Automation 架构称 experimental routes 已退役、`/global/automations` 是唯一 HTTP resource，但 Event experimental API 仍在生产挂载

`18-scheduled-automations.md:8,46-53` 与 `server/routes/experimental.ts:292-353`、`server/routes/app.ts:166`、`tool/schedule.ts:5,197-228` 不一致。Event 的 event-identity domain 不应被错误并入 recurring Automation，但 current architecture 必须明确它的现行所有权、公开程度和与共享 execution primitive 的边界；若它确实退役，则一次性删除 route/Tool/Service，不能继续形成未记录的平行当前实现。

### D. 系统级设计背景与证据不足项，不单独当成已复现缺陷

`tool/execution-mode.ts:67-80` 明说 coordinator 每个 Provider step 重建，而一个 Task-root assistant Message 跨多个 step 持续累积 durable decisions；`task-root-fact-store.ts:647-674` 又用 special compaction sibling exemption 维持 one-assistant-per-continuation。decision repair rung、synthetic frontier child Parts 和多 step reseeding 都是在补偿同一个张力：一个 assistant Message 同时承担用户可见流式消息、多个 Provider step 的容器和 durable lifecycle decision transaction。

短期不应仓促拆 Message/Part 权威。中期应二选一并用迁移验证：

1. 一个 Provider generation 对应一个 assistant Message，Task decision occurrence独立聚合同一 activation 下的 sibling facts；或
2. 明确新增 canonical `TaskDecisionOccurrence`，conversation Message只负责真实参与者可见内容，决策 receipt 通过 causation 关联，不再让 UI lineage 充当事务边界。

交叉审查没有证明原生 assistant Message 同时包含文本与模型原生 Tool calls本身有错，因此不把它计为根因。可立即修复的具体 crash cut已经由 A1、B1和A9覆盖；没有迁移与真实页面/历史数据验证前，不把 Message/Part拆分写成应立即执行的 production方案。

Global request在Project promotion后的语义也不计缺陷。`task-control-plane.md:27-34`把owner/replay边界明确限定在root Session仍位于anonymous Project期间；`engine/store.ts:315-343`按该adoption boundary忽略已promotion的Task。公开API尚未解释该边界，属于discoverability或产品契约待确认；没有“request ID跨promotion永久幂等”的权威契约前，不把后续创建新anonymous Project判成重复执行缺陷。

### E. 必须保留的必要复杂度

- Task 业务 lifecycle、Session 物理流式 Turn、Mission 跨 Task outcome/acceptance 三层 owner；
- exact ingress、dispatch、fire、wake、execution occurrence 与 causation lineage；
- immutable Tool/Provider/Protocol request-outcome receipt；
- lease ID + owner occurrence + expiry 的三元 fence，以及 settlement/release 同事务；
- Task epoch 级有限 infrastructure retry budget；
- TaskControl fixpoint跨pass对wake取最小值的保守lost-edge backstop；后续no-wake不取消先前义务，在没有全producer安全证明前不能用stable pass覆盖；
- Event per-job FIFO、same-fire retry 与 recovery timer；
- heartbeat 作为 lost-edge backstop，但它只负责发现，不负责无界 admission；
- operator Mission open 与 non-operator wake admission 的 provenance 分离；
- `SessionWake` 的原子 preflight/commit bundle 与各 source owner 的具体 admission 校验；
- `dispatch_lineage` 与 Session status、WorkerTurnDescriptor 与 Message/Part 的职责分离；
- response（LLM 决策）与 action（Host 效果）分离，删除的只是 mutable request projection；
- Dynamic 的结构化批量提交需求；需要重做的是 outer + synthetic child + bespoke recovery 的实现，而不是否定并行 frontier 产品需求。

## 简化路线与验证边界

### 推荐顺序

1. **停止合并当前 `dispatch_agents` 工作区设计。** 先证明是否真的存在 Provider parallel-tool-call 能力缺口；若保留 batch，改为唯一 canonical frontier occurrence并解决 partial success、reducer 与 restart crash cut。
2. **先收敛 Task wait 的单一 epoch-owned fact。** 把registration、tombstone、execution epoch、activity/due transfer、Task ingress settlement和prompt projection接到同一canonical occurrence；不能继续用非durable Bus edge和第二套current描述补偿。
3. **给所有 durable Tool effect 建立 exact request/outcome。** schedule/wait/Event与panel Task/Mission/Work create都以Tool call occurrence为幂等身份，并让replay返回同一已接受aggregate或明确typed conflict。
4. **修正 create 的 acceptance 与身份边界。** Global/Project Task不得把accepted后的dispatch故障当创建失败；request/channel composite identity必须相交一致、带canonical payload fingerprint，跨backend loser重读winner，owner只包围commit而不包围完整Provider Turn。
5. **修复其余 durable safety/liveness 缺陷。** Dispatch owner必填；Mission closing可从durable occurrence resume；Mission recovery首次claim唯一且有预算；exhausted surface只有持久成功后才能memoize。
6. **统一 deletion/resource ownership。** Task/Session runtime roots、Project多sandbox、Build refs、Workspace/managed worktree与Git branch必须先进入可恢复deletion occurrence；只有全部child resource settle后才删aggregate、释放sandbox或丢弃identity。
7. **把aggregate commit到Protocol event publication纳入同一事务/outbox owner。** 不再让SSE/恢复依赖无owner的post-commit `Database.effect`。
8. **删除 Host decision repair gate。** 保留有限 semantic budget，把决策能力收敛到 prompt/context/tool contract/typed outcome。
9. **分离领域事实、合并物理执行。** Recurring Automation、Task wait、Session delay、Event subscription/fire 保持独立定义和 provenance；它们共享同一 bounded、fenced occurrence executor/outbox，而不是共用一个 nullable definition schema或复制四套 lease/retry/recovery。
10. **引入统一 bounded work-conserving admission。** recipient/job/Task key 内 FIFO，key 间公平，按 Provider/project/resource class 限流；heartbeat与scan只发现 ready occurrence。
11. **把可变 projection 收敛回 reducer并优化读模型。** Agent Coordination request immutable；workflow occurrence表只作可重建索引或删除；Mission recovery用 immutable exact occurrence；为unresolved deliveries/current occurrence建立索引或同事务可重建投影，删除无界热路径回放与shadow memo依赖。
12. **最后处理 assistant Message/decision transaction 张力与架构文档。** 这是跨 UI、history、compaction、recovery 的迁移，不应与紧急安全修复混成一次大改。

### 建议验证

本轮没有修改 production code，也未运行任何 UI 自动化。后续实现必须分别验证：

- 两 backend 共享数据库下 live dispatch owner 不被 peer recovery；
- Mission 在 closing 写入后的每个 crash cut 都能从同一 occurrence 收敛，并保持 source/request provenance；
- Mission recovery 首次 claim 竞态、有限 attempt 和 exhausted surface；
- frontier partial success、进程崩溃、replay 与 reducer 只能形成一个 canonical decision；
- Automation 同 fire retry、长于 lease duration 的队列等待、poison occurrence disposition；
- 多 recipient/Task/Event 的 bounded fairness、key 内 FIFO 和多项目隔离；
- infrastructure artifact 写失败后不会静默 memoize；
- Task wait 的真实 activity/due/restart 路径不产生重复 ingress；
- Tool effect在outcome写入前后的crash/replay只形成一个durable aggregate；
- Global/Project Task在accepted后的dispatch fault与跨backend unique collision中仍返回同一winner；
- Task/Session/Project/Workspace删除在每个外部Git与runtime-root crash cut后都可从同一deletion occurrence收敛；
- 相关非 UI 聚焦正向测试，以及真实开发模式中 Task/Mission/Session/Automation 页面与消息可见性人工验收。

真实 Provider、长时间容量 benchmark、双 backend crash injection、数据库迁移和真实 Web UI 页面均未在本审计授权范围内执行；因此本报告证明的是代码级算法与契约问题，不把建议方向包装成已完成实现或运行时修复。
