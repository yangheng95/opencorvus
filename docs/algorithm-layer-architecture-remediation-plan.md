# 算法框架层结构反模式整改方案

> 承接 [algorithm-layer-architecture-antipatterns.md](algorithm-layer-architecture-antipatterns.md)（诊断，ARCH-A/B/C/D/E 共 63 条）。
> 生成：2026-08-18。本文件是**执行文档**，随修随记状态。
>
> **裁决依据**：[host-reform-plan.md](host-reform-plan.md) 的宪法六条 + [framework-architecture-design.md](framework-architecture-design.md) 的十条原则。
> 二者冲突时以宪法为准（宪法是本仓库正式约束，十条原则是探索性设计参考）。
>
> **总方针**：删除优先于新增。每条整改先问宪法的三问——它保护哪个进程外或不可逆边界？能否从原始事实直接验证？删除后真实参与者是否仍能自然观察和继续？第一问无答案、或第二问只能回答「看 status」，默认删除。**不新建层、不新建包、不新建通用原语、不写 DB 迁移**（DDL 收窄后走既有 `findSchemaDrift` → `schemaResetRequired` 重置路径）。

## 执行约束

| 约束 | 内容 |
| --- | --- |
| 测试入口 | `cd packages/opencorvus && bun run test [文件...]`，**禁止裸 `bun test`**（绕过隔离 runtime） |
| 类型检查 | 根目录 `bun run typecheck`（`check:sdk-imports` + `check:ai-runtime` + turbo） |
| 包字节 | 改 `expert-squads/builtin/**` 后必须重生成 `packages/opencorvus/generated/expert-squad-payload.ts` |
| DB schema | 只收窄 DDL，不写迁移 |
| 模型面报错 | 抛错必须带 expected/received，否则编排器无限重试 |
| 进化可变面 | T5（`tools/`/`lib/`/scorer/权限/数据集）对**候选自我修改**仍搁置；本方案改的是**框架自身**的发布器与校验器，不解除 T5 |

## 状态图例

`⬜ 未开始` · `🔧 进行中` · `✅ 已落地` · `⏸ 挂起待确认` · `❌ 不修（附理由）`

---

## 一、处置总表（63 条）

### 波次 0 — P0：当前活故障 / 安全边界缺失

| 编号 | 结论 | 处置 | 状态 |
| --- | --- | --- | --- |
| ARCH-C-1 | 终态会话工具闸门两层裁剪/校验不同步，每次唤醒必抛 `did not build that tool` | **删除终态专用能力表**（宪法 Phase 2「剩余删除」既定项）；真实边界仍由 `acknowledge_terminal` 的身份+occurrence fence 与引擎 `existing_terminal` 承担 | ✅ |
| ARCH-E-1 + C-3 + D-1 | campaign 发布器只认 2 种 `evaluator_kind`，判定侧要找第 3 种 → 带 UI rubric 的 campaign 永久 `inconclusive` | plugin 侧新增 canonical 派生的 `MetricScorerAuthoringSpecSchema` + 单一展开点；发布器删掉手写联合与 34 行逐类型三元 | ✅ |
| ARCH-E-2 | `expert-squads/**/*.ts` 不在任何 `tsc` 范围 —— 上一条的根因 | 已加 `expert-squads/tsconfig.json` 并接入根 `typecheck`；61 条真实错误全清（59 条修在 plugin/宿主侧零包字节改动，2 条经确认修在包内） | ✅ |
| ARCH-B-01 | `metrics/` 迭代快照层写端零调用、读端在生产 | 已删整层：`score.ts`、三个 store 函数、`IterationSnapshot`、`engine_iteration` DDL 与表注册、两处恒空/恒零的 prompt 事实、一道永不触发的 `modeling_window_closed` 闸门 | ✅ |
| ARCH-A-1 | 验收判定自己读会话/读工件/写工件三合一 | 写回半边（零调用方）直接删；读半边改为判定声明 `VisualFeedbackVerificationEvidenceReader` 端口，由 `metrics/executor.ts` 这个唯一调用点绑定真实存储 | ✅ |
| ARCH-C-4 | 候选包「哪些能力允许自我修改」的不变式只写在 agent 提示词里 | Q2 裁决为**相对父修订**。`assertCandidateGrantsAreInherited` 对 manifest v2 的 generic `capability_refs` leaf union 与 `base_role` 要求候选 ⊆ 父包（跨节点取并集，以便 T4 新增 agent 仍能复用包内已有 ref）。报错带 expected/received | ✅ |

### 波次 1 — 死代码与重复实现（纯删除，风险最低）

