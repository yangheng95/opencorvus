# 算法框架层结构反模式审计

> 系列第六份。前五份：[code-smell-report.md](code-smell-report.md)（全仓坏味道）、[code-smell-remediation-plan.md](code-smell-remediation-plan.md)（整改）、[host-design-critique.md](host-design-critique.md)（Host 过度工程）、[state-audit.md](state-audit.md)（状态面）、[algorithm-layer-antipatterns.md](algorithm-layer-antipatterns.md)（算法层判定数值）。
> 生成：2026-08-18。
>
> **与第五份严格互补。** 第五份审的是**判定数值对不对**——阈值怎么标定的、置信区间算了用不用、失败方向对不对。本文审的是**同一批代码的结构**：依赖方向、分层纯净度、模块组织、耦合形态、可扩展性、包边界。同一个文件在两份文档里出现时，取的是不同角度的证据。
>
> **裁决标准**：[framework-architecture-design.md](framework-architecture-design.md) 第二节十条原则。
>
> **方法**：5 个子 agent 分区并行调查（依赖方向 / 模块组织 / 耦合接口 / 可扩展性 / 包边界），共 63 条发现，每条附可复现命令与 `文件:行`。本文作者对全部 P0 条目**逐条重读源码复核**，复核结论见下节，其中一条对子 agent 的结论做了修正。

---

## 总判

五个维度的发现收敛到同一个形状：**判定逻辑没有被当作独立模块对待，而是被当作胶水代码写在它碰巧被调用的地方。** 四条派生病：

1. **判定函数自己做 I/O**（ARCH-A-1、A-3）。验收判定在函数体内读会话、读工件表、读磁盘证据，算完再把裁决写回引擎工件表；记忆打分公式与 FTS5 裸 SQL 焊在同一个函数里，四个纯函数因未 `export` 而在语言层面不可导入。结果是这些判定**物理上无法脱离宿主验证**——这正是第五份审计里「未标定常数」没有可测靶子的结构前提。纯度问题不解决，标定问题永远无处安放。

2. **「这是哪种判定」被写成字面量比较而非注册表条目**（ARCH-D-1..D-3、D-8、C-2、C-7、E-1）。`evaluator_kind` 这一个枚举在 4 个文件 13 处被分别 switch，三份 schema 各自手写；发布闸门是 568 行、23 处 `artifact_type ===` 分支的单函数。散弹式修改的代价已经兑现成一个**结构性不可达的能力面**。

3. **裁剪与校验分居两层且互不知晓**（ARCH-C-1、C-5）。内层按终态权威裁掉工具，外层拿一份不知道终态存在的清单去校验同一张表——这不是理论风险，是一条当前每次都会抛错的活路径。

4. **共享原语层空缺**（ARCH-B-03..B-05、B-11）。`util/`（54 个文件）里没有 `weightedMean`、没有 `clamp`、没有 `uniqBy`，于是加权打分被独立实现 4 次（权重校验规则四种：`(0,1]` / 不校验 / `>0` / `>=0`），clamp 5 次以上（含同目录内的字节级重复），dedupe 9 次，token 估算 4 次绕过已按 CJK 修正的权威实现。

**三个 agent 从三个方向撞上同一处**：D 从「新增一个 scorer 要改几个文件」、E 从「包边界与契约强制」、C 从「发布闸门的控制耦合」分别到达同一个断裂——canonical `MetricScorerSpecSchema` 承诺 5 种 `evaluator_kind`，campaign 发布器只认 2 种。这不是三条重复发现，是同一处结构缺陷在三个维度上各留下的一个洞。

---

## 本文作者的复核结论

对 P0 条目重读源码，四条确认、一条修正：

1. **ARCH-C-1 属实，且是活的故障路径。** `TERMINAL_TASK_TOOL_CAPABILITIES`（`orchestrator/tools.ts:875-886`）的只读白名单 10 个名字，不含 `artifact_select`；而 `artifact_select` 经 `PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS`（`tool/platform-artifact-tool-ids.ts:6-9`）→ `TASK_ARTIFACT_SCHEDULER_TOOL_IDS`（`tool/tool-id-catalog.ts:20-23`）**无条件**进入 `expandedSchedulerBuiltInToolIDs`（`expert-squad/prompt-profile-resolver.ts:1174-1180`）。`orchestrator/agent.ts:589-601` 把已被 `projectTerminalConversationTools` 裁剪过的 `rawTools` 直接交给 `projectOrchestratorTools`，后者在 `:2924-2931` 对每个 `builtInToolIDs` 缺失即 `throw`。终态任务收到 operator 追问 → 建表阶段抛 `did not build that tool`。

2. **ARCH-E-1 / C-3 / D-1 属实。** `packages/plugin/src/metric-evaluation.ts:95-116` 的 canonical 判别联合有 `shell / judge / prebuilt / query / aggregator` 五支；`expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts:119-122` 的 `CampaignScorerAssetSchema` 只有 `judge / query` 两支。而 `comparison.ts:350-357` 的视觉复核门恰恰按 `evaluator_kind === "prebuilt" && evaluator_config.name === "visual-feedback-verification"` 识别 scorer——**发布器结构上产不出判定侧要找的那类 scorer**。因此 `:362-368`：只要 `campaign.ui_rubric_digest !== null`，`visualScorerIDs.size === 0` 恒成立 → `visualReview.status = "unavailable"` → `:377-381` 的 `recommendation` 恒为 `"inconclusive"`。**任何带 UI rubric 的 campaign 永久无法晋升。**

3. **ARCH-B-01 属实。** `writeIterationSnapshot`（`metrics/store.ts:153`）全仓零调用方；`computeIterationSnapshot`（`metrics/score.ts:41`）只被 `test/metrics-evidence-runtime.test.ts` 调用；而 `readIterationHistory`（`metrics/store.ts:196`）被 `engine/describe.ts:21` 与 `orchestrator/agent.ts:79` 两处生产代码 import 去给模型拼上下文。读端活、写端死 → 交给模型的那段「迭代历史」结构性恒为空。

4. **ARCH-A-1 属实**（`acceptance/visual-feedback-verification.ts:7,9` import `@/engine/artifact` 与 `@/session`；`:136,:184,:259` 判定函数内三处读；`:329` 写回引擎工件表）。

5. **ARCH-B-02 需修正。** 子 agent 称 `runtime/visual-page.ts`「零调用点」，不准确：同文件的 `renderPage`（`:110`）被 `runtime/page-capture.ts:4` 在用。死的是它的**判定半边**——`runVisualDiff`（`:714`）与 `summarizeVisualReport`（`:828`）唯一的外部出口是 `acceptance/checks/index.ts:29-34` 这个 barrel，而该 barrel 零 importer（`task-api/index.ts:19` 直接 import `@/acceptance/checks/discovery`，绕开了它自述的「唯一入口」契约，即 ARCH-C-25）。结论方向不变（第二套 SSIM 判定引擎确实是死的），但「文件死」应改为「文件的判定半边死」。

另附一条正面确认：`comparison.ts:377-381` 显示第五份审计的 ALG-03 修复**已落地**——晋升判据已改为 `aggregateInterval.lower > 0`，权重不再是装饰品。本文基于当前工作区（含未提交改动）。

---

## 优先级

- **P0（已在产生故障，或安全边界只存在于文本）**：ARCH-C-1（终态会话必抛错）、ARCH-E-1 / C-3 / D-1（scorer kind 三份分裂 → UI campaign 永久 inconclusive）、ARCH-E-2（`expert-squads/**/*.ts` 不在任何 `tsc` 编译范围，是前一条的根因）、ARCH-C-4（候选包自我修改的安全不变式只写在 agent 提示词里）、ARCH-B-01（恒空的迭代历史被当真喂给模型）、ARCH-A-1（验收判定读会话+写工件三合一）。
- **P1（结构性阻碍演进）**：ARCH-A-2/A-3/A-4、ARCH-B-02..B-06、ARCH-C-2/C-5/C-6/C-8/C-10/C-11/C-15/C-21、ARCH-D-2..D-5/D-8、ARCH-E-3..E-5。
- **P2**：其余（浅模块宽接口、死接口、接口卫生）。

**统一修复方向**（五个维度指向同一处，且都是「删」而不是「加层」）：把「这是什么判定」的知识从 `if`/`switch` 字面量搬进单一注册表，执行侧只认注册表条目；把判定函数的 I/O 提到调用方，让判定退化为纯函数；把裁剪与校验合并为同一次调用。不需要新建层、包或通用原语。

---

## 维度 A · 依赖方向与分层纯净度


> 只读审计，不改源码。范围：`packages/opencorvus/src/{acceptance,verification,fact-check,review,capability,memory,browser-preview,visual-qa,scheduler,expert-squad,orchestrator,decision-log,work-ledger,metrics,usage,intent-analysis,goal-workload-analyst,integrity,work-artifact}`、`util/pixel-stats.ts`、`util/token.ts`、`llm/activity.ts`、`expert-squads/builtin/evolution-lab/lib/**`。
> 与 [algorithm-layer-antipatterns.md](algorithm-layer-antipatterns.md) 互补：那份审**数值对不对**（阈值标定、统计推断、fail-open/closed）；本篇审**结构**——依赖方向、纯度、算法-宿主耦合方向、层内环。凡是本篇引用到与 ALG 系列相同的文件，取的都是不同角度的证据（import 边、函数边界），不重复其数值结论。
> 方法：`tsconfig.json` 用 `@/*` → `./src/*` 别名，故所有 grep 直接按 `from "@/xxx"` 匹配即为包内依赖边，无需额外解析。排除 `*.test.ts`、`node_modules`、`generated/`。
> 裁决标准：[framework-architecture-design.md](framework-architecture-design.md) 第二节十条原则。

---

### ARCH-A-1　验收判定模块自己读会话、读事实存储、还把判定结果写回事实存储——反向依赖+纯度污染+宿主耦合方向三合一

- **位置**：`packages/opencorvus/src/acceptance/visual-feedback-verification.ts:7,9`（import）；`:136`、`:184`、`:259`（I/O 读）；`:329`（I/O 写，`persistVisualFeedbackVerificationArtifact`）。
- **事实**：
  ```
  grep -n 'from "@/' packages/opencorvus/src/acceptance/visual-feedback-verification.ts
  ```
  命中 `import { recordEngineArtifact } from "@/engine/artifact"`（第7行）与 `import { Session } from "@/session"`（第9行）。全仓 `acceptance/` 目录里唯一直接 import `@/session` 与 `@/engine/artifact` 的文件就是这个"验收判定"文件本身（同目录其余文件——`prebuilt-scorer.ts`、`types.ts`、`checks/types.ts`——零反向依赖）。
  函数级证据：
  - `validateVisualFeedbackVerification`（:123-315）内部直接调用 `requireEngineArtifactByLocator`（:136，读引擎工件表）、`await Session.messages({ sessionID })`（:184，读会话消息全量）、`readBrowserPreviewEvidenceByRow`（:259，读磁盘证据字节）——判定函数自己去查三处不同的存储，而不是被传入已经取好的数据。
  - `persistVisualFeedbackVerificationArtifact`（:317-338）在判定文件里直接调用 `recordEngineArtifact`（:329）把验证结果写回引擎工件表——即**判定逻辑自己驱动宿主的事实存储**，不是宿主拿到判定结果后自己写。
- **违反原则**：第1条（依赖只指向更稳定方向——`acceptance` 判定反向依赖 `session`/`engine`）、第2条（领域内核纯净、无 I/O）、第5条（端口隔离外部易变性——判定应通过端口拿数据，而不是直接 import 存储实现）。
- **后果**：这是本仓库唯一同时命中"验收判定"的判定函数——决定一个视觉交付是否 `passing`。要单测 `validateVisualFeedbackVerification` 必须拉起完整的 session 消息表、engine 工件表、磁盘证据文件三套真实依赖；无法用假数据脱机验证一条判定路径。这与 memory 记录的「Evolution E2E 被验收耦合+53 道 fail-closed 门阻塞」是同一根因在结构层面的体现：判定和它所需的宿主状态没有端口分隔，任何一处存储 API 变化都直接震到验收判定。
- **删除方向**：不是新增 `VerificationPort` 抽象层，而是把 I/O 读取从 `validateVisualFeedbackVerification` 里**挪出去**——由调用方（宿主）先解析好 `messages`/`visualReviewArtifact`/`evidence` 三个入参，判定函数只做纯校验；`persistVisualFeedbackVerificationArtifact` 直接内联到调用方的写入路径，判定文件里删掉这个函数和 `recordEngineArtifact` 依赖。

---

### ARCH-A-2　重试/超时判定模块反向写入会话层的全局可变单例

- **位置**：`packages/opencorvus/src/llm/activity.ts:30`（`import { SessionStatus } from "@/session/status"`）、`:621`（`SessionStatus.registerActivityMonitor(ctx.sessionID, monitor)`，在 `withLLMActivity` 内，函数体 :450-…）；写入目标 `packages/opencorvus/src/session/status.ts:116`（`const activityMonitors: Record<string, StreamActivityMonitor> = {}`）、`:210-217`（`registerActivityMonitor` 直接 `activityMonitors[sessionID] = monitor`）。
- **事实**：
  ```
  grep -n 'from "@/' packages/opencorvus/src/llm/activity.ts
  ```
  只有 5 条 import，其中 `@/session/status` 是唯一一条指向"上层"（session 属于设计文档 L2 编排层，llm 属于 L3 适配器/端口实现——按设计文档，应该是 session 调 llm，不是 llm 反过来改 session 的状态）。
  `classify`（:268）、`isRetryable`（:371）——即 ALG-01 审过的重试分类核心——**不**触碰 `SessionStatus`，问题局限在同一文件里另一个函数 `withLLMActivity`（:450 起）。该函数在启动空闲监控时把自己的 `StreamActivityMonitor` 塞进 `SessionStatus` 的模块级私有对象 `activityMonitors`（`session/status.ts:116`），此对象在 `session/status.ts` 内被至少 8 处其他函数读写（:159,211,213,214,220,229,237,239,276,313）。
- **违反原则**：第1条（依赖方向反了——llm 应是被 session 调用的端口实现，而不是反过来改 session 状态）、第6条（显式依赖注入、无全局可变单例——`activityMonitors` 正是这类单例，llm 层从外部对它写入）。
- **后果**：`withLLMActivity` 包裹全仓每一次 LLM 调用（编排器轮次、evolution-lab 对照实验等），意味着"要不要认为某个 session 的 LLM 调用卡住了"这件事的真相有一部分（idle monitor 的注册/反注册时机）散落在 `llm/` 里，另一部分（读取、清空、按 lifecycle 事件删除）散落在 `session/status.ts` 里，两者靠一个裸 `Record` 对象耦合。改 `SessionStatus` 内部表示，或者改 `withLLMActivity` 的调用时机，都可能在不改双方任何显式契约的情况下破坏对方。
- **删除方向**：不新增 `ActivityPort` 接口——`withLLMActivity` 已经通过参数接收 `ctx`；把"注册/反注册 idle monitor"的调用点从 `llm/activity.ts` 挪到调用 `withLLMActivity` 的 session 侧（session 拿到 `idleHolder.monitor` 后自己登记），`llm/activity.ts` 不再 import `@/session/status`。

---

### ARCH-A-3　记忆检索打分公式焊死在裸 SQL 查询函数里，物理上无法脱离数据库单测

- **位置**：`packages/opencorvus/src/memory/search.ts:1`（`import { Database, eq, sql } from "@/storage/db"`）；`:97-133`（FTS5 查询）；`:140-148`（打分公式，同一个 `search()` 函数体内，紧跟在查询结果的 `for` 循环里）；`:182-201`（`compareResults`/`clampScore`/`bm25RankToScore`/`buildFtsQuery` 四个纯函数，均未加 `export`，在 TS `namespace` 语法下对外完全不可见）。
- **事实**：
  `export function search(...)`（:48）是 `namespace MemorySearch` 里唯一导出的函数；其余四个纯函数（:182,187,192,197）没有 `export` 关键字，在 namespace 语义下无法从模块外单独 import——即使有人想单独测打分公式，语言机制本身就不允许。
  验证：
  ```
  grep -rln "MemorySearch" packages/opencorvus/test
  ```
  零命中。现存最接近的测试 `packages/opencorvus/test/memory/search-filter-order.test.ts` 走的是 `Memory`（`src/memory/index.ts`）整个门面 + `resetMemoryDatabase` 真实 SQLite fixture（该文件 :1-4），不是对 `bm25RankToScore`/`compareResults` 的直接单测——因为根本没有直接单测的入口。
- **违反原则**：第2条（领域内核纯净、无 I/O——打分是纯数学，却焊在 `Database.use` 查询函数体内）、第10条（性能优化隔离在适配器——这里是反过来，"怎么查"和"怎么打分"焊死在一起，谁都不能单独变）。
- **后果**：ALG-05/ALG-06 指出的"种类权重算两次"“0 权重变成索引了搜不到”之所以能在 HEAD 上存在很久没被发现，结构原因就在这里——打分逻辑没有独立单测入口，只能靠端到端跑一次真实 FTS5 查询才能观察分数,而端到端测试通常只断言"有没有返回"，不会去核对分数排序的细节。
- **删除方向**：不新增打分端口——把 :140-148 的打分表达式和 :182-201 四个纯函数提到 `namespace` 外部作为**独立可 export 的模块**（例如 `memory/rank.ts`），签名为 `(row: {rank, kind, importance, confidence, timeCreated}) => number`，`search()` 只负责查询再调用它。查询函数因此退化为薄 I/O 层,打分函数拿到独立单测入口。

---

### ARCH-A-4　`capability/` 与 `expert-squad/` 两个"能力发现"包互相 import，形成包级双向依赖环

- **位置**：`packages/opencorvus/src/capability/catalog.ts:5`（`import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"`）；`packages/opencorvus/src/expert-squad/prompt-profile-resolver.ts:63,90,91`（`from "@/capability/fuzzy"`、`from "@/capability/harness-projection"`、`from "@/capability/ref"`）；`packages/opencorvus/src/expert-squad/manager.ts:28`（`from "@/capability/fuzzy"`）。
- **事实**：
  ```
  grep -rn 'from "@/capability' packages/opencorvus/src/expert-squad --include="*.ts" | grep -v test
  grep -rn 'from "@/expert-squad' packages/opencorvus/src/capability --include="*.ts" | grep -v test
  ```
  前者命中 4 处（`manager.ts:28`、`prompt-profile-resolver.ts:63,90,91`），后者命中 1 处（`catalog.ts:5`）。这是**包级环**而非文件级环——`capability/fuzzy.ts`/`harness-projection.ts`/`ref.ts` 本身不反向 import `expert-squad/`（各自 `grep "^import"` 核实：`fuzzy.ts` 只 import `fuzzysort` 和同目录 `discovery-filler.ts`；`harness-projection.ts`/`ref.ts` 只 import `zod`/`node:crypto`），环是靠 `catalog.ts` ↔ `prompt-profile-resolver.ts` 这一对文件在两个目录之间搭起来的。
- **违反原则**：第1条（依赖只指向更稳定方向——两个目录互为对方的稳定性下界，谁都不能单独判定哪个更底层）、设计文档第六节"适配器之间互不依赖"的类比（这里虽非严格意义 L3 适配器，但同属"能力发现"域，理应有单向的内聚关系）。
- **后果**：`capability/` 不能被单独抽出来验证或复用而不带上 `expert-squad/`（反之亦然）。这不是当前正在制造故障的问题（`fuzzy.ts`/`harness-projection.ts`/`ref.ts` 三个纯文件本身保持了干净），但它是"模块边界"层面的坏味道——如果按设计文档第六节的目标包结构收编,这两个目录会被迫合并成一个包,或者需要在其中一侧提炼出更小的纯接口。
- **删除方向**：`capability/catalog.ts` 需要 `PromptProfileResolver` 只是为了聚合"expert squad 是否可被发现"这一件事;把这次调用从 `catalog.ts` 移到调用 `catalog.ts` 的更上层（组合根/编排层），由上层把 expert-squad 的条目连同其他来源一起传给 `catalog.ts` 的聚合函数,而不是 `catalog.ts` 自己去 import `expert-squad/`。

---

### ARCH-A-5　视觉比对的"判定结果"里硬编码了给模型看的英文提示词文案（较轻）

- **位置**：`packages/opencorvus/src/browser-preview/comparison-guidance.ts:1-135`（全文件，zod literal 常量拼出的英文指令文案：`"Compare the right implementation against the left reference; do not reverse them."` 等）；消费点 `packages/opencorvus/src/browser-preview/region-comparison.ts:31`（import）、`:98`（写进结果 schema `comparison_guidance: BrowserPreviewComparisonGuidanceSchema`）、`:373`（写进实际返回值 `comparison_guidance: BrowserPreviewComparisonGuidance`）；同款 import 也出现在 `scroll-slice-comparison.ts:24`。
- **事实**：`comparison-guidance.ts` 除 `zod` 外零依赖，纯度本身没问题;问题是**内容**——它是说给视觉 QA 模型听的操作说明（"左边是参考图,右边是实现,不要弄反"），却被定义在 `browser-preview/`（本次审计认定的算法目录）并被序列化进比对判定的返回结构里,与 SSIM 分数、diff 图并列返回。
- **违反原则**：第2条（领域内核纯净：无提示词文案）。
- **后果**：比较轻——不影响可测试性（文案是常量,不含逻辑分支）,但意味着"改一句英文措辞"和"改比对算法"要碰同一个目录甚至同一份返回结构,长期会让 `browser-preview/` 的变更历史里算法改动和文案改动的 diff 混在一起,不利于评审谁在动判定逻辑本身。
- **删除方向**：把 `comparison-guidance.ts` 移到调用侧的 prompt/文案资产目录（例如編排层调用 `compareBrowserPreviewRegions` 之后再拼装 guidance,而不是由比对函数自己把它塞进返回值),`browser-preview/` 的返回结构只保留分数与像素证据。

---

### 支撑数据：18 个目录里反向依赖边的分布

```
DIRS=(acceptance verification fact-check review capability memory browser-preview visual-qa
      scheduler expert-squad decision-log work-ledger metrics usage intent-analysis
      goal-workload-analyst integrity work-artifact)
grep -rn 'from "@/' packages/opencorvus/src/$d --include="*.ts" | grep -v ".test.ts" \
  | grep -cE 'from "@/(session|engine|server|project|storage|provider|mcp|worktree|channel|host|acp|overlay)'
```

| 目录 | 反向 import 行数 |
| --- | --- |
| scheduler | 34 |
| expert-squad | 24 |
| memory | 21 |
| browser-preview | 17 |
| goal-workload-analyst | 10 |
| work-artifact | 10 |
| visual-qa | 9 |
| work-ledger | 9 |
| acceptance | 7 |
| metrics | 5 |
| fact-check | 4 |
| integrity | 3 |
| review / decision-log / usage / capability | 各 2 |
| intent-analysis | 1 |
| verification | 0 |
| **合计** | **162** |

