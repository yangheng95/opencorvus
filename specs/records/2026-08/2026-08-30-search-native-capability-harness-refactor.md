# Search-native Capability Harness Refactor

Status: investigation complete; design converged; fifth independent review PASS

## Recall

### 用户原始要求

- 调查当前 Tool、Skill、Model Context Protocol（MCP，模型上下文协议）、Expert Squad 与 Harness 各自成体系、难维护的问题。
- 调查业界如何让模型通过搜索自行发现解决问题所需的能力。
- 找出当前框架的完整缺陷与根因。
- 给出不会形成新双源、兼容层或局部补丁的系统性重构方案。
- 迭代调查和校准，直到没有未处置问题与未确定条目。

### 验收指标

1. 以当前代码、配置、测试和运行契约证明现状，不把既有架构文档的愿景误当成已实现事实。
2. 建立 Tool、Skill、MCP、Expert Squad、Mission Skill、Conversation Harness、Task scheduler/worker Harness 的定义、目录、授权、加载、执行、事件和恢复矩阵。
3. 使用权威一手资料比较至少 OpenAI、Anthropic、MCP 标准和一个跨模型框架的动态工具发现做法。
4. 明确区分 inventory（库存）、discovery（发现）、projection（投影）、materialization（物化）、authorization（授权）、authentication（认证）和 execution（执行）。
5. 目标架构只保留一个 typed capability identity、一个目录快照、一个 Harness 投影合同和每类能力原有的唯一执行 owner。
6. 方案必须同时覆盖多 Provider、不支持原生 tool search 的模型、流式事件、权限、OAuth、Task/Mission/Session occurrence、重启恢复、缓存失效、上下文预算和可观测性。
7. 为迁移阶段定义可测的正向契约、真实 checker、基准数据、回滚边界和删除旧路径的时点。
8. 所有调查项最终标记为 `resolved`、`excluded` 或带证据的外部 blocker；不得以“以后再看”结束。

### 硬约束

- 所有 LLM 调用保持流式；消息和 Tool/result 事件由真实参与者自然产生并完整可见。
- 搜索只传播知识，不授予能力；模糊匹配不得直接挂载、认证、批准或执行。
- 不新增通用 binder、第二权限系统、第二 Skill/MCP/Squad Registry、Harness 持久表或 active capability 影子状态。
- `prompt_profile.active` 与固定 package revision 继续是 Task Expert Squad 的唯一执行身份。
- 共享 Host 只保留数据完整性校验、权限与不可逆操作确认；不以 gate 或关键字路由教模型选择流程。
- 不增加 fallback、旧协议兼容层、双读写或 Provider 特判。替换落地时同步删除旧声明和旧物化路径。
- 不运行或新增 User Interface（UI，用户界面）自动化测试；若未来触及 UI，只以真实页面、截图和人工视觉复核验收。
- 本轮先完成调查和方案，不在分析未完成前修改运行时实现。
- 保留工作区中本任务外的未跟踪文件与用户改动。

### 已读资料

仓库资料：

- `AGENTS.md`
- `specs/current/architecture/04-extensions.md`
- `specs/current/architecture/17-code-work-agent-platform.md`
- `specs/current/architecture/06-provider.md`
- `specs/records/2026-08/2026-08-12-work-artifact-harness-and-skill-infrastructure.md`
- `specs/records/2026-08/2026-08-12-work-artifact-harness-p0-implementation.md`
- `specs/records/2026-08/2026-08-14-agent-tool-block-projection-plan.md`
- `specs/records/2026-08/2026-08-17-terminal-package-tool-gate-removal.md`
- `specs/records/2026-08/2026-08-26-runtime-skill-market-search-install.md`
- `packages/sdk/js/src/expert-squad-manifest-v1.ts`
- `packages/opencorvus/src/capability/{ref,harness-projection,rules,fuzzy,discovery-filler}.ts`
- `packages/opencorvus/src/tool/{capability-search,capability-catalog}.ts`
- `packages/opencorvus/src/agent/tool-pool-data.ts`

外部权威资料：

- OpenAI Responses API Tool Search 与 deferred Tool schema：
  `https://developers.openai.com/api/docs/guides/tools-tool-search`
- OpenAI 当前模型工具建议：
  `https://developers.openai.com/api/docs/guides/latest-model`
- Anthropic Tool Search Tool：
  `https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool`
- Anthropic Advanced Tool Use 工程说明：
  `https://www.anthropic.com/engineering/advanced-tool-use`
- MCP Tools specification：
  `https://modelcontextprotocol.io/specification/draft/server/tools`
- Microsoft Semantic Kernel Contextual Function Selection：
  `https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/agent-contextual-function-selection`

### 全仓搜索初始结果

- `specs/current/architecture/17-code-work-agent-platform.md` 已定义 typed `CapabilityRef`、`HarnessProjection`、`capability_search`、caller-specific view 和“搜索不授予执行权”的原则，但文件仍写着 implementation pending。
- 当前源码已经存在上述核心类型和搜索 Tool，因此现状是“部分实现且文档状态陈旧”，不是“尚未开始”。
- `ExpertSquadProjectionResourcesSchema` 对每个 scheduler/Agent 强制维护 `inherit_base_tools`、`built_in_tool_ids`，以及 Skill、Tool、MCP server/tool/prompt/resource 按 `default | package` 分裂的十二个引用数组。这是当前最显著的声明重复面。
- `capability_search` 每次调用直接从当前执行 Tool ID、Harness、Skill Manager、MCP config、Mission Skill 与 Expert Squad owner 临时构造 snapshot；当前实现尚未证明架构文档要求的 owner revision、invalidation、single-flight rebuild 和原子 replacement cache。
- Catalog 的 `availability` schema 声明 `visible | installed_unbound | requires_auth | denied`，但当前 entry 生成主要只使用前两类；认证和 deny 的当前事实尚未完整进入目录。
- Conversation MCP 目录当前主要列 configured server；没有统一投影 server 的完整 tools/prompts/resources metadata。Task 只列已经投影且通常已经进入 execution surface 的 MCP refs。
- `capability_search` 已加入生产 Tool pool，但其他工具定义仍整体进入当前 Tool surface；当前搜索降低目录查找难度，却没有像 OpenAI/Anthropic deferred Tool 那样降低 schema context 或实现 turn-local lazy activation。
- Skill 已有自身的模糊 search/load，Skill Market 还有另一套 search/inspect/install；Expert Squad 也有独立 catalog/search/inspect。它们各自拥有不同生命周期是合理的，但搜索索引、ranking、revision 和结果语义仍有重复。

### 独立 Agent 反馈

- 第一轮只读审查判定 FAIL，提出 2 个 P0、5 个 P1 和 2 个 P2：next-owner 扩权、Catalog scope 不足、definition materialization fingerprint 缺失、restart 不可实现、并发 reveal 无 compare-and-swap、Provider cache 成本漏审、Phase C/D 中间态危险、benchmark 不可执行、unknown ledger 自相矛盾和 rollback 缺失。
- 第二轮只读审查判定FAIL，进一步发现2个P0和3个P1：stage-owned Tool遗漏、V1-bound Task恢复断裂、Catalog blob GC owner不明确、async materialization位于写事务、dynamic MCP与frozen snapshot矛盾。
- 第三轮只读审查判定FAIL，无新P0，但发现2个P1和2个P2：pure stage Tool不能靠effectful materializer恢复、strict WorkerTurnDescriptor破坏回滚、stage数量措辞错误、deactivate注释过窄。
- 第四轮只读审查判定FAIL，发现2个P1和1个P2：MCP child access未定义单调继承、普通MCP错误冒充`mcp_app` participant、snapshot hash未明确覆盖完整payload。
- 本记录已逐项吸收四轮发现；最终只读审查结果记录在文末Delivery record。

## 调查方法与收敛规则

本轮按以下顺序推进：

1. 画出当前 authoritative inventory 到实际 Provider Tool schema 的完整数据流。
2. 对每一层标记唯一 owner、revision、可变状态、调用者、权限和恢复责任。
3. 用同一维度比较行业方案，而不是按产品名罗列功能。
4. 从真实代码差异识别缺陷，区分“概念必须分离”与“声明/索引/物化实现可统一”。
5. 先定义目标不变量和删除清单，再设计迁移阶段；每个阶段不得引入并行事实源。
6. 建立 unknown ledger。每轮关闭所有可由代码、测试、文档、静态量化或权威资料回答的条目，再开始下一轮。

停止条件：连续一轮完整的定义/调用点/恢复/Provider/权限/上下文预算审计没有新增 P0/P1 缺陷，unknown ledger 为零，独立审查没有未解决发现。

## 初始调查问题

