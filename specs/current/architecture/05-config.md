# 05 — Unified Config

> 对应代码：`src/config/config.ts` · `src/engine/config.ts` ·
> `packages/overlay/src/store/` · `src/panel/capability.ts`
> （注：旧 `src/panel/settings.ts` 和 `src/panel/api.ts` 均已删除；`src/panel/` 当前只剩
> `capability.ts` — 见 [03-control.md](03-control.md) 对话层 action 白名单）

## 统一设计 — 三层分离

每个关注点**有且仅有一个真值源**，不重复、不跨层同步。

### Layer 1: Config.Info — 项目配置（唯一权威源）

- **存储**：`opencorvus.jsonc`（文件层级合并：managed → global → project → local → env）
- **验证**：Zod schema（完整，无 `as any`）
- **接口**：`GET /config` · `PATCH /config`（JSON Merge Patch RFC 7396）· SSE `config.changed`

**字段分组**（来源：`src/config/config.ts` 的 ConfigSchema）：

```
顶层：      $schema · logLevel · server · share · autoupdate · snapshot · watcher
           disabled_providers · enabled_providers · tool_permissions
           provider · model · small_model · default_agent · agent · mcp ·
           formatter · permission · compaction · preview · terminal
           channel · command · skills · plugin · prompt · instructions ·
           username · locale · prompt_profile · runtime_templates · expert_squads

assistant: activity{} · max_executor_groups
           activity 只拥有流式模型、真实 Tool progress 与 Provider execution 的无活动阈值；
           max_executor_groups 是 task 未显式覆盖时的并行 agent 上限；
           未配置时唯一 EngineConfig 默认值为 5。

experimental: auto_question · disable_paste_summary · continue_loop_on_deny
             memory{} · mcp_timeout · primary_tools · openTelemetry
```

> 文档此前未列出的顶级 key：`$schema` / `logLevel` / `server` / `share` / `autoupdate` / `snapshot` / `watcher`（含 `watcher.ignore`） / `disabled_providers` / `enabled_providers` / `tool_permissions`（任务级权限默认值） / `small_model` / `default_agent` / `preview` / `terminal` —— 全部以 `config.ts` 现状为准。
>
> **Locale contract**：顶级 `locale: "en-US" | "zh-CN"` 是 operator-selected system language，用于 assistant replies 和 Overlay localization。**这是行为类设置**（影响 LLM 回复语言 + SDK 透传），属 Layer 1，**不**属 Overlay UI 偏好的 `locale`（后者由当前 host 的 Overlay Settings 文档持久化，仅控制前端 UI 文案）。
>
> **Computer runtime contract**：Computer Use 没有顶级 runtime 配置。OpenCorvus 随应用分发固定版本的
> `@trycua/cua-driver` 并在 Host 进程内控制当前桌面；用户不配置 VM、image、viewer、daemon、Python、`PATH`
> executable 或 cloud runtime。`default/mcp/browser` 与 `default/mcp/computer` 都默认不分配；配置声明只进入
> inventory，只有直接 Conversation 的显式 project-owned assignment 或 active Harness exact projection
> 决定可见执行面。Computer 的两种入口使用同一个 host authority 与八工具契约。
>
> **已删除 schema 字段**：以下旧 schema 字段已删除，不再存在：
>
> - `assistant.spec{}` / `assistant.goal{}` / `assistant.planner{}` / `assistant.evaluator{}` /
>   the deleted acceptance-review assistant config field / `assistant.adaptive{}` — planner / acceptance review 整体下线，
>   spec/goal/adaptive 字段已删除。
> - `assistant.debug{}` — host-side prompt injection and stream-marker abort toggles are not config surfaces.
> - `assistant.requirements{}` / `assistant.architect{}` / `assistant.frontend_design{}` /
>   `assistant.intent_analysis{}` / `assistant.build{}` — 未被 runner 消费的 role `max_steps`
>   配置已删除；agent 行为来自 active projection、runtime template 与 adapter contract。
> - `assistant.acceptance_visual{}` — 只连接到不可达 score/LKG 回滚链，已随该链删除；
>   当前视觉验证使用显式 task-scoped evidence/threshold contracts。
> - `experimental.unattended` / `experimental.auto_permission` —— 仅剩 `experimental.auto_question`。