**如何解读这张表，避免误判**：162 处里绝大多数落在 `*persist.ts`、`*service.ts`、`*.sql.ts`、`*-projection.ts`（读模型投影，非判定投影）这类文件——它们的职责本来就是"把领域概念写进/读出存储"，import `@/storage`、`@/engine`、`@/session` 是这类文件的正当工作,不构成 ARCH 级问题。真正的问题是：**这 18 个目录里只有 `capability/`（`fuzzy.ts` 纯 vs `catalog.ts` 混合)和 `expert-squads/builtin/evolution-lab/lib/`（`comparison.ts`/`artifacts.ts` 纯 vs 上层 `tools/publish-evolution-artifact.ts` 混合)在目录内部体现出"判定"和"I/O"的文件级切分**；`verification/visual/evaluate.ts`、`metrics/score.ts`、`visual-qa/acceptance-semantics.ts` 三个文件本身也是干净的纯函数（各自 `grep "^import"` 核实：`metrics/score.ts` 只 import 同目录 `./types`；`visual-qa/acceptance-semantics.ts` 只 import 同目录 `./schema`；`verification/visual/evaluate.ts` 零跨层 import),但它们的干净是**个体自律**,不是目录级约定——没有命名规则或子目录标记哪些文件承诺保持纯度,下一次改动很容易在同一文件里顺手加一行 `import { Database } from "@/storage/db"` 而不会有任何机制拦下来（ARCH-A-1、ARCH-A-3 就是这类"顺手加一行"长期累积的结果)。

---

### 层内环检查（问题4）：除 capability⇄expert-squad 外，未发现其它环

按以下方式逐对核对了同一批 18 个目录之间的相互 import（每对方向各一条 grep,只列出确认过的组合）：`browser-preview↔visual-qa`（单向,visual-qa→browser-preview,2 处：`annotated-screenshot.ts:14`、`evidence.ts:11`,均指向 `@/browser-preview/persist`,无回边)、`acceptance↔browser-preview`/`acceptance↔visual-qa`（单向,acceptance→两者,共 3 处,均集中在 `visual-feedback-verification.ts:5,6,10`,无回边)、`memory↔scheduler`/`memory↔expert-squad`（零依赖)、`work-ledger↔metrics`/`work-ledger↔decision-log`（零依赖)。`capability⇄expert-squad` 是本次审计范围内唯一确认的双向环（ARCH-A-4)。**待确认**：`scheduler/`（34 处反向边,内部文件数最多)与 `orchestrator/`（未逐文件展开)之间是否存在环——本轮受篇幅限制未做完整 N×N 核对,如需要应基于本文件顶部的目录清单跑一次完整的目录对目录 grep 矩阵。

---

### 总判

18 个目录里 162 处反向 import 大部分是持久化/服务文件的正当依赖，真正的结构性事故集中在极少数**判定函数本身**：验收判定自己读会话、写工件（ARCH-A-1），重试判定反向注册进会话的全局单例（ARCH-A-2），记忆打分焊在 SQL 里且语法上不可单测（ARCH-A-3）。这些函数无法脱离宿主验证，正是同一批算法此前被爆出"未标定常数""算了不用"的结构性土壤——纯度问题不解决，标定问题永远缺可测的靶子。capability/fuzzy.ts、metrics/score.ts 等文件证明纯函数在本仓库是可行的，只是没有被当作目录级契约执行。


## 维度 B · 模块组织与概念重复


> 范围：模块组织与概念重复，**不判定数值/阈值对错**（那是 `docs/algorithm-layer-antipatterns.md` 的范围，凡与其 ALG-01~12 重叠的仅作交叉引用，不重复展开）。
> 方法：每条先 grep 定位命中数，再 Read 实现体逐字比对，只记亲自读过确认的结论。

---

### ARCH-B-01 `metrics/` 整条打分管线的写端从未被生产代码调用，读端却在两处生产路径消费其（恒为空的）输出

- **位置**：`packages/opencorvus/src/metrics/score.ts` `computeIterationSnapshot`；`packages/opencorvus/src/metrics/store.ts` `writeIterationSnapshot`、:196 `readIterationHistory`；消费方 `packages/opencorvus/src/engine/describe.ts`、`packages/opencorvus/src/orchestrator/agent.ts`。
- **事实**：
  - `rg "computeIterationSnapshot" packages/opencorvus/src packages/opencorvus/test` → 命中 3 处：定义处 1、re-export 处 1（`metrics/index.ts`）、调用处 1——且调用处是 `test/metrics-evidence-runtime.test.ts:714`，**不是生产代码**。
  - `rg "writeIterationSnapshot" packages/opencorvus/src packages/opencorvus/test` → **仅 1 处：定义本身**。生产代码里没有任何地方把 `computeIterationSnapshot` 的输出传给 `writeIterationSnapshot`。
  - `readIterationHistory` 却被 `engine/describe.ts` 与 `orchestrator/agent.ts` 两处生产路径导入，用于往 prompt 里拼历史快照。
- **违反原则**：第 4 条（一个概念一个模型一处实现）——这里是反向病：模型存在、实现存在、却没有一条真实数据通路把两端接起来；第 3 条（深模块窄接口）——`readIterationHistory` 对调用方呈现"有历史"的窄接口，实际内政（写端）是空的，接口撒谎。
- **后果**：`engine/describe.ts`/`orchestrator/agent.ts` 拼给模型的"迭代历史"字段在当前代码路径下**恒为空数组**，模型据此做出的任何"看趋势"判断都是在读一个结构性为空的字段，且没有任何测试或类型系统能发现——因为 `readIterationHistory` 类型签名合法、只是运行时永远查不到行。
- **删除方向**：要么找到真正应调用 `computeIterationSnapshot`→`writeIterationSnapshot` 的编排触发点并接上（如果这条度量管线仍是产品需求），要么把 `score.ts`/`writeIterationSnapshot`/`readIterationHistory` 三者与其消费方一并删除——保留一个只有测试在验证、生产从不产出数据的"度量系统"比没有更危险，因为它看起来在工作。

---

### ARCH-B-02 独立的第二套 SSIM 判定引擎（836 行），与生产在用的评分器数学与阈值语义完全不同，判定半边零调用点

> **本文作者修正**：原结论写作「文件零调用点」，不准确。同文件的 `renderPage`（:110）被 `runtime/page-capture.ts:4` 在用，文件本身是活的。
> 死的是它的**判定半边**——`runVisualDiff`（:714）与 `summarizeVisualReport`（:828）唯一的外部出口是 `acceptance/checks/index.ts:29-34` 这个 barrel，
> 而该 barrel 零 importer（`task-api/index.ts:19` 直接 import `@/acceptance/checks/discovery`，绕开了它自述的「唯一入口」契约，即 ARCH-C-25）。
> 结论方向不变：第二套 SSIM 判定引擎确实不可达。

- **位置**：`packages/opencorvus/src/runtime/visual-page.ts` 全文 836 行，核心在 `runVisualDiff`（:714 起）；对照 `packages/opencorvus/src/verification/visual/evaluate.ts`（210 行）的 `evaluateVisual`（:135）。
- **事实**：
  - `rg "runVisualDiff" packages/opencorvus/src packages/opencorvus/test packages/opencorvus/script expert-squads` → 命中仅 2 处：定义（`runtime/visual-page.ts:714`）与 barrel re-export（`acceptance/checks/index.ts:25`）。**没有任何调用点**（生产、测试、script 全零）。
  - 两套实现都 `import ssim from "ssim.js"`，但组合方式完全不同：
    - `evaluate.ts`：`overallScore = ssim*50 + (100-pixelDiff%)*0.5`，另加 `pixelmatch` 逐像素差异，判定 `ssimScore > 0.95`（单一标量阈值）。
    - `visual-page.ts`：只用 ssim.js，对 `ssim_map` 排序取 `p1/p5/p25` 分位数（:788-793 手写最近秩分位数），判定 `mean >= threshold && p5 >= worstThreshold`（双阈值 + 分布尾部保护）。
  - `visual-page.ts` 文件头注释自陈："The workflow no longer uses SSIM as the final decision... retained for the external benchmark CLI and operator verification workflows only"——但仓库内不存在任何调用它的 benchmark CLI 或 script（已用 grep 核实）。
  - 该文件不在题目给定的 19 个算法层目录清单内（`runtime/` 未被列入），却承载着与 `verification/visual/` 语义重复的判定算法——**说明算法层已经泄漏到审计清单之外的目录**，清单本身不完整。
- **违反原则**：第 4 条（一个概念一个模型一处实现）——"渲染图与参考图是否结构相似"这一个概念有两套独立数学模型；第 3 条——两套都不是"深模块"，对外都直接暴露原始 SSIM 细节而非一个统一的"是否通过"窄接口。
- **后果**：未来任何人以为 `runtime/visual-page.ts` 是"权威"或"更完整"的实现（它确实功能更丰富：分位数尾部保护、真实浏览器渲染）而重新接线，会引入与当前生产判据不一致的第二套通过/失败标准，且没有测试会捕获这种分裂，因为两者从不在同一测试里对比。
- **删除方向**：确认 `runVisualDiff`/`renderPage` 的分位数尾部保护思路是否有价值；若有，把它合并进 `verification/visual/evaluate.ts` 的判定（作为可选的分布检查），然后整体删除 `runtime/visual-page.ts` 里与 `evaluate.ts` 重复的评分路径；若无人认领，直接删除该文件（`page-capture.ts` 仅用到其中的 `renderPage` 截图函数，可以单独抽出，不需要连带 838 行判定逻辑）。

---

### ARCH-B-03 "加权聚合打分"这一个概念被独立实现 4 次，零共享 `weightedMean`，各自的权重校验规则互不相同

- **位置与实现体**：
  1. `packages/opencorvus/src/capability/fuzzy.ts`：`field.weight` 必须 `(0, 1]`（越界抛错），`best = Math.max(best, scoreField(...) * field.weight)`——权重参与的是**取 max**，不是加权平均。
  2. `packages/opencorvus/src/memory/search.ts`（ALG-05 已诊断其正确性问题，此处只记"这是第 2 份独立实现"）：`KIND_WEIGHT` 乘法应用到 `score`，权重值域无显式校验，可以是 `0`。
  3. `packages/opencorvus/src/metrics/score.ts`：`weightedMean`/`weightedDimensionMean`，权重要求 `> 0` 才计入（`<=0` 静默跳过，不抛错）——见 ARCH-B-01，此实现目前是死代码。
  4. `expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts`（ALG-03 已诊断其正确性问题，此处只记"这是第 4 份独立实现"）：`scorer.weight` 允许 `>= 0`，`weight === 0` 的 scorer 被 `directionalMeans` 过滤掉后仍计入 Pareto 约束的分母校验。
- **事实**：`rg "function weightedMean|function weightedDimensionMean|reduce\(\(sum, .*weight" packages/opencorvus/src expert-squads/builtin/evolution-lab/lib --include="*.ts"` 命中 4 个互不调用彼此的实现。四份代码做的是同一件事——"给定 (value, weight) 对，产出一个聚合分数"——却有 4 种权重值域约定（`(0,1]` / 无约定 / `>0` / `>=0`）与 2 种聚合方式（取 max vs 加权平均）。
- **违反原则**：第 4 条（DRY 的本质：知识的单一权威表示）。
- **后果**：想知道"权重为 0 意味着什么"需要分别读 4 份代码得到 4 个不同答案（有的抛错、有的静默跳过、有的仍占分母、有的允许）——新增第 5 个打分器时无从复用，只会诞生第 5 种权重语义。
- **删除方向**：在 `util/`（或新建 `util/aggregate.ts`）沉淀一个 `weightedMean(items, weightOf, valueOf)` 与一个显式的权重校验策略（作为参数传入，而不是 4 处各自决定），四个调用点改为传参复用；ARCH-B-01 的死代码路径可以直接删除而非迁移。

---

### ARCH-B-04 `memory/` 目录内独立复刻朴素 token 估算 4 处，均未使用已按 CJK 修正过的权威实现

- **位置**：
  - `packages/opencorvus/src/memory/index.ts` `function estimateTokens(text) { return Math.ceil(text.length / 4) }`
  - `packages/opencorvus/src/memory/project-memory-organizer.ts` 同名同体
  - `packages/opencorvus/src/memory/project-memory.ts` 同名同体，另在 :519 有内联的第 4 份 `Math.ceil(payload.length / 4)`
  - 权威实现：`packages/opencorvus/src/util/token.ts` `Token.estimate`——`CHARS_PER_TOKEN_LATIN=4`、`CHARS_PER_TOKEN_DENSE=1.5`（对 CJK/假名/谚文按密集文字系数折算），这是 `docs/algorithm-layer-antipatterns.md` ALG-04 明确记录"已修复"的那份实现。
- **事实**：三份函数体逐字节相同（`Math.ceil(text.length / 4)`），`rg "function estimateTokens" packages/opencorvus/src` 命中 3 处，全部在 `memory/` 目录内，无一 `import { Token } from "@/util/token"`。
- **违反原则**：第 4 条。ALG-04 花力气把权威估算器修成 CJK 感知的，但这三处（连带内联的第 4 处）的调用者——chunk 切分（`splitChunks`）、prompt token 预算（`usableInputTokens`/`documentTokens`）、文档 token 上限（`DEFAULT_DOCUMENT_TOKEN_LIMIT`）——完全绕过了那次修复，**中文内容在 `memory/` 的 token 记账上仍然被系统性低估约 3 倍**，这正是 ALG-04 描述的同一 bug，只是发生在权威实现之外的三个复制品里。
- **后果**：`memory/project-memory-organizer.ts` 用它算 `documentTokens`/`documentTokenLimit` 来决定要不要把文档内容塞进 prompt；`memory/index.ts` 用它决定 markdown chunk 何时切分；两者对中文项目记忆都会低估用量，与 ALG-04 修复前的 `session/compaction.ts` 是同一失败模式，只是没被那次修复覆盖到。
- **删除方向**：删除三份局部 `estimateTokens` 与一处内联算式，改为 `import { Token } from "@/util/token"` 后调用 `Token.estimate`。这是纯粹的"删除重复"，不需要新增抽象。

---

### ARCH-B-05 `clamp`/`clip01` 独立实现 5 次以上；其中两对在各自同一目录内互相不知道对方存在

- **位置与实现体**：
  1. `packages/opencorvus/src/mcp/browser/guard.ts` `const clamp01 = (n) => Math.max(0, Math.min(1, n))`
  2. `packages/opencorvus/src/memory/index.ts` `function clampMetric(value, defaultValue) { if (typeof value !== "number" || Number.isNaN(value)) return defaultValue; return Math.max(0, Math.min(100, Math.round(value))) }`
  3. `packages/opencorvus/src/memory/search.ts` `function clampScore(value, defaultValue) { ... }` —— **与 #2 逐行相同**，只是改了函数名，同在 `memory/` 目录、不同兄弟文件。
  4. `packages/opencorvus/src/visual-qa/annotated-screenshot.ts` `clampBoxToImage`，:579 `function clamp(value, min, max)`
  5. `packages/opencorvus/src/metrics/executor.ts` `function clip01(value) { if (value<0) return 0; if (value>1) return 1; return value }`
  6. `packages/opencorvus/src/metrics/store.ts` `function clip01(x) { if (!Number.isFinite(x)) return 0; ... }` —— **与 #5 同名同语义**，只多一个 `Number.isFinite` 守卫，同在 `metrics/` 目录、不同兄弟文件。
- **事实**：`rg "function clamp|function clip01|const clamp01"` 在算法层目录命中 7 处定义（含上列 6 处独立函数体 + 1 处 box-clamp 的姊妹函数）。`util/`（54 个文件）没有任何一个通用 `clamp(value, min, max)` 导出。
- **违反原则**：第 4 条，且 #3/#6 两组是**同一目录内的姊妹文件各写一份**——不是"不同子系统各自演化"这种可以理解的重复，是同一 PR 作者本可以互相 import 却没有。
- **后果**：任何一处未来发现 `clamp` 对 `NaN`/`Infinity` 处理不一致（#5 不防 `Infinity` 特判，#6 用 `Number.isFinite` 兜底 `NaN`/`Infinity` 一起处理，#2/#3 用 `Number.isNaN` 只防 `NaN`）都需要人工发现全部 6+ 处逐一修，因为没有单点。
- **删除方向**：在 `util/` 新增一个 `clamp(value, min, max)` 与一个 `clampInt(value, min, max)`（覆盖 0-100 取整场景），6 处全部替换为调用，不新增分层，纯删除。

---

### ARCH-B-06 `confidence` 在算法层内至少有 5 种互不兼容的语义与值域，无共享类型

- **位置**：
  1. `memory/`（`packages/opencorvus/src/memory/index.ts` `DEFAULT_CONFIDENCE`，`packages/opencorvus/src/memory/search.ts`）：`confidence: number`，**0-100 整数**，LLM 写入记忆时自报的主观质量分，被乘进检索分数公式 `0.85 + confidence/250`。
  2. `expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts`：`confidence: "high" | "medium" | "low"`，**由置信区间宽度统计推导**（ALG-03 已修）。
  3. `packages/opencorvus/src/fact-check/schema.ts`：`confidence: z.enum(["low","medium","high"])`——**与 #2 同名同枚举值，但这里是 LLM 在生成事实核查结论时自报的主观标签，不来自任何统计量**。
  4. `packages/opencorvus/src/research/schema.ts`：同样的三值枚举，同样是 LLM 自报。
  5. `packages/opencorvus/src/intent-analysis/types.ts`：`confidence: number`，注释"Overall confidence in this analysis, 0-1"——**0-1 连续值**，第三种值域。
  6. `packages/opencorvus/src/mcp/browser/guard.ts`：`confidence: number`，来自 `clamp01(score)`，**0-1 连续值，但语义是 DOM 元素定位的启发式确信度**，与 #5（语义分析置信度）domain 完全不相关，只是恰好同为 0-1。
- **事实**：`rg "\bconfidence\b" packages/opencorvus/src expert-squads/builtin/evolution-lab/lib --include="*.ts"` 命中 19 个文件；抽样读取上述 6 处实现体，确认值域为 `{0-100 整数, 0-1 浮点(×2 个不相关 domain), "low/medium/high" 枚举(×2 种不同来源：统计推导 vs LLM 自报)}` 三类五种不兼容表示，**没有一处存在类型转换或共享定义**，`rg "type Confidence|ConfidenceLevel"` 全仓零命中——没有人试图统一。
- **违反原则**：第 4 条"一个概念一个模型"——"我们对这个判断有多确信"是同一个概念，在算法层被拆成 5 个互不知情的表示；第 7 条（让非法状态不可表示）——`"high"` 这个字符串在 #2 与 #3/#4 里含义不同（有没有统计学支撑），类型系统完全看不出区别，容易被误当同一种可信度合并处理。
- **后果**：待确认——目前没有发现任何代码把两处 `confidence` 直接放在一起比较或合并（未构成已发生的 bug），但这是**结构性风险**：一旦有人写"取多个来源里 confidence 最高的证据"这类聚合逻辑（例如 Integrity Review 同时消费 fact-check 的 confidence 与 memory 的 confidence），会在不进行任何显式转换的情况下比较五种不同量纲的数字/枚举。
- **删除方向**：不强求合并成一个类型（不同 domain 有不同确信度是合理的），但应当在每个模块的字段旁加注释/命名区分（如 `selfReportedConfidence` vs `statisticalConfidence` vs `matchConfidence`），避免裸露的 `confidence` 字段被跨模块误传。

---

### ARCH-B-07 文本相似度/分词器至少 3 套独立实现，其中一套完全死代码

- **位置**：
  - `packages/opencorvus/src/capability/fuzzy.ts`（ALG-06 已诊断打分常数问题，此处只记模块清单）：自定义"无分隔符脚本"分词器 + fuzzysort + token 覆盖 + Dice 系数，四路取 max。
  - `packages/opencorvus/src/agent/context-tools.ts`（code-smell-report AGT-17 已记录停用词表失效问题）：`/[\p{L}\p{N}_]+/gu` 分词 + 40 余词中文停用词表过滤。
  - **新发现，此前未记录**：`packages/opencorvus/src/frontend-design/tools/text-compare.ts` 全文 120 行——第三套独立分词器（CJK 逐字符 + Latin 按分隔符切词，:11-19 `CJK_RANGE`/:14-19 `splitLatinWords`）+ 独立的 Jaccard 多重集相似度（:47 `compareText`，`jaccardSimilarity = intersectionSize/unionSize`，`score = coverageRate*70 + jaccardSimilarity*30`）。
- **事实（死代码核实）**：
  - `packages/opencorvus/src/frontend-design/tools/index.ts` 只 `export` 了 `WebpageCompileTool`/`WebpageExtractTool`/`WebpageRuntimeStateTool` 三个工具，**不包含 `text-compare.ts` 里的任何导出**。
  - `rg "compareText|jaccardSimilarity|from .*text-compare" packages/opencorvus/src packages/opencorvus/test expert-squads packages/plugin --include="*.ts"` → **只命中定义文件自身**，零调用点。
  - `find packages/opencorvus/test -iname "*text-compare*"` → 无结果，零测试覆盖。
- **违反原则**：第 4 条（三套独立实现）+ 第 3 条不适用于死代码本身，但违反"不留无主抽象"的一般卫生原则。
- **后果**：`frontend-design/tools/text-compare.ts` 120 行代码、独立的 CJK 分词与 Jaccard 相似度实现，完全没有被任何调用方使用，也没有被自己的模块 barrel 导出——是一次被遗弃的功能草稿，长期存在会让后来者误以为"frontend-design 已经有文本比对能力"而重复调研。
- **删除方向**：直接删除 `frontend-design/tools/text-compare.ts`（连带其 `extractTextFromTree` 辅助函数）；若确有"渲染文本 vs 设计稿文本"比对需求，应复用 `capability/fuzzy.ts` 或新写时明确只保留一套分词器。

---

### ARCH-B-08 "验收/校验/审阅"五个目录构成的家族里，实际是 3 套互不知情的子代理审阅脚手架 + 1 个错位命名的纯打分器目录 + 1 个没有判定逻辑的"影子模块"

- **位置**：`acceptance/`（10 文件 2470 行）、`verification/`（2 文件 219 行，仅 `visual/evaluate.ts`+`visual/errors.ts`）、`fact-check/`（5 文件 666 行）、`review/`（1 文件 177 行，仅 `stream.ts`）、`integrity/`（10 文件 2242 行）。
- **事实**：
  1. **`review/` 是"影子模块"**：读取 `packages/opencorvus/src/review/stream.ts` 全文，它只 `import { Event } from "@/engine/model"`、`EngineProtocol`、`RuntimeExecutionSettlement`、`Log`——纯事件发布（`emitReviewStreamStarted` 等），**没有任何打分/判定函数**。名字叫"review"却不包含一行判断逻辑；真正的审阅判定住在 `integrity/`。
  2. **`verification/` 名不副实**：目录名暗示"验证"这一广泛职责，实际只有 `visual/evaluate.ts`（SSIM+pixelmatch 打分）与 `visual/errors.ts`（错误类），是一个单一用途的图像比对打分器，被 `browser-preview/region-comparison.ts`/`scroll-slice-comparison.ts` 消费——**它是 browser-preview 的一个评分依赖，却单独占了一个顶层目录**，而同概念的另一套实现（ARCH-B-02）住在完全无关的 `runtime/`。
  3. **`fact-check/` 与 `integrity/` 是两条平行的、独立维护的"LLM 子代理审阅"脚手架**：均包含"事实投影 + prompt 构建 + 工具集创建 + 结构化输出 collector"这一套相同的骨架模式（对照 `packages/opencorvus/src/fact-check/index.ts` 与 `packages/opencorvus/src/integrity/team-agent.ts`），却各自独立实现，零共享抽象（详见 ARCH-B-09/12）。二者在编排层也是独立接线：`orchestrator/fact-check-tool.ts` 与 `orchestrator/integrity-tool.ts` + `orchestrator/integrity-review-stage.ts` 各自一套。
  4. **`acceptance/` 内部同样混杂**：`acceptance/contract-audit.ts`（762 行，code-smell-report AGT-01 已记录零调用）、`acceptance/visual-feedback-verification.ts`（ALG-09 消费方）、`acceptance/checks/`（DSL/discovery，另一套判定），这个目录名义上是"验收"，实际上是三个互不相关的子系统凑在一起。