| ID | 问题 | 最终处置位置 |
| --- | --- | --- | --- |
| U-01 | 每类 Agent 实际发送给 Provider 的 Tool schema 数量和 token 预算是多少？ | §3、§14 |
| U-02 | 各 Provider 对 deferred Tool、动态 allowed set、同一 response 内加载后调用的支持差异是什么？ | §4、§9、§14 |
| U-03 | 当前 MCP list pagination、list-changed、cache 与 auth-scoped inventory 是否完整？ | §5 F-08、§8、§14 |
| U-04 | 现有多个 search 的 ranking、revision、cursor 和权限语义有多少重复？ | §2、§5 F-07、§11、§14 |
| U-05 | 十二个 Expert Squad resource refs 数组能否无损替换为单一 typed declaration，同时保留 source/owner 约束？ | §3.2、§7、§14 |
| U-06 | 原生 Provider Tool Search 与 Host-managed search 如何共用一份可观测事件协议且不形成双路径？ | §9、§14 |
| U-07 | 搜索召回质量、复合任务多 Tool 完整率和延迟的基准集从哪里取？ | §12、§14 |
| U-08 | 当前架构文档哪些“pending”项目已实现、部分实现或仍缺失？ | §2、§14 |

## 1. 决策摘要

目标不应是把 Tool、Skill、MCP 和 Expert Squad 抹成同一种运行对象。它们分别是可调用函数、渐进式方法/资料包、远端协议能力和固定 Task 团队/工作流所有权，生命周期与权限语义不同。应统一的是它们的**发现描述符、typed reference、revision、搜索入口和 turn-local 物化协议**，不是执行 owner。

本轮选择 **search-and-reveal**，不选择旧 `capability_search + capability_load` 双 Tool 方案：

- 所有执行型 Agent 的初始 Provider Tool surface 只保留一个平台 `capability_search`；Helper 仍然无 Tool。
- Harness 在 occurrence 开始前分别冻结 discoverable 与 executable 精确能力集合；搜索结果和其 next-owner action都必须落在相应集合内。
- 模型调用 `capability_search` 后，结果返回精确 refs，并把结果中的可调用 leaf Tool schema 作为同一可见 Tool result 的 durable reveal receipt；下一 Provider step 才能调用这些 Tool。
- reveal 只改变模型知道哪些已在 executable set 中的 schema，不扩大 Harness 允许集，不认证、不批准、不执行。具体调用继续经过现有 Tool owner、`withTaskToolInvocation`、permission authority、OAuth 和流式 Tool/result 事件。
- Skill、Mission Skill 和 Expert Squad 结果不被“执行”：搜索返回精确 ref，并 reveal 它们现有 next owner 的 leaf Tool，例如 exact Skill opener 或 exact `create_task` action。
- MCP tool metadata未验证时只返回server/toolset descriptor；精确MCP inspection/OAuth仍由MCP owner完成并产生typed `catalog_advanced`结果，当前occurrence收敛，successor occurrence才冻结并搜索新leaf。搜索不得静默连接、释放凭据、触发OAuth或原地扩权。

这个选择比旧 `capability_load` 方案少一个模型决策往返，同时与 OpenAI/Anthropic 的 Tool Search 语义一致：搜索可以把**已在允许集内**的 schema 加入上下文，但不授予新的执行权。

单向链：

```text
authoritative inventories
  -> owner-published CapabilityDescriptor/CapabilitySet snapshots
  -> immutable project CatalogSnapshot
  -> occurrence-frozen Harness allowed set
  -> caller-visible search view
  -> model capability_search
  -> durable exact schema reveal receipt
  -> next-step TurnCapabilityProjection
  -> existing owner revalidation/materialization
  -> execution surface narrowing
  -> call-time permission/authentication
  -> streaming execution occurrence and receipt
```

每个箭头只能保持或缩小 authority。Catalog、ranking、search、reveal、permission 和 OAuth 都不能引入上游 Harness 不拥有的 ref。

## 2. 当前系统地图

| 层 | 当前 owner | 当前事实 | 目标处置 |
| --- | --- | --- | --- |
| Built-in Tool inventory | `ToolRegistry` + `global-tools.ts` | Tool definition 与 runtime pool 分离，但每次 Provider step eager materialize 大部分 schema。 | ToolRegistry 发布 leaf descriptor 与 exact materializer；初始只物化 `capability_search`。 |
| Native Agent bounds | `AgentToolPool` | role/runtime-template 维护大量静态 Tool ID 数组。 | 替换为 exact CapabilitySet refs；不再维护并列 Tool list。 |
| Skill inventory/load | `SkillManager` / `SkillMount` / `SkillTool` | Skill 自带一套 fuzzy search + exact load。 | Catalog 统一搜索；Skill owner只保留 exact open/read，不再排名。 |
| Mission Skill | `MissionSkillCatalog` / `MissionSkillTool` | 与普通 Skill 共享内核但有独立 catalog 和搜索入口。 | 保留独立 inventory/owner；目录统一索引，Tool 只 exact open。 |
| MCP | `MCP` / scoped owner / OAuth | server inventory、连接、tools/prompts/resources 枚举、Tool materialization 与 auth 独立。 | MCP 发布 auth-scoped descriptor snapshot，Catalog 消费；按 leaf refs 物化，不再每 step 全量 list/materialize。 |
| Expert Squad | Registry / `PromptProfileResolver` | fixed Task package owner；manifest 每角色维护十三个资源数组。 | package root 定义 CapabilitySet；每角色只保留一个 `capability_refs` 列表；Resolver 展开 set 并冻结 Harness。 |
| Conversation Harness | `ConversationCapability` | assignment 是输入；`HarnessProjection` 在 Tool 已物化后反向生成，主要是诊断。 | Harness 必须先于物化生成并成为唯一 allowed-set 输入。 |
| Task Harness | `PromptProfileResolver` + runtime contract | 已在 Task creation/recovery 绑定 package revision，方向正确。 | 用同一 CapabilitySet/Grant schema 收敛，删除 per-kind materializer 分支。 |
| Stage-owned Tool | `DispatchAdapterContractRegistry` + `WorkerTurnDescriptor` | adapter拥有0–23个私有stage Tool；stage-heavy adapter有11–23个。仅5个effectful Tool持久化materializer，其他是pure in-memory collector/control Tool。 | 作为occurrence owner发布唯一source：effectful类用既有binding；pure类由adapter ABI、dispatch turn、durable toolkit input与真实ToolPart history确定性重建。 |
| Search | capability / Skill / Mission Skill / Squad / Market 多入口 | 部分共享 fuzzy scorer，但结果、revision、cursor、scope 与 next owner 不统一。 | 本地可用能力只保留 `capability_search`；Market 是外部未安装 inventory，保留显式 network owner。 |
| Authorization | execution surface + permission authority | projection deny 与 call-time `allow | deny | ask` 分离。 | 保留；reveal receipt 不成为 permission grant。 |

Plugin、Agent Client Protocol（ACP，Agent 客户端协议）和 Provider 不成为新的 capability kind。Plugin 若注册 Tool/Provider，由对应 Tool/MCP owner 发布 descriptor；ACP 仍是 ingress；Provider 只负责把同一个 TurnCapabilityProjection 流式序列化给模型。

## 3. 定量基线

### 3.1 默认模型 Tool schema

在隔离 memory project 中，使用当前 `ToolRegistry`、真实 Tool initializer、`ProviderSchema.input()` 和 `SessionLoop.estimateToolPayload()` 测得以下下限。默认 Chat/Work MCP assignment 为空；表中已包含 Work/Chat/Mission 实际 Skill-family Tool，但不包含任何额外 MCP、package Tool 或 stage Tool。

| Native identity | Tool 数 | OpenAI-normalized chars | 估算 tokens |
| --- | ---: | ---: | ---: |
| Coding | 19 | 87,179 | 21,799 |
| Chat | 21（含空 Skill opener） | 139,332 | 34,838 |
| Work | 25（含 Work Skill opener） | 149,803 | 37,457 |
| Control | 1 | 50,825 | 12,707 |
| Mission | 22（含 Mission Skill opener） | 124,627 | 31,162 |

最大 leaf/umbrella schema：

| Tool | OpenAI-normalized chars | 估算 tokens |
| --- | ---: | ---: |
| `panel`（Chat/Work） | 50,825 | 12,707 |
| `publish_interactive_artifact` | 30,994 | 7,749 |
| `bash` | 14,627 | 3,657 |
| `todowrite` | 9,467 | 2,367 |
| `work_artifact_author` | 7,216 | 1,805 |
| `schedule` | 6,620 | 1,655 |

因此当前问题不是只由 MCP 导致。即使 MCP 默认为空，模型在开始工作前已经为 1 个大 union Tool 或 19–25 个 eager Tool 支付 1.27 万到 3.75 万估算 token。`capability_search` 当前约 1,805 chars / 451 tokens，但它只是额外 Tool，没有替换 eager schemas。

