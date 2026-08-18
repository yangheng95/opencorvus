# 算法框架层结构反模式审计 · 第二轮

> 系列第七份。直接前置：[algorithm-layer-architecture-antipatterns.md](algorithm-layer-architecture-antipatterns.md)（ARCH-A/B/C/D/E 共 63 条）与 [algorithm-layer-architecture-remediation-plan.md](algorithm-layer-architecture-remediation-plan.md)（整改，63 条里 40+ 条已 ✅）。
> 生成：2026-08-18，基于**当前工作区**（含未提交改动），不以 HEAD 为准。
>
> **本轮的问题不是「还有哪里耦合」。** 第一轮的粗粒度分层违规（判定层反向 import `@/session`/`@/engine`、包级环、零调用死代码）确实被修掉了，五个维度独立复核都确认了这一点。本轮问的是另一个问题：**那些标着 ✅ 的整改，真的把问题修完了吗？新引入的注册表/端口/派生 schema，自己是不是新的反模式？**
>
> **方法**：5 个子 agent 分维度并行（分层与依赖方向 / 模块组织与内聚 / 耦合形态与接口 / 可扩展性与开闭 / 包边界与契约强制），每个都被要求先读前两份文档、把发现分成 NEW / REGRESSION / RESIDUAL 三类，重复报已修条目不计产出。本文作者对全部 P0 与关键 P1 逐条重读源码复核，**推翻了子 agent 的 1 条结论、上调了 1 条的严重度**。

---

## 总判

一句话：**「✅ 已落地」不能当免检凭证，而整改留下的注释比代码更容易骗人。**

四个收敛形状：

1. **修复边界画得比缺陷本身窄。** ARCH-C-6 / C-8 / C-11 / C-12 / D-2 / D-7 六条标 ✅，逐行复核后每一条都能在**同一份策略的第二、第三个消费者**身上找到未同步的残留：`wake_reason` 的第三套手写解码器落在真实投递结算路径上（R2-05）、`EDIT_TOOLS` 归一化只覆盖了 `disabled()` 自己而没覆盖真正摘除模型工具的 `execution-surface.ts`（R2-04）、Delivery Slice 字段名在读侧查表而写侧仍是字面量（R2-21）。整改方式没错——「删除优先、收敛到单一来源」是对的；**验收标准不够**：只验证了改动点的测试通过，没有对「这份策略在全仓其余消费者」做收尾 grep。

2. **新抽象在顶层是真权威，在下一层退化成手抄。** `HOST_OWNED_MEMORY_KINDS`（R2-08）、`MetricScorerAuthoringSpecSchema`（R2-22）、`CAPABILITY_GRANT_LIST_FIELDS`（R2-02）三个都是本轮整改新建的单一真值源，三个都只把权威性延伸到自己声明范围的一部分。**最危险的是它们各自留了一段声称已经收敛的注释**——`memory/types.ts:6-14` 白纸黑字写着它统一了 `search.ts` 的权重表省略，而 `search.ts` 对它零引用；`capability/rules.ts:76-81` 写着「this module has one matching semantics」，而同模块两个函数对 `{edit:"deny"}` 至今给出相反结论。下一个读代码的人（包括写整改记录的人）会把注释当真值源。

3. **接口在撒谎：算出来了，但没连到任何会产生后果的地方。** ARCH-B-01（迭代快照写端死读端活）修掉的是这个形状的一个实例，本轮又找到三个：integrity 的 `completenessFindings` 算出来从不落库，而同一条流水线上 visual-qa 与 frontend-design 都落库且被当阻断门用（R2-06）；`goal-workload-analyst` 的 contract 引用防伪校验因为可选参数从未被传入而**一次都没执行过**（R2-07）；`acceptance/` 的 4 种 scorer 类型有 schema、有校验、有展示，宿主侧一个执行器都没有（R2-09）。这类缺陷的通病是**看起来在工作**，只有沿真实数据流走到最后一个消费者才能发现它没到终点。

4. **局部收敛制造「这里已治理过」的错觉，掩盖消费侧仍在散弹。** 一个判别联合有一处体面的定义，消费侧散落 2–6 处独立字面量分支，其中至少一处漏改后**静默走错误分支而不是报错**（R2-10、R2-15）。这比「完全没有注册表」更危险。

**一条交叉印证**：本轮三条最高优先级发现，全部发生在**上一轮刚动过手**的代码区域——不是没人管的角落，而是刚被「修好」但修得不彻底的地方。

---

## 被推翻 / 被修正的子 agent 结论

- **推翻**：维度 E 报告 `generated/expert-squad-payload.ts` 与源存在 354 字节漂移（P1）。作者直接调用生成器的纯渲染函数与磁盘逐字节比对：**IN SYNC**（5647579 == 5647579）。且 CI 的 `typecheck.yml` 会跑 `bun ./script/generate.ts` + `script/generated-artifacts.ts --check-clean-worktree`，而 `GENERATED_ARTIFACT_PATHS` 明确含该文件——漂移会被 CI 拦。成立的只剩「本地保存时无信号，要 push 后才知道」，严重度 **P1 → P2**（见 R2-24）。
- **上调**：维度 B 报 `acceptance/contract-audit.ts` 零调用（P1）。复核确认属实，并顺着往下发现更重的事实：`ScorerSchema` 的 **4 个成员宿主侧全都没有执行器**，`metrics/executor.ts` 分派的是另一套同名不同物的 `evaluator_kind`。合并为 R2-09，**P1 且需要一次产品裁决**。
- **状态订正**（整改表与工作区不符，本文不代改）：ARCH-B-09 标 ⬜ 但 `integrity/team-agent.ts` 实际已从 1002 → 732 行（prompt 渲染族已搬进 `review-prompt.ts`），应为 ◐；ARCH-D-7 标 ✅ 但只有 schema 层收敛，应为 ◐（R2-09）；**ARCH-C-5 在 63 条处置总表里完全缺失**——既非 ✅ 也非 ⬜，是被遗漏而非被裁决（R2-14）。

---

## 优先级总表

