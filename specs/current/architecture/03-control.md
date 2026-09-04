# 03 — 控制面与消息路由

> 对应代码：`src/channel/` · `src/control/` · `src/panel/capability.ts` ·
> `src/bus/` · `src/trace/` · `src/workspace/` · `src/server/`

## 设计原则

1. **消息直达**。外部消息进入 channel 后不经过无关 LLM 二次推理，直接路由到目标 task session（若该 session 有 pending interaction，确定性回填）。
2. **对话层只产出白名单 action**。`ControlMessage` 是对话层 LLM 入口，但不给它自由 tool 集合；它的输出必须匹配 `PanelCapabilityRegistry` 中的 capability schema（`create_task` / `send_task_message` / `reply_interaction` / `cancel_task` / …）。系统执行 action 时走既有 `EngineService` / `Session` API。
3. **control ≠ workspace**。`control/` 保存外部控制账号，并用普通 Session message/tool part
   记录 Control Agent 的真实对话；`workspace/` 是多工作区代理层。不存在独立 control timeline。

## 入站路径总览

```
 外部渠道                                      本地用户
 (Slack, HTTP, 自建 bot)                       (overlay, CLI)
        │                                           │
        ▼                                           ▼
 ┌────────────────────────┐              ┌────────────────────────┐
 │ ChannelIngress.message │              │  ControlMessage.handle │
 │ channel/ingress.ts     │              │  control/message.ts    │
 │                        │              │                        │
 │ - ChannelId 校验       │              │  Primary control +     │
 │ - task_id 绑定查找     │              │  PanelCapability 白名单│
 │   (engine_channel_     │              │                        │
 │    binding)            │              │  调用一个或多个 panel  │
 │ - 有 pending 交互 →    │              │  tool action           │
 │   确定性 reply_        │              │    create_task         │
 │   interaction          │              │    send_task_message   │
 │ - 否则 → Control       │              │    reply_interaction   │
 │   Message.handle       │              │    cancel_task …       │
 │                        │              │                        │
 └───────────┬────────────┘              └───────────┬────────────┘
             │                                       │
             └───────────────┬───────────────────────┘
                             ▼
                  EngineService (task-api/index.ts)
                  createTask / handleTaskMessage / replyInteraction /
                  cancelTask / retryTask / …
```

### 两个入站入口的分工

| 入口                       | 场景                                                         | 是否过 LLM                                                         |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| **ChannelIngress.message** | 外部 bot / HTTP webhook；消息已有明确语义（reply / 新 task） | 否（确定性路由）；若无 pending interaction 则委托给 ControlMessage |
| **ControlMessage.handle**  | 用户自然语言对话（panel / slack / local）                    | 是（一次 LLM 推理 → 若干 capability action）                       |

两者最终都调 `EngineService.createTask` 或 `Session` / `Question` 等既有 API。

Workspace create/delete API 只触发 durable lifecycle reducer，不直接把 Git mutation 当作完成结果。
调用者提供的 Workspace ID 是 aggregate identity；Host 在 mutation 前冻结 named worktree plan 或 exact
removal plan，之后每次 retry 都校验相同 Project generation、directory occurrence、registration、branch
target 与 sandbox authority。identity drift 返回 typed conflict，未完整的外部阶段返回 typed pending；
不存在 catch-only rollback、随机重建或 registry-prune 后丢弃 branch authority 的成功路径。

Workspace create 在 journal/Git 之前写入 transaction-local lifecycle admission，并一直持有到 lifecycle
terminal。Project deletion 关闭 registry admission 的同一 immediate transaction 必须证明该 Project 没有
Workspace create admission；Project identity convergence 也必须保留其 exact Project occurrence。恢复只在
旧 physical process occurrence 确认死亡或复用后接管，未知或仍存活的 owner 返回 typed conflict。

Worktree remove 在进入 Git writer lease 前只把 live/unknown overlapping registration 当作 owned；死亡
registration 会继续进入 canonical directory-admission acquire，由该 immediate transaction 原子删除旧
generation 并取得 reclamation generation。该 preflight 只避免 live registration 与 Git lease 互等，不是
第二个 mutation authority。

