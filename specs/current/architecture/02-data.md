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

SQLite 数据库与 data root 不拥有单后端启动锁；不同监听端口的多个后端可以同时打开同一
数据库。物理执行由各领域的 durable lease 协调。破坏性 Project 删除、identity convergence
和匿名 Project promotion 仅通过 `project_maintenance_fence` 隔离其涉及的 Project occurrence：
fence 与 Project generation、维护 operation 和拥有它的 PID/进程启动指纹绑定，Task/Session
新建及 Task-root lease 的取得/续租在各自写事务内读取该 fence。删除和 identity convergence
的启动恢复只在物理观察证明 owner occurrence 已死亡或 PID 已复用后删除对应 fence；promotion
fence 只能由同一 operation/generation 的 durable publication occurrence 收敛并释放，通用死亡
owner sweep 不得释放它。任何 fence 都不得升级为 database path 或 data root 的排他 owner。

匿名 Project promotion 的唯一 Ready 决策是 durable publication terminal receipt。完整的
Project/Session before-snapshot 和 source digest 先写入 immutable occurrence；随后一个 SQLite
write transaction 重读并核对完整 snapshot、取得 promotion fence，首个 filesystem rename 只能
发生在两者之后。外部 Project/Session writer 由 SQLite trigger 在 persistent `promotion` fence
期间拒绝；精确 relocation/rollback transaction 临时使用 `promotion_commit`，并在 commit 前恢复
`promotion`。Project projection 隐藏 fenced row，只有 terminal 已落盘且 exact fence 已释放后才
发布 Project event 和 caller success。启动必须在 listener bind 前收敛所有 open occurrence 和
仍持有 exact fence 的 settled occurrence；未知路径、pre-relocation digest、generation 或双 source/quarantine
不允许猜测所有权或删除数据。

## engine 域

### 业务身份与完整性摘要