**关键原则**：此层决定「系统做什么」，跨设备/session/客户端一致。
行为类设置（如 `experimental.auto_question`）属于此层，**不属于 UI 偏好**。
`experimental.auto_question=true` 只授权未回答问题在固定期限后形成
`expired(origin=deadline)` 事实；它不代表操作员拒绝，也不能投影为
`rejected(origin=operator)` 或强制性失败。
期限在 Question Request 创建时写为绝对 `timeExpires`，并随
EngineInteraction 持久化；进程恢复复用同一 Request 创建时间与期限，不能重新计时。
问题建立期间的基础设施失败形成 `abandoned(origin=infrastructure)` 物理清理事实，
不属于回答、操作员拒绝或期限失效中的任何一种业务结果。

### Layer 2: Overlay Preferences — 客户端 UI 偏好

- **单一协议**：`OverlayPersistedSettings` 是唯一持久化文档结构。必填字段、可选字段、枚举、数值范围与非空约束由 `@opencorvus-ai/transport-protocol` 定义；部分文档和未知字段都是无效输入。
- **Browser host**：在 localStorage 的唯一键 `oc_settings` 中存放完整文档。
- **Tauri host**：在应用配置目录的 `overlay.jsonc` 中存放同一文档，写入使用同目录临时文件原子替换。
- **加载边界**：Browser 直接使用 TypeScript 严格 parser；Tauri 先用 Rust 的同构严格 schema 拒绝未知或无效字段，返回 Overlay 后再经过 TypeScript parser。文档不存在时，由 TypeScript `DEFAULT_SETTINGS` 唯一提供默认值。
- **边界**：不同步到 server Config，也不是 LLM prompt 或 agent capability 的配置源。它只拥有当前客户端的连接、呈现、工作区恢复和桌面集成。

**字段**：

- 连接：`serverUrl` · `autoServer` · `password`
- 身份：`username`
- 开发入口：`projectEditor` · `preferredProjectEditor` · `initGit`
- 工作区恢复：`directory` · `workspaceTaskID` · `workspaceDirectory`
- 外观：`theme` · `zoom` · `locale` · `sidebarCollapsed`
- 布局：`sidebarWidth` · `rightDockWidth` · `workLedgerOrganization` · `workLedgerSort`
- 桌面集成：`desktopNotifications`

`directory` · `workspaceTaskID` · `workspaceDirectory` 是持久化文档中的可选工作区恢复指针，出现时必须为非空字符串。

### Layer 3: Session State — 运行态

- **存储**：Solid store（页面关闭即消失）
- 任务、连接和数据投影在重连时从 server API 恢复；Overlay Settings 则只从 Layer 2 的 host 持久化文档加载。

**仅运行时字段**（不进入 `OverlayPersistedSettings`）：

- `savedDirectory`
- `workspaceEpoch` · `directoryEpoch`
- `toolPermissions`（从 server Config 投影）

## Deleted Runtime Surfaces

| 项                                                                              | 代码路径                         | 状态                                           |
| ------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| `PanelSettings` namespace                                                       | ~~`panel/settings.ts`~~          | 已删除                                         |
| `panel/api.ts`                                                                  | ~~`panel/api.ts`~~               | 已删除（路由由 `server/routes/panel.ts` 承担） |
| `syncUnattendedConfig()`                                                        | `overlay/src/services/config.ts` | 已移除双向同步                                 |
| localStorage keys `oc_unattended` · `oc_auto_permission` · `oc_auto_question`   | overlay                          | 改读 server config                             |
| Overlay `updateConfig()` 全量替换                                               | overlay                          | 改为 partial diff                              |
| 死字段 `spec{}` · `max_replans` · `same_plan_retry_limit` · `stage_max_retries` | config schema                    | 已废弃                                         |

## 当前数据流

