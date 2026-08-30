# Search-native Capability Phase A2 — occurrence-bound Catalog view

Status: completed; independent code review PASS and delivery closure recorded

## Recall

### 用户原始要求

- 将 Tool、Skill、Model Context Protocol（MCP，模型上下文协议）、Expert Squad、Harness 等分散体系重构为模型可搜索、可自行发现解决路径的统一能力面。
- 逐批实施完整方案，持续复核，直到没有未解决问题或未确定条目。

### 本批验收指标

1. `capability_search` 不再在调用时读取当前 Config、MCP、Skill、Mission Skill、Expert Squad 或运行时 Tool surface；它只读当前 occurrence 已冻结的 exact Catalog view。
2. 完整 `CatalogViewSnapshotPayloadV2` 以 deterministic canonical JSON bytes 写入现有 `AttachmentStore`，其 URL 中 SHA-256、metadata SHA-256、carrier hash 与实际 bytes 完全一致。
3. snapshot ref/hash 只写入 canonical parent user Message 的一个 TextPart metadata；不新增表、Artifact owner、WorkerTurnDescriptor 字段或替代 GC registry。
4. blob 写入先于数据库事务；同一事务只做两项因果提交：单调绑定 parent input Part 与创建/接受 assistant occurrence。事务失败留下的 blob 只能是现有 young-orphan grace 可回收对象。
5. 同一 parent input 的后续 Provider step、Task-root open assistant、重启和 permission continuation 复用完全相同 binding；不得重建或 latest fallback。
6. ref 跨 Project、blob 缺失、metadata/blob/ref/hash/JSON 不一致、重复或部分 carrier、schema 不兼容均返回 typed corrupt occurrence；Provider/model/API npm、完整 effective Config digest、Plugin revision 或固定 package digest 漂移返回 typed stale occurrence。
7. projected worker payload包含 exact dispatch-stage occurrence binding：五个 effectful Tool 绑定既有 materializer digest；其余 pure collector/control Tool 绑定 adapter ABI、dispatch turn digest、reducer version 与 durable toolkit input refs/digest。
8. owner mutation generation 有一个 Catalog owner lifecycle API；MCP listChanged、Config settlement、Skill/Squad inventory reset 等真实 mutation point 推进 generation，使下一 occurrence 不会复用 mutation 前的 process cache。
9. strict `WorkerTurnDescriptor.payload`、所有流式 LLM 调用、现有 permission/OAuth/execution owner 与完整可见消息/Tool/result 契约保持不变。

### 硬约束

- 不新增 fallback、兼容 reader、双读写、第二目录、第二 Harness、active capability 影子状态或通用 binder。
- 搜索仍是 metadata-only，不授予能力、不认证、不批准、不执行；search-and-reveal 与 bounded active surface 属于 Phase C/D。
- A2 不提前改 manifest V1、role Tool pool、eager execution、Skill/Squad exact owner 或 MCP execution owner。
- parent user Message 的 authored text、files、source 与 metadata 其他键不可修改。唯一允许的 accepted-ingress 增量是本事务新增的两个 host-owned Catalog metadata key，且只允许从 absent 到 exact value 一次。
- `StructuredOutput` 是响应编码器，不进入 Catalog execution Tool IDs。
- 不运行或新增 UI 自动化测试。
- 保留工作区内本任务外的未跟踪文件。

### 已读资料

- `AGENTS.md`
- `specs/records/2026-08/2026-08-30-search-native-capability-harness-refactor.md`
- `specs/records/2026-08/2026-08-30-search-native-capability-phase-a1.md`
- `packages/opencorvus/src/capability/{catalog,descriptor}.ts`
- `packages/opencorvus/src/tool/{capability-search,capability-runtime-catalog}.ts`
- `packages/opencorvus/src/session/{index,loop,message,runtime-contract}.ts`
- `packages/opencorvus/src/session/prompt/{parts,run}.ts`
- `packages/opencorvus/src/storage/attachment-store.ts`
- `packages/opencorvus/src/agent/{worker-turn-descriptor-facts,dispatch-adapter-contract,stage-tool-materializer}.ts`
- `packages/opencorvus/src/orchestrator/dispatch-turn-projection.ts`
- `packages/opencorvus/src/config/config.ts`
- `packages/opencorvus/src/plugin/index.ts`
- `packages/opencorvus/src/mcp/index.ts`

### 全仓搜索结果

