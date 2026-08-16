# OpenCorvus Code Smell 分析报告（重构待办长清单）

> 状态：**首轮迭代已收敛**（4 轮 19 个子 agent，第 4 轮新增基本为已知系统性模式的新实例，独立新型问题枯竭）。后续若代码演进可增开轮次。
> 首次生成：2026-08-16
> 方法：多个子 agent 按模块分片做只读审查，主 agent 汇总去重、补充架构层判断；逐轮迭代加深；高严重度发现经独立复核。
> 本文档只记录问题，不做修改。每条问题有唯一 ID（前缀+序号），供后续重构时引用与勾销。
>
> **分区导航**：ENG(engine) · SES(session/runtime) · ORC(orchestrator/scheduler/task-api/mission) · SRV(server/协议/channel) · TOL(tool/mcp/provider/llm) · AGT(expert-squad 等 agent 群) · OVL(overlay 前端) · HST(project/工作区/预览) · INF(cli/storage/config/util 基础设施) · PRO(prompt/skill/memory) · ART(artifact/work 链+web/plugin) · DEP(循环依赖+跨模块重复) · TST(测试) · R3A/R3B/R3C(第3轮补漏) · R3D(复核) · **SEC(安全，最高优先级)** · PERF(读模型性能) · XCT(跨切面统计)
>
> 严重度分布（约 440 条）：高 ~130 · 中 ~230 · 低 ~80。带"复核"标注的条目已经第 3 轮独立验证。

## 迭代记录

| 轮次 | 日期 | 范围 | 新增问题数 | 说明 |
|---|---|---|---|---|
| 1 | 2026-08-16 | engine / session+runtime / orchestrator+scheduler+task-api+mission / server+protocol+channel / tool+mcp+provider+llm / agent 类模块群 / overlay 前端 / 跨切面统计 | 183（ENG25 SES25 ORC27 SRV25 TOL25 AGT25 OVL25 XCT6） | 首轮广度扫描，7 个子 agent 并行 |
| 2 | 2026-08-16 | 剩余约 60 个模块（宿主/工作区、基础设施、prompt/skill、artifact/work 链、web 包）+ 重复与循环依赖专项 + 测试质量 | 152（HST28 INF24 PRO25 ART25 DEP25 TST25） | 6 个子 agent 并行（5 个曾因限额中断后重跑） |
| 3 | 2026-08-16 | 各轮"未看"残留（server 路由正文、mcp/computer+oauth、engine 残留、overlay styles+src-tauri 其余、channel-runtime adapters、expert-squad 大文件正文）+ 高严重度发现复核 | 74（R3A25 R3B21 R3C25 R3D3）；另复核修正/推翻 5 条 | 4 个子 agent 并行；复核确认 10/15 |
| 4 | 2026-08-16 | 收官专项：全仓读模型性能横扫（全表扫描/N+1/循环内事务）+ 安全速查（凭据落盘与日志、注入、路径穿越） | 32（PERF20 SEC12） | 2 个子 agent 并行；新型问题基本枯竭，判定收敛 |

## 总体评价

**结论：这不是"玩具代码"。** 四轮、19 个子 agent 审查后，整体判断是——底层工程能力（事件溯源、租约/幂等、原子写、zod 校验、错误建模）明显在线，很多模块能看出认真的设计意图；但它稳定地栽在四件事上，且这四件事是**系统性、跨模块反复出现**的，正是 AI 大规模生成代码的典型指纹：

1. **同一概念被实现 N 遍并各自漂移**。这是头号病症。错误信息提取 30+ 份、控制租约手写 24+ 处、单飞锁 45 处、SSE 串行写 7 份（只 1 份在用）、`stableJSON`/canonical 序列化 4 份、input-projection 5 份、timeline 比较器前后端两份、artifact 概念 4 套存储……复制本身不致命，致命的是**它们已经开始行为分叉**（card-tree 计数、escapeXml 漏转义、schema 迁移丢条件），成为潜伏 bug 的温床。

2. **分层名存实亡**。1030 个后端文件里 42% 锁在同一个静态强连通分量中；storage/protocol/control/config 这些"底座"系统性反向依赖 engine/session/task-api；`@/engine` 的 barrel 契约被 384 处深导入公然违反。模块目录像功能清单而非架构分层（90 个顶层目录，36 个只有 ≤2 个文件）。

3. **读模型性能全线塌方**。"投影函数逐行开查询 + 列表逐行调投影"的二次放大遍布每一个列表/轮询端点，最脏处（1 秒轮询、Mission/Task 看板）随历史数据无上限增长，能把一次看板请求放大到数十万次查询。这是上线后一定会爆的。

4. **测试代码与生产代码边界破裂**。20+ 处 `*ForTest` 钩子/字段常驻生产热路径（甚至 `await TestHooks.waitForIdle()` 进恢复路径、TestHooks 被 re-export 到公共 barrel）；测试 runner 首败即停使大部分测试文件从不执行；36 个测试文件 5573 行逐字复制；overlay 155 个组件零测试。

**另外三类值得单独点名**：① 安全上存在一条可串联的远程 RCE 链（本地 server 默认零鉴权 + DNS rebinding 绕过 + 任意文件读），见 SEC 区，**这是全部发现里最该马上处理的**；② 大量"仪式性过度抽象"——为线性流程模拟 5 套 brand+WeakMap 收据、为一次 mkdir 建一个 namespace、恒真/恒假的 flag 常量、恒等函数；③ 注释在骗人——百科式缩写注释 40+ 处、考古注释叙述已删实现、注释与代码实际行为相反、混入中文歇后语和其他产品名的移植残留。

**规模数据**：累计约 **440 条编号问题**（去重后），覆盖后端 90 个模块 + overlay 前端 + 6 个 sibling 包 + 测试 + 依赖图 + 安全。高严重度发现经第三轮独立复核，15 条抽检确认 10 条、推翻 3 条（已就地降级），报告可信度可控。

**要不要"笑掉大牙"**：真正让人绷不住的是这几个——`patch/index.ts` 手写一个自己注释承认是错的假 diff 算法（而 `diff` 包就在依赖里）；为回答"localhost 端口通不通"每 250ms spawn 一个子进程跑 `-e` 单行 fetch；`memory` 把某类记忆权重设成 0 导致它被索引但永远搜不到；`rewindDisabled = () => canRewind()` 把回退功能彻底锁死；`flag` 里 `DISABLE_LSP_DOWNLOAD = true` 是写死的布尔却伪装成环境变量。但这些是局部笑点，真正的结构性风险是上面四条。

## 重构优先级建议（按投入产出）

> 供后续重构排期参考。P0 应在下一个迭代内处理，P1/P2 可作为长期偿还。

- **P0-安全（SEC-01~05）**：堵死 RCE 链——server 默认鉴权、Host 头白名单防 rebinding、`readSource` 补 `isPathAllowed`、飞书 webhook 强制校验、`--mdns` 不再隐式全网卡绑定。改动小、风险高，最先做。
- **P0-性能热路径（PERF-01~07、R3A-01~04）**：把看板/Mission 列表与两个 1 秒轮询的投影批量化 + 建索引 + SQL 分页。用户可感知，且随数据增长恶化。
- **P0-正确性 bug（AGT-01 false-green 验收、HST-01 worktree 互斥失效、R3C-02 LINE 回私聊、R3C-03/04 权限集丢失、ENG-14 已终结任务通过所有权断言、SRV-02 内存泄漏）**：逐个确认并修，这些是会产生错误结果的真 bug。
- **P1-收敛重复（DEP-06~09、R3A-24/OVL-09 errorMessage、ORC-03/04 租约、ORC-14 单飞锁、AGT-04/05、ART-01/06）**：把已漂移的复制先合并（防继续分叉），再合并纯重复。建议配套加 lint（no-restricted-imports / 禁止本地重定义）。
- **P1-测试基建（TST-01 runner 不再首败即停、TST-06 参数化序数家族、TST-09 跳过要告警、补 workbench/interactive-artifact/acp 覆盖）**：否则重构无安全网。
- **P1-拆上帝文件（各区上帝文件条目：session/loop.ts、task-api/index.ts、mcp/index.ts、artifact-catalog、prompt-profile-resolver、tree-writer、TaskDirBar 等）**：优先拆有真实 bug 或高频改动的。
- **P1-断循环依赖（DEP-01~05、15）**：把 `*.sql.ts` 下沉 storage、protocol/control 收敛为 schema、util/bus/env/format 禁止引用 project。这是让模块可独立测试的前提。
- **P2-清死代码（各区死代码条目：evidence/、task-context/、acceptance/walkthrough/、util 7 文件、约 1000 行死 CSS、空 flag 常量等）**：低风险、纯减负，可穿插进行。
- **P2-清注释与命名污染（百科式注释 40+、考古注释、移植残留 openclaw/Codex 产品名、中文歇后语、scheduler 三义）**：机械清理。
- **P2-类型偿还（`: any` 541 处、`as any` 212 处、渐进开启 tsconfig 严格项）**：按模块推进，配合上面的拆分一起做。

## 严重度定义

- **高**：设计层缺陷或正确性风险，重构时应优先处理（架构混乱、隐藏 bug、大面积重复）。
- **中**：明显坏味道，影响可维护性但不立即出错（上帝文件、类型逃逸、吞错误）。
- **低**：风格与一致性问题，可顺手清理。

---

## 问题清单

### ENG — engine/

> 子 agent 总评：底子比预期好：`any` 几乎为零、吞错误的 catch 只有 4 处、`task-root-ingress-reducer.ts` 与 `task-control-driver.ts` 是可测的纯函数/依赖注入设计。真正的病灶在边界与重复：同一概念（租约、校验、artifact 查询）存在多套并行实现，barrel 契约形同虚设，最大的两个文件已成上帝文件，且混入了本该属于 prompt 层与 VCS 层的职责。

- **ENG-01 [高][重复]** `engine/control-lease.ts:7-77` 已提供按 target 参数化的通用租约（acquire/assert/renew），但同表被另外四处各自手写：`process-liveness.ts:25-37`、`task-completion-closure.ts:30-34`、`task-root-fact-store.ts:411-423`、`task-root-ingress-delivery.ts:552-562` 重复同一段查询；而 bus/channel/build-cleanup 却走 control-lease。建议：四处全部收敛到 control-lease。
- **ENG-02 [高][并发]** `process-liveness.ts:44-49` 续期是无 CAS 的裸 UPDATE（只按 `id` 更新，无 owner/expiry 校验），而 `control-lease.ts:70-76` 同语义续期带 `expires_at` fence。建议：统一走带 fence 的续期。
- **ENG-03 [高][边界]** `engine/index.ts:1-5` 注释写明"外部调用者从 @/engine 导入，绝不直接导入子模块"，现实完全相反：外部深导入 `@/engine/<sub>` 384 处、覆盖 77 个子模块，走 barrel 仅 12 处。建议：要么删掉契约声明，要么补全 barrel 并加 lint 约束。
- **ENG-04 [高][过度抽象]** `agent-coordination.ts:1640-1831` 手写 190 行 `typeof x !== "string"` 式校验器复刻 zod（同文件顶部已在用 zod），三个 normalize 函数末尾分别以 `as unknown as` 收尾（1712/1748/1830），类型安全被自己抵消。建议：改为 zod schema，删除手写校验器。
- **ENG-05 [高][上帝文件]** `task-root-ingress-delivery.ts:1-2145` 一个文件承担 ingress 持久化、事件重建、证据读取、租约激活、废弃 dispatch 恢复、控制面扫描、后台调度、进程关停交接、统计与调试投影、测试钩子，50+ 顶层函数。建议：按"接纳/激活/恢复/诊断"拆四个模块。
- **ENG-06 [低][命名]** `task-root-ingress-delivery.ts:1944-1945` 空函数 `discardTaskRootIngress` 被 `task-api/index.ts:2309/2383` 调用。**复核（第 3 轮）REFUTED（原"高"降级）**：空体是刻意设计，`:1942-1943` 注释说明"ingress 事实不可变，删除由级联负责"，`engine.sql.ts:172-174` 的 `onDelete: "cascade"` 真实存在。残留问题仅是命名误导（调用一个什么都不做的函数），建议删除空函数与调用点以免误读。
- **ENG-07 [高][命名]** `agent-coordination.ts` 的异步 API 是假的：`createOperatorSteerCoordinationRequest:713`、`createAgentCoordinationResponse:956`、`updateAgentCoordinationAction:1261`、`recordAgentCoordinationActionProgress:1368`、`cancelPendingAgentCoordinationRequests:1597` 全部 `async` 但函数体零 `await`。建议：去掉 async，避免调用方误以为可并发。
- **ENG-08 [中][死代码]** `run-blocking.ts` 与 `task-signals.ts` 整文件零调用者。建议：删除。
- **ENG-09 [中][重复]** `store.ts:854-870`、`872-888`、`890-906` 三个函数逐字相同，仅 artifact kind 字面量不同。建议：合并为按 kind 参数化的私有函数。
- **ENG-10 [中][边界]** `describe.ts:1215,1260-1265,1287-1292,1303-1306` 与 `helpers.ts:108-109` 把 LLM prompt 文案硬编码进数据层（"Do NOT ask the user again"）。建议：移到 `src/prompt/`，engine 只产出结构化事实。
- **ENG-11 [中][边界]** `git.ts:1-1840` 把完整 Git 底层（index lock、worktree、gitlink、tree checkpoint）放进 engine，对外只暴露 `namespace EngineGit:1671` 几个方法。建议：下沉为独立 `src/vcs/` 模块。
- **ENG-12 [中][其他]** `git.ts:1661-1669` 注释记录了一个已发生的栈溢出：`namespace EngineGit` 内同名 re-export 自我递归，靠 `const _commitAcceptanceRound = commitAcceptanceRound` 别名规避。建议：废弃 namespace 门面，直接 `export`。
- **ENG-13 [中][命名]** `git.ts:1562 function result(task)` 被 `1611 const result = await ...` 局部遮蔽；同文件模块级还有 `dict/clean/clip/body/message/baseline` 等单词级命名。建议：全部加领域前缀。
- **ENG-14 [中][重复]** `task-completion-closure.ts:29` 内联拼 `task-completion:${taskID}:${epoch}` 而不调用同文件 `targetID():18`；`:99-110` `assertTaskCompletionClosureOwnerInTransaction` 复制 `:23-35` 的租约查询但丢掉 `lifecycle.status !== "active"` 判断——已终结任务仍可通过所有权断言（行为 bug）。建议：三处收敛为一个读函数。**复核（第 3 轮）CONFIRMED**（修正：该函数签名本无 `now` 入参，问题是无法接受事务时间基准，与同文件另两函数的 `now` 约定不一致）。
- **ENG-15 [中][重复]** `state.ts:83-89` 内联重复同文件 `isTerminalTaskIntent:78-80` 的判定，且对类型已禁止的值做运行时兜底。建议：改调用该谓词。
- **ENG-16 [中][过度抽象]** `task-root-ingress-delivery.ts:346-498` `eventForIngress` 是 153 行按 `ingress.source` 分支的 if 链，每个分支各开一次 `Database.use`（349/364/389/432/465），共 5 次独立事务。建议：改为按 source 注册的解析表，单事务读取。
- **ENG-17 [中][其他]** 测试钩子进入生产热路径：`task-root-ingress-delivery.ts:132` 把 `runnerOverrideForTest` 定义为生产 runtimeState 字段，`:167` 每次取 runner 都先读它。建议：测试替身走注入，勿进 state。
- **ENG-18 [中][一致性]** 同一张 `engine_control_activation_lease` 表的主键用两个 ID 命名空间：`control-lease.ts:35` 用 `Identifier.ascending("call")`，`task-completion-closure.ts:56`/`process-liveness.ts:53`/`task-root-fact-store.ts:411` 用 `"activity"`。建议：统一。
- **ENG-19 [中][注释]** `helpers.ts:46-53` 的 JSDoc 是孤儿（描述 `clarificationTranscriptSection` 却挂在常量上）；`:36-37` 称"the three budget-class helpers here"，文件里实际只有一个。建议：删孤儿注释、修正数量。
- **ENG-20 [中][并发]** `cancellation-scope.ts:312-345` 手写 `setTimeout` 轮询 `SessionStatus.get` 探测 session 静默，同时又持有 `promptFinished` Promise。建议：改用状态变更事件订阅。
- **ENG-21 [中][过度抽象]** `execution-abort.ts` 全文 41 行胶水，返回类型两个字段恒等（`:31 result.cancelled = result.promptCancelled`），`emptyResult():35` 只为造一个双字段字面量。建议：合并为单字段或内联到调用方。
- **ENG-22 [中][类型逃逸]** 数据库读取后直接非空断言绕开"行可能不存在"：`task-root-ingress-delivery.ts:960`、`task-root-fact-store.ts:252`、`state.ts:227,298`、`rewind.ts:83` 均为 `.get()!`。建议：显式抛带上下文的错误。
- **ENG-23 [低][一致性]** `engine.sql.ts` 枚举字面量各写两遍易漂移：`:164` 的 `EngineTaskRootIngressSource` 与 `:177` 的 `text({enum:[...]})`；`:194-209` 的 11 项 target 与 `:217` 完全重复。建议：由 const 数组派生。
- **ENG-24 [低][一致性]** `engine.sql.ts:23-66` `ENGINE_ARTIFACT_KINDS` 中 3 项用 kebab-case，其余 37 项 snake_case。建议：统一并加迁移。
- **ENG-25 [低][一致性]** 同目录内混用绝对与相对自引用（`model.ts:26-30` 用 `@/engine/x`、`:38-40` 用 `./x`，另 6 个文件同病）。建议：目录内一律相对路径。

### SES — session/ + runtime/

> 子 agent 总评：代码质量两极：错误路径、租约、幂等的考量相当扎实，注释密度高且多为真实设计决策记录。但层次边界已经塌陷——`session/loop.ts` 4033 行内联了编排器工具构造、权限重建、预测压缩、工具解析五套子系统，与 `engine/` 形成双向环依赖。核心病灶是"用运行时断言弥补被自己 cast 掉的类型"，以及一批浮夸命名的纯转发抽象。