- **违反原则**：第 4 条 + "内聚判定：按领域能力切，不按技术种类切"（`framework-architecture-design.md` 第六节）——当前是反过来：`fact-check`/`integrity`/`review`/`verification`/`acceptance` 五个目录看似按"审阅阶段"切分，实际每个目录内部又混了多种技术关切（判定 vs 渲染 vs 工具工厂 vs 纯事件），而"审阅一次工作产出是否合格"这一个领域能力被切成了 5 份互不知晓边界的目录。
- **后果**：新增一种审阅方式（例如"性能审阅"）时，没有任何既有骨架可复用——很可能诞生第 4 套独立的"事实投影+prompt+工具+collector"脚手架，重复 ARCH-B-12 描述的模式。
- **删除方向**：不建议现在做大迁移（框架文档第八节已明确"先证明再抽取"）；最小改动是把 `review/stream.ts` 改名/移动进 `integrity/`（它只服务 Integrity 事件），把 `verification/visual/` 移进 `browser-preview/`（它唯一的消费方所在目录），让目录名与实际归属一致；`fact-check/` 与 `integrity/` 的骨架收敛留给有真实第三个审阅类型出现时再抽取公共基类，避免过早泛化。

---

### ARCH-B-09 `integrity/team-agent.ts`（1002 行）在一个文件里揉合四类互不相关的职责，无内部子模块边界

- **位置**：`packages/opencorvus/src/integrity/team-agent.ts` 全文。
- **事实**（按函数逐一分类，`grep -n "^function\|^export function\|^async function\|^export async function"` 共 30+ 处顶层函数）：
  - **证据图判定类**（算法/判断）：:210 `unknownIntegrityCheckIDIssues`、:278 `unsupportedIntegrityEvidenceIssues`、:318 `integrityCheckGraphIssues`、:707 `integrityRequirementCoverageIssues`。
  - **prompt 文案渲染类**（文案/呈现）：:767 `renderSingleSessionIntegrityPrompt`、:800 `renderIntegrityEvidencePrompt`、:835 `renderRequirementLocatorIndex`、:851 `renderHostObservationSummary`、:869 `renderGoalContractSummary`、:891 `renderAcceptanceSpecSummary`、:907 `renderSeverityReconciliationPass`——7 个 `render*` 函数。
  - **工具/会话工厂类**（编排装配）：:531 `createSingleSessionIntegrityToolKit`、:734 `createIntegrityPreviewTools`、:746 `createIntegrityTool`。
  - **文本清洗/裁剪类**（与 ARCH-B-10 的"截断+标记"模式同族）：:922 `sanitizePromptLine`、:932 `sanitizePromptBlock`、:955 `clipIntegrityEvidenceText`。
- **同时**：一个函数名 `unique`/去重族在同文件内出现 3 次不同签名（`packages/opencorvus/src/integrity/fact-projection.ts` `unique`、:243 `uniqueEngineArtifactLocators`、:255 `uniqueArtifactReadLocators`——这三个虽在姊妹文件 `fact-projection.ts` 而非 `team-agent.ts` 本身，但同属 `integrity/` 模块，进一步印证该模块内部没有共享的 dedupe 原语，见 ARCH-B-11）。
- **违反原则**：第 3 条（深模块窄接口）——这四类职责彼此没有共享状态、没有互相调用的必然性（渲染函数不依赖判定函数的输出结构，工具工厂不依赖渲染），却被塞进同一个 1002 行文件，找不到"一句话不含和/以及"的职责描述。
- **同目录佐证（god file 榜单，算法层 19 个目录内 >800 行文件，行数统计）**：

  | 文件 | 行数 |
  | --- | --- |
  | `expert-squad/prompt-profile-resolver.ts` | 4136 |
  | `orchestrator/tools.ts`（ALG-07 已记录 90 处 throw） | 2690 |
  | `expert-squad/registry.ts` | 2468 |
  | `expert-squad/manager.ts` | 2025 |
  | `scheduler/automation-service.ts` | 1766 |
  | `orchestrator/agent.ts` | 1691 |
  | `expert-squad/multica-import.ts` | 1538 |
  | `browser-preview/evidence-runner.ts` | 1519 |
  | `browser-preview/persist.ts` | 1299 |
  | `orchestrator/protocol/message-bridge.ts` | 1254 |
  | `scheduler/event-service.ts` | 1065 |
  | `browser-preview/layout-geometry-diagnostic.ts` | 1017 |
  | `memory/project-memory.ts` | 1003 |
  | `integrity/team-agent.ts` | 1002 |
  | `orchestrator/dispatch-agent-tool.ts` | 951 |
  | `expert-squad/evolution-history.ts` | 933 |
  | `visual-qa/output-tools.ts` | 896 |

  （`expert-squad/prompt-profile-resolver.ts`/`registry.ts`/`manager.ts`/`multica-import.ts` 主要是包发现/装配/技能挂载逻辑而非打分判定，未深入展开，标记**待确认**是否属于本次审计定义的"算法层"；`browser-preview/*` 与 `memory/project-memory.ts` 已在别处触及。）
- **后果**：任何要修改证据图判定规则的人，diff 会与 prompt 文案改动混在同一文件里，代码评审无法只看"判定逻辑变了什么"；反之改文案措辞的 PR 也会牵连判定函数的上下文，增加误改风险。
- **删除方向**：按四类职责拆分为 `integrity/graph-issues.ts`（判定）、`integrity/prompt.ts`（渲染，可与 `integrity/shared-prompt.ts` 合并）、`integrity/toolkit.ts`（工厂）、复用 ARCH-B-10 建议的共享文本裁剪原语替掉 `sanitizePromptLine`/`clipIntegrityEvidenceText`。这是纯拆分，不引入新抽象层。

---

### ARCH-B-10 "带省略标记的文本截断"模式独立实现 3 次，与两套并行但不冲突的"预算"抽象共同构成 `budget` 概念的碎片化

- **位置**：
  1. `packages/opencorvus/src/llm/prompt-budget.ts` `truncateToCharBudget`——结构化实现，返回 `{text, originalChars, renderedChars, truncated}`，`PromptBudget` 类（:79 起）在此基础上做多段落预算分配、生成 `renderNotice()`。
  2. `packages/opencorvus/src/integrity/team-agent.ts` `clipIntegrityEvidenceText`——独立实现，marker 硬编码为 `"\n[omitted_by_initial_integrity_context_cap]"`。
  3. `packages/opencorvus/src/fact-check/index.ts`——内联实现（无函数包装），marker 为 `` `\n\n…(truncated; ${N} more chars)` ``。
- **并行的预算抽象**（非重复但同名冲突，值得记录）：`packages/opencorvus/src/llm/prompt-budget.ts` 的 `PromptBudget`（字符预算，服务单次 prompt 拼装）与 `packages/opencorvus/src/session/context-budget.ts` 的 `ContextBudget`（token 预算，服务整个会话压缩触发）是两个合理但完全独立的"预算"命名空间，无继承、无共享常量，`ContextBudget.usable()` 与 `PromptBudget` 都各自定义了"占比阈值"（`0.9`/`0.25` vs `0.6`），语义相邻但互不知情。
- **事实**：三处截断实现分别读取确认，均是"若超长则 slice 并拼接一段说明文字"的同一模式，字符预算的百分比常数（`0.6`、`0.9`、`0.25`）分散在两个文件里定义，无共享来源。
- **违反原则**：第 4 条。
- **后果**：`fact-check/index.ts` 的截断没有 `PromptBudgetedText` 那样的结构化返回值（调用方拿不到"截了多少字符"这个事实，只能在渲染后的字符串里正则找 `truncated`），一旦需要统计"这次审阅有多少上下文被截断"（例如诊断"审阅结论为何遗漏了某段证据"）无法复用 `PromptBudget.truncationNotices()`。
- **删除方向**：`integrity/team-agent.ts` 与 `fact-check/index.ts` 的两处截断改为调用 `llm/prompt-budget.ts` 的 `truncateToCharBudget`（自定义 marker 通过参数传入，函数已支持）；`PromptBudget`/`ContextBudget` 两个命名空间不必合并（字符 vs token、单次 prompt vs 整会话是两个真实边界），但应在各自文档注释里互相引用，避免读者以为其中一个是另一个的替代品。

---

### ARCH-B-11 dedupe/unique 至少 9 处独立实现，`util/`（54 个文件）没有共享的 `uniqBy`

- **位置**：
  - `packages/opencorvus/src/visual-qa/annotated-screenshot.ts` `uniqueResolvedEvidence`
  - `packages/opencorvus/src/expert-squad/multica-import.ts` `uniqueByID<T extends {id:string}>`
  - `packages/opencorvus/src/expert-squad/prompt-profile-resolver.ts` `unique`
  - `packages/opencorvus/src/expert-squad/registry.ts` `uniqueRefList`、:2199 `uniqueAvailableIdentitiesInScope`
  - `packages/opencorvus/src/metrics/score.ts` `uniqueGoalIDs`（属 ARCH-B-01 死代码路径的一部分）
  - `packages/opencorvus/src/integrity/fact-projection.ts` `unique`、`uniqueEngineArtifactLocators`、`uniqueArtifactReadLocators`——**同一文件内 3 个不同的 key 提取策略**（trim 字符串、`` 拼接 locator 字段、`JSON.stringify` 整体序列化）。
- **事实**：`rg "function unique|function dedupe|function uniqBy|function distinctBy"` 在 19 个算法层目录中命中 9 处独立定义；`rg "function unique|function dedupe|function uniqBy" packages/opencorvus/src/util` **零命中**。
- **违反原则**：第 4 条。`framework-architecture-design.md` 明确把"纯工具"列为 L0 内核候选（"errorMessage、isRecord、canonicalDigest……每个恰好一份"），去重原语属于同一类别，但没有被沉淀。
- **后果**：9 处实现里 key 提取策略互不相同（有的按整个值序列化、有的按显式字段拼接、有的按 `id` 字段），行为细节（保留首个 vs 末个、是否稳定排序）没有统一约定；`integrity/fact-projection.ts` 内部 3 份并存本身就说明"写的时候没意识到旁边已经有一份"。
- **删除方向**：`util/` 新增 `uniqBy<T>(items: T[], keyOf: (item: T) => string): T[]`（保留首个）与需要时的 `uniqByStable`（保留末个，供 `integrity/fact-projection.ts:255` 那种"后来者覆盖"场景），9 处替换为调用。

---

### ARCH-B-12 同名文件 `fact-projection.ts` 分别存在于 `fact-check/` 与 `integrity/`，21 行 vs 261 行，语义相关但规模悬殊

- **位置**：`packages/opencorvus/src/fact-check/fact-projection.ts`（21 行，`projectFactCheckFacts` 只生成一句"请自己去 artifact 目录搜索"的指令文本，刻意不拷贝任何事实内容）对照 `packages/opencorvus/src/integrity/fact-projection.ts`（261 行，`projectIntegrityEvidenceFacts`/`projectIntegrityPromptFacts`/`integrityPersistenceRefs` 三个函数，完整拉取 Goal/Requirement/BuildHostObservation/Attachment 并组装成读模型）。
- **事实**：两文件同名、同处在"审阅子代理准备读模型"这一职责位置（均被各自模块的 agent 构建函数调用），但实现哲学相反——`fact-check` 版本是"故意不投影内容，只给指令"，`integrity` 版本是"完整投影内容"。两者读起来像是同一个抽象的两次独立发明，而非刻意的设计对比（`fact-check` 版本的文件头注释解释了"为什么不投影"，但没有引用或对照 `integrity` 版本，说明这个对比关系没有被文档化，是巧合的同名而非有意的姊妹设计）。
- **违反原则**：第 4 条的边界情况——这不是"实现重复"，而是"命名重复但语义分叉未被文档化"，读者（包括未来维护者）会自然假设同名文件是同一个抽象的两个实例，需要额外读代码才能发现二者哲学相反。
- **后果**：低——目前没有发现因此产生的 bug，但增加了认知负担：`rg "fact-projection"` 会同时返回两个完全不同的东西。
- **删除方向**：给 `fact-check/fact-projection.ts` 改名为更能体现"故意留白"设计意图的名字（如 `fact-check/discovery-instruction.ts`），避免与 `integrity/fact-projection.ts` 的命名空间碰撞；或在两个文件头互相加一句 doc 注释交叉引用，说明"这是两种不同的证据投影策略，Fact Check 故意不做，Integrity 故意做"。

---

### ARCH-B-13 `review/`、`work-ledger/` 是仅 1 个文件的独立目录（待确认是否需要独立包边界）

- **位置**：`packages/opencorvus/src/review/stream.ts`（177 行）、`packages/opencorvus/src/work-ledger/projection.ts`（387 行）。
- **事实**：`find review -name "*.ts"` / `find work-ledger -name "*.ts"` 各返回 1 个文件。`verification/`（2 文件，其中 1 个是纯错误类定义）同样接近这一门槛，已在 ARCH-B-08 讨论。
- **违反原则**：`framework-architecture-design.md` 第六节"一个真正单一职责的模块可以很大……反过来，一个只有胶水的 11 行 namespace 应该内联"——本例文件不算小（177/387 行），不是"该内联"的典型案例，但**目录粒度**与内容量不匹配：为一个文件单独开一个顶层目录，让"这个概念该去哪个目录找"的心智负担增加，却没有换来对应的模块化收益。
- **后果**：低，主要是心智负担；`review/` 因其名不副实（ARCH-B-08）风险更高，`work-ledger/` 本身职责单一清晰（工作台列表投影），风险较低。
- **删除方向**：`review/stream.ts` 按 ARCH-B-08 建议并入 `integrity/`；`work-ledger/projection.ts` 待确认——如果它未来会承接更多"工作台视图"相关文件，独立目录合理，暂不建议动。

---

### ARCH-B-14（待确认）统计原语（mean/variance/percentile/t 分位数）目前只有一份真实实现，`util/` 没有共享落点，属于结构性风险而非已发生的重复

- **位置**：仅有 `expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts`（`mean`/`median`/`sampleVariance`/`T_QUANTILE_95_BY_DF`，ALG-03 已详细讨论其校准问题）；`runtime/visual-page.ts:788-793` 的分位数计算是另一套（针对 SSIM 像素图排序取分位数，用途不同，不构成同一概念的重复实现，只是同样没有共享工具）。
- **事实**：`rg "function mean\(|function variance\(|function percentile\("` 在算法层目录内仅命中 `comparison.ts` 一处；`util/` 无 `stats.ts` 或等价文件。
- **说明为何标"待确认"而非确定性发现**：只有一份实现，尚不构成"重复"，只能说明"如果第二个模块需要统计推断，大概率会重新发明"——这是**预测性**结构风险，不是已核实的重复。需要的证据（缺失项）：观察是否已有第二处需求被绕开（例如某处应该算方差却用了简单差值），目前未发现。
- **删除方向**：不建议现在预先抽取（呼应框架文档"先证明再抽取"原则）；仅记录风险，留待第二个真实调用点出现时再决定是否沉淀 `util/stats.ts`。

---

### 总判（约 200 字）

算法层的模块组织问题集中在四类：①**同一聚合模式反复发明**——加权打分（4 份）、clamp（6 份，含同目录内的字节级重复）、dedupe（9 份）、token 估算（4 份未接权威实现）、文本截断（3 份），`util/` 作为指定的共享工具层却始终空缺这些原语；②**死代码伪装成活链路**——`metrics/` 整条打分管线写端零调用而读端在生产被消费，`runtime/visual-page.ts` 836 行独立 SSIM 引擎零调用点，比普通死代码更危险，因为接口看起来在正常工作；③**目录名与实际职责错位**——`review/` 无判定逻辑、`verification/` 只服务 browser-preview 却独立成顶层目录、`fact-check/`与`integrity/`两套平行审阅脚手架无共享骨架；④**关键词多义**——`confidence` 五种不兼容表示无共享类型。删除优先于新增抽象：四类问题的共同解法都是"删掉多余的份数，保留一份"，不需要新的分层。

## 维度 C · 耦合与接口设计


> 范围：验收（acceptance）→ 验证（verification）→ 视觉 QA（visual-qa / browser-preview）→ 进化对照实验（evolution-lab）→ 晋升判定，以及 `orchestrator/`、`scheduler/`、`capability/`、`memory/`、`work-artifact/` 的判定入口。
> 与 [algorithm-layer-antipatterns.md](algorithm-layer-antipatterns.md) 互补：本文件不评价任何数值常数、统计方法、重试分类方向是否合理。与 [host-design-critique.md](host-design-critique.md) 互补：本文件不评价锁/租约/状态机/终态吸收态/WeakMap 侧带状态设计本身，只评它们暴露出的**调用边耦合类型**。
> 裁决标准：[framework-architecture-design.md 第二节十条原则](framework-architecture-design.md)。
> 方法：全部条目亲自 Read 源码确认签名与行号；part of the raw evidence was gathered by four parallel sub-audits (acceptance/verification/browser-preview、evolution-lab/work-artifact、orchestrator、scheduler/capability/memory)，其中数条被本文作者独立复现（见各条「复核」标记）。命令均可在仓库根 `/d/myhexin-local/opencorvus` 重跑。

**总计 28 条发现。** P0（判定链路会实际报错/规则永久不可达/安全不变式无代码执行）6 条，P1（控制/内容/时序耦合，判定结果可被静默扭曲）16 条，P2（死接口/浅模块宽接口/接口卫生）6 条。

---

### P0 — 判定链路当前会实际失败，或安全不变式只存在于文本

#### ARCH-C-1 终态会话的工具闸门在两层分别裁剪与校验，二者不同步：每一次终态会话唤醒都会在建表阶段抛错

- **位置**：`packages/opencorvus/src/orchestrator/tools.ts:2683-2688`（`createOrchestratorTools` 内部按 `terminalConversationAuthority` 裁表）、`packages/opencorvus/src/orchestrator/agent.ts:588-601`（`rawTools` 裁剪后直接喂给不知道终态存在的投影器）、`packages/opencorvus/src/expert-squad/prompt-profile-resolver.ts:1174-1180`（`expandedSchedulerBuiltInToolIDs`，无条件追加）、`:2922-2931`（`projectOrchestratorTools` 的校验循环）、`packages/opencorvus/src/orchestrator/tools.ts:875-886`（终态白名单 `TERMINAL_TASK_TOOL_CAPABILITIES`）、`packages/opencorvus/src/tool/tool-id-catalog.ts:20-23`（`TASK_ARTIFACT_SCHEDULER_TOOL_IDS`）。
- **事实**（本文作者亲自逐段复核，非转述）：
  内层裁剪（`tools.ts:897-905`）：
  ```ts
  export function projectTerminalConversationTools<T>(tools, authority) {
    const decisionTool = authority.ingressKind === "operator_message" ? "no_action" : "respond_agent_coordination"
    return Object.fromEntries(
      Object.entries(tools).filter(([name]) => name === decisionTool || terminalTaskToolCapability(name) === "read_only"),
    )
  }
  ```
  只读白名单（`tools.ts:875-886`）10 个名字，**不含** `artifact_select`、`artifact_snapshot`、`publish_interactive_artifact`。
  Phase B 之前外层建 `builtInToolIDs` 的旧路径已删除；当前路径由 manifest v2 typed refs 与 platform sets 一次物化：
  ```ts
  function expandedSchedulerBuiltInToolIDs(grants, config) {
    return expandedProjectedBuiltInToolIDs({
      inheritedToolIDs: grants.builtInToolIDs.filter(
        (toolID) => !grants.explicitBuiltInToolIDs.includes(toolID),
      ),
      explicitToolIDs: grants.explicitBuiltInToolIDs,
    })
  }
  ```
  `TASK_ARTIFACT_SCHEDULER_TOOL_IDS`（`tool-id-catalog.ts:20-23`）= `[...PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS, "artifact_snapshot"]` = `["artifact_search", "artifact_read", "artifact_select", "artifact_snapshot"]`（见 `platform-artifact-tool-ids.ts:6-8`）。
  外层校验（`prompt-profile-resolver.ts:2922-2931`）：
  ```ts
  for (const toolID of capability.builtInToolIDs) {
    if (!Object.hasOwn(tools, toolID)) {
      throw new Error(`Active expert squad ... projects Orchestrator tool ${JSON.stringify(toolID)}, but createOrchestratorTools did not build that tool.`)
    }
  ```
  `agent.ts:588-601` 把内层已裁剪的 `rawTools` 直接喂给这个校验，`schedulerCapability`（其 `.builtInToolIDs` 来自 `expandedSchedulerBuiltInToolIDs`）与终态与否无关，在同一处 `processInvocation` 内被同一个变量名复用（`agent.ts:1530` 附近，`schedulerCapability` 由调用方一次性解析传入，函数体内没有随 `terminalConversation` 重算）。
  命令：`rg -n "processTerminalConversation" packages/opencorvus` → 2 处（`agent.ts:486` 定义、`loop.ts:88` 唯一调用），涉及此路径的端到端测试为 0；唯一相关测试 `test/orchestrator-terminal-coordination-schema.test.ts:109-129` 直接手写 8 键表调 `projectTerminalConversationTools`，从未走 `projectOrchestratorTools`，未覆盖这条组合路径。
- **耦合等级/违反原则**：时序耦合（第三级，最严重形态）——"先裁剪、再按未裁剪清单校验"必须按序发生且互相知晓对方的裁剪规则，类型系统完全不参与。叠加分层倒置：`terminalConversationAuthority` 只进了内层（`createOrchestratorTools`），`schedulerCapability` 只进了外层（`projectOrchestratorTools`），二者对"这次唤醒的工具集应该是什么"各执一份真相。
- **后果**：任何 operator 追问或 coordination 请求唤醒一个终态任务时，`projectOrchestratorTools` 在建表阶段对 `artifact_select`（或 `artifact_snapshot`、`publish_interactive_artifact`）抛 `did not build that tool`，会话在模型看到任何内容之前就失败。这条路径没有端到端测试覆盖。
- **删除方向**：删掉 `projectTerminalConversationTools` 这一独立裁剪层，把 `terminalConversationAuthority` 直接作为参数传入 `projectOrchestratorTools`，让"声明的工具集"与"投影出的工具集"由同一次调用同时决定。