| 编号 | 结论 | 分类 | 优先级 |
| --- | --- | --- | --- |
| R2-01 | 视觉复核门「开门的钥匙是 judge，进门要求的是 prebuilt」→ 一类 campaign 永久 `inconclusive` | NEW | **P0 活故障** |
| R2-02 | 候选自我授权的安全不变式覆盖的是手抄的 13 字段清单，与 SDK schema 零编译期链接 | REGRESSION | **P0 安全边界** |
| R2-03 | CI 从不调用根 `typecheck`；上一轮为堵 ARCH-E-2 新增的检查从未在 CI 跑过 | REGRESSION | P1 |
| R2-04 | `EDIT_TOOLS` 归一化只在 `disabled()`；同模块两函数对同一配置结论相反 | RESIDUAL | P1 |
| R2-05 | `wake_reason` 第三套手写解码器落在真实投递结算路径上 | RESIDUAL | P1 |
| R2-06 | integrity 的 `completenessFindings` 算出来从不落库，是流水线上唯一漏接的一环 | NEW | P1 |
| R2-07 | `goal-workload-analyst` 的 contract 引用防伪校验从未执行过一次 | NEW | P1 |
| R2-08 | `HOST_OWNED_MEMORY_KINDS` 注释声称覆盖三处，实际两处旁路 | REGRESSION | P1 |
| R2-09 | `acceptance/` 4 种 scorer 类型宿主侧零执行器；`contract-audit.ts`（762 行）零 importer | NEW | P1 |
| R2-10 | `operationKind` 三份独立表 + 读端点白名单把 scroll-slice 排除在外 | NEW | P1 |
| R2-11 | `test/` + `script/` 约 460 个文件在任何 tsc 之外，实测有 20+ 处真实类型错误 | NEW | P1 |
| R2-12 | 决定「UI 是否合格」的两个判定函数全仓零测试 | NEW | P1 |
| R2-13 | `goal-workload-analyst/publication.ts` 三合一判定 + 手写第二份会话谱系 CTE | NEW | P1 |
| R2-14 | ARCH-C-5（`processInvocation` 7 参数 / 5 处布尔分叉）从未进入整改表 | RESIDUAL | P1 |
| R2-15 | 判别联合「漏改静默走错分支」族（14 处，见附表一） | NEW | P1/P2 |
| R2-16 | `evidence/` 整个目录（2 文件 60 行）零 importer | NEW | P2 |
| R2-17 | `work-artifact/presentation.ts` 1368 行揉合六类职责 | RESIDUAL | P1 |
| R2-18 | 发布器 `execute()` 539 行 / 23 处 `artifact_type ===` | RESIDUAL | P1 |
| R2-19 | acceptance/verification/visual-qa/fact-check/integrity/evidence 目录分类学 | RESIDUAL | P1 |
| R2-20 | integrity 四个证据图判定函数未 export、零单测 | NEW | P1 |
| R2-21 | Delivery Slice 字段名读侧查表、写侧仍是字面量 | RESIDUAL | P2 |
| R2-22 | `MetricScorerAuthoringSpecSchema` 顶层真派生、内层 `query` 判别式手抄 | REGRESSION | P2 |
| R2-23 | `visual-qa/index.ts` 等死 barrel 未随 ARCH-C-25 一并处理 | NEW | P2 |
| R2-24 | 生成物漂移本地零信号（当前**未**漂移，仅机制缺口） | NEW | P2 |
| R2-25 | 其余接口卫生 / 命名 / 展示 if-链 | NEW | P2 |

---

## P0

### R2-01　视觉复核门的开门条件与进门条件不匹配，一类 campaign 永久无法晋升

**分类** NEW｜**这是当前活故障**

`expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts:410-411`：

```ts
ui_rubric_digest:
  scorerAssets.find((item) => item.asset.evaluator_kind === "judge")?.resource.sha256 ?? null,
```

`expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts:422-441`：

```ts
const visualScorerIDs = new Set(
  campaign.scorers.filter((scorer) =>
    scorer.evaluator_kind === "prebuilt" &&
    scorer.evaluator_config.name === VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME).map((s) => s.scorer_id))
const visualReview = campaign.ui_rubric_digest === null
  ? { status: "not_applicable" }
  : visualScorerIDs.size === 0 || ... ? { status: "unavailable" } : { status: "reviewed" }
```

`comparison.ts:449-453`：`visualReview.status === "unavailable"` → `recommendation = "inconclusive"`。

**开门的钥匙是 `judge`，进门要求的是 `prebuilt`。** 一个只声明 `judge` scorer（例如做代码质量评审）而不声明视觉 prebuilt scorer 的 campaign：`ui_rubric_digest` 非 null → 视觉门开启 → `visualScorerIDs.size === 0` → `unavailable` → `recommendation` **恒为 `inconclusive`** → `expert-squad/evolution-mutation.ts:172` 抛错，晋升永久失败。

这与 ARCH-E-1 / C-3 那条 P0 是**同一个用户可见后果**。上一轮的修复让 `prebuilt` 变得「可表达」（发布器不再只认 2 种 kind），但没有动「谁点亮这道门」这个语义耦合——**故障类幸存，只是范围变窄**：现在必须同时声明 judge 与视觉 prebuilt 两种 scorer 才能通过。

且失败不可归因：`evolution-mutation.ts:172-173` 的抛错不带 expected/received，不说明 `recommendation` 实际值、`visual_review.status` 是否 `unavailable`。运营者只能看到一句 "requires a complete deterministic promote recommendation"。

**方向**：删耦合而非加校验。要么让视觉门直接由 `visualScorerIDs.size > 0` 决定是否评估（与 `ui_rubric_digest` 解耦），要么让 `ui_rubric_digest` 只在存在**专门标记为视觉判据**的 scorer 角色时才非 null。抛错处补 `recommendation` / `required_unavailable_dimensions` / `visual_review.status` 的 expected/received。

---

### R2-02　候选自我授权的安全不变式，覆盖的是一份与 SDK schema 零编译期链接的手抄清单

**分类** REGRESSION（ARCH-C-4 的修复自己留的后门）｜**当前不可利用，SDK 加一个字段即刻可利用**

真值源 `packages/sdk/js/src/expert-squad-manifest-v1.ts:119-134`，`ExpertSquadProjectionResourcesSchema` 有 13 个 ref-list 字段 + `inherit_base_tools`。

手抄副本 `packages/plugin/src/expert-squad-evolution-integrity.ts:148-162`：`CAPABILITY_GRANT_LIST_FIELDS` 逐字复制那 13 个字段名，`as const`。同文件 `:14` 是 `type Manifest = Record<string, unknown>`——**完全 untyped**，与真值源之间没有 `keyof` / `satisfies` / `Object.keys(schema.shape)` 之类的任何编译期联系。

`assertCandidateGrantsAreInherited`（`:202-222`）只遍历这份手抄清单。

**后果**：SDK schema 未来新增第 14 个授权字段（这套 schema 已横跨 skill / tool / mcp_server / mcp_tool / mcp_prompt / mcp_resource 六类，加第七类是合理演进），`CAPABILITY_GRANT_LIST_FIELDS` 不会自动感知——`declaredGrants` 不会为它建 Set，for 循环压根不访问它。不是编译错误，不是运行时报错：**一个自修改的候选包可以通过这个新字段静默授予自己父包没有的能力**，完全绕过 ARCH-C-4 刚刚建立的不变式。这正是 ARCH-C-4 原文声称要封死的奖励攻击路径，只是攻击面从「当前 13 个已知字段」变成「未来任何新字段」。

**方向**：`packages/plugin` 已经 workspace 依赖 `@opencorvus-ai/sdk`（`package.json:23`）。删掉手抄数组，改为 `Object.keys(ExpertSquadProjectionResourcesSchema.shape).filter((f) => f !== "inherit_base_tools")`。不新增抽象，只是把已存在的 schema 当唯一真值源。

---

## P1

### R2-03　CI 从不调用根 `typecheck`，上一轮为堵 ARCH-E-2 新增的检查从未在 CI 跑过

`package.json:22`：

```
"typecheck": "bun run check:sdk-imports && bun run check:ai-runtime && bun run check:expert-squad-types && bunx turbo run typecheck"
```

`.github/workflows/typecheck.yml` 手写了一遍步骤，只有 `bun run check:sdk-imports`（:24）与 `bunx turbo run typecheck`（:37）。**`check:ai-runtime` 与 `check:expert-squad-types` 两条都不在 CI 里。**

整改日志记着「已加 `expert-squads/tsconfig.json` 并接入根 `typecheck`」——本地为真，但决定 PR 能否合并的那道关卡对此视而不见。ARCH-E-2 想堵的洞，在 CI 这一层完全没堵。

**方向**：把 workflow 的手写步骤列表替换为直接调用 `bun run typecheck`，消除「脚本清单」与「CI 步骤清单」两处各写一遍并且已经分叉的结构。

### R2-04　`EDIT_TOOLS` 归一化只在 `disabled()` 内，同一模块两个判定函数对同一配置结论相反

`capability/rules.ts:76-81` 的注释声称 `disabled` 改走 `evaluate` 之后「this module has one matching semantics」。实际 `:85` 的 `EDIT_TOOLS`（`edit/write/patch/multiedit → "edit"`）归一化**仍只在 `disabled()` 内部**，`evaluate()` 不做。