- **SES-01 [高][上帝文件]** `session/loop.ts:200-4033` 单 namespace 90+ 函数，`processTurn`（1345 行起，540 行）、`loop`（2099 行起，450 行）、`resolveTools`（2624 行起，695 行）三个巨兽。证据：146 行 import 覆盖 35 个模块。建议：按 turn 编排/工具解析/预算估算/权限重建拆四个文件。
- **SES-02 [高][边界]** `session/loop.ts:126-127` 会话层直接 `requireTask`(@/engine/store) 并调用 `createOrchestratorTools`(@/orchestrator/tools)；3710 行在 session 内组装编排器工具面。建议：反转依赖，由 orchestrator 注入 runtime 工厂。
- **SES-03 [高][边界]** `session/session.sql.ts` 被 `engine/` 下 17 个文件直接 import 表定义（如 `engine/producer-turn.ts:4`、`engine/rewind.ts:10`）。建议：抽出 `storage/schema` 共享层，切断 engine→session 内部穿透。
- **SES-04 [高][错误处理]** `session/loop.ts:1096-1100` `JSON.stringify` 抛错时把 `messagePayloadChars` 静默置 0（`catch { messagePayloadChars = 0 }`）。建议：估算失败必须按"最坏情况"上报，否则预测性压缩失明放行超限请求。
- **SES-05 [高][重复]** `session/loop.ts:3483` 与 `3663` 两个 `reconstructProjected*PermissionRuntime` 骨架完全同构（校验身份→校验模型→`createScopedConnectionOwner`→try 投影→`Store.set`→`asyncDispose`→`catch owner.close()` 逐步对应）。建议：抽公共模板，差异部分参数化。
- **SES-06 [高][并发]** `session/loop.ts:2612-2620` Promise executor 内 `void (async () => { for await (MessageStore.stream) })()` 无 `.catch`、无中止；`settle()` 后迭代仍继续。建议：加 AbortSignal 与 catch，否则 unhandled rejection + 流泄漏。
- **SES-07 [高][上帝文件]** `session/processor.ts:99` `create()` 单函数约 1200 行，内含 19-case 流式 switch，最大缩进 30 空格（15 层嵌套）。建议：把每个 chunk case 抽成独立 handler 表。
- **SES-08 [高][类型逃逸]** `runtime/visual-page.ts:287-706` `NODE_VISUAL_RENDER_SCRIPT` 是 419 行 JS 以 `String.raw` 内嵌，无类型、无 lint、无测试。建议：拆为独立 `.ts` sidecar 入口并纳入构建。
- **SES-09 [中][过度抽象]** `session/loop.ts:315-356` 八个对 `SessionRuntimeContractStore` 的纯转发函数；门面全仓仅被调用 5 次，Store 被 13 个文件直接调用 51 次（loop.ts 自己就 30 次）。建议：删门面，统一走 Store。
- **SES-10 [中][类型逃逸]** `session/runtime-contract.ts:203-215` `set()` 主动把判别联合 widen 成 `identityKind: string` + `?: unknown`，注释自承"so cast-invalid callers are validated"。建议：根因是调用方用 `as` 装载；改为构造函数返回已验证类型。
- **SES-11 [中][上帝文件]** `session/runtime-contract.ts:186-346` `set()` 160 行、20 处 throw，且在"进程内缓存"的 setter 里做 DB 读（`WorkerTurnDescriptor.get()` 于 261 行）。建议：校验拆为独立 validator，I/O 移出 store。
- **SES-12 [中][一致性]** `session/loop.ts:1787-1809` 与 `1848-1873` 对同一条件（已压缩且无新增材料）给出两种处理：前者走 `stopTurnWithPredictiveBudgetError`，后者手写 `TextPart` + `return "stop"`。建议：合并为单一终止路径。
- **SES-13 [中][一致性]** `session/status.ts:115-120` 六张平行全局 Record 表，五张按 `sessionID`、`publications` 按 `sessionID:inputMessageID`；`release()`(236) 手工删五张再前缀扫描第六张。建议：合并为单一 per-session 状态对象。
- **SES-14 [中][重复]** `session/processor.ts:672-678` 与 `711-717` 逐字复制的 `toolCallId` 提取（4 处 `as any`）。建议：抽 `chunkToolCallID(value)`。
- **SES-15 [中][死代码/性能]** `session/lifecycle.ts:30` `resolveSessionLifecycle` 零调用；`resolveSessionActivityStatus` 经它触发一次 `sessionUpdatedAt` SELECT 但丢弃结果；`server/routes/session.ts:802` 在会话列表中逐条调用 → N+1。建议：删中间层，直连 `SessionStatus.get`。
- **SES-16 [中][死代码]** `session/loop.ts:253` `skillSurfaceForResolvedTools` 全仓（含测试）零调用。建议：删除。
- **SES-17 [中][死代码]** `runtime/process-occurrence.ts:312` `interruptedProcessPhysicalEvidence` 全仓零调用。建议：删除。
- **SES-18 [中][错误处理]** `runtime/process-occurrence.ts:121-123` `processInstanceID` 吞掉全部 FFI / `/proc` 错误返回 undefined（`catch { return undefined }`），随后静默降级为 `isProcessAlive`。建议：区分"不支持"与"读取失败"，后者应告警。
- **SES-19 [中][其他]** `session/loop.ts:1517-1533` 就地改写 `input.msgs` 的 `part.text` 包 system-reminder 标签（`part.text = [...].join("\n")`），污染共享 message 对象。建议：改为构造投影副本。
- **SES-20 [中][命名]** `session/loop.ts:3770` `requiresProjectedRuntimeSurface` 实体是 `contract !== undefined`，唯一调用点 2862 紧跟 `?.`，语义自相矛盾。建议：内联删除。
- **SES-21 [低][其他]** `session/loop.ts:476-477` `sessionKindRequiresRuntimeContract = ...Impl` 纯重导出别名。建议：让调用方直接 import。
- **SES-22 [低][死代码]** `session/loop.ts:1615` `const modelMessages = baseModelMessages` 无意义别名。建议：删除。
- **SES-23 [低][类型逃逸]** `packages/opencorvus/tsconfig.json:7-8` 全包关闭 `noImplicitAny` 与 `noUncheckedIndexedAccess`。建议：分模块渐进开启。
- **SES-24 [低][注释]** `session/loop.ts:1569-1576`、`runtime/visual-page.ts:707-713` 大段"考古注释"叙述已废弃实现（"Until 2026-04…"、"no longer uses SSIM"）。建议：移入提交历史。
- **SES-25 [低][并发]** `session/loop.ts:416-450` heartbeat 的 `clearInterval` 分散在 437/450 两条路径而非 `finally`。建议：改 try/finally。

### ORC — orchestrator/ + scheduler/ + task-api/ + mission/ + workbench/

> 子 agent 总评：工程纪律其实不差：错误几乎不吞、租约/幂等有真实设计、注释密度高。真正的病灶是层次错位——task-api 与 orchestrator/tools 两个巨型文件承担了本该分层的全部职责，同一个"租约围栏/单飞锁/结算门"概念被独立实现三到四遍，测试钩子大量侵入生产模块，并存在整文件级死代码与空壳注册表。命名上"scheduler"一词承载三种互不相干的语义，是最容易让人误读的地方。

- **ORC-01 [高][上帝文件]** `task-api/index.ts:1` 单文件 3704 行、101 条 import，且同一文件内出现两个 `export namespace EngineService`（1422、2538）靠声明合并拼接；任务创建/删除/取消/会话删除/交互回复/Mission 恢复/看板查询全在此文件。建议：按 task-lifecycle、task-cancellation、interaction、board-query 拆分，index 仅做再导出。
- **ORC-02 [高][过度抽象]** `orchestrator/tools.ts:2689-2733` 先把 20 多个带完整 LLM description 的 `tool()` 定义塞进 `publicTools`，再 `delete publicTools[hidden]` 全部删掉——`requirements`(1199) 等各自有 8 行提示词却永远不会送给模型。建议：内部执行器降级为普通函数。
- **ORC-03 [高][重复]** `scheduler/automation-service.ts:1612`、`scheduler/event-service.ts:735`、`task-api/index.ts:779` 三份结构相同的租约围栏（AbortController + lose + renewOrAbort），仅函数名和日志串不同。建议：提取 `createControlLeaseFence` 到 `engine/control-lease.ts`。（与 ENG-01 同根源。）
- **ORC-04 [高][重复]** `engine/control-lease.ts:47` 已有 `assertControlLeaseInTransaction`，但 `scheduler/automation-service.ts` 6 处、`event-service.ts` 4 处等约 20 处手写 `!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= now`。建议：全部改调既有断言函数。
- **ORC-05 [高][重复]** `scheduler/automation-service.ts:1273` 与 `scheduler/event-service.ts:537` 的 `admitAutomationSessionWake` / `admitEventSessionWake` 逐字相同（含泛型签名与 7 行函数体）。建议：合并为 `admitSchedulerSessionWake`。
- **ORC-06 [高][命名]** "scheduler" 三义并存：`scheduler/index.ts:22`、`orchestrator/agent.ts:576` 中 `schedulerCapability/schedulerDispatchAgents/schedulerMcpOwner` 指 orchestrator 智能体本身；`scheduler/` 目录指定时器与 cron；`schedulerDelivery/scheduler_message` 指参与者协议消息。建议：智能体语义统一改回 orchestrator，协议语义改 participant/inbox。
- **ORC-07 [高][死代码]** `orchestrator/stateful-tool-names.ts:27` 26 行"单一事实来源"文档下面是 `export const STATEFUL_SNAPSHOT_TOOL_NAMES = [] as const` 空注册表；`session/message.ts:1135,1349,1381` 每轮三处调用 `statefulSnapshotToolKey` 恒返回 `undefined`。建议：整条投影链连同调用点删除。
- **ORC-08 [高][上帝文件]** `orchestrator/agent.ts:507-1185` `processInvocation` 单函数 680 行，函数体内 12 个可变 `let` 标志。建议：拆为 prepare / run / settle 三段，可变标志收进显式状态对象。
- **ORC-09 [高][注释]** `orchestrator/loop.ts:60` 注释称"Concurrent entries for the same task are serialised by `runTaskLoop`"，但 `runTaskLoop`(39-49) 只做 abort 检查后直接转调，毫无串行化。建议：补上真正的按 taskID 串行，或删掉误导性承诺。
- **ORC-10 [高][并发]** `task-api/index.ts:2850` 对已在运行的取消操作所持有的 options 对象做后置写入（`existing.options.projectDeletionAdmission = ...`）。建议：改为不可变选项 + 显式升级协议。
- **ORC-11 [高][类型逃逸]** `orchestrator/protocol/message-bridge.ts:282,430` `properties.info as any` 后手写 4 字段 `typeof` 校验，且 285-300 与 431-440 两处逐条重复。建议：用既有 `Message.Info` zod schema 一次解析。
- **ORC-12 [中][一致性]** `orchestrator/dispatch-agent-tool.ts:679,775,790,834` 等 25 处 `await import()` 被当作环依赖破除手段；`orchestrator/task-lifecycle-runtime.ts:6` 注释直言是为绕开 Task API→bootstrap→tools 的环。建议：抽出无依赖的 contract 层，消除环而非延迟加载。
- **ORC-13 [中][其他]** 生产模块内嵌测试注入态：`scheduler/event-service.ts:89-94` 六个 `*ForTest` 模块级 `let`、`task-api/index.ts:749-750`、`orchestrator/tools.ts:195`；最严重的是 `scheduler/event-service.ts:208` 生产恢复路径里 `await TestHooks.waitForIdle()`。建议：构造期注入依赖，生产路径不得引用 TestHooks。（与 ENG-17、SRV-07、AGT-18 同模式。）
- **ORC-14 [中][重复]** 全仓 45 处 `new Map<string, Promise<...>>` 手写单飞锁（`mission/session.ts:65`、`mission/execution-closure.ts:79,368`、`task-api/index.ts:746`、`orchestrator/task-session.ts:5` 等），无公共 helper。建议：提取 `singleFlight(key, fn)`。
- **ORC-15 [中][边界]** 三处 DB 轮询代替事件：`orchestrator/tools.ts:855` 硬编码 40×25ms 轮询交互表；`task-api/index.ts:2763` 1s 内 5ms 自旋等回执；`mission/execution-closure.ts:426` `while (!acquired.acquired)` 无截止时间。建议：统一走 Bus 订阅，或至少统一超时策略。
- **ORC-16 [中][类型逃逸]** `orchestrator/tools.ts:2675` `(tools as Record<string, {execute?: ...}>)[action]` 字符串反射派发 manage_task，重命名动作只在运行时抛错。建议：显式 action→handler 映射表。
- **ORC-17 [中][死代码]** 整文件无人引用：`orchestrator/acceptance-prompt.ts`、`orchestrator/build-context.ts`；函数级：`orchestrator/tools.ts:226` `taskContinuationScope` 与 `:289` `goalsContinuationScope`（40 行，二者是 `stage-input-digest.ts` 的唯一消费者，该文件亦整体不可达）、`dispatch-agent-tool.ts:164` `settleDetachedDispatchPipelineRecovery`、`error-envelope.ts:9` `parseOrchestratorTaskErrorEnvelope`、`scheduler/automation-projection.ts:82` `projectAutomations`。建议：删除。
- **ORC-18 [中][死代码]** `mission/board.ts:19` `LegacyMissionCompletionActionInput` 为一个从未发布过的仓库准备的历史兼容 schema。建议：删除 legacy 分支及 `unwrapPersistedProviderOperation`。
- **ORC-19 [中][错误处理]** `orchestrator/agent.ts:1053-1181` 单个 catch 处理三种语义不同的失败（注释自陈"Three distinct catch paths share this handler"），body 130 行嵌套五层 if。建议：按启动失败/执行失败/取消三路分流。
- **ORC-20 [中][重复]** 三套并行的"后台工作结算门"：`dispatch-agent-tool.ts:175` `acquireDetachedDispatchSettlementGate`、`scheduler/event-service.ts:220` `acquireProcessSettlementGate`、及其共同调用的 `RuntimeExecutionSettlement.reserve`。建议：收敛到 RuntimeExecutionSettlement 单一机制。
- **ORC-21 [中][上帝文件]** `orchestrator/tools.ts:1512` 起 `respond_agent_coordination` 单工具 execute 约 680 行，5 个 action 分支各自完整实现。建议：按 action 拆到 `agent-coordination/` 子模块。
- **ORC-22 [低][命名]** `orchestrator/agent.ts:473` `processTask(taskID, event, wakeSignal, wakeID, activationID, predecessorID)` 六个位置参数、末尾三个连续 `string | undefined`，调用点靠顺序对齐。建议：具名参数对象。
- **ORC-23 [低][一致性]** `orchestrator/task-lifecycle-tools.ts:118` 拒绝时返回裸字符串、`:206` 成功时返回 `{title, output, metadata}`、`cancel_task`(:253) 又只返回字符串。建议：统一工具返回契约。
- **ORC-24 [低][其他]** `orchestrator/protocol/message-bridge.ts:288` 生产错误消息里混入中文歇后语（`no "assistant" fallback (一个萝卜一个坑)`）。建议：改为纯英文技术描述。
- **ORC-25 [低][死代码]** `orchestrator/deep-research-stage.ts:5` 与 `frontend-research-stage.ts:5` 静态 import 从未作为值使用，同文件又用内联 `import("...")` 类型再导入一遍。建议：删静态 import，内联类型改 `import type`。
- **ORC-26 [低][注释]** `orchestrator/agent.ts:1055`、`:761` 注释语法破碎且指向已不存在的迁移阶段（"the post-phase-3 the pre-migration"、"reproduces the the pre-migration"）。建议：重写或删除。
- **ORC-27 [低][边界]** `task-api/index.ts:2031,2084` `getBoard`/`getBoardTag` 的 `_input?: { sync?: boolean }` 参数从未使用。建议：从公开签名移除。

### SRV — server/ + protocol/ + bus/ + channel/ + transport-protocol + channel-runtime + channel-config

> 子 agent 总评：工程底子比预期好（`as any` 仅 9 处、空 catch 仅 1 处、事件溯源与租约模型有真实设计意图），但存在三类系统性问题：抽象建了没人用（SSE 写入器 1/7 采用率）、同名常量跨模块漂移且已构成内存泄漏、`transport-protocol` / `orchestrator.ts` 两个万物皆可塞的上帝文件。channel 三处分层本身尚可，问题在类型重复声明。bus 的结算闸门虽复杂但需求真实，不列为过度抽象。

- **SRV-01 [中][一致性]** `protocol/store.ts:243` 与 `engine/task-lifecycle.ts:6` 同名常量 `TASK_TERMINAL_EVENT_TYPES` 成员不同（前者缺 `task.closed`）。建议：store.ts 直接 import 权威常量。**复核（第 3 轮）NUANCED**：漂移属实，但全仓无代码路径写出 `task.closed` 事件（仅存于迁移兼容列表），原推断的泄漏路径不成立，降级为一致性问题；真实泄漏机理见 R3D-02。
- **SRV-02 [高][并发]** `protocol/store.ts:239-241,394-398,751,375` `taskLiveSequences`/`taskLiveRetentionFloors` 仅在终态事件触发的 `clearTaskLiveReplay` 中清理，周期清扫 `compactTaskLiveReplay` 只裁剪 `taskLiveReplayEvents` 且经 `markLiveReplayFloor` 反而向 floors 写入——任务终态后若再来一条 ephemeral 事件（尾随 part delta 等），两 Map 被重新填充且此后再无终态事件清理（内存泄漏）。建议：周期清扫按保留期一并回收两 Map，或终态后拒绝为该 task 分配 liveSequence。**复核（第 3 轮）已修正机理并确认。**
- **SRV-03 [高][重复]** `server/sse.ts:15` 的 `createSerializedSSEWriter` 只有 `routes/pty.ts:50` 一处使用，另 6 个路由手写同一串行写入逻辑（app.ts:852、interactive-artifact.ts:166、orchestrator.ts:584、panel.ts:99、session.ts:962、work-ledger.ts:321）。建议：全部改用该 writer。
- **SRV-04 [高][上帝文件]** `server/routes/orchestrator.ts:537-744` 单个 SSE 处理器逾 200 行，11 个可变闭包变量、2 个 setInterval、手写 cleanup 与三次 `if (closed) return` 早退。建议：抽出 TaskEventStream 类。
- **SRV-05 [高][边界]** `server/routes/orchestrator.ts:707-713` 已订阅协议事件仍额外 setInterval 轮询数据库水位线。建议：消息变更改为事件驱动，删除轮询兜底。
- **SRV-06 [高][命名]** `server/routes/orchestrator.ts:982,986,1232` 生产路由处理器直接调用 `__conversationHistoryWindowForTest` / `__conversationHistoryBeforeForTest`。建议：重命名为业务语义，测试别名另设。
- **SRV-07 [高][错误处理]** `server/server.ts:377-393` 生产提交路径内嵌测试故障注入计数器（`if (runtimeHandoffCommitFailuresForTest > 0) { throw ... }`）。建议：改为可注入策略对象，生产构建不含该分支。
- **SRV-08 [高][上帝文件]** `packages/transport-protocol/src/index.ts:1-1372` 单文件承载 composer 意图、任务取消、@提及解析、SSE 生命周期、PTY、mailbox、work-ledger、worktree、overlay 设置、native 命令等互不相关的域（src/ 下仅此一文件）。建议：按域拆分为多入口子模块。
- **SRV-09 [高][类型逃逸]** `packages/transport-protocol/src/index.ts` 并存两套校验范式：32 处 zod schema 与 14 个手写 `is*` 守卫（`isOverlayPersistedSettings:1189` 用 20+ 个布尔与运算复刻 zod）。建议：统一到 zod，守卫由 schema 派生。
- **SRV-10 [高][类型逃逸]** `server/routes/orchestrator.ts:2076-2170` 整个会话记录投影层全部以 `any` 建模（`conversationItemTimestamp(item: any)` 等）。建议：为 transcript item 定义联合类型。
- **SRV-11 [中][类型逃逸]** `server/routes/orchestrator.ts:2274-2281` 通过 `as any` 向消息对象连续注入 7 个字段。建议：定义投影类型并返回新对象。
- **SRV-12 [中][一致性]** `server/server.ts:628-632` 为 OpenAPI 另建一棵路由树，与 `:873-875` 的运行时挂载顺序重复。建议：抽取共享挂载函数，杜绝规范漂移。
- **SRV-13 [中][死代码]** `protocol/delivery.ts:1258` `SchedulerMessageProtocol` 全仓无引用且仅包裹单字段。建议：删除。
- **SRV-14 [中][死代码]** `protocol/delivery.ts:961` `renewSchedulerDeliveryLease` 定义后全仓零调用。建议：删除或补齐租约续期调用点。
- **SRV-15 [中][重复]** `channel/registry.ts:10,20` 重复声明 channel-config 已有的字段类型与状态枚举（`z.enum(["boolean","text","secret"])` 与 `ChannelFieldType` 完全相同）。建议：从 `@opencorvus-ai/channel-config` 复用。
- **SRV-16 [中][重复]** `channel/registry.ts:20` 与 `channel/supervisor.ts:11` 各自声明一份 6 值运行时状态联合。建议：单点定义，zod 由类型派生。
- **SRV-17 [中][重复]** `packages/channel-runtime/src/bundled-env.ts:102-122` 与 `core.ts:810-830` 近乎逐行复制的原子写+fsync 块。建议：抽取共享 `atomicWriteFile` 工具。
- **SRV-18 [中][过度抽象]** `packages/channel-config/src/index.ts:85` 目录列出 27 个渠道，15 个标记 `kind:"planned"` 从未实现，实际仅 13 个适配器。建议：未实现项移出运行时目录，避免 UI 展示空壳渠道。
- **SRV-19 [中][一致性]** `packages/channel-config/src/index.ts:79` 文档地址默认指向另一产品域名（`https://docs.openclaw.ai/channels/...`，本仓为 opencorvus）。建议：改为本产品域名，并全仓检查其余移植残留。
- **SRV-20 [中][上帝文件]** `packages/channel-runtime/src/core.ts:78-112` `ChannelRuntime` 单类 1316 行，12 个 Map/Set 缓存与 6 个手写上限常量并列。建议：拆出会话绑定、消息缓冲、任务映射三个协作者。
- **SRV-21 [中][上帝文件]** `server/routes/orchestrator.ts` 单文件 2432 行、43 个路由。建议：按 task / conversation / board 拆分为三个路由模块。
- **SRV-22 [中][类型逃逸]** `bus/index.ts:1085,1198` 总线订阅回调形参为 `any`，绕过已有的 `BusEvent.Definition` 泛型体系。建议：改为 `BusEvent.Any` 联合类型。
- **SRV-23 [中][类型逃逸]** `packages/channel-runtime/src/registry.ts:7` 适配器工厂选项为 `any`，13 个渠道配置形状完全失去检查。建议：按渠道定义选项联合类型。
- **SRV-24 [低][重复]** `packages/transport-protocol/src/index.ts:1072` 与 `:1178` 两个近重复数值校验器仅上界不同。建议：合并为带上界参数的单一函数。
- **SRV-25 [低][注释]** `server/sse.ts:65`、`server.ts:869`、`transport-protocol/src/index.ts:175` 等用注释解释通用缩写（"SSE means Server-Sent Events"）。建议：删除，注释应说明为何而非术语。