```
opencorvus.jsonc ──→ Config.get() ──→ Zod 验证 + 层级合并 ──→ 带 source revision 的缓存
                      │
                      ├─→ EngineConfig.get()     合并 DEFAULTS，返回完整 typed config
                      ├─→ GET  /config                  → Overlay appStore.config (reactive)
                      ├─→ PATCH /config {partial diff}  → mergeDeep → 原子替换 canonical file
                      └─→ 本 backend "config.changed"   → SSE → 该 backend 的 Overlay 实例刷新
```

**关键变化**：

1. Overlay 不再 `GET→clone→mutate→PATCH` 全量，只发变化字段
2. Config 变更后 SSE 推送，所有 Overlay 自动 `setAppStore("config", newConfig)`
3. `scaffoldProjectConfig` 直接导入 `EngineConfig.defaults`，不硬编码

## 跨进程 reader generation 与 runtime projection

Project 和 global JSONC 文件是唯一配置事实；不存在 revision sidecar、影子配置、第二事件协议或
路由专用 refresh。每个缓存 generation 记录它实际解析的全部 canonical 文件 UTF-8 文本的
SHA-256（Secure Hash Algorithm 256-bit，256 位安全散列算法）；缺失文件使用独立的缺失态 digest。
parser 必须消费生成该 digest 的同一份 snapshot；完成层级合并后重新读取完整 source revision 集合，
只有集合未变化时该 generation 才可发布，否则从头读取，禁止把两个物理 generation 拼成一个配置。
显式 writer 在 canonical-file owner 内一次性写入最终 `$schema` 与配置正文，读取路径不得再把已提交的
业务配置拆成第二个 schema generation。

`execution_capacity` 是 global JSONC 独有的物理资源策略，分别限定 Scheduler Message、Automation、
Event 和 Provider 的活跃 effect 数。Project source 在 commit 前按 canonical typed config error 拒绝该
字段，不能覆盖或影子化全局策略；这些数值不拥有 occurrence、FIFO、重试、租约或业务终态。

`Config.get()`、`Config.getGlobal()` 与本进程 Project/global writer 共享一个 generation
read/write owner；writer 从 candidate、canonical replace、cache reset、runtime projection 到事件确认均在
同一 write generation 内。写 generation 中自然产生的嵌套读取会被登记并在释放前排空；继承 context 但在
generation 结束后才运行的读取必须重新取得 owner；嵌套 mutation 以
`ConfigGenerationReentrantMutationError` 拒绝，不能逃逸或自锁。reader 的进程内顺序是 generation →
Project state lifecycle → source-cache owner。writer 的顺序是 generation → catalog/reference owners →
canonical-file owner，并在 commit hook 内取得 state-lifecycle owner 完成 reset；canonical-file owner 不与
reader 的 source-cache owner 混称为同一把锁。进程内 generation read/write fence 排除这两条路径并发，
state-lifecycle owner 又不跨进程，因此不存在一条伪造的统一锁序契约。

进程内 convergence monitor 只轮询“已经成功加载且其 Project Instance 仍活跃”的 Project state；显式
reset 只失效 cache，不丢失仍活跃 reader 的观察资格，Instance 释放才移除资格。monitor 的 interval 使用
`unref()`，它可以在已有 backend 生命周期中推进收敛，但不能成为短命 CLI/worker 的进程 owner。只加载过
global config、尚无 Project state 的 backend 也会比较 global revision，并在 peer commit 后发布原有
`global.disposed`。global writer 可以为已注册 Project 使用 identity lease 做 runtime settlement，但只对
此前已加载且仍活跃的 Project rewarm Config state，不能让 inactive Project 泄漏新的 cache owner。

peer backend 替换 Project/global 文件后，owner 加载稳定 generation，并统一结算 MCP（Model Context
Protocol，模型上下文协议）、Provider、native Agent 与 Channel projection；全部 projection 成功后才通过
该 backend 原有的 `config.changed` 事件刷新客户端。本地 writer 的 direct transition 也登记在同一个在途
状态机中，因此事件回调里的并发读取不会重复发布同一 target。projection 或事件失败保留 exact
before/after transition 供重试；较新的 canonical generation 只更新 queued latest target，前一 transition
成功后才构造 `previous.after → latest`。本地 direct settlement 完成后仅 rewarm 活跃 state；若 canonical
source 已由另一生产 writer 推进，则显式结算 `direct.after → current`，不以 reset 丢失最新 generation。