- `Message.TextPart.metadata` 已是 strict TextPart 内允许的 `record<string, any>`，可以承载 V2 keys；无需改 source enum。
- `AttachmentStore.write()` 已实现 staged blob/metadata、完整校验、atomic rename、content dedupe；`readVerifiedReference()` 同时校验 Project、metadata、bytes 与 SHA；`collectReferencedShas()` 已扫描 `PartTable.data`。
- 通用 `Session.updatePart()` 正确拒绝修改 accepted ingress。assistant 一旦落库，parent user Message 也被冻结。因此 A2 不能在 Tool 第一次调用或 assistant 创建后补写。
- `resolveTools()` 在 Provider 调用前已得到当前 step 的真实最终 executable IDs 与 caller Harness；Catalog binding 可以在此后、Provider 之前发布。
- 一个 user input 可驱动多个 Provider step/assistant Message；binding 所有者是 parent user input occurrence，不是单个 assistant Message。已存在 binding 时只能验证并复用。
- Worker descriptor 的 `messageAuthority.user_message_id` 已精确定位 parent input；descriptor 已持久化 package digest、stage-owned IDs、五个 effectful materializer binding 与 dispatch turn，无需扩 schema。
- Config 没有公开 revision API，但完整 effective Config 已是稳定、可 canonical hash 的 snapshot；只持久 digest，不持久可能敏感的 config bytes。
- Plugin runtime 已拥有 exact loaded hook entries；revision 可由 OpenCorvus binary version、configured plugin specifiers、loaded owner/specifier/service ID 与 hook surface canonical digest 产生。
- MCP 已发布 tools/resources/prompts listChanged events；Config settlement 发布 `config.changed`；Skill 与 Squad 已有集中 cache reset/invalidate mutation points。

### 独立 Agent 反馈

- A2 实施前：无。
- 第一轮只读审查发现 parent TextPart 事务覆盖、MCP exact owner/listChanged、Plugin 传递闭包、caller authority、`PartUpdated` 与 exact URL 等问题；均已修复并增加聚焦测试。
- 第二轮只读审查发现 MCP inventory 原子快照/共享 revision/锁内 I/O、Plugin 闭包边界与 caller authority 双源；均已收敛为单一 snapshot、单一 caller authority 与闭包 revision。
- 第三轮只读审查发现 MCP list I/O 仍受锁保护、direct-file/optional peer Plugin 覆盖不完整及 runtime name sanitizer collision；均已修复并增加并发、依赖解析与 typed collision 测试。
- 第四轮只读审查发现 resource 首页面 live bypass、最终 Provider Tool map collision 以及 Plugin AST resolver 与实际 Bun loader 分歧；均已修复为共享全分页 MCP snapshot、最终名称权威与 `Bun.build` 模块图 revision。
- 第五轮只读审查发现 `StructuredOutput` 绕过最终 Provider Tool 名称权威，以及 Plugin revision 与实际 import/manifest resources 仍存在检查与使用时差；已改为解析前预留 structured owner、加载 content-addressed Bun bundle，并把所选 resources 复制为同 revision 的 immutable snapshot。
- 第六轮只读审查确认代码、测试与架构无未解决 P0/P1/P2；仅指出 spec ignored/status/test count/职责描述四项交付 P2。本次收口已 force-add spec、记录 PASS、更新 146 tests，并明确 V2 payload 的唯一 owner 为 `capability/catalog-binding.ts`。
- 第七轮因审查者误检另一个测试文件而误报 projected `StructuredOutput` 覆盖缺失；第八轮按 `tool-result-control-protocol.test.ts` 的真实 projected-scheduler contract、`SessionRuntimeContractStore` 与 `SessionLoop.resolveTools` 路径纠错复核，最终 PASS，确认无未解决 P0/P1/P2。

## 1. 根因与边界

### 可观察现象

当前 `capability_search` 每次执行都从 live Config、Skill/Mission/Squad owner、MCP 状态、runtime contract 与 `ctx.executionSurface` 重建 Catalog。一次 occurrence 中 owner 更新、MCP listChanged、配置变更或重启可使同一查询得到不同 inventory/availability/cursor；permission continuation 也没有 exact Catalog recovery fact。

### 直接触发点

`CapabilitySearchTool.execute()` 调用 `RuntimeCapabilityCatalog.snapshot()`，把 Tool 调用时刻的 process state 当成 occurrence input。

### 数据与控制流根因

Catalog A1 已有 stable owner source、caller projection、content-addressed cache 和 exact revision，但没有 durable occurrence carrier。process cache 只能去重，不能证明某个 Provider step实际看过哪一份 view。若在 search 时补写，写入发生在模型已开始生成之后，既不能覆盖未调用 search 的 occurrence，也无法保证重启和并发一致。

### 旧路径未根治原因

- `catalog_revision` 只标识内存 snapshot 内容，不是 durable input binding。
- Harness 在当前 eager runtime 中仍于 Tool materialization 末尾生成；只有 `resolveTools()` 完成后才知道真实 caller view。
- 通用 Message immutability 不允许在 assistant/ingress 成为因果事实后任意改 Part；需要一个极窄、可证明单调且与 assistant admission 同事务的 host-owned commit，而不是放宽 `updatePart()`。