### TOL — tool/ + mcp/ + provider/ + llm/ + shell/ + pty/ + lsp/

> 子 agent 总评：骨架合理（Tool.define 统一包装、CapabilityRules 集中鉴权），但有三类系统性问题：三个上帝文件把入口函数写到 300–1400 行；同一概念多份实现（溢出识别、附件物化、tool 元数据旁路各 2–7 份）；命名通胀（Authority 出现 281 次、Settlement 51 次）与百科式注释噪音。无大面积 any 滥用，工程底子尚可。

- **TOL-01 [高][错误处理]** `provider/error.ts:16-36` 与 `llm/activity.ts:304,315` 两套独立的上下文溢出判定并存且必然不一致。证据：前者 19 条带厂商注释的 OVERFLOW_PATTERNS，后者另写 7 分支正则（且 304/315 两处逐字重复同一条 130 字符正则）。建议：llm/activity 改调 `ProviderError.isOverflow`，删除本地正则。
- **TOL-02 [高][注释]** `tool/tool.ts:14-28` 注释称"只转换无歧义情况"，实现却对所有工具所有顶层字段把字符串 `"true"/"false"` 无条件转成布尔。证据：`if (v === "true") out[k] = true`，不看目标 schema 类型；`grep(pattern:"true")` 会被改坏后被 zod 拒绝。建议：改为按 ZodBoolean 字段定向 coerce。
- **TOL-03 [高][并发]** `shell/process-supervisor.ts:221-224` 租约释放挂在 `.then()` 上并 `.catch(() => undefined)`。证据：`handle.exited` 可 reject，一旦 reject 则 `spawn.lease[Symbol.dispose]()` 永不执行，task 读锁泄漏、取消屏障可能死等。建议：改用 `finally` 释放。
- **TOL-04 [高][上帝文件]** `mcp/index.ts:1-3911` 单 namespace 承载连接池/OAuth/传输/进程树/配置协调。证据：88 个导出、137 个函数，`create`（2671-3002）一函数 331 行。建议：按 connection / auth / transport / capability 拆四个模块。
- **TOL-05 [高][上帝文件]** `mcp/browser/tools.ts:536-1934` `registerTools` 单函数约 1400 行注册全部浏览器工具。建议：每类工具一文件，注册表聚合。
- **TOL-06 [高][上帝文件]** `tool/panel.ts:601-1501` 一个 `panel` 工具的 execute 内含 28 个 case、约 900 行，跨 mission/session/task/goal/artifact 全部领域。建议：拆成 action handler 映射表。
- **TOL-07 [高][重复]** `mcp/browser/permission-plan.ts` 与 `mcp/computer/permission-plan.ts` 近乎逐行复制，仅前缀字符串不同。建议：抽 `createMcpPermissionKeyBinding(prefix)` 工厂。
- **TOL-08 [高][一致性]** tool 元数据旁路存在 7 套并行实现。证据：`tool/execution-mode.ts:5,27`（WeakMap×2）、`mcp/index.ts:173-175`（WeakMap×3）、`tool/task-tool-execution-scope.ts:89`、`mcp/browser|computer/permission-plan.ts`（Symbol×2）。建议：统一为单一 `ToolAnnotations` 注册表。
- **TOL-09 [中][重复]** `lsp/index.ts:636-666` `incomingCalls` 与 `outgoingCalls` 除请求方法名外完全相同的 30 行（均含 `as any[]` + `.catch(() => [])`）。建议：参数化为 `callHierarchy(direction)`。
- **TOL-10 [中][重复]** `shell/process-supervisor.ts:202-228` 与 `235-266` `spawnTaskShell`/`spawnTaskCommand` 两段 27 行租约+capsule+track 逻辑几乎相同。建议：抽公共 `spawnTaskProcess(identity, buildCommand, factory)`。
- **TOL-11 [中][重复]** `provider/transform.ts:611-935` `variants()` 单函数 325 行，混用 npm 包名 switch 与模型 ID 子串嗅探。证据：`id.includes("k2p5")`、`model.release_date >= "2025-12-04"` 等硬编码日期与"upstream catalog returns this week"注释。建议：把 reasoning 能力下沉为模型目录数据。
- **TOL-12 [中][边界]** `tool/registry.ts:70-76` 工具注册表里用模型 ID 子串决定给 apply_patch 还是 edit/write（`model.modelID.includes("gpt-") && !includes("oss") && !includes("gpt-4")`）。建议：由 provider 能力声明驱动，registry 只消费布尔。
- **TOL-13 [中][过度抽象]** `tool/control-plane-tool-provider.ts` + `tool/control-plane-tool-composition.ts` 用全局可变单例 DI 注入 5 个 loader，但只有一份实现，且 loader 本身已是动态 `import()`。证据：`installedLoaders` 未配置即抛错，需 `project/bootstrap.ts:59` 显式安装。建议：删掉两文件，`global-tools.ts` 直接动态 import。
- **TOL-14 [中][并发]** `mcp/index.ts:846-965` 同一函数内并存三套 scoped 连接生命周期（connectionOwner / AsyncLocalStorage 池 / 一次性），且 runError+cleanupError→AggregateError 收尾样板重复三处。建议：统一为单一租借接口。
- **TOL-15 [中][一致性]** `mcp/materialize.ts:120-176` 对自家 computer MCP 的同一载荷同时按 snake_case 和 camelCase 解析（`ComputerSnakeIdentityContent` 与 `ComputerCamelIdentityContent` 并列 fallback）。建议：固定 wire 契约，删除其一。
- **TOL-16 [中][一致性]** `tool/execution-surface.ts:5-11` 同一 interface 内 `toolIDs`/`permission` 为 camelCase，`harness_projection`/`permission_layers` 为 snake_case。建议：统一风格，序列化差异放边界层。
- **TOL-17 [中][重复]** `tool/result-attachment-materialization.ts:139`、`mcp/materialize.ts:46`、`tool/multimodal-result.ts:16` 三份"工具输出→AttachmentStore 附件"实现并存。建议：收敛为一个 materializer。
- **TOL-18 [中][上帝文件]** `lsp/server.ts:1-2319` 把 spawn/terminate/quote 工具函数与 30 个语言服务器声明混在一个文件。建议：数据与运行时分离。
- **TOL-19 [中][类型逃逸]** `provider/provider.ts:347,353` 两处裸 `// @ts-expect-error` 无任何说明，压制的是 provider 深合并的真实类型错误。建议：修正 `mergeDeep` 泛型而非压制。
- **TOL-20 [中][边界]** `pty/host.ts:21-74` 把约 50 行 Node bridge 程序内嵌为 `String.raw` 字符串，不受类型检查、lint 与测试覆盖。建议：抽为独立 .ts 入口，构建期产出。
- **TOL-21 [中][边界]** `provider/github-copilot/**` 约 4400 行是 opencode/AI SDK 的 vendored fork（每文件首行标注 upstream commit）。建议：移出 src 到 vendor/ 并锁版本，避免与自研代码混审。
- **TOL-22 [低][死代码]** `tool/global-tools.ts:24` `if (toolID === "lsp") return "unavailable"` 是死分支，全仓库不存在 id 为 `lsp` 的工具。建议：删除。
- **TOL-23 [低][死代码]** `mcp/browser/tools.ts:382` `browserDiagnosticsIssueCount` 全仓库零引用。建议：删除。
- **TOL-24 [低][死代码]** `provider/vendor.ts:615` `smallModelPriority(_providerID, _region)` 两参数全未使用，返回硬编码数组，调用方只传一个参数。建议：改成常量导出。
- **TOL-25 [低][命名]** 命名通胀与百科式注释。证据：`Authority` 全仓 281 次、`Surface` 76、`Settlement` 51、`Projection` 49、`Occurrence` 44；`tool/task-tool-execution-scope.ts:21` "SDK means Software Development Kit; SHA-256 means Secure Hash Algorithm 256-bit."（全仓 20+ 处同类）。建议：删除百科式注释，收敛同义词表。

### AGT — expert-squad/ 等 agent 类模块群

> 子 agent 总评：模块切分大体合理，不是虚荣抽象：13 个 agent 模块均有 `orchestrator/*-tool.ts` 真实派发，且在 `agent/dispatch-adapter-contract.ts` 有统一契约。真正的问题在文件层：`evidence/`（60 行）、`acceptance/contract-audit.ts`（762 行）、`acceptance/checks/walkthrough/`（777 行）是彻底孤岛；9 个 `index.ts` barrel 零引用。跨模块的装配样板被逐字复制了 5~15 份。

- **AGT-01 [高][死代码]** `acceptance/contract-audit.ts:57` `runContractAudit` 762 行全仓零调用，但 `prompt/core/architect-core.txt:73,78` 强令 LLM 用 `contract_audit` 作为"存在性 grep 导致 false-green"的解药——prompt 在推销一个不存在的执行链。证据：grep 仅命中自身；`architect/output-tools.ts:428` 只校验 ID 不执行。建议：接回评分执行链，或从 schema+prompt 中一并删除该 scorer 类型。
- **AGT-02 [高][死代码]** `acceptance/checks/walkthrough/` 整个子系统（run 384 + dsl 243 + translate 150 行，含浏览器 DSL 与 LLM 场景翻译）无任何外部导入者，`acceptance/checks/index.ts:14-23` 也未导出它。建议：整目录删除。
- **AGT-03 [高][上帝文件]** `expert-squad/prompt-profile-resolver.ts:103` 单文件 4120 行（全仓第一大）、单 namespace 47 个导出，职责横跨 prompt 组装、MCP 投影、工具投影、skill 挂载、目录搜索、`settingsInventory`、`catalogDiagnostics`——后几者与文件名毫无关系。建议：按 projection / catalog / diagnostics 三块拆分。
- **AGT-04 [高][重复]** `expert-squad/prompt-profile-resolver.ts:2481,2507,2533,2559` 四个函数体逐行相同，唯一差异是 `context` 字符串是否拼接 `capability.identity.agentID`。建议：合参为 `projectMcpProjection(kind, capability, input)`。
- **AGT-05 [高][重复]** `expert-squad/prompt-profile-resolver.ts:2911` 与 `:3008` `projectOrchestratorTools`/`projectWorkerTools` 近 100 行碰撞检测逻辑复制，差异仅错误文案。建议：抽 `mergeProjectedTools(target, source, ownerLabel)`。
- **AGT-06 [高][上帝文件]** `agent/runner.ts:1015` `runAgentSessionInner` 单函数 753 行（1015–1767），内含模型解析、会话创建、MCP 移交、abort 监听、流错误捕获、双层 try/catch。建议：按 prepare / run / settle 三阶段拆函数。
- **AGT-07 [高][重复]** `architect/output-tools.ts:85-225` 把 `acceptance/types.ts:40-124` 的整套 scorer schema 复制了一份平行定义（describe 文案逐字相同）。建议：复用 acceptance 的 schema，仅做 `.omit()`/`.extend()`。
- **AGT-08 [高][死代码]** `evidence/` 整个顶层目录只有 60 行且全部导出在 src 与 test 中零引用。建议：删除。
- **AGT-09 [中][错误处理]** `expert-squad/manager.ts:400` 裸 `catch { return { kind: "partial" } }` 把任意 I/O/权限异常都归类为"包不完整"，该结论直接喂给崩溃恢复对账（`:411`、`:511` 将 `partial` 与 `absent` 同等对待——可覆盖/可丢弃）。建议：只吞 schema 解析失败，I/O 错误上抛。
- **AGT-10 [中][死代码]** 9 个 barrel 共 122 行零导入者（`frontend-design/index.ts`、`visual-qa/index.ts`、`research/index.ts`、`intent-analysis/index.ts`、`goal-workload-analyst/index.ts`、`architect/index.ts`、`frontend-research/index.ts`、`quicknote/index.ts`、`acceptance/checks/index.ts`），13 处外部引用全部直指子模块。建议：统一删除 barrel，或加 lint 落实。
- **AGT-11 [中][注释]** `acceptance/checks/index.ts:4` 写"External callers import from `@/acceptance/checks` — never from sub-modules"，但该 barrel 零引用，唯一外部调用者 `task-api/index.ts:19` 恰恰直接 import 子模块。建议：删掉无法执行的约定，或加 ESLint `no-restricted-imports`。
- **AGT-12 [中][重复]** `architect/`、`frontend-design/`、`goal-workload-analyst/`、`intent-analysis/`、`requirements/` 五份 `input-projection.ts`（共 310 行）结构克隆：同名 `XInputRefs`/`XPromptProjection`、同样的 `requireTask` + `observationSections` 骨架。建议：抽公共 `projectAgentPromptInput` + 各模块只提供 sections。
- **AGT-13 [中][重复]** 15 个文件逐字复制同一段派发入参声明（`workScope: import("@/agent/projected-agent-work-scope")...` + `onDispatchAuthorityCommit` + `onRuntimeReady` + 4 个会话字段），共 17 处命中。建议：抽 `interface DispatchedAgentInput` 供各模块 `extends`。
- **AGT-14 [中][上帝文件]** `frontend-design/output-tools.ts:1` 单文件 2366 行，含 20 个 update_* 工具、渲染器、校验器、Playwright 脚本、路径规范化。建议：按 collector / renderers / validators / capture 拆四文件。
- **AGT-15 [中][边界]** `frontend-design/output-tools.ts:74-235` 162 行 Playwright 驱动 JS 以 `String.raw` 内嵌，无类型检查、无 lint、无测试，`:232` 还有 `browser.close().catch(() => {})` 吞错。建议：挪成独立 `.mjs` 资源由构建打包。（与 SES-08、TOL-20 同一模式，全仓已三处。）
- **AGT-16 [中][一致性]** `expert-squad/evolution-mutation.ts:228-232` 在全英文代码库中硬编码中文用户确认文案（`const verb = ... ? "提升" : "恢复"`）。建议：走 i18n 或统一为英文。
- **AGT-17 [中][其他]** `agent/context-tools.ts:160-200` 停用词表里 40 余个中文词永远匹配不到：tokenizer 用 `/[\p{L}\p{N}_]+/gu`，中文无空格会连成一个 token，永不等于"的"/"了"。建议：分词或字符 n-gram，否则删掉这半张表。
- **AGT-18 [中][其他]** `expert-squad/manager.ts:31-124` 约 95 行测试注入设施（2 个 `*ForTest` Error 类、5 个模块级可变钩子）编译进生产包，`:1187` 生产分支实际 `instanceof` 判断这些测试异常。建议：移入测试专用注入点或构建期剥离。
- **AGT-19 [中][类型逃逸]** `architect/output-tools.ts:337` `z.toJSONSchema(ContractIRSchema as any) as Record<string, any>`，紧邻 `:340`、`:260` 又两处 `as any`。建议：为 JSON-schema 修复路径定义具体类型。
- **AGT-20 [中][过度抽象]** `expert-squad/multica-import.ts:1` 单文件 1538 行处理一家外部产品的导入映射（16 个 zod schema + 校验 + 映射 + 落盘），与核心 manager/registry 同层。建议：下沉为 `expert-squad/import/multica/` 子目录并拆分。
- **AGT-21 [中][一致性]** `architect/output-tools.ts:189` 面向 LLM 的描述写"scorers are shell, llm_judge, prebuilt…"，但 `:159` 判别联合成员是 `heuristic | llm_judge | prebuilt | contract_audit`，`shell` 只是 heuristic 内的 `kind`——模型会反复生成非法值。建议：描述改用真实 `type` 字面量。
- **AGT-22 [低][注释]** `frontend-design/output-tools.ts:238` 注释称"Collector — private. Callers read through getSpecs() / getStats()"，但接口已 export、两处直接消费，且 `getStats()` 在文件中不存在。建议：删除或真正收敛可见性。
- **AGT-23 [低][注释]** 百科式缩写注释再添 12 处（"UUID means Universally Unique Identifier"等，`expert-squad/multica-import.ts:19`、`package-tool-capsule.ts:12`）。与 TOL-25 合并清理。
- **AGT-24 [低][注释]** `goal-workload-analyst/output-tools.ts:10` 英文注释夹中文片段（`the §2 二次 review own the rest`）；`intent/bundle.ts:11-12` 注释句子被改写工具破坏（引号未闭合、语义断裂）。建议：重写。
- **AGT-25 [低][类型逃逸]** `agent/dispatch-adapter-contract.ts:9` `readonly inputSchema: z.ZodObject<any>` 使 13 个派发适配器的入参 schema 全部失去类型关联。建议：改为泛型参数化契约表。

### OVL — packages/overlay 前端 + Tauri

> 子 agent 总评：比典型 AI 产物克制得多：无 `@ts-ignore`、内联样式仅 32 处、Solid props 无解构（反应性纪律良好）、定时器基本都有 `onCleanup`。真正的问题不在风格而在结构：`main.tsx` 与 `tree-writer.ts` 两个上帝文件承担了全部编排，状态散落在 store / service 单例 / 组件三层，且存在一处已发生行为漂移的复制粘贴。注意：该前端实为 SolidJS 而非 React。