#### ARCH-C-2 `publish-evolution-artifact.ts` 的 `execute()` 是 568 行、用一个 discriminator 串起 8 套互不相干校验逻辑的巨型函数——它是进化晋升链路唯一的发布闸门

- **位置**：`expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts:250-817`。
- **事实**（本文作者亲自 Read 原文确认）：
  ```ts
  export default tool({
    async execute(args, context) {                 // :250
      const artifact_type = publication.artifact_type
  ```
  ```bash
  F=expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts
  sed -n '250,817p' $F | grep -c 'artifact_type ==='   # 23
  sed -n '250,817p' $F | grep -c '\bif ('              # 41
  sed -n '250,817p' $F | grep -c 'throw new'           # 33
  ```
  函数体 568 行，占全文件 818 行的 69%。`payload` 的推导是一条 4 层嵌套三元链（failure-attribution / campaign-spec / candidate-revision / evaluation-result / 默认），campaign-spec 分支本身是一个 184 行的 IIFE（`:298-481`），随后又是 5 个平铺 `if (artifact_type === …)` 块。8 个 artifact_type 的语义完全不同——一个读 Git 包树，一个读 Task run evidence 并重新采集，一个跑统计推导——却共享同一个 `let payload`、同一个 `let resources`、同一个函数作用域。
- **耦合等级/违反原则**：控制耦合（最高等级的非病态耦合）；违反单一职责/开闭原则。`payload` 在分支缝隙处丢类型后，还有 5 处用 `payload as {...}` 手抄另一模块 schema 的字段形状（`:608, 633-638, 639-649, 673-674`）而不引用真实 schema——内容耦合的直接产物。
- **后果**：新增第 9 种 artifact 类型必须改这一个函数；任一分支对共享变量 `resources` 的重赋值会污染尾部共用的 `engineArtifacts.publish` 出口；测试无法只覆盖一支；`payload as {...}` 手抄字段一旦与真实 schema 漂移，编译期无警告，运行期表现为"不匹配"错误却指错对象。
- **删除方向**：拆成 8 个 `(publication, host) => {payload, resources}` 的独立模块，`execute()` 退化为查表 + 一次 publish；分支入口处对 payload 做一次 `EvolutionArtifactSchemas[...].parse()`，删除全部 `as` 手抄类型。

#### ARCH-C-3 视觉复核门在当前发布器下永久不可达：晋升判定检测的 scorer 类型，发布工具在结构上无法产出

- **位置**：判定侧 `expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts:350-368`；生产侧 `expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts:72-122`（`CampaignScorerAssetSchema` 只有 `judge`/`query` 两支）、`:476-477`（`ui_rubric_digest` 由 judge scorer 派生）；晋升消费 `packages/opencorvus/src/expert-squad/evolution-mutation.ts:161`。
- **事实**：
  ```ts
  // comparison.ts:350-368
  const visualScorerIDs = new Set(campaign.scorers.filter((scorer) =>
    scorer.evaluator_kind === "prebuilt" && scorer.evaluator_config.name === "visual-feedback-verification")
    .map((s) => s.scorer_id))
  const visualReview = campaign.ui_rubric_digest === null
    ? { status: "not_applicable" as const, evidence: [] }
    : visualScorerIDs.size === 0 || ... ? { status: "unavailable" as const, ... } : { status: "reviewed" as const, ... }
  ```
  ```ts
  // publish-evolution-artifact.ts:119-122 —— 生产 campaign-spec 的 scorer asset 只有两支
  const CampaignScorerAssetSchema = tool.schema.discriminatedUnion("evaluator_kind", [
    CampaignJudgeScorerAssetSchema, CampaignQueryScorerAssetSchema,
  ])
  // :476-477 —— 但 ui_rubric_digest（打开视觉复核门的开关）由 judge scorer 派生
  ui_rubric_digest: scorerAssets.find((item) => item.asset.evaluator_kind === "judge")?.resource.sha256 ?? null,
  ```
  命令：`grep -rn "prebuilt" expert-squads/builtin/evolution-lab/ --include=*.ts` → 唯一命中就是 `comparison.ts:354` 那次判定；`grep -rn "ui_rubric_digest" packages/opencorvus/test packages/opencorvus/script --include=*.ts` → 6 处，全部 `ui_rubric_digest: null`（测试为规避此路径而写）。
- **耦合等级/违反原则**：内容耦合——comparison.ts 依据一个字符串枚举值判定 campaign 内部表示，而该值的产生者（publish 工具）与消费者之间没有类型约束，"开关"（`ui_rubric_digest !== null`）与"被开关的东西"（视觉 scorer 是否存在）来自两个不相关的字段。
- **后果**：经 `publish-evolution-artifact` 发布的 campaign，只要有一个 judge scorer，`ui_rubric_digest !== null` → 走 `visualScorerIDs.size === 0` 分支 → `visual_review.status === "unavailable"` → 晋升判定强制 `"inconclusive"`（`comparison.ts:376-380`）→ `evolution-mutation.ts:161` 拒绝晋升。带 judge scorer 的 campaign **无法晋升**，且失败原因显示为"视觉复核不可用"，指向一个从未被要求提供的 scorer 类型。技能文档 `expert-squads/builtin/evolution-lab/skills/campaign/references/scorer-contract.json:37-40` 仍在向 planner 承诺 `prebuilt` 是合法契约。
- **删除方向**：让 `visualScorerIDs` 与 `ui_rubric_digest` 从同一个来源派生——要么给 `CampaignScorerAssetSchema` 加 prebuilt 分支，要么 `ui_rubric_digest` 只在存在 prebuilt 视觉 scorer 时非 null。

#### ARCH-C-4 候选包"哪些字段允许改"的安全不变式只写在 agent 提示词的自然语言里，代码完全不校验

- **位置**：`expert-squads/builtin/evolution-lab/agents/evolution-candidate-author/system.md:1`（自然语言清单）对照 `expert-squads/builtin/evolution-lab/lib/evolution-lab/candidate-integrity.ts:59-63, 77-131, 139`（唯一的结构校验）。
- **事实**：
  prompt 原文：*"Every other manifest field is frozen — never change a tool id, any `*_refs` entry, `base_role`, a prompt path, an agent or workflow key, or a `depends_on` edge, because those grant capability or define topology rather than steer behavior."*
  代码侧 `frozenManifest`（`:59-63`）算出的差异只喂给一个布尔：
  ```ts
  const manifestDescriptorChanged = frozenManifest(parent.manifest) !== frozenManifest(candidate.manifest)  // :139
  if (changedPaths.length === 1 && !manifestDescriptorChanged)
    throw new Error("Candidate revision must change at least one mutable text path or declared manifest field")
  ```
  `assertCandidateStructure`（`:77-131`）只做三件事：prompt 路径存在、workflow node 的 `agent_id`/`depends_on` 可解析、无依赖环。文件自己的注释承认这是刻意的：*"T2–T4 make capability grants, topology and the agent set mutable, so the candidate can no longer be validated by byte-equality against its parent."*
  命令：`grep -n "tool\|_refs\|base_role" expert-squads/builtin/evolution-lab/lib/evolution-lab/candidate-integrity.ts` → 无一处校验 tool id / `*_refs` / `base_role`。
- **耦合等级/违反原则**：控制耦合的极端形态——判定规则从代码迁移到提示词文本，宿主与"闸门"之间只剩自然语言约定；违反"不变式应由类型或校验器承载"（框架设计原则 7）。
- **后果**：一个候选包若修改 `*_refs`（能力授予）或 `depends_on`（拓扑），`compareCandidateIntegrity` 会通过、发布器（ARCH-C-2）会通过、`evolution-mutation.ts` 会安装。唯一的阻挡是候选作者 agent 自己遵守 prompt 文本。
- **删除方向**：把"可变字段清单"做成 `candidateMutableManifestFields()` 白名单函数，`compareCandidateIntegrity` 对清单外的 manifest 差异抛错；prompt 里的清单随之可删（不再是唯一权威）。

#### ARCH-C-5 `processInvocation` 是 7 个位置参数（6 个可选）的巨函数；"是否终态会话"这一个参数的存在性驱动 5 处相隔数百行的内部分支——ARCH-C-1 的结构性根因

- **位置**：`packages/opencorvus/src/orchestrator/agent.ts:508-527`（签名）、`:474-484`（`process` 入口传 `undefined` 占位）、`:486-506`（`processTerminalConversation` 入口传实值）、分支落点 `:596, :671, :836, :1122`。
- **事实**：
  ```ts
  async function processInvocation(
    taskID: string, event?: OrchestratorEvent, wakeSignal?: AbortSignal,
    terminalConversationAuthority?: TerminalConversationAuthority,
    wakeID?: string, activationID?: string, predecessorID?: string,
  ): Promise<string | undefined> {
    const task = requireTask(taskID)
    const terminalConversation = terminalConversationAuthority !== undefined   // :520
  ```
  该布尔量随后驱动工具表投影（`:596`，即 ARCH-C-1 的入口）、prompt 分支（`:671`）、循环次数（`:836` `runOnce: terminalConversation || !appendCreatorMessage`）、错误传播策略（`:1122` `if (terminalConversation) throw error`）。命令：`rg -n "\bterminalConversation\b" packages/opencorvus/src/orchestrator/agent.ts` → 6 处，跨度 600 行。
- **耦合等级/违反原则**：控制耦合（教科书形态：可选参数的**存在性**改变被调方多处内部判定）+ 上帝签名（7 个位置参数，位置错配无编译期保护）。
- **后果**：终态会话与常规唤醒共用一条 600+ 行函数体，两种模式的差异散落在 5 个相隔数百行的 `if` 里——ARCH-C-1 的真实故障正是这种"没人能在一处看到全貌"的直接产物。
- **删除方向**：拆成 `runSchedulerWake(...)` 与 `runTerminalConversation(...)` 两个函数；共享步骤下沉为不带模式参数的工具函数。

#### ARCH-C-6 三个判定/授权函数绕过 Session / artifact-catalog 的域 API，直接拼 SQL 或裸取 `EngineArtifactRow` 读取其他模块的内部存储表示

- **位置**：`packages/opencorvus/src/work-artifact/validation-authority.ts:20-60`、`packages/opencorvus/src/expert-squad/mutation-authorization.ts:39-99`、`packages/opencorvus/src/acceptance/visual-feedback-verification.ts:136-163, 184-216, 249-264`；反证 `packages/opencorvus/src/work-artifact/packaged-acceptance.ts:71-76`。
- **事实**：
  `validation-authority.ts:25-39` 直接 `import { MessageTable, ToolPartRequestTable as PartTable, ToolPartOutcomeTable } from "@/session/session.sql"`，对其 `data` 列的 JSON 内部键做字符串比较：
  ```ts
  sql`json_extract(${PartTable.data}, '$.type') = 'tool-request'`,
  sql`json_extract(${PartTable.data}, '$.tool') = 'work_artifact_validate'`,
  sql`json_extract(${ToolPartOutcomeTable.data}, '$.outcome') = 'completed'`,
  ```
  工具 id `'work_artifact_validate'` 硬编码在 SQL 字符串里，与 `work-artifact/profile-registry.ts` 的常量无任何类型联系。**反证**：验收脚本 `packaged-acceptance.ts:71-76` 必须手工 `Session.updatePart({...})` 插入一条形状匹配的行，才能让 `requireWorkArtifactValidationAuthority` 通过——调用方为了通过判定，必须去写被判定方所查询的存储行。
  `mutation-authorization.ts:39-99` 是同一模式的第二个实例：直接 `import { MessageTable, PartTable, SessionTable } from "@/session/session.sql"`，`db.select(...).from(MessageTable)...`，再手工 `Message.User.safeParse({...facts.message.data, ...})` / `Message.TextPart.safeParse(...)` 重新解码。
  同一条 acceptance 链路里，`visual-feedback-verification.ts:184` 对"在某 session 里找一条消息"用的是正确的域 API `Session.messages({ sessionID })`，但紧接着 `:194-216` 仍手工下钻 `judgmentPart.state.input as Record<string, unknown>` 做无类型字段访问；对 artifact 侧，`:136-163` 与 `:249-264` 拿到裸 `EngineArtifactRow` 后直接读 `row.kind`/`row.payload`/`row.task_id`，并把裸行原样传给 browser-preview 的 `readBrowserPreviewEvidenceByRow({ row })`——三个模块的内部存储表示在这一个判定函数里被依次拆开。
- **耦合等级/违反原则**：内容耦合（最坏一级）——判定函数直接读/依赖另一模块的持久化内部形状而非其公开契约。同一条判定链路里，"找到某条具体消息/工具调用"这个等价操作在不同文件里有两种耦合程度不同的实现。
- **后果**：session 侧改 part 的 JSON 布局（字段移位、结构调整）会静默让全部交付判定失败，报错指向 receipt 而非 session schema；`packaged-acceptance.ts` 里的伪造行是永久技术债，因为它是唯一能满足该查询的方式；`judgmentPart.state.input` 字段改名不报错，只会让 `judgmentInput?.accepted` 变成 `undefined` 从而产生一条假失败。
- **删除方向**：让 validate 工具返回自带宿主签名的 receipt，deliver 只验证签名；`mutation-authorization.ts` 与 `visual-feedback-verification.ts` 改用 `Session.messages()` 等既有域 API 完成等价查询，删除全部 `session.sql` 直接 import。

---

### P1 — 控制/内容/时序耦合，判定结果可被静默扭曲或链路脆弱

#### ARCH-C-7 browser-preview 证据持久化的唯一入口用 `operationKind` 字符串标记驱动 4 套互不相关的校验分支，载荷类型是 `unknown`

- **位置**：`packages/opencorvus/src/browser-preview/persist.ts:760-776`（入参类型）、`:853-884`（分支校验）；4 个调用点 `verification-core.ts:227`、`region-comparison.ts:380`、`scroll-slice-comparison.ts:294`、`layout-geometry-diagnostic.ts:435`。
- **事实**：
  ```ts
  export type PersistBrowserPreviewEvidenceInput = {
    operationKind: "preview-capture" | "reference-comparison" | "scroll-slice-comparison" | "layout-geometry"
    capture?: unknown
    ...
  }
  ```
  被调方按 `operationKind` 选 schema、选校验规则：`if (operationKind === "reference-comparison" && status === "passed") {...}`（额外要求 `cropIntent` + 3 个 artifact 角色）；`if (operationKind === "scroll-slice-comparison" && status === "passed") {...}`（另一组必需 artifact）。`PersistedBrowserPreviewEvidence`（`persist.ts:292-341`）本身已经是 6 分支 discriminated union，写入侧却没有享受到这个类型——用的是 `capture?: unknown` + 运行期 if 链。
- **耦合等级/违反原则**：控制耦合 + 印记耦合。调用方传的不是数据而是"走哪条校验分支"的开关；`capture: unknown` 让编译期无法阻止 `operationKind:"reference-comparison"` 配一个 scroll-slice 形状的 capture。
- **后果**：一个函数同时是 4 种证据的持久化器 + 4 套准入规则；新增一种 operation 必须改这个共享函数；调用点写错标记，编译器静默通过，只在 zod parse 时才炸。
- **删除方向**：拆成按 operation 分裂的 4 个窄入口，各自入参是已判别的具体 capture 类型。

#### ARCH-C-8 scheduler 用裸 `json_extract` 字面路径直读 session 模块的 Message JSON 内部表示，且同一字段存在两套互不相同的解码器