Provider 与 native Agent 的默认读取先取得当前 `Config.get()` snapshot，再以 canonical config digest
选择各 Project 的内容寻址缓存；缓存 holder 仍由 Project Instance state 生命周期拥有。显式 config
snapshot 继续走原有 canonical cache。由此正确性不依赖 writer 进程能否向 peer 进程广播 reset，
同时 Project 释放会清理它拥有的默认 derived cache。

## Plugin 依赖树 generation owner

项目、用户全局和显式 config directory 中的本地 Plugin 文件需要同目录
`node_modules`。`Config.get()` 仍异步投影配置；发现本地 Plugin 后，它总是为该目录调度
`installDependencies`，而 `Plugin` 在 import 前通过 `Config.waitForDependencies()` 等待这些安装结果。
单目录失败原样抛出，多目录失败聚合为 `AggregateError`。

每个依赖目录只有一个 generation owner：规范化绝对路径进入无固定安装时长上限的进程内写锁，
随后通过可重试的跨进程目录锁串行化完整 readiness read 与 install。owner 内的私有 reader 是
manifest、物理 tree 和 durable receipt 的唯一 readiness 判定；公开 `needsInstall` 也必须先加入同一
owner，不存在 lock 外 check-then-act gate。

`PackageInstallReceipt` 是每个精确目录 tree 与目标 selector 的唯一 durable completeness authority。
安装必须先打开 target occurrence，再写 target manifest 或调用 Bun 改写物理 tree；只有完整解析目标
package manifest 及所有声明依赖后才提交 receipt。begin 失败不会改变 canonical generation；begin 成功后
发生写入失败、Bun 失败或进程终止时，target occurrence 保持 rolled-back 或 unsettled，且 target selector
不倒退到可能拥有历史 committed receipt 的旧 revision。下一 owner 因此必须重装 partial tree，不能把旧
receipt 与新 bytes 拼成 Ready。

共享 registry package 不在 `cache/node_modules` 原地更新。每个 package 由其规范名摘要取得独立的
跨进程 publication owner；Bun 只写同文件系统 staging generation，完整解析 resolved manifest 与依赖闭包后，
整棵 generation 原子 rename 到由 package identity、resolved version 与唯一 generation identity 共同派生的
不可变 revision 路径。
final tree 再验证且 completeness receipt committed 后才把 module directory 返回给 Plugin/Provider reader。
dependency resolution 区分“候选目录不存在”与“首个候选存在但 manifest 损坏或 identity 错误”：只有前者
继续查找祖先 `node_modules`。`npm:` alias 仍按 dependency key 定位目录，但按其 target package identity
校验 manifest；递归队列保留每条声明的 key 与 spec。
新版本和同版本恢复都发布到相邻 generation，不改写、删除或覆盖任何已经返回的 revision；没有 receipt
或闭包重新验证失败的 generation 只会被旁路，不能成为 reader 结果。跨进程锁只负责避免重复工作，失锁的
owner 也只能发布自己的唯一 generation，不能破坏另一 owner 已返回的 bytes。旧 flat cache 不参与读取或 fallback。
staging intent 在创建目录或运行 Bun 前持久化，并记录精确 staging path 与操作系统进程 occurrence。
该 path 必须是 `staging/<generation UUID>` 的直接 child，且 UUID 与 final revision generation identity 完全相同；
恢复按规范化后的精确 generation path 分组，不能用祖先、后代或另一 final generation 的 intent 扩大删除范围。
恢复只回收已经终态或精确进程 occurrence 被证明死亡的 preparation；失锁但仍存活的 owner 不会被误删。

## 并发策略

不使用 ETag 或乐观锁。写入者在共享 canonical-file owner 内读取、合并并原子替换；读取者以 canonical
bytes 派生 revision 并只发布稳定 generation。两者共同覆盖同机多 backend 的真实并发，不以“单用户”
假设降低一致性要求。

## 相关文档

- [07-panel.md](07-panel.md) — Panel 配置 UI 如何映射到 Config.Info
- [02-data.md](02-data.md) — Config.changed Bus 事件与 SSE 通道