Project deletion 的 runtime-settlement 先让 Task/Session 与 Build-observation owner 收敛，再在仍持有
Project admission 和 deletion fence 时结算全部 Workspace/managed-worktree children。Project cascade
transaction 必须再次校验 exact fenced registry snapshot、零 Workspace rows 和 canonical child terminal
receipts。Project-specific child reducer不会另造 filesystem bypass；它只把 sandbox-row removal延后到
同一个 aggregate transaction。

`cancelTask` 在显式停止窗口内持有 root-Session destructive scope，遍历真实
Session tree，并只取消当前进程实际持有的 `SessionPromptState` controller。
controller 不存在时必须返回物理 ownership mismatch 并保留记录，不能用
Session status、Goal activity/acceptance projection 或其他持久化投影伪造取消成功。root wake queue
settle 后才允许写入 Task cancellation；该 scope 只保护不可逆操作边界，不是
持久化 workflow state。

Cancellation provenance follows the real caller boundary. A Mission-issued
`panel.cancel_task` or Mission-issued `session.delete` records the canonical
`metadata.mission.id` together with the caller Session, assistant message,
tool call, and ToolPart identity. Control and right-sidebar callers cannot
invent a Mission ID. The protocol event and `TaskCancellationProjection` are
the single durable source consumed by Debug Info; Task metadata does not mirror
that provenance.

The same initiating identity also flows into physical Session cancellation as
one strict `ExecutionCancellationOrigin`. A Task cancellation reuses the
canonical cancellation-request occurrence and references its protocol event;
it does not mint a parallel Task-lifecycle authority. Direct Hypertext Transfer
Protocol requests, Control stream disconnects, Mission operations, scheduler
timeouts, and process shutdown each supply their own existing request or
occurrence identity. The exact `ExecutionCancellationError` object aborts the
prompt owner and activity monitor, and its origin is preserved in the assistant
error and durable `session.error` event. Downstream layers never reconstruct a
caller from the reason string.

Graceful shutdown distinguishes physical Prompt ownership from Task execution.
The handoff transaction reads the canonical lifecycle and writes new recovery
evidence/ingress only for active Task occurrences. Cancelling and terminal Tasks
retain their existing cancellation or conversation-input authority. All physically
owned Prompts, including terminal cleanup tails and non-Task Sessions, still receive
cancellation and are awaited before runtime ownership is released. One terminal
Task therefore does not reject an active sibling's durable shutdown handoff.

`retryTask` / `replanTask` 只接受 terminal Task，已有 workflow occurrence 仍作为不可变执行证据保留。
Lifecycle 校验、本次 intent wake 写入，以及同 epoch native Task wait 的 `superseded` settlement 位于
同一数据库事务；active/queued Task 返回 typed lifecycle conflict。历史 `task_wait_activity` 只作为已落盘
旧 ingress 的可读来源存在，不再有当前 writer。用户消息、coordination request、
infrastructure recovery 和既有 operator intent 是已接受的 durable input，retry/replan 不得删除它们。
事务提交后 queue 只消费已经持久化的 intent，不再写第二个 wake。
普通 operator/orchestrator message 与 coordination request 只产生可见 ingress 和 delivery fact，
绝不清除 terminal row。terminal Task 上的普通消息通过 root Session 的 conversation-only Turn
回答；它不占用 directory execution queue，也不能 dispatch product work。terminal-to-running authority
只有两种显式来源：operator control API 写入的 `actor="operator", kind="retry|replan"` intent，以及
同一 Mission lineage 基于完整 Artifact read 写入的 `mission_acceptance_resume`。后者必须携带当前
terminal lifecycle reference、当前 Mission Turn 已完整读取的 exact locators，以及真实可见的
Mission-authored Task-root message；消息、Task reopen、queued ingress 和 receipt 在同一事务提交。
它只接受 completed/failed source，cancelled source 返回带 cancellation actor/source/event 的 operator
authority response。Host 只校验 identity、provenance、byte coverage 和 occurrence 一致性，不从文本、
Artifact type、verdict、消息年龄、idle 状态或 worker 数量选择修复路线。