| 编号 | 结论 | 处置 | 状态 |
| --- | --- | --- | --- |
| ARCH-B-02 | 第二套 SSIM 判定引擎（`runVisualDiff`/`summarizeVisualReport`）不可达 | 已删判定半边（5534 字符）与随之孤立的 `ssim.js` 依赖；`renderPage` 保留 | ✅ |
| ARCH-C-25 | `acceptance/checks` barrel 10 导出 0 importer | 已删整个 barrel 文件 | ✅ |
| ARCH-B-07 | 第三套文本相似度/分词器完全死代码 | 已删 `frontend-design/tools/text-compare.ts` | ✅ |
| ARCH-C-14 | orchestrator 错误信封只写协议，解析端零调用 | 删解析器与 marker；错误串不再追加无人读的 JSON | ✅ |
| ARCH-C-24 | `STATEFUL_SNAPSHOT_TOOL_NAMES` 永久为空却在热路径全量倒扫 | 删整套 superseded 投影机制——它同时违反宪法第三条（compaction 之外的读取变换） | ✅ |
| ARCH-C-26 | `stage-input-digest.ts` 与两个消费者是完整死代码链 | 已删；核实为 `taskContinuationScope`/`goalsContinuationScope` 双双零调用方，4 处 digest 产物全仓无人消费 | ✅ |
| ARCH-C-28 | `evaluateVisual` 进度回调形参零调用且与文档注释矛盾 | 删形参、接口与 5 处 emit 调用（两个调用方都不传 ctx） | ✅ |
| ARCH-C-23 | `MemoryInjection.systemPromptSection` 的 `query` 入参零使用、两层透传 | 删入参、两层透传、源头的 `memoryQuery` 拼装与 fallback 链，并订正谎称「命中依赖 query」的注释 | ✅ |
| ARCH-C-19 | 9 字段入参只转发 7 个，被调方回库重查 2 个 | 入参收窄为 7 个；测试夹具改为与 evidence-runner 同源地从 target 解析 viewports | ✅ |
| ARCH-C-20 | 判定入参 6 个从不被读的字段，2 个必填 → LLM 必须凭空编造 | `BrowserPreviewRegionBinding` 由 14 个叶子字段收窄为 8 个（纯模型面工具入参，无持久化消费者） | ✅ |
| ARCH-D-9 | `visual-feedback-verification` 字面量 3 处独立硬编码 | 常量落在 plugin（宿主与 squad 唯一共同依赖），宿主改为再导出，squad 改为 import | ✅ |
| ARCH-C-27 | work-artifact 两个 registry 是单元素 Map 的浅模块宽接口 | ◐ 核实**只有 `require()` 有外部调用者**，`all()`/`supports()` 零调用，已删。`presentation.ts` 的 30 个导出拆分未做——那是 1368 行文件的四块切分，改动面与风险都远超本轮其余条目，单列 | ◐ |

### 波次 2 — 共享原语归位（`util/` 空缺导致的 N 份重复）

| 编号 | 结论 | 处置 | 状态 |
| --- | --- | --- | --- |
| ARCH-B-05 | `clamp`/`clip01` 5+ 份，含同目录字节级重复 | 两对同目录重复各收敛为一份（`memory` / `metrics` 各自模块内导出，**不新建 util**）；顺带消除 `executor.ts` 那份缺 `Number.isFinite` 守卫、会让 NaN 流进内存态 attempt 的分歧 | ✅ |
| ARCH-B-11 | dedupe/unique 9 份 | ❌ 大部分不成立——9 处里多数语义不同（带重复即抛的校验、带 trim 过滤的、按 key 的）。真正重复的是 3 处 `[...new Set(x)]` 一行式包装；为语言习语建共享 util 属于新增机制，与宪法相悖。只把 `browser/runtime` 那份 9 行手写去重收敛为 Set 习语 | ◐ |
| ARCH-B-04 | `memory/` 内 4 处朴素 token 估算绕过已按 CJK 修正的权威实现 | 4 处全部改调 `Token.estimate`。影响真实：`token_count` 把关 MEMORY.md 自动注入预算门，中文文档此前被低估约 3 倍 | ✅ |
| ARCH-B-03 | 加权聚合打分 4 份，权重校验规则四种 | ❌ 不成立。`metrics/score.ts` 那份随 B-01 已删；`capability/fuzzy` 是加权取最大值、`memory/search` 是单值乘权重，都不是跨项加权平均。全仓现在**只剩 comparison.ts 一份** | ❌ |
| ARCH-B-10 | 带省略标记的截断 3 份 + 两套并行 budget 抽象 | ❌ 不修。核实为各调用点自带上限的行内显示截断（60/80/200 字符各异），且返回契约不同（一个附 `[truncated]` 文本、一个返回 `{value, truncated}` 结构），不是同一个 helper 的三份 | ❌ |
| ARCH-B-14 | 统计原语只有一份实现、`util/` 无落点（结构性风险，非已发生重复） | ❌ 不修——尚未发生的重复不预先抽象 | ❌ |

### 波次 3 — 耦合与边界