两个直接调 `evaluate` 的消费者都不归一化：

- `tool/execution-surface.ts:20-29` `visibleExecutionToolIDs()`——这是真正把工具从模型可见表里摘除的早期投影闸，被 `session/loop.ts:3217,3895` 与 `tool/registry.ts:197` 调用；
- `skill/eligibility.ts:40`——`required_tools` 逐项校验。

配置 `{ edit: "deny" }` 时：`disabled(["write"], ruleset)` 判 deny；`evaluate("write", "*", ruleset)` 因 `Wildcard.match("write","edit")` 为假而落回默认 allow。**结论相反。** 当前被 `skill/eligibility.ts:38` 的 `availableToolNames` 兜住，但那是全链路每处手动传的**可选**参数（`conversation/capability.ts:165`、`mission-skill/runtime.ts:15` 均为 `?:`），新增调用点漏传即刻生效。全仓零测试锁定这两个函数应当一致。

**方向**：按原整改方案的删除方向——把归一化提到 `fromConfig`（规则构造期），让两个函数共享同一份已归一化的 ruleset，消费者一处不用改。补一条断言两者结论一致的测试。

### R2-05　`wake_reason` 的第三套手写解码器落在真实投递结算路径上

`protocol/session-wake-state.ts:4-23` 的 `schedulerWakeMessageMatchesInTransaction` 直接 `import { MessageTable } from "@/session/session.sql"`，取 `message.data` 后用裸 `as { extra?: { wake_reason?: {...} } }` 读字段，不经过 `SessionWake.WakeReason.safeParse`。

ARCH-C-8 已把另外两处读路径（`scheduler/event-service.ts`、`scheduler/automation-service.ts`）改成 `safeParse`，唯独漏了这第三处。而它有 3 个生产调用方：`protocol/delivery.ts:628`（`requireDeliveryResultOccurrence`，调度结算授权校验）、`protocol/delivery.ts:1239`、`mission/execution-closure.ts:192`。

**后果**：`WakeReason` 的 `scheduler.message` 分支任一字段改名，编码端与另外两处读端都会编译报错，唯独这里不会——它只会安静地永远匹配不上，`requireDeliveryResultOccurrence` 对一切合法结算抛 `SchedulerMessageConflictError`，调度消息投递卡死在「冲突」上且完全无法定位真实原因。

（次要第四处：`storage/db.ts:449-503` 的 6 处裸 `json_extract` 路径字符串，属启动期旧 schema 探测、fail-closed，可保留但应加注释说明是有意脱钩的例外。）

### R2-06　integrity 算出的完整性诊断从不落库，是这条流水线上唯一漏接的一环

`integrity/team-agent.ts:329,342` 计算 `completenessFindings`（拼接 `integrityCheckGraphIssues` 与 `integrityRequirementCoverageIssues`），`:356` 放进返回值。唯一生产消费者 `orchestrator/integrity-review-stage.ts` **零次读取**它；持久化 schema `integrity/team-schema.ts` 也没有 `completeness_findings` 字段。

对照组：同一模式在 `visual-qa/persist.ts:22,60,97` 与 `frontend-design/artifact.ts:37,50` 都正确穿透到持久化，且该字段真的在 `acceptance/visual-feedback-verification.ts:239-243` 被当作**阻断性 gate** 使用。integrity 是唯一漏接的。

**后果**：一个 Integrity 复核若引用了未注册的 check ID、留下未覆盖的 requirement、或有 blocking finding 只挂在已通过的 check 上，这些诊断**只会**以工具返回文本的形式提示给正在生成判决的 LLM 自己（`team-agent.ts:613-617`，模型可以无视）。宿主侧任何下游都看不到——安全网退化成「希望模型看提示」。

**方向**：给 `IntegrityReview` 加 `completeness_findings` 字段并落库；若判定这批诊断确实只该是软提示，则**删除计算逻辑**，不要留着造成「看起来在把关」的假象。

### R2-07　`goal-workload-analyst` 的 contract 引用防伪校验从未执行过一次

`goal-workload-analyst/output-tools.ts:20-22`：

```ts
export function createGoalWorkloadOutputTools(input: { knownGoalIDs: string[]; knownContractIDs?: string[] }) {
  const knownContracts = new Set(input.knownContractIDs ?? [])
  ...
  const unknownContracts = knownContracts.size > 0 ? brief.references.contract_ids.filter(...) : []
```

唯一生产调用点 `agent.ts:58` 只传 `{ knownGoalIDs }`；测试 `:928` 同样不传。`knownContracts.size > 0` 恒为假 → `unknownContracts` 恒为空数组。

工具描述文本明确要求「REFERENCE surfaces and contracts only with identities declared by completely read Artifacts」，但模型可以在 `references.contract_ids` 里填任意不存在的 id，宿主侧零提示。这是 ARCH-C-4（不变式只存在于提示词）同型问题在另一个子系统的实例。

**方向**：传入真实的 Contract Graph id 集合；若当前阶段拿不到，**删除**这个从未生效的参数与校验代码，而不是留着制造「有校验」的假象。

### R2-08　`HOST_OWNED_MEMORY_KINDS` 的注释声称覆盖三处，实际两处旁路

`memory/types.ts:6-14` 的注释原文声称该常量统一了三处重述——`index.ts` 的私有谓词、`project-memory.ts` 的字面量联合、**以及 search weight map 的省略**。实测：

- `memory/search.ts` 对 `HOST_OWNED_MEMORY_KINDS` / `isHostOwnedMemoryKind` **零引用**。`KIND_WEIGHT` 声明为 `satisfies Partial<Record<MemoryKind, number>>`——`Partial` 意味着漏一个 kind 编译器不吭声。`MemoryKind` 7 元，5 个在权重表、2 个在 host-owned，互补是巧合。
- `memory/project-memory.ts` **零引用**，`:198` 仍自己声明字面量联合 `kind: "user_message" | "project_context"`，字面量散落 `:240,259,306,489,501,640`。

**后果**：往 `MemoryKind` 加第 8 种 kind 且忘了同步 `KIND_WEIGHT`，会精确重现 ALG-05 刚修完的那个 bug（索引了但搜不到），无编译期也无测试信号。

**方向**：`SEARCHABLE_KINDS` 改为从 `MemoryKind` 减去 host-owned 派生，或给 `KIND_WEIGHT` 的键集合加穷尽性断言（`Exclude<MemoryKind, HostOwnedMemoryKind>` 完全等于 `keyof typeof KIND_WEIGHT`），让漏改从运行时静默退化变成编译期错误。`project-memory.ts` 的形参类型改引用 `HostOwnedMemoryKind`。

### R2-09　`acceptance/` 的 4 种 scorer 类型宿主侧零执行器；762 行的 `contract-audit.ts` 零 importer

`acceptance/contract-audit.ts`（762 行，`acceptance/` 最大文件）：`runContractAudit` 全仓仅定义处 1 处命中，整个文件零 importer。

顺着往下更重要：`acceptance/types.ts:127` 的 `ScorerSchema` 是 4 元判别联合（`heuristic` / `llm_judge` / `prebuilt` / `contract_audit`），**宿主侧没有任何一个执行器**。`metrics/executor.ts:234-242` 分派的是**另一套** `evaluator_kind`（`shell` / `judge` / `prebuilt` / `query` / `aggregator`，来自 plugin 的 `MetricScorerSpec`）。两套 scorer 分类学同名不同物、成员也不同。

AcceptanceSpec.scorers 的实际用途只有三种：`renderSpecsAsText` 拼进提示词、`architect/output-tools.ts` 校验形状、`reference-integrity.ts` 查 contract_ids 存在性。也就是说 `expect.status: "passed"`、`expect.exit_code` 这些**看起来像断言的字段，实际是模型面文本**。