- **OVL-01 [高][上帝文件]** `src/main.tsx:1-2825` 模块级持有 20 个 `createSignal` 全局状态，`OverlayRoot`(1883) 起约 770 行单体 JSX，另有 18 处 `addEventListener`。建议：状态迁入 store，JSX 按区域拆为独立组件。
- **OVL-02 [高][状态管理]** 同一份 UI 状态存在三处权威：`src/store/*.ts` 的 createStore、services 模块级单例、组件内 signal。证据：`services/file-workbench.ts:71-77`、`services/desktop-update.ts:21-26` 等 21 个文件在模块作用域建 signal。建议：确立"store 唯一持有、service 只做 IO"的分层。
- **OVL-03 [高][类型逃逸]** `src/store/board.ts:34-74` 全应用最核心的 store 完全无类型：`board: null as any`、`tasks: [] as any[]`、`vcs: null as any`，全文件 56 处 any。建议：从 transport-protocol 引入真实类型。
- **OVL-04 [中][重复]** `src/utils/card-tree.ts` 与 `src/store/card-tree-stats.ts` 复制了 8 个同名函数。建议：抽公共模块，缓存层只做记忆化。**复核（第 3 轮）部分 REFUTED（原"高"降级）**："已漂移导致计数不一致"不成立——计数走 `bumpCountsForPart`/`bumpForPart`，两者都统计 `text||reasoning`；两个 `partText` 服务不同目的（剪贴板复制 vs 摘要，后者上游已过滤 reasoning），行为等价。重复本身仍属实，是未来漂移的温床。
- **OVL-05 [高][死代码]** `src/services/tree-writer.ts:742-758` 整段不可达：690-701 的 `if` 已对全部分支 `return`。建议：删除重复分支。
- **OVL-06 [高][上帝文件]** `src/services/tree-writer.ts:1-3723` 单文件承载全部事件投影，70 处 any，`applyEvent(event: any)` 分发 30+ 事件类型，100+ 顶层函数。建议：按 message / session / review / interaction 拆 handler 模块。
- **OVL-07 [高][上帝文件]** `src/components/settings/ProvidersPanel.tsx:82-1388` 单组件约 1300 行、29 个 signal；349-356 有 8 个并列 `formXxx` signal；91-96 有 5 个并列 `Set`/`Map` 按 provider id 记异步态。建议：表单收敛为一个对象，异步态收敛为 per-provider 记录。
- **OVL-08 [高][错误处理]** `src/services/tauri-transport.ts` 16 处空 `catch {}` 静默吞错（218、221、253、266、284、303、466-527 等）。建议：至少接 AppLog，与 tree-writer 声明的 let-it-crash 契约对齐。
- **OVL-09 [中][重复]** `error instanceof Error ? .message : String()` 全前端复制 103 次，并另立 17 个同义私有函数（`errorMessage` 11 处、`describeFailure` 2 处、`errorText` 2 处）。建议：提到 utils 单一导出。
- **OVL-10 [中][一致性]** 异步取数两套策略并存：20 个文件用 `createResource`，但四个最大面板（ExpertSquadPanel、ProvidersPanel、ScheduledAutomationsPanel、SkillMarketPanel）手搓 data/loading/error 三元组。建议：统一到 createResource。
- **OVL-11 [中][上帝文件]** `src/components/BrowserPreviewPanel.tsx` 1926 行内 20 个 `createEffect` + 24 个 signal。建议：把 native lease 生命周期抽成独立 hook/service。
- **OVL-12 [中][重复]** `src-tauri/src/main.rs:5676` 与 `5709` 两份 `generate_handler!` 命令清单近 30 项逐字重复（仅差 `overlay_toggle_devtools`）。建议：宏或公共列表，避免新增命令漏改。
- **OVL-13 [中][死代码]** `src-tauri/src/main.rs:5653` 与 `5749` 重复 `manage(Server::default())`，`setup` 内那次为 no-op。建议：删除。
- **OVL-14 [中][重复]** `src/main.tsx:2245-2272` 三个相邻 prop 各写一遍同样的三层嵌套三元（条件均为 `missionSubmitActive()→conversationSubmitActive()→productPillar==="work"`）。建议：一个 memo 返回三元组。
- **OVL-15 [中][并发]** `src-tauri/src/main.rs` 锁错误策略不统一：生产路径 13 处 `.lock().unwrap()` 与 4 处 `.lock().map_err(|e| e.to_string())?` 混用。建议：统一为可恢复错误。
- **OVL-16 [中][状态管理]** `src/store/conversation-agents.ts:119-122` 在响应式 store 之外另建三份并行影子缓存（`pendingTargetsBySource` 等），配 6 个 `remember*/take*/forget*` 同构函数。建议：合并为单个 pending 记录表。
- **OVL-17 [中][边界]** `src/services/tree-writer.ts:441-463` 若 `run()` 抛错，deferred 标志已被清空且跳过重建（`if (completed)` 前已重置 6 个 deferred 变量）。建议：异常路径也要重建或显式标记树失效。
- **OVL-18 [中][重复]** `TODO_TOOLS` 常量三处独立定义：`utils/card-tree.ts:51`、`store/card-tree-stats.ts:75`、`components/InlineToolPart.tsx:26`。建议：单点导出。
- **OVL-19 [中][上帝文件]** `src/components/settings/ExpertSquadPanel.tsx:309-339` 31 个 signal 平铺，四组各自手搓 data+loading+error。建议：按 tab 拆子组件。
- **OVL-20 [中][边界]** `src/store/board.ts:775-785` 注释自陈陷阱却仍导出（会返回冻结的旧目录"导致用户切换工作区后可见的陈旧状态"）。建议：改名或按语义拆成两个函数。
- **OVL-21 [低][一致性]** `src/services/tree-writer.ts:406-407` 全仓仅有的两处 `var`。建议：改 `let`。
- **OVL-22 [低][注释]** `src/utils/card-tree.ts:268` 文档注释挂错声明：`/** Sanitize markdown noise... */` 位于 `PREVIEW_SUPPRESS_TOOLS` 上方，实际描述 108 行的 `previewPlainText`。建议：归位。
- **OVL-23 [低][命名]** 同一语义三种命名并存：`errorMessage` / `describeFailure` / `errorText`。建议：随 OVL-09 一并收敛。
- **OVL-24 [低][泄漏]** `src/services/tauri-transport.ts:324-332` `mergeAbort` 两个 abort 监听在均未触发时不移除（`{once:true}` 只保证触发后清理）。建议：任一触发即互相摘除。
- **OVL-25 [低][边界]** `src-tauri/src/main.rs:5642-5995` `main()` 约 353 行 builder 链，内含多层 `#[cfg]` 分支。建议：拆出 `build_app()`。

### XCT — 跨切面（命名、重复、类型逃逸统计、模块划分）

**机械统计（第 1 轮，主 agent 扫描 packages/opencorvus/src + packages/overlay/src）：**

- **XCT-01 [高][类型逃逸]** 全仓类型逃逸密度过高：`: any` 出现 541 处、`as any` 212 处、`as unknown as` 67 处。TS 严格模式形同虚设，重构时应按模块清零。
- **XCT-02 [高][上帝文件]** 超过 1800 行的源文件有 26 个，前几名：`expert-squad/prompt-profile-resolver.ts`（4120 行）、`session/loop.ts`（4033）、`mcp/index.ts`（3911）、`overlay/src/services/tree-writer.ts`（3723）、`task-api/index.ts`（3704）、`overlay/src/main.tsx`（2825）。入口文件（index.ts/main.tsx）本身就是最大文件，属于典型"越写越往一个文件里塞"。
- **XCT-03 [高][过度抽象]** 模块碎片化：`opencorvus/src` 下约 90 个顶层目录中，36 个只有 ≤2 个 TS 文件。目录树看起来像功能清单而非架构分层（explore/、question/、quicknote/、decision-log/ 各自立目录）。
- **XCT-04 [中][错误处理]** 空 catch 块（`catch {}` / `catch (e) {}`）29 处，静默吞错。
- **XCT-05 [中][一致性]** 后端 `opencorvus/src` 有 111 处 `console.log`（前端仅 7 处），说明没有统一的日志设施或有而不用。
- **XCT-06 [低][注释]** TODO/FIXME/HACK 共 30 处，数量不大但需要逐一确认是否已失效。

（子 agent 汇总后继续补充）

### HST — project/ + browser-preview/ + browser/ + worktree/ + file/ + patch/ + panel/ + workspace/ + snapshot/ + gui/ + interactive-artifact/ + system-terminal/ + share/

> 子 agent 总评：worktree/project 两块的核心逻辑（git 锁、所有权凭证、租约）是认真设计过的，不是玩具。但代价是概念通胀：instance.ts 用 60 个私有函数手搓读写锁+租约+活动作用域+回滚所有者；worktree/sandbox/workspace 三套词汇描述同一件事。真正"笑掉大牙"的是局部：手写假 diff 算法（依赖里就有 `diff`）、为探测 localhost 存活而 spawn 子进程跑 `-e` 单行 fetch、生产函数调用 `*ForTest` 函数。

- **HST-01 [高][并发]** `worktree/index.ts:1788` 与 `1054` 同一临界区用两套 key 归一化，互斥失效：`acquire(intendedInfo.directory)` 走 `Filesystem.resolve`（不 realpath、不小写），`remove()` 走 `strictIdentity`（realpath + win32 小写）。后果：Windows 上 acquire 形同虚设；POSIX 上 `create()→reclaimInfo→remove()` 会自撞成 "Worktree is actively owned"。建议：临界区只接受 `Ownership.StrictIdentity`，禁止裸路径入口。
- **HST-02 [高][重复]** `patch/index.ts:510-535` 手写假 unified diff 且自己承认是错的（注释"in a real implementation you'd use a proper diff algorithm"，硬编码 `@@ -1 +1 @@`），而 `diff` 包已在依赖里并被 `file/index.ts:5`、`tool/edit.ts:9` 使用。建议：改用 `createTwoFilesPatch`。
- **HST-03 [高][死代码]** `patch/index.ts:358` 每次 apply_patch 都算 `unified_diff` 字段，全仓零处消费（四处写入无读取）。建议：连同 HST-02 一起删。
- **HST-04 [高][过度抽象]** `browser-preview/liveness.ts:130-139` 为回答"本地端口通不通"spawn 子进程执行 `-e` 单行 fetch 脚本，文件 12-19 行注释自陈"answers a one-second question by spawning a supervised child process"。建议：capsule 内长驻探针或直接 fetch。
- **HST-05 [高][泄漏]** `browser-preview/liveness.ts:88-91` 5s/250ms 轮询等待可达，每轮重新 spawn 一个子进程（三处这样调用）。建议：单次探针+退避或事件驱动。
- **HST-06 [高][上帝文件]** `project/instance.ts` 1768 行、约 60 个私有函数，自造读写锁与租约体系（pumpLock/acquireLock/…/downgradeLease 全在一个文件）。建议：lock/lease 抽独立可测模块。
- **HST-07 [高][重复]** `project/instance.ts:1079-1141/1159-1177/1218-1233/1253-1266` 四份"acquireLock→createLease→校验→rollback→closeLease"结构逐行复制。建议：提取 `withEntryLease(key, mode, fn)`。
- **HST-08 [中][其他]** 测试钩子进生产又两例：`project/instance.ts:1561` `await beforeConvergenceDisposalForTest?.()` 在 converge 主循环；`project/project.ts:482` `await beforeDiscoveryCommit?.()` 在发现事务前。建议：构造期注入策略对象。
- **HST-09 [中][命名]** `system-terminal/profile.ts:492` 生产函数直接 `return shouldRegenerateGeneratedProfilesForTest(...)`——名字在撒谎，且该 ForTest 名全仓（含 test/）无人调用；`createSystemTerminalProfilesForTest`（372 行纯透传）零引用。建议：改正常命名，删透传。
- **HST-10 [中][死代码]** `browser-preview/verification-test-harness.ts` 整文件 63 行零引用；`browser-preview/layout-geometry-diagnostic.ts:367-370` 生产签名挂着零引用的 `captureForTest?` 注入点。建议：删除。
- **HST-11 [中][死代码]** `file/watcher.ts:378-380` 整套 parcel 监听框架（约 500 行，含唯一消费者 `file/ignore.ts` 81 行）被默认 false 的实验开关挡住，同文件 410 行还有反向的 `..._DISABLE_FILEWATCHER`。建议：定去留，别长期休眠。
- **HST-12 [中][重复]** `browser-preview/persist.ts:1051/1070、1095/1111、1123/1140` 三对函数逐行复制仅根目录判定不同（约 90 行）。建议：参数化 root 判定。
- **HST-13 [中][重复]** `browser/runtime/index.ts:386-450` 手搓 PATH/PATHEXT 可执行查找，而 `util/which.ts` 封装的 `which` 包已支持且 `project/project.ts:16` 在用。建议：改用 which。
- **HST-14 [中][类型逃逸]** `browser/runtime/index.ts:16-17,177,213,236` Playwright 全表面退化为 `any`（`launch(...): Promise<any>` 等三个导出），playwright 是有类型的真实依赖。建议：`import type { Browser }`。
- **HST-15 [中][错误处理]** `browser/runtime/index.ts:227-229` `catch (error) { void error; throw new RuntimeError(...) }` 显式丢弃 CDP 失败根因——同文件 launch 分支却正确带了 `{ cause }`。建议：补 cause。
- **HST-16 [中][类型逃逸]** `panel/capability.ts:122,140,146,155,612,631-633` 精心设计的泛型在每个边界被 `as unknown as` 打穿。建议：承认运行时校验去掉泛型体操，或用 `satisfies` 让类型真的成立。
- **HST-17 [中][重复]** `worktree/index.ts` 同文件三份 `git worktree list --porcelain` 解析（843 正规、1909-1916 内联、2121-2133 reduce）。建议：全部走 `parseWorktreeList`。
- **HST-18 [中][并发]** `worktree/index.ts:36-37` 删目录重试上限 1200×250ms = 5 分钟且整段在 git 锁内。建议：缩短并把物理删除移出锁。
- **HST-19 [中][错误处理]** `worktree/index.ts:1379` project 级 start 脚本失败会 return false，紧接着 worktree 级失败返回值直接丢弃，行为不一致。建议：统一或注释说明。
- **HST-20 [中][并发]** `project/project.ts:542` 浮动 Promise：`if (Flag...) discover(result)` 无 await 无 catch，而 discover 内含 Glob 扫描与 DB 写入。建议：`void discover(result).catch(log)`。
- **HST-21 [低][一致性]** `project/gc.ts:130` 用原始 projectID 比对目录名，而目录按 `safeSegment` 写出。**复核（第 3 轮）REFUTED（原"中"降级）**：projectID 是 `prj_`+BASE62，`safeSegment` 对其恒等，无外部注入路径，误删不会发生；保留为契约不对称的脆弱点，建议比对同样过 `safeSegment` 以消除隐患。
- **HST-22 [低][其他]** `project/gc.ts:104-105` 用假 ID 拼路径再 `dirname` 剥掉。建议：暴露 `snapshotCacheCollectionRoot()`。
- **HST-23 [低][命名]** `project/task-runtime-materializer.ts` 整个 namespace+文件只为一次 `mkdir -p`（11 行，1 个消费者）；`project/independent-project-owner.ts` 用 4 个导出包装 `Instance.provide` 四种口味。建议：内联。
- **HST-24 [低][死代码]** `project/runtime-paths.ts:166` `sessionRootReadCandidatesFromRuntimeRoot` 零引用；`:82-88` 恒定单元素数组与同一谓词两个别名。建议：删除/收敛。
- **HST-25 [低][一致性]** `file/index.ts:797,819,845,927,929,935` 六处裸 `` $`git ...` `` 绕开全仓统一的 `hostGit` 超时/错误封装，且 `.nothrow()` 后不查 exitCode。建议：统一 hostGit。
- **HST-26 [低][命名]** `worktree/index.ts:787` 函数名 `failed()` 实际返回"git clean 未能删除的路径列表"。建议：改名 `unremovablePaths`。
- **HST-27 [低][过度抽象]** `workspace/` 与 `worktree/` + `Project.sandboxes` 概念三重叠：`workspace/workspace.ts:56` 的 create 只是包一层 `Worktree.create` 再写行，唯一消费者是 `server/routes/experimental.ts`。建议：确认是否遗留实验，是则下线。
- **HST-28 [低][死代码]** `share/` 目录只剩一张无人读写的表（`SessionShareTable` 仅 schema 注册，无 insert/select）。建议：确认分享功能是否已废弃。

### INF — cli/ + storage/ + config/ + util/ + auth/ + env/ + global/ 等基础设施 + src 顶层入口 + packages/util

> 子 agent 总评：整体不是"玩具代码"：错误建模、原子写、锁、schema 漂移检测都有真实工程考量。但存在两类系统性问题：一是 `storage/db.ts`、`attachment-store.ts`、`cli/cmd/github.ts` 等超大文件把生命周期、迁移、完整性校验、渲染混在一起；二是"防御性代码 + 解释性注释"膨胀——恒等函数、恒定返回值、百科式注释、7 个零引用文件，以及多套并行的锁/环境变量/ENOENT 判定。测试钩子渗入生产 API 有 3 处新实例。