| 编号 | 结论 | 处置 | 状态 |
| --- | --- | --- | --- |
| ARCH-C-6 | 3 个判定/授权函数绕过域 API 直拼 SQL 读别模块内部表示 | 全部改走 `Session.messages`，照 `build/merge-back-publication-authority.ts` 已有的「纯 `...FromFacts` + 薄取数层」范式。工具 id 从 SQL 字符串字面量提升为 `WORK_ARTIFACT_VALIDATE_TOOL_ID`；`mutation-authorization.ts` 删掉手抄的第二套 `Message.User`/`TextPart` 解码。第三处（visual-feedback）已随 A-1 的 reader 端口解决 | ✅ |
| ARCH-C-8 | scheduler 裸 `json_extract` 直读 session 的 Message JSON，且双解码器不一致 | 路径改由编码方 `session/wake.ts` 的 `reasonJSONPath` 提供（字段名受 `WakeReason` 联合类型检查，改名即编译失败）；`isSchedulerWakeMessage` 改用 `WakeReason.safeParse`，与 `event-service.ts` 同一套解码 | ✅ |
| ARCH-C-10 | `ProjectMemory` 绕过 `Memory` 写入 API 直写同表且不同步 FTS | ◐ 取其可验证内核：「宿主自有 kind」这条策略此前散在三处（`index.ts` 私有谓词、`project-memory.ts` 字面量联合、`search.ts` 权重表的省略），而 `storage/mysql-transfer.ts` 的 FTS 重建三处都没引用——重建后的索引含运行时从不索引的 JSON 信封。现收敛为 `memory/types.ts` 的 `HOST_OWNED_MEMORY_KINDS`，重建改为按同一策略过滤。**信封是否该独立建表留待后续**（那是加表，不是删机制） | ◐ |
| ARCH-C-11 | `CapabilityRules` 同文件两套语义不同的判定，结论矛盾 | `disabled` 改为走 `evaluate`。原实现只匹配 permission、再用**字面量** `pattern === "*"` 判定，任何其他写法的全局 deny 都会漏判，而同文件 `eligibility.ts:40` 早已用 `evaluate(toolID, "*", ...)` | ✅ |
| ARCH-A-2 | 重试/超时判定反向写 session 的模块级可变单例 | 改为 `publishActivityMonitor` 端口，由 session 侧注册；顺带把只依赖 `ai`、与 session 无关的 `repair-hint.ts` 从 `session/` 移到 `llm/`。**`llm/` 对 `session/` 的反向 import 现为 0** | ✅ |
| ARCH-A-3 | 记忆打分公式焊死在裸 SQL 函数里，纯函数未 export 不可单测 | 抽出 `MemorySearch.rankCandidates`（纯函数 + 具名行类型），查询函数只负责取数；新增 `test/memory/search-ranking.test.ts` 5 例，是全仓第一次直接断言这套打分数学 | ✅ |
| ARCH-A-4 | `capability/` ⇄ `expert-squad/` 包级双向环 | Phase A1继续保持已验证边界：`capability/{descriptor,catalog}.ts`只拥有纯schema、canonical snapshot/cache与search；依赖Tool/Skill/MCP/Expert Squad runtime的唯一聚合器硬替换为`tool/capability-runtime-catalog.ts`。旧`tool/capability-catalog.ts`已删除，未把聚合器移回pure capability层 | ✅ |
| ARCH-C-15 | `TaskWakeRuntime` 间接层没断开依赖，三值两次坍缩 | 删 `task-wake-runtime.ts` + `task-wake-composition.ts` 及 4 处安装点。决定性证据：`automation-service.ts:19` **早已静态 import** 它声称要解耦的那个 engine 模块。三值 `DispatchTaskLoopResult` 现在原样流到日志与返回记录；`consumePendingTaskWaits` 在接口里但从未被经由它调用 | ✅ |
| ARCH-C-22 | `executeProviderAction` 吃整个 11 成员 `Tool.Context` | 复核发现**整个 `capability/provider-action.ts` 零调用方**，直接删。`capability/` 现在只依赖 config 与 util | ✅ |
| ARCH-C-21 | 37 道判定 issue 压平成 `string[]`，下游再压成 0/1 | 37 处逐一归入 5 类闭集码（`identity_mismatch`/`evidence_missing`/`evidence_unreadable`/`verdict_failed`/`contract_failed`），证据里带 `issue_codes`。**指标仍是 0/1**——把「证据不可读」改判为 `unavailable` 会改变晋升结果，属判定语义变更，单列 | ✅ |
| ARCH-C-7 | 证据持久化用 `operationKind` 字符串驱动 4 套校验分支 | 每种 operation 的「通过所需工件/是否需要 cropIntent」改为数据表，写路径与读路径共用同一张表——此前两侧各写一遍，读侧可能要求写侧从未被要求产出的角色 | ✅ |
| ARCH-C-9 | 投影在同名 `id` 上互换两类 id；关键时钟是可选尾参 | ◐ 时钟已改为**必填**：它决定 `retry_wait`/`running`/`pending`，此前 16 处调用有 9 处不传，同一次投影里每条 fire 各自取一次 `Date.now()`，可能跨过租约到期边界。`id`/`revision_id` 重映射保持不动——两处投影一致且已进入 API/UI 契约，重命名波及面远大于收益 | ◐ |
| ARCH-C-12 | 通用派发工具硬编码两个适配器的私有字段与分支 | `hostOwnedInputFields`/`deliverySliceRevisionField`/`modelGuidance` 声明进契约条目，注册表新增 `modelFacingInputSchema`/`deliverySliceRevisionIDs`/`modelGuidance`/`ownsWorktreeUsage`。**`dispatch-agent-tool.ts` 里 `"build"` 字面量归零** | ✅ |
| ARCH-C-13 | `manage_task` 用字符串名索引工具表，身份通道全程 `unknown` | 调用身份提升为具名 zod 形状 `OrchestratorToolInvocationSchema` 一次解析，报错带 expected/received；此前是 4 个独立 `typeof` 收窄各自回落 `""` 再合并判空 | ✅ |
| ARCH-C-16 | 5 个 stage 派发器把强类型上下文拆平成 13 个裸字段 | 抽出 `stageDispatchBinding(execution)`，5 处装配点逐字重复的 9 行（含两个对 `execution.dispatch` 的同构闭包）收敛为一次展开 | ✅ |
| ARCH-C-17 | 共享助手用未与类型关联的旗标切换结果种类 | 拆成 `persistCompleteResearchBrief` / `persistPartialResearchBrief`。`delivery` 与 `operation` 两个旗标在全部 4 个调用点完全相关——同一个决定写了两遍且无人校验一致性 | ✅ |
| ARCH-C-18 | `Scheduler.register` 用可选 `scope` 切换两套注册语义 | 复核发现**全部 5 个生产调用点都传 `"global"`**，instance 作用域连同 `TestHooks` 零用户。整段删除（281→246 行），`Task.scope`、`Entry` 联合、`createInstanceState` 注册、instance 重入路径一并消失 | ✅ |