显式分配 Browser + Computer 后，真实 MCP sidecar checker 通过，运行时投影 53 个 Tool、26,898 chars / 7,632 估算 tokens：Browser 45 个、21,398 chars / 6,254 tokens；Computer 8 个、5,500 chars / 1,378 tokens。

上述默认payload下限没有包含真实私有stage surface。`DispatchAdapterContractRegistry`另定义frontend-design 19、frontend-research 23、deep-research 23、visual-qa 11、integrity 16个stage Tool；`WorkerTurnDescriptor`持久化exact `stageOwned`，但`stageMaterializers`只覆盖5个permission-bearing/effectful Tool，其余Tool当前只有runtime internal binding。因此stage Tool不是可忽略的测试helper，也不能被全局ToolRegistry Catalog代替；其schema payload与两类恢复路径必须由benchmark实测，不能用默认identity表推定。

### 3.2 Expert Squad 声明面

从 122 个当前 manifest（仓库作者源、四个 embedded package 和 portable template）解析出：

- 713 个 scheduler/Agent projection；
- 每个 projection 强制填写 13 个引用数组，共 9,269 个数组槽位；
- 8,349 个槽位为空，空槽率 **90.1%**；
- 所有 package MCP server/tool/prompt/resource 数组在当前 713 个 projection 中均为零引用；作者源也没有一个 `mcp/**` 文件；
- 713 个 projection 只有 264 种不同资源集合；同一 manifest 内有 448 个 projection 重复另一角色的完整资源集合；
- 资源字段触及 194 个 source/test/generated/docs/manifest 文件。

这证明并行数组不是“显式但必要”，而是把 source/kind 维度编码进字段名形成的稀疏矩阵。当前 package MCP 实现是无生产 package 消费者的高维护能力岛，不能继续作为保留十三组字段的理由。

### 3.3 当前基线验证

- `catalog-index`、execution-authority surface 与 Conversation capability 聚焦测试合计首轮为 21 pass / 1 fail；失败是 Browser sidecar bundle 在 `packages/util/dist` 缺失时无法解析 workspace util 子路径，runtime 随后按当前 `scopedToolsForServer()` 语义把 Browser 整组静默降为空对象。
- 按锁文件恢复依赖并构建 `packages/util` 后，Browser bundle checker 产出单 bundle `1,712,125` bytes；原 Conversation capability test 重跑为 4 pass / 0 fail / 21 assertions。
- 这同时证明两件事：53-Tool 测量是真实可复现的；当前运行路径确实存在“owner 连接失败则整组静默消失”的可观察语义，Catalog 却仍可能把 assignment 描述为 `visible`。

## 4. 业界实现与可采用结论

| 方案 | 一手证据 | 可采用点 | 不直接照搬的部分 |
| --- | --- | --- | --- |
| OpenAI Tool Search | `gpt-5.4+` 支持 deferred functions、namespaces 和 MCP；官方建议优先 namespace/MCP，namespace 少于 10 个函数；client-executed search 可由应用返回精确 Tool definitions。 | namespace/toolset 描述、leaf schema 延迟 reveal、client-owned search。 | 只支持部分 OpenAI model；不能作为多 Provider 唯一路径；动态 Tool 表的 prompt-cache效果必须实测。 |
| Anthropic Tool Search | deferred Tool 不进入初始 context；regex/BM25 或 custom search 返回 Tool refs；建议保留 3–5 个常用 Tool；官方案例报告大 Tool 面 85% token 降幅。 | Tool refs、server/toolset 分组、search result 直接 reveal schema、检索质量 benchmark。 | API 仍要求每次请求上传全部 definition；事件格式与 OpenAI 不同，不能成为 Core state contract。 |
| MCP specification | `tools/list` 分页、deterministic order、`listChanged`、按请求 authorization 变化的 Tool set。 | auth-scoped inventory revision、完整分页、deterministic cache、list-changed invalidation。 | MCP 是 provider inventory/transport，不替代 Skill、Task owner 或 permission。 |
| Semantic Kernel contextual function selection | 用 conversation context + vector retrieval 只 advertise top functions；要求 immutable kernel；该能力仍是 experimental。 | “完整 inventory 与每次模型 advertise set 分离”的思路、基于实际任务评估 top-k。 | 不引入 embedding/vector store 作为第一版必需依赖；不让 retrieval 直接变成授权。 |

行业共识不是“把所有扩展类型合并”，而是：

1. 完整 inventory 留在 Host/Provider 边界；模型只看 compact namespace 与当前相关 leaf schema。
2. namespace/toolset 是检索和上下文预算单元，执行仍使用 exact leaf function。
3. 搜索结果必须有稳定精确引用；模糊分数不能成为执行 identity。
4. 权限、认证和副作用确认发生在具体调用，不由搜索或 OAuth 反向授予。
5. 需要用真实工具选择和端到端任务成功率评估，不能只看 token 降幅。

## 5. 缺陷与根因

### F-01 — P0：Search 是附加目录，不是 Tool surface 的替代

- Observable：默认 Work 仍投影约 14.98 万 chars Tool schema。
- Trigger：`ToolRegistry.runtimeTools()` 和 Session Loop 在每个 Provider step eager materialize role pool；`capability_search` 只查询已存在 surface。
- Root cause：inventory、Harness allowed set、advertised schema set 三层没有成为单向数据流；搜索没有拥有 turn-local reveal receipt。
- Why old path failed：ARC-008 只把默认 MCP assignment 置空，消除了 53 个默认 MCP Tool，却没有处理内置 Tool、package Tool 和 umbrella union schema。

### F-02 — P0：Umbrella Tool 把几十个 action 再次塞回一个 schema

- `panel` 单 Tool 达 50,825 chars；Control 只有一个 Tool 仍花 12,707 估算 tokens。
- `publish_interactive_artifact`、`todowrite` 等也把多 action/variant 合成大 union。
- 即使按 Tool ID 做 deferred loading，加载一个 umbrella Tool 仍会重现原问题。
- 根治必须让 action Registry 发布 exact leaf descriptors；模型面删除 umbrella identity，执行继续复用同一 action owner。

### F-03 — P1：Native Harness 是事后诊断，不是物化输入

- Conversation/Mission 先从 role pool、assignment 和运行状态物化 Tool，再从最终 Tool IDs 反向生成 `HarnessProjection`。
- Task scheduler/worker 则先由 `PromptProfileResolver` 生成 projection 并绑定 runtime contract。
- 相同类型名表达两种数据流，无法证明所有 Agent 都由同一个 allowed set 驱动物化。

### F-04 — P1：Expert Squad 资源 schema 是 90.1% 空的稀疏矩阵

- source/kind 被编码为十三个字段；Resolver 为每组维护独立 parse/expand/materialize 分支。
- 706/713 projection 使用 `inherit_base_tools: true`；仅七个角色需要窄集合，说明 inheritance boolean 也不是合理的主声明面。
- package MCP 六类 per-role 数组和当前作者文件无消费者，却扩大 schema、SDK、generator、Resolver、test 和文档影响面；外部/Multica动态 package的物理 MCP capability仍需保留并转为generic owner source。

### F-05 — P1：CatalogSnapshot 没有实现文档声称的 owner revision lifecycle

- `CapabilityCatalog.runtimeSnapshot()` 每次调用临时读取 owner 并重建；没有 project snapshot cache、owner invalidation generation、single-flight 或 atomic replacement。
- `source()` 从最终 entries 再 hash 出 revision，而不是消费 owner 的真实 revision；auth、连接和不可用状态未改变 entry 时不能表达 owner occurrence。
- `requires_auth` 和 `denied` 已在 schema 中声明，但当前主要 entry builder 只产生 `visible` / `installed_unbound`。

### F-06 — P1：Catalog 可见性与真实执行可用性分裂

- assigned MCP server 被 Catalog 标为 `visible`；MCP scoped owner 连接失败时 `scopedToolsForServer()` 记录日志后返回 `{}`，同一 turn 没有 typed incomplete projection。
- Tool 条目描述由 ID 机械生成，不读取 canonical Tool definition；搜索可能按低质量 metadata 排名。
- Conversation 只索引 configured server，不索引完整 tool/prompt/resource；Task 只索引已经进入 execution surface 的 refs，搜索无法带来上下文节省。

### F-07 — P1：多个 capability search 生命周期仍不一致

- `capability_search`：revision + limit，无 cursor；
- Skill/Mission Skill Tool：另一套 fuzzy search，最多五项，无 catalog revision；
- Expert Squad：独立 revision/cursor/cache；
- Skill Market：外部 network search/inspect/install；
- MCP：协议 pagination/listChanged；
- Artifact/File/Provider search 是业务数据或配置查找，不属于 capability catalog，明确排除。