`src/id/id.ts` 的默认新签发路径为每个 canonical identity family 生成总长度不超过 24 个字符的
标识；读取或重放历史 caller-supplied 标识仍保持原值。需要稳定重放的业务身份只能在它的存储
迁移或明确 epoch 边界内切换到紧凑派生键。完整 SHA-256 继续保存在其所属 payload、目录或完整性
列中，作为字节相等和防冲突事实；紧凑业务 ID 不是截断后冒充的密码学摘要。Project ID 由完整
normalized repository identity material 经 `Identifier.deterministic("project", material)` 生成不超过
24 字符的 `prj_*` 身份；包含旧 expanded Project primary key 的 pre-release Database 在 bootstrap
返回 `DATA_RESET_REQUIRED`，不创建第二个 Project。Task wait 由 exact Tool Part 确定性派生一个 native
Task-control registration identity；due ingress 与该 wait 的 `due_ingress_accepted` settlement 在同一事务提交，
因此 restart 只重放一个 durable ingress。Automation `cal_*` fire identity 只属于 Session delay、recurring 与
manual Automation occurrence，不再承担 Task wait 业务身份。其他手工或
caller-supplied 新落盘身份尚未迁入该默认签发面，属于后续迁移契约。Project Memory 的 pending
user-input file/chunk 与 Project `MEMORY.MD` envelope file/chunk 分别使用 domain-separated 的 compact
`memory` / `memchunk` identity；完整 Project、occurrence、content 和 provenance 仍在关系与 payload 中。
包含 expanded Project Memory file 或 chunk primary key 的 pre-release Database 返回 `DATA_RESET_REQUIRED`，不
双读或原位改写其外键图。Permission request、execution attempt 和 ledger event 分别使用 domain-separated
deterministic `per_*` identity 与 ordered `per_*` occurrence identity，均不超过 24 字符；policy revision、
provider digest、scope fingerprint 和 execution-result SHA-256 继续保持完整。Permission ledger/result 中
任一 prior-epoch expanded identity 或关系镜像会在 bootstrap 返回 `DATA_RESET_REQUIRED`，不会进入恢复重放。
Scheduler delivery 的 protocol event/inbox 与目标 Message/Part/Session-control 五个 occurrence identity 由同一
invocation 分别 domain-separate 后确定性派生，全部不超过 24 字符。event/inbox 在 enqueue transaction 原子
发行；目标 Message/Part/Session-control 在后续 materialization transaction 与 inbox settlement 原子提交。
prior-epoch expanded scheduler occurrence graph 会在 bootstrap 返回 `DATA_RESET_REQUIRED`，不允许跨 epoch
拼接 replay。
Orchestrator 的 terminal lifecycle/infrastructure wake 使用同一 wake identity 分别 domain-separate 派生 compact
Message/Part identity；完整 wake/fact provenance 保留在 Message extra 与 Part metadata。旧 expanded control
Message/Part graph 在 bootstrap 返回 `DATA_RESET_REQUIRED`，compact identity 被不同语义占用时返回 typed conflict。
Mission terminal caller receipt 使用 Mission Session identity 分别 domain-separate 派生 compact Message/Part；caller、
Mission、terminal reason 与正式 receipt pointer 继续在同一事务持久化。旧 expanded receipt graph 在 bootstrap 返回
`DATA_RESET_REQUIRED`，不同语义占用 compact Message/Part 时在通用 Session upsert 前返回 typed conflict。

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
identity 完全相同的 idempotent replay，拒绝新的不同产物。
idempotent expert output 的业务 ID 由 canonical publication material 经统一 deterministic Identifier
生成且总长不超过 24；完整 payload SHA-256 继续独立存储并进入 exact locator。若短 ID 已被不同
canonical material 占用，writer 返回 typed identity-collision error，不得 alias。包含旧
`art_idempotent_<64hex>` 身份的 pre-release Database 属于不兼容持久化 epoch，bootstrap 在业务读取前
返回 `DATA_RESET_REQUIRED`；不得同时发行旧、新两套确定性身份或猜测重写 immutable provenance。
Mission 创建下游 Task 时只提交一个
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
`SCHEMA_DDL` 的对应数据完整性 trigger，形成新的唯一 current-schema 指纹。启动时只读
比较完整 schema/object 指纹和 current 数据完整性；任何旧 schema、payload epoch、trigger
差异或未知 drift 都在业务读取前以 `SCHEMA_RESET_REQUIRED` 失败关闭，并要求用户显式重建
Database。当前产品不执行 historical migration、payload conversion、trigger repair、兼容
reader 或双读写。禁止只升级 Zod reader 后让旧 payload 在任意 Board、Conversation 或
continuation 读取点才抛出普通错误，也禁止用 optional 字段、默认值或 row patch 猜测新权威。
`dispatch_lineage` 的整个 payload 由
`engine_dispatch_lineage_payload_insert` 约束为精确 JSON（JavaScript Object Notation，
JavaScript 对象表示法）shape：顶层 key、Tool occurrence、projected worker identity、Task work
scope、Delivery Slice revision、delivery owner、adapter input 与创建时间必须完整且无重复 key；
projected target、runtime template、Session kind 与 dispatch adapter 必须属于同一执行身份。整个
lineage row 不可更新；它的 breaking 变更必须同步改变该 trigger，形成显式 current-DDL 结构断点。
MySQL transfer 的 preflight 与 apply 都在 current `SCHEMA_DDL` 下恢复 snapshot，所以 malformed
lineage 在替换本地数据库之前失败关闭，不存在 transfer-only parser 或兼容 reader。

Dispatch recovery 每次最多接收 64 个去重的 exact
`(task_id, child_session_id, dispatch_id)` descriptor。lineage 查询按完整 triple 命中；后续
delivery disposition、settlement ingress 与 terminal lifecycle ingress 只消费实际命中的
descriptor，并通过 bounded `VALUES` request 与 correlated `EXISTS` 返回每个 request 至多一行。
不能把独立 Task ID 集合和 dispatch ID 集合做笛卡尔候选，也不能让重复 ingress fact 放大立即事务内
的读取量。lifecycle membership 还必须匹配 descriptor 的 exact child Session。

TaskArtifact 的 Engine envelope 与 exact resource identity 进入 SQLite，当前不可变
manifest 和资源字节则由 TaskArtifactStore 发布。资源完整性错误必须由 exact
Artifact/resource consumer 明确报告；project bootstrap 的 retention scan 只能记录
结构化 corruption evidence，不能把一个缺失或损坏的 snapshot 提升为整个 Project、
VCS、Task events 或 Session events 不可用。严格读取继续验证 manifest、路径、媒体
类型、字节数与 SHA-256，禁止 fallback、伪造字节或自动修复。无法证明安全的回收不
得创建第二条删除路径。