### 波次 4 — 可扩展性与组织

| 编号 | 结论 | 处置 | 状态 |
| --- | --- | --- | --- |
| ARCH-D-2 | acceptance scorer 判别联合手写两份 | 4 个成员里 3 个与 canonical **逐字段相同**（仅 describe 文案微差），改为直接复用；只有 heuristic 是真收窄（仅 inline shell），改为 `HeuristicScorerSchema.extend({ spec: HeuristicShellSpecSchema })` 派生 | ✅ |
| ARCH-D-3 | `prebuilt` 类型事实上是单例伪装成可扩展类别 | ✅ 用户 2026-08-18 解除包字节约束后落地「真正开放」方向：证据字段 `visual_feedback_verification_artifact_locators`（一条以唯一那个评估器命名的扁平列表）改为 `prebuilt_scorer_artifact_locators`——**按 `scorer_id` 索引的映射**。第二个 prebuilt 评估器现在有地方放它的证据。改动面：plugin 契约、`metrics/executor.ts`（按 `spec.name` 查自己的证据）、`metric-evaluation-host.ts`、squad 的 `execute-evolution-metrics` 模型面入参、6 处测试、payload 重生成 | ✅ |
| ARCH-D-8 | `evaluator_kind` 在 4 文件 13 处分别 switch | ◐ E-1 落地后已从 13 处降到 6 处。剩余的 `=== "query"`/`=== "aggregator"` 在 `metrics/executor.ts` 里是**唯一实现处**的正当分派，不是散弹式修改。真正的残余缺陷是 `store.ts` 内联重述了整个枚举（第六种 kind 会在这里编译通过却永远到不了），已改为引用 `MetricEvaluatorKind`/`MetricObservationClass` | ◐ |
| ARCH-D-4 | `capability/fuzzy` 与 `memory/search` 零端口，无法并行对照策略 | ❌ 前提已不成立。`capability/fuzzy.ts` 本就是零 I/O、零 `@/` 依赖的纯导出模块（`scoreDocumentField`/`scoreDiscoveryFields`），`memory/search` 在 A-3 后导出了 `rankCandidates`——两套排序现在就能并排跑。再造一个「策略位」是审计自己警告过的事（没有验证集就不引入） | ❌ |
| ARCH-D-5 | 判定阈值/权重全是编译期常量，与 `config/` 零耦合 | ❌ 不修——上一份审计已定「没有验证集就不调常数」；把未标定常数配置化只是把问题挪到运行时 | ❌ |
| ARCH-D-7 | `contract_audit` 是牵连最广的验收扩展点 | 随 D-2 收敛为单一定义，新增检查类型不再需要在两处各写一遍 | ✅ |
| ARCH-B-06 | `confidence` 5 种不兼容语义与值域 | ◐ 按审计自身的方向执行（「不强求合并成一个类型」）：在 memory / fact-check / intent-analysis / browser-guard 四处声明点标明量纲与来源，点名「与统计推导的那个同名但不可比、不可合并」。**不重命名持久化字段**——审计确认尚无实际跨源比较，重命名会波及已落库的记忆行与已发布的工件 schema | ◐ |
| ARCH-B-08 | 验收/校验/审阅五目录家族 | ◐ 三处已解决：`review/` 影子模块随 B-13 消失、`fact-check/fact-projection.ts` 随 B-12 正名、**`verification/` 顶层目录已折叠进它唯一的消费者** `browser-preview/visual/`（该目录只含 `visual/` 两个文件，只被 browser-preview 引用）。**「3 套互不知情的审阅脚手架合并」不做**——fact-check / integrity / acceptance 合并意味着发明一套共享骨架，那是新增机制而非删除，宪法三问不授权 | ◐ |
| ARCH-B-09 | `integrity/team-agent.ts`（1002 行）揉合四类职责 | ✅ 拆成三个模块：`review-prompt.ts`（304 行，提示词常量+渲染）、`review-validation.ts`（289 行，12 个纯校验/规范化函数）、`team-agent.ts`（471 行，只剩会话与工具箱编排）。第二刀首次按行切失败（29 个编译错误，已回退）；改为**按函数名边界切并先验自由变量**，确认 12 个函数与 `ConsensusCollector` 零耦合后一次通过 | ✅ |
| ARCH-B-12 | 同名 `fact-projection.ts` 两份（21 行 vs 261 行） | 21 行那份根本不是事实投影——它拼的是给模型的检索指令。改名为 `discovery-instruction.ts`，同时消除重名与误名 | ✅ |
| ARCH-B-13 | `review/`、`work-ledger/` 单文件独立目录 | ◐ `review/stream.ts` 唯一消费者是 `integrity/team-agent.ts`，已并入为 `integrity/review-stream.ts`，`review/` 目录消失。`work-ledger/projection.ts` 保留——它是领域投影，唯一消费者在 `server/routes/`，并进去等于把领域逻辑塞进路由层 | ◐ |
| ARCH-A-5 | 视觉比对判定结果里硬编码英文提示词文案 | ❌ 不修。文案已独立在 `comparison-guidance.ts` 自己的模块里，且它是工具结果契约的一部分（模型据此判断左右哪边是基准）。再搬要么破坏该契约、要么给 `browser-preview` 引入对 `tool/` 的跨层依赖，无功能收益 | ❌ |
| ARCH-C-2 | 发布器 `execute()` 568 行、23 处 `artifact_type ===` | ◐ 共享前置条件（哪些类型必须带不可变资源集）改为数据表，三路 `||` 链 + 单独措辞的 `if` 收敛为一次查表。**五个按类型的校验体仍在 `execute()` 内**——它们闭包依赖 `envelopes`/`publication`/`context` 等大量局部量，按行切会重演 B-09 第二刀的失败 | ◐ |
| ARCH-E-3 | evolution-lab 零自有测试，寄生宿主 test 目录 | ◐ 取其真实缺陷（「靠跨包相对路径 `../../../` 回引」）：新增 `@squads/*` 路径别名，15 个测试文件 40 处 reach-back 归零，bun 运行时解析已验证。**不新增测试运行器**——那会造出第二套测试入口，与 [[no-bare-bun-test]] 记的唯一入口冲突 | ◐ |
| ARCH-E-4 | 「内置 squad」三条并存加载路径 | ❌ 不修。审计给的方向是把 `base`/`advanced`/`research-studio`/`squad-sdk` 迁成生成器自动发现——那要**移动已发布包的物理位置**并改变其加载与安装路径，同时波及打包与 digest，超出本方案约束表。相邻的声明式改造已随 E-5 完成（命名空间仲裁改由 ABI 派生） | ❌ |
| ARCH-E-5 | 宿主硬编码插件命名空间字符串做所有权仲裁 | 命名空间清单由 ABI 自身派生（`PACKAGE_OWNED_ARTIFACT_TYPE_NAMESPACES`，从 `EvolutionArtifactSchemas` 的键推出），宿主改为询问 ABI | ✅ |
| ARCH-E-6 | 单条判据在 5 份 Markdown + 2 处代码各写一遍 | ✅ 审计点名的缺陷是「各写一遍**不同措辞版本**」。5 份提示词统一为同一句 canonical 表述（各自保留一句场景补充），以后措辞漂移一 grep 即现。**不改成「见某文件」的指针**——那是拿文档一致性换提示词有效性，而后者没有评测集可验证 | ✅ |
| ARCH-D-6 | `deriveComparisonRecommendation` 单函数混写机制/算法/策略 | ◐ 抽出 `indexComparisonEvidence`（把提交的工件绑定到声明槽位并拒绝不属于冻结 Campaign 的）与 `classifyComparisonAvailability`（哪些维度无证据支撑），主函数 307→254 行。剩余的差值统计与晋升判据仍在一起，是 4 段管道里的后 2 段 | ◐ |
| ARCH-D-10 | 视觉/像素判定常量零标定零配置（辅助佐证） | ❌ 不修——同 D-5 | ❌ |
| ARCH-A/B/C 其余支撑条目 | 统计附录、层内环检查等 | 无独立动作 | — |