- **INF-01 [高][上帝文件]** `storage/db.ts:302-729` `assertCurrentDataIntegrity` 单函数 428 行，13 段仅 SQL 与文案不同的"遗留纪元探针"逐字复制；`operation` 标签 `goalWorkloadCoverage` 在 295 和 636 行重复占用。建议：改为 `{id, sql, message}` 数据表驱动，并移出开库路径。
- **INF-02 [高][边界]** `storage/db.ts:1067-1105` 每次开库串行执行 5 层重活（两级迁移→触发器对账→在内存库重放整份 DDL 找漂移→全表扫描完整性自检），全在一个 `lazy()` 里无法跳过。建议：迁移/自检拆为显式启动阶段，用 schema fingerprint 短路。
- **INF-03 [高][过度抽象]** `storage/attachment-store.ts:131-1466` `AttachmentStore` 40+ 导出，名为 store 实则混四类职责：跨进程锁（claimAuthority）、图像派生（screenshotBrowserThumbnail）、LLM 能力判定（inlineFileParts/isMultimodalSupported）、提示词文本渲染（renderAttachmentInventory）。建议：拆 blob store / authority / 渲染三层。
- **INF-04 [高][死代码]** `util/` 有 7 个文件零引用：`agent-text.ts`（125 行 9 导出）、`rpc.ts`（244 行）、`queue.ts`、`eventloop.ts`、`color.ts`、`parse-section-tags.ts`、`index.ts`；同时 `browser/webpage/compiled-layout.ts:174` 与 `overlay/InlineToolPart.tsx:150` 各自另写了同功能函数。建议：整体删除。
- **INF-05 [高][死代码]** `flag/flag.ts:30` `OPENCORVUS_DISABLE_LSP_DOWNLOAD = true` 是硬编码常量而非环境变量（其余标志用 `truthy(...)`），`lsp/server.ts` 22 处判断恒真；`:57-59` `LSP_TY = false`、`LSP_TOOL = false`（后者零引用）、`:22` `OPENCORVUS_AUTO_SHARE` 零引用。建议：删常量并折叠对应分支。**复核（第 3 轮）CONFIRMED**（范围修正：只关闭自动下载/构建，已预装的 server 仍可 spawn；用常量伪装环境变量标志的可维护性缺陷属实）。
- **INF-06 [高][错误处理]** `index.ts:35` 与 `cli/cmd/serve.ts:110-115` 两套全局异常策略互相抵消：先注册的 handler `removeAllListeners` 后 rethrow（崩溃），serve 后注册的吞掉型 handler 永远不会执行。建议：统一到一处策略。
- **INF-07 [高][边界]** `auth/index.ts:75` 模块加载期固化凭据路径（顶层 `path.join(Global.Path.data, "auth.json")`），违背 `global/index.ts:23-24` 明示的懒解析契约，`Global.provideRoot()` 对 Auth 无效。建议：改为函数或 getter。
- **INF-08 [高][其他]** `check/policy.ts:32,55` `inferFamily` 无视入参恒返回 `"build"`，导致 family selector `"build"` 匹配任意 check 名，按 family 匹配的语义失效；同文件 `inferSelectors` 恒返回 `[]` 且零调用。建议：删除两个桩，`matches` 改显式 family 字段比较。**复核（第 3 轮）NUANCED**：过度匹配确认；但字面名匹配分支（`name === selector || startsWith(selector + "#")`）仍工作，"test/lint 永不匹配"表述过强。
- **INF-09 [高][上帝文件]** `cli/cmd/github.ts:438-1551` 单个 `handler` 内联闭包约 1110 行，无法单测。建议：抽 `runGithubAgent(input)` 纯函数。
- **INF-10 [高][边界]** `cli/cmd/serve.ts:80-350` CLI 命令承担完整服务器生命周期编排（约 270 行、10 个可变 let 实现重启交接/优雅停机/watchdog，结尾 `await new Promise(() => {})`）。建议：迁入 `server/` lifecycle 模块。
- **INF-11 [中][重复]** `index.ts:26-160` 与 `overlay-server.ts:26-110` 约 70 行引导代码逐字复制（yargs 选项、Log.init、.fail()、catch 三段）。建议：抽 `cli/create-cli.ts` 共享。
- **INF-12 [中][重复]** `config/config.ts:1946-1979` 与 `config/paths.ts:202-231` JSONC 解析+错误渲染逐字复制且语义不一致：`parseConfig` 未调用 `substitute()`，写回路径不做 `{env:}`/`{file:}` 替换，与加载路径对同一文件解析结果不同（潜在行为 bug）。建议：`parseConfig` 复用 `ConfigPaths.parseText`。
- **INF-13 [中][重复]** `storage/schema-contract.ts:7-29` 与 `storage/db.ts:185-210` 各一份 `queryAllFinalized`，仅 AggregateError 文案不同。建议：单一实现下沉。
- **INF-14 [中][重复]** ENOENT 判定散落 8 份实现 + 73 处内联（auth、util/filesystem、util/log、cli/cmd/import、channel/attachment、expert-squad/configuration、session/instruction、tool/truncation）。建议：`Filesystem.isEnoent` 单点导出。
- **INF-15 [中][重复]** `packages/util/src/fn.ts` 与 `opencorvus/src/util/fn.ts` 逐字相同；`lazy.ts` 两份语义不同，且 `opencorvus/src/util/lazy.ts:8-15` 的 `try { … } catch (e) { throw e }` 是无操作包装，注释却声称在防止 loaded 误置。建议：合并到 `@opencorvus-ai/util`，删空 try/catch。
- **INF-16 [中][其他]** `packages/util/src/runtime-paths.ts:82-98` 生产路径解析内嵌测试隔离分支（读 `OPENCORVUS_TEST_HOME` 等），`test-runtime-environment.ts`（184 行）随发布包出货，消费者全在 script/test。建议：测试运行时移入独立 devDependency 入口。
- **INF-17 [中][其他]** 测试钩子渗入生产 API 新实例：`installation/index.ts:273-279` `upgradeWithRunnerForTest` 导出（函数体只是转发）；`usage/official.ts:672` `read()` 第二参 `override` 仅测试使用。建议：DI 收敛到 internal 入口。
- **INF-18 [中][边界]** `global/index.ts:89-109` import 触发破坏性文件系统副作用：顶层 `await initializeOpenCorvusRuntimeDirectories(...)`，`CACHE_VERSION = "21"` 不匹配即递归 `fs.rm` 清空 cache 目录；该模块被 43 个模块 import。建议：改显式 `Global.bootstrap()`。
- **INF-19 [中][一致性]** `flag/flag.ts` 同一模块两套取值机制（加载期冻结的 `export const` vs `export declare const` + `Object.defineProperty` getter），"must be evaluated at access time"注释重复三遍（:106,117,128），但同样场景的 `OPENCORVUS_CONFIG` 等仍用 const。建议：统一 getter。
- **INF-20 [中][命名]** `id/id.ts:67-72` `schema()` 对非 task/session 只做 `startsWith`，前缀互相吞并：`Identifier.schema("plan")`（前缀 `pln`）会接受所有 `pln_node_*` id。建议：统一走 `canonicalPattern`。
- **INF-21 [中][死代码]** `id/id.ts:287-293` `directoryKey` 计算并校验后完全弃用（最后一行与前 5 行无关）；`SHORT_PATH_BODY_LENGTH=25 > MAX_LENGTH=24` 使 `shortPath` 截断恒为空操作，注释却在解释截断取舍。建议：删死计算与失效常量。
- **INF-22 [中][重复]** `cli/cmd/run.ts:80-200,380-400` 为每个内置工具手写渲染分支（12 条 `if (part.tool === ...)` 硬编码链，`glob` 与 `searchCode` 两函数除 icon 外完全相同），新增工具必须改 CLI。建议：工具自带 render 或注册表查表。
- **INF-23 [低][注释]** 百科式缩写注释全仓 16 处（`id/id.ts:108`、`storage/db.ts:182`、`storage/ddl.ts:319`、`util/filesystem.ts:331` 等）。与 TOL-25/AGT-23 合并批量删除。
- **INF-24 [低][死代码]** 一批"名不副实"小件：`bun/executable.ts:2-6` `resolve` 恒等函数被 4 处调用；`util/index.ts` 自称"Central export point"只导出 1 个符号且零引用；`config/config.ts:2047` `mergePatch`、`config/paths.ts:86` `fileInDirectory` 零调用；`config/paths.ts:43-45` `boundary` 忽略首参；`platform/capability.ts:124` 不可达分支、`:162` `collect` 是别名；`util/filesystem.ts:76-79` `size()` 假 async 且 bigint 分支不可达；`config/effective.ts:108` `hops < 64` 超限后静默返回非根 session；`util/network-proxy-test.ts` 生产功能按测试文件命名。建议：逐条清理。

### PRO — prompt/ + skill/ + memory/ + command/ + question/ + requirements/ + review/ + verification/ + conversation/ + chat/ + coding-cli/ + acp/ + session/prompt/

> 子 agent 总评：代码的工程"仪式感"远超实际需要：品牌类型、WeakMap 收据、四层 Promise 三元派发一应俱全，但底层却藏着评分逻辑自相矛盾、死表死函数、`any` 裸奔的模块。提示词层最危险——`.txt` 与 `.ts` 内嵌串双轨并行，五个功能相同的 `withX` 拼接器各占一个文件，且提示词承诺的字段在 schema 里根本不存在。整体是"抽象超前、落地欠账"。

- **PRO-01 [高][一致性]** `memory/search.ts:148-152` `compareResults` 首要键是 `KIND_WEIGHT`，把 111-118 行整条评分流水线（bm25→kind→importance→confidence→时间衰减）降级为同 kind 内的次要比较，且 kind 权重被重复施加两次。建议：删排序里的 kind 分层，只按 score 排。
- **PRO-02 [高][死代码]** `session/prompt/parts.ts:831` `createUserMessage` 全仓零引用，而 `:54`、`:525` 的错误文案仍以 `SessionPrompt.createUserMessage` 自称——该公开 API 在 barrel 里也不存在。建议：删函数，错误文案改指 `materializeUserMessage`。
- **PRO-03 [高][类型逃逸]** `conversation/history-window.ts:18-72` 整模块 8 个导出全部 `item: any`/`transcript: any[]`，在到处用 zod 与 branded type 的仓里是孤岛。建议：定义 `ConversationItem` 联合类型。（与 SRV-10 同根源。）
- **PRO-04 [高][重复]** `conversation/history-window.ts:7-16` 的两个 query schema 在 `server/routes/orchestrator.ts:166-175` 被逐字重抄（连默认值都一样），而 `server/routes/session.ts:84` 用的是模块版。建议：orchestrator 路由改 import。
- **PRO-05 [高][边界]** `question/index.ts:22-37,409,451` 故障注入钩子 `afterUserOutboxCommitForTest` 常驻生产路径，在 reply/reject 提交后同步 throw（else 分支还漏调）。建议：移出，用可注入 publication 依赖。
- **PRO-06 [高][错误处理]** `command/index.ts:103-117` `new Promise(async (resolve,reject)=>…)` 反模式：`.catch(reject)` 后仍继续 `resolve("")`，async executor 其余抛错被吞；注释"since a getter can't be async"是错的。建议：改 `return MCP.getPrompt(...).then(...)`。
- **PRO-07 [中][过度抽象]** `session/prompt/parts.ts:123-357` 为线性类型模拟了 5 套 brand + WeakSet/WeakMap 收据（prepared/materialized/persisted receipt/runtime claim/rebind）+ 9 个 consume/claim 函数，仅服务 3 个调用点。建议：合并为一个带状态字段的 PromptTransaction 对象。
- **PRO-08 [中][过度抽象]** 5 个语义相同的提示词拼接器各占一个文件（`withObservableWorkNarrative`/`withParticipantMessageLanguage`/`withFactCheckRegistration`/`appendScopedProjectSourceBoundary`/`appendSchedulerProjectSourceBoundary`），实现都是 `[prompt.trimEnd(), FRAG].join("\n\n")`，空串校验还不一致。建议：统一为 `appendSection(prompt, fragment)`。
- **PRO-09 [中][一致性]** 提示词双轨：`prompt/core/*.txt` 资源导入与 `prompt/fragments/*.ts` 模板字符串并行（build-runtime-discipline、fact-check-registration、participant-message-language、observable-work-narrative、scoped-project-source-boundary 均为 .ts 内嵌）。建议：全部下沉 `.txt`，`.ts` 只留组装。
- **PRO-10 [中][死代码]** `memory/memory.sql.ts:47` `MemoryEmbeddingTable` 建表并注册进 `storage/schema.ts:88,162`，但全仓无任何读写。建议：删表或补齐向量检索。
- **PRO-11 [中][一致性]** `memory/index.ts:18-35` 与 `memory/search.ts:10-18` 的评分常量（95/88/76/60/52、1.45/1.25/1.1、`0.8+x/200` 等）是无来源伪精度魔数；`memory/index.ts:552-590` `recall` 叠加权重后 flatMap 合并不重排序，最终顺序由 query 变体下标决定。建议：抽有注释的配置常量，recall 末尾补 sort。
- **PRO-12 [中][过度抽象]** `session/prompt/index.ts:30-43` 14 个 `(...args: Parameters<typeof SessionLoop.X>) => SessionLoop.X(...args)` 恒等包装，除破坏泛型推断外无作用。建议：直接重导出。
- **PRO-13 [中][注释]** `requirements/agent.ts:62,83` 引用不存在的编号规则手册（"Rule 22"、"Rule 11 / rule 25"），全仓另有 7 处同类（`channel/ingress.ts:399`、`project/project.sql.ts:13`、`session/llm.ts:12` 等），仓内无文档定义这些编号。建议：规则内容写进注释或删编号。
- **PRO-14 [中][注释]** `requirements/agent.ts:40-46` 空横幅注释：`// Domain artifact` 下方零代码紧接 `// Public API` 横幅。建议：删除。
- **PRO-15 [中][上帝文件]** `acp/agent.ts` 1946 行单类，四个巨型方法（processMessage 293 行、handleEvent 263 行、loadSession 198 行、prompt 194 行）承担全部协议分发。建议：按 ACP 方法拆 handler 模块。
- **PRO-16 [中][重复]** `question/index.ts:401-417` 与 `443-459` 两组 if/else 除可选字段外逐字相同，且 `:423`/`:462` 的 `if (publication)` 是死守卫。建议：合并分支，去死守卫。
- **PRO-17 [中][死代码]** 零引用 barrel 又三个：`mission-skill/index.ts`、`requirements/index.ts`、`skill/index.ts`（仅 1 处使用，其余 10+ 处深导入）。与 AGT-10 合并处理。
- **PRO-18 [中][死代码]** 确认零引用导出：`session/prompt/state.ts:27` `SessionPromptReplyError`（含 17 行解包逻辑）、`conversation/history-window.ts:71` `conversationHistoryBefore`（整条"加载更早历史"分页失效）、`review/stream.ts:67` `emitReviewStreamProgress`、`chat/session.ts:28-32` 三个 `RIGHT_SIDEBAR_*`（含 14 项工具白名单）。建议：确认后删除。
- **PRO-19 [中][一致性]** `prompt/core/requirements-core.txt:113-124,141` 列出 15 个"必须记录"的决策键并规定 Minimum 集合，但 `requirements/types.ts:67` 的 `key` 只是 `z.string().max(160)`，代码不校验不消费任何键名——提示词承诺 schema 不存在。建议：枚举化 schema 或提示词降级为示例。
- **PRO-20 [中][错误处理]** `requirements/output-tools.ts:146-157` 同时返回 `collector`（创建时快照）和 `getCollector()`，`reset()` 只重绑局部变量导致返回对象上的 `collector` 属性 reset 后永久失效。建议：删 `collector` 属性。
- **PRO-21 [低][一致性]** `prompt/projection-observation.ts:12-13` 唯一使用 `console.warn` 的位置（其余全 `Log.create`），还带浏览器兼容防御——而这是 Bun 服务端代码。建议：换 Log。
- **PRO-22 [低][类型逃逸]** `conversation/view.ts` 十处 `any`（129,133,145,296,310,315,320,329,474）；`requirements/agent.ts:137` 靠 `as RequirementsCollector` 跨 runner 边界。建议：runner 的 `getCollector` 加泛型。
- **PRO-23 [低][风格]** `session/prompt/parts.ts:768-786` 四路嵌套三元把同一个 `persistMessageWithCommit` 用不同占位参数调三遍。建议：统一参数后单次调用。
- **PRO-24 [低][注释]** `skill/manager.ts:140` 该文件唯一中文注释与全英文风格割裂。建议：统一语言。
- **PRO-25 [低][边界]** `skill/manager.ts:141-199` `BUILTIN_MARKET` 把 5 个第三方技能市场（homepage、trust 等级、推广式 notes）硬编码进二进制。建议：外置为可配置 registry。

### ART — work*/task-artifact/artifact-catalog/timeline/status/integrity/execution-capsule/capability/control/pipeline + packages/web + packages/plugin

> 子 agent 总评：artifact 概念群确实重叠且失控：同一个"产物"语义有 4 套独立存储（`engine_artifact` 表 / `task-artifact` 磁盘快照 / `interactive_artifact` 表 / `work-artifact` 走 AttachmentStore），而 `artifact-catalog` 只统一了前两套；后两套还与前者共用 `Identifier("artifact")` ID 前缀却互不可见。`work-ledger` 名字里带 ledger 实际是侧边栏历史列表，与 artifact 无关，属纯命名误导。web/overlay 未复制前端逻辑（技术栈与数据源不同），但共享的 timeline 比较器被复制了一份。

- **ART-01 [高][一致性]** `artifact-catalog/index.ts:187` `stableJSON` 有 4 份复制且实现已分歧（code-unit 排序+过滤 undefined vs `localeCompare`+过滤 vs 不过滤，见 `engine/artifact-catalog-metadata.ts:59`、`engine/cross-task-artifact-import.ts:148`、`expert-squad/multica-import.ts:430`），四者全部用于算 SHA-256 摘要；`util/canonical-digest.ts:50` 已有正确实现仅 4 个模块在用。建议：统一走 `canonicalDigestSource`。
- **ART-02 [高][一致性]** `timeline/order.ts:96` 键格式是零填充分段专为字节序设计，比较却用 `a.localeCompare(b)`，受 ICU/locale 影响（潜在排序 bug）。建议：改 code-unit 比较。
- **ART-03 [高][重复]** `overlay/src/utils/timeline-order.ts:8,23,32` 把整套 timeline 比较器复制一遍且丢掉了 DOMAIN_RANK 校验（任意非空 domain 都通过）。建议：抽到共享包同源。
- **ART-04 [高][上帝文件]** `artifact-catalog/index.ts:1` 2306 行 / 7 个导出 / ~70 个私有函数，同时承担 HMAC 游标编解码、SQL 选择、候选投影、模糊匹配、分面、排序、UTF-8 分块读、发布。建议：按 cursor / query / read / publish 拆 4 个文件。
- **ART-05 [高][并发/性能]** `artifact-catalog/index.ts:518,1277,1289,1297` 搜索把该 Task 全部 artifact 行读进内存 JS 过滤+排序+slice，翻页靠 `findIndex(stableJSON===stableJSON)` 线性扫描，`engineRows()` 无 LIMIT/WHERE 下推。建议：过滤与分页下推 SQL。
- **ART-06 [高][重复]** `task-artifact/store.ts` 同一套"捕获 primaryFailure → cleanup → 捕获 cleanupFailure → AggregateError"脚手架逐字复制 11 处（445,488,513,533,1097,1318,1501,1565,1634,1740,1800）。建议：抽 `withCleanup(work, cleanup, context)`。
- **ART-07 [高][重复]** `execution-capsule/file-worker-source.ts:87,94,101` 把 `decode/fileType/encode` 线协议编解码器以 `String.raw` 再写一遍（无类型/lint/测试），与 `file-broker.ts:27,39,51` 是跨进程互逆对且已不对称——broker 的 `decode` 处理 `__dirent`/`__stats`，worker 的只处理 `__bytes`。建议：抽独立 .ts 编译产物注入 worker。
- **ART-08 [高][死代码]** `task-context/index.ts:1-108` 整模块全仓零引用，且文件头注释声称"由 `agent/runner.ts` 注入 system prompt 尾部"——注释与代码不符。建议：删除。
- **ART-09 [高][边界]** `packages/web/src/lib/website-registry-seed-validation.ts:5` 与 `expert-squad-facts.ts:1` 用 `../../../opencorvus/src/...` 深引另一个包的源码（值导入，会被打进站点），而 web 的 package.json 依赖里没有该包。建议：走已发布入口或下沉共享包。
- **ART-10 [高][其他]** `orchestrator/tools.ts:2741` 生产的工具面构建函数直接调用 `DispatchAgentToolTestHooks.openLineage(...)`（声明在 `dispatch-agent-tool.ts:356`）——"TestHooks"已成为生产 API。建议：改名为正式 API 或构造参数注入。
- **ART-11 [中][过度抽象]** `work-artifact/profile-registry.ts:70-89` 与 `qualification-registry.ts:44-59`：Map 的 key 是单元素字面量联合，`get(id)!` 永不为空、报错分支不可达、`all()` 恒返回 1 项。建议：降为常量对象。
- **ART-12 [中][死代码]** `integrity/team-agent.ts:755` `IntegrityTestHooks` 导出 5 个私有函数全仓零引用；`execution-capsule/runtime.ts:292` `resetExecutionCapsuleRuntimeForTest()` 同样零引用。建议：删除。
- **ART-13 [中][过度抽象]** `artifact-catalog/index.ts:1198-1225` 用 `Promise.all` + per-source try/catch 搭 "provider" 插件架构，实际只有两个硬编码分支，且每支往对方字段塞空数组。建议：拉平成两次调用。
- **ART-14 [中][重复]** 模糊搜索三套阈值互不相干：`capability/fuzzy.ts:8`（共享打分器，4 模块在用）、`artifact-catalog/index.ts:111,805-838`（8 级 tier + 0.1 阈值）、`provider/provider.ts:1056`（threshold:-10000）。建议：统一到 `scoreDiscoveryFields`。
- **ART-15 [中][一致性]** `packages/plugin/src/artifact-catalog.ts:72` 用 `JSON.stringify(locator)` 做去重身份（键序敏感），同一语义在 `artifact-catalog/index.ts:2201-2216` 用 `stableJSON`。建议：统一规范序列化。
- **ART-16 [中][类型逃逸]** `control/message.ts:131` `parts: parts as any`，源头 `buildUserParts` 返回 `Array<Record<string, unknown>>`。建议：给 `SessionPrompt.prompt` 的 parts 定型。
- **ART-17 [中][边界]** `artifact-catalog/index.ts:110` `ARTIFACT_CURSOR_AUTHORITY_KEY = randomBytes(32)` 是模块级进程内随机密钥，进程重启后所有翻页游标报"authenticity check failed"。建议：按 Task 派生稳定密钥或去掉 HMAC。**复核（第 3 轮）CONFIRMED**（修正：是显式报错而非静默错乱，且游标内嵌 catalogRevision 上界重启后多半也过期；真正的问题是把"进程重启"误报成"游标被篡改"，且多进程部署下游标完全不可用）。
- **ART-18 [中][过度抽象]** `artifact-catalog/index.ts:302-409` 游标三重冗余校验：HMAC → 逐字段形状校验 → 再回编码比对。建议：保留 HMAC + 一次 schema 解析。
- **ART-19 [中][上帝文件]** `work-artifact/presentation.ts` 1368 行混了 Windows SID/icacls ACL、幻灯片几何 zod、sharp 图像校验、zip 解析、子进程编排、runtime lock 校验、回执签发。建议：按 acl / schema / ooxml / runtime 拆分。
- **ART-20 [中][命名]** `packages/web/src/content/public-market.ts:1-4,64-68` 约 4980 行中文翻译切成 `01-35 / 36-67 / 68-99 / TenthBatch` 四片（前三个是无意义下标区间，第四个连命名约定都不同），对象 spread 合并时重复 key 静默覆盖。建议：按 squad id 单文件或生成产物+重复检测。
- **ART-21 [中][过度抽象]** `packages/web/src/pages/api/site/v1/visitors/index.ts:11-43` 为页脚一个访客计数手写 43 行流式 body 读取器，配套 `__Host-` cookie、SHA-256 token digest、双重 CSRF、自定义协议号。建议：整体降级。
- **ART-22 [中][边界]** `packages/plugin/src/tool.ts:9-20` 用 `export *` 把 12 个引擎领域 schema 模块（含 1298 行文件）全部并入插件作者门面。建议：门面只导出插件 API，领域 schema 走子路径。
- **ART-23 [低][死代码]** `timeline/order.ts:13` `DOMAIN_RANK` 的 `control: 20` 从未被铸造（全仓 `domain: "control"` 0 次）。建议：删除该成员。
- **ART-24 [低][注释]** `work-artifact/presentation-inspector-process.ts:12` 上限写死 `80 * 1024 * 1024` 而报错文案硬编码 `83886080` 独立漂移，且该值是 `profile-registry.ts:17` 的复制。建议：从 profile 读取。
- **ART-25 [低][重复]** `status/task-status-snapshot.ts:50-54` `MissionTaskCounts` 与 `:7-11` `TaskActivitySummary` 字段完全相同；`:122` 对单元素数组求"汇总"恒为 total:1。建议：合并 schema。