- **位置**：`packages/opencorvus/src/scheduler/event-service.ts:862-864, 466-470`、`packages/opencorvus/src/scheduler/automation-service.ts:915-921`；写入方 `packages/opencorvus/src/session/wake.ts:149-150`。
- **事实**：写入方是唯一的编码 API：
  ```ts
  export function reasonExtra(reason: WakeReason): { wake_reason: WakeReason } {
    return { wake_reason: WakeReason.parse(reason) }
  }
  ```
  读取方绕过它，把路径写成 SQL 字符串（`event-service.ts:862-864`）：
  ```ts
  sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.source') = 'scheduler.event'`,
  sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.fireID') = ${fire.id}`,
  ```
  同一份 `wake_reason` 在两个文件里用两种方式解码：`event-service.ts:466-470` 走 `SessionWake.WakeReason.safeParse(extra?.wake_reason)`；`automation-service.ts:915-921` 走裸 record 走查 + 前缀匹配 `source.startsWith("scheduler.")`。命令：`rg -n "wake_reason" packages/opencorvus/src --glob '!**/*.test.ts'` → 27 处，其中字面 `json_extract` 路径 5 处在 scheduler、7 处在 `src/storage/db.ts:455-503`。
- **耦合等级/违反原则**：内容耦合（最强一档）。
- **后果**：`WakeReason` 任一字段改名/改嵌套，编译期全绿，运行期 `json_extract` 返回 NULL → 唤醒消息被判定"不存在"而非报错；两套解码器还意味着 `startsWith("scheduler.")` 会把未来任何新增的 `scheduler.*` source 一并错误吞掉。
- **删除方向**：把"给定 fire 找它的唤醒消息"做成 `session/wake` 的一个导出查询，scheduler 侧删掉全部 5 处 `json_extract` 字面量和手写前缀匹配。

#### ARCH-C-9 投影函数在同名字段 `id` 上互换 revision id 与 definition id；同一批投影函数把关键时钟做成可选尾参，18 处调用 11 处不传

- **位置**：`packages/opencorvus/src/scheduler/automation-projection.ts:69-73`、`packages/opencorvus/src/scheduler/event-projection.ts:28, 66, 100-113`；受害调用点 `automation-service.ts:730-733, 756-759`。
- **事实**：
  ```ts
  // automation-projection.ts:69-73 / event-projection.ts:110-114（两文件同构）
  return { ...row, id: row.definition_id, revision_id: row.id, ... }
  ```
  消费点必须手工反解（`automation-service.ts:730-733`，出现两次）：
  ```ts
  const latest = latestAutomationDefinitionInTransaction(db, row.id)
  if (!latest || latest.id !== row.revision_id) return []
  ```
  `latest.id`（原始表行）与 `row.revision_id`（投影行）才是同一语义，而 `latest.id` 与 `row.id` 名字相同、含义相反。
  同一文件里，`projectEventFireInTransaction(db, row, now = Date.now())`（`event-projection.ts:28`）的 `now` 是唯一决定 `status`（pending/running/retry_wait/succeeded）的量（`:66`），但嵌套调用点 `projectEventJobInTransaction`（`:102`）调用时**不传**：`.map((fire) => projectEventFireInTransaction(db, fire))`。命令：`rg -n "projectEventFireInTransaction" packages/opencorvus/src --glob '!**/*.test.ts'` → 18 处，显式传 `now` 的仅 7 处，其余 11 处落到默认 `Date.now()`。
- **耦合等级/违反原则**：内容耦合（id 语义互换，类型上无法区分）+ 时序耦合（同一事务内多次投影得到不同"现在"，未被类型强制）。
- **后果**：把原始行误当投影行（或反之）会静默寻址到错误实体；同一次事务内，进程结算门与恢复路径可能对同一个 fire 用不同时刻算出不同 status，租约刚好在两次投影之间过期时两处意见不一致。
- **删除方向**：两类 id 各自命名为 `definition_id`/`revision_id`（不复用 `id`）；`now` 从可选尾参提升为必填首参，或由事务本身携带一个冻结时刻。

#### ARCH-C-10 `ProjectMemory` 绕过 `Memory` 的公开写入 API 直写同一张表，且不同步 FTS 索引；"受保护 kind"的策略被复制成两份

- **位置**：`packages/opencorvus/src/memory/project-memory.ts:256-282, 292-302, 498-524`；对照写者 `packages/opencorvus/src/memory/index.ts:95-97, 353-406, 722-724`。
- **事实**：`Memory` 每次写入都同步 FTS（`index.ts:95-97` `ftsInsert`）。`ProjectMemory` 完全不经过 `Memory`，自己 `db.insert(MemoryChunkTable)`，把 `DocumentEnvelope` 的 JSON 字符串塞进 `content` 文本列（`:255` `JSON.stringify(envelope)`）。命令：`rg -c "memory_fts" packages/opencorvus/src/memory/project-memory.ts` → **0**。策略复制：`index.ts:722-724` 用一个私有谓词 `isProtectedProjectMemoryKind` 兜底"哪些 kind 不该被搜到"，同一组字面量在 `project-memory.ts:202` 的 `assertFileOwnership` 里再次出现。
- **耦合等级/违反原则**：内容耦合（绕过模块公开 API 直接操作其存储表示）+ 策略复制。
- **后果**：`memory_chunk.content` 的语义分裂为"散文（进 FTS）"与"JSON 信封（不进 FTS）"；`storage/mysql-transfer.ts:586-587` 的重建语句无条件把 JSON 信封也灌进 FTS——迁移/重建后 FTS 中的 chunk 集合与正常运行时不一致。
- **删除方向**：项目 MEMORY.MD 信封移到自己的表，或让 `Memory` 暴露一个统一决定进不进 FTS 的写入口，删掉 `isProtectedProjectMemoryKind` 这类事后过滤。

#### ARCH-C-11 `CapabilityRules` 对同一个 Ruleset 有两套语义不同的判定实现，同一个文件里两条判定路径各用一条、结论矛盾

- **位置**：`packages/opencorvus/src/capability/rules.ts:68-84`；分歧现场 `packages/opencorvus/src/skill/eligibility.ts:20, 40`。
- **事实**：
  ```ts
  export function evaluate(permission, pattern, ...rulesets): Rule {
    const match = merge(...rulesets).findLast((rule) => matches(permission, pattern, rule))  // 同时匹配 permission 与 pattern
    return match ?? { action: "allow", permission, pattern: "*" }
  }
  const EDIT_TOOLS = new Set(["edit", "write", "patch", "multiedit"])
  export function disabled(tools, ruleset): Set<string> {
    const permission = EDIT_TOOLS.has(tool) ? "edit" : tool     // tool→permission 映射，只看 permission
    const rule = ruleset.findLast((candidate) => Wildcard.match(permission, candidate.permission))
    if (rule?.pattern === "*" && rule.action === "deny") result.add(tool)
  }
  ```
  `skill/eligibility.ts` 同一 46 行文件两处各用一条：`:20` 用 `disabled`（映射 `write`→`edit`），`:40` 用 `evaluate`（不映射，直接拿 `"write"` 去匹配 permission `"edit"`）。
- **耦合等级/违反原则**：同一决策的双实现（内容耦合）。
- **后果**：配置 `{ edit: "deny" }` 时，`session/llm.ts:292` 走 `disabled` → `write` 工具从模型工具表删除；而 `skill/eligibility.ts:40` 走 `evaluate("write","*")` → permission `"write"` 不匹配规则的 permission `"edit"` → **判定为未拒绝**。skill 的 `required_tools:["write"]` 因此被判定"可用"，但运行时该工具已不存在。
- **删除方向**：只留一个判定函数，把 `EDIT_TOOLS` 归一化提到规则构造期（`fromConfig`），不留在判定期。

#### ARCH-C-12 通用派发工具 `dispatch_agent` 硬编码两个具体适配器的私有字段名与私有分支

- **位置**：`packages/opencorvus/src/orchestrator/dispatch-agent-tool.ts:390-393, 416-418, 552-554, 609-622, 679-693`。
- **事实**：schema 层替 build 适配器抹掉一个私有字段（`:390-393` `dispatchAdapterID === "build" ? adapterInputSchema.omit({worktreeUsage:true}) : ...`），执行层又替 build 注射回去（`:612-618`）；Delivery Slice 主体靠对 `Record<string, unknown>` 猜字符串键取得（`:552-554, 609-611` `Object.hasOwn(executorTargetInput, "goal_ids")`）。命令：`rg -n '"build"|workload_analysis' dispatch-agent-tool.ts` → 5 处；`rg -n "goal_ids"` → 5 处。
- **耦合等级/违反原则**：内容耦合 + 控制耦合——通用派发器绕过 `DispatchAdapterContractRegistry` 的公开访问器，直接按字符串键读写某个适配器的输入内部表示。
- **后果**：任一适配器把 `goal_ids` 改名，lineage 里的 Delivery Slice 主体静默变成 `[]`，无 reason 无告警。
- **删除方向**：在 `DispatchAdapterContractRegistry` 上增加 `deliverySliceRevisionIDs(input)`、`applyWorktreeUsage(input, mode)` 两个契约方法，归零字符串分支。

#### ARCH-C-13 `manage_task` 用字符串名索引内部工具表，身份通道全程是 `unknown`，路由错误只在下游"持久化不匹配"处才暴露

- **位置**：`packages/opencorvus/src/orchestrator/tools.ts:2612-2625`；`packages/opencorvus/src/orchestrator/tool-execution-context.ts:28-46, 48-70, 127-131`。
- **事实**：
  ```ts
  const actionTool = (tools as Record<string, {execute?: (args: unknown, options: unknown) => Promise<unknown>}>)[action]
  const result = await actionTool.execute(actionInput, optionsWithVisibleOrchestratorToolName(options, "manage_task"))
  ```
  身份通道签名：`optionsWithVisibleOrchestratorToolName(options: unknown, visibleToolName: string): unknown`；消费端靠对 `unknown` 逐个探字符串键（`:52-57`）。忘了包装不报错，只是静默回落到内部名，随后在完全不同的位置（`:127-131`）以另一条消息炸掉：`part.tool !== toolExecution.visibleToolName` → throw。
- **耦合等级/违反原则**：控制耦合（`action` 字符串驱动完全不同分支）+ 内容耦合（跨模块传递的审计身份靠 `unknown` 侧带 bag）。
- **后果**：路由错误暴露的位置与真实原因（忘了包装 options）相隔多层调用；完成决策 Artifact 里记录的可见工具名来自一个未类型化的 bag。
- **删除方向**：把 `opencorvus` 元数据提升为具名类型 `OrchestratorToolInvocation`，删除静默回落。

#### ARCH-C-14 orchestrator 错误信封是只写协议：序列化端在跑，解析端全仓库零调用

- **位置**：`packages/opencorvus/src/orchestrator/error-envelope.ts:9-31`；写入方 `packages/opencorvus/src/orchestrator/agent.ts:119-131`。
- **事实**（本文作者独立验证，与并行子审计结论一致）：
  ```ts
  function serializeOrchestratorTaskError(error: unknown) {
    const envelope = ...
    return { envelope, message, taskError: `Orchestrator error: ${message}${MARKER}${JSON.stringify(envelope)}` }
  }
  ```
  `envelope`（结构化对象）与 `taskError`（字符串，内嵌同一份数据）被同时返回；`taskError` 经 `agent.ts:264, 313` 写入持久化的 `error` 字段。命令：`grep -rn "parseOrchestratorTaskErrorEnvelope(" packages/opencorvus/src packages/opencorvus/test --include=*.ts` → **仅 1 处命中，就是它自己的定义**，全仓库零调用者。
- **耦合等级/违反原则**：标记耦合（write 端把结构塞进一个魔法分隔符字符串）+ 死协议（浅模块宽接口的极端形态：23 行解析逻辑 0 行为）。
- **后果**：每条失败任务持久化的 `error` 字段里都带一段面向用户可见、却无人解析的 JSON 尾巴；结构化 `envelope` 明明已经通过返回值直接可用，字符串内嵌纯属重复且从未被消费。
- **删除方向**：删除 `parseOrchestratorTaskErrorEnvelope` 与 marker 拼接，`task.error` 只保留人类可读文本。

#### ARCH-C-15 `TaskWakeRuntime` 间接层没有断开它声称要断开的依赖，还把三值结果两次压成两值、又抹掉一个参数

- **位置**：`packages/opencorvus/src/scheduler/task-wake-runtime.ts:5-16`、`packages/opencorvus/src/scheduler/task-wake-composition.ts:6-13`、`packages/opencorvus/src/scheduler/automation-service.ts:19, 778`；真实签名 `packages/opencorvus/src/engine/task-root-ingress-delivery.ts:1725, 1831-1834`。
- **事实**（本文作者独立验证，与并行子审计一致）：
  ```ts
  // task-wake-composition.ts:6-13
  dispatchTaskLoop: async (input) => {
    const result = await (await import("@/engine/task-root-ingress-delivery")).dispatchTaskLoop(input)
    // ...treating it as accepted keeps the scheduler's contract two-valued if that ever changes.
    return result === "ignored" ? "ignored" : "accepted"
  },
  ```
  真实返回类型是三值：`export type DispatchTaskLoopResult = "accepted" | "ignored" | "suppressed_budget_exhausted"`（`task-root-ingress-delivery.ts:1725`），接口把它压成两值，`suppressed_budget_exhausted` 被映射成 `"accepted"`。但 `automation-service.ts:19` 已经**静态** `import { persistTaskWaitIngressInTransaction } from "@/engine/task-root-ingress-delivery"`——间接层意在切断的静态依赖已经存在于同一模块的另一处。接口本身在 `dispatchPersistedTaskLoop` 上还抹掉了一个可选参数 `expectedWakeID?`（真实签名 `task-root-ingress-delivery.ts:1831-1834` 有，接口声明 `task-wake-runtime.ts:15` 没有）。`automation-service.ts:778` 最终又把结果放宽回裸 `string`。本文作者已核实：`configureTaskWakeRuntime` 与 `requireTaskWakeRuntime` 之间是"先 install 后 require"的模块级单例，未被类型强制（`requireTaskWakeRuntime()` 在未配置时运行期抛错）。
- **耦合等级/违反原则**：时序耦合（install→require 未被类型强制）+ 返回值形态逐级失真（三值→二值→裸 string）。
- **后果**：间接层唯一的收益（切断 scheduler→engine 静态依赖）已被同文件另一处的静态 import 抵消；budget 抑制的派发在 scheduler 眼里等同成功，scheduler 会把该 wait 当作已交付并写 tombstone。
- **删除方向**：删除 `task-wake-runtime.ts` + `task-wake-composition.ts`（共 48 行），改为直接调用，让 `DispatchTaskLoopResult` 的三值原样穿透。

#### ARCH-C-16 5 个 stage 派发器把一个已有的强类型上下文拆平成 13 个裸字段，13 处调用方各自重装一遍

- **位置**：`packages/opencorvus/src/orchestrator/architect-stage.ts:67-81`、`visual-qa-stage.ts:24-41`、`deep-research-stage.ts:23-39`、`frontend-research-stage.ts:25-41`、`requirements-stage.ts:23-37`；装配点 `orchestrator/tools.ts:1140-1156, 1187-1204, 1249-1268, 1341-1360, 1370-1389`；被绕过的既有类型 `dispatch-adapter-execution-context.ts:6-16`。
- **事实**：`DispatchAdapterExecutionContext`（`agentID / projectedAgent / workScope / newSessionID / existingSessionID / dispatch / toolOptions`）已经存在且冻结，但没有一个 stage 接受它。5 个 stage 的入参各自声明 13 个字段的裸对象，13 个调用点各自机械重复同一段字段搬运（如 `tools.ts:1147-1156`：`agentID: execution.agentID, packageRevision: execution.projectedAgent.packageRevision, ...`）。命令：`rg -n "requireDispatchAdapterExecutionContext\(" packages/opencorvus/src` → 13 个生产调用点；`rg -n "dispatchAdapterContinuationPrompt\("` → 13 个生产调用点。
- **耦合等级/违反原则**：扇入失衡 + 浅模块宽接口。
- **后果**：给 stage 加一个新的派发事实是 18 处机械修改；漏改一处只在运行时表现为 `undefined`。
- **删除方向**：5 个 stage 的入参改为 `{ execution: DispatchAdapterExecutionContext; toolInput }`，删掉 9 个转发字段。

#### ARCH-C-17 orchestrator 五个"派发专家阶段并持久化其结论"的调用点，只有 2 个复用了已有的 best-effort 持久化助手，另外 3 个各自手写 30~40 行同构逻辑；被复用的那个助手内部又用一个未被类型联系的旗标切换结果种类

- **位置**：共享助手 `packages/opencorvus/src/orchestrator/research-persistence.ts:36-59`（`persistResearchArtifactBestEffort`），复用者 `deep-research-stage.ts:72-114`、`frontend-research-stage.ts:77-127`；手写重复者 `architect-stage.ts:386-464`、`visual-qa-stage.ts:92-142`、`integrity-review-stage.ts:86-140`。
- **事实**：
  `persistResearchArtifactBestEffort` 签名：
  ```ts
  export function persistResearchArtifactBestEffort(input: {
    taskID: string; dispatchID: string
    component: "deep-research" | "frontend-research"
    operation: "persist-research-brief" | "persist-partial-research-brief"
    delivery: "complete" | "incomplete"
    sessionID: string; finalMessageID: string
    persist: () => string
    recordInfrastructure?: typeof recordTaskInfrastructureErrorBestEffort
  }): DispatchOutcomeResult
  ```
  `delivery` 决定返回 `DispatchOutcome.domainIncomplete(...)` 还是 `DispatchOutcome.terminal(...)`，但类型上没有任何东西阻止调用方把 `delivery:"complete"` 配上一个实际是"partial"的 `persist` 闭包——`delivery` 与 `persist` 的一致性完全靠调用方手工保证（本文作者核实 `deep-research-stage.ts:75-91` 两处调用确实各自手工维护这个三元组）。
  与此同时，`architect-stage.ts:439-463`、`visual-qa-stage.ts:117-141`、`integrity-review-stage.ts:109-135` 三处**没有使用这个共享助手**，各自手写几乎同构的 try/catch + `recordTaskInfrastructureErrorBestEffort` + `DispatchOutcome.partial(...)` 构造（比对 `architect-stage.ts:439-457` 与 `visual-qa-stage.ts:117-135`，两段的字段名、调用顺序、日志结构逐行对应）。命令：`grep -n "recordTaskInfrastructureErrorBestEffort" packages/opencorvus/src/orchestrator/*.ts` → 命中 `analyze-intent-tool.ts, architect-stage.ts, fact-check-tool.ts, frontend-design-tool.ts, infrastructure-observation.ts, integrity-review-stage.ts, requirements-stage.ts, research-persistence.ts, visual-qa-stage.ts, workload-analysis-tool.ts` 共 10 个文件；其中只有 `research-persistence.ts` 把它包进了可复用助手，另外 6 个文件各自内联调用。
- **耦合等级/违反原则**：控制耦合（`delivery` 旗标与 `persist` 闭包语义无类型联系）+ 违反"一个概念一处实现"（框架设计原则 4）——同一个"持久化专家阶段结论，失败则降级为 partial"概念在 5 个对等的调用点里有两种耦合程度不同的实现。
- **后果**：`delivery` 与 `persist` 配错时，结果从 `terminal` 静默变成 `domain_incomplete`（或反之），直接影响调度器对后继节点的开闸判定，且没有测试能捕获，因为两条分支的入参形状完全相同；3 个手写重复点意味着未来给"持久化失败后如何降级"这条规则打补丁，需要同步改 4 个文件（含共享助手）而非 1 个。
- **删除方向**：把 `delivery` 拆成两个不带旗标的函数 `persistCompleteResult` / `persistPartialResult`，各自内联 `persist` 调用；让 `architect-stage.ts`、`visual-qa-stage.ts`、`integrity-review-stage.ts` 改用这两个函数而非手写复制。

#### ARCH-C-18 `Scheduler.register` 用一个可选 `scope` 字符串切换两套完全不同的注册语义：重复注册在 global 下静默 no-op，在 instance 下悄悄替换

- **位置**：`packages/opencorvus/src/scheduler/index.ts:82-97`。
- **事实**：
  ```ts
  export function register(task: Task) {
    const scope = task.scope ?? "instance"
    if (scope === "global" && globalSettlementGate) { throw new Error(...) }
    const entry = scope === "global" ? shared : state()
    if (scope === "instance") entry.runtime ??= InstanceLifecycleContext.use()
    const current = entry.timers.get(task.id)
    if (current && scope === "global") return          // global：静默保留旧的
    if (current) clearInterval(current)                 // instance：换成新的
    install(entry, task, task.runAtStart)
  }
  ```
  同一个 `scope` 值在 5 行内改变 4 个不同分支：结算门检查、entry 选择、runtime 绑定、重复注册处理。`Task.scope` 可选，默认 `"instance"`。
- **耦合等级/违反原则**：控制耦合（教科书形态：调用方传一个 flag 改变被调方多处内部判定分支）。
- **后果**：同 id 重复注册在 global 下是"保留旧的"、在 instance 下是"替换成新的"，调用方看签名无法判断自己写的是哪一种，写错时定时器悄悄指向旧闭包（或新闭包），没有任何报错。
- **删除方向**：拆成 `registerGlobal` / `registerInstance` 两个导出，`Task` 类型删掉 `scope`。

#### ARCH-C-19 `BrowserPreviewVerificationCaptureJobInput` 声明 9 个字段，唯一实现只转发 7 个，被调方又自己回库把丢掉的 2 个重新查一遍

- **位置**：`packages/opencorvus/src/browser-preview/verification-core.ts:67-77`（入参类型）；`verification.ts:18-35`（唯一实现丢字段）；`evidence-runner.ts:282, 301, 315`（重查）；同型问题见 `region-comparison.ts:206`（查询结果被丢弃，只当存在性检查）。
- **事实**：`verification-core.ts:166-176` 组装时塞了 `url` 和 `viewports`，但唯一生产实现 `verification.ts:21-29` 转发时只保留 7 个字段，**丢弃 `url` 和 `viewports`**；`evidence-runner.ts:282, 301, 315` 于是自己 `findBrowserPreviewTargetByID(...)` 重查一遍再取 `target.viewports`、`target.url`。命令：`grep -rn "findBrowserPreviewTargetByID" --include=*.ts packages/` → 20 处命中（9 个独立调用点）。
- **耦合等级/违反原则**：印记耦合（上帝入参传大对象再被丢弃）+ 隐式时序耦合（两次读取必须看到同一行，类型系统不保证，也没有任何东西把两次读关联起来）。
- **后果**：每次 preview 校验和每次 region 对比都多做一次 target 查询；`url`/`viewports` 存在两个真相来源，若持久化行在两次读之间被 `promoteBrowserPreviewTarget` 改写，判定用的 URL 与证据清单记的 URL 可能不一致，且没有任何断言会发现。
- **删除方向**：由一处解析出 `PersistedBrowserPreviewTarget` 作为唯一入参往下传，`CaptureJobInput` 去掉 `url`/`viewports` 或去掉 `targetID`，二选一不并存。

#### ARCH-C-20 判定入参携带 6 个从不被读的字段，其中 2 个还是必填——工具调用方（LLM）必须凭空编造

- **位置**：`packages/opencorvus/src/browser-preview/region-schema.ts:33-58`（`BrowserPreviewRegionBinding`，14 个叶子字段）；暴露面 `tool/browser-preview-compare-reference-regions.ts:15`。
- **事实**：判定链路（`compareBrowserPreviewRegions` + `runBrowserPreviewRegionComparisonCapture`）实际只读 8/14 字段（`region_id`、`viewport_id`、`state_id`、`crop_intent`、`source.reference_artifact`、`source.bbox`、`implementation.route`、`implementation.locator`）。从不被读的 6 个里，`region_scope`（`:38`）与 `source.semantic_role`（`:44`）是**必填、无 default**。命令逐字段核实：`grep -rn "\bsemantic_role\b" packages/opencorvus/src/` → 0 命中；`grep -rn "\bacceptance_refs\b" packages/opencorvus/src/` → 0 命中。该 schema 被原样当作工具参数（`BrowserPreviewCompareReferenceRegionsToolParameters = BrowserPreviewRegionComparisonRequest`）。
- **耦合等级/违反原则**：上帝入参——判定函数吃的是上游 frontend-design 模块完整 binding 记录的原始 schema，而不是它真正需要的最小几何+定位数据。
- **后果**：模型每次调用都必须为 `region_scope`、`semantic_role` 两个零作用字段编造值，填错不影响判定却增加调用失败率；读代码的人无法从 schema 判断哪些字段真正参与判定。
- **删除方向**：判定入参收窄为 8 个真正被读的字段，其余留在 frontend-design 自己的 binding 清单里。

#### ARCH-C-21 `visual-feedback-verification` 的 37 道判定 issue 被压平成无结构 `string[]`，唯一消费者 `metrics/executor.ts` 再把它压成裸 0/1

- **位置**：`packages/opencorvus/src/acceptance/visual-feedback-verification.ts:123-126, 314`；消费方 `packages/opencorvus/src/metrics/executor.ts:559-566`。
- **事实**：
  ```ts
  export async function validateVisualFeedbackVerification(input): Promise<{ passing: boolean; issues: string[]; summaries: string[] }>
  ...
  return { passing: issues.length === 0, issues, summaries }   // :314
  ```
  命令：`grep -c "issues.push" packages/opencorvus/src/acceptance/visual-feedback-verification.ts` → **37**。37 个语义完全不同的失败原因（taskID 不匹配、artifact kind 错、review 未 accepted、judgment 三段身份不符、digest 被篡改、region 未覆盖、blank crop……）全部退化为字符串数组，`passing` 只是 `issues.length === 0`。唯一消费者再压一次：`metrics/executor.ts:562` `return measured(issues.length > 0 ? 0 : 1, {...})`。
- **耦合等级/违反原则**：返回值形态退化（结构化诊断 → 裸 string[] → 裸 0/1）。
- **后果**：一条"region 覆盖不足"和一条"digest 被篡改"在最终指标上完全等价（都是 0）；上层无法区分"判定为不通过"与"输入不可用"，也无法定位失败究竟对应 37 道 gate 中的哪一道。
- **删除方向**：`issues` 改为 `Array<{ gate: GateID; severity: "blocking" | "evidence_missing"; detail: string }>`，让 `measured` 按 gate 类别决定 0 / unavailable。

#### ARCH-C-22 `executeProviderAction` 吃整个 11 成员的 `Tool.Context`，实际只用其中 1 个成员下的 3 个字段——而同一份代码里已有更窄的写法可以对照

- **位置**：`packages/opencorvus/src/capability/provider-action.ts:43-60`；宿主类型 `packages/opencorvus/src/tool/tool.ts:49-61`；对照惯例 `tool/tool.ts:63`。
- **事实**：
  ```ts
  export async function executeProviderAction<T>(input: {
    plan: ProviderActionPermissionPlan; context: Tool.Context; execute: () => Promise<T>
  }): Promise<T> {
    const projectedMcpToolRefs = input.context.executionSurface.harness_projection?.mcp_tool_refs ?? []
    ... input.context.executionSurface.toolIDs.includes(...)
    const agentRules = input.context.executionSurface.permission_layers?.agent
  ```
  `Tool.Context` 有 11 个成员（`sessionID / messageID / agent / abort / callID / extra / messages / executionAuthority / executionSurface / prompt / metadata`），函数体只触达其中 `executionSurface` 一个成员下的 3 个字段。使用/声明比 1/11。同一文件所在仓库已有正确惯例（`tool/tool.ts:63`）：`export function requireExecutionAuthority(ctx: Pick<Context, "executionAuthority">)`。命令：`grep -n --glob '!**/*.test.ts' -F "executeProviderAction" packages/opencorvus/src` → 定义 + **1 个调用点**。
- **耦合等级/违反原则**：宿主类型泄漏 + 扇入失衡（1 个调用点却吃全量宿主对象）。
- **后果**：任何想验证"这个 provider action 是否被投影/是否被 agent 规则拒绝"的地方，都必须先造出一个完整 `Tool.Context`（含 `messages`、`abort`、`metadata()` 回调），判定逻辑因此只能在工具执行路径里被调用和测试。
- **删除方向**：签名改为 `surface: Pick<ToolExecutionSurface, "toolIDs" | "harness_projection" | "permission_layers">`，与 `requireExecutionAuthority` 对齐。

---

### P2 — 死接口 / 浅模块宽接口 / 接口卫生

#### ARCH-C-23 `MemoryInjection.systemPromptSection` 声明的 `query` 入参 0 次使用，且被 `session/loop.ts` 两层透传、源头现场拼装 fallback 链

- **位置**：`packages/opencorvus/src/memory/injection.ts:20-25`（本文作者独立发现并验证，与并行子审计结论一致）；透传链 `packages/opencorvus/src/session/loop.ts:1387-1396, 1668-1673`。
- **事实**：
  ```ts
  export async function systemPromptSection(input: {
    projectID: string; sessionID: string; query: string; memoryToolAvailable: boolean
  }): Promise<string | null> {
  ```
  命令：`grep -n "input\." packages/opencorvus/src/memory/injection.ts` → 4 处命中：`input.sessionID`、`input.projectID`、`input.sessionID`、`input.memoryToolAvailable`。**`input.query` 0 处**。调用方仍在为它付代价（`loop.ts:1671`）：`query: memoryQuery || input.session.title || input.lastUser.id`——这条 fallback 链在 loop 里被维护，读代码的人会以为"注入是按最近消息检索的"，实际对输出零影响。
- **耦合等级/违反原则**：上帝入参（死参数形态）——接口宣称"按 query 检索注入"，实现其实是无条件读取 `ProjectMemory.read(projectID)`。
- **后果**：未来有人改这条 fallback 链去调整注入行为会完全无效，且无编译期或运行期信号提示。
- **删除方向**：删掉 `query`，连带删掉 `loop.ts` 里 `memoryQuery` 的 fallback 链和 `sessionStateContext` 的同名转发参数。

#### ARCH-C-24 空表驱动的"优化"：`STATEFUL_SNAPSHOT_TOOL_NAMES` 永久为空，却在 prompt 构建热路径上触发一次全量倒扫

- **位置**：`packages/opencorvus/src/orchestrator/stateful-tool-names.ts:27-36`；消费点 `packages/opencorvus/src/session/message.ts:1130-1149, 1353, 1385`。
- **事实**：
  ```ts
  export const STATEFUL_SNAPSHOT_TOOL_NAMES = [] as const
  export type StatefulSnapshotToolName = (typeof STATEFUL_SNAPSHOT_TOOL_NAMES)[number]   // = never
  export function statefulSnapshotToolKey(toolName: string, _input: unknown): string | undefined {
    if (STATEFUL_SNAPSHOT_TOOL_NAME_SET.has(toolName)) return toolName
    return undefined   // 恒成立
  }
  ```
  三个消费点仍照常对整段会话历史做双层倒序扫描（`message.ts:1130-1149`），两个 `Set` 永远为空，`:1354`/`:1386` 的"supersede"分支永远不可达。命令：`rg -n "statefulSnapshotToolKey|STATEFUL_SNAPSHOT_TOOL_NAMES" packages/opencorvus/src` → 7 处（含 `tools.ts:911` 的再导出）。