Shared scorer 已存在，但共享算法不等于共享目录合同。模型仍需知道先调用哪一种 search。

### F-08 — P1：MCP enumeration 在 owner 路径间不一致

- scoped inspection 能完整遍历 tools/prompts/resources pagination，并拒绝重复 cursor；
- shared host runtime `listTools()` 主要读取第一页并在每 step 重列；
- `listChanged` handler 发布 Bus event，但当前 Capability Catalog 没有 snapshot cache 可失效；
- MCP 规范允许 Tool set 随 authorization 变化，因此未来 cache 必须绑定 credential/auth-scope revision，不能只用 server config digest。

### F-09 — P1：原生 Provider Tool Search 不能直接成为 Core 语义

- 当前安装的 AI SDK 只有 OpenAI 与 Anthropic family（包括相应 Bedrock/Vertex bridge）暴露 deferred Tool Search；其他 Provider 没有同等 surface。
- GitHub Copilot vendored Responses/Chat adapters只序列化普通 function/provider Tool，不处理 `defer_loading`、namespace 或 tool-search events。
- 若直接启用原生能力，OpenAI/Anthropic 可在同一 response reveal/call，其他 Provider 要跨 step，事件、恢复和可见历史会分裂。

### F-10 — P2：`PromptProfileResolver` 同时承担太多 owner

一个约 4,155 行模块同时负责 package revision、catalog、Skill grant、Tool/MCP parse、MCP prompt/resource content sanitize、Tool materialize、Harness projection 和 search cache。复杂度不是领域本身要求，而是 per-kind 数组和物化分支汇聚到一个类造成。

### F-11 — P0：私有 stage Tool 位于全局 Catalog/Harness 之外

- `DispatchAdapterContractRegistry`定义各stage的私有Tool集合；`WorkerTurnDescriptor.tools.stageOwned`固定identity，只有effectful子集有persisted `stageMaterializers`，pure collector/control子集必须从dispatch adapter durable inputs重建。
- 当前 `CapabilityCatalog` source list和初版 search-native设计只覆盖 ToolRegistry/package/Skill/MCP/Squad，会在删除 eager surface后截断 frontend-design/research/visual-qa/integrity真实流程。
- 根治不是把私有Tool搬入全局Registry，而是让dispatch adapter发布occurrence-scoped source：effectful类使用exact persisted materializer binding；pure类使用`dispatchTurn hash + adapter ABI/version + deterministic toolkit input digest`初始化，并把该occurrence已提交的真实ToolPart request/result按revision折叠为collector state。实现时每个pure Tool必须暴露versioned pure reducer；恢复只读取真实历史，不重新发Tool消息或重复外部副作用。两类都让discovery、schema digest、permission与restart继续由原stage owner负责。

## 6. 目标数据合同

### 6.1 Canonical refs 与 descriptors

扩展现有 `CapabilityRef`，新增 `capability_set` kind。现有 kind/owner/local ref 仍是 leaf identity，不改写成别名。

```ts
type CapabilityKind =
  | "capability_set"
  | "tool"
  | "skill"
  | "mission_skill"
  | "mcp_server"
  | "mcp_tool"
  | "mcp_prompt"
  | "mcp_resource"
  | "expert_squad"

interface CapabilityDescriptorV2 {
  ref: CapabilityRef
  name: string
  description: string
  aliases: string[]
  search_terms: string[]       // bounded, non-secret owner output
  owner_revision: string
  metadata_digest: string      // descriptor metadata only; not an executable schema digest
  behavior:
    | { kind: "call_tool"; tool_ref: CapabilityRef }
    | { kind: "open_skill"; loader_tool_ref: CapabilityRef; name: string }
    | { kind: "open_mission_skill"; loader_tool_ref: CapabilityRef; name: string }
    | { kind: "create_task"; action_tool_ref: CapabilityRef; profile_id: string }
    | { kind: "inspect_mcp"; action_tool_ref: CapabilityRef; server_ref: CapabilityRef }
    | { kind: "open_mcp_prompt"; action_tool_ref: CapabilityRef; prompt_ref: CapabilityRef }
    | { kind: "open_mcp_resource"; action_tool_ref: CapabilityRef; resource_ref: CapabilityRef }
    | { kind: "manage"; action_tool_ref: CapabilityRef }
    | { kind: "unavailable"; reason_code: string }
}

interface CapabilitySetDescriptorV1 {
  ref: CapabilityRef & { kind: "capability_set" }
  name: string
  description: string
  member_refs: CapabilityRef[] // leaf only; sets do not nest
  owner_revision: string
}
```

`search_terms` 可以从 Skill/selector body 派生，但 Catalog 不返回 body；只持久化 bounded terms 与 metadata digest。Descriptor 不含 token、header、environment、MCP arguments、resource body、Skill body、最终 Tool schema 或 package executable bytes。最终 Tool schema 必须在具体 occurrence 的 Provider/model/config/plugin 上下文中，经 `Tool.init`、`tool.definition` plugin hook 和 `ProviderSchema` normalization 后才能计算 digest，不能伪装为全局 descriptor 属性。

### 6.2 One Catalog implementation, context-bound snapshots

每个 owner 必须实现同一 read-only adapter：

```ts
interface CapabilityCatalogSourceV2 {
  owner_ref: string
  owner_revision: string
  descriptors: CapabilityDescriptorV2[]
  sets: CapabilitySetDescriptorV1[]
}
```

Catalog builder只有一个实现，但分两层：project-scoped owner inventory source cache可以复用；dispatch adapter另发布occurrence-scoped source。Effectful stage Tool读取既有`stageMaterializers`；pure collector/control Tool由`dispatchTurn`、adapter ABI/version和canonical input中冻结的durable toolkit input refs/digest确定性生成，并以同一versioned reducer折叠已提交ToolPart history恢复状态。Toolkit refs只允许现有Task/artifact/version等durable IDs；byte attachment仍作为canonical input FilePart单独持有，禁止把唯一attachment URL藏在snapshot blob内绕过GC collector。交给运行时的`CatalogViewSnapshotPayloadV2`必须绑定occurrence context，不是project singleton。

```ts
interface CatalogViewSnapshotPayloadV2 {
  schema_version: 2
  owner_revision_vector: Record<string, string>
  fixed_package_digests: Record<string, string>
  materialization_scope: {
    provider_id: string
    model_id: string
    api_npm: string
    config_revision: string
    plugin_revision: string
  }
  occurrence_owner_bindings: Array<{
    kind: "dispatch_stage"
    adapter_id: string
    adapter_abi_version: number
    dispatch_turn_digest: string
    effectful_tools: Array<{ ref: CapabilityRef; materializer_binding_digest: string }>
    collector_tools: Array<{
      ref: CapabilityRef
      reducer_version: number
      toolkit_input_refs: string[]
      toolkit_input_digest: string
    }>
  }>
  descriptors: CapabilityDescriptorV2[]
  sets: CapabilitySetDescriptorV1[]
}

interface CatalogSnapshotBindingV2 {
  snapshot_ref: string         // canonical content-addressed AttachmentStore URL
  snapshot_hash: string        // SHA-256 of payload bytes; ref/hash are outside the payload
}
```

Catalog builder：

1. 读取 exact project context 下所有适用 owner source；
2. 校验 ref/owner、duplicate、set member、behavior target存在、metadata digest 和 bounded metadata；
3. deterministic sort；
4. 对完整`CatalogViewSnapshotPayloadV2`（包括owner vector、package digests、materialization scope、occurrence owner bindings、descriptors与sets）做deterministic canonical serialization，再计算SHA-256；任一binding、set member或reducer version变化都必须改变hash；
5. owner inventory source 在 project-local single-flight 下缓存；每个 occurrence context 发布独立 immutable view；并发任务固定到不同 package revision 时得到不同 view；
6. 任一 owner 失败则返回 owner-specific unavailable，不丢 owner 后发布“完整”snapshot；
7. owner mutation、MCP listChanged、Skill/Squad install/update/uninstall、config assignment 和 auth revision 推进统一 generation。

Exact compact view只存入现有 `AttachmentStore`，canonical ref固定为 `/attachment/<project-id>/<sha256>.json`；不再保留“runtime artifact / Attachment Store”二选一。写入顺序是temporary blob -> hash/JSON校验 -> atomic rename -> carrier transaction，因此写后未提交的blob是可回收orphan，carrier不会指向半写文件。