### DEP — 全仓循环依赖与跨模块重复专项

> 子 agent 总评：模块级 166 对互引、11 个纯三元环，99 个模块中 86 个落在同一强连通分量；文件级 433/1030（42%）在单一静态 SCC 内。分层不成立——storage/protocol/control/config 等底座模块系统性反向依赖 engine/session/task-api。动态导入仅占 211/5501 边，并非环的成因。跨模块重复约 900+ 行，另有 6 处 overlay 与后端各写一份的类型（2 处已漂移）。
> 方法：Bun 脚本解析 1030 个 .ts 的 import 建图 + Tarjan 求 SCC；重复检测用去注释去空白后 8 行滑窗哈希（跨目录组）。局限：未区分 `import type`（类型边不产生运行时环，环数可能偏高）；对改写式复制不敏感。

- **DEP-01 [高][循环依赖]** `packages/opencorvus/src/**` 42% 的文件（433/1030）锁死在一个静态强连通分量里，无法单独加载或测试；含动态导入也才 466，差值仅 33。建议：先按下列反向边拆出 storage/protocol/control 三层，环会成批断裂。
- **DEP-02 [高][循环依赖]** `project/bootstrap.ts` ↔ `task-api/index.ts` 双文件纯静态互引（bootstrap.ts:16 静态 import task-api/index，task-api/index.ts:203-205 静态 import orchestrator/*）。建议：把 task 创建入口下沉为两者共依赖的接口模块。
- **DEP-03 [高][循环依赖]** `storage/schema.ts` 聚合 19 个上层模块的 `*.sql.ts`，使 storage 反依赖 16 个高层模块，而这些模块又 import storage/db.ts。建议：各 `*.sql.ts` 移入 storage 或独立 schema 包，schema 注册改为反向登记。
- **DEP-04 [高][循环依赖]** `protocol/` 作为底座却反依赖 11 个高层模块（delivery.ts:14→task-api/task-creator、:26→mission/execution-closure；session-mirror.ts:6→orchestrator/protocol/message-bridge）。建议：protocol 只保留传输/存储原语，投影逻辑上移。
- **DEP-05 [高][循环依赖]** `control/` 反依赖 session/engine/project/memory/panel/prompt 等 9 个模块（control/message.ts:3,8,13,16）。建议：control 收敛为消息 schema，执行语义交由 engine 侧适配器。
- **DEP-06 [高][重复]** `browser-preview/evidence-runner.ts` ↔ `runtime/visual-page.ts` 整套页面取证逻辑复制 279 行，其中 evidence-runner.ts:939-1049 与 visual-page.ts:376-486 共 111 行逐字相同（CJK 字体检测、glyphFingerprint、isVisible、失败请求收集）。建议：抽 `browser/page-evidence` 共享模块。
- **DEP-07 [高][重复]** Playwright"非活动超时守卫 + listener 清理"在 6 个文件复制：`browser/webpage/{extract:1064,render:279,runtime-state:435}.ts`、`browser-preview/{evidence-runner:842,layout-geometry-diagnostic:773,scroll-slice-comparison:562}.ts`。建议：提取 `withPageActivityGuard(page, label, ms, action)`。
- **DEP-08 [高][边界]** `TraceEvent` 在后端与 overlay 各写一份且已漂移：`opencorvus/src/trace/index.ts:510` 用 `Record<string, unknown>`，`overlay/src/services/trace.ts:11` 同名同字段却用 `any`。建议：移入 `@opencorvus-ai/transport-protocol` 共享包。
- **DEP-09 [高][边界]** 会话/消息视图类型两侧各写一份且语义漂移：`conversation/view.ts:43` 的 `placement` 必填，`overlay/src/store/conversation-agents.ts:43` 可选；`sessions/messages` 字段亦必填 vs 可选。建议：以后端为准下沉 transport-protocol，删 overlay 副本。
- **DEP-10 [中][循环依赖]** `engine` ↔ `session` 双向重度耦合：engine→session 50 条文件边、session→engine 20 条。建议：抽 session 生命周期事件接口，engine 只依赖接口。（SES-02/03 的图级证据。）
- **DEP-11 [中][循环依赖]** 14 个卫星 agent 模块 → `orchestrator/dispatch-turn-projection` 全靠 `await import` 打破环（architect/agent.ts:97、build/agent.ts:510、research/agent.ts:68 等），反向边全是静态——唯一真被动态导入掩盖的环族。建议：把 DispatchTurn 投影提为独立契约模块。
- **DEP-12 [中][循环依赖]** `config/` 反依赖 15 个模块（config.ts:5→provider/models、:21→project/instance-state、:40→mcp/browser/builtin、:44→skill/mount-config）。建议：各模块注册自己的配置片段。
- **DEP-13 [中][循环依赖]** 11 个无二元捷径的纯三元环：`orchestrator→tool→scheduler→orchestrator`、`env→project→llm→env`、`browser→shell→runtime→browser` 等。建议：逐个定位环上最薄的边下沉为契约。
- **DEP-14 [中][循环依赖]** 8 组文件级双向静态互引死结：`artifact-catalog/index.ts ↔ engine/store.ts`、`permission/authority.ts ↔ session/loop.ts`、`expert-squad/prompt-profile-resolver.ts ↔ tool/task-tool-execution-scope.ts` 等。建议：优先消除这 8 对，收益最高。
- **DEP-15 [中][循环依赖]** 底层工具模块反向依赖高层：`util/network-proxy.ts:1→project/instance-state`、`bus/index.ts:2→project/instance-state`、`file/index.ts:10→project/instance`、`env/index.ts:1→project/instance`、`format/formatter.ts:1→project/instance`。建议：依赖注入或参数传入，禁止 util/bus/env/format 引用 project。
- **DEP-16 [中][重复]** Chromium 子进程 bootstrap（base64 argv 解析 + launch + JSON 输出）复制 3 处：`acceptance/checks/walkthrough/run.ts:312` 与 `browser-preview/evidence-runner.ts:1165,1431` 逐字同构；错误输出块 run.ts:366-374 == `runtime/visual-page.ts:692-700`。建议：抽公共 worker 入口模板。
- **DEP-17 [中][重复]** `artifact-catalog/index.ts` ↔ `engine/cross-task-artifact-import.ts` 目录列映射复制 3 次（artifact-catalog:1424、:1708 与 cross-task-artifact-import:657）。建议：导出单一 `catalogArtifactColumns` 常量。
- **DEP-18 [中][重复]** 任务状态派生逻辑两份：`mission/projection.ts:102-112` 与 `work-ledger/projection.ts:138-148` 的 11 行完全相同。建议：抽 `projectTaskStatus(task)`。
- **DEP-19 [中][重复]** `agent/dispatch-adapter-contract.ts` 重复列举各卫星模块 tool id 清单（与 `frontend-design/static-tools.ts:20-37` 重合 18 行、`integrity/tool-ids.ts:12-21` 10 行、`visual-qa/static-tools.ts:22-32` 11 行）。建议：契约层从各模块导出的常量聚合。
- **DEP-20 [中][重复]** Windows 进程/工作区 GC 逻辑跨模块复制：`project/isolated-check-workspace.ts:225-233` == `shell/process-supervisor.ts:628-636`，另 4 个 5-7 行同构块。建议：合并到 shell 侧统一导出。
- **DEP-21 [中][重复]** 非活动超时 harness 又两份：`acceptance/checks/walkthrough/dsl.ts:181-197` == `mcp/browser/tools.ts:411-427`。建议：并入 DEP-07 的 `withPageActivityGuard`。
- **DEP-22 [中][重复]** lineage payload 投影 14 行相同：`engine/execution-interruption.ts:33-46` == `session/loop.ts:2062-2075`。建议：抽 `projectDispatchLineage(lineage)`。
- **DEP-23 [中][边界]** `message.*` 事件类型判定表写了 3 份：`server/routes/orchestrator.ts:2055` 与同文件 `:2066`（仅差一条 part.delta）、`overlay/src/services/events.ts:59` 与前者逐字相同。建议：事件分类常量下沉 transport-protocol。
- **DEP-24 [中][边界]** `AutomationTarget` 与 `NetworkProxyTestResult` 两侧逐字各一份：`scheduler/automation-service.ts:52` == `overlay/src/services/automations.ts:5`；`util/network-proxy-test.ts:7` == `overlay/src/services/config.ts:270`。建议：走共享包。
- **DEP-25 [低][重复]** 小工具函数散落复制：`stripShellQuotes` 两份（`browser-preview/dev-server-command.ts:205-216`、`tool/bash.ts:108-119`）；`pathExists` 三份（`build/agent.ts:131`、`storage/attachment-store.ts:1079`、`channel/attachment.ts:234`）；capsule `resources` zod 两份（`engine/task-execution-capsule-binding.ts:59`、`execution-capsule/runtime.ts:36`）。建议：并入 util 并加 lint 禁止本地重定义。

**依赖度排名（模块数口径）**：被依赖最多：util 72、project 61、engine 53、storage 46、session 43、id 40、agent 34、config 34、bus 30、runtime 28。依赖别人最多：server 55、tool 47、orchestrator 44、session 43、engine 41、project 36、cli 31、task-api 30、agent 28、storage 23。**project、engine、session、storage、config、agent 同时进入两榜，是分层失效的核心证据——它们既当底座又当上层。**

### TST — 测试代码质量

> 子 agent 总评：不是典型的 AI 烂测试：`toBeDefined/toBeTruthy` 全仓仅 10 处，无一个无人认领的 `.skip/.only/.todo`，主流断言是 `toEqual` 深比较，有共享 fixture（152 个文件复用）。真正的病灶在别处：规模失控的复制粘贴（expert-squad 序数家族 36 文件 5573 行）、把"文本够长、包含关键词"当断言、整片模块零覆盖（overlay 全部 155 个组件 + opencorvus 5 个顶层模块）、以及 runner 遇错即停导致大部分文件从不执行。统计：389 个测试文件 / 86,793 行 / 4641 处 expect。

- **TST-01 [高][其他]** `packages/opencorvus/script/run-tests.ts:43-46` runner 串行执行 275 个文件且首个非零退出即 `break`——配合已知的 algorithm-batch-one 预存失败，其后所有文件从不运行。建议：改为收集全部失败后汇总退出，可选 `--bail`。
- **TST-02 [高][覆盖空白]** `src/workbench/`（1156 行）全仓测试零引用，且 `board.ts` 正被本分支修改。建议：先补契约测试再继续改。
- **TST-03 [高][覆盖空白]** `src/interactive-artifact/`（1773 行）无任何测试导入——仅有的"测试"只测提示词字符串不碰实现。建议：至少覆盖 mcp-app-lifecycle 与 persist。
- **TST-04 [高][覆盖空白]** `src/acp/`（2115 行）、`src/pty/`（1110 行）、`src/system-terminal/`（917 行）零覆盖。建议：按协议边界补最小握手/生命周期测试。
- **TST-05 [高][覆盖空白]** `packages/overlay` 46,441 行 `.tsx`／155 个组件零组件测试（无 testing-library；66 个测试文件全为 .test.ts 只测 services/utils，111 个 service 也仅约半数被覆盖）。建议：先给高改动组件引入渲染测试。
- **TST-06 [高][复制粘贴]** `test/expert-squad/` 序数家族 36 个文件 5573 行逐字复制，仅替换域名清单（diff 两个文件仅差 squad id 列表与标题）。建议：合并为 `describe.each(domainBatches)` 参数化文件。
- **TST-07 [高][假断言]** `test/expert-squad/sixth-domain-expansion-packages.test.ts:221-256` 用"长度/字节数/关键词存在"冒充内容校验（`expect(method.content.length).toBeGreaterThan(4_000)`），×10 域 ×9 文件 ≈100 个用例。建议：对结构化 manifest 精确断言，散文质量交给独立评测。
- **TST-08 [高][竞态]** `test/algorithm-batch-one.test.ts:500-520` 用 25ms `Promise.race` 断言操作"仍未完成"。建议：改为对可观测状态（锁持有者/receipt 行）的确定性断言。
- **TST-09 [高][跳过]** `test/execution-capsule-*.test.ts`（5 文件）与 `test/work-artifact/packaged-lifecycle.test.ts:19` 环境不满足时静默降级 `test.skip` 仍报绿——Windows 开发机上 `src/execution-capsule/`（1870 行）实际零执行。建议：CI 强制环境存在，或跳过时显式告警计入报告。
- **TST-10 [高][其他]** `test/evolution-artifact-evidence-host.test.ts` 3351 行仅 8 个用例，单个 test 跨 707 行（2023-2729）。建议：按阶段拆独立用例。
- **TST-11 [高][竞态]** 同文件 `:89-93` 模块级 `let project` 被 4 个用例共享且不重置数据库（顺序依赖）。建议：`beforeEach` 建独立 project。
- **TST-12 [中][假断言]** 提示词字符串测试是"自我复制式重言"：断言常量包含从其自身抄来的整句（`test/prompt/interactive-artifact-guidance.test.ts:8-13`、`test/mission-scope-partition-policy.test.ts:15-16` 等 4 处同型）。建议：只保留组装断言，删逐句 includes。
- **TST-13 [中][假断言]** `.map(() => true)` 惯用法 55 处，失败时只显示布尔数组，丢失是哪一项失败。建议：for 循环逐项断言带标识。
- **TST-14 [中][其他]** 测试硬编码包版本 `"2026.08.13.1"` 共 112 处，一次版本 bump 红掉约百个用例。建议：从 manifest 读取或断言格式。
- **TST-15 [中][竞态]** 固定 sleep 当同步点：`test/build-terminal-fact-publication.test.ts:450`、`test/persistent-instance-publication.test.ts:30`、`test/bus-durable-outbox.test.ts:76`（睡 25ms 后断言 `disposed === false`；该文件 20 行已有 `waitFor` 却不用）。建议：换条件轮询。
- **TST-16 [中][竞态]** `test/dispatch-agent-detachment.test.ts:155-160` 用 1000ms 硬超时做断言上界；`overlay/test/selected-task-stream-live-replay-reopen.test.ts:76` 断言真实墙钟耗时（仓内已有可注入 clock 未用）。建议：事件驱动等待/注入时钟。
- **TST-17 [中][mock 失真]** `test/fact-kernel-schema-migration.test.ts:25-66` 的"旧 schema"是由当前 DDL 反向 DROP/ALTER 拼出来的，并非任何真实发布过的版本。建议：固化真实旧版 DDL 快照作迁移输入。
- **TST-18 [中][mock 失真]** 直接改写模块命名空间对象：`test/engine-git-batched-raw-import.test.ts:39` `(fs as any).readFile = ...`、`test/engine-git-batched-transaction.test.ts:85,316,467` `(Worktree as any).withGitLock = ...`（仓内已有 127 处 spyOn 正确用法）。建议：依赖注入或 spyOn。
- **TST-19 [中][假断言]** 测试中 111 处 `as any` 集中在对未类型化 metadata 的断言。建议：给 task metadata 定义 zod schema，parse 后断言。
- **TST-20 [中][harness 重复]** `waitFor` 轮询助手至少 5 个文件各写一遍（bus-durable-outbox:20、memory/project-memory:104、engine-interaction-recovery:66,75、intent-analysis-blocker-settlement:291）。建议：收进 `test/fixture/`。
- **TST-21 [中][harness 重复]** `afterEach(disposeAll + resetMemoryDatabase)` 在 142 个文件逐字重复。建议：下沉 `test/preload.ts` 或 `useMemoryProject()` 助手。
- **TST-22 [中][复制粘贴]** `test/*-domain-incomplete-settlement.test.ts` 5 文件同构，约 25% 逐字相同的脚手架。建议：抽共享 fixture builder。
- **TST-23 [低][其他]** `test/fixture/`（177 引用）与 `test/fixtures/`（3 文件）两个只差一个字母的目录并存。建议：合并。
- **TST-24 [低][其他]** `test/fixture/linux-runtime.ts:1` 硬编码 WSL 发行版 `"Ubuntu-24.04"`，探测失败静默跳过整批 capsule 测试。建议：可配置+失败报原因。
- **TST-25 [低][其他]** `script/run-tests.ts:33` `--timeout=0` 关闭每用例超时，只剩外层 120s 无输出检测兜底。建议：设合理上限。

### R3C — 第 3 轮补漏：channel 适配器正文 + expert-squad/session/agent 大文件函数体

> 子 agent 总评：骨架质量高（zod 严格校验、错误信息具体、超时/签名普遍到位），但"同一段逻辑被复制 N 份并各自漂移"是主导病症；其次是测试钩子成规模进生产、死代码与注释失真。

- **R3C-01 [高][重复]** `expert-squad/package-tool-capsule.ts:53-185` 与 `:252-289` 同一套 RPC 编解码器写了两遍（宿主 TS 版 + `WORKER_SOURCE` 模板字符串 JS 版）且已漂移：宿主 `encode` 处理 `Response`(:61)，worker 版无 Response 分支。建议：单一源生成或注入。
- **R3C-02 [高][其他]** `packages/channel-runtime/src/adapters/line.ts:142-143` `channel` 与 `user` 是同一个表达式 `source?.userId ?? groupId ?? roomId`——LINE 群事件里两者同时存在时 `channel` 取到 userId，回复被 push 到私聊而非群（行为 bug）。建议：channel 用 `groupId ?? roomId ?? userId`。
- **R3C-03 [高][死代码]** `agent/host-agent-registry.ts:42` `const permissions = nativeAgentPermissionProfiles(config)` 计算后从未使用（两个兄弟注册表都用了），orchestrator 因此没有任何 permission ruleset（行为 bug）。建议：补挂或删除。
- **R3C-04 [高][错误处理]** `agent/native-agent-materializer.ts:36-38` `if (item.permission)` 守卫使 base 定义无 permission 字段时用户 `config.agent.*.permission` 被静默丢弃——host 定义恰好无该字段。建议：无条件 merge 或显式报错。
- **R3C-05 [高][其他]** `packages/channel-runtime/src/adapters/slack.ts:29-35` 无条件注册 `app.event("message")` 仅用于 `console.log` 原始事件并打印消息正文前 60 字符（生产日志泄露用户内容）；`stt/pipeline.ts:60` 同病（转写文本前 80 字符）。建议：删除或降为 debug 级脱敏日志。
- **R3C-06 [高][其他]** 测试钩子进生产新计 11 处：`session/wake.ts:436`、`session/compaction.ts:1030`、`session/loop.ts:4022`、`session/prompt/state.ts:849`、`agent/projected-worker-turn-owner.ts:95`、`expert-squad/package-tool-bundle.ts:276`、`expert-squad/manager.ts:31,37,55`、`frontend-design/agent.ts:436`、`research/agent.ts:273`、`visual-qa/agent.ts:326`；最严重的是 `visual-qa/index.ts:1` 把 `VisualQaTestHooks` 再导出到公共 barrel。建议：与 ORC-13/ENG-17 一并统一注入机制。
- **R3C-07 [高][重复]** `visual-qa/annotated-screenshot.ts:583` 与 `frontend-design/visual-region-binding-tool.ts:662` 两份 `escapeXml`，后者漏掉 `'` 转义，两者都生成 SVG——单引号属性上下文会破损/可注入。建议：合并为一份完整实现。
- **R3C-08 [高][并发/性能]** `session/message-store.ts:42-62` `persistedPart` 每个 part 单独查父 Message 取 sessionID（调用方已持有 message 行）；`:315-319` `latestConversationAgentActivityByExecution` 每行开一次 `Database.use`，外层还是 8 类型×分页循环（N+1）。建议：批量传参/单事务。
- **R3C-09 [中][重复]** `adapters/feishu.ts:35-47,95,97` 自带 `ServeOpts/Server/Serve` 与 path 归一化，而 `adapters/http.ts:1-24` 已导出同义实现且其余 7 个 webhook adapter 全在用——唯一未迁移者。建议：迁移。
- **R3C-10 [中][重复]** `safeEqual` 四份逐字拷贝：`line.ts:23-27`、`mattermost.ts:24-28`、`whatsapp.ts:34-38`、`callback-crypto.ts:24-28`。建议：收敛到 callback-crypto。
- **R3C-11 [中][重复]** "text MVP" 降级分支四份逐字拷贝（`dingtalk.ts:104-108`、`googlechat.ts:105-109`、`line.ts:85-89`、`msteams.ts:88-92`，仅平台名不同）。建议：抽公共 helper。
- **R3C-12 [中][重复]** `expert-squad/evolution-history.ts:194-228` 与 `:230-264` `currentRows`/`historicalRows` 约 35 行近逐字重复，只差表名与 partition 字面量。建议：参数化。
- **R3C-13 [中][错误处理]** `expert-squad/multica-import.ts:972-976` `catch` 把 MCP 探测的真实失败原因（鉴权/DNS/协议）完全丢弃，用户只拿到三选一的猜测清单。建议：附原始错误。
- **R3C-14 [中][一致性]** `feishu.ts:224-226` 唯一对 handler 做 `.catch(console.error)` 仍返回 200 的 adapter，其余 5 家让异常上抛（→500，平台重投）——同一 runtime 投递语义分叉。建议：统一。
- **R3C-15 [中][其他]** `startThread` 返回 `` `${Date.now()}` `` 伪造 thread id：`wecom.ts:96-99`、`dingtalk.ts:92-95`、`line.ts:73-76` 直接返回，另 6 家作为兜底——该值会被当作持久 thread 键回传。建议：显式返回"不支持"语义。
- **R3C-16 [中][类型逃逸]** `expert-squad/evolution-history.ts:306-310` `typedArtifact<T>` 只比对运行时字符串后 `as FrozenArtifact<T>` 无校验强转；全文件 30 处 `payload!`，`:824,827` 还有 `evaluation?.payload!`（可选链后接非空断言）。建议：zod 判别解析。
- **R3C-17 [中][并发/性能]** `evolution-history.ts:655-748` `integrityIssuesForTarget` 近似 O(campaigns × artifacts²)，每次比较还做一次 canonical JSON 序列化。建议：预建索引。
- **R3C-18 [中][并发/性能]** `evolution-history.ts:266-304,757-763` `frozenRead` 拉取项目内全部 evolution artifact 逐条 zod 解析，分页在内存里做。建议：SQL 分页+按需解析。
- **R3C-19 [中][错误处理]** `adapters/matrix.ts:197-207` `whoami()` 在 `data.user_id` 缺失时返回 undefined，`event.sender === this.userId`(:170) 恒不成立，机器人会处理自己发的消息形成回环。建议：缺失即抛错。
- **R3C-20 [中][重复]** `upsertByID` 三份（`research/output-tools.ts:361`、`visual-qa/output-tools.ts:89`、`integrity/team-agent.ts:176`），函数体一致仅变量名不同。建议：抽 util。
- **R3C-21 [中][死代码]** `session/model-image-input.ts:4-21` import 7 个符号再 re-export，其中 3 个在正文从未使用，纯为转发而导入。建议：调用方直接 import。
- **R3C-22 [中][注释]** `session/tool-result-normalization.ts:29-40` `...result` 展开后又条件性补写三个字段——已被覆盖恒为 no-op；头部注释称"persists one strict result shape"，实际把任意未知键透传。建议：修实现或改注释。
- **R3C-23 [中][重复]** `session/text-mime.ts:111-125` 同一 payload 被 base64 解码两遍（一次仅为校验后丢弃，上限 200KB）；注释称接受 percent-encoded 变体但 `:131` 正则会拒绝。建议：解码一次复用，修注释。
- **R3C-24 [低][死代码]** `agent/filter-tools.ts:14-24` `_opts` 参数未用（两个调用方在传值）；`agent/retrieval-tools.ts:3-5` 是无操作别名且名字里的 "Readonly" 不对应任何过滤；`session/summary.ts:116-125` 校验 `messageID` 却不使用；`evolution-history.ts:33` `InstallationScope` 零引用。建议：清理。
- **R3C-25 [低][注释]** `msteams.ts:99,118` `?? channel` 兜底不可达；`frontend-design/schema.ts:42` `url.hostname === "::1"` 恒假（WHATWG hostname 带方括号）；`session/repair-hint.ts:1-21,133-161` 约 50 行注释服务 130 行代码，内含内部规则编号与具体 task id，全文件以 `Record<string, any>` 为主要类型。建议：清理。

### PERF — 读模型性能专项（第 4 轮）

> 子 agent 总评：病灶已扩散到全部读模型层——**投影函数逐行开查询 + 列表逐行调投影**构成二次放大，最脏的两处（1 秒轮询、Mission/Task 列表）随历史数据无上限增长。方法：两个自写扫描器（循环体内 SQL、无 where/limit 的 `.all()`）定位候选后逐个读码确认频率与量级，核查 1032 个源文件。（R3A 的 mailbox/event-projection/task-event 等已列，此处为其余模块的新实例。）

- **PERF-01 [高][性能]** `engine/store.ts:1301,1308` `listInteractions`/`pendingInteractionCounts` 全表扫 `engine_interaction_request` 并对每行跑 `projectInteractionRowInTransaction`（≈5 查/行：outbox+ledger+while 血缘回溯 2 查/跳+outcome+source），扫完才按 task 过滤；该表无 `task_id` 索引。建议：SQL 内按 task_id 过滤+建索引，投影批量化。
- **PERF-02 [高][性能]** `task-api/index.ts:1317-1330` `taskItems` 每行调 `listInteractions(task.id)`，即 O(任务数 × 全部交互 × 5)；入口 `getProjectBoard`/`getGlobalTaskBoard`/`routes/gateway.ts:98`。100 任务 × 500 交互 ≈ 25 万次查询/请求。建议：一次分组聚合。
- **PERF-03 [高][性能]** `mission/projection.ts:127` + `server/routes/mission.ts:346` 列表每个 mission 调 `missionRecord` → `pendingInteractionCounts(taskIDs)`，传了 ID 仍全扫全投影（limit 默认 100）。建议：外层算一次下传。
- **PERF-04 [高][性能]** `scheduler/automation-service.ts:932-934`（`POLL_INTERVAL_MS=1000`）每秒：全扫 automation 表+每定义 1 次 tombstone 查+`.map(row => Database.use(...))` 每定义一个独立事务；`automation-projection.ts:56` 加载该 automation 全部历史 run，每 run 再 3 查——成本随运行历史永久线性增长。建议：只取最新 run。
- **PERF-05 [高][性能]** `protocol/scheduler-message.ts:369-372`（`DELIVERY_POLL_INTERVAL_MS=1000`）每秒依次全扫三遍（`listPendingSchedulerProjectIDs` 跨全 project 全历史扫、`nextSchedulerDeliveryDueAt` 全扫+O(n²) 去重、`listUnansweredSchedulerSessionWakes` 第三次全扫），inbox 行无清理。建议：状态落列+索引，SQL 侧过滤。
- **PERF-06 [高][性能]** `engine/durable-activity.ts:119-123` `readTaskDurableActivityScope` 每 task 全扫全投影交互表再过滤，`:243-245 readMissionDurableActivity` 又逐 task 调用；暴露为 `routes/mission.ts:392` 的 activity-cursor 轮询端点——本应最廉价的游标接口最贵。附 `tool/task-run-evidence-host.ts:113` 二次投影白翻一倍。
- **PERF-07 [高][性能]** `protocol/delivery.ts:915-929` `claimNextSchedulerDelivery` 无 status/visible_at/limit，取该 actor 全部 scheduler 消息逐行投影（3 查/行）只为找第一条 pending，外层 `scheduler-message.ts:163` 是 `while(true)` 排空 → O(历史²)。
- **PERF-08 [中][性能]** `engine/store.ts:1269-1298` `listGlobalTasks` 假分页：全扫跨 project 未归档任务逐行删除判定+投影，过滤排序切片全在内存；`:1260 searchProjectTasks` 直接传 `MAX_SAFE_INTEGER`。建议：SQL 分页。
- **PERF-09 [中][性能]** `engine/store.ts:246-262` `projectTaskRowInTransaction` 每任务 2 查，且 `taskDeletedInTransaction` 在 :261 与 :247 各跑一次（重复）——所有任务列表的底数乘子。建议：批量 CTE 投影。
- **PERF-10 [中][性能]** `mission/session.ts:306-311,333-339` 首查只 `select({id})` 再逐行 `await Session.get(row.id)`（每行 1 事务+2 查），limit 100 → 多 200 查。建议：首查直接取全列。
- **PERF-11 [中][性能]** `session/index.ts:1031,1151` `rows.filter(row => !Database.use(db => deletedInTransaction(...)))` 每行开一个事务（:934、:993 同）。建议：改 `NOT EXISTS` 子查询。
- **PERF-12 [中][性能]** `session/index.ts:1068-1084` `treeInProject` 每次把整个 project 全部 session 拉进内存走子树，而 `engine/store.ts:270 sessionIDsForTask` 已有 `WITH RECURSIVE` 正解；热点 `routes/session.ts:734,777,883`、`orchestrator.ts:2185`、`task-root-message.ts:47,71`。建议：复用递归 CTE。
- **PERF-13 [中][性能]** `routes/session.ts:735`、`routes/orchestrator.ts:2213-2217` `Promise.all(sessionIDs.map(id => Session.messages({sessionID:id})))` 无 limit，`Session.messages` 把整个会话历史按 50 一页抽干，无上界。建议：只取所需窗口。
- **PERF-14 [中][性能]** `bus/index.ts:653-700` 每事件每 durable 订阅者约 5 个独立事务（outcome 查+租约读+acquireControlLease+回执写）外加每 target 一个 `setInterval` 续租定时器——位于全系统最热的写路径。建议：合并事务、共享续租。
- **PERF-15 [中][性能]** `engine/describe.ts:443-452` 编排器每轮任务描述都跑 `describeTaskScheduledWaits`：每 delay 定义开独立事务调 `projectAutomationInTransaction`（连带全部历史 run × 3 查），截断发生在之后。建议：先截断再投影或只取最新。
- **PERF-16 [中][性能]** `scheduler/automation-service.ts:261-263` `listRunsForAutomation` 每 run 开两个独立事务（投影 3 查+session 查），run 无 limit。建议：批量+分页。
- **PERF-17 [中][性能]** `scheduler/event-service.ts:1059,496,224` `fires()`/`recoverProjectFires`/`acquireProcessSettlementGate` 均全扫 `event_job_fire` 逐行投影后内存过滤。建议：SQL 过滤。
- **PERF-18 [低][性能]** `session/index.ts:460-470` `lineageInProject` 走完整父链（2 查/跳），但 `assertLineageInProject` 只取 `lineage[0]`，被 `chat/session.ts:170` 在列表里逐行 await。建议：只查所需一跳。
- **PERF-19 [低][性能]** `engine/task-session-lineage.ts:79-100` `taskIDForSession` 只缓存命中，未命中每次重走血缘（2 查/跳）且 `visited.includes` 为 O(n²)；76 处调用多在循环内。建议：缓存未命中或改递归 CTE。
- **PERF-20 [低][性能]** `engine/writer.ts:36-40` `abortOpenToolParts` 拉全部消息后逐条 `MessageStore.parts()`，每次中断触发。建议：SQL 定位开放 part。

### SEC — 安全速查专项（第 4 轮）

> ⚠️ **最高优先级**：这是本次审查中风险最高的一组发现。子 agent 总评：凭据落盘（0600）、多数 webhook 签名校验、web 站点、overlay 静态资源做得扎实；但**本地 server 默认零鉴权 + Origin 防线可被 DNS rebinding 绕过 + 一个无限制的任意文件读接口**构成可串联的高危链，飞书适配器默认完全不校验。
> 说明：这是维护者对自家代码的防御性安全审计，如实记录以便修复。以下多条可组合成"恶意网页/局域网主机 → 读取全部 provider API key 或远程执行命令"。

- **SEC-01 [高][认证绕过→RCE]** `packages/channel-runtime/src/adapters/feishu.ts:194` 唯一校验是 `if (this.verificationToken && token !== ...)`——未配置令牌时完全不校验，且无签名验证（其他家都有）；默认 `0.0.0.0:16666`，channel-config 把 verificationToken 标为 Optional，默认 permission profile 为 standard（bash/edit/write 全 allow）。触发：能访问该端口者 POST 一条 `im.message.receive_v1` 即可在维护者机器执行命令。建议：强制要求 verificationToken 并补 `X-Lark-Signature` 校验，缺失即拒绝启动。
- **SEC-02 [高][任意文件读取]** `packages/opencorvus/src/file/index.ts:906-911` `readSource` 只校验"必须绝对路径"，没有调用 `isPathAllowed`（同文件 `read()` 在 :918 有 `path escapes project directory` 校验），经 `server/routes/file.ts:206` 暴露为 `GET /file/source-content?path=`，可读 `auth.json`（全部 provider API key）、SSH 私钥。建议：入口加同源 `isPathAllowed` 判定。
- **SEC-03 [高][鉴权缺失]** `server/server.ts:807-813` `const password = Flag.OPENCORVUS_SERVER_PASSWORD; if (!password) return next()`——未设密码时整个 API（文件写、PTY、任务创建）零认证，默认即如此。建议：启动时自动生成随机 token 写 0600 文件，取消"无密码即放行"。
- **SEC-04 [高][DNS rebinding]** `server/cors.ts:19-23` `isAllowedRequestOrigin` 里 `if (host && sameHost(input, host)) return true`，而 Host 头由攻击者控制——`evil.com:7878` 托管页面+短 TTL 重绑 127.0.0.1，`Origin: http://evil.com:7878`/`Host: evil.com:7878` 使 sameHost 成立，配合 SEC-03 即远程网页 RCE。建议：校验 Host 头本身属于 localhost/127.0.0.1/[::1] 白名单，而非拿 Origin 与 Host 互证。
- **SEC-05 [高][暴露面]** `cli/network.ts:50-54` `--mdns` 且未显式配 hostname 时把绑定地址改成 `0.0.0.0`，而 `cors.ts:20` 对无 Origin 请求（curl）直接放行——用户只想开局域网发现，副作用是无鉴权 API 绑到全部网卡供局域网直连。建议：`--mdns` 不再隐式改绑定地址，或非回环绑定时强制要求密码。
- **SEC-06 [中][凭据泄露放大器]** `server/routes/app.ts:685-714` `GET /log/export` 无鉴权返回全部保留日志的 ZIP，配合已知的 `session.ts:1067` 全量 session 落 info 日志与 oauth clientSecret 持久化（R3A-25），单个 GET 批量取走。建议：该路由要求鉴权，打包前脱敏。
- **SEC-07 [中][Tauri IPC 授权过宽]** `packages/overlay/src-tauri/capabilities/`（browser-preview-live）+ tauri.conf.json：capability 的 `remote.urls` 为 `["http://*/*","https://*/*"]` 并授予 `core:default`，同时 `withGlobalTauri: true`——预览窗口中打开的任意恶意站点可调用 core IPC（事件收发、path 解析泄露用户目录）。建议：remote.urls 收窄到实际预览目标，权限降到最小 core 集。
- **SEC-08 [中][命令执行]** `packages/overlay/src-tauri/src/main.rs:1781-1802` `overlay_open_path`/`overlay_open_url` 除"非空"外无 scheme/路径校验直接交给 OS opener，Windows 上 `.exe/.bat/.lnk` 会被执行；调用方 `tauri-transport.ts:560-562` 透传前端命令，而路径常源自模型输出的文件引用（恶意仓库可影响）。建议：open_url 限 http/https/mailto，open_path 限项目目录内且拒绝可执行扩展名。
- **SEC-09 [中][敏感数据进日志]** `packages/channel-runtime/src/stt/pipeline.ts:60` 每条语音转写结果前 80 字无条件 `console.log`（与 R3C-05 slack.ts 同类）。建议：降 debug，只记长度与耗时。
- **SEC-10 [低][DoS]** `server/routes/attachment.ts:163` `Buffer.from(await c.req.arrayBuffer())` 无 content-length 校验与体积上限，整体读进内存。建议：加上限并超限早退。
- **SEC-11 [低][路径前缀比较]** `storage/attachment-store.ts:570-571` `if (!abs.startsWith(path.normalize(dir)))` 缺分隔符，`attachment` 与 `attachmentX` 同前缀（HTTP 路由已挡 `/`、`\` 故当前不可达，内部调用方传含分隔符 name 即越界）。建议：补 `path.sep` 或复用现成的 `isInsideDirectory`。
- **SEC-12 [低][供应链]** `packages/overlay/src-tauri/tauri.conf.json` `"pubkey": "development-build-has-no-update-trust-root"` 配 `createUpdaterArtifacts: true`，版本号却是正式的 `0.0.45-beta`（endpoints 为空故当前不可利用，但发布物携带占位信任根）。建议：正式构建注入真实 pubkey 或关掉 updater 产物。
>
> 安全面已核实无问题的部分（供参考，勿重查）：channel-runtime 其余 12 家校验分支均正确且用 timingSafeEqual；`$`/exec/spawn 全部插值点（Bun `$` 自动转义、github.ts 参数为常量）；Tauri deep-link 解析校验严格；packages/web 全部 5 个 API 端点（体积上限、Origin+sec-fetch-site 双校验、SQL 全参数化）。

### R3A — 第 3 轮补漏：server 路由正文 + mcp/computer+oauth + engine/scheduler 残留

> 子 agent 总评：工程纪律强（不变量断言、租约、幂等收据齐全），但读模型普遍全表扫描 + N+1，helper 与手写锁大面积复制，个别文件逃过格式化。

- **R3A-01 [高][性能]** `engine/mailbox.ts:189,288,301` `mailboxState()` 无条件拉取全库全部 acknowledgement 事件、`allMailboxSourceRows()` 拉全部来源事件后 JS 过滤；`listMailbox` 每次翻页都调这两者并在内存做 cursor 切片（319-331）——分页是假的，每页代价 O(全库事件)。建议：cursor/limit 下推 SQL。
- **R3A-02 [高][性能]** `engine/mailbox.ts:454,466-479,481-498` `acknowledgeMailboxItem` 为查单条状态全表扫描；`acknowledgeAllMailboxItemsRead` 事务内全表扫描+逐条写；`deleteMailboxItems` N 次查询+一次全扫。建议：按 messageID 集合批量。
- **R3A-03 [高][性能]** `scheduler/event-projection.ts:98-119` `projectEventJobInTransaction` 把该 definition 全部 revision 的全部历史 fire 都投影一遍，每个 fire 自身还有 4~6 次查询+因果链逐跳查询——单 job 读代价随历史无限增长。建议：只投影最近 N 条或聚合 SQL。
- **R3A-04 [高][性能]** `orchestrator/task-event.ts:116-175` SSE 轮询用的 `signature` 把 watermark 时刻所有 message/part 的完整 data JSON `cast AS TEXT` 拼成一个字符串；`taskMessageWatermark:112` 只要水位值却仍付整段 signature 代价（调用方 `routes/orchestrator.ts:981`）。建议：改摘要+独立轻量查询。
- **R3A-05 [高][性能]** `engine/task-project-archive.ts:256-278` 整个工程 zip 用 BlobWriter 全量构建再 `arrayBuffer()` 转 Uint8Array（峰值 2~3 倍仓库大小），`routes/mission.ts:444` 整块返回，项目文件无任何大小/数量上限。建议：流式写出或加总字节上限。
- **R3A-06 [中][错误处理]** `mcp/computer/host-runtime.ts:255-265` 全部动作用 `entry.backend!`——先 observe 后 session_create 得到裸 TypeError 而非契约内 `COMPUTER_SESSION_NOT_FOUND`，且 errorResponse 一律 400。建议：perform 入口统一断言。
- **R3A-07 [中][泄漏]** `mcp/computer/host-runtime.ts:321-338` `close()` 只在零失败分支 `server?.stop()` 并清 state，任一 entry 清理失败即 throw，Bun.serve 端口与 authorizations 表留存。建议：停服/清表进 finally。
- **R3A-08 [中][死代码]** `mcp/browser/sessions.ts:1135-1137` `process.on("exit", () => { void browserConnection?.close() })`——exit 回调只跑同步代码，这段永不执行，给人错觉的清理。建议：删除或移 beforeExit/信号路径。
- **R3A-09 [中][错误处理]** `mcp/browser/sessions.ts:264` `Number(process.env.SESSION_TIMEOUT_MIN ?? 30)` 非法值得 NaN → `lastActive < NaN` 恒假，会话超时静默失效；变量名还缺 `OPENCORVUS_` 前缀与同文件约定不一致。建议：校验+重命名。
- **R3A-10 [中][重复]** `mcp/browser/sessions.ts:343-358` 与 `360-375` 两个手写互斥量除 Map 名外逐字符相同；464-471/495-502、472-485/503-516 又两对整段复制。建议：提取 `keyedMutex(map)`。
- **R3A-11 [中][错误处理]** `engine/codebase-tools.ts:210-217` 只读 stdout，退出码与 stderr 全丢——ripgrep 正则非法（exit 2）时返回 "No matches found."，模型会误判"代码里没有"；stderr 未 drain 有管道满阻塞风险。建议：查 exitCode，stderr 回传。
- **R3A-12 [中][其他]** `tool/plugin-tool-host.ts:33-59,166-179` `collectOutput` 无上限累加插件 stdout/stderr。建议：字节上限+截断标记。
- **R3A-13 [中][重复]** `tool/plugin-tool-host.ts:238-281` 同一"pending promise 入 Set、settle 后删"模式同函数写四遍；387-398 四段逐字相同的 `Promise.allSettled`。建议：`tracked(set, fn)`+循环。
- **R3A-14 [中][一致性]** `tool/artifact-catalog.ts:699-714` vs `532-548` `ArtifactSnapshotTool` 按 source 切换 schema，而同名 `createArtifactSnapshotAiTool` 硬编码单一 schema——同一工具两个表面能力不一致；四对 Tool.define/aiTool 双写。建议：收敛共享定义。
- **R3A-15 [中][其他]** `engine/build-observation-cleanup.ts:163-168` 生产签名挂注释明写 `/** Test-only executor */` 的 `deleteRefs` + 三个注入点——`*ForTest` 病的新形态（改成可选参数）。建议：移显式测试构造器。
- **R3A-16 [中][性能]** `engine/build-observation-cleanup.ts:39-51` `project()` 每行单查 receipts，两个调用方都逐行调（N+1）。建议：`inArray` 批量。
- **R3A-17 [中][重复]** `engine/build-observation-cleanup.ts:129-157` vs `engine/build-observation-ref.ts:9-27` 两套"删 observation refs"实现并存（`--git-dir X` 数组式 vs `--git-dir=X` for-each-ref 式，cwd 取法也不同），两者均在用。建议：统一。
- **R3A-18 [中][性能/重复]** `workbench/board.ts:313-333` while 循环逐跳查 parent，每条 stream incident 各调一次；同样的"逐跳查询走链"在 `routes/expert-squad.ts:276-283`、`scheduler/event-projection.ts:41-53` 各一份。建议：递归 CTE 或批量取。
- **R3A-19 [中][重复]** `orchestrator/task-event.ts:548-557` 与 `580-589` 逐字符相同的"取 message+校验归属+抛同型错误"块，各自处于循环内（N+1）。建议：抽 `requireDurableUserMessage()` 并批量。
- **R3A-20 [中][错误处理]** `server/routes/session.ts:1600-1604` part 三元组不匹配抛裸 Error → 500，但 describeRoute 只声明 400/404，同文件其他校验都用 `badRequestBody`。建议：改 400。
- **R3A-21 [中][死代码]** `server/routes/global.ts:1096-1097` `const issues = error.data.issues ?? []` 后 `if (!issues) throw error`——空数组为真值，分支永不成立（原意应是 length 判断）。建议：修正条件。
- **R3A-22 [中][重复]** `server/routes/mission.ts:605-607/691-693` 同段 configOverlay 双重断言复制两遍，610-617/725-732 的 try/catch 也逐字复制；加 `session.ts:468`、`expert-squad.ts:312-317` 同一 overlay 读法共 4 份写法各异。建议：`readSessionConfigOverlay(session)`。
- **R3A-23 [中][重复]** `workbench/board.ts:457-481` vs `engine/task-project-archive.ts:96-124` 两套独立的"按深度/数组/字符串上限截断 JSON"递归器，限额与标记结构都不同。建议：合一。
- **R3A-24 [中][重复]** `errorMessage(error: unknown)` 后端也有 14 份同义副本（`routes/session.ts:111`、`global.ts:159`、`app.ts:69`、`shell/process-supervisor.ts:27`、`scheduler/event-service.ts:975` 等）；`engine/mailbox.ts:149` `payloadRecord` 与 `workbench/board.ts:51` `artifactPayloadRecord` 亦同一函数。与 OVL-09/R3B-04 同病，前后端合计 30+ 份。建议：收进 util。
- **R3A-25 [低][死代码/其他]** 杂项：`scheduler/event.sql.ts:50-51` 等三处 `*_latest_idx` 与紧邻 uniqueIndex 建在相同列上纯冗余，另有 5 个死导入；`mcp/computer/tools.ts:230` 零引用；`scheduler/recurrence.ts:14-17` 百科注释且 `:16` 把本产品写成 "Codex Scheduled Automations"（移植残留）；两个文件明显逃过 prettier（190/250 字符行）；`routes/session.ts:1067` 每次 GET 把整个 session 对象打进 info 日志；**`mcp/oauth-provider.ts:28-35` 把明文 `clientSecret` 序列化进 `credentialIdentity` 并持久化（`mcp/auth.ts:36`）**——建议改存哈希。

> 子 agent 总评：Token 体系与 `!important` 纪律出人意料地好（26k 行 CSS 仅 10 处 `!important`、硬编码色全部集中在 cascade 主题层）。真正的病灶是规模失控：约 1000 行死 CSS（含 3 个组件已删除但样式全留）、多个 1400–1900 行的上帝组件、以及同一段工具函数在 4–13 个文件里各写一遍。`src/solid/` 已建的抽象几乎无人使用。

- **R3B-01 [高][死代码]** `src/styles/surfaces/inspector.css:1455-1789` 约 335 行 `.integrity__*` 样式：注释自称服务 `IntegrityCard.tsx`，该文件全仓不存在；实际仅 3 个类被用，其余 30 余个零引用；注释还称基元"仍住在 styles.css"，而该文件早已不存在。建议：整块删除。
- **R3B-02 [高][死代码]** `inspector.css:1137-1330` 约 194 行 `.gwg-plan-node*`/`.gwg-verdict*` 等：`GoalGroup.tsx` 只渲染 17 个 `gwg-` 类，评估/计划节点子树整支已废；`:1015-1046` `.gwg-branch-pill` 同样无引用。建议：删除。
- **R3B-03 [高][死代码]** `inspector.css:443-568` 约 125 行浏览器预览"节点批注"功能完整样式，`.tsx` 侧零引用；`settings.css:1677-1790` 约 114 行 `.about-*` 面板样式，全仓无 About 组件。建议：删除（合计死 CSS 约 1000 行，含 R3B-19）。
- **R3B-04 [高][重复]** 错误信息提取全前端 149 处内联 + 13 个同名局部 `errorMessage` + `errorText`×2 + `describeError`×1，而 `src/utils/error-details.ts` 已存在。建议：收敛为一个导出（OVL-09 的完整量化）。
- **R3B-05 [高][上帝文件]** `src/components/TaskDirBar.tsx:136-1874` 单个 `ProjectRuntimeStatusPanel` 1700+ 行、29 signal、8 effect，承担 git 分支菜单/commit 生成/环境变量编辑器/worktree 列表/子代理计数/浏览器文件域六件事，且 4 处 `as any` 绕过 store 类型。建议：按面板段落拆分。
- **R3B-06 [高][上帝文件]** `src/components/settings/SkillMarketPanel.tsx:235-1075` `SharedResourceManagementPanel` 单函数 840 行，末尾两个薄包装导出——"用巨函数+参数开关代替两个组件"。建议：拆分。
- **R3B-07 [中][状态管理]** `ScheduledAutomationsPanel.tsx:163-190` 26 个 signal 其中 13 个是手搓表单模型，配套手写逐字段 `resetForm`。建议：收敛单个 createStore。
- **R3B-08 [中][死代码/命名]** `src/hooks/use-card-head-actions.ts:85,100-136` `rewindDisabled = () => canRewind()` 名字与语义相反，`onRewind` 首行 `if (rewindDisabled()) return` 使回退在"可回退"时必定提前返回；唯一消费者又把菜单项硬编码 disabled——37 行回退逻辑（确认对话框、rewinding 信号）永不执行。建议：明确删除或修复语义。
- **R3B-09 [中][重复]** `classes()` 在 `src/components/ui/` 复制 8 份且签名分裂（6 份 `(base, feature?)`，2 份 `(...values)`）——同名不同义。建议：单点导出。
- **R3B-10 [中][重复]** `isRecord()` 7 份（返回类型在 `Record<string, unknown>` 与 `Record<string, any>` 间摇摆）、`isAbortError()` 4 份。建议：并入 utils。
- **R3B-11 [中][重复]** 指针拖拽会话实现 4 套（`ConfigDialogHost.tsx:183-245` 带 rAF 合并、`ui/Dialog.tsx:164-171`、`services/pane.ts:373-382`、`main.tsx:2752`），只有一处做帧合并；`useResizable` 通用 hook 住在组件文件里。建议：统一入 `src/solid/`。
- **R3B-12 [中][过度抽象]** `src/solid/` 四个 helper 几乎无人用（useDisclosure 3 文件、useHotkey/useArmedConfirm/useAsyncAction 各 1），`disclosure.ts:4-8` 注释明列要替换的 11 处实际未迁移——"新抽象+旧写法"并存。建议：完成迁移或撤销抽象。
- **R3B-13 [中][死代码]** `src/services/workspace.ts:87-104` 四个 kick-timer 访问器导出全仓零调用，且把定时器句柄升格为全局可写状态。建议：删除。
- **R3B-14 [中][类型逃逸]** `src/services/llm.ts:220,327,382,418,437` 配置与 auth prompt 边界全 `any`（`configOverride?: any` 等 5 处），`record(value: any)` 是 isRecord 第 8 个变体。建议：定型。
- **R3B-15 [中][类型逃逸]** `src/services/conversation.ts:143-346` 解析层校验了形状却仍产出 `any`（`parseEventReplay(raw: any)` 等 6 个函数）；同文件 12 个模块级 `let` 构成隐式全局会话状态。建议：解析产出真实类型，状态入 store。
- **R3B-16 [中][重复]** CSS 截断三件套逐字重复 26 处（全仓 `text-overflow: ellipsis` 135 处）；sr-only 视觉隐藏块 10 份且两种 clip 方言。建议：`.oc-truncate`/`.oc-sr-only` 工具类。
- **R3B-17 [中][一致性]** `#configDialog` 作 CSS 提权工具用 36 次，另有 9 处 `:not([data-config-panel="expert-squad"])` 式按面板挖洞——设计系统被一个面板的例外反向绑架。建议：重构该面板样式而非全局挖洞。
- **R3B-18 [中][并发]** `src-tauri/src/macos_webview_keyboard.rs:31,44-48` `OnceLock` 缓存"第一个 webview"的安装结果，后续 webview 父视图若属另一 ObjC 类会拿到缓存 `Ok(())` 而实际未打补丁且无日志；`:95-99` `extern "C" fn` 内 `.expect()` 会在 AppKit 事件派发路径上 abort 整进程。建议：按 parent_class 做键+跳过告警；expect 改静默回退。
- **R3B-19 [低][死代码]** 其余零散死 CSS 约 200 行：`card.css:436-460,509-552,918-965`、`sidebar.css:562-601`、`settings.css:346-372`、`inspector.css:1892-1928,1437-1451`（`.verdict-pill` 注释称"Board 也在用"实则无人渲染）、`activity.css:77-88`、`empty-state.css:21-46`。建议：删除。
- **R3B-20 [低][其他]** `src/services/clock.ts:44-57,66-72` `intervalMs` 只被第一个订阅者捕获，后续订阅者的周期被静默忽略——参数是个谎言（当前唯一调用点用默认值故无实害）。建议：移除参数或使其真正生效。
- **R3B-21 [低][死代码]** `src/components/MailboxPanel.tsx:34` `MAILBOX_VIEW = "active"` 硬编码，`services/mailbox.ts` 的 archived 视图与 restore 动作在 UI 永不可达，counts 仍持有 archived 字段。建议：定去留。