顺带订正整改表：ARCH-D-7 标 ✅（「新增检查类型不再需要在两处各写一遍」）只对 schema 定义成立。`contract_audit` 字面量当前仍分布在 5 个文件：`acceptance/contract-audit.ts`（执行本体）、`acceptance/types.ts:194`（展示 if-链）、`architect/output-tools.ts:371,407`（forward-ref 收集 + 展示 if-链，两处）、`architect/reference-integrity.ts:37`、`engine/persist.ts:498`。扩展成本与整改前同量级，状态应改回 ◐。

**方向**：这需要一次产品裁决而非重构——(a) 把 `runContractAudit` 接回执行链并给 `heuristic`/`llm_judge` 补执行器；或 (b) 承认这一层是「给模型看的判据文本」，删掉 762 行执行器与 `expect.*` 这类暗示宿主会执行的字段。**不建议维持现状**：schema 里活着、`architect` 里被校验着、却没有执行器，是「接口在撒谎」的最典型形态。

### R2-10　`operationKind → 必需角色` 有三份独立实现，公开读端点还把 scroll-slice 排除在外

1. canonical 表（ARCH-C-7 的整改产物）`browser-preview/persist.ts:53-64` `PASSED_EVIDENCE_REQUIREMENTS`——**模块私有，未 export**；
2. 第二份手写 `visual-qa/evidence.ts:39-44` `RequiredImageRoles`，因为 canonical 表没 export 而物理上不能复用；
3. 公开 REST 读端点绕过任何表，硬编码单个字面量：`persist.ts:766` `if (!loaded || loaded.evidence.operationKind !== "reference-comparison") return undefined`；
4. 同文件第四处独立 if-链 `persist.ts:1237-1248` `comparisonSourceArtifact()`。

`reference-comparison` 与 `scroll-slice-comparison` 在 canonical 表里要求的 artifacts **逐字相同**（`source_crop` / `implementation_crop` / `side_by_side`），写路径一视同仁；但读端点显式排除后者 → 任何试图通过这个唯一读接口查看 scroll-slice 已持久化裁图的调用**永远 404**（`server/routes/browser-preview.ts:174-222` 的 `GET .../artifact/:artifactName`），尽管写入时这些角色确实已产出。

**方向**：`PASSED_EVIDENCE_REQUIREMENTS` 改为 export，`visual-qa/evidence.ts` 删自己那份；两处字面量守卫改为查表。

### R2-11　`test/` + `script/` 约 460 个文件在任何 tsc 之外，实测有 20+ 处真实类型错误

`packages/opencorvus/tsconfig.json:17` `"exclude": ["script/**/*", "test/**/*", "src/skill/builtin/**/*"]`。`test/` 325 个 `.ts`、`script/` 51 个，从未被 `tsc --noEmit` 解析过。

用临时 tsconfig（`extends` 现有配置、`include` 指向 test、清空 exclude）实跑，**真实发现 20+ 处类型错误**：`test/tool-result-control-protocol.test.ts`（8 处）、`test/tool/delegate-agent.test.ts`（4 处，含 `executionAuthority` 缺 `directory` 字段）、`test/work-artifact/qualification.test.ts`（6 处，`Promise<Uint8Array>` 当 `Uint8Array` 用）、`test/usage/official-usage.test.ts`（5 处）等。

同一模式在其余包重演：`packages/plugin/test/`（5 个里 4 个未覆盖）、`packages/sdk/js/test/`（8 个）、`packages/transport-protocol/test/`（4 个）、`packages/overlay/test/`（69 个）——四个包都没有对应的 test typecheck 脚本。

`bun test` 只做类型剥离不做类型检查，所以这些错误在「跑测试」和「跑 typecheck」两条路径上都不会被捕获。**而 evolution-lab 的全部回归测试就在这批文件里**——即「验证判定逻辑正确性的代码」本身不在类型检查范围内，是比 ARCH-E-2 更大的一圈盲区。

### R2-12　决定「UI 是否合格」的两个判定函数全仓零测试

- `verification/visual/evaluate.ts` 的 `evaluateVisual`（:130）与 `isEvaluationReportPassing`（:53，阈值 `SSIM_PASS_THRESHOLD = 0.95`）：生产消费方是 `browser-preview/region-comparison.ts` 与 `scroll-slice-comparison.ts`；`test/` 与 `script/` 对 `verification/visual` **零命中**。函数体含双线性插值缩放、BT.709 灰度转换、尺寸不匹配惩罚等可直接单测的纯逻辑。
- `acceptance/visual-feedback-verification.ts:181` 的 `validateVisualFeedbackVerification`：`test/` 零命中（唯一被引用的是同文件一个展示用常量）。

ARCH-A-1 说它「难测」，实测是「一次也没测过」。这两个函数是两条产品判据的唯一实现。

### R2-13　`goal-workload-analyst/publication.ts` 三合一判定 + 重新发明已有的域函数

`validateGoalWorkloadArtifactRelationalIntegrity`（:74-211）在一个函数体内直接：`:104-108` 查 `SessionTable`、`:116-132` **手写第二份 `WITH RECURSIVE session_tree` 递归 CTE**、`:160-169` 查 `MessageTable` 后手工 `Message.Assistant.safeParse`、`:183` 查 `EngineGoalTable`。而 `:116-132` 要判断的「会话是否属于任务谱系」，`engine/task-session-lineage.ts:60-77` 的 `listTaskSessionIDs` 与 `:102-104` 的 `sessionBelongsToTask` 已经用同构 CTE 实现过，且正被 `work-artifact/` 两个文件使用。

与 ARCH-A-1 / A-3 修复前的病灶完全同型：判定物理上无法脱离真实 DB 验证。唯一测试 `test/goal-workload-coverage-contract.test.ts` 是起 `bun:sqlite` 端到端跑，没有任何用例直接对该判定函数传入捏造事实。

**同文件另有两条**：`GoalWorkloadPublicationIdentityError`（:31-42）已经按 expected/received 约定构造好了结构化 `details`，却在到达任何消费者前被 `.message`-only 的日志丢弃（`.details` 全仓零读取）；`input-projection.ts:27-30` 的模型面报错只带 received 不带 expected（`[...goalsByID.keys()]` 唾手可得），是 ALG-07 同型的新实例。

**方向**：`:116-132` 改调 `sessionBelongsToTask`；裸表查询收敛成薄取数层（仿 `build/merge-back-publication-authority.ts` 已落地的 `...FromFacts` 范式），判定函数只接收已查好的事实。

### R2-14　ARCH-C-5 从未进入整改表，而 ARCH-C-1 的根因正是它

`grep -n "ARCH-C-5" docs/algorithm-layer-architecture-remediation-plan.md` **零命中**——63 条处置总表里既非 ✅ 也非 ⬜，是被遗漏而非被裁决。

`orchestrator/agent.ts:510-529` 的 `processInvocation` 仍是 7 个位置参数（6 个可选），`terminalConversation` 布尔驱动 5 处相隔数百行的分支：`:521,526`（早期守卫）、`:672`（prompt 分支）、`:837`（`runOnce: terminalConversation || !appendCreatorMessage`——两个语义无关的理由 OR 进同一个布尔）、`:1123`。

ARCH-C-1（终态会话工具闸门两层不同步、每次唤醒必抛错）已被确认是这条巨函数的直接产物、并且**症状已修**（删掉了裁剪层）。但根因——终态会话与常规唤醒共用一条 600+ 行函数体、靠一个布尔在 5 个不相邻位置分叉——原封未动。