Artifact Catalog 对 TaskArtifact 的可发现性同样由持久权威决定。`catalog` snapshot
投影一个 immutable parent 和它的全部 resource entries；`engine_resource` snapshot
只是 Engine receipt 的物理资源依赖，不单独投影 parent。只有被当前搜索
Engine catalog revision/version scope 内至少一个 exact Engine Artifact envelope 引用的
`engine_resource` identity，才把它的 resource entries 投影为当前 Task 的
`task_artifact_resource`。准备期、失败清理前或其他未引用物理 snapshot 不进入 Catalog。
该引用集合与 Engine catalog revision upper bound、TaskArtifact publication sequence
共同冻结在 cursor membership 中；后续 Engine receipt 只能由 fresh search 观察，不能改变
既有分页结果。Agent 不得从 wrapper payload 手抄 resource locator，也不存在另一个资源发现路径。

Evolution Lab 的 typed Artifact publisher 在写入前验证直接语义前驱，而不是把先前的
`artifact_select` 当成隐式 publication provenance。`failure-attribution` 必须直接绑定且完整读取
唯一的 `opportunity` Engine Artifact，验证其 Evolution observer producer，并让 payload
`owner_evidence` 引用同一 exact locator；缺失、额外、错误类型、错误 producer 或 payload 不一致
都返回 typed integrity error，不能持久化为可供 Campaign 消费的成功 Artifact。
当 completed source Task 同时把已关联的 opportunity 与 failure-attribution 导入下游 Task 时，
import writer 保留两者的 immutable source locator 与 source provenance，但不伪造新的 direct source。
Campaign publisher 只在两份 import lineage 属于同一 source Task、opportunity 的 source locator 同时匹配
attribution 的唯一 source provenance 与 payload owner evidence 时，把两份当前 Task locator 认定为同一
canonical predecessor pair；Campaign 自身仍只持久化当前 Task locator。错配 pair 返回同一 typed
integrity error，不允许模型引用 source-Task locator、改写 imported payload 或重发 attribution。

Metrics 域沿用 `engine_*` 表名承载评分流水，但写入边界归属 metrics store：
`engine_metric_spec`、`engine_metric_result` 和 `engine_iteration` 的唯一直接表写入文件
是 `metrics/store.ts`。任务、agent、engine 或 UI 层不得直接写这些 metrics 表。

## session 域（9 表）

`src/session/session.sql.ts`：

| 表                       | 作用                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `session`                | 会话树节点；关键列：`kind`、`parent_id`、`directory`、`permission`、`metadata`；不拥有 Goal lifecycle                                  |
| `message`                | 持久化 user / assistant 消息                                                                                                           |
| `part`                   | 消息分片（tool call / text / reasoning / …）                                                                                           |
| `interactive_artifact`   | Session 内可交互 artifact                                                                                                              |
| `session_control_record` | durable compaction / summarize 等控制请求；记录请求事实，不证明当前 Runtime 存活                                                       |
| `session_prompt_owner`   | Session 唯一物理 prompt loop 的 generation 与精确 OS process occurrence；仅在该 occurrence 已死或 PID 已复用后允许原子接管             |
| `worker_turn_descriptor` | Projected worker 的不可变 Turn identity、模型、tool projection、Task、dispatch lineage、精确 package revision 与哈希；restart 恢复真源 |
| `todo`                   | session 内 todo                                                                                                                        |
| `permission`             | 权限请求（project 级全量规则集）                                                                                                       |

**SessionKind** 固定在 creation time。唯一枚举来源是
`session.sql.ts` 的 `SESSION_KINDS`; 文档不复制成员列表。Projected worker 的
运行身份来自持久化 worker descriptor，不来自 SessionKind。

Session/Trace 是持久化历史与身份容器；Turn/Attempt 是一次模型执行；Runtime
中的 stream、取消句柄、MCP（Model Context Protocol，模型上下文协议）连接、
tool instance、callback 与 Promise 仍只属于当前进程。`session_prompt_owner` 不复制
这些资源，只用 generation 加 PID、process-instance identity 与 occurrence identity
证明哪个物理进程可以产生 Provider/Tool effect。它在 standby 期间继续存在，并持续
观察 durable user Message、runtime wake 与 `session_control_record`；进程内事件只用于
降低唤醒延迟。reply peer 通过 accepted input Message identity 加入，summary peer 先按
本次 exact Session control ID 加入其 consumed/failed 终态；consumed terminal 必须与
该 control durable payload 中的 exact summary Message ID 绑定在同一个 immediate transaction。
新 compaction 直接使用 checkpoint publisher 返回的 Message ID，禁止按 source、时间或排序
重新查找；首次没有可压缩材料且没有已有 summary 时写入 typed failed terminal。已有 summary 且
没有 post-summary material 的幂等 no-op 显式绑定已有 summary；local callback 与 peer 只从
该 receipt 投影，不按 source 或 wall-clock 猜测。只有 OS 证明原 occurrence `dead_or_reused` 后才原子替换并
终态化废弃 assistant。服务重启只销毁 Runtime，不能使 Session、message、descriptor
或 durable coordination request 失效。