### R3D — 第 3 轮：高严重度发现复核结果

对 15 条最高严重度/行为 bug 级发现做了逐条代码复核：**确认 10 条，部分属实 2 条，推翻 3 条**。被推翻/修正的条目已就地订正（SRV-01 降级、SRV-02 修正机理、ENG-06 降级、OVL-04 降级、HST-21 降级、ENG-14/INF-05/INF-08/ART-17 加修正说明）。

| 结论 | 条目 |
|---|---|
| CONFIRMED | ENG-14、PRO-01、INF-05、HST-01、ART-02、ART-17、TOL-02、TOL-03、AGT-01、TST-01 |
| NUANCED | SRV-01（泄漏机理改见 R3D-02）、INF-08 |
| REFUTED | ENG-06（刻意设计+级联真实存在）、OVL-04（计数路径实际一致）、HST-21（ID 字符集使其不可触发） |

复核结论：**风险最高的两条是 AGT-01（提示词指示模型使用的 contract_audit 验收 scorer 永不执行，产生 false-green 验收）与 HST-01（Windows 上 worktree 临界区互斥实际失效）**，建议重构时最优先处置。

复核过程中的新发现：

- **R3D-01 [中][其他]** `memory/search.ts:18` `KIND_WEIGHT.project_context = 0`，`:112` `score *= KIND_WEIGHT[row.kind]` 使其恒为 0，必然低于默认 minScore 0.1 被丢弃；而默认 kindFilter 只排除 `user_message`——**project_context 记忆被索引但永远搜不到**（`tool/memory.ts:106` 走的正是默认路径）。建议：权重与阈值解耦，或权重 0 的 kind 在 SQL 层排除。
- **R3D-02 [高][并发]** （已并入修正后的 SRV-02）`protocol/store.ts` 两个 live-replay Map 在任务终态后被尾随 ephemeral 事件重新填充且再无清理时机，周期清扫只裁剪事件数组还反向写入 floors——真实的无界增长路径。
- **R3D-03 [低][死代码]** `check/policy.ts:24` `inferSelectors` 恒返回 `[]` 且全仓零调用，与 `inferFamily` 同属"停止关键词推断"重构残留（`inferFamily` 还被 `acceptance/checks/discovery.ts:232` 当默认值用）。建议：删函数并把依赖恒定 family 的分支改显式查表。