- **耦合等级/违反原则**：浅模块宽接口（3 个导出符号，行为为零）+ 接口撒谎（形参 `_input` 是接口的一部分却从不参与判定）。
- **后果**：每次 prompt 构建都为一个恒空结果做 O(消息数 × Part 数) 倒扫；三处死分支伪装成一套仍在生效的 token 优化机制。
- **删除方向**：整体删除 `stateful-tool-names.ts`、`tools.ts:911` 的再导出、`message.ts` 里对应的调用点与倒扫循环，需要时再重新引入。

#### ARCH-C-25 `acceptance/checks` 门面（barrel）10 个导出、0 个真实导入方；其自述的"唯一入口"契约被它唯一的消费者直接违反

- **位置**：`packages/opencorvus/src/acceptance/checks/index.ts:1-31`；实际消费点 `packages/opencorvus/src/task-api/index.ts:19`。
- **事实**：文件头注释自述：*"External callers import from `@/acceptance/checks` — never from sub-modules."* 命令：`grep -rn 'from "@/acceptance/checks"' --include=*.ts packages/opencorvus/` → **1 命中，就是这句注释本身**，零真实导入；`task-api/index.ts:19` 直接 `import { discoverChecks, resolveConfig, resolvedChecks } from "@/acceptance/checks/discovery"`，绕过 barrel 打子模块。barrel 的 10 个导出里 3 个是与本模块无关的纯转发（`export { runVisualDiff, ... } from "@/runtime/visual-page"`）。
- **耦合等级/违反原则**：Ousterhout 浅模块宽接口——接口面积 ≈ 0 实现，纯转发；未被工具链强制的模块边界约定。
- **后果**：barrel 制造了"这是一个内聚模块"的假象，实际是三个不相干模块的门面，唯一消费者已经用脚投票绕开了它。
- **删除方向**：删除 `checks/index.ts`，消费者已直连子模块，无需过渡。

#### ARCH-C-26 `stage-input-digest.ts` 与它的两个唯一消费者是一条完整的死代码链，消费者手抄了一份与真实类型无关的 13 字段结构

- **位置**：`packages/opencorvus/src/orchestrator/stage-input-digest.ts:3`；消费点 `orchestrator/tools.ts:222-227, 285-322`。
- **事实**：命令：`rg -n "stageInputDigest" /d/myhexin-local/opencorvus --glob '!**/node_modules/**' --glob '!**/dist/**'` → 仅 6 处命中，全部落在 `taskContinuationScope`（`tools.ts:222`，私有，0 调用方）与 `goalsContinuationScope`（`tools.ts:285`，**export，含测试在内 0 调用方**）内部。后者入参是手抄的 13 字段 GoalRow 结构，与真实 `GoalRow`（`engine/store.ts:90`）无类型联系，改 schema 不会报错。
- **耦合等级/违反原则**：浅模块宽接口（7 行文件、1 导出，接口面积=实现体积）+ 宿主类型手抄泄漏。
- **后果**：一套"stage 输入摘要"机制在维护清单里占位，读者会误以为它在生效；13 字段手抄结构是又一处会静默漂移的隐形复制。
- **删除方向**：删除 `stage-input-digest.ts`、`taskContinuationScope`、`goalsContinuationScope` 三处，共约 46 行。

#### ARCH-C-27 work-artifact 的两个 registry 是围绕单元素 Map 的浅模块宽接口，`presentation.ts` 30 个导出中过半只服务测试/脚本

- **位置**：`packages/opencorvus/src/work-artifact/profile-registry.ts:70-89`、`qualification-registry.ts:44-60`、`presentation.ts`（1368 行，30 个导出）。
- **事实**：`WorkArtifactProfileID`/`WorkArtifactQualificationID` 都是单成员字面量联合，`require(id)` 的参数只有一个合法取值、`.get(id)!` 的 `!` 恒成立。命令：`grep -rn --include=*.ts "ProfileRegistry.all()\|QualificationRegistry.all()\|ProfileRegistry.supports(" packages | grep -v "profile-registry.ts\|qualification-registry.ts"` → 空，`all()`/`supports()` 零外部调用者。`presentation.ts` 命令 `grep -oE '^export (async function|function|const|type|class) [A-Za-z_]+' presentation.ts | sort -u | wc -l` → 30；生产消费者只有 3 个文件（`tool/work-artifact.ts`、`presentation-inspector-process.ts`、`validation-authority.ts`），其余如 `renderWorkArtifactSvgToPng`、`prepareWorkArtifactRuntimeEnvironment`、`assertZeroWorkArtifactRuntimeIssueCount` 等仅被 `test/` 与 `script/` 引用。
- **耦合等级/违反原则**：Ousterhout 浅模块宽接口——为单一实例造通用注册表 API（扇入=1 却做成 registry），且为可测性把实现细节升格为模块契约。
- **后果**：每个新 profile/qualification 的加入要同步改 3 处（两个 registry + 生成的 qualification-matrix）；`presentation.ts` 的 30 个导出把 SVG 渲染、zip 解析、runtime env 组装等内部实现细节全部暴露为模块公开契约。
- **删除方向**：两个 registry 降为常量导出并删除零调用的 `all()`/`supports()`；`presentation.ts` 按 author / inspect / validate / runtime 四块拆分，测试专用导出改为从子模块直接引入。

#### ARCH-C-28 `evaluateVisual` 的进度回调形参零调用，且与文件自身的文档注释直接矛盾

- **位置**：`packages/opencorvus/src/verification/visual/evaluate.ts:129-138`。
- **事实**：
  ```ts
  export interface EvaluateVisualCtx {
    /** Opt-in progress hook — Phase 2 will wire this to `EngineProtocol.emit`. */
    emit?: (event: {...}) => void
  }
  export async function evaluateVisual(input: EvaluateInput, ctx?: EvaluateVisualCtx): Promise<EvaluationReport>
  ```
  命令：`grep -rn "EvaluateVisualCtx" --include=*.ts packages/` → 2 处，全在定义处，零调用方传入；函数体内 5 处 `ctx?.emit?.(...)` 恒为 no-op。文件头文档字符串自述："No chaining, no context, no side effects beyond reading the input files"——与 `ctx` 形参的存在直接矛盾。
- **耦合等级/违反原则**：接口面积虚增（为未实现的 Phase 2 预留的死参数）。
- **后果**：读者会误以为进度事件已接线；`ctx` 的存在让这个本应是"纯函数"的判定模块看起来带有副作用通道。
- **删除方向**：删除 `EvaluateVisualCtx`、`ctx` 形参与 5 处死调用。

---

### 总判（约 200 字）

判定链路的耦合病灶集中在两处几何形状：**跨层裁剪-校验对不齐**（ARCH-C-1、5：终态工具表两层各执一份真相，直接产生一个当前会实际抛错的路径）和**内容耦合绕过域 API**（ARCH-C-6、8、10：判定/授权函数直接拼 SQL 读另一模块的内部 JSON 列，而不是调用它已经存在的公开访问器，且往往同一条链路里既有正确用法又有绕过用法作为反例）。第三个反复出现的形状是**控制耦合旗标**（ARCH-C-2、7、12、13、17、18）——用一个字符串/布尔在共享函数内部切出互不相干的分支，而不是让类型系统承担分派。第四个是**判定结果的返回值形态坍缩**（ARCH-C-15、21）：结构化诊断在链路末端被压成裸 boolean/0-1，多道 gate 串联后失败不可归因。这些缺陷与已被记录的算法层反模式（数值标定）、宿主过度工程（锁/状态机）是三个独立维度，但共享同一个根因：判定逻辑被当作胶水代码写，而不是被当作需要窄接口、强类型边界、单一职责的独立算法模块。

---

### 最严重 3 条摘要

1. **ARCH-C-1**：终态会话的工具闸门分两层裁剪与校验，二者互不知晓，导致**每一次终态会话唤醒都会在建表阶段实际抛错**（`did not build that tool: artifact_select`）——本文作者端到端复现了从 `agent.ts` → `createOrchestratorTools` → `projectOrchestratorTools` → `TASK_ARTIFACT_SCHEDULER_TOOL_IDS` 的完整调用链，确认该路径无端到端测试覆盖。
2. **ARCH-C-2**：`publish-evolution-artifact.ts` 的 `execute()` 是 568 行、23 处 `artifact_type ===` 分支的控制耦合巨函数，是进化晋升链路（campaign→candidate→评测→对照→晋升）**唯一的发布闸门**；ARCH-C-3 进一步证明它与判定侧 `comparison.ts` 之间存在结构性断裂——带 judge scorer 的 campaign 永久无法晋升。
3. **ARCH-C-4**：候选包"哪些字段允许自我修改"这一安全不变式**只写在 agent 提示词的自然语言里**，`candidate-integrity.ts` 的结构校验明确不检查 tool id / `*_refs` / `depends_on`——晋升链路的安全边界目前由模型自律维护，而非代码强制。

## 维度 D · 可扩展性与开闭原则


> 只读审计，未修改任何源码。范围：判定单元的可扩展性——新增一个 scorer / 检查项 / 匹配策略 / 阈值来源，需要改几处核心代码。与 `docs/algorithm-layer-antipatterns.md`（判定数值对不对）互补，不重叠。
> 仓库：`D:\myhexin-local\opencorvus`，分支 `v0.0.46beta`。生成：2026-08-18。

---

### 思想实验一：新增一个 evolution-lab scorer

**结论：不是注册表驱动，是三层平行硬编码 schema + 一个 switch。最少要动 4 个文件、跨 2 个包。**

evolution-lab 的评分器有两条完全独立的路径，彼此不共享类型定义：

**A. 运行时执行层**（`packages/plugin/src/metric-evaluation.ts` + `packages/opencorvus/src/metrics/executor.ts`）
`evaluator_kind` 是 5 个字面量的判别联合：`shell | judge | prebuilt | query | aggregator`（`packages/plugin/src/metric-evaluation.ts:96-121`）。执行侧用 switch 分发：

```
packages/opencorvus/src/metrics/executor.ts:229
  switch (spec.evaluator_kind) {
    case "shell":  return runShell(...)      // :230
    case "judge":  return runJudge(...)      // :232
    case "prebuilt": return runPrebuilt(...) // :234
    case "query":  return runQuery(...)      // :236
    case "aggregator": return runAggregator(...) // :238
  }
```

新增一个**真正新的 evaluator_kind**（比如 "screenshot_diff"）必须改：
1. `packages/plugin/src/metric-evaluation.ts:44-121` — 新增 `XxxMetricEvaluatorConfigSchema` + 加入 `MetricScorerSpecSchema` 的 `discriminatedUnion`
2. `packages/opencorvus/src/metrics/executor.ts:229-240` — switch 加一个 case，外加一个新的 `runXxx()` 函数
3. `packages/opencorvus/src/tool/metric-evaluation-host.ts:16, 52-53` — `evaluatorConfig()` 与 `ensureFrozenScorers()` 里对 `evaluator_kind` 的显式判断（目前只对 `"aggregator"` 特判，3 处）
4. 若该 scorer 需要独立证据管线（像 visual-feedback-verification 那样），还要在 `ExecuteMetricsInput`（`executor.ts:59`）、`MetricEvaluationRequestSchema`（`metric-evaluation.ts:143`）、`expert-squads/builtin/evolution-lab/tools/execute-evolution-metrics.ts:51,133` 三处新增一个具名字段（见思想实验一子结论 C）

**B. Campaign 作者层**（`expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts`）
即使新 scorer 复用已有的 `evaluator_kind`（executor 层已支持 5 种），Campaign 发布工具**只暴露 2 种**给作者：

```
publish-evolution-artifact.ts:68-100   CampaignJudgeScorerAssetSchema  (evaluator_kind: literal("judge"))
publish-evolution-artifact.ts:102-118  CampaignQueryScorerAssetSchema  (evaluator_kind: literal("query"))
publish-evolution-artifact.ts:119-122  CampaignScorerAssetSchema = discriminatedUnion("evaluator_kind", [Judge, Query])
```

组装 `campaign.scorers` 时是硬编码二元三元表达式，不是遍历一个 kind→builder 的映射：

```
publish-evolution-artifact.ts:392-425
  return asset.evaluator_kind === "judge"
    ? { ...identity, evaluator_kind: "judge" as const, evaluator_config: {...} }
    : { ...identity, evaluator_kind: "query" as const, evaluator_config: {...} }
```

即使只是想让 Campaign 作者能够声明一个**已经存在**的 `"shell"` evaluator_kind 的 scorer（executor 早就支持 shell），也必须：
1. 新增 `CampaignShellScorerAssetSchema`（仿 68-100 行）
2. 塞进 `CampaignScorerAssetSchema` 的 discriminatedUnion（119-122 行）
3. 把 392-425 的三元表达式改成三路分支
4. 检查 477 行 `ui_rubric_digest: scorerAssets.find((item) => item.asset.evaluator_kind === "judge")` 这类隐含"只有两种"的假设是否也要跟着改

**C. 对照实验聚合层**（`expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts:350-357`）
`visualReview` 的计算硬编码判断某 scorer 是不是"视觉审查"scorer：

```
comparison.ts:350-357
  const visualScorerIDs = new Set(
    campaign.scorers.filter(
      (scorer) => scorer.evaluator_kind === "prebuilt" &&
                  scorer.evaluator_config.name === "visual-feedback-verification",
    ).map((scorer) => scorer.scorer_id),
  )
```

新 scorer 若也需要"未完成视觉审查则 inconclusive"这类特殊晋升门槛，必须在这里再加一次同款字符串字面量比较——这是第三处独立硬编码同一个 `"visual-feedback-verification"` 字面量的位置（另两处见思想实验二 D）。

**必改文件清单汇总（新增一个"新 evaluator_kind + 需要独立证据 + 需要参与视觉门槛"的 scorer，最坏情形）**：
`packages/plugin/src/metric-evaluation.ts` / `packages/opencorvus/src/metrics/executor.ts` / `packages/opencorvus/src/tool/metric-evaluation-host.ts` / `expert-squads/builtin/evolution-lab/tools/execute-evolution-metrics.ts` / `expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts` / `expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts` —— **6 个文件**。仅复用已有 evaluator_kind（如 shell）也至少要动 `publish-evolution-artifact.ts` 一处三层（schema/union/组装分支）。

---

### 思想实验二：新增一种验收检查（acceptance / verification / visual-qa）

**结论：检查项本身部分是数据（heuristic/llm_judge 交给 LLM 读文本判断，不被机械执行），但 scorer 的"类型"是硬编码判别联合，且被独立手写了两份。**

`packages/opencorvus/src/acceptance/checks/index.ts:6-9` 的注释明确记录了这段历史：

> "The retired mutable Goal evaluator (`evaluateGoal` + `runRubric`) was removed on 2026-04-20: acceptance_specs are passed to Integrity review as information and verified via LLM judgment + run_command, not deterministic scorer runs."

即：`heuristic`（shell/script_ref）与 `llm_judge` 两种 scorer **不被任何代码机械执行**——`grep -rn "spec\.cmd\|\.spec\.kind" packages/opencorvus/src` 命中 2 处，全部只是把 `spec.cmd` 拼进渲染文本（`acceptance/types.ts:188`、`architect/output-tools.ts:460`），从未 `exec()`。真正被执行的判定只有：

- `contract_audit`（静态审计，`acceptance/contract-audit.ts`，762 行）
- `prebuilt`（visual-feedback-verification，`metrics/executor.ts:522-568`，仅在 evolution-lab 的 metrics 管线里跑，常规任务验收侧调用路径待确认）

**scorer 判别联合被独立手写了两份**，字段定义逐字重复，互不 import：

| | acceptance/types.ts（规范/持久化类型） | architect/output-tools.ts（Architect 工具输入 schema） |
|---|---|---|
| heuristic | :37-70 `HeuristicScorerSchema` | :82-104 `ArchitectHeuristicScorerSchema` |
| llm_judge | :72-92 `LlmJudgeScorerSchema` | :106-126 `ArchitectLlmJudgeScorerSchema` |
| prebuilt | :94-101 `PrebuiltScorerSchema` | :128-135 `ArchitectPrebuiltScorerSchema` |
| contract_audit | :103-123 `ContractAuditScorerSchema` | :137-157 `ArchitectContractAuditScorerSchema` |
| union | :125-130 `ScorerSchema` | :159-164 `ArchitectScorerSchema` |

`architect/output-tools.ts` 顶部只 import 了 `acceptance/types.ts` 的 `AcceptanceSeverity`、`LlmJudgeInputKind`、`RubricLevelSchema`、`type AcceptanceSpec`（output-tools.ts:24），**没有 import `ScorerSchema` 本体**——两份 schema 靠人工保持字段一致。新增第 5 种 scorer type 必须在两个文件里各写一遍完整 schema，而且两边各自还有一条 if-chain 把 `type` 映射成展示文本：

```
acceptance/types.ts:186-199        renderSpecsAsText 里的 if/else if 链（3 分支 + else）
architect/output-tools.ts:458-465  formatScorerSnapshot 里的 if 链（3 分支 + else）
```

**contract_audit 是目前唯一被机械执行的自定义类型，它的判定分支牵连全仓最多**：

```
grep -rln "contract_audit" packages/opencorvus/src → 5 个文件
  acceptance/contract-audit.ts        实现本体（762 行）
  acceptance/types.ts                 schema 定义 + renderSpecsAsText 分支（:192）
  architect/output-tools.ts           schema 定义 + criteria 收集（:428）+ 展示分支（:464）
  architect/reference-integrity.ts    :37 —— 把 scorer.spec.contract_ids 拿出来做引用完整性校验
  engine/persist.ts                   :498 —— 同样把 contract_ids 拿出来落库索引
```

新增一个**同样需要机械执行**的验收检查类型（例如 "coverage_threshold"），至少要复刻这 5 个文件里对 `contract_audit` 做的事：两处 schema 定义、一处展示分支、一处引用完整性校验、一处持久化索引，再加一个新的执行器模块——**至少 6 个文件**，且判定聚合逻辑（"哪些维度必需齐全"）在 evolution-lab 侧的 `comparison.ts` 与常规任务侧目前无统一位置，各写各的。

**prebuilt 类型是单例，不是可扩展类别**（细节见思想实验一 C 与下方 ARCH-D-3）：`name` 字段是 `z.literal(VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME)`，在 `acceptance/types.ts:97-99` 与 `architect/output-tools.ts:131-133` 各出现一次，两处都写死同一个字面量而非枚举/注册表。

---

### 思想实验三：新增一种能力匹配 / 记忆排序策略

**结论：两个模块都是零端口的裸函数，算法写死在唯一路径里，没有并行对照的接缝。**

`packages/opencorvus/src/capability/fuzzy.ts` 的 `scoreDiscoveryFields`（:202-215）是唯一入口，被 4 个调用点直接 `import` 后调用：

```
packages/opencorvus/src/capability/catalog.ts:208
packages/opencorvus/src/expert-squad/manager.ts:1530,1541-1543
packages/opencorvus/src/expert-squad/prompt-profile-resolver.ts:3833
packages/opencorvus/src/tool/skill.ts:317
```

内部 `scoreField()`（:164-179）把 4 种子算法（fuzzysort、token coverage、bigram Dice、CJK 无分隔符游程）用 `Math.max(...)` 硬编码组合成一个数：

```
fuzzy.ts:173-178
  return Math.max(
    fuzzyScore(query, candidate),
    tokenCoverageScore(query, candidate) * 0.9,
    bigramDiceCoefficient(query, candidate) * 0.88,
    separatorlessScore(runs, candidate),
  )
```

没有策略接口、没有权重表可注入、没有第二个实现可切换。要"并行跑两种策略做对照"，唯一办法是复制整个文件改名——4 个调用点都要么一起切换、要么分别硬编码选哪个实现，没有中间态。

`packages/opencorvus/src/memory/search.ts` 的 `MemorySearch.search()`（:48-175）同理：单一静态函数，调用点只有一处（`memory/index.ts:549`），算法（BM25 rank → sigmoid → 乘 `KIND_WEIGHT` → 乘 importance 因子 → 乘 confidence 因子 → 可选时间衰减）全部内联在 :140-147，没有可替换的评分器参数。函数签名（:48-56）只接受 `query/projectId/limit/minScore/temporalDecay/kinds/sources` 这些**筛选**参数，不接受任何**排序算法**参数——筛选是数据驱动的，排序不是。

两个模块共同特征：**判定函数即实现，没有"判定函数即接口"这一层**，因此“新增一种策略”不是新增一个实现类/一行注册表条目，而是新增一份复制粘贴文件并让调用方在编译期二选一。

---

### 思想实验四：替换一个阈值/权重来源

**结论：确认过的判定阈值/权重全部是模块级 `const` 字面量，与 `packages/opencorvus/src/config/` 零耦合，也没有函数参数化——唯一的替换方式是改源码重新编译。**

对以下 5 个判定文件执行 `grep -n "config\."`，均 **0 命中**：
`capability/fuzzy.ts`、`memory/search.ts`、`browser-preview/region-comparison.ts`、`browser-preview/scroll-slice-comparison.ts`、`expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts`。

具体常量与位置（均为文件顶层 `const`，非函数参数、非从 `config/` 或 env 读取）：

| 常量 | 位置 | 用途 |
|---|---|---|
| `MINIMUM_DISCOVERY_SCORE = 0.22` | `capability/fuzzy.ts:9` | 能力发现最低相关分（低于即视为不匹配） |
| `HALF_LIFE_DAYS = 30` | `memory/search.ts:9` | 记忆时间衰减半衰期 |
| `KIND_WEIGHT = {profile:1.45, lesson:1.25, fact:1.1, note:0.95, episode:0.8}` | `memory/search.ts:20-26` | 记忆种类排序权重 |
| `AGGREGATE_HIGH_CONFIDENCE_HALF_WIDTH = 0.05` / `AGGREGATE_MEDIUM_CONFIDENCE_HALF_WIDTH = 0.15` | `comparison.ts:55-56` | 进化对照实验置信度分桶边界 |
| `LOW_SSIM_LAYOUT_WARNING_THRESHOLD = 0.8` | `browser-preview/scroll-slice-comparison.ts:37` | 布局差异 SSIM 告警阈值 |
| `BACKGROUND_TOLERANCE = 24` | `util/pixel-stats.ts:36` | 像素"是否算内容"的色差容忍度 |

`packages/opencorvus/test/capability/fuzzy.test.ts:19,40,41,68` 直接断言 `toBeGreaterThan(0.22)`——把实现里的魔数抄进测试用例，而不是测试反过来锁定一个可配置的值；改这个阈值必须同时改产品代码和测试代码，两处都是字面量。