Conversation、scheduler wake和Task worker在canonical authoritative input TextPart metadata携带`catalog_snapshot_ref` + hash。MCP `catalog_advanced` ToolPart先完整可见，随后实际执行inspection的exact Tool owner追加引用该result与owner/server digest的successor input TextPart；普通server、package MCP与OAuth使用现有`source:"task_tool"`，只有带UI resource的真实MCP App使用`source:"mcp_app"`。Worker的message authority因此仍能定位input message及其Part。不修改strict `WorkerTurnDescriptor.payload`，不新增source enum或表。`AttachmentStore.collectReferencedShas()`已经扫描`PartTable.data`，因此所有input与receipt进入同一live-reference collector；scheduler wake不建立额外carrier。读取时校验ref中的project ID等于occurrence project、blob SHA/JSON hash一致。终态不立即删除审计事实；当现有retention/delete流程删除全部Part row后，下一次sweep释放blob。进程在blob写入后、Part提交前崩溃时由young-orphan grace后清理；Part引用缺blob是typed corrupt occurrence，禁止以latest snapshot替换。旧binary接受TextPart现有`metadata: record<string, any>`并忽略V2 key，因此Phase A回滚不需要改写immutable history。

### 6.3 One HarnessProjection V2

所有 native、Mission、scheduler 和 worker owner 在 materialization **之前**生成：

```ts
interface CapabilityGrant {
  ref: CapabilityRef // leaf or one-level capability_set
  access: "discover" | "execute" | "discover_execute"
  descendant_scope?: "mcp_snapshot_children" // valid only for an mcp_server ref
}

interface HarnessProjectionV2 {
  context: HarnessContext
  owner_revision: string
  catalog_snapshot_ref: string
  catalog_snapshot_hash: string
  grants: CapabilityGrant[]
  projection_hash: string
}
```

- `grants` 是唯一资源声明列表；Resolver 展开 set 后分别得到 frozen discoverable leaf set 与 executable leaf set。
- Search 只能返回 discoverable leaf；任一 `behavior` 指向的 `tool_ref`、`loader_tool_ref` 或 `action_tool_ref` 只有在 permission/switch narrowing 后仍属于 executable leaf set 时才能 reveal。否则 descriptor 必须呈现 typed unavailable，不能借 Skill、Squad、MCP metadata 扩张执行权。
- `descendant_scope`默认不存在；唯一V2例外是明确授予MCP server的`mcp_snapshot_children`。它在当前occurrence只允许inspection/auth，在visible `catalog_advanced`之后，successor occurrence才可把该server的exact auth/list snapshot children展开为leaf grants；不得跨server、跨auth scope或使用fuzzy result扩张。Resolver强制`child_access ⊆ parent_access`：discover parent只能生成discover child；execute parent只能生成execute child；discover_execute parent才可保留两者。即使parent允许execute，exact child仍须经过permission/switch narrowing后才可reveal。
- `base_role` 只选择 runtime template upper bound，不自动授予 Tool。常用 platform base 由显式 `platform/set/<role>` ref 表达。
- 平台 transport set 由 runtime owner显式追加并进入同一 projection hash；package 不能删除或冒充。
- Harness 不保存 loaded/revealed 状态。Turn 的 revealed subset 只从同 occurrence 的 search receipts 派生。

### 6.4 Search result 与 reveal receipt

```ts
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = { [key: string]: JsonValue }

interface CapabilitySearchInputV2 {
  queries: string[]             // 1..4；支持复合任务分项检索
  kinds?: CapabilityKind[]
  owner_refs?: string[]
  exact_refs?: CapabilityRef[]  // 搜索后可用同一 Tool 精确 reveal
  deactivate_refs?: CapabilityRef[] // active leaves with no unfinished call or permission continuation
  limit?: number                // 1..10 metadata results; at most 5 executable reveals
  expected_catalog_snapshot_hash?: string
}

interface CapabilitySearchResultV2 {
  ref: CapabilityRef
  set_ref?: CapabilityRef
  name: string
  description: string
  availability: "executable" | "metadata_only" | "requires_auth" | "denied" | "unavailable"
  next_owner: CapabilityDescriptorV2["behavior"]
  score: number | null
  catalog_snapshot_hash: string
}

interface CapabilityRevealReceiptV1 {
  occurrence_id: string
  search_call_id: string
  reveal_revision: number
  expected_prior_revision: number
  harness_projection_hash: string
  catalog_snapshot_ref: string
  catalog_snapshot_hash: string
  materialization_fingerprint: {
    provider_id: string
    model_id: string
    api_npm: string
    config_revision: string
    plugin_revision: string
    owner_revision_vector: Record<string, string>
  }
  result_refs: CapabilityRef[]
  deactivated_tool_refs: CapabilityRef[]
  activated_tools: Array<{
    ref: CapabilityRef
    provider_name: string
    canonical_name: string
    normalized_definition_json: JsonObject
    definition_digest: string
  }>
  active_tool_refs_after: CapabilityRef[]
  active_tool_payload_digest: string
  active_tool_payload_chars: number
}
```

Search 对 fuzzy query 的 top results 和 `exact_refs` 执行同一 discoverable-set 校验，并对所有 next-owner target 再执行 executable-set 校验。Discoverable 但行为 target 不可执行的条目以 `metadata_only` 返回，`next_owner` 降为 typed unavailable；它不能 reveal。Reveal 才运行 `Tool.init`、plugin `tool.definition` hook 与 Provider-specific normalization；`definition_digest` 对 post-hook、post-normalization 的 strict JSON 计算。`provider_name` 必须在 base Tool、既有 receipt 与本批 reveal 中全局唯一，ref 到 provider name 一一映射；碰撞返回 typed materialization error，禁止覆盖。

完整 normalized definitions 保存在 ToolPart metadata，文本结果只显示 refs、名称、availability 和 next owner。下一 Provider step从receipt有序折叠`deactivated_tool_refs`与`activated_tools`，并核对`active_tool_refs_after`与active payload digest，重建bounded active TurnCapabilityProjection；历史receipts append-only保留，schema可以在后续search明确deactivate并重新exact reveal。存在未完成Tool call或permission continuation的ref不得deactivate。Receipt schema必须strict，不允许`unknown[]`、隐式extra fields或仅凭Tool名恢复。

并发 search由occurrence-scoped durable reveal owner串行化：每次调用携带`expected_prior_revision`，按`search_call_id`幂等。`Tool.init`、async plugin hook与Provider normalization先在事务外、针对immutable snapshot/fingerprint生成candidate；随后短Message/ToolPart事务执行CAS、重验fingerprint与active calls、应用deactivate、检查active count/payload预算并提交monotonic reveal revision。CAS loser丢弃candidate，读取新revision后重新物化；不创建pending reservation或把任意plugin工作放进SQLite写事务。同revision的unique-ref union按canonical ref排序，不能用完成时间决定schema顺序或突破active预算，不新增parallel state table。

### 6.5 Context budgets

第一版固定预算：

- 初始 execution surface：只有 `capability_search`，Provider-normalized payload 不超过 **4,000 chars / 1,000 estimated tokens**；
- 每次 search 最多 reveal 5 个 leaf Tool；
- 单个 Provider step同时active最多10个leaf Tool；长流程通过receipt中的显式deactivate/re-reveal滚动，不限制occurrence历史revealed ref总数；
- 每个 Provider step的normalized active Tool payload（含`capability_search`）不超过 **32,000 chars / 8,000 estimated tokens**；
- 单个 leaf 超过 32,000 chars 直接阻止发布，必须先拆分 action schema；不存在 oversized exception 或 fallback；
- 新 authoritative input occurrence 从空 revealed subset 开始，Session 不跨请求累计 schema。

这使普通初始Work step相对当前149,803 chars至少下降97.3%；任一满载active step也下降至少78.6%。该数字不声称长流程总token同幅下降，后者由含stage Tool的paired E2E benchmark验证。

## 7. Expert Squad Manifest V2 hard cutover

目标 projection：

```json
{
  "capability_sets": {
    "shared-method": {
      "description": "Shared package method and publisher",
      "member_refs": [
        "capability:skill:package:<owner>:<skill>",
        "capability:tool:package:<owner>:<publisher>"
      ]
    }
  },
  "capability_projection": {
    "scheduler": {
      "base_role": "orchestrator",
      "capability_refs": [
        "capability:capability_set:platform:tool-registry:orchestrator-base",
        "capability:capability_set:package:<package>:shared-method"
      ]
    },
    "agents": {
      "analyst": {
        "base_role": "deep-research",
        "capability_refs": [
          "capability:capability_set:platform:tool-registry:deep-research-base",
          "capability:capability_set:package:<package>:shared-method"
        ]
      }
    }
  }
}
```

Cutover 同时删除：

- `inherit_base_tools`；
- `built_in_tool_ids`；
- default/package Skill、Tool、MCP server/tool/prompt/resource 十二个数组；
- 对这些数组逐类 parse、canonicalize、expand、catalog 和 materialize 的 Resolver 分支；
- package MCP 的 per-role 数组和特殊 Resolver 分支。

package MCP 的物理目录与公开 package capability 保留，因为外部/Multica 动态 package 可能使用；它只作为 package-root inventory source，经 generic MCP owner descriptor/set contract 发布一次，不再有 role-specific package MCP 协议。