**方向**：拆成 `runSchedulerWake` 与 `runTerminalConversation`。若判定当前不值得动，也应把 ARCH-C-5 补进处置总表标 ⬜，而不是让它在文档体系里彻底消失。

### R2-15　判别联合「漏改静默走错分支」族

一处体面的定义 + 消费侧散落的字面量 if-链，漏改后**不报错、走错误分支**。共 14 处（附表一），其中 P1 四处：

- `intent-analysis` 的 `ClarificationPriority`（2 值）：`orchestrator/analyze-intent-tool.ts:91` 用 `item.priority === "blocker"` 过滤。新增第三档会被静默并入 nice 桶，永远不会触发真实用户提问。同文件 `INTENT_CLASSES` / `COMPLEXITY_BANDS` 都有 `satisfies` 保险丝，唯独这个没有。
- `work-ledger/projection.ts:346-354`：4 值 `kind` 用 if-链 + **无条件兜底** `return workLedgerArchivedTaskFromTaskID(...)`。新增第 5 种候选行零编译错误、静默被当已归档任务处理，报出语义无关的错。改动面跨 3 包 6+ 文件。
- `work-artifact/runtime/package-manifest.ts:16`：`kind: z.enum(["executable","shared_library","data"])` 里 `shared_library` 是**死成员**（生产端只产出另两种），而 12 处消费点全是二元 `=== "executable"`，隐式把非 executable 当 data。一旦真的接入共享库资产，权限会被强制 `0644`（共享库通常需 `0755`）、跳过 macOS 代码签名要求，zod 校验通过、无编译错误。
- `tool/delegate-agent.ts:76`：用**裸数组下标** `WORK_ARTIFACT_TOOL_IDS[0]` / `[2]` / `[3]` 拼面向子 agent 的工具授权文案。当前下标与语义一致纯属数组书写顺序的巧合；重排或插入元素会静默改判字面量类型，**编译通过、测试零覆盖**，子 agent 收到的授权描述与真实权限不符。`profile-registry.ts:15` 已经为 validate 建过具名常量，inspect/deliver 只是没跟进。

**方向**：统一改成不带 `default` 的穷尽 `switch`。同目录的 `tool/schedule.ts`、`tool/memory.ts`、`tool/planner.ts` 已经在用这个写法（`Tool.define` 的 `execute` 返回类型非可选，落出 switch 即编译报错），它在本仓库是可行且已被使用的惯例，只是没被当作目录级约定强制。

---

## P2（摘要）

- **R2-16** `evidence/`（`ref.ts` 39 行 + `reference-comparison.ts` 21 行）零 importer，2026-08-09 起就是死的。讽刺的是：全仓真正的证据存取分散在 `browser-preview/persist.ts`、`visual-qa/evidence.ts`、`integrity/fact-projection.ts`，专门叫 `evidence/` 的目录反而空转。**删。**
- **R2-17** `work-artifact/presentation.ts`（1368 行）揉合六类职责：OS/沙箱安全（:45-186）、协议 schema（:186-375）、运行时装配（:375-537）、authoring 执行（:537-816）、zip/pptx 解码（:816-1007）、判定+持久化回执（:1098-1368）。切分点已被同目录姊妹文件验证——`presentation-inspector-process.ts:1` 只 import 第 5 簇、`validation-authority.ts:5,9` 只 import 第 6 簇的类型。唯一真正跨簇的关切是 `requireOperationBudget`（25 处调用）。
- **R2-18** 发布器 `execute()` 539 行、23 处 `artifact_type ===`（ARCH-C-2 ⬜，确认未变；ARCH-E-1 只删掉了手写联合 schema，未触碰函数体结构）。
- **R2-19** acceptance / verification / visual-qa / fact-check / integrity / evidence 六个目录名字相邻边界不清（ARCH-B-08 ⬜）。**但不建议大合并**：`visual-qa` / `fact-check` / `integrity` 三套脚手架虽同构却各只有一个实例，过早抽象违背「先证明再抽取」。成本极低且该做的只有三处：删 `evidence/`、`verification/`（2 文件，唯一消费者都在 `browser-preview/`）并入其消费者、`integrity/acceptance-tools.ts` 改名（它与 `acceptance/` 零函数级关系，是 integrity 私有的 shell 校验工具工厂）。`decision-log/` 应**明确排除**在这个家族之外——它被 14 个非 test 文件消费，是通用基础设施。
- **R2-20** `integrity/team-agent.ts` 的四个证据图判定函数（`unknownIntegrityCheckIDIssues:93`、`unsupportedIntegrityEvidenceIssues:172`、`integrityCheckGraphIssues:212`、`integrityRequirementCoverageIssues:636`）**未 export**、`test/` 零命中。ARCH-A-3 已经证明「抽成纯函数 + 5 个用例」的范式可行，integrity 从未获得同款处理。
- **R2-21** `orchestrator/dispatch-agent-tool.ts:607` 写回时硬编码 `"goal_ids"`，而读侧 `:549` 已走 `DispatchAdapterContractRegistry.deliverySliceRevisionIDs`。注册表缺对称的写访问器。当前只有一个 adapter 且字面值恰好相等，第二个 adapter 用不同字段名即复现 ARCH-C-12 的原故障（静默产出空 Delivery Slice）。
- **R2-22** `plugin/src/metric-evaluation.ts` 的 `MetricScorerAuthoringSpecSchema`（:167-191）顶层 5 个 kind 是真结构派生，但 `query` 支内层的第二层判别式（:182-185）因为 zod `discriminatedUnion` 不支持 `.omit` 而重新手写了成员列表。canonical 侧加第三个 query 变体不会被感知。
- **R2-23** ARCH-C-25 删掉了 `acceptance/checks/index.ts` 这个零 importer 的 barrel，但同类未跟进：`visual-qa/index.ts`（re-export 9 个符号，全仓真实调用方一律走深路径）、`requirements/index.ts` 同款。`code-smell-report.md` AGT-10 列的另外 7 个未逐一复核。点状修复未推广。
- **R2-24** 生成物漂移本地零信号：`bun run test` / `bun run typecheck` 都不比对 `generated/expert-squad-payload.ts` 与源；`test/` 里 11 个引用该 payload 的文件没有一个断言「生成物等于对源重新渲染的结果」。**当前实测 IN SYNC，且 CI 能拦**（`generate.ts` + `--check-clean-worktree`），只是要 push 后才知道。加一条本地断言即可。
- **R2-25** 其余：`requirements/types.ts:26-50` 两个零调用方函数与当前 schema 形状已脱节（假设 acceptance 是 JSON 编码字符串数组，实际已是单个 string），属会诱导误接线的陈尸代码；`requirements/output-tools.ts:103-131` 的 `register_decision` 用可选 `taskID` 切换「落 DecisionLog」与「只进内存 collector」两套语义，**两个分支返回给模型的成功文案一字不差**；`expert-squads/.../expert-squad-package.ts` 的 4 值 `action` 全部字段 `.optional()`、靠运行期 if 链核对依赖关系且四处抛错均无 expected/received；`browser-preview/persist.ts:777-793` 的 `capture?: unknown` 仍与 4 值 `operationKind` 同居一个入参类型。

---

## 附表一 · 判别联合成员数 vs 消费者分支数

