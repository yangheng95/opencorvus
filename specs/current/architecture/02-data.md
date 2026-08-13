# 02 — 数据面

> 对应代码：`src/engine/engine.sql.ts` · `src/session/session.sql.ts` · `src/trace/` ·
> `src/bus/` · `src/decision-log/` · `src/storage/` · `src/workspace/workspace.sql.ts` ·
> `src/control/control.sql.ts`

## 运行时目录根

OpenCorvus 拥有的用户级运行时文件统一位于一个 canonical root。显式配置只接受绝对路径
`OPENCORVUS_HOME`；未配置时，Windows 使用 `%LOCALAPPDATA%/opencorvus`，macOS 使用
`~/Library/Application Support/opencorvus`，其他平台使用
`$XDG_DATA_HOME/opencorvus`（未设置时为 `~/.local/share/opencorvus`）。

`@opencorvus-ai/util/runtime-paths` 是 TypeScript 运行时的唯一路径契约；
`@opencorvus-ai/util/runtime-directories` 是目录初始化、临时子目录创建与递归清理的唯一
生命周期管理面。`Global.Path`、channel runtime 和安装脚本均投影固定子目录：
`bin`、`cache`、`config`、`data`、`log`、
`state`、`tmp`、`overlay/embedded` 与 `overlay/webview`。Tauri（Toolkit for building
desktop applications，桌面应用构建工具包）host 实现同一跨语言布局，并把主 WebView
（Web View，嵌入式网页视图）的 user data directory 显式绑定到 `overlay/webview`。
生产临时目录只能由 canonical root 下的 `tmp` 派生。测试 preload 在 canonical
`<root>/tmp/tests` 下为每个进程创建一个 owner，并在加载产品模块前把
`OPENCORVUS_HOME`、`TEMP`、`TMP` 与 `TMPDIR` 投影到该 owner 的固定子树；所有 fixture、
Git template、子进程和第三方临时写入均在该树内嵌套，结束时由同一生命周期管理面整体清理。
测试 owner 不得位于被测 Git 工作树内部，否则无仓库 fixture 的 Git discovery 会越界命中
真实项目仓库。

运行时不得扫描、读取或复制历史 XDG（Cross-Desktop Group，跨桌面规范组织）、AppData
或旧 `~/.opencorvus` 分散目录，也不得把历史位置保留为 fallback。旧数据库及其 WAL
（Write-Ahead Log，预写日志）/SHM（Shared Memory，共享内存）文件只能在进程完全退出后
由用户明确授权的 maintenance 操作整体处置；普通启动和本路径重构不迁移或重建数据库。

## engine 域

所有表定义在 `src/engine/engine.sql.ts`，命名前缀 `engine_`（历史文档里的
`orchestrator_*` 已全部重命名为 `engine_*`）。旧的多张过程表已合并为单一
`engine_artifact`，按 `kind` 区分语义。

### 顶层与持久事实

| 表            | 关键字段 / 状态                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `engine_task` | priority ∈ {critical, high, normal, low}；生命周期从时间、错误与取消事实派生；`session_id` 指向 root session；无 runtime selector 字段 |

### 计划与 Delivery Slice

| 表                      | 关键字段 / 状态                                                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delivery Slice contract | 用户界面仍称 Goal。稳定 `delivery_slice_id` 连接不可变 `delivery_slice_revision_id`；revision 保存 objective、acceptance specifications、owned paths、priority、kind 与精确 RequirementSet/ContractGraph 引用。无 status、depends_on、retry、workspace 或 execution ownership。 |

### 执行与交付（artifact-centric）