## 2. 唯一事实与数据合同

`CatalogViewSnapshotPayloadV2` 是唯一 durable Catalog view：

```ts
{
  schema_version: 2,
  catalog_revision: sha256,
  context: CapabilityCatalogContext,
  owner_revision_vector: Record<string, string>,
  projection_revision_vector: Record<string, sha256>,
  fixed_package_digests: Record<string, sha256>,
  materialization_scope: {
    provider_id: string,
    model_id: string,
    api_npm: string,
    config_revision: sha256,
    plugin_revision: sha256,
  },
  occurrence_owner_bindings: DispatchStageOccurrenceBinding[],
  descriptors: CapabilityDescriptor[],
  views: CapabilityCatalogViewEntry[],
  sets: CapabilitySetDescriptor[],
}
```

`views` 是 A1 caller projection 的必要 compact search contract；没有它，availability、discoverable caller 与 next owner 会被迫热读或复制进 descriptor。它与 descriptors/sets 一起属于同一 payload，不建立第二 owner。

Carrier 只允许：

```ts
TextPart.metadata = {
  ...existingMetadata,
  catalog_snapshot_ref: `/attachment/<project>/<sha256>.json`,
  catalog_snapshot_hash: `<sha256>`,
}
```

同一 authoritative parent Message 必须恰有一个带完整 binding 的 TextPart。零个是 typed unbound occurrence；多个、部分或冲突是 typed corrupt occurrence。用户或 Plugin 在 admission 前预占任一 reserved key均失败，不覆盖。

## 3. Admission transaction

新 assistant occurrence：

1. 构造尚未落库的 assistant identity 和 processor；
2. 完成 `resolveTools()`、Skill finalization 与 Harness coordination，冻结 executable Tool IDs（排除 `StructuredOutput`）；
3. 以真实 final Tool IDs/Harness构建 A1 Catalog snapshot；
4. 计算完整 config/plugin/package/stage scope，canonical serialize V2 payload；
5. `AttachmentStore.write(projectID, bytes, application/json, capability-catalog.json)`，校验 returned SHA 等于 bytes SHA；
6. SQLite immediate transaction 中验证 parent/Part/assistant/accepted IDs，新增两个 reserved metadata keys，并创建 assistant、消费 pending delivery；
7. 事务提交后才发布 assistant/Part events、设置 streaming status并进入 Provider。

同一 parent 已有 binding 时，第 3–6 步改为 exact read/verify/scope validation + 普通 assistant admission；不得再次 write blob或改 Part。Task-root open assistant同样只读。

异步 owner读取和 AttachmentStore I/O 永不进入 SQLite write transaction。事务失败不发布 assistant，也不留下 carrier 指向半写 blob；完整 orphan由现有 grace sweep处理。

## 4. Read、recovery 与错误

`CapabilitySearchTool` 通过 `ctx.messageID -> assistant.parentID -> exact TextPart` 读取 binding，验证：

- assistant、parent、Part 同 Session；
- URL canonical 且 URL Project 等于当前 occurrence Project；
- MIME 为 `application/json`，metadata、blob bytes 与 URL SHA 一致；
- carrier hash、reference SHA、raw bytes SHA 一致；
- JSON 只接受 strict schema version 2；
- payload caller等于 Tool初始化 caller；
- `catalog_revision` 与 payload Catalog fields重算一致。

missing/unreadable/malformed/hash mismatch 使用 `CorruptCatalogOccurrenceError`，code 细分 `unbound | partial_binding | duplicate_binding | cross_project | missing_blob | digest_mismatch | invalid_payload | catalog_revision_mismatch`。materialization scope/package mismatch 使用 `StaleCatalogOccurrenceError` 并携带 mismatch fields。两类都禁止 latest fallback。

Permission continuation 在恢复 Tool surface 后执行相同 binding/scope验证；因此配置或 Plugin 在开放 ask continuation期间变化会显式 stale，而不是用新 definitions执行旧批准。

## 5. Owner generation

Catalog generation 是 process cache lifecycle，不是 durable inventory owner：

- 每个 owner_ref 有单调 generation；`invalidate(owner_ref)`推进并清除该 owner关联的 source/snapshot cache。
- mutation event只影响下一次 snapshot composition；已绑定 payload不失效、不被改写。
- MCP tools/resources/prompts listChanged推进 exact MCP owner；Config settlement推进 project-config、mcp-config、conversation projection与plugin scope；Skill installed reset、Mission Skill refresh、Expert Squad available invalidation推进各自 owner。
- source `owner_revision` 仍是跨进程、内容级事实；generation 不能替代 revision，也不得写进 payload。