Retry/Replan 事务会原子 retire 旧 delivery notice，并把仍未消费的 operator-message ID 按原队列
顺序写入新 intent 的 `superseded_operator_message_ids`。消息本体仍只存在于原可见 message；
Orchestrator 只能通过 intent 暴露的精确 ID 调用 `read_task_message`，不能获得整个 root Session 的
隐式读取权限。terminal conversation 的 durable answer/result 绑定 exact ingress ID；替换进程先
收敛已有 result 再 drain notice，不能重复调用模型。
Retry/Replan wake 中需要重新执行既有节点时，Orchestrator 通过
`dispatch_agent.dispatch.turn.authority.continuation_dispatch_id` 指定精确旧 dispatch。Host 从该 lineage
派生固定 worker identity、work scope、workflow binding/node、logical occurrence 和 Delivery
Slice subjects；新 Session/Turn 是同一 occurrence 的物理续跑，不是新 Task 或第二个节点 occurrence。

`Database.Path()` 同时是物理 Server runtime 的唯一 ownership scope。每个 `Server.listen`
在初始化全局服务、绑定 listener 或恢复 started Task 前取得该数据库的进程级租约；同一进程的多个
listener 共享同一 Question、Permission、Bus、Instance 和数据库 runtime，因此只增加引用计数，
不同进程则得到带 database/PID 证据的 typed ownership conflict。现有 restart handoff 在父进程
停止 listener 接入但保留租约、清算全部本进程执行、释放最后一个租约并确认 socket 可重新绑定后，
才创建 replacement 取得同一租约并绑定；并行开发必须
使用显式隔离的 `OPENCORVUS_HOME`，不能让不同 binary/projection 共用生产数据库。数据库中的
Interaction row 是 durable 可见投影，不替代 Question/Permission 的进程内 waiter owner；唯一 runtime
ownership 保证 reply 命中创建该 pending occurrence 的同一物理 owner。

## 对话层 — ControlMessage + Panel Capability

**代码**：`src/control/message.ts` · `src/panel/capability.ts`

旧 Gateway Agent / `channel_key` / `session_gateway_singleton_idx` / gateway SessionKind **全部删除**。对话层统一由 `ControlMessage` 承担。

> 注：当前代码没有旧 gateway 包；gateway 只作为 `server/routes/gateway.ts` 暴露的 control-plane surface 存在，并复用 `PanelCapabilityRegistry` / `ControlMessage`。

- 每次 `ControlMessage.handle()` 启动（或复用）一个真实 `assistant` Session；Task-scoped
  Control Session 挂在 Task root 下
- 精确加载 `PrimaryAssistantRegistry.get("control")`，并注入 `PanelCapabilityRegistry` 为白名单
- panel tool call 产生结构化 action/Host 事实；普通最终 assistant message 是 Control
  叙事文本的唯一来源
- 物理流结束不要求 `StructuredOutput` 或任何 terminal tool；返回值携带真实
  `message_id`、`control_session_id` 和完成的 panel tool-result refs，不复制 assistant
  文本。Channel Runtime 等需要文本的消费者通过这些 refs 读取真实 Session message
- 支持流式 `ControlMessage.handleStream`（SSE，overlay 实时消费）
- `surface` 区分入口：`panel` · `gateway` · `ChannelId` 枚举（Slack、Telegram、Discord 等，见 `channel/catalog.ts` / `packages/channel-config/src/index.ts`）

**Capability action 真源**：`packages/opencorvus/src/panel/capability.ts` 的 `PanelCapabilityRegistry`。本文档只说明控制流职责，不复制完整 action 清单或数量。