| 表                         | 关键字段 / 状态                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine_artifact`          | **统一过程表**，`kind` 决定语义；替代旧的多表过程模型。`EngineArtifactKind` 的唯一真源是 `packages/opencorvus/src/engine/engine.sql.ts`，本文档禁止复制完整枚举。 |
| `engine_progress_snapshot` | 进度快照（旧名 `orchestrator_progress_snapshot` 已重命名）                                                                                                        |

### 交互与绑定

| 表                           | 关键字段 / 状态                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `engine_interaction_request` | type ∈ {permission, question}; status ∈ {pending, …}                            |
| `engine_channel_binding`     | 外部 channel（platform/channel/thread） ↔ task 绑定；`ChannelIngress` 查询入口 |

> 实际 `sqliteTable` 注册以 `packages/opencorvus/src/engine/engine.sql.ts` 的 `export const Engine*Table = sqliteTable(...)` 为唯一真源；本文档只描述表职责，不复制完整注册清单或数量。

**唯一写入者**：`engine_artifact` 的唯一直接表写入文件是
`engine/artifact.ts`。所有 workflow selection、dispatch lineage、execution、证据、
preview、review 与 Task completion artifact row 必须通过这个 writer 进入；生产源码中其他文件禁止直接
`insert` / `update` / `delete` `EngineArtifactTable`。`engine_progress_snapshot`
的唯一直接表写入文件是 `engine/progress.ts`；任务创建、任务状态更新、队列
claim 和 git note 都只能通过这个 writer 记录 progress row。
`engine_interaction_request` 的唯一直接表写入文件是
`engine/interaction-request.ts`；permission/question bridge 与 operator protocol
interaction request 和 operator protocol interaction resolution 都只能通过这个
writer 创建或解析 interaction row。`engine_channel_binding` 的唯一直接表写入文件
是 `engine/channel-binding.ts`；task creation 和 task cancellation / removal 只能通过
这个 writer 创建或删除 channel binding row。RequirementSet 与 ContractGraph 作为
`engine_artifact` 的不可变领域产物写入；ContractGraph 只包含
producer/consumer interface `contracts`，没有 `dependency_contracts`，也不产生 Slice
readiness。Delivery Slice revision 只保存这些产物的精确引用，不存在
Task-current Spec/Plan 指针或 latest-wins 选择器。Slice contract 的唯一 writer 追加
初始 revision；operator 修改 Goal 时追加同一 logical identity 的新 revision，禁止覆盖
旧 revision 或写入 execution bookkeeping。`engine_task`
的唯一直接表写入文件是 `engine/task.ts`；task creation、metadata/touch、
budget/title edits、physical delete、queue reorder/claim、lifecycle state updates
和 rewind cursor mutation 都只能通过这个 task writer 变更 task row。
Task completion 不写入可覆盖的 Task JSON 槽位。每次完成都追加一个
`engine_artifact[kind="task_completion_decision"]`，保存真实 Orchestrator
Session/message/tool-call/tool-part 身份和经过类型、存在性、Task 归属校验的证据引用。
这些关系由唯一的 `recordTaskCompletionDecision` writer 在追加前从持久化
Session/message/tool part/Slice revision/artifact 事实中验证，调用方不能以预检结果绕过。
重新打开 Task 不删除历史决策；只有 artifact `time_created` 与当前
`engine_task.time_completed` 精确相等的决策才投影为当前 `completionDecision`。
叙事 summary 留在真实 assistant message 和 progress 事实中，不复制进完成决策 artifact。
对绑定 virtual workflow 的 Task，完成前还要从当前 Artifact catalog 枚举没有下游消费者的
terminal node agent 所发布的全部 current `expert_output`。这些精确 locator 必须全部出现在
Completion Decision 的 evidence 或 deliverable 集合；缺少任一项时返回
`TASK_COMPLETION_EVIDENCE_INCOMPLETE`，Task 保持非终态。direct Task 与仍被下游消费的中间 node
不适用这一 terminal-output 完整性规则，避免把过程证据误投影为用户交付。
在完成 checkpoint 之前，`complete_task` 还会在同一个 `engine_task.metadata` 权威面取得
`task-completion-closure-v1` 执行收敛租约；取得事务同时要求既有 dispatch 全部结算，
`dispatch_lineage` 唯一 writer 则在其写入事务中拒绝 closure 后的新 lineage。失败或被其他终态
竞争者击败的完成调用释放租约；retry/replan 打开新 execution epoch 时原子删除旧租约；独占项目
进程启动时只清理非终态 Task 的遗留租约；成功完成后的租约保留为该 epoch 的收敛 receipt，但不
替代不可变 `TaskCompletionDecision`。

Expert output publication 在同一个 Artifact 写事务中读取 Task terminal 状态；终态之后只允许内容和
identity 完全相同的 idempotent replay，拒绝新的不同产物。Mission 创建下游 Task 时只提交一个
discriminated `artifact_sources` 权威集合：completed source 只携带 source Task ID，由 Host 读取当前
`TaskCompletionDecision` 并原子展开其完整 `deliverable_artifact_locators`；模型不再复制任何 completed
source locator。failed/cancelled source 没有 CompletionDecision，继续由当前 typed terminal lifecycle
event 加调用者提供的精确 immutable locator 构成恢复权威。两种分支共用同一个 exact import writer，
不存在旧 `artifact_imports` 输入、latest-wins selector 或 fuzzy recovery。prepare 阶段冻结 source epoch/decision，target Task 与
imported Artifact 的同一事务再次进行 compare-and-swap（CAS，比较并交换）复核；source 已 reopen
或换 epoch 时整个 target commit 失败，准备期 TaskArtifact 由既有创建失败清理路径删除。
Reviewer artifact 的 producer Session、completed assistant message、Slice revision、
RequirementSet、ContractGraph 和 evidence artifact 引用同样由
`recordIntegrityReview` writer 验证为同一 Task；这是数据完整性约束，不是调度
或 acceptance gate。
其他 `engine_*` 表的写入仍必须停留在已声明的 engine-owned writer/service 内，
禁止跨域模块直接写。

`engine_artifact.payload` 的严格领域 schema 也是持久化契约。任何让既有 row 无法被当前
严格 reader 解释的 breaking payload 变更，必须在同一提交里修改 canonical
`SCHEMA_DDL` 的对应数据完整性 trigger，并登记精确前置 schema 指纹与 payload 转换，
使非空旧 Database 在业务读取前事务化升级；未知 drift 以 `SCHEMA_MIGRATION_REQUIRED`
失败关闭。禁止只升级 Zod reader 后让旧 payload 在任意 Board、
Conversation 或 continuation 读取点才抛出普通错误，也禁止用 optional 字段、默认值、
row patch 或兼容 reader 猜测新权威。`dispatch_lineage.adapter_input` 由
`engine_dispatch_lineage_payload_insert` 约束为精确 JSON（JavaScript Object Notation，
JavaScript 对象表示法）object，整个 lineage row 不可更新；它的 breaking 变更必须同步改变
该 trigger，形成显式 current-DDL 结构断点。

TaskArtifact 的 Engine envelope 与 exact resource identity 进入 SQLite，当前不可变
manifest 和资源字节则由 TaskArtifactStore 发布。资源完整性错误必须由 exact
Artifact/resource consumer 明确报告；project bootstrap 的 retention scan 只能记录
结构化 corruption evidence，不能把一个缺失或损坏的 snapshot 提升为整个 Project、
VCS、Task events 或 Session events 不可用。严格读取继续验证 manifest、路径、媒体
类型、字节数与 SHA-256，禁止 fallback、伪造字节或自动修复。无法证明安全的回收不
得创建第二条删除路径。

Metrics 域沿用 `engine_*` 表名承载评分流水，但写入边界归属 metrics store：
`engine_metric_spec`、`engine_metric_result` 和 `engine_iteration` 的唯一直接表写入文件
是 `metrics/store.ts`。任务、agent、engine 或 UI 层不得直接写这些 metrics 表。

## session 域（8 表）

`src/session/session.sql.ts`：

| 表                       | 作用                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `session`                | 会话树节点；关键列：`kind`、`parent_id`、`directory`、`permission`、`metadata`；不拥有 Goal lifecycle                                  |
| `message`                | 持久化 user / assistant 消息                                                                                                           |
| `part`                   | 消息分片（tool call / text / reasoning / …）                                                                                           |
| `interactive_artifact`   | Session 内可交互 artifact                                                                                                              |
| `session_control_record` | durable compaction / summarize 等控制请求；记录请求事实，不证明当前 Runtime 存活                                                       |
| `worker_turn_descriptor` | Projected worker 的不可变 Turn identity、模型、tool projection、Task、dispatch lineage、精确 package revision 与哈希；restart 恢复真源 |
| `todo`                   | session 内 todo                                                                                                                        |
| `permission`             | 权限请求（project 级全量规则集）                                                                                                       |

**SessionKind** 固定在 creation time。唯一枚举来源是
`session.sql.ts` 的 `SESSION_KINDS`; 文档不复制成员列表。Projected worker 的
运行身份来自持久化 worker descriptor，不来自 SessionKind。

Session/Trace 是持久化历史与身份容器；Turn/Attempt 是一次模型执行；Runtime
只包含当前进程中的 stream、取消句柄、MCP（Model Context Protocol，模型上下文
协议）连接、tool instance、callback 与 Promise。服务重启只销毁 Runtime，
不能使 Session、message、descriptor 或 durable coordination request 失效。

**去掉的字段 / 索引**（旧文档还在提，代码已清理）：

- ~~`session.channel_key`~~ — Gateway 单例概念删除
- ~~`session_gateway_singleton_idx`~~ — partial unique index 已删

`gateway` 不再是 SessionKind；当前 gateway 是 control-plane HTTP surface / route（见 [03-control.md](03-control.md)），不通过独立 session kind 或旧 gateway 包承载。

Session 通过 immutable dispatch lineage 关联 Task workflow node 和 logical
`workflow_occurrence_id`；lineage 可以列出
一个或多个 `delivery_slice_revision_id` 作为证据主题，但这些引用不表示 Session 归
Goal 所有。Overlay 从真实 live/terminal Session、node evidence、Artifact Catalog、
reviewer artifact 与 Task Completion Decision 分别投影 current revision、独立
activity/evidence/review association 和显式 acceptance。各 facet 互不合成为 Goal
进度或 lifecycle；该 projection 只读，不回写 Slice，不参与调度或 Task 完成判断。

Session message 表按 Session writer 分层写入：`part` 的唯一直接表写入文件是
`session/index.ts`。Build、tool、server route、compaction 和 shell execution 只能通过
`Session.updatePart` / `Session.updatePartData` / `Session.persistMessage` 等 Session writer API
创建或修正 part row，不能直接写 `PartTable`。

## 控制 / 工作区

| 表                | 文件                         | 作用                                                                              |
| ----------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| `workspace`       | `workspace/workspace.sql.ts` | 多工作区代理元数据（路径、状态）                                                  |
| `control_account` | `control/control.sql.ts`     | 外部控制账号（email + url）                                                       |
| `project`         | `project/project.sql.ts`     | 项目根；`time_pinned` 是 Work Ledger 项目置顶状态的唯一来源，且不改变项目活动时间 |

Work Ledger 的置顶状态由各耐久领域拥有：Project 使用
`project.time_pinned`，Mission/Chat/Work 使用 `session.time_pinned`，Task
使用 `engine_task.time_pinned`。各领域 writer 只改写本领域的
`time_pinned` 并发布既有更新事件，不改写 `time_updated`；统一 Work Ledger
投影按 `pinned DESC, updated DESC, rowKey DESC` 排序和游标分页，Overlay 不保存
第二份置顶状态。

Control Agent 的文本、tool call 与 tool result 只写普通 Session message/part；
不存在独立 `control_message` timeline。轻量辅助域仍按领域 writer 分层写入：
`decision_log` 的唯一直接表写入文件是 `decision-log/index.ts`，`quick_note` 的唯一
直接表写入文件是 `quicknote/service.ts`。Project delete 可以编排项目级清理事务，
但必须调用这些领域 writer API，不能直接删除其它领域表。

`project` 表的唯一直接表写入文件是 `project/project.ts`。Project delete 和
Project GC（Garbage Collection，垃圾回收）可以编排项目生命周期，但必须调用
`Project.deleteRows` 等项目领域 API，不能直接写 `ProjectTable`。

生产代码的直接表写入 registry 由
`packages/opencorvus/test/script/db-write-boundary.test.ts` 强制维护：每个出现
`.insert(Table)` / `.update(Table)` / `.delete(Table)` 的表都必须登记唯一 writer 文件。
新增直接写表或第二个写文件会让该测试失败，不能用未登记表绕过分层边界。

## Project Storage Namespace

`project.id` / `project_id` 是后端 storage namespace，不是用户可见项目数。
同一 canonical project worktree / common Git identity 必须收敛到一个后端
namespace；一个目录下的多个用户可见 Mission / task 通过现有 Mission/task 记录
表达，不能通过制造多个 `project_id` 行表达。

`Project.fromDirectory()` 与 exact-worktree convergence 是当前 namespace 入口。
重复 worktree 行只能收敛或显式报错；当历史 JSON/text 中存在
`/attachment/<projectID>/...` 这类嵌入式 namespace identity 时，不能盲改或复制
foreign attachment 来“修复”。Attachment bytes 的物理池在
`.opencorvus/.r/b/a`，但语义 owner 来自记录里的 `project_id` / durable contract。

## 辅助域

| 表                                                            | 文件                         | 作用                                            |
| ------------------------------------------------------------- | ---------------------------- | ----------------------------------------------- |
| `decision_log`                                                | `decision-log/schema.ts`     | **全局共享上下文**，append-only，所有 agent R/W |
| `workbench_brief_snapshot`                                    | `workbench/workbench.sql.ts` | 面板简报快照                                    |
| `memory_file` · `memory_chunk` · `memory_embedding`           | `memory/memory.sql.ts`       | Project 级长期语义记忆                          |
| `task_plan`                                                   | `memory/task-plan.sql.ts`    | 任务计划记忆                                    |
| `quick_note`                                                  | `quicknote/quicknote.sql.ts` | quicknote                                       |
| `session_share`                                               | `share/share.sql.ts`         | 分享                                            |
| `protocol_event` · `protocol_inbox` · `protocol_stream_chunk` | `protocol/protocol.sql.ts`   | 可观测协议事件与流分片                          |
| `task_queue` · `automation` · `automation_run` · `event_job`  | `scheduler/*.sql.ts`         | 调度器                                          |

Scheduler 表按 service 分层写入：`task_queue` 的唯一直接表写入文件是
`scheduler/task-queue-service.ts`；`automation` 与 `automation_run` 的唯一直接表写入文件是
`scheduler/automation-service.ts`；`event_job` 的唯一直接表写入文件是
`scheduler/event-service.ts`。Tool、server route 和 engine 层只能通过
scheduler service 创建、更新或删除 scheduler job / queue rows，不能直接写 scheduler 表。

## Trace — 统一运行追踪（横切）

**代码**：`src/trace/index.ts`

替代旧的：

- `AgentTrace` — per-agent markdown dump
- env-gated `LLMTrace` — session 级 JSONL

**新设计**：

```
每个运行事件（task/agent 边界、llm.step deltas、tool.call/result、lifecycle 事实）
  ↓ AgentTrace.recordLLMRequest / recordHelperLLMCall / trace event writers
  ├─ 追加 JSON 一行到 <Instance.directory>/.opencorvus/trace/<sessionID>.jsonl
  │  以及 _task-<taskID>.jsonl（taskID rollup）和 _index.jsonl（manifest）
  └─ Bus.publish — overlay SSE 消费者实时拿到
```

**自动埋点**：`session/llm.ts`（`LLM.stream` 入口）+ `agent/runner.ts`（`runAgentSession`）+
`orchestrator/agent.ts`（`Orchestrator.processTask` wake）+ `task-api/index.ts`（helper 调用记录）。
Agent 代码不手工调 trace；命名空间是 `AgentTrace`，不是历史文档里的 `Trace.event()`。

## Bus — 全局事件总线（横切）

**代码**：`src/bus/bus-event.ts` · `src/bus/global.ts` · `src/bus/index.ts`

- 类型安全的 event 定义（`BusEvent.define(name, zodSchema)`）
- `Bus.publish()` 全局发布
- SSE 消费者订阅 → overlay 实时刷新
- Trace 双写的第二条路径

Task Conversation 的 Agent progress activity 是 `part` 持久事实的有界读时投影，
不是第二份 transcript。`MessageStore.latestConversationAgentActivityBySession` 通过 canonical
raw Part type/time 表达式索引，在每个 Session 的一个 compound read 中分别读取 Text、Tool、
Patch、File、part-error 的首个有界页，只在该类型含非投影值时继续 indexed keyset，最终保留
最新 24 个实际活动事实。reasoning、boundary、interaction 与 control 等 transcript-only Part
不得先搬入 JavaScript 再被丢弃；其损坏诊断仍由精确 Session transcript route 单独拥有。

事件清单定义在 `engine/model.ts` 的 `Event.*` namespace。Goal 面板更新来自 Slice
revision、Session/dispatch、Artifact、review 与 Task decision 的真实事件；不存在
可写的 Goal 状态事件。

## Decision Log（重申）

- 全局共享 append-only 表。
- 精确动态 worker 通过各自 typed adapter 写入事实与契约；Orchestrator 根据 active package guidance 和当前证据选择后续 projected consumer。
- Adapter ID 与 SessionKind 只描述 ABI 或会话形态，不构成固定 Agent 身份、成员顺序或调度拓扑。
- **传 WHY 不只 WHAT**。

## Task Input 与 Design Resource 语义

`task.attachments` 只保存用户上传的中性输入。每条记录固定为
`intent="task_input"`、`source="user-upload"`；MIME（Multipurpose Internet Mail
Extensions，多用途互联网邮件扩展类型）、文件名和扩展名都不能推导领域语义。
`AttachmentStore` 只负责 canonical bytes 与 metadata sidecar，也不拥有领域语义。
每个物理 project attachment 目录还必须由 `.authority.json` 绑定到唯一
`project_id`、解析后的 worktree 和 Database 内部持久实例 ID。该实例 ID 在结构严格匹配的
普通 reopen 和已登记 schema migration 后保持不变，在同一路径显式 reset、删除重建或
fresh rebuild 后变化；未知 schema drift 只返回 `SCHEMA_MIGRATION_REQUIRED`，不会猜测
refresh、重写该身份或选择 migration。
它是本机物理 Database metadata，不进入 MySQL transfer schema 或 snapshot；import
目标在业务数据恢复后生成自己的新实例 ID。
首次绑定时，空目录可由当前 Database 认领；已有 blobs 的旧目录只有在全部 blobs 都被
当前 Database 引用时才能认领。后续 write 与 sweep 必须匹配该 authority，否则返回明确的
`AttachmentStoreAuthorityError`，不能把另一份隔离 Database 看不到的 live blobs
判成 orphan 并删除。空的物理 store 可以把旧 marker 原子替换为当前 Database authority；
非空 foreign store 仍保持关闭。Project bootstrap 的 sweep 会记录该 typed authority failure，
但不能据此终止不读取或修改附件的 Project runtime、Composer catalog 或文本消息流。
这是存储所有权与数据完整性约束，不参与 Agent 流程调度。

Overlay 手动文件、文件夹、拖放、粘贴和 host attach 的唯一入口先把 raw bytes 写入
project-scoped `POST /attachment`，composer 只保留返回的
`/attachment/<projectID>/<name>` canonical reference。后续 Chat、Mission、Task create
和 Task follow-up 都只传该 reference，不能在 browser store 或 JSON（JavaScript Object
Notation，JavaScript 对象表示法）请求体中保留 data URL / base64 bytes。
全局 New Chat / Work 的空 Composer 和取消 picker 保持零持久化；一旦 picker 返回真实文件或
目录、发生拖放或粘贴，实际附件就是首个 durable input，由统一 Composer Project resolver
创建并激活一个匿名 Project，再进入上述严格 project-scoped ingress。后续首次 Session 或
Mission 提交复用该 Project，不能为附件建立 browser-memory 暂存源或第二个 Project identity。

Composer 的文件与文件夹是两个独立的有界输入集合：文件最多 10 个，文件夹最多 3 个。
文件选择、拖放、粘贴与 host attach 共用文件容量；移除后释放对应容量。文件夹选择必须走
host 的原生单目录 picker，得到一个真实路径后由
`POST /attachment/directory-reference` 校验并写入一份
`application/vnd.opencorvus.directory-reference+json` canonical manifest。一个根目录固定只
产生一个引用和一个 UI（User Interface，用户界面）卡片；该入口禁止使用
`webkitdirectory`、`webkitRelativePath` 或任何递归枚举、逐文件上传、自动压缩逻辑。

手动上传生成的 persisted `Message.FilePart` 必须带
`presentation="attachment-index"`。Provider replay 对所有 MIME 只投影稳定的
filename、MIME 和 URL（Uniform Resource Locator，统一资源定位符）索引，不读取 bytes。
该 presentation 是手动上传来源的显式逐文件契约，不得通过 canonical URL、MIME 或文件名
猜测。没有该标记的 programmatic typed evidence 保留既有 multimodal 行为，避免把 Build、
tool result 或其他显式证据输入误降级为索引。

`frontend_design` 通过 typed adapter 显式声明本次调用的资源及 intent：

- 已上传文件使用 `attachment_bindings[{ attachment_url, intent }]`，URL 必须属于当前
  task / project，且 DB（Database，数据库）记录必须与 canonical metadata 一致。
- 本地材料使用 `materials[{ path, intent }]`。

供应商资源的获取、解析和文件命名属于专家团 package tool / skill / scoped MCP（Model
Context Protocol，模型上下文协议）；core 不识别供应商 URL 或工具序列。Package 将产物
落成 task/project-scoped 本地文件，再通过通用 `materials` 输入。物化的本地材料写入
`system_artifacts`，不能伪装成用户附件。调用方显式声明的 intent 被原样写入
`design_resource_manifest`；manifest 创建过程不能根据 mode、MIME、来源或文件名覆盖 intent。FrontendDesign Agent、continuation evidence 与
reference-parity Build 都只能读取该 manifest 投影出的设计资源。Reference-parity Build
缺少 manifest 或 manifest 中没有 `visual_reference` 时必须显式失败，不能回退扫描原始
attachments / system artifacts。

可渲染 HTML 不是 text-only 备注。`reference_parity` 调用中，显式声明为
`design_source` / `interaction_reference` 的 HTML 是结构、样式、内容和交互的 source
authority。Frontend Design adapter 在 worker 启动前使用现有 Node/Playwright 静态文件
renderer，把每个 HTML 投影成 task-scoped PNG，并在同一个 manifest 中追加
`origin=rendered_design_source`、`intent=visual_reference` 的 raster row；HTML row 与
raster row 通过 `related_entries` 双向绑定，raster 的 task artifact path 记录在
`artifact_paths`。这不是第二份资源目录：manifest 仍是唯一语义索引，AttachmentStore
仍是 byte store，PNG 只是 HTML authority 的可查看/可比较投影。投影失败必须暴露为
materialization/toolchain error，禁止改走 `greenfield_original`。

## Build Input Evidence

Build 输入由 Orchestrator 从 Task、Delivery Slice revision、Artifact、Finding、Attachment 和可见
Session message 临时渲染成一条自然消息与一组稳定 attachment refs。这个临时 read
model 没有公共类型、durable identity、active/current 状态或启动 gate，也不会复制成
`build_session_contract`、Pack 或 Manifest。

AttachmentStore 继续拥有 content-addressed bytes；Session message/file part 只保存
真实 provider byte binding。Build prompt 携带稳定引用和自然文本，真实
byte/project 校验发生在 AttachmentStore read/stage、SessionPrompt byte
materialization 和明确的 storage API 边界。服务重启后从原始 durable facts
重建消息，不读取 runtime/live aggregate。

`filename` 是 display/provenance metadata，不是 byte identity。硬身份校验只能使用
project URL、`sha`、`mime`、`size` 和实际可读 bytes。

后续修复必须作为新的显式 Task dispatch，从持久化消息、Task attachments、Artifact
references 与 Slice/Requirement facts 构造自然输入。Session 不持有 Goal retry
counter 或 retry workspace。已经存在的 provider file part 是真实 Session message
fact，可以复用；不得额外复制成 input manifest。

后续长期文件 owner 是通用 `artifact_file_ref`，不是 attachment-only
`attachment_ref`。在该表实施前，GC 仍可对 `/attachment/...` 嵌入引用做
harvest。

## 相关文档

- [01-agents.md](01-agents.md) — 动态 Agent 投影、runtime template 与 typed adapter 的职责边界
- [03-control.md](03-control.md) — Trace/Bus 如何流向 overlay