| 判别字段 | 定义处 | 成员 | 独立消费点 | 编译期穷尽 | 漏改后果 |
| --- | --- | --- | --- | --- | --- |
| `ExpertSquadProjectionResources` 授权字段 | `sdk/expert-squad-manifest-v1.ts:119` | 13+1 | 1（手抄） | **否** | **静默放行越权授予**（R2-02） |
| `WakeReason` scheduler.message 分支 | `session/wake.ts:70` | 8 字段 | 3（2 safeParse / 1 手写） | 2/3 | 结算全卡死（R2-05） |
| `operationKind` | `browser-preview/persist.ts:53` | 4 | 4 | 部分 | 静默 404 / 漏取角色（R2-10） |
| `scorer.type`（acceptance） | `acceptance/types.ts:127` | 4 | 6 | 仅 schema | 展示静默错标；扩展成本未降（R2-09） |
| `evaluator_kind`（plugin） | `plugin/metric-evaluation.ts` | 5 | 6 文件 | 部分 | 见 ARCH-D-1/D-8，本轮确认未变 |
| `ClarificationPriority` | `intent-analysis/types.ts:20` | 2 | 3 | 否 | 静默并入 nice 桶（R2-15） |
| work-ledger 候选行 `kind` | `work-ledger/projection.ts:46` | 4 | 1 本地 + 6 跨包 | 否 | 静默误判为已归档（R2-15） |
| `PackageFileSchema.kind` | `work-artifact/runtime/package-manifest.ts:16` | 3（1 死） | 12 | 否 | 静默错误权限/签名（R2-15） |
| `WORK_ARTIFACT_TOOL_IDS` 下标 | `work-artifact/profile-registry.ts:7` | 4 | 1（裸下标） | 否 | 静默污染模型可见文案（R2-15） |
| `VisualQaEvidence.type` 截图子集 | `visual-qa/evidence.ts:16` | 9（子集 3） | 2 | 否 | 静默漏判视口覆盖 |
| `FactCheckReview.overall_verdict` | `fact-check/schema.ts:128` | 4 | 1（三元） | 否 | `minor_corrections` 与 `inconclusive` 静默合并 |
| `analytics` action | `tool/analytics.ts:18` | 3 | 1（if+兜底） | 否 | 静默 "Unknown action" |
| `SchedulerMessageKind→ProtocolKind` | `protocol/delivery.ts:735` | 3 | 1（三元链） | 否 | 静默**误算权限** |
| `ProtocolInboxDeliveryResult.kind` | `protocol/schema.ts` | 5 | 1（窄化无断言） | 结构性 | 静默误判为 task_ingress |
| `PresentationElement.kind` | `work-artifact/presentation.ts:186` | 4 | 1 | 部分 | 静默错误渲染 |

## 附表二 · 编译盲区

| 范围 | 排除方式 | 文件数 | 替代检查 | 已验证有真实错误 |
| --- | --- | --- | --- | --- |
| `packages/opencorvus/test/**` | tsconfig `exclude` | 325 | 无 | **是（20+ 处）** |
| `packages/opencorvus/script/**` | tsconfig `exclude` | 51 | 无 | 未测 |
| `packages/overlay/test/**` | `include: ["src/**"]` | 69 | 无 | 未测 |
| `packages/sdk/js/test/**` | `include: ["src"]` | 8 | 无 | 未测 |
| `packages/plugin/test/**` | `include: ["src"]` | 4/5 | 仅 `*.type-test.ts` | 未测 |
| `packages/transport-protocol/test/**` | `include: ["src/**"]` | 4 | 无 | 未测 |
| `expert-squads/**/*.ts` | **CI 不调用 `check:expert-squad-types`** | 全部 | 仅本地 | 见 R2-03 |

## 附表三 · 判定层各目录当前规模

| 目录 | 文件 | 行数 | 最大文件 |
| --- | --- | --- | --- |
| `acceptance/` | 9 | 2483 | `contract-audit.ts`（762，**零 importer**） |
| `metrics/` | 6 | 1183 | `executor.ts`（743） |
| `evidence/` | 2 | 60 | `ref.ts`（39，**零 importer**） |
| `integrity/` | 12 | 2453 | `team-agent.ts`（732，已从 1002 瘦身） |
| `decision-log/` | 3 | 501 | `index.ts`（373，通用基础设施） |
| `verification/` | 2 | 206 | `evaluate.ts`（197，**零测试**） |
| `visual-qa/` | 12 | 2805 | `output-tools.ts`（896） |
| `fact-check/` | 5 | 671 | `index.ts`（283） |
| `intent-analysis/` | 7 | 654 | `output-tools.ts`（235） |
| `goal-workload-analyst/` | 7 | 1006 | `publication.ts`（419） |
| `requirements/` | 6 | 619 | `agent.ts`（221） |
| `work-artifact/` | 10 | 2585 | `presentation.ts`（1368） |
| `work-ledger/` | 1 | 387 | `projection.ts`（387） |
| `browser-preview/` | 21 | 6909 | `evidence-runner.ts`（1519） |
| `memory/` | 11 | 2799 | `project-memory.ts`（1000） |
| `capability/` | 5 | 492 | `fuzzy.ts`（215） |
| `expert-squads/builtin/**` | 117 个包 | — | **包内自有测试 0 个** |

---

## 落地记录（2026-08-18）

> 全程与另一个会话并发：那一侧当时在执行 ARCH-D-3 / E-4（`prebuilt_scorer_artifact_locators` 泛化、内置 squad 加载路径），涉及 `metrics/`、`plugin/metric-evaluation.ts`、`evolution-lab/tools/`。本轮刻意避开那批文件，全部改动用逐行 Edit 落盘（内容不匹配即失败，不会静默覆盖）。