新 runtime 不提供 manifest v1 reader、双 schema、fallback 或 runtime translator。Forward gate先停止V1新admission，并扫描所有非终态Task、scheduler wake、`WorkerTurnDescriptor`和开放permission/interaction continuation；只要存在绑定V1 `packageDigest`的恢复主体，Phase B release就明确blocked，继续由旧binary处理到终态，绝不改写其immutable binding。全部drain后才停止旧binary并运行一次性、all-or-nothing pre-start migrator，把已安装V1 package升级为V2，并用现有replacement intent/backup机制保存immutable V1 rollback backup。

Built-in、Market source、portable template、authoring Skill contract、SDK writer、payload generator、generated SDK/OpenAPI/docs与122个当前作者manifest在同一release升级。迁移器不是运行时兼容层；新进程只读V2。若业务不能完成V1 drain，该release不启用，方案不暗藏V1 reader或Task binding migration。

## 8. Runtime lifecycle 与恢复

1. authoritative input Message、scheduler wake和Task worker在occurrence admission时原子冻结Harness V2，并把exact `catalog_snapshot_ref`与hash写入canonical input TextPart metadata。由MCP owner result推进时先记录ToolPart，再由实际inspection Tool owner以现有`task_tool` source追加successor input；仅真实MCP App使用`mcp_app`。Worker沿用`WorkerTurnDescriptor.messageAuthority.user_message_id`定位input message；descriptor schema不加V2字段。
2. 第一个 Provider step 只序列化 `capability_search`。
3. Search 从 frozen allowed set 和 exact snapshot 过滤、排名、reveal；不读取 latest config 扩权。
4. Search ToolPart 以完整 receipt 成为 reveal 唯一事实；下一 step 组合 `capability_search + revealed exact leaf tools`。并发 reveal 通过 occurrence revision CAS 原子预留预算并提交。
5. 具体 Tool 调用按当前 exact provider kind、digest、arguments 和 permission fingerprint 执行；search receipt 不预批准调用。
6. 进程恢复从相同input Part、exact catalog view与search receipts原样重建definitions，不重新搜索、不热读更新后的package，也不重新决定schema。Effectful stage Tool使用descriptor中既有materializer binding且不重放已完成调用；pure collector/control Tool由snapshot中的adapter ABI、dispatch turn digest与durable toolkit input refs/digest初始化，再用versioned pure reducer折叠该occurrence已提交的真实ToolPart request/result恢复state。恢复transport或实际MCP call可以重连；MCP在业务副作用前可重新list并只验证exact ref + normalized definition digest，不能用新list选择替代Tool。digest漂移返回typed stale occurrence。
7. 实际调用前 owner 重验 definition/provider/materialization fingerprint；漂移返回 typed stale occurrence，要求新的 authoritative input，不兼容替换。已提交控制副作用不因恢复重复执行，沿用现有 ToolPart call/result idempotency。
8. occurrence 终态或下一真实 input 清空 revealed subset；Session 生命周期不成为 schema cache。
9. 所有 search、reveal、Tool call、permission request/result 都是正常可见 Tool/result part；Provider stream 保持唯一流式调用链。

未验证或未认证MCP server的inspection/auth结果不得原地扩张frozen exact leaf set。MCP owner返回可见`catalog_advanced` Tool result，原occurrence正常收敛且不再发下一Provider step；实际inspection Tool owner随后用现有`task_tool` source追加引用该result与exact owner/server digest的successor input。只在原Harness已显式授予该server `mcp_snapshot_children`且child access不强于parent时，successor才冻结新auth/list revision与exact leaf refs并继续search。`listChanged`同样只影响下一occurrence；当前occurrence调用已revealed leaf时仅做exact digest验证并在漂移时stale。这样普通server、package-root dynamic MCP和OAuth都不需要hidden reconnect、用户补一句话或同occurrence扩权，也不合成用户消息；真实MCP App仍保留自己的`mcp_app` source。

## 9. Provider 策略

第一版只实现 Host-managed search-and-reveal，覆盖全部 Provider：

- 继续走 `llm/api.ts -> streamText` 唯一流式入口；
- 不直接启用 OpenAI/Anthropic server-side Tool Search；
- 不在 Provider transform 中添加 model-name 路由、fallback 或第二 event history；
- AI SDK 已有的 native Tool Search 能力只作为未来 transport optimization 研究输入，本次明确排除。

未来若要启用 native optimization，必须先证明其 `tool_search_call/output` 能无损归一为同一个 visible search ToolPart、receipt、recovery 和 permission contract，并让不支持的 Provider 得到完全相同的 turn 边界；否则不实现。

这个排除关闭了“部分模型同 response 调用、其他模型跨 step”的双语义风险。

动态 Tool 表可能改变 Provider prompt caching，方案不宣称 cache-preserving。Benchmark 必须记录 cached input tokens、cache writes、实际成本和延迟，证明总成本而非只证明首步 schema 变小。

## 10. 模块所有权重构

| 新/收敛 owner | 唯一职责 | 从当前模块移走 |
| --- | --- | --- |
| `capability/ref.ts` | ref/codec/kind | 保留并加 `capability_set` |
| `capability/descriptor.ts` | descriptor/set schemas | 从 Tool/Skill/MCP/Squad adapters 的 ad-hoc shape 移出 |
| `capability/catalog.ts` | source collection、context-bound snapshot、owner source cache、invalidation、search index | 替换 `tool/capability-catalog.ts` 临时 builder；吸收本地 Skill/Squad ranking contract |
| `capability/harness.ts` | owner grants -> frozen allowed leaf set | 替换当前 per-context post-hoc projection assembly |
| `capability/reveal.ts` | search receipt、budget、occurrence reconstruction | 新职责，但不拥有 inventory/permission/execution |
| `ToolRegistry` | Tool descriptor + exact leaf initializer | 删除整 pool eager materialization |
| Skill/Mission Skill owner | inventory revision + exact content open | 删除自己的 fuzzy ranking |
| MCP owner | auth-scoped descriptor snapshot + exact leaf materialize/call | 删除 host/scoped 两套不一致的 full-list projection |
| Dispatch adapter owner | effectful binding + deterministic pure-tool factory共同发布occurrence-scoped source | 私有stage Tool不搬入全局ToolRegistry；删除其eager model projection |
| `PromptProfileResolver` | package revision、workflow、capability ref/set resolution | 移出 Tool/MCP/Skill materializer与 search cache，显著缩小模块 |
| Permission authority | exact call authorization/evidence | 不变；不接收 fuzzy score |

当前 experimental `batch` Tool 会从当前 Tool table 动态派生 schema，若在 V2 中继续存在就会重新携带全部 deferred leaf definitions。它在 hard cutover 时从 model surface 删除；除非未来先证明一个不枚举 leaf schema、受同一 receipt/permission/budget 约束的 bounded generic ABI，否则不恢复。

## 11. 实施顺序与删除门

### Phase A — Descriptor/Catalog 单源

1. 建立 V2 descriptor/set/source contracts。
2. 让Tool、Skill、Mission Skill、MCP server snapshot、Expert Squad和dispatch adapter各自发布source revision；stage source分别实现effectful binding与pure deterministic factory。
3. 用 project-scoped owner source cache、context-bound immutable snapshot、single-flight 和 invalidation generation替换当前 runtime builder。
4. `capability_search` 切到新 Catalog；同一提交删除旧 `tool/capability-catalog.ts` builder 和重复 ranking adapter。

Exit：搜索行为仍为 metadata-only，但 owner revision、cursor、availability 和完整 snapshot 已单源。

### Phase B — Manifest/Tool-pool V2 hard cutover

1. 引入 platform CapabilitySet definitions。
2. 一次性升级 122 manifest、SDK schema、authoring/template/generator/generated artifacts。
3. Resolver 只解析 `capability_refs` 与一层 set expansion。
4. 删除 v1 per-kind arrays、inherit boolean、所有 reader/test/docs。

Exit：所有 Harness owner 都输出 V2 allowed set；当前 execution 暂时仍可 eager materialize，但不再有两种声明 schema。

### Phase C/D — Atomic leaf projection + search-and-reveal cutover

1. 先在不暴露给模型的 canonical action Registry 中建立 leaf descriptors，让 `PanelCapabilityRegistry` 等 owner 可按 exact ref 物化单 leaf；HTTP/SDK action owner继续引用同一 Registry，不复制 action schema。
2. 拆分 `panel`、`publish_interactive_artifact`、`todowrite` 与所有 >32,000-char leaf；添加 occurrence-bound reveal receipt、CAS budget owner 和 TurnCapabilityProjection。
3. 在同一不可分割release中，让Session Loop初始只物化`capability_search`，搜索后从receipt维护bounded active exact leaf set并支持显式deactivate/re-reveal；native、Mission、scheduler、worker、delegated run、stage-owned Tool和permission continuation同时切换。
4. 同一release删除模型面的umbrella Tool identity、experimental `batch`、role pool与stage Tool eager materializer、Conversation/Mission post-hoc Harness和旧full-MCP projection。