如果某 mutation path没有事件，builder仍必须读取 owner的 current content revision；generation不得成为跳过权威读取的依据。因此 A2 generation只负责清理 process cache与single-flight，不产生隐藏陈旧窗口。

## 6. Stage occurrence binding

- effectful Tool：从 exact WorkerTurnDescriptor `stageMaterializers` 读取，digest覆盖完整 strict binding；ref owner 为 `dispatch-stage:<adapter>`。
- collector/control Tool：是 `stageOwned - keys(stageMaterializers)`；adapter contract公开 `collectorReducerVersion`。toolkit refs由现有 durable Task ID、input Message ID、dispatch/workflow occurrence、Delivery Slice revision和evidence locators canonical提取；digest覆盖 refs与 exact dispatch turn。
- `dispatch_turn_digest`覆盖 strict dispatch turn或显式 null。
- A2只冻结恢复输入合同；真正从 ToolPart history折叠 collector state以及 leaf reveal cutover在 Phase C/D完成。A2不得声称当前 eager in-memory collector已可跨进程恢复。

## 7. 影响面与测试

代码：

- 新增 `capability/catalog-binding.ts`；
- 扩展 `capability/catalog.ts` 的 cache invalidation/introspection，不复制 ranking；
- `tool/capability-runtime-catalog.ts` 组合 A1 owner/projection snapshot；`capability/catalog-binding.ts` 独占 V2 payload、scope/binding 与持久化合同；
- `tool/capability-search.ts` hard cut到 bound read；
- `session/index.ts` 增加 assistant admission synchronous owner commit primitive，通用 Part writer不放宽；
- `session/loop.ts` 调整 admission顺序并在普通/Task-root/permission recovery读 exact binding；
- `plugin/index.ts` 发布 loaded Plugin revision；
- owner真实 mutation point推进 generation。

聚焦正向测试：

1. canonical payload相同 bytes/ref/hash相同；set member、stage binding、reducer version、config/plugin/model字段任一变化改变hash；
2. parent binding与assistant admission原子成功，Part其他字段/metadata保留，GC collector识别ref；
3. 同parent后续step复用相同binding；search只返回bound view，即使live owner随后改变；
4. restart/permission continuation从assistant parent恢复；
5. missing/cross-project/digest/payload/scope错误映射到明确typed code；
6. Config/MCP/Skill/Squad mutation推进generation且不改变已绑定payload；
7. worker effectful/collector binding覆盖完整stage-owned集合且package digest固定；
8. 现有Catalog canonical/owner/availability/Host Session MCP测试继续通过。

不适用：本批不改 UI、manifest schema、Provider streaming transport、permission决策或OAuth流程，因此不做UI验收、V1 migrator或真实schema reveal E2E。

## 8. 完成门

- 聚焦测试、typecheck、docs/architecture/module/package/routes/control checks通过；
- 独立 agent只读审查完整差异、测试证据、恢复/事务/GC/错误合同，无未解决 P0/P1/P2；
- 本批单独提交，拉取并merge upstream，检查全部待推送commit后push。

## 9. 本地交付证据

- `capability_search` 已 hard cut 到 occurrence-bound V2 payload；assistant admission、parent TextPart carrier 与 attachment hash/ref 形成单一原子因果边界。
- MCP Tool/Prompt/Resource 使用一个完整分页、内容寻址、listChanged generation compare-and-swap 的 immutable inventory snapshot；最终 Provider Tool surface 使用 typed name authority，包含条件性 `StructuredOutput` 预留，禁止普通 owner 或 runtime shadow 静默覆盖。
- Plugin revision 直接取自实际 import 的 content-addressed `Bun.build` bundle；manifest 所选 worker/runtime/asset 资源复制为 bounded immutable snapshot，hook 只接收 snapshot absolute path。测试涵盖 symlink、祖先 `node_modules`、optional peer、loader substitution、build/import 竞态、ESM cache reload 与 resource bytes 漂移。
- 聚焦真实路径矩阵通过：`bun run test` 运行 13 个测试文件，146 pass、0 fail。Windows 下直接多文件 `bun test` 会与仓库 process supervisor 的隔离收敛冲突，因此使用 `package.json` 声明的隔离 runner `bun run test`；该 runner 逐文件运行同一 Bun test engine。
- `bun run typecheck` 通过。
- `docs:check`（338 ops/25 groups）、architecture index（15 documents）、module topology、package topology、routes、control-state redundancy 与 control-lease owners 检查均通过。
- 未运行或新增 UI 自动化测试。本批删除了 live catalog read 等被替代路径；未扩大清理无关技术债，并保留现有未跟踪用户文件。