跨进程调度准入不能读取进程内 `SessionStatus` 作为共享 busy 权威。一个 Session 的当前
共享执行事实是同一数据库快照中 `session_prompt_owner` 的精确进程 occurrence 仍为
`exact_live` 或 `unknown_live`，且该 Session 存在 `time.completed` 为空的 assistant Message；
standby owner 没有 unfinished assistant，已证实 `dead_or_reused` 的 owner 也不阻止接管。
Recurring Session Automation 在创建 Fire 前，必须在同一个 immediate writer transaction
内重验该组合事实与 definition/due/lease frontier。busy 时只获取绑定原 due occurrence 的
短 `automation` admission-delay lease，不创建 Fire、attempt、run 或 receipt；lease 到期后
下一 poll 重新读取全部事实。manual API/Tool run 在同一事务看到该事实时返回 typed running
conflict，同样不得先创建 Fire。

空闲 Session 的一个 Turn 可以按顺序接受该 Turn 开始时完整的待投递 user Message
批次。新 assistant Message 持久化完整的 accepted input Message identity 集合，且
`parentID` 等于集合尾项；删除这些输入的 `pendingDelivery` 标记与插入 assistant
Message 必须属于同一个 SQLite transaction，并发生在 streaming status 发布与
Provider 请求之前。进程内 callback 与跨进程公开请求 replay 都按该持久化集合的成员关系
收敛到同一 assistant Message；peer 不得创建第二个本地 prompt loop。Session 尚未接受更新 user Turn 时，失败重试选择与
当前调用方 identity 相交的最新失败批次；一旦 Session 已接受更新 user Turn，旧失败
identity 的公开 replay 返回 typed conflict 并要求新 identity，不能用更新 transcript
重驱旧批次。该最终判定必须发生在真实 Session owner 准入之后：旧 replay 附着到更新
owner 时只拒绝旧 callback；旧 replay 因竞态先成为 owner 时也只拒绝自身 callback，并由
该 owner 继续处理已接受的更新 Turn。后续成功回复保持唯一权威；没有显式集合的历史
assistant Message 只接受其 `parentID`。该事务只消费投递标记，不得重写其余 authored
payload；已冻结的 Task-root causal fact 仍由数据库不可变约束拒绝修改。

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

公开 Session shell 以调用方创建的 user Message ID 作为执行 occurrence（执行轮次）身份，
同一身份永不重新执行命令。input user Message、assistant、running `bash` Tool request、当前 backend
process occurrence 与该 Tool 的 `session_shell` execution lease 必须在一个 SQLite writer transaction
内原子持久化。跨 backend 竞争的失败方只能读取这一完整执行图，不得观察到只有 input 的中间状态。
spawn 创建的是等待 start admission 的 gated child；只有 child 的精确 process occurrence 已写入可变
Tool progress fact 后才打开闸门并启动真实命令。该初始 progress writer 必须在同一 transaction 内
assert exact shell lease 且确认确实新增 running progress；outcome 已存在时返回的 no-op 不构成 start
admission。child occurrence 不得回写不可变 request metadata。owner 在命令存活期间续租该 Tool 的
精确 lease；正常、abort 和 caught failure 均等待物理进程收敛，再在一个 writer transaction 内 assert
exact lease、按 Tool terminal → assistant terminal 的顺序写入，并以同一 transaction 释放该 lease。
fence loss 的旧 owner 不得写 success/failure terminal，而是从 durable graph 收敛同一 interruption outcome。

replay 只读取该 occurrence：精确 child 仍存活，或同一 Tool 的精确未过期 lease 仍有效时，返回同一
in-flight assistant；backend PID（Process Identifier，进程标识符）存活本身不证明该 shell 仍被拥有。
child 已死亡/被复用且精确 lease 已释放、过期或丢失时，把同一 open Tool 写成 deterministic typed
`process-execution-interrupted` error 并收敛同一 assistant，绝不生成替代 Message 或重跑命令。
旧版本遗留的 completed assistant 加 open Tool 仍须 terminalize 该 Tool；completed assistant 已是不可变
事实，不得为修饰历史状态而重写。

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