Exit：任一 exact leaf 可独立 reveal且不超过预算；所有执行 Agent 同语义。不得部署“leaf registry 已暴露但仍 eager 全量发送”的中间态。

### Phase E — Search 入口收敛

1. Skill/Mission Skill Tool 删除 fuzzy/list branch，只 exact open/read supporting file。
2. Expert Squad 本地 installed/effective search 归入 Catalog；inspect/create Task 保持 exact owner。
3. Skill Market 保留 external search/inspect/install，因为它是未安装 network inventory；本地安装完成后进入 Catalog。
4. 删除旧 search schema、cursor/cache、文档与 prompt 指引。

### Phase F — Benchmark、真实 E2E 与文档收敛

运行第 12 节全部 checker；修复到达标。更新 current architecture，删除本 dated record 中已过时的“pending”文字引用，不保留兼容索引。独立审查无发现后提交。

每个 phase 都是一个内部 hard replacement，不通过 feature flag 保留 eager/search 双运行时。Phase A/B 可以存在“新 Catalog/V2 grants + 旧 eager execution”，因为它们分别是 discovery/declaration 与 execution owner，不是同一事实的双写；模型面 leaf 拆分、deferred reveal 和 eager 删除必须在 Phase C/D 同一提交、同一 release 原子完成。

### 11.1 迁移、恢复与回滚边界

| Phase | 持久化变化与迁移 | 正向恢复 | 回滚条件 |
| --- | --- | --- | --- |
| A | Versioned、content-addressed catalog views只写AttachmentStore；canonical input TextPart metadata增加ref/hash，strict WorkerTurnDescriptor不变。 | 新binary经message authority读取exact view；source cache可重建，missing blob为typed corrupt。 | 回滚前drain新occurrence；未引用blob由sweep回收，Part引用随retention；旧binary接受并忽略TextPart metadata V2 key。无历史migration。 |
| B | Forward gate先阻止V1新admission并要求所有V1-bound Task/wake/descriptor/continuation终态；随后pre-start migrator用现有replacement intent/backup逐package all-or-nothing写V2，保留immutable V1 backup。 | 新runtime只读V2；中断时replacement intent恢复上一完整版本后重试。 | Gate未drain则不升级；升级后回滚先停止V2 admission、drain V2 occurrence，再由hook从V1 backup原子恢复并启动旧binary。 |
| C/D | 新 occurrence产生 V2 snapshot/ref与 reveal receipts；旧 runtime没有 reader。 | 同版本进程从 exact snapshot + strict receipts恢复；MCP仅重连并验证 exact digest。 | release边界先 drain/终止旧 occurrence；回滚时先让所有 V2 occurrence终态或 typed stale，再启动旧 binary。不得跨 binary重放 receipt。 |
| E | 只删除重复 search surface，无新增 durable state。 | Exact open/create owner沿用 C/D receipt。 | drain active occurrence后回退该提交；不恢复双 search index。 |
| F | Benchmark fixtures/report是versioned artifact，无生产状态。 | 相同 manifest/model/config可复跑。 | checker未达门槛则不发布前一 phase；不以生产 fallback补偿。 |

每个 phase 使用一个可审查 commit/release boundary；migration、binary 和 rollback hook作为同一交付验证。任何 phase 都不允许部分节点长期运行不同 manifest/runtime contract。

## 12. Benchmark 与验收

### 12.1 可执行目录与 case contract

固定实现目录 `packages/opencorvus/script/capability-search-benchmark/`：

- `schema.ts`：strict case、run record、report schema；
- `generate.ts`：从 exact inventory snapshot生成候选 cases，不直接改 gold labels；
- `run-static.ts`：deterministic scorer与budget checker；
- `run-e2e.ts`：真实流式 Provider/host-managed search-and-reveal runner；
- `check.ts`：门槛、paired statistics与baseline比较；
- `testdata/cases.jsonl`、`testdata/run-matrix.json`：versioned gold cases与exact model/provider/config/plugin revisions。

每个`cases.jsonl` row至少包含：`id`、`locale`、`caller_kind`、`harness_fixture_ref`、`harness_revision`、`worker_descriptor_fixture_ref`、`user_request`、`search_queries`、`required_refs`、`optional_refs`、`forbidden_refs`、`expected_next_owner_refs`、`max_k`和`mode`（single/composite/stage_workflow/denied/auth/catalog_advanced/stale/restart）。所有refs必须解析到该row固定的inventory snapshot；非stage case的worker descriptor field为explicit null。

从当前真实inventory生成候选集：122 Expert Squad、713 role projection、全部built-in Tool/action leaf、Skill/Mission Skill metadata、Browser 45、Computer 8、全部dispatch adapter private stage Tool及其materializer revision，以及普通MCP fixture的paginated/listChanged/auth-scope variants。首版至少280 cases：80单Tool、80复合Tool、40 Skill/Squad owner、40完整stage workflow（frontend-design、frontend-research、deep-research、visual-qa、integrity各至少8）、20 denied/auth/catalog-advanced/stale、20中英文对齐。

Gold label 由 exact inventory证据产生，再由两名独立 reviewer分别标注 required/optional/forbidden/next-owner；不一致由第三名 reviewer裁决，case记录 inventory hash、来源和裁决 revision。从匿名化生产 trace 只抽取用户目标和实际 accepted leaf refs，不带 credential、arguments 或 body。

### 12.2 指标与门槛

| 指标 | 门槛 |
| --- | ---: |
| 单 Tool recall@5 | >= 95% |
| 复合任务完整 set recall@10 | >= 90% |
| wrong-owner / denied ref reveal | 0 |
| stale revision acceptance | 0 |
| deterministic same-snapshot order | 100% |
| initial Tool payload | <= 4,000 chars / <= 1,000 est. tokens |
| each Provider step active payload | <= 32,000 chars / <= 8,000 est. tokens |
| 默认 Work payload chars 降幅 | >= 90% |
| tool-heavy case median total input tokens | 相对 paired eager baseline下降 >= 50% |
| 端到端任务成功率 | paired bootstrap 95% CI下界 >= -0.02 |
| median actual cost / passing case | 相对 eager baseline不增加 > 5% |
| p95 end-to-end latency | 相对 eager baseline不增加 > 30% |
| permission/auth/restart exact replay | 100% positive contract |

每次 run 记录 initial/total input tokens、output tokens、cached input tokens、cache writes（Provider可见时）、实际 USD cost、first-use latency、completion latency、search turns、revealed refs与最终 pass/fail。报告 p50/p95、paired delta、5 次 repeat 的 paired bootstrap 95% confidence interval；binary success同时给 Wilson interval。不能以更少 Tool calls、tokens、cache hit 或更高 search score替代最终任务成功。复合任务必须验证全部所需 leaf，而不是只命中一个看似相关 Tool。

普通 execution turn 的初始 function Tool 只有 `capability_search`。使用 `json_schema` response format 时，现有 `StructuredOutput` 可作为 transient Tool额外出现；此类 turn独立分层报告，其完整 request payload仍计入 total input/cost，不能用 4,000-char 普通 execution budget声称所有 request都满足同一上限。

### 12.3 聚焦正向契约

- 同一 owner inputs 生成相同 Catalog/Harness/reveal digest。
- Search 只返回 frozen allowed set；denied metadata不 reveal executable schema。
- exact ref reveal 后下一 step 看到精确 leaf Tool并成功执行 harmless operation。
- Skill/Squad结果 reveal正确 next owner，不直接读取 body或创建 Task。
- MCP pagination完整、重复 cursor失败、listChanged推进下一 snapshot、auth revision隔离 cache。
- MCP child access严格单调：discover-only parent产出discover-only metadata；execute child仍经permission/switch narrowing；denied或跨auth revision返回明确typed result。
- native/mission/scheduler/worker/delegated并发 occurrence不共享 receipts、MCP owner或 loaded schema。
- restart/permission continuation从 exact snapshot与durable receipt恢复，不重跑 search决定；transport可重连，MCP只验证 exact digest。
- 同occurrence两个并发search通过revision CAS得到确定顺序、幂等receipt与原子active预算。
- frontend-design/research/visual-qa/integrity长流程能跨超过10个历史leaf，通过deactivate/re-reveal维持bounded active set并精确恢复。
- Effectful stage Tool从persisted materializer binding恢复且不重放已完成副作用；pure collector/control Tool从adapter ABI + dispatch turn + toolkit input refs/digest初始化，并折叠真实ToolPart history恢复相同state与明确输出。
- 已active但从未调用的leaf可deactivate；存在unfinished call或permission continuation时返回typed active-call conflict。
- 新 input 从空 reveal set开始。
- Complete canonical snapshot payload中任一set member、stage binding或reducer version变化都产生不同SHA-256；相同payload bytes得到相同ref/hash。