**唯一确认过的例外**（数据而非代码常量）：evolution-lab 的 `scorer.weight / scorer.target / scorer.floor` 来自 Campaign 作者在 `publish-evolution-artifact.ts` 里声明的资产（`CampaignJudgeScorerAssetSchema`/`CampaignQueryScorerAssetSchema` 字段），最终写入 `campaign.scorers`——这部分权重确实是运行时数据、按 Campaign 冻结、不需要改代码。但**消费**这些权重之后用来分桶置信度等级的边界值（0.05/0.15）仍是硬编码，见上表。

**结论**：待确认——`packages/opencorvus/src/config/` 下没有任何一个文件被上述判定模块引用（0 命中），所以“配置化程度”对这一批算法常量而言基本为零；不排除仓库其他判定常量（未逐一枚举）存在配置读取,但抽样的 6 个关键常量全部不可配置。

---

### 系统性反模式统计

#### D-a. switch / 判定分发对 kind|type|mode

在算法层目录（`acceptance/ verification/ visual-qa/ browser-preview/ capability/ memory/ metrics/ expert-squad/ scheduler/` + `expert-squads/`）内：

```
grep -rn "switch (" 上述目录  → 3 处
  browser-preview/layout-geometry-diagnostic.ts:584  switch(edge)      — 几何计算，非判定分发
  memory/task-plan.ts:183                             switch(status)    — 状态展示分支
  metrics/executor.ts:229                             switch(spec.evaluator_kind) — 核心判定分发（见思想实验一）
```

`switch` 本身不多，但**同一个判别字段被拆成多处独立 `if (x.field === "...")` 而非集中一次 switch** 的散弹式分发更普遍：

```
evaluator_kind 判断（非 switch 形式）：4 个文件，13 处
  metrics/executor.ts                  :229,230,232,234,236,238,244,250 （switch 内 5 case + 2 个独立 if）
  tool/metric-evaluation-host.ts       :16, 52, 53
  expert-squads/.../comparison.ts      :354
  expert-squads/.../publish-evolution-artifact.ts  :399, 407, 477

scorer.type === "contract_audit" 判断：5 个文件，约 6 处
  acceptance/types.ts:192  architect/output-tools.ts:428,464  architect/reference-integrity.ts:37
  engine/persist.ts:498    acceptance/contract-audit.ts（本体）
```

#### D-b. 硬编码白名单/常量数组当扩展点

| 常量数组 | 位置 | 新增一项要同步改几处 |
|---|---|---|
| `KIND_WEIGHT`（5 个记忆种类权重） | `memory/search.ts:20-26` | 1 处定义 + `SEARCHABLE_KINDS`/`isSearchableKind` 从它派生（自动跟随），但权重数值本身仍是硬编码个案 |
| `VISUAL_QA_SCREENSHOT_BEARING_EVIDENCE_TYPES` | `visual-qa/output-tools.ts:246` | 待确认——只读到定义，未追踪消费点数量 |
| `MetricEvaluatorKind` 5 值枚举 | `metrics/types.ts:28-34` | 见思想实验一：新增一值要动 6 个文件 |
| `CampaignScorerAssetSchema` 只含 2 值（judge/query） | `publish-evolution-artifact.ts:119-122` | 新增一值要动同文件 3 处（schema/union/组装分支） |
| `evaluator_kind==="aggregator"` 特判（等价白名单） | `tool/metric-evaluation-host.ts:16,52-53` | 3 处 |
| scorer `type` 判别联合（4 值：heuristic/llm_judge/prebuilt/contract_audit） | `acceptance/types.ts` + `architect/output-tools.ts`（两份独立定义） | 新增一值要在 2 个文件各写 1 份 schema + 2 处展示 if-chain，共 4+ 处 |

#### D-c. 接口隔离 / 里氏替换

- **正面例子**（未违反）：`metrics/types.ts:84-100` 的 `MetricResult`（`evidence_fresh: true/false` 判别 raw_value 是 number 还是 null）与 `:134-140` 的 `MetricExecutionEvidence`（`status: "measured"/"unavailable"` 判别）都是干净的判别联合，字段随分支收窄，调用方 narrowing 是合法的判别联合用法，不是 LSP 违反。
- **可疑但未确认为违反**：`ExecuteMetricsInput.visual_feedback_verification_artifact_locators?`（`metrics/executor.ts:59`）是一个**具名可选字段**而非"每个 scorer 一份类型化证据"的通用映射——这不是判别联合内部的字段收窄问题，而是"一个特定 scorer 名字拥有自己专属输入通道，其余 scorer 没有"的结构不对称，等价于把 evaluator_kind 判别联合的一个分支的输入提升成了顶层参数。语义上是策略耦合进了机制的入参形状，但因未发现真正因此需要到处 narrowing 的调用方，未列为独立 ARCH-D 条目，仅记录在此供后续判断。

#### D-d. 策略与机制混写

典型例子：

1. **`comparison.ts:100-407` `deriveComparisonRecommendation`**（单函数 300+ 行）——同时做：
   - 机制：解析/校验证据 slot 完整性（:118-201）
   - 算法：配对差值、方差、t 分布置信区间（:203-241）
   - 策略：什么算"不可用维度"（:183-201, 288-290）、置信度分桶边界（:327-334）、晋升规则（:369-386）
   全部糅在一个函数里，没有"先算统计量"与"再做晋升判断"的模块边界，导致连注释里都要解释"为什么用区间下界而不是点估计"这类策略决策与统计计算写在同一段代码块里。

2. **`memory/search.ts:48-175` `MemorySearch.search`**——SQL 查询（机制）、BM25→分数变换（算法）、`minScore` 早退（策略：低于阈值就是"不算"）、`compareResults` 排序（策略）全部内联在一个函数体内，:148 的 `if (score < minScore) continue` 直接嵌在算分循环里。

3. **`capability/fuzzy.ts:202-215` `scoreDiscoveryFields`**——算分（:211 `Math.max(...)`）与"够不够格算匹配"（:213 `if (best < MINIMUM_DISCOVERY_SCORE) return undefined`）在同一个函数里，调用方拿到的已经是过滤后的结果，无法拿到原始分数做自己的判断。

#### D-e. 配置化程度

见思想实验四：抽样的 6 个关键判定常量（能力发现阈值、记忆权重/半衰期、进化置信度分桶、视觉 SSIM 告警阈值、像素背景容忍度）**全部是编译期字面量**，`packages/opencorvus/src/config/` 未被这批算法文件引用。唯一例外是 evolution-lab scorer 的 `weight/target/floor`——这部分确实是运行时数据（Campaign 作者声明、随 Campaign 冻结），但消费这些数据后的二次判定（置信度分桶等）又回到硬编码。

---

### ARCH-D 编号条目（按严重度排序）

#### ARCH-D-1 evolution-lab scorer 扩展点是三层独立硬编码 schema，不是注册表
- **位置**：`packages/plugin/src/metric-evaluation.ts:44-121`；`packages/opencorvus/src/metrics/executor.ts:229-240,522-568`；`expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts:68-122,392-425`；`expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts:350-357`
- **事实**：新增一个可被 Campaign 作者使用、需要独立证据、需要参与视觉门槛判断的 scorer，须同时改 6 个文件（见思想实验一完整清单）；即使只是把 executor 层已支持的 `"shell"` kind 向 Campaign 作者开放，也要在 `publish-evolution-artifact.ts` 单文件内改 3 处（新 schema、discriminatedUnion、392-425 的三元表达式改多分支）。`grep -c 'evaluator_kind ==='` 类判断跨 4 个文件共 13 处。
- **违反原则**：开闭原则（新增判定单元必须修改既有分发代码）；框架设计第 5 条"端口隔离外部易变性"（scorer 应该是端口后的适配器，实际是散在 switch 里的分支）。
- **后果**：每个新 scorer 都是一次跨包（`packages/plugin` + `packages/opencorvus` + `expert-squads`）的协调修改，且 3 处硬编码同一个字符串字面量（`"visual-feedback-verification"`，见 ARCH-D-3）极易在改动时漏掉一处而悄悄产生行为不一致。
- **删除方向**：把 `evaluator_kind` 分发改成 `Map<string, ScorerRunner>` 注册表，`runPrebuilt` 按 `config.name` 二次分发而不是整个函数只服务一个名字；Campaign 作者层的 `CampaignScorerAssetSchema` 直接复用 `packages/plugin` 的 `MetricScorerSpecSchema` 判别联合而不是另开一套子集 schema。

#### ARCH-D-2 acceptance scorer 判别联合被独立手写两份，零共享
- **位置**：`packages/opencorvus/src/acceptance/types.ts:37-130`（`ScorerSchema`）对照 `packages/opencorvus/src/architect/output-tools.ts:82-164`（`ArchitectScorerSchema`）
- **事实**：4 个分支（heuristic/llm_judge/prebuilt/contract_audit）字段定义在两个文件里逐一复制；`output-tools.ts:24-26` 的 import 列表证实它没有引用 `acceptance/types.ts` 的 `ScorerSchema`/`HeuristicScorerSchema` 等，只借了 3 个无关的辅助 schema。两边还各自维护一条展示用 if-chain：`acceptance/types.ts:186-199` 与 `architect/output-tools.ts:458-465`。
- **违反原则**："一个概念，一个模型，一处实现"（框架设计文档原则 4）。
- **后果**：新增第 5 种 scorer type 必须在两个文件里各写一遍完整 schema + 各改一条 if-chain，共至少 4 处；两份定义已经可能存在字段级别的静默漂移（本次审计未逐字段比对，标"待确认"）。
- **删除方向**：`architect/output-tools.ts` 的 `ArchitectScorerSchema` 直接从 `acceptance/types.ts` 的 `ScorerSchema` 派生（如用 `.pick`/组合），或者反过来让 `acceptance/types.ts` 复用 Architect 的工具输入 schema 作为唯一定义源。

#### ARCH-D-3 "prebuilt" evaluator/scorer 类型事实上是单例，不是可扩展类别
- **位置**：`packages/plugin/src/metric-evaluation.ts:44-48`（`name: z.literal("visual-feedback-verification")`）；`packages/opencorvus/src/acceptance/types.ts:97-99`；`packages/opencorvus/src/architect/output-tools.ts:131-133`；执行侧硬绑定字段 `packages/opencorvus/src/metrics/executor.ts:59,525-546`
- **事实**：`PrebuiltMetricEvaluatorConfigSchema.name` 是 `z.literal`，不是 `z.enum`；`runPrebuilt()`（executor.ts:522-568）整个函数体只处理这一个名字，且证据管线用具名字段 `visual_feedback_verification_artifact_locators`（`ExecuteMetricsInput`:59、`MetricEvaluationRequestSchema` in `metric-evaluation.ts:143`、`execute-evolution-metrics.ts:51,133`）而不是"按 scorer_id 索引的通用证据映射"。三处（见 D-a 表）分别用字符串字面量比较判断"这是不是视觉 scorer"。
- **违反原则**：里氏替换/开闭原则——"prebuilt"这个 kind 名字暗示"平台内置的一类评估器"，但类型系统和管线设计只支持恰好一个成员，新增第二个内置评估器无法复用现有的 "prebuilt" 分支，等价于要新开一个 evaluator_kind（回到 ARCH-D-1 的全部代价）。
- **后果**：这不是"预留了扩展点但只用了一次"，而是扩展点的类型签名（`z.literal`）主动阻止了扩展；`visual_feedback_verification_artifact_locators` 这种具名字段还会在每新增一个 prebuilt 评估器时让 `ExecuteMetricsInput`/`MetricEvaluationRequestSchema` 的字段数线性增长。
- **删除方向**：`name` 改为 `z.enum([...])` 并把 `visual_feedback_verification_artifact_locators` 泛化成 `Record<scorer_id, ArtifactReadLocator[]>`，`runPrebuilt` 内部按 `config.name` 分发到具体实现函数（一个小注册表）。

#### ARCH-D-4 capability/fuzzy 与 memory/search 是零端口裸函数，无法并行对照两种策略
- **位置**：`packages/opencorvus/src/capability/fuzzy.ts:164-215`（4 个调用点：`capability/catalog.ts:208`、`expert-squad/manager.ts:1530,1541-1543`、`expert-squad/prompt-profile-resolver.ts:3833`、`tool/skill.ts:317`）；`packages/opencorvus/src/memory/search.ts:48-175`（唯一调用点 `memory/index.ts:549`）
- **事实**：两个模块都没有接口/策略参数，调用方直接 `import` 具体函数并调用；`scoreField()`（fuzzy.ts:164-179）内部把 4 种子算法用 `Math.max` 硬编码组合，`MemorySearch.search()` 的排序公式（:140-147）内联在主函数体里，函数签名不接受排序算法作为参数。
- **违反原则**：框架设计原则 5（端口隔离外部易变性）、原则 8（测试通过端口替身）——两个"会随时间迭代的排序算法"没有被当作可替换组件对待。
- **后果**：无法在生产环境并行跑新旧两种匹配/排序策略做 A/B 对照（这正是 evolution-lab 存在的目的之一），唯一办法是复制整份文件改名，4+1 个调用点各自决定切哪个版本，回归测试成本随调用点数量线性增长。
- **删除方向**：抽出 `DiscoveryScorer`/`MemoryRanker` 接口，`fuzzy.ts`/`search.ts` 的现有实现作为默认实现之一，调用方通过依赖注入取得实现而不是直接 import 函数。

#### ARCH-D-5 判定阈值/权重是编译期常量，与 config/ 零耦合
- **位置**：`capability/fuzzy.ts:9`（0.22）、`memory/search.ts:9-10,20-26`（半衰期、5 个权重）、`expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts:55-56`（置信度分桶）、`browser-preview/scroll-slice-comparison.ts:37`（SSIM 0.8）、`util/pixel-stats.ts:36`（BACKGROUND_TOLERANCE 24）
- **事实**：对这 5 个文件执行 `grep -n "config\."` 均 0 命中；常量都是模块顶层 `const`，未作为函数参数暴露。`packages/opencorvus/test/capability/fuzzy.test.ts:19,40,41,68` 把 0.22 直接抄进断言。
- **违反原则**：框架设计原则 10（性能/策略参数应隔离在适配器/配置，不渗入判定核心逻辑本身的写法）；四问校准法的第①问（常量从哪里标定）在配置层面无从回答，因为连"重新标定后怎么下发"这个机制都不存在。
- **后果**：调整任一阈值必须改源码、跑测试、重新发版——无法做灰度、无法按项目/客户差异化、无法在不发版的情况下响应"这个阈值判早了/判晚了"的运营反馈。
- **删除方向**：把这批常量收拢到 `packages/opencorvus/src/config/` 下的判定参数表，运行时通过依赖注入或 `Instance` 级配置读取,默认值仍是当前字面量,但改动路径不再要求重新编译源码本身。

#### ARCH-D-6 `deriveComparisonRecommendation` 单函数内混写机制/算法/策略
- **位置**：`expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts:100-407`
- **事实**：单函数 300+ 行，依次做证据完整性校验（:118-201）、统计计算（:203-241）、不可用维度判定（:183-201,288-290）、置信度分桶（:327-334）、晋升规则（:369-386），中间穿插大段解释"为什么这样判断"的注释——这些注释本身就是策略文档，说明策略决策散落在计算代码行间而非集中声明。
- **违反原则**：框架设计原则 3（深模块窄接口）——这是一个"浅"函数：内部复杂度没有被封装出可独立测试/替换的子单元，调用方只能拿到最终判决,不能单独复用其中的统计计算部分。
- **后果**：想单独测试"置信区间怎么算"而不牵扯"promote/retain 怎么判"目前做不到,两者在同一函数作用域内共享局部变量；未来调整晋升规则（如把 `regressions.length === 0` 改成加权容忍）必须重新审阅整个 300 行函数而不是一个独立的小函数。
- **删除方向**：拆成 `computeDeltas()` → `classifyAvailability()` → `deriveConfidence()` → `decideRecommendation()` 的纯函数管道，每一段可独立单测。

#### ARCH-D-7 contract_audit 是全仓牵连最广的验收判定分支扩展点
- **位置**：`packages/opencorvus/src/acceptance/contract-audit.ts`（本体，762 行）；`packages/opencorvus/src/acceptance/types.ts:103-123,192`；`packages/opencorvus/src/architect/output-tools.ts:137-157,428,464`；`packages/opencorvus/src/architect/reference-integrity.ts:37`；`packages/opencorvus/src/engine/persist.ts:498`
- **事实**：`grep -rln "contract_audit" packages/opencorvus/src` 命中 5 个文件；每个文件都对 `scorer.type === "contract_audit"` 做独立判断以提取 `contract_ids` 用于不同目的（渲染/校验/持久化索引）。
- **违反原则**：开闭原则——contract_audit 是目前唯一被机械执行的自定义验收类型，它证明了"新增一种真正被代码执行的检查"在这个代码库里的实际成本下限是 5 个文件。
- **后果**：任何新的机械执行型检查类型都要预期至少这个量级的改动面,且没有一个中心化的"检查类型注册"位置——5 个文件都是各自发现这个字符串字面量。
- **删除方向**：建一个 `AcceptanceCheckKind` 注册表（kind → {execute, extractReferences, persistIndex}），5 个消费点改为对注册表遍历而不是对字面量比较。

#### ARCH-D-8 evaluator_kind 枚举被 4 个文件 13 处分别检查（散弹式修改）
- **位置**：`packages/opencorvus/src/metrics/executor.ts:229,230,232,234,236,238,244,250`；`packages/opencorvus/src/tool/metric-evaluation-host.ts:16,52,53`；`expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts:354`；`expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts:399,407,477`
- **事实**：同一个 5 值枚举（`metrics/types.ts:28-34`）在这 4 个文件的 13 处被分别判断，其中只有 executor.ts:229 是集中的 switch,其余 8 处都是独立的 `===`/`!==` 判断,散落在不同职责的函数里。
- **违反原则**：DRY（同一分类知识的判断逻辑复制 13 次）；开闭原则的散弹式修改症状。
- **后果**：新增或调整一个 evaluator_kind 分支的行为,必须搜索确认这 13 处有没有遗漏需要同步修改的位置,而不是改一处注册表条目。
- **删除方向**：同 ARCH-D-1，收敛到注册表；`metric-evaluation-host.ts` 里的 `!== "aggregator"`/`=== "aggregator"` 过滤应改为向注册表询问"这个 kind 是否需要延后排序"这样的属性查询,而不是硬编码判断具体 kind 名字。

#### ARCH-D-9 visual-feedback-verification 字面量在 3 处独立硬编码
- **位置**：`packages/opencorvus/src/acceptance/prebuilt-scorer.ts:1`（常量定义）；`packages/opencorvus/src/acceptance/types.ts:98`；`packages/opencorvus/src/architect/output-tools.ts:132`；`expert-squads/builtin/evolution-lab/lib/evolution-lab/comparison.ts:354`（比较 `scorer.evaluator_config.name === "visual-feedback-verification"`，未从 `VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME` 常量导入,而是直接写字符串字面量）
- **事实**：`comparison.ts:354` 是唯一一处**没有**引用 `VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME` 常量、直接手写字符串字面量的位置（`expert-squads/builtin/evolution-lab` 是独立发布单元,不与 `packages/opencorvus/src/acceptance/prebuilt-scorer.ts` 共享 import 边界，属于结构性隔离而非疏忽,但结果仍是同一字符串出现在两个不同的信任边界里）。
- **违反原则**："一个概念一处实现"——scorer 的规范名称应该有唯一权威来源。
- **后果**：如果未来 `VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME` 改名，`comparison.ts:354` 不会被类型系统捕获,只能靠测试或运行时发现视觉门槛判断静默失效。
- **删除方向**：`expert-squads/builtin/evolution-lab` 若不能直接 import `packages/opencorvus` 的常量（跨发布单元边界),应在 evolution-lab 自己的 `artifacts.ts` 里重新导出一份具名常量,而不是裸字符串字面量,至少让改名产生一次 grep 可发现的 TODO。

#### ARCH-D-10 视觉判定常量与像素判定常量同样零标定零配置（辅助佐证，非独立新问题）
- **位置**：`packages/opencorvus/src/browser-preview/scroll-slice-comparison.ts:37`（`LOW_SSIM_LAYOUT_WARNING_THRESHOLD = 0.8`）；`packages/opencorvus/src/util/pixel-stats.ts:36`（`BACKGROUND_TOLERANCE = 24`，注释里承认是"约等于 1.5 个 4bit 量化桶"的经验值）
- **事实**：两个常量均无配置读取、无函数参数化,`pixel-stats.ts:36` 的注释明确说明这是经验估计而非标定值。
- **违反原则**：与 ARCH-D-5 同类,并入统计,不单独计分。
- **后果**：与 ARCH-D-5 相同。
- **删除方向**：与 ARCH-D-5 相同,一并收拢。

---

### 总判

evolution-lab 与 acceptance 两条判定链共享同一个结构病：**判定单元的"类型"被判别联合字面量锁死，而不是被注册表索引**。四个思想实验里,新增一个 scorer 最少动 4 个文件,想让 Campaign 作者用上执行器早已支持的能力也要单独开洞；acceptance 的 scorer schema 被独立手写两份,contract_audit 这个唯一被机械执行的类型证明了新增检查类型的实际成本下限是 5 个文件。capability/fuzzy 与 memory/search 是零端口裸函数,无法并行对照策略,这与 evolution-lab 本身"用对照实验驱动进化"的目的直接冲突——系统没有给自己留下用同样方法论迭代自己排序算法的接缝。抽样的全部判定阈值都是编译期字面量,配置化程度为零。这些问题彼此独立却都指向同一个修复方向：把"这是什么判定"的知识从 if/switch 字面量比较搬进数据/注册表,执行侧只认注册表条目,不认字面量。

## 维度 E · 包边界与算法所有权


审计范围：`expert-squads/builtin/evolution-lab/**`、`packages/opencorvus/src/expert-squad/**`、`packages/opencorvus/generated/expert-squad-payload.ts`、`packages/plugin/src/**`（evolution 相关）、`packages/opencorvus/src/tool/artifact-catalog.ts`。工作区当前内容（含未提交改动），非 HEAD。与 `docs/algorithm-layer-antipatterns.md` 互补，不重复其 ALG-03/ALG-08/ALG-11 已点名的数值判据问题；本文只审包边界与所有权。

---

### ARCH-E-1 Campaign 发布器的 scorer 校验只认 2 种 evaluator_kind，而 canonical 类型、执行引擎、agent 参考文档都承诺 5 种——shell/prebuilt/aggregator 三种记分器在发布时结构性不可达