活动 Work Ledger 在服务端按精确 Mission 根划分 Task 层级：只有能解析到同一
Project 中精确 Mission Session 的 Task 才进入该 Mission 的子列表；未归档且没有
这条根关系的 Task 是 Mission、Chat/Work 的普通顶层同级项，复用同一 Task 选择和
耐久操作契约。该划分发生在搜索、排序和游标分页之前，Overlay 不过滤或重建层级，
同一 Task 也不跨层重复投影。

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
| `automation` · `automation_definition_tombstone` · `automation_fire` · `automation_fire_attempt` · `automation_fire_attempt_receipt` · `automation_run` · `automation_run_receipt` · `automation_delay_settlement` · `event_job` · `event_job_definition_tombstone` · `event_occurrence` · `event_job_fire` · `event_job_fire_receipt` | `scheduler/*.sql.ts` | 定时、逻辑 Fire、物理尝试、目标执行、Session admission 与事件触发 |

Scheduler 表按事实 owner 分层写入：Automation service 拥有 definition revision、tombstone、Fire、attempt、run 与 receipt；Session assistant-admission transaction 可以追加唯一的 `automation_delay_settlement`，并在同一事务追加该 one-shot delay 的 superseded run receipt 与 definition tombstone。两者共用同一个 transaction-local fact reducer，后者不是第二个 Automation service。Assistant admission 通过 `(session_id, kind, status, definition_id, revision)` frontier index 只查询调用方给出的 Session 集合中的 latest active delay，并按同一有界 definition page 批量读取 lease、Fire、run/receipt 与 attempt summary；它不扫描其他 Project 或全局 Automation。Global poll 的 definition cursor 本身由 SQL index、`definition_id` cursor 和固定 limit 分页；每页以五个固定 set-query stage 读取 definitions、latest/boundary Fires、当前 fan-out runs 与 latest receipt/retry count、attempt summary 和 latest leases。只有选出的 due definition 才在 writer transaction 中逐项重验与 claim，完整 immutable Fire history只在显式 history API 中归约。Event service 在一个 immediate writer snapshot 内以 active Project 的 `definition_id` cursor 分页读取 current definition，为匹配 Fire 分配 definition-local immutable queue position，因此 definition/tombstone、one-shot terminal 与 Fire acceptance 只有一个串行顺序。terminal receipt 复制该受 DDL 约束的 queue relation并且只能连续推进 FIFO frontier；head 查询先从 partial terminal index seek 最新位置，再从 Fire index seek精确 successor。accept、startup recovery、claim、handoff 与 lease recovery 共用该 reducer，retained terminal history 不进入物理调度集合；lease timer 醒来时重读 definition frontier，所以 terminal commit 后的 owner crash 不会丢失 successor handoff。Event 与 Automation 的完整 immutable history 都只在显式 history API 中归约。Tool、server route 和 engine 层只能通过这些领域入口创建、更新或删除 scheduler definition。Task wait 不使用 Automation 表，而是 `engine_task_wait_registration` 加可选 `engine_task_wait_settlement` 的 epoch-bound Task-control 事实。

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

## Workspace 与受管 Git 子项

Workspace 数据库行不是 Git worktree 的创建或删除 receipt（收据）。当前事实源是
`workspace-lifecycle` durable publication occurrence：Database 实例、Project、Workspace 与
`creating` / `deleting` 共同确定 occurrence，immutable intent（不可变意图）在任何 Git mutation
之前冻结 Project generation、primary repository、managed directory、branch 与 branch target。
创建依次记录 Git registration、worktree readiness、Project sandbox ownership 和 Workspace-row
publication；只有四者完整时才提交 occurrence。删除依次记录 physical directory removal、Git
registration prune、exact branch retirement、sandbox settlement 和 Workspace-row retirement；只有
外部子项完整结算后才删除 aggregate row。重启与 API retry 都重放同一个 occurrence，不从目录是否
存在、最新 registry entry 或随机 worktree name 推导结果。

创建或删除在 journal 和任何 Git effect 之前，先在 `workspace_lifecycle_admission` 发布当前 frontier：
exact Project generation、Workspace identity、`creating` / `deleting`、`public` / `project_delete` authority
与 physical process occurrence。每个 frontier 通过 Database、Project 与 Workspace scope 直接定位自己的
durable journal，不枚举全局永久历史。Project deletion fence 和 Project identity convergence 都在自己的
SQLite immediate writer transaction 中检查这张表；Project 关闭阻止 `public` frontier，只接管同一
Project deletion fence 已发布的 delete frontier，Workspace row publication 也在同一事实源中重验 exact
owner。这样 create、public delete 与 Project delete/convergence 只能按数据库 writer 顺序线性化，而不是
依赖进程内锁或 Bus。启动恢复仅在物理 owner 被证明 `dead_or_reused` 后接管无 journal frontier；open
journal 继续同一 reducer。public terminal frontier 结算即删除，Project-delete terminal frontier 保留到
Project row cascade，使 Workspace row 已退休后的 Project retry 仍可直接找到其 frozen child receipt。