| 编号 | 处置 | 验证 | 状态 |
| --- | --- | --- | --- |
| R2-01 | 视觉门改由 `visualScorerIDs.size` 决定，与 `ui_rubric_digest` 解耦。顺带修掉反向的失败开放：有视觉 scorer 但无 judge scorer 时，`unavailable` 结果此前完全跳过这道门 | 新增回归用例；**故意还原旧判据确认它变红**（`status: "unavailable"`），再还原。evolution-comparison 6/6。包字节已重生成 | ✅ |
| R2-02 | 手抄的 13 字段清单改为 `satisfies readonly CapabilityGrantListField[]` + `AssertNoUncheckedGrantField` 穷尽断言，字段union 由 SDK `ExpertSquadProjectionResourcesSchema["shape"]` 派生。**type-only import**，Capsule 运行时依赖不变 | 删掉一个字段后编译器**点名** `"package_mcp_resource_refs"`；plugin typecheck 0 错。（`z.infer` 跨包会退化成 `string` 让断言恒真，故走 `.shape`） | ✅ |
| R2-03 | CI workflow 改为直接调用根 `bun run typecheck`，删掉手写的重复步骤清单 | `check:ai-runtime` 与 `check:expert-squad-types` 首次进入 CI | ✅ |
| R2-04 | `EDIT_TOOLS` 归一化下沉进 `evaluate()`，`disabled()` 不再自带一份 | 新增 `test/capability/rules.test.ts` 4 例，直接断言两个入口对同一配置结论一致；security-p0-contracts 9/9 | ✅ |
| R2-05 | `schedulerWakeMessageMatchesInTransaction` 改走 `Message.User.safeParse` + `SessionWake.WakeReason.safeParse`，手写类型断言归零 | protocol/scheduler 四个套件全绿 | ✅ |
| R2-07 | 删除从未执行过的 contract 引用防伪校验与它的可选参数 | goal-workload-coverage-contract 27/27 | ✅ |
| R2-08 | `KIND_WEIGHT` 由 `Partial<Record<...>>` 改为 `Record<Exclude<MemoryKind, HostOwnedMemoryKind>, number>`；`project-memory.ts` 的字面量联合改引用 `HostOwnedMemoryKind` | 临时加入第 8 种 kind，编译器点名缺失项；memory 四个套件全绿 | ✅ |
| R2-13（部分） | `input-projection.ts` 的模型面报错补 expected/received | typecheck 绿 | ◐ |
| R2-15 | 四处收口：`work-ledger` 兜底改穷尽 `switch` + `never`；`ClarificationPriority` 补 `satisfies` 并抽出穷尽的 `clarificationBlocksDispatch`；`PackageFileSchema.kind` 删掉不可达的 `shared_library`（已确认磁盘上既存清单只含 executable/data）；`delegate-agent` 的裸下标改具名常量 | delegate-agent 2/2、runtime-executable-contract 6/6、qualification 15/15 | ✅ |
| R2-16 | 删除 `evidence/` 整目录 | `@/evidence` 零 importer 复核后删除 | ✅ |
| R2-21 | 注册表新增对称的 `withDeliverySliceRevisionIDs`，`dispatch-agent-tool.ts` 里 `"goal_ids"` 字面量归零 | dispatch-agent 两个套件全绿 | ✅ |
| R2-25（部分） | 删除 `requirements/types.ts` 中与当前 schema 形状脱节的两个零调用函数及其独占 schema | typecheck 绿 | ◐ |
| — | 顺带修掉一条**既有**红测试 `requirements-domain-incomplete-settlement`：夹具在 assistant 完成后追加 Tool Part、且缺 `step-start` 与 Tool Part 身份。改为「开着建 → step-start → running Part → 执行 → 完成 Part → 盖完成时间」 | 9/9（此前 8/1） | ✅ |
| R2-06 | integrity 的 `completeness_findings` 进入工件负载并由 `recordIntegrityReview` 落库，与 visual-qa / frontend-design 对齐。字段带 `.default([])`，此前记录的 review 仍可解析 | integrity-review-occurrence-runner 2/2、task-control-integrity-blocked 3/3 | ✅ |
| R2-10 | 读端点的 `operationKind === "reference-comparison"` 字面量守卫删除——角色存不存在才是问题，`scroll-slice-comparison` 写下的同名三个裁图此前经唯一路由**永远 404**。**两张 `operationKind` 表不合并**：persist 那张答「passed 时持久化必须带哪些工件」并带 `cropIntent`，visual-qa 那张答「已发布证据必须暴露哪些图像角色」，键的是 `payload.resource_roles`，`preview-capture` 行两边本就不同 | pixel-content-ratio 6/6、visual-qa-turn-graph-commit 1/1 | ✅ |
| R2-12 | 新增 `test/browser-preview/visual-evaluate.test.ts`：阈值边界上的严格 `>`（相等即失败）、完全相同/完全不同、尺寸不匹配按参考尺寸比较并扣分、非法输入 | 6/6（此前 0） | ✅ |
| R2-20 | 新增 `test/integrity/review-validation.test.ts`：空 checkID 列表本身即缺陷、未注册 checkID 被点名、无 checkItems 的早退、pass 压在 failed 检查上被拒、requirement 覆盖 | 11/11（此前 0） | ✅ |
| R2-23 | 删除 11 个零 importer 的 barrel（visual-qa / requirements / frontend-design / research / intent-analysis / goal-workload-analyst / architect / frontend-research / quicknote / integrity / metrics）。`fact-check/index.ts`（283 行真实实现，2 处引用）、`decision-log/index.ts`（13 处）、`memory/index.ts`（4 处）保留 | 全仓复核零残留引用；三个套件全绿 | ✅ |
| R2-24 | 新增 `test/expert-squad-payload-sync.test.ts`，把生成物与现场渲染逐字节比对，报错带 received/expected 字节数与重生成命令 | **故意给生成物追加一个换行确认它变红**，再重新生成 | ✅ |

### `evolution-artifact-evidence-host` 3 条既有红测试：推进到真实前沿后停手

不是本轮引入，三个 typecheck 全绿时仍红。逐层剥开后的确切位置，供下一轮直接接手：

1. **根因是夹具违反宿主规则**，规则本身正确：`orchestrator/protocol/message-bridge.ts:150-152` 要求 root Session 只承载 `role=user` 的 Message，而夹具把生产者 assistant Message 直接写在 root 上。全文件 8 处这样的写入，分属这 3 条测试。
2. **已修 2 处**（`workerSession` / `candidateWorkerSession`）：生产者 Message 及其 step-start / tool Part / `TaskToolExecutionScope` 一并迁入 root 的子 Session。
3. **子 Session 的 kind 不能随便挑**：`RuntimeTemplateRegistry.isWorkerSessionKind` 对任何被 dispatch adapter 声明的 kind 返回真（build / architect / integrity / requirements 等 13 种），这类 Session 必须另有 `WorkerTurnDescriptor` 提供投影身份，否则 `persistedSessionAgentID` 抛「missing projected agent evidence」。夹具改用非 worker kind（`assistant`）绕开——**这是权宜**：生产者语义上确实是 projected worker，正解是补 `WorkerTurnDescriptor`，如 `requirements-domain-incomplete-settlement` 夹具所示。
4. **剩余前沿**（每修一层露出下一层，均已实测到）：
   - 测试 2 还有一处 root Session assistant 写入（`author=orchestrator`），以及后续 4 处未迁移站点（`trialSession` / 两个 `importedSession` / `evidenceOwnerSession`）。
   - 测试 3 的下一层已探明：把生产者 Message 迁进子 Session 后，报错变为 `Selected Message ses_.../msg_... is not owned by Task tsk_...`。证据收集器要求被选 Message 归属该 Task 的 Session 谱系，仅 `parentID` 挂上去不够——需要照其他夹具的做法登记 `recordDispatchLineage`。
   - 测试 1 已越过 Session 规则，落在下面这条独立线索上。

### 追加线索：`.stage` 暂存树在发布过程中被外部删除（非确定性）

不是夹具噪声，也不是本轮引入。已排除的与已确证的：

- **症状非确定性**：三次运行分别失败在 `snapshot root entries: expected manifest.json,resources, found resources`、`directory entries changed at .../campaign-inputs: expected case-1.json, found`、`ENOENT ... /.stage/<uuid>/manifest.json`、`ENOENT lstat .../.stage/<uuid>/resources/0004`。每次消失的路径不同，且都在**刚由本次发布创建的**树内。
- **窗口**：`publishEngineResourceSnapshot`（`task-artifact/store.ts:1032-1069`）在写完资源文件与写 `manifest.json` 之间只隔一个 `await reservePublicationSequence(...)`。
- **已排除 store.ts 自身**：给 `removeExact` 全量插桩后整轮只有 **1 次**调用，且不涉及 `.stage`。它的失败清理、`execution.close()` 的 stage 清理、幂等重试清理都没有触发。
- **已排除的其他解释**：`assertManagedDirectoryPath`（`:369-403`）与 `reservePublicationSequence`（`:592-617`）均为非破坏性；夹具项目是 `describe.serial` 下共享的 `memoryProject`，只在 `afterAll` 销毁，导入调用是 `await` 的，不存在「detached 工作跑赢销毁」；`readRegularFile` 的 `lstat`/`fstat` 身份校验经本机探针确认在普通临时文件上正常（`identity equal: true`），不是 Windows 通病。
- **未定位**：删除者在 `store.ts` 之外。下一步需要文件系统级观察（watcher 或对 `.r/tasks/**` 的 rm 全量插桩），而不是继续读代码。

按「本地非确定性、影响工件发布完整性」评估，这条**优先于剩余的大文件重构**。

通过/失败计数未变（5/3），无回退。停手是因为这是一项独立的多层夹具现代化，与本轮其余条目混做会让两边都难以复核。

### R2-09 订正：本文把它说重了