---

## 二、波次 0 详细方案

（每条在动手前补完「判据 / 改法 / 影响面 / 验证」，落地后回填结论。）

---

## 三、执行日志

| 时间 | 条目 | 动作 | 验证 |
| --- | --- | --- | --- |
| 08-18 | ARCH-D-3 落地 | 用户解除包字节约束后，prebuilt 证据从「以唯一评估器命名的扁平列表」改为按 `scorer_id` 索引的映射，`prebuilt` 不再是伪装成可扩展类别的单例 | 三个 typecheck 全绿；metrics-evidence-runtime 5/5、evolution-artifact-evidence-host 8/8、evolution-comparison 5/5、evolution-lab-package-projection 1/1、catalog-index 14/14。payload 已重生成 |
| 08-18 | ARCH-B-09 完成 / E-4 尝试后回退 | B-09 三模块拆分完成（1002→471+289+304）。E-4 的 squad-sdk 半边（删 24 处跨 5 层 `../` 手写 import、交给通用发现）**做完后回退**：`catalog-index` 捕捉到 squad-sdk 从「编译内置」变为「经 payload 安装」的可用时机变化，需先确认安装流程等价性 | 三个 typecheck 全绿；integrity-review-occurrence-runner 2/2、task-control-integrity-blocked 3/3、catalog-index 14/14（回退后）、evolution-lab-package-projection 1/1、random-evolution-e2e-support 14/14 |
| 08-18 | 四条 ⏸ 全部给出终局处置（D-3/D-4/E-4/E-6） | E-6 落地：5 份提示词统一为同一句 canonical 表述。D-4 前提已被 A-3 消解。D-3/E-4 定论不修——均需改已发布的工件 schema 或包物理位置，超出约束表。**没有一条留在「等裁决」状态** | 三个 typecheck 全绿；evolution-lab-package-projection 1/1、catalog-index 14/14、evolution-comparison 5/5。包字节已变，payload 已重生成 |
| 08-18 | ARCH-B-08（部分） | `verification/` 顶层目录折叠进 `browser-preview/visual/`，顶层目录数 -1 | 三个 typecheck 全绿；algorithm-repair-contracts 5/5、pixel-content-ratio 6/6、target-persistence 1/1 |
| 08-18 | ARCH-E-3 / C-2（部分） | 跨包 reach-back 换成命名别名；发布器共享前置条件改数据表。别名重写一度误伤 3 处**文件系统路径字符串**（不是 import 说明符），已定位并还原 | 三个 typecheck 全绿；evolution-artifact-evidence-host 8/8、catalog-index 14/14、random-evolution-e2e-support 14/14、evolution-comparison 5/5、evolution-candidate-manifest-surface 13/13、growth-discovery-packages 6/6。commercial-legal / data-analysis / hr-operations 各 1 条失败经 `git stash` 验证为**既有**红夹具（`Artifact provenance requires persisted Tool Part`，见 [[artifact-provenance-requires-persisted-parts]]） |
| 08-18 | ARCH-B-09（部分） | 抽出 `integrity/review-prompt.ts`。第二刀（校验/规范化）切下去产生 29 个编译错误，已完整回退到绿色状态——宁可留一半，不留一个我无法证明行为等价的重构 | 三个 typecheck 全绿；integrity-review-occurrence-runner 2/2、task-control-integrity-blocked 3/3 |
| 08-18 | 波次 4 三批（D-8/C-27） | 枚举内联重述改为引用 canonical 类型；两个单元素 registry 删掉零调用的 `all()`/`supports()` | 三个 typecheck 全绿；work-artifact/qualification 15/15 |
| 08-18 | 波次 4 次批（B-06/B-13/D-6） | confidence 各处标明量纲与来源、单文件 review 模块归位、对照实验的取证与可用性判定抽为独立纯函数 | 三个 typecheck 全绿；evolution-comparison 5/5、evolution-artifact-evidence-host 8/8、evolution-lab-package-projection 1/1、expert-squad-evolution-mutation 1/1、evolution-candidate-manifest-surface 13/13。包字节已变，payload 已重生成 |
| 08-18 | 波次 4 首批（D-2/D-7/E-5/B-12/A-5） | 验收 scorer 收敛为单一定义、插件命名空间改由 ABI 派生、误名模块归位。顺带修掉第三条**既有**红测试 `fact-check-domain-incomplete-settlement`（同样是完成后写 Part），夹具改为显式 `completeWorkerFinal()` 步骤 | 三个 typecheck 全绿；fact-check-domain-incomplete-settlement 5/5（此前 0/5）、artifact-publisher-authority 3/3、artifact-catalog-cursor 1/1、architect-domain-incomplete-settlement 4/4 |
| 08-18 | 波次 3 收尾（C-7/C-9/C-12/C-13/C-16/C-17/C-18） | 控制耦合旗标全部消除：适配器私有知识声明进契约、operation 校验改数据表、stage 装配去重、结果种类拆成两个函数、调度器 instance 作用域整段删除、投影时钟必填 | 三个 typecheck 全绿；scheduler-event-durable-fire 5/5、scheduler-fact-control 2/2、scheduler-claim-and-fire-identity 3/3、project-state-disposal 3/3、project-instance-lock-liveness 7/7、orchestrator-control-message 7/7、orchestrator-dispatch-guidance 1/1、stage-tool-materializer 4/4、research-domain-incomplete-settlement 4/4、architect-domain-incomplete-settlement 4/4、visual-qa-turn-graph-commit 1/1、dispatch-agent-detachment 7/7、dispatch-agent-managed-lifecycle 1/1、delegate-agent 2/2、target-persistence 1/1、algorithm-repair-contracts 5/5、pixel-content-ratio 6/6 |
| 08-18 | ARCH-C-6 / C-21 | 判定与授权改读域 API；判定失败恢复可归因。顺带修掉两条**既有**红测试：`qualification.test.ts` 在 assistant 完成后追加工具 part（撞宿主不可变量），`metrics-evidence-runtime.test.ts` 对投影字段 `time_started` 做 `db.update` 生成空 `SET` | 三个 typecheck 全绿；qualification 15/15（此前 14/1）、metrics-evidence-runtime 5/5（此前 4/1）、expert-squad-evolution-mutation 1/1、evolution-feedback-revision 4/4 |
| 08-18 | ARCH-C-22 / C-15 / C-8 | 删掉一个零调用方模块、一个什么也没断开的间接层（含全局可变单例）、5 处跨模块 SQL 路径字面量与一套手写解码 | 三个 typecheck 全绿；scheduler-task-wait-project-runtime 1/1、scheduler-claim-and-fire-identity 3/3、scheduler-fact-control 2/2、task-control-wake-totality 4/4、scheduler-event-durable-fire 5/5、protocol-scheduler-message-delivery 1/1、scheduler-message-harness-contract 2/2 |
| 08-18 | ARCH-C-10 | 单一策略来源 + 让 FTS 重建与运行时一致 | 三个 typecheck 全绿；session-memory 11/11、project-memory 24/24（首跑一次 git spawn ENOENT flake，复跑通过）、search-filter-order 3/3、search-ranking 5/5 |
| 08-18 | ARCH-C-4 | 候选自我授权的安全不变式从提示词落到代码；Phase B 后由 generic typed ref union 与 `base_role` 共同约束 | 新增 4 例（越权授予 platform Tool / 新 Agent 越权授予 package Tool / 新 Agent 复用已有 ref / 越权换 base role）；manifest-surface、artifact-evidence-host、evolution-mutation、feedback-revision 通过 |
| 08-18 | ARCH-A-3 / A-4 | 记忆排序抽为可脱库直测的纯函数并补测试；capability 聚合器归位，目录恢复为纯原语层 | search-ranking 5/5（新增）、search-filter-order 3/3、session-memory 11/11、capability/catalog 3/3、capability/fuzzy 6/6、mcp/computer-contract 14/14 |
| 08-18 | 波次 2 + C-11 + A-2 | 逐条复核后：B-05/B-04/C-11/A-2 落地，B-03/B-10 判定为审计过度归并（不修并记明理由），B-11 只做一处真实化简。**复核推翻了 3 条原始结论**——这正是「先验证再动手」的价值 | 三个 typecheck 全绿；memory 三个测试 11/11+3/3+24/24、security-p0-contracts 9/9、delegate-agent 2/2、capability/fuzzy 6/6、processor-llm-activity-retry 3/3、tool-request-conflict-host-fault 8/8、architect-domain-incomplete-settlement 4/4 |
| 08-18 | 波次 1（B-02/C-25/B-07/C-14/C-24/C-26/C-28/C-23/C-19/C-20/D-9） | 11 条纯删除/收窄一次性落地。每条动手前都用 grep 复核过 agent 的断言，其中 C-26 的描述有偏差（`stageInputDigest` 有 4 处调用，死的是它产物的消费者），C-24 比报告更严重（空表让整套 superseded 投影不可能触发，且违反宪法第三条） | `expert-squads` / `opencorvus` / `plugin` 三个 typecheck 全绿；session-memory 11/11、search-filter-order 3/3、read-context-history-retention 1/1、orchestrator-terminal-coordination-schema 2/2、task-control-reconciliation 6/6、evolution-comparison 5/5、evolution-artifact-evidence-host 8/8、evolution-lab-package-projection 1/1、target-persistence 1/1、algorithm-repair-contracts 5/5、pixel-content-ratio 6/6 |
| 08-18 | ARCH-E-2 | 新增 `expert-squads/tsconfig.json`（编译口径对齐 `packages/opencorvus/tsconfig.json`，不对已发布包追加更严策略） | 从 159 → 61 条真实错误 |
| 08-18 | ARCH-E-2 | `tool.schema` 由运行时 expando 改为与函数合并的 namespace —— 9 个已发布包在类型位置写 `tool.schema.infer<...>`，此前全仓无人能编译它 | 类型错误 25 → 0；运行时 `tool.schema` 行为实测不变 |
| 08-18 | ARCH-E-2 | `PackageEngineArtifactPublishRequest` 接受 `readonly` 数组（`taskArtifacts.resources` 本就返回 readonly） | 10 条 TS4104 清零，零包字节改动 |
| 08-18 | ARCH-E-2 | `snapshot_kind` 由 `"catalog"` 放宽为 manifest 真实枚举 `"catalog" \| "engine_resource"`（实现本就透传） | evolution-lab 类型错误清零 |
| 08-18 | ARCH-E-2 | 发布器判别联合恢复非空元组类型 | 25 条级联 TS18046 一次清零 |
| 08-18 | ARCH-E-1 | plugin 新增 `MetricScorerAuthoringSpecSchema` + `metricScorerSpecFromAuthoring`；发布器删除手写的两份扁平 schema 与逐类型展开三元 | 发布器净删 80 行；实测 5 种 kind 全部可授权，`prebuilt` 可命中 `comparison.ts:350` 的视觉门 |
| 08-18 | ARCH-E-1 | 重生成 `generated/expert-squad-payload.ts`；测试夹具 `scorer-correctness.json` 改为契约的嵌套形式 | `evolution-artifact-evidence-host` 8/8、`evolution-comparison` 5/5、`evolution-candidate-manifest-surface` 9/9、`security-p0-contracts` 9/9 |
| 08-18 | ARCH-A-1 | 删除零调用方的 `persistVisualFeedbackVerificationArtifact`（767 字符），`acceptance/visual-feedback-verification.ts` 对 `@/session`、`@/engine/artifact`、`@/artifact-catalog` 的 import 全部消失；判定改为声明式端口（行类型泛型化，无 `as` 强转） | `bun run typecheck` 全绿；`evolution-artifact-evidence-host` 8/8；`metrics-evidence-runtime` 失败数不变 |
| 08-18 | ARCH-E-2 | seo-geo / marketing-growth 的 `source_artifact_locators` 收窄为 `EngineArtifactLocatorSchema`；根 `package.json` 新增 `check:expert-squad-types` 并接入 `typecheck` | `expert-squads` 0 错误；`catalog-index` 14/14、`evolution-lab-package-projection` 1/1、`expert-squad-evolution-mutation` 1/1 |
| 08-18 | ARCH-B-01 | 删 `metrics/score.ts` 整个文件、`writeIterationSnapshot`/`readIterationHistory`/`readPreviousAggregateScore`、`IterationSnapshot`、`engine_iteration` DDL 与 `storage/schema.ts` 注册（收窄 DDL，不写迁移）；顺带删掉 `agent.ts` 恒不渲染的「## Metric Observations」段、`describe.ts` 恒为 0 的 `iterations_count` 提示事实，以及 `registerBaselineSpec` 里一道以空表为判据、永不触发的 `modeling_window_closed` 闸门 | `bun run typecheck`（opencorvus 包）全绿；`metrics-evidence-runtime` 失败数不变（仍是那一条继承失败） |
| 08-18 | ARCH-C-1 | 删除 `TERMINAL_TASK_TOOL_CAPABILITIES` / `terminalTaskToolCapability` / `projectTerminalConversationTools`（1212 字符）；顺带删掉模型面已失效的 Retry 指引 | 新增回归测试：终态唤醒下 `TASK_ARTIFACT_SCHEDULER_TOOL_IDS` + `publish_interactive_artifact` 全部可建；`orchestrator-terminal-coordination-schema` 2/2、`task-control-reconciliation` 6/6、`task-control-sweep-scope` 2/2 |