### 12.4 真实路径

在真实开发模式和真实 Provider 上运行至少：

1. Code：search -> repository read/edit/test leaf -> verified result；
2. Work：search -> Work Artifact Skill/Tool -> rendered deliverable；
3. Mission：search -> Expert Squad -> fixed-profile Task；
4. MCP：search -> paginated inspection/auth -> visible `catalog_advanced` -> successor occurrence -> exact leaf -> ask approval -> call -> restart continuation；
5. Browser/Computer：只 reveal所需 leaf，不加载全部 53 个 Tool；
6. 中文与英文各一条完整路径。

Run matrix 至少包含：OpenAI exact model ref、Anthropic exact model ref、一个不支持 native tool search 的 OpenAI-compatible Provider；`ask` 与 `full_access`；无 plugin 与一个 deterministic `tool.definition` rewriting plugin；MCP unauthenticated/authenticated/listChanged 三种状态。每个 model/config/plugin cell 跑 5 次，禁止用 model family别名替代 exact ref。

未来在 `packages/opencorvus/package.json` 注册并由 CI调用以下 exact commands：

```text
bun run check:capability-search-static
bun run check:capability-search-e2e
bun run check:capability-search-report
```

Static checker每次相关改动执行；E2E checker在 Phase C/D release gate执行，输出 versioned JSON report与human summary。模型/Provider不可用时是明确 blocked gate，不得用 fixture-only结果冒充。

UI 若因 Settings/permission copy 改动，只用真实 `/ui` 页面、截图和人工复核；不增加或运行 UI 自动化。

## 13. 风险与已拒绝设计

| 设计 | 决定 | 原因 |
| --- | --- | --- |
| 把 Tool/Skill/MCP/Squad 合并为一个 executable interface | reject | 生命周期、权限和 owner不同，会制造万能 Host。 |
| 新增 Harness database/registry | reject | Harness 是 owner input 的派生允许集，不是 active state。 |
| `capability_search + capability_load` 两个永驻 Tool | reject | 多一轮模型决策；search reveal schema 已不扩大 authority。 |
| fuzzy score 直接执行/安装/创建 Task | reject | score 不是 identity 或授权。 |
| 每个 MCP server 整组 load | reject | Browser 45 个 Tool，重新制造 schema 峰值；search/reveal leaf refs。 |
| 第一版启用 OpenAI/Anthropic native Tool Search | reject for this refactor | Provider coverage和事件边界不一致；Host-managed路径已足够验证产品语义。 |
| embedding/vector DB 作为第一版 ranking 依赖 | reject | 当前 multilingual lexical scorer已可评估；Microsoft对应能力仍 experimental，先以 benchmark证据决定。 |
| 保留 v1 manifest compatibility reader | reject | 形成永久双源；122 manifests必须同批替换。 |
| 当前 MCP 连接失败返回空 Tool 集 | reject | 完整 Harness 不可静默退化；返回 typed owner unavailable。 |
| package MCP per-role专用数组继续空置 | reject | 当前作者源无消费者，但外部/Multica动态 package能力必须保留；物理目录作为package-root inventory，经generic MCP descriptor/set owner发布。 |

## 14. Unknown ledger closure

| ID | 结论 | 状态 | 证据 |
| --- | --- | --- | --- |
| U-01 | 默认 identity schema payload 已量化；Work 149,803 chars / 37,457 est. tokens，显式 Browser+Computer 再加 26,898 chars / 7,632 tokens。 | resolved | 隔离 runtime、真实 initializer、Provider-normalized schema、Browser bundle checker |
| U-02 | OpenAI `gpt-5.4+` 与 Anthropic family支持 native deferred search；其余 Provider/adapter不一致。第一版统一 Host-managed。 | resolved | 官方 docs、当前 AI SDK source、GitHub Copilot adapters |
| U-03 | scoped MCP pagination/listChanged存在；host full projection分页/cache不统一，cache必须绑定 auth revision。 | resolved | `mcp/index.ts` + MCP specification |
| U-04 | 本地 capability search 收敛为一个；Skill/Mission Skill/Squad删除排名分支；Market与Artifact明确排除。 | resolved | 定义/调用点搜索与目标 owner map |
| U-05 | 十三数组可无损替换为 `capability_refs` + one-level CapabilitySet；source/kind由 typed ref编码。 | resolved | 122 manifests / 713 projections / 90.1% empty / 448 duplicates |
| U-06 | 第一版不使用 native provider search；所有 search/reveal成为普通 visible ToolPart + next-step materialization。 | resolved | Provider strategy 与流式恢复合同 |
| U-07 | benchmark来源、280-case构成、指标和门槛已固定。 | resolved | 第 12 节 |
| U-08 | Milestone A/B 部分实现：type/search/Harness形态存在；snapshot lifecycle、pre-materialization native Harness、manifest convergence和deferred reveal未完成。 | resolved | current architecture与源码逐项映射 |
| U-09 | Dispatch adapter私有stage Tool必须作为occurrence source：5个effectful Tool用persisted binding；pure collector/control Tool由adapter ABI、dispatch turn、durable toolkit input初始化并用versioned reducer折叠真实ToolPart history；active上限不等于历史revealed上限。 | resolved | `dispatch-adapter-contract.ts`、`stage-tool-materializer.ts`、`runner.ts`、§3/§6/§12 |
| U-10 | 既有V1-bound Task不迁移immutable package digest；forward gate必须阻止新V1 admission并drain全部恢复主体，否则release blocked。 | resolved | `worker-turn-descriptor-facts.ts`、`prompt-profile-resolver.ts`、§7/§11.1 |
| U-11 | Catalog view唯一持久owner是AttachmentStore；binding只进canonical input TextPart metadata，strict WorkerTurnDescriptor不变；普通MCP successor用现有`task_tool`，只有真实MCP App使用`mcp_app`；ref、GC与rollback规则已固定。 | resolved | `message.ts`、`mcp/provider-kind.ts`、`worker-turn-descriptor-facts.ts`、`attachment-store.ts`、§6.2/§11.1 |
| U-12 | Async Tool/plugin materialization在事务外生成candidate；短事务只做CAS/fingerprint/active-budget/commit，loser重算。 | resolved | `tool.ts`、Plugin hook、§6.4 |
| U-13 | Dynamic MCP inspection/auth/listChanged只推进successor occurrence；child access不得强于parent；普通MCP由exact inspection Tool owner以`task_tool`推进，当前frozen occurrence不加入未知leaf。 | resolved | MCP owner flow、`mcp/provider-kind.ts`、§8/§12 |

当前没有未分类问题或未确定设计项。剩余工作是按已定义 phase 实现并用 benchmark/E2E发现新的**实现缺陷**；发现后回到本记录新增 finding，而不是扩充另一个平行方案。

## 15. Delivery record

- 第一轮独立只读审查：FAIL。2 个 P0、5 个 P1、2 个 P2 已分别通过 discover/execute 权限闭包、context-bound snapshot、post-normalization receipt、exact restart、occurrence CAS、cache/cost benchmark、atomic Phase C/D、可执行 benchmark、ledger修正与phase rollback contract解决。
- 第二轮独立只读审查：FAIL。2个P0、3个P1已分别通过stage occurrence owner与rolling active set、V1 drain gate、唯一AttachmentStore/GC contract、transaction-outside async materialization和MCP successor occurrence解决。
- 第三轮独立只读审查：FAIL。0个P0、2个P1、2个P2已通过stage两类恢复owner、TextPart-only snapshot binding、数量事实修正与never-called deactivate contract解决。
- 第四轮独立只读审查：FAIL。0个P0、2个P1、1个P2已通过MCP child access单调继承、exact inspection Tool owner source和complete-payload snapshot hash解决。
- 第五轮最终独立只读审查：PASS。未发现未解决P0/P1/P2、合同矛盾或unknown；权限、snapshot、stage恢复、MCP successor、迁移/回滚、CAS与benchmark合同全部闭合。
- 已通过：`bun run docs:check`、本记录/索引/architecture chapter的 Prettier check、`git diff --check`、Capability Catalog/authorization/Conversation focused tests、Browser MCP Node bundle checker。
- Pre-push暴露`check:architecture-index`把`specs/README.md`全部dated-record链接误当作current-architecture authority的checker scope缺陷；按脚本原注释收窄为只校验该index指向`current/architecture/**`的链接，并删除19个真实失效current-authority入口/交叉引用。3个scope正向测试通过，原checker现为`15 current documents indexed, every link live`；增量独立只读审查PASS。