上文 R2-09 断言「`acceptance/` 的 4 种 scorer 类型宿主侧零执行器」是「接口在撒谎的最典型形态」。动手前查证 `architect-core.txt:69-79` 后，这个判断**站不住**：这批 scorer 是 Architect 撰写、经 `renderSpecsAsText` 渲染进提示词、由投影执行者与 integrity 团队落实的**规格**，宿主本就不执行——`:78` 明写「leave projected review consumers to invent the missing audit」。没有执行器是设计如此，不是缺口。

真实缺陷窄得多，且确实存在：`acceptance/contract-audit.ts`（762 行）是一个**写了从未接线的宿主侧执行器**，全程零 importer，而它想做的检查已由 `architect/reference-integrity.ts` 承担（拒绝 graph 未声明的 contract ID）。

**处置**：删除该文件；在 `ScorerSchema` 上写明这批 scorer 是给下游消费者的规格而非宿主作业，并点明 `expect.status` / `expect.exit_code` 之所以像断言、以及它与 `MetricScorerSpec.evaluator_kind` 那套宿主侧分类学只共享「scorer」一词和 `prebuilt` 这个成员名。**不动 schema 成员与字段**——那是模型面契约与已落库的 goal acceptance_specs。验证：architect-domain-incomplete-settlement 4/4、algorithm-repair-contracts 5/5、三个 typecheck 全绿。

### 追加发现 R2-26（P0）：六个跨进程锁把「锁被破坏」交给库默认值，而那个默认值会终止宿主进程

审计的五个维度都没有覆盖并发原语，这条是补审时发现的。

`proper-lockfile` 在持锁期间用定时器续约。当续约无法把锁文件的 mtime 保持在 stale 阈值内——机器休眠、IO 饥饿拖慢定时器、锁目录被清理——它宣布锁被破坏并调用 `onCompromised`，其**库默认实现是 `(err) => { throw err }`**（`lockfile.js:213`）。这个 throw 发生在 `setLockAsCompromised` 里，而它由续约定时器和 `fs.stat`/`fs.utimes` 回调调用（`lockfile.js:121/132/155`）——**调用方包在受锁代码外面的 try/catch 看不见它**。

全仓 7 个 `lockfile.lock` 调用点里，只有 `worktree/git-lock.ts` 传了自己的非抛出 `onCompromised`。其余六处取默认值：`config/config.ts`（依赖安装）、`expert-squad/install-lock.ts`、`provider/models.ts`（两处目录写事务）、`provider/removal.ts`、`storage/attachment-store.ts`。

**后果实测确认**：`util/process-error-logging.ts:18` 的 `uncaughtException` 处理器记录日志后 `removeAllListeners` 再重新抛出——即把异常变回真正未捕获，进程终止。它在 `src/index.ts:35`（CLI 入口）与 `overlay-server.ts:15` 都安装。所以一次锁续约打嗝会带走整个宿主，而不是让那一个操作失败。（裸进程探针不装该处理器，表现为打印 ECOMPROMISED 后 `exit=1`；宿主里则是终止。）

**处置**：新增 `util/process-lock.ts`，`acquireProcessLock` 与 `lockfile.lock` 同形，但捕获破坏事件并从 `release()` 抛 `ProcessLockCompromisedError`。六处调用点已有 `finally { await release() }`，因此函数体一行未动即可上报——一个失去互斥的操作不该被报告为成功。`git-lock.ts` 保持直连：它跨 await 点传递长生命周期租约、需要中途 `assertOwned()`，本helper 的作用域模型覆盖不了，且它本就已正确处理。

一处实现细节值得记：锁被宣布破坏时库内部已把它标记为已释放，随后 `release()` 会以 `ERELEASED` 拒绝。先释放再判断会让这个记账错误盖掉真正的原因，所以 `ERELEASED` 在已知破坏的情况下被吞掉。

**验证**：新增 `test/util/process-lock.test.ts` 6 例（破坏后从 release 上报、错误带 target 与 cause、release 幂等、正常路径只运行一次且锁文件清理干净、作用域形式不返回无互斥的结果、body 自身抛错时保留原错误）。测试里 `stale`/`update` 取 2000/1000——库把 `stale` 钳到 ≥2000ms、`update` 钳到 ≥1000ms（`lockfile.js:219-221`），首次续约不可能早于 1 秒，最初按 300ms 等待写的用例全部假绿。

### R2-11 的实测：审计低估了一个数量级，因此不落地

审计写的是「实测有 20+ 处真实类型错误」。本轮建临时 tsconfig（`include: src + test + script`）实跑，并用一个故意的类型错误确认 `test/` 确实被解析：

**真实数字是 676 条**——`test/` 622 条、`script/` 52 条。错误码分布：`TS2339` 163、`TS2345` 135、`TS2322` 100、`TS2769` 93、`TS2353` 65、`TS18048` 33。重复出现的根因是夹具在构造类型上已不存在的字段：`completed` 23 次、`replace` 21 次、`time_started` 17 次、`ask` 10 次。

**没有把这个 tsconfig 留下**。留一个不接进 CI 的检查，正是 R2-03 刚修掉的那种形状——脚本里有、网关不跑。676 条的燃尽应当是一次独立、专注的改动，接入 CI 与燃尽必须同批完成，否则只是给仓库加一个装饰品。审计里 R2-11 的工作量估计据此作废。

三个 typecheck（opencorvus / plugin / expert-squads）均为 0 错误。

**未做，且理由不同：**

- **R2-09（acceptance scorer 执行器）**：需要一次产品裁决而非重构，见上文。不替产品决定要不要扔掉 762 行。
- **R2-06 / R2-10 / R2-11 / R2-12 / R2-14 / R2-17 / R2-18 / R2-19 / R2-20 / R2-23 / R2-24**：未做。其中 R2-11（把 `test/` 纳入 tsc）与 R2-14（拆 `processInvocation`）改动面大，应各自独立成一次改动。
- **`evolution-artifact-evidence-host` 3 条红测试**：确认是**既有失败**，与本轮改动无关（三个 typecheck 全绿之后仍红）。根因是宿主规则「root 会话只承载 operator 的 user 消息」（`orchestrator/protocol/message-bridge.ts:150-152`）与夹具直接在 root 会话上写 assistant 消息相冲突，另有一条 `TaskArtifactStore` 文件身份校验失败。修法是把 assistant 半边挪进子会话，涉及该文件约 8 处、3000+ 行，且正是并发会话在用的文件——应单独一次改动，不与本轮混做。

---

## 建议的处置顺序

不新建层、不新建包、不新建通用原语——与前一轮同方针。

1. **R2-01**（活故障）：解开 `ui_rubric_digest` 与视觉门的语义耦合，抛错补 expected/received。
2. **R2-02**（安全边界）：手抄清单改为从 SDK schema 派生。一行改动，封死未来所有新字段。
3. **R2-03**：CI workflow 改为调用根 `typecheck`。
4. **R2-04 / R2-05 / R2-08 / R2-21 / R2-22**：五处「收敛了但有旁路」，每处都是几行内的收口。**做完后统一补穷尽性断言**，让下一次漏改从运行时静默变成编译失败——这是本轮唯一值得新增的机制。
5. **R2-06 / R2-07 / R2-09 / R2-16**：四处「接口在撒谎」。每处二选一：接到终点，或删掉。不留中间态。
6. **R2-11 / R2-12 / R2-20**：把 test 纳入 tsc；给三条零测试的判定链补直接单测。
7. 其余按附表。

**下一轮审计的方法论修正**：本轮三条最高优先级发现全部落在上一轮刚动过手的代码里。整改验收应当加一步——改完后 grep 同名字段 / 同名字符串在全仓的**所有**出现处，确认真的归零；以及，**不要相信整改留下的注释**，它描述的往往是意图而非达成的状态。