## 四、待确认（框架规则未覆盖）

### Q1（已裁决 2026-08-18：修，接受漂移）　seo-geo / marketing-growth 两个已发布包内的真实缺陷

- **事实**：`publish-seo-geo-artifact.ts:26` 与 marketing-growth 同名文件把 `readSource(locator: EngineArtifactLocator)` 用在 `args.source_artifact_locators` 上，而该入参的 schema 是 `ArtifactReadLocatorSchema`（3 个变体的联合）。模型传 `task_artifact_snapshot` 变体时，函数按 `engine_artifact` 处理。其余 8 个同类包用的是 `selectExactArtifactSources(...)` 助手，没有这个问题。
- **约束冲突**：`packageDigest` 覆盖整棵包文件树，改这两个 `.ts` 会让两个已发布包的 digest 漂移（官网 registry 与签名 ZIP 共用同一份事实）。而这两条是仅存的、拦住 `expert-squads` typecheck 接入 CI 的错误。
- **选项**：(a) 修这两个包，接受 2 个 digest 漂移；(b) 暂不修，`typecheck:expert-squads` 先不接 CI；(c) 只接 CI 但把这两个文件排除在 include 之外（会留下盲区）。
- **裁决与落地**：选 (a)。改法不是加运行时校验，而是**让非法状态不可表示**——`source_artifact_locators` 的 schema 由 3 变体联合 `ArtifactReadLocatorSchema` 收窄为 `EngineArtifactLocatorSchema`，模型再也无法表达那个会被误处理的变体。2 个包 digest 漂移，payload 已重生成。