> `PanelLocalActionType`（前端 only，不属于 capability registry）当前是
> `select_task` / `select_session` / `invalidate_session`；其中 `invalidate_session`
> **只**是 local action 类型，没有对应的 mutation capability，请勿当作可向后端发送的 action。
> 历史版本提到的 `export_session_html` 现仍未注册。

## channel 子系统

**代码**：`src/channel/`

| 文件                           | 作用                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `ingress.ts`                   | `ChannelIngress.message()` 入口；绑定查找；`panel_response` 回复；委托 ControlMessage |
| `catalog.ts`                   | `ChannelId` / `ChannelSurface` 枚举                                                   |
| `registry.ts`                  | channel 注册表                                                                        |
| `supervisor.ts`                | channel runtime 子进程生命周期管理                                                    |
| `slack.ts` + `slack-config.ts` | Slack 适配                                                                            |
| `attachment.ts`                | 附件处理                                                                              |

`engine_channel_binding` 表在 `engine/engine.sql.ts` 定义，记录 `(platform, channel, thread) ↔ task_id` 绑定关系。

## workspace —— 多工作区代理

**代码**：`src/workspace/`

| 文件                                | 作用                            |
| ----------------------------------- | ------------------------------- |
| `workspace.ts` + `workspace.sql.ts` | `workspace` 表 + 多工作区元数据 |
| `config.ts`                         | workspace 配置读写              |

**已删除的旧 control-plane 结构**（旧文档残留）：

- ~~`control-plane/workspace-server/`~~
- ~~`control-plane/session-proxy-middleware.ts`~~
- ~~`control-plane/adaptors/`~~
- ~~`control-plane/config.ts`~~
- `control-plane/sse.ts` → `util/sse.ts`
- `control-plane/workspace.ts` → `workspace/workspace.ts`

多工作区的代理 / SSE 透传不再需要单独一层 server，统一由 `src/server/` 承载路由。

## Project runtime residency

注册过的 Project 是持久历史，不等于常驻进程 Runtime。`project/instance.ts` 是 Plugin、
FileWatcher、Version Control System（VCS）、scheduler、
channel 等 project-scoped State 的唯一缓存与释放 owner。Server 在 project request owner
关闭后以 one-running/one-dirty 方式合并调度、并在 started-incomplete Task 启动恢复后调用同一
串行 cache convergence；请求响应不等待无关 Project 的清理。活跃 lease 保持完整权威；
无 lease 的 least-recently-used entry 通过 canonical `State.dispose` 收敛到
`OPENCORVUS_PROJECT_RUNTIME_CACHE_LIMIT`。单个 disposer 超过
`OPENCORVUS_PROJECT_RUNTIME_DISPOSAL_TIMEOUT_MS` 会保留真实 lease、异步完成并报告目录级失败，
而不会阻断后续 idle candidate。参数只限定 idle process resources，不删除或
改写 Project、Task、Session、Artifact 或 message 历史，也不按内存阈值重启进程。

## control —— 外部控制账号与真实 Session 消息

**代码**：`src/control/`

| 文件                | 作用                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `control.sql.ts`    | `control_account` 外部账号表                                         |
| `message-schema.ts` | 入站 schema 与真实 message/tool-result refs 的返回 projection        |
| `message.ts`        | `ControlMessage.handle` / `handleStream` — 普通流式 Session 对话入口 |

`ChannelIngressResult` 是 Control result 与确定性 interaction result 的显式 union；
只有真实 Control Agent 调用返回 `message_id`、`control_session_id` 和 tool-result refs。

## Bus — 全局事件总线

**代码**：`src/bus/`

- `bus-event.ts` — 类型安全事件定义
- `global.ts` — 全局实例
- `index.ts` — 公共导出

所有横切事件（Task 状态、Slice revision、Session/dispatch、Artifact/review、workspace
ready/failed、trace、config.changed）统一走 Bus。Goal 面板在这些真实事件上刷新并按读时
投影 current revision、独立 activity/evidence/review association 与 Completion Decision
acceptance；Control API 不提供 Goal status、attempt、retry 或 workspace lifecycle action。
SSE 消费者订阅 Bus → overlay 实时刷新。事件定义集中在 `engine/model.ts` 的 `Event.*`。