---

## 覆盖情况

| 目录/包 | 轮次 | 覆盖方式 |
|---|---|---|
| opencorvus/src/engine | 1 | 精读大文件+小文件全读+模式扫描（cross-task-artifact-import、codebase-tools、mailbox 等函数体未细读） |
| opencorvus/src/session, runtime | 1 | 精读 loop/processor/runtime-contract 等；session/prompt 子目录未覆盖（第 2 轮补） |
| opencorvus/src/orchestrator, scheduler, task-api, mission, workbench | 1 | 精读大文件+8 类交叉扫描；task-event/board SQL 投影主体未细读 |
| opencorvus/src/server, protocol, bus, channel; packages/transport-protocol, channel-runtime, channel-config | 1 | 精读核心+定向抽查；各路由完整正文与测试未逐行 |
| opencorvus/src/tool, mcp, provider, llm, shell, pty, lsp | 1 | 精读核心+抽样；mcp/computer、oauth、github-copilot(vendored) 未逐行 |
| opencorvus/src/expert-squad, agent, architect, acceptance, frontend-design, visual-qa, research, intent*, goal-workload-analyst, fact-check, verification, delegated-worker, explore, question, decision-log, evidence, quicknote, requirements | 1 | 精读三大模块+全目录量化扫描；部分大文件函数体未细读 |
| packages/overlay（含 src-tauri/main.rs） | 1 | 精读上帝文件+全组件 grep 指标扫描；styles/ 内部与 src-tauri 其余模块未看 |
| 跨切面机械统计 | 1 | 主 agent grep 统计（类型逃逸/巨型文件/空 catch/console.log/模块碎片化） |
| opencorvus/src/project, browser-preview, browser, worktree, file, patch, panel, workspace, snapshot, gui, interactive-artifact, system-terminal, share | 2 | 精读大文件+模式扫描；String.raw 脚本正文与删除协议未逐行 |
| opencorvus/src/cli, storage, config, util, auth, env, global, flag, installation, package-update, platform, bun, build, id, check, types, metrics, usage, trace, format, title + src 入口 + packages/util | 2 | 精读核心+穷举扫描；部分 cli/cmd 与 format、metrics/store 正文未看 |
| opencorvus/src/prompt, skill, mission-skill, memory, command, question, requirements, review, verification, conversation, chat, coding-cli, acp, session/prompt | 2 | 精读+死导出/any/TestHooks 全量 grep；acp 方法体、skill/builtin 未逐行 |
| opencorvus/src/work*, task-artifact, task-context, artifact-catalog, timeline, status, integrity, execution-capsule, capability, control, pipeline + packages/web, plugin, script | 2 | 精读大文件；web 的 astro 组件与 docs 正文未看 |
| 全仓依赖图与跨模块重复 | 2 | Bun 脚本建图 + Tarjan SCC + 8 行滑窗哈希；import type 未区分 |
| 各包 test/ | 2 | 统计+最大文件精读+20 个中型文件核对；约 230 个中小测试文件仅模式扫描 |
| server 路由正文（session/global/mission/expert-squad/panel/app）、mcp/computer+oauth+browser/sessions、tool 残留 3 文件、engine 残留 6 文件、scheduler 投影与 SQL | 3 | 结构+最长函数正文；describeRoute 纯声明段抽样 |
| overlay src/styles 全部 53 个 CSS、src-tauri 其余 Rust、15 个未读大组件、约半数 services、hooks/solid/native-menu | 3 | 脚本化类名交叉引用+精读；CSS token 使用率未查 |
| channel-runtime 13 适配器+stt 全文、expert-squad 4 大文件函数体、frontend-design/visual-qa/research schema 与 output-tools、session 小文件、agent 小文件 | 3 | 全文+跨适配器结构 diff；纯 describe 文案段未逐行 |
| 15 条高严重度发现复核 | 3 | 逐条读码验证：确认 10、部分 2、推翻 3 |
| 未覆盖残留 | — | provider/github-copilot（vendored fork，有意跳过）、web 的 astro 组件与 docs 正文、skill/builtin/*.md 提示词正文、CSS token 实际使用率（有现成 check:css-tokens 脚本） |