- **位置**：`expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts:119`（`CampaignScorerAssetSchema = tool.schema.discriminatedUnion("evaluator_kind", [...])`，只列 `judge`/`query` 两支）、`:364`（`CampaignScorerAssetSchema.parse(...)` 是 campaign-spec 发布路径里唯一校验 scorer 资产 JSON 的地方）；`packages/plugin/src/metric-evaluation.ts:96-117`（`MetricScorerSpecSchema` 的 discriminatedUnion 列了 5 支：`shell`/`judge`/`prebuilt`/`query`/`aggregator`，被 `expert-squad-evolution-artifact.ts:102` 的 `evolution-lab/campaign-spec` schema 直接引用为 `scorers` 字段类型）；`expert-squads/builtin/evolution-lab/skills/campaign/references/scorer-contract.json:16-58`（`evaluator_config_contracts` 同样列出全部 5 种，且 SKILL.md 明确指示 Experiment Planner "Freeze each scorer with exactly one `evaluator_kind` and the matching strict `evaluator_config_contracts` entry from `references/scorer-contract.json`"）。
- **事实**：`rg 'discriminatedUnion' expert-squads/builtin/evolution-lab packages/plugin/src` 命中 4 处；其中唯一决定"这份 campaign-spec 里的 scorer 资产 JSON 能否被接受"的 `CampaignScorerAssetSchema`（publish-evolution-artifact.ts:119-134）与被 `campaign-spec` 类型正式声明、被执行引擎实际消费的 `MetricScorerSpecSchema`（5 支）不是同一个 schema、不是彼此的子类型、也没有任何导入关系——是两次独立手写。`scorer-contract.json` 是喂给 LLM 的权威参考文档，其 `shell`/`prebuilt`/`aggregator` 三节（:17-20、:37-40、:54-57）描述的字段契约在发布时永远走不到：Experiment Planner 若照着文档写一个 `shell` 或 `aggregator` 记分器资产，`CampaignScorerAssetSchema.parse` 会因为 `evaluator_kind` 不在 `["judge","query"]` 字面量里而直接抛 Zod 校验错误。
- **违反原则**：原则 4（一个概念一处实现——同一个"记分器配置"概念有 3 套独立定义：`MetricScorerSpecSchema` / `CampaignScorerAssetSchema` / `scorer-contract.json`）；原则 7（让非法状态不可表示——这里恰恰相反，*合法*状态被局部实现意外表示为非法）。
- **后果**：本该在类型系统里"不可能出错"的字段被拆成三份手写副本，其中两份（narrower 校验器、prose 文档）已经不同步。用户或 agent 只有在真的尝试发布一个 shell/prebuilt/aggregator 记分器 campaign 时才会撞见这个 gap，报错信息只会说"不认识这个 evaluator_kind"，不会指向"发布器没跟上 canonical 类型"这个真实原因。
- **删除方向**：`publish-evolution-artifact.ts` 的资产校验直接复用 `MetricScorerSpecSchema`（或其 `evaluator_config` 的一个子集），删除 `CampaignScorerAssetSchema` 这份平行定义；`scorer-contract.json` 要么由 `MetricScorerSpecSchema` 派生生成，要么删除，不再手写一份可能与代码不同步的 JSON 文档。

---

### ARCH-E-2 `expert-squads/builtin/evolution-lab/**/*.ts` 不在任何 TypeScript 项目的编译范围内——共享类型契约完全没有编译期强制

- **位置**：`package.json:34-38`（根 workspaces 只声明 `"packages/*"` 与 `"packages/sdk/js"`，不含顶层 `expert-squads/`）；`packages/opencorvus/tsconfig.json:14`（`"exclude": ["script/**/*", "test/**/*", "src/skill/builtin/**/*"]`——`test/**/*` 被排除）；`script/check-sdk-imports.ts:9-13`（glob 只扫 `packages/*/...`，不含 `expert-squads/`）；`packages/opencorvus/script/check-builtin-expert-squad-topology.ts:8-10`（唯一涉及 `expert-squads/builtin/*/expert-squad.jsonc` 的检查脚本，只做工作流拓扑结构校验，不解析/不编译任何 `.ts`）。
- **事实**：`find . -iname tsconfig*.json` 遍历全仓 11 个 tsconfig，无一个 `include`/根目录覆盖 `expert-squads/**`。根 `package.json:22` 的 `typecheck` 脚本是 `check:sdk-imports && check:ai-runtime && turbo run typecheck`——`turbo run typecheck` 只在 workspaces 声明的包内跑（`packages/opencorvus` 的 `typecheck` 脚本本身是 `tsc --noEmit`，而其 tsconfig 又排除了 `test/**/*`）。`expert-squads/builtin/evolution-lab` 目录下没有 `package.json`（`find expert-squads/builtin/evolution-lab -iname package.json` 零命中），不是一个 npm workspace 成员。
- **唯一触及这部分源码的机制**：`packages/opencorvus/src/expert-squad/package-tool-bundle.ts:119-168`（`validateTrackedCodeLoading`——用 TypeScript 编译器的 AST API 逐个 import 节点做**导入白名单**检查：只放行 node 内置模块子集、`@opencorvus-ai/plugin`、`@opencorvus-ai/plugin/tool`、`@opencorvus-ai/plugin/files`、`typescript`，见 `:22-24`、`:298`）与 `:370-515`（`Bun.build` 把工具源码编译成可执行 bundle）。**这是纯转译（strip types），不是类型检查**——`Bun.build` 不做跨文件类型校验，`validateTrackedCodeLoading` 只看 import 语句的字符串是否在白名单里，不看被导入符号的类型形状是否匹配。
- **违反原则**：原则 7（让非法状态不可表示——这里非法状态本可以在编译期被表示为类型错误，但因为源文件根本不进入任何 `tsc` 调用，这条防线被结构性绕过）。与 ARCH-E-1 是同一根因的两个症状：如果 `publish-evolution-artifact.ts` 真的 `import`（而非手写平行 schema）了 `MetricScorerSpecSchema`，正常情况下改字段会在 `tsc` 报错；但因为整个包不被编译，即便改成"正确"的写法（真的 import 共享类型），字段改名也不会在任何 CI 步骤里被捕获，只能靠运行时 `.parse()` 抛错或测试覆盖到那条路径。
- **后果**：`@opencorvus-ai/plugin` 一旦修改导出的 Zod schema 形状（重命名字段、收紧枚举），`expert-squads/builtin/evolution-lab` 里所有消费方（`lib/evolution-lab/*.ts`、`tools/*.ts`）不会在 `bun run typecheck` 时报错——唯一会报错的时刻是运行到那条代码路径的测试（见 ARCH-E-3）或生产环境里真实的一次进化实验。
- **删除方向**：把 `expert-squads/builtin/evolution-lab`（以及 `expert-squads/builtin/squad-sdk`，同样零覆盖）纳入某个会被 `turbo run typecheck` 覆盖的 tsconfig `include`（哪怕只是一个专门的 `tsconfig.expert-squads.json` 被根 typecheck 脚本显式调用），让"这段代码型定义了共享类型的使用"这句话变成编译期事实而非运行时期望。

---

### ARCH-E-3 evolution-lab 没有自己的测试；对它的全部行为验证寄生在宿主 `packages/opencorvus/test/**` 里，靠跨包相对路径 `../../../` 回引

- **位置**：`find expert-squads/builtin/evolution-lab -iname "*.test.ts"` 零命中。`packages/opencorvus/test/evolution-artifact-evidence-host.test.ts:21,44-55`、`evolution-candidate-manifest-surface.test.ts:2`、`evolution-comparison.test.ts:14-15`、`expert-squad/random-evolution-e2e-support.test.ts:3`、`expert-squad-evolution-mutation.test.ts:30` 均以 `../../../expert-squads/builtin/evolution-lab/lib/evolution-lab/{artifacts,candidate-integrity,comparison}` 或 `../../../expert-squads/builtin/evolution-lab/tools/*` 相对路径直接 import 插件包的私有实现与工具入口。
- **事实**：`grep -rn "from ['\"]\.\./\.\./\.\./expert-squads" packages/opencorvus/test` 命中 12 处跨包相对导入。结合 ARCH-E-2（`test/**/*` 被 tsconfig 排除），这些导入既不参与静态类型检查，也没有对应的、由 evolution-lab 自己拥有的测试文件——`compareCandidateIntegrity`（决定一次自修改候选包的 diff 是否合法的安全关卡，见 `candidate-integrity.ts:133-203`）这个函数的唯一验证入口是宿主测试目录里的几个文件。
- **违反原则**：原则 3/4 的推论——一个模块的正确性契约（它的测试）理应与模块同处一个所有权边界；这里"谁定义算法"（`expert-squads/builtin/evolution-lab/lib`）与"谁验证算法"（`packages/opencorvus/test`）分处两个不同 owner 的目录树，且验证方对被验证方没有任何声明式依赖（只是文件系统相对路径）。
- **后果**：删除或重构 `packages/opencorvus/test/evolution-*.test.ts` 中的任意一个文件，会直接删掉 `expert-squads/builtin/evolution-lab` 某个算法文件唯一的回归覆盖，且没有任何机制提醒"这个插件包的测试覆盖率归零了"——插件包本身的目录树看起来"没有测试"是完全正常的，因为它从未被设计成拥有自己的测试。
- **删除方向**：evolution-lab 的算法测试应该搬进 `expert-squads/builtin/evolution-lab/lib/evolution-lab/*.test.ts`（贴着被测代码），并让某个会被 `bun run test` 发现的测试 runner 配置覆盖到它；宿主测试目录只保留"host 如何消费已发布的 evolution-lab artifact"这类真正跨边界的集成测试。

---

### ARCH-E-4 同一仓库里"内置 Expert Squad"有三条并存的加载/打包路径，evolution-lab 恰好是唯一走"通用自动发现"这条路径的（squad-sdk 半只脚在里面）

- **位置**：`packages/opencorvus/src/expert-squad/builtin/ids.ts:10-15`（`EMBEDDED_EXPERT_SQUAD_IDS = [base, advanced, research-studio, squad-sdk]`）；`packages/opencorvus/src/expert-squad/builtin/index.ts:1-54`（对 `base`/`advanced`/`research-studio` 用同目录下 `./base/...` 相对路径静态 `import ... with {type:"text"}`，对 `squad-sdk` 却用 `../../../../../expert-squads/builtin/squad-sdk/...`——squad-sdk 的源文件物理上不在这个目录树里，却被同一份手写 import 列表逐文件接入）；`packages/opencorvus/script/generate-expert-squad-payload.ts:71,79`（`embeddedIDs = new Set(EMBEDDED_EXPERT_SQUAD_IDS)`，`if (embeddedIDs.has(id)) continue`——生成器**跳过**这 4 个 ID，只为 `expert-squads/builtin/` 下其余目录（当前唯一符合条件的就是 `evolution-lab`）生成 `generated/expert-squad-payload.ts`）；`packages/opencorvus/src/expert-squad/manager.ts:15,1397`（`payloadPackageSources` 的唯一消费者，驱动"market"安装/更新流程）。
- **事实**：`find expert-squads/builtin -maxdepth 1 -type d` = `evolution-lab`、`squad-sdk` 两个目录；`find packages/opencorvus/src/expert-squad/builtin -maxdepth 1 -type d` = `advanced`、`base`、`research-studio`。三种机制并存：①`base/advanced/research-studio`——源码物理上在 host 包内，逐文件手写静态 import，编译进二进制，不经过 `generated/expert-squad-payload.ts`；②`evolution-lab`——源码物理上在仓库顶层 `expert-squads/`，被 `generate-expert-squad-payload.ts` 按 Git 跟踪路径通用扫描后打进一个巨型生成文件，运行时按 `payloadPackageSources` 数组动态安装；③`squad-sdk`——源码物理位置和 evolution-lab 一样在顶层 `expert-squads/`，但因为在 `EMBEDDED_EXPERT_SQUAD_IDS` 里被生成器**排除**，转而被 `builtin/index.ts` 用跨 5 层 `../` 的相对路径逐文件手写静态 import，走的是机制①的代码路径。也就是说"文件物理位置"和"加载机制"这两个维度在 squad-sdk 身上是错开的，四个内置包用了三种物理位置 × 加载机制组合。
- **违反原则**：原则 4（一个概念一处实现——"如何把一个内置 Expert Squad 接入运行时"这一个概念有两套互不知情的实现）；原则 3（深模块——`builtin/index.ts` 的静态 import 列表随每个新增文件线性增长，是没有窄接口的浅模式）。
- **后果**：这直接回答任务给定的第 5 问——"如果要写第二个 expert-squad，多少是通用框架、多少是私有的"没有单一答案：新增一个走机制①的包，要在 `builtin/index.ts` 手写 N 行 import 并塞进 `ids.ts` 的排除列表；新增一个走机制②的包，只需要把目录放进 `expert-squads/builtin/` 让生成器自动发现——但没有任何文档或校验脚本说明这两条路径何时用哪一条，`check-builtin-expert-squad-topology.ts:8-10` 虽然扫两个目录做拓扑校验，却没有对"新包该放哪"给出规则。
- **删除方向**：统一成一种发现机制（推荐机制②——通用扫描 + 生成物），`base/advanced/research-studio/squad-sdk` 迁移成同样被生成器自动发现的目录，删除 `EMBEDDED_EXPERT_SQUAD_IDS` 与 `builtin/index.ts` 的手写 import 列表。

---

### ARCH-E-5 宿主的通用产物目录代码里硬编码了插件的命名空间字符串 `"evolution-lab/"` 来做所有权仲裁，而不是声明式机制

- **位置**：`packages/opencorvus/src/tool/artifact-catalog.ts:97-99`：
  ```ts
  export function assertGenericArtifactPublisherAuthority(artifactType: string) {
    if (artifactType.startsWith("evolution-lab/")) {
      throw new ArtifactPublisherAuthorityError(artifactType)
    }
  }
  ```
  被 `:579` 在通用 `artifact_publish` 工具的执行路径里调用；`:81` 的工具描述文案里也硬编码同一个例子（"Package-owned strict ABI namespaces such as evolution-lab/ must use their package-owned typed publisher and are rejected here"）。
- **事实**：`rg 'assertGenericArtifactPublisherAuthority|PACKAGE_TYPED_PUBLISHER' packages/opencorvus/src` 命中 5 处，全部在 `artifact-catalog.ts` 一个文件里，判定条件是单个字符串前缀比较，没有任何表（数组/注册表/manifest 字段）驱动。这一机制本身的意图是好的——它确实阻止了模型通过通用 `artifact_publish` 伪造 `evolution-lab/campaign-spec` 之类的强类型产物，强制走 `publish-evolution-artifact.ts` 那条经过 `EvolutionArtifactSchemas` 校验、由发布器派生事实的路径（呼应任务背景里"内置专家团包字节不可随意改"这条约束在**产物类型**维度上的对应版本，且这条**确实被强制**）。
- **违反原则**：原则 1/4——"哪些命名空间是包私有强类型、需要绕开通用发布器"是一个应该由包自己声明（例如在 `expert-squad.jsonc` 或某个 registry 里登记）的概念，而不是宿主通用代码里对一个具体插件 ID 的字符串字面量特判。宿主本不应该在编译期就知道 `evolution-lab` 这个具体包的存在。
- **后果**：ARCH-E-4 的场景一旦发生（新增第二个自进化 squad），这个人肉写死的 `if` 必须被同步修改，否则新包的强类型产物命名空间不受保护，可以被任何模型通过通用 `artifact_publish` 伪造。
- **删除方向**：把"strict ABI 命名空间"做成包 manifest 里的声明字段（例如 `expert-squad.jsonc` 的一个 `owned_artifact_namespaces` 数组），`assertGenericArtifactPublisherAuthority` 从已安装包的 manifest 集合里查表而不是比较字符串字面量。

---

### ARCH-E-6 单条布尔判据在 5 份 Markdown 提示词 + 2 处代码里各写一遍，靠人工保持同步

- **位置**：`target.scope === "built_in" → product_release_required` 这一条规则的完整命中列表——**代码**：`packages/plugin/src/expert-squad-evolution-artifact.ts:333-342`（Zod `.refine` 真实校验）、`expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts:447-450`（派生 `trialExecution`）；**提示词/文档**：`expert-squads/builtin/evolution-lab/agents/evolution-experiment-planner/system.md`（"Only literal `target.scope === "built_in"` means `product_release_required`"）、`agents/orchestrator/system.md`（同句重复一次，另加"package `namespace === "builtin"` does not mean `target.scope === "built_in"`"的否定式重申）、`README.md:19`、`selector.md:7`、`skills/campaign/SKILL.md:14`——五份文件各写一遍同一条规则的不同措辞版本。
- **事实**：`rg 'product_release_required|scope === "built_in"' expert-squads/builtin/evolution-lab` 命中 9 处（2 处代码 + 7 处 prose，含 orchestrator 里的 2 处）。另一条 `promote`/`retain`/`inconclusive` 判据同样在 `comparison.ts:380-386`（代码）与 `evolution-recommendation-owner/system.md`、`README.md:17`、`SKILL.md:16`（3 处 prose）里各表述一次。
- **违反原则**：原则 4（一个概念一处实现——这里概念只有一处"真"实现，但有 5-7 处"复述"，任何一处复述过期都不会被任何工具检测到，因为 prose 不参与 `tsc`/lint/测试）。
- **后果**：目前 7 处表述彼此一致（人工核对未发现矛盾），但这是"当前状态良好"而非"结构上不可能出错"——下一次有人只改了 `orchestrator/system.md` 里的措辞而漏改 `README.md`，或者代码里的条件从 `scope === "built_in"` 改成别的判据，不会有任何自动信号提示 prose 与代码已经分叉。这正是任务背景要求核查的"内置专家团包字节冻结"约束在**内容一致性**维度的弱点：包字节确实不能随便改（ARCH-E-4/5 证实了这点在产物类型上被强制），但包内 5 份文件之间的语义一致性完全没有被强制。
- **删除方向**：把这类规则收敛到单一权威表述（例如只在 `skills/campaign/references/artifact-ownership.md` 或新增的一份 reference 文件里写一次），其余 agent 提示词改成引用该文件而非复述规则本身。

---

### 附：任务问题的直接结论（未单独成条，供交叉核对）

- **依赖方向（问题1）**：`expert-squads/builtin/evolution-lab/**/*.ts` 的全部非相对 import 只有 `@opencorvus-ai/plugin`（及其子路径）与 node 内置模块（`rg '^import' expert-squads/builtin/evolution-lab --include=*.ts` 逐文件核对，零命中 `packages/opencorvus/src`）——**方向正确，未发现插件包直接 import 宿主内部实现**。反方向：`packages/opencorvus/src/**`（生产代码）同样**未发现**直接 import `expert-squads/builtin/evolution-lab`；唯一的跨界引用集中在 `packages/opencorvus/test/**`（见 ARCH-E-3，12 处）。生成物 `packages/opencorvus/generated/expert-squad-payload.ts` 由 `packages/opencorvus/script/generate-expert-squad-payload.ts` 生成，源是 `git ls-files` 枚举出的 `expert-squads/**` 全部跟踪文件（排除 `EMBEDDED_EXPERT_SQUAD_IDS`），唯一消费者是 `packages/opencorvus/src/expert-squad/manager.ts`。漂移发现机制：`.github/workflows/generate.yml` 在 CI 里重跑全部生成脚本后 `git diff` 校验干净工作区——**这条对"生成物字节是否等于源文件文本"的漂移检测是真实存在且有效的**，但它只检测文本层面的重新生成一致性，不检测 ARCH-E-2 指出的类型契约漂移。
- **算法分布（问题2）**：`lib/evolution-lab/*.ts` 约 3173 词（判定算法本体：candidate-integrity 203 行、comparison 407 行）；`tools/*.ts` 约 4292 词（含大量校验/派生逻辑，如 publish-evolution-artifact.ts 818 行）；`agents/*/system.md` 8 个文件合计 2727 词；`skills/campaign/{SKILL.md,references/artifact-ownership.md}` 合计 859 词；`expert-squad.jsonc` 829 词（纯拓扑配置，不含判定逻辑）。即"自然语言里的规则复述"（agents+skill，约 3586 词）与"代码里的规则实现"（lib，约 3173 词）体量相当——具体重复实例见 ARCH-E-6。
- **所有权错位（问题3）**：以 `evolution-lab/campaign-spec` 为例，schema 定义者是 `packages/plugin/src/expert-squad-evolution-artifact.ts`（含其引用的 `metric-evaluation.ts`），校验/派生者是 `expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts`，落盘者是宿主的 `context.host.engineArtifacts.publish`（`publish-evolution-artifact.ts:803` 调用，实现在宿主 `engine/artifact.ts` 一侧，未展开审计），解释/投影者是 `packages/opencorvus/src/expert-squad/evolution-history.ts`（把 envelope 转成类型化的 `Campaign`/`Candidate`/... 供 API 层用）。四个环节四个文件，责任边界总体清楚，**除了 ARCH-E-1 指出的 scorer 资产校验这一处，schema 的"定义"环节本身就分裂成两份**。
- **契约稳定性（问题4）**：无编译期强制（ARCH-E-2），有运行期强制两层——① import 白名单 + 内容寻址哈希锁定（`package-tool-bundle.ts:288` 把实际解析到的 `@opencorvus-ai/plugin` 运行时模块内容 sha256 写进每次编译产物的 `Snapshot.coreImports`，插件 SDK 变了这个哈希就变，缓存自然失效——这是一种"运行时内容锁定"而非"类型契约锁定"）；② Zod `.parse()` 在真正执行到那条代码路径时抛错。ABI 版本号（`schema_version: 1` 字面量校验，散见 `execute-evolution-metrics.ts` 等）是唯一的显式版本化信号，人工递增，无自动化的"破坏性变更需要 bump"检查。
- **可复制性（问题5）**：见 ARCH-E-4/ARCH-E-5。低层"包 prepare/publish/validate"原语（`context.host.expertSquadPackages.*`）已经是宿主通用能力，被 evolution-lab 的 `tools/expert-squad-package.ts` 薄封装调用，这部分是框架的。但中层"候选包 diff 是否合法"的算法（`candidateMutableTextPaths`/`compareCandidateIntegrity`，约 200 行）完全私有在 `expert-squads/builtin/evolution-lab/lib/`，未通过 `@opencorvus-ai/plugin` 导出——`packages/plugin/src` 里搜不到任何 `mutable_paths`/`CandidateRevision` 的通用定义（仅 evolution 专属两个文件命中）。若要写第二个自进化 squad，这 200 行要么整段复制，要么被迫跨包 reach-in（而 ARCH-E-2 的导入白名单机制目前只放行 `@opencorvus-ai/plugin`，并不允许跨 `expert-squads/builtin/*` 互相导入，所以复制是唯一现实路径）。**结论：evolution-lab 是"框架长在实例里"，不是"框架的一个实例"——它自己就是唯一的自进化实现，没有抽出可复用的中间层。**

---

### 总判（约200字）

本包边界的核心问题不是依赖方向倒转（那部分其实做对了：插件包对宿主零内部 import，宿主对插件包生产代码零内部 import），而是**共享契约缺了编译期这一环**：`expert-squads/` 不是 npm workspace 成员，宿主 tsconfig 排除 `test/`，导致插件的全部业务逻辑代码从未被 `tsc` 看见过，只靠运行时 Zod 校验和寄生在宿主测试目录里的用例兜底。这个盲区直接产生了 ARCH-E-1 的真实分裂（3 套记分器 schema 互不同步，3 种 evaluator_kind 结构性不可达）。再加上"内置 squad"存在三套并行加载机制、宿主用字符串字面量硬编码单个插件命名空间——evolution-lab 目前是不可复制的一次性特例，而非可复用框架的第一个实例。