## Task Orchestrator 调度控制面

Task 对外只有 `running` 与 `inactive` 两种活动状态；`queued`、`completed`、`failed`、
`cancelled` 只作为底层物理生命周期和恢复诊断事实保留，不构成成功/失败业务状态。
Task 是否被接受由 Orchestrator 根据当前 Artifact、worker result、tool evidence 与
completion decision 判断，而不是从 inactivity reason 推断。任何可恢复的 product finding、
provider/tool interruption 或本地环境问题都必须留在同一 Task、同一固定 Squad 与绑定 lineage
内继续完成。`fail_task` 只表示有精确证据的不可抗力物理停止：Task 权限无法取得的外部授权、
被拒绝的破坏性批准、不同固定 Squad、不可约的 operator 产品决策，或 Task 无法修复也无法等待
的外部平台条件。

所有 terminal writer 在同一事务写入专用 `task.completed | task.failed | task.cancelled` protocol
event。当前 terminal authority 是 Task 有序 protocol lineage 中、最后一次 nonterminal
`task.updated` 之后的最新专用 terminal event，并必须与 Task row 的 status、`time_completed`、
error 和 interrupted reason 精确一致。`task_completion_decision` 仅是 completed Task 的可选补充
证据，不是 failed/interrupted/cancelled Task 的准入前提。terminal coordination 只能用与当前
ingress、request 和 terminal occurrence 全匹配的 `acknowledge_terminal` 完成可见响应；其他
scheduler/product Tool 保持 typed terminal conflict，并把可恢复工作指向同一 Task 的显式
operator Retry/Replan。

Task 内的 worker 调度只有一个入口：`dispatch_agent dispatch.target=<active projected agent ID>`。每次调用创建一个
不可变 `dispatch_lineage`，绑定调用方 tool part/call、精确 worker identity、work scope 与 child Session。
它不表达 admission、running 或 terminal 状态。typed adapter 不再创建 Build/Integrity 等内层 owner；
`base_role` 只选择运行模板和 adapter ABI，不决定取消策略。每条 lineage 还记录
`workflow_occurrence_id`；首次 dispatch 令它等于自身 `dispatch_id`，continuation
沿用原值与原 `child_session_id`。面板可以在同一 Session 下列出多个 Turn，同时仍只投影一个逻辑 node occurrence。

Agent coordination 只追加四类不可变事实：request、scheduler response、action plan 和 terminal
action outcome。request 没有可变 status，action 没有 progress row；当前 frontier 由单一 reducer
按 `(task_id, execution_epoch, target_session_id)` 从这些事实推导。response 精确 claim request 本身，
或上一条 failed outcome；同一 frontier 只能有一个 response，Task reopen 只通过既有
`execution_epoch` 使旧 epoch 的 pending request 失效，不再写第二套 cancellation authority。

worker 的 `redispatch` 请求也不直接执行 adapter。`respond_agent_coordination` 只追加可见的
response 与 action；Orchestrator 随后必须显式调用带 `coordination_action_id` 且不带 `workflow_subject` 的
`dispatch_agent`。action 冻结原 dispatch lineage、完整 workflow binding、node、logical occurrence
和 Slice subjects；Host 从该绑定派生 continuation，caller 不能另选 workflow 或制造第二 occurrence。
action 绑定到不可变 child Session，进程重启后仍从同一持久 action 继续。只有 completed 或 failed
terminal outcome；completed outcome 必须由 action-specific durable effect authority 证明，不能由 Tool
输出文本或 generic receipt 自证完成。