Project 删除在第一个 child effect 前冻结全部 Workspace rows 和其余 registered managed worktrees。
Workspace child 复用其 canonical deleting occurrence；没有 Workspace row 的 managed worktree 使用按
Database、Project generation 与 directory occurrence 确定的 Project-child journal。两类 journal 都
复用同一个 directory admission 和 Git writer lease，并在 Project deletion fence 下保留原 sandbox
snapshot，直到 final Project transaction 证明 Workspace set 为空、所有 child receipts terminal，才允许
删除 Project row。已经在 intent capture 前被证明不存在的 registered directory 仍保留在 registry
snapshot 中，但不会制造一个虚假的 physical cleanup target。

Project managed-child journal 把 device、inode 与 birth time 纳入 occurrence ID，并以显式 predecessor
连接同一 Project generation、registration/sandbox path 上的后继物理 occurrence。retry 只选择唯一 chain
head；每个 Project generation 与 frozen child path 使用自己的 publication scope，建立后继后退休已结算
的历史 predecessor，所以 lookup 与 retained history 都不随其他 Project 或永久历史增长。present namespace
必须匹配该 exact occurrence，只有 namespace 已消失时才能重放 head 的 frozen plan。因此 retry 不从已被
删除的 alias/registry 重新计算 child identity，同路径后继也不会被历史 terminal journal 吞掉。普通
garbage-collection（GC，垃圾回收）候选本来没有
Project sandbox owner；其 public removal plan 冻结“无匹配 sandbox 且不释放 sandbox authority”的事实，
仍须证明 exact Git registration、branch target、directory occurrence 和 ownerless marker，不能制造
sandbox ownership。Workspace/public delete 与 Project delete 仍必须持有并结算其 frozen exact sandbox。

`task.attachments` 只保存用户上传的中性输入。每条记录固定为
`intent="task_input"`、`source="user-upload"`；MIME（Multipurpose Internet Mail
Extensions，多用途互联网邮件扩展类型）、文件名和扩展名都不能推导领域语义。
`AttachmentStore` 只负责 canonical bytes 与 metadata sidecar，也不拥有领域语义。
每个物理 project attachment 目录还必须由 `.authority.json` 绑定到唯一
`project_id`、解析后的 worktree 和 Database 内部持久实例 ID。该实例 ID 在结构严格匹配的
current-schema 普通 reopen 中保持不变，在同一路径显式 reset、删除重建或 fresh rebuild 后变化；
不匹配的旧 schema 或未知 drift 只返回 `SCHEMA_RESET_REQUIRED`，不会猜测 refresh、重写该身份
或选择 migration。
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

Browser Node sidecar 的唯一脚本输入协议是 `argv[2]` 中的 base64 JSON payload 与
`argv[3]` 中的精确 Playwright module path；Frontend Design 静态渲染、runtime visual
render、acceptance walkthrough、Browser webpage extract/render/runtime-state 与 Browser
Preview evidence/region/layout/scroll render 均消费这两个参数，不读取平行环境变量、空值
fallback 或从用户项目解析运行依赖。
`capture_frontend_visual_evidence` 仅对 sidecar transport/toolchain 失败返回稳定 error code、
signature 与 `retry_once_after_concrete_correction` disposition。Frontend Design Agent 仅能在
一次具体修正后重试；相同 signature 再现时保留当前 facts、记录 blocker 并自然结束 Turn，
由既有 partial Artifact / `domain_incomplete` settlement 收敛，不能在用户项目安装 renderer
依赖或继续探查 Host 私有二进制。页面 request/page/runtime validation 失败使用独立
`frontend_visual_evidence_page_validation_failed` 契约，要求修复页面后重试，不得误分类为
基础设施阻塞。

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

- [17-code-work-agent-platform.md](17-code-work-agent-platform.md) — 动态 Agent 投影、runtime template 与 typed adapter 的职责边界
- [03-control.md](03-control.md) — Trace/Bus 如何流向 overlay