### 已知继承状态（非本次改动引入，未处理）

- `@opencorvus-ai/overlay` typecheck 红：工作树里未完成的 feedback-revision track 让 overlay 引用了 SDK 尚未重生成的 `feedback_revisions` 字段。
- `test/metrics-evidence-runtime.test.ts` 红：drizzle `update(EngineTaskTable).set({time_started})` 生成了 `update ... where` 语法错误。相关文件（测试、`src/engine/engine.sql.ts`）未被本次改动触及，删除快照层前后失败数一致。
- `test/build-terminal-fact-publication.test.ts` 红：`Task cancellation reconciler is already configured` —— 运行时状态泄漏型 flake，`engine/task-root-ingress-delivery.ts` 未被本次改动触及。

### Q2　候选包「授予的 ref 确实存在」该以什么为真值集合？

- **现状**：`packages/plugin/src/expert-squad-evolution-integrity.ts:83` 的 `assertCandidateStructure` 已经覆盖 T2–T4 连带变更清单里的三项——manifest 声明的 prompt 路径存在、workflow 节点的 `agent_id` 已声明、`depends_on` 指向已声明节点且无环。**唯一还缺的是「授予的 ref 确实存在」。**
- **未覆盖点**：T2 写的是「能力授予（仅限已存在的 tool/skill ref）」，但没定义「已存在」相对于谁：
  - (a) **父修订**：候选只能授予父包已经有的 ref。可在 `compareCandidateIntegrity(parent, candidate)` 内纯结构判定，不需要注册表，且天然封死「候选给自己加权限」这条奖励攻击路径；代价是候选永远无法获得新能力。
  - (b) **宿主工具注册表**：候选可以授予任何真实存在的工具。更贴近「自进化」的本意，但 `InspectedPackage` 在包工具 Capsule 里拿不到注册表，需要把校验搬到宿主侧执行，且直接触及 memory 里记的「能改自己权限的 squad 可以掩盖自身退化」。
- **为什么停下来问**：这不是实现细节，是安全边界的授权模型；选错任一边要么阻断合法进化，要么打开 T5 明确搁置的那个面。