Targeted operator steer 的入口是
`POST /task/:taskID/session/:sessionID/operator-steer`。入口只校验持久化
Task/Session/project lineage 与 descriptor 数据完整性。caller 必须提供 `request_id`；服务先全局查找
该 identity 的 immutable request，再决定是否需要读取目标 Session，从而让丢失响应后的 replay 不依赖
当前可变 target 状态。新 request 从目标 Session 最新的 hash-verified `WorkerTurnDescriptor` 冻结
exact projected identity，并在同一个 immediate transaction 写入
`origin="operator_steer"` 的 durable coordination request 与 Task-root ingress。相同 identity 与相同
canonical input 返回原 receipt；相同 identity 与不同 input 返回稳定 typed conflict，不能产生第二次 wake。
旧进程中的 `SessionRuntimeContract` 是否存在、历史 `session.status` 是否 terminal，
都不是准入条件。

`respond_agent_coordination decision=redispatch` 只记录可见的 Agent-to-Agent
operation 与 `redispatch_worker` action。Orchestrator 随后通过绑定
`coordination_action_id` 的 `dispatch_agent`，在同一 Session 写入一条新的真实输入消息并启动下一
Turn。Runtime 闭包不是可持久化的续跑协议；历史 terminal execution 只是前一条输入消息的执行证据，
不能成为 Session 续跑准入条件。

## Trace — 追踪横切

见 [02-data.md #Trace](02-data.md) — 此处不重复。
简言之：`AgentTrace.record*` → JSONL + Bus 双写。

## server/ — HTTP 路由

**代码**：`src/server/`

- 承载 overlay / CLI / 外部 bot 的 HTTP API
- 关键路由（文件清单以 `src/server/routes/` 为唯一真源）：
  - `routes/channel.ts` — `ChannelIngress.message` HTTP 端点
  - `routes/panel.ts` — `ControlMessage.handle` / `handleStream`（含 panel SSE 流）
  - `routes/orchestrator.ts` — EngineService.createTask 等 task API（含 task-list change stream 与 task event stream 两条 SSE 主线；`describeRoute` 数量以源码为唯一真源）
  - `routes/session.ts` — session mutation
  - `routes/permission.ts` · `routes/project.ts` · `routes/config.ts` · `routes/question.ts` ·
    `routes/provider.ts` · `routes/mcp.ts` · `routes/file.ts` · `routes/skill.ts` ·
    `routes/browser-preview.ts` · `routes/terminal.ts` · `routes/pty.ts` ·
    `routes/gateway.ts` · `routes/global.ts` · `routes/app.ts` · `routes/attachment.ts` ·
    `routes/auth.ts` · `routes/coding.ts` · `routes/documentation.ts` · `routes/mission.ts` ·
    `routes/plugin.ts` · `routes/experimental.ts` · `routes/export.ts`
- **SSE 端点**：分散在 5 个 route 文件——`routes/orchestrator.ts`（task / task event 双流，主线）·
  `routes/panel.ts`（control stream）· `routes/global.ts` · `routes/app.ts` · `routes/coding.ts`。
  `src/server/event.ts` **不是** SSE 端点，只是一个 7 行的 BusEvent 类型声明文件（`server.connected` / `global.disposed`）。历史文档中"`routes/task-event.ts`"路径不存在；该角色已并入 `routes/orchestrator.ts`。

## 关键文件一览

```
channel/ingress.ts              入站确定性路由
control/message.ts              对话层 LLM + capability 路由
panel/capability.ts             对话层 action 白名单
task-api/index.ts               EngineService（task / session / interaction API）
session/session.sql.ts          session 表（已无 channel_key / gateway 索引）
workspace/workspace.ts          多工作区
control/control.sql.ts          外部控制账号
bus/bus-event.ts                事件总线
trace/index.ts                  JSONL + Bus 双写
server/event.ts                 BusEvent 类型声明（`server.connected` / `global.disposed`，**不是** SSE 端点）
server/routes/orchestrator.ts   task / task event SSE 主线（`streamSSE`）
server/routes/panel.ts          ControlMessage HTTP 入口 + control stream SSE
```

## 相关文档

- [task-control-plane.md](task-control-plane.md) — 进入 EngineService 之后的 Task Control Loop
- [04-extensions.md](04-extensions.md) — channel 类型与 ACP/MCP/plugin 的边界
