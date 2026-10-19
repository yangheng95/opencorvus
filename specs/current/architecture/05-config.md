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

experimental: auto_question · disable_paste_summary
             memory{} · mcp_timeout · primary_tools · openTelemetry
```

> 文档此前未列出的顶级 key：`$schema` / `logLevel` / `server` / `share` / `autoupdate` / `snapshot` / `watcher`（含 `watcher.ignore`） / `disabled_providers` / `enabled_providers` / `tool_permissions`（任务级权限默认值） / `small_model` / `default_agent` / `preview` / `terminal` —— 全部以 `config.ts` 现状为准。
>
> **Locale contract**：顶级 `locale: "en-US" | "zh-CN"` 是 operator-selected system language，用于 assistant replies 和 Prompt 语言策略。**这是行为类设置**（影响 LLM 回复语言 + SDK 透传），属 Layer 1，**不**属 Overlay UI 偏好的 `locale`（后者由当前 host 的 Overlay Settings 文档持久化，仅控制前端 UI 文案）。
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

Overlay 的配置投影按当前实际目录选择读取范围：项目读取 `/config?directory=…` 与项目 channel，
无项目工作区读取既有 `/global/config`，并清空项目 channel 投影。启动、New Chat、关闭/丢失项目及
重连通过同一配置 reader 刷新；Config 与 Provider reader 均绑定 API authority、目录和选择/目录轮次。
恢复后的延迟能力加载在当前归属内发起，子读取与最终投影沿该归属结算，不能把恢复前的项目错误发布到首页。
离开项目后的全局配置刷新独立于导航完成；读取不能延迟新会话提交意图的发布。
项目、全局和 Session 配置 PATCH 使用既有 server-owned request settlement：传输默认读取期限不能
提前宣称一个仍在 canonical commit/runtime settlement 中的写入失败；当前 owner 才接收其最终投影。
普通配置 GET 和代理诊断仍保留各自读取期限。此边界不改变配置写事务、权限策略或任务执行轮次。

- **单一协议**：`OverlayPersistedSettings` 是唯一持久化文档结构。必填字段、可选字段、枚举、数值范围与非空约束由 `@opencorvus-ai/transport-protocol` 定义；部分文档和未知字段都是无效输入。
- **Browser host**：在 localStorage 的唯一键 `oc_settings` 中存放完整文档。
- **Tauri host**：在应用配置目录的 `overlay.jsonc` 中存放同一文档，写入使用同目录临时文件原子替换。
- **加载边界**：Browser 直接使用 TypeScript 严格 parser；Tauri 先用 Rust 的同构严格 schema 拒绝未知或无效字段，返回 Overlay 后再经过 TypeScript parser。文档不存在时，由 TypeScript `DEFAULT_SETTINGS` 唯一提供默认值。
- **地址读取与使用**：完整偏好文档的结构读取和 server base 的运行资格分开。历史文档中的非空非法地址仍原样可读并完成 settings hydration，供 Network 修正；不会悄悄覆盖为默认服务器。保存与 API/资源目标构造共享唯一运行态 URL parser，先解析 base 再拼接相对路径，保留其 authority、HTTP(S) 路径前缀、IPv6 与编码路径。query、fragment（含空分隔符）和嵌入 user-info 都被明确拒绝；认证仍由独立 username/password 字段拥有。离线但合法的地址允许保存，不以健康探测作为准入条件。ServerBaseUrlError 的五个原因是 malformed、unsupported_protocol、query、fragment、user_info；不携带原始 URL 或包含它的 cause。原生 String IPC 使用同名原因与安全消息。保存值及历史 projectComposerIntents 的 server 身份不被运行态 URL 序列化重写。
- **保存事务**：所有客户端偏好写入复用唯一串行 `saveSettings` 队列，轮到当前动作时才获取完整文档快照。原生持久化确认后先更新 `confirmedPersistedSettings`，再执行调用者显式提供的同步 `onConfirmed`，最后释放下一次写入；不会默认应用所有 overrides。视图关闭不能取消已持久事实的发布。持久化失败保留既有 `onFailure` 契约；确认回调失败返回带 `persisted=true` 和原始 cause 的 `SettingsActivationError`，表示已保存但客户端激活失败，不回滚或伪称保存失败，错误对象不携带完整偏好文档。后续合法写入仍按原队列继续，此边界不涉及 Task/Mission/Session 执行轮次。
- **边界**：不同步到 server Config，也不是 LLM prompt 或 agent capability 的配置源。它只拥有当前客户端的连接、呈现、工作区恢复和桌面集成。
- **界面语言**：Appearance、命令面板、标题栏及 native-menu 使用同一个 `applyLocalePreference`。原异步语言资源 tail 与 generation 保留，成功由唯一 `saveSettings` 完整文档确认；host 保存失败使用该队列回执提供的当前 confirmed locale 恢复呈现与偏好，原错误可见并释放原 tail。连接与 Project 选择不会成为客户端语言保存的前提，也不触发项目行为 locale 写入。
- **连接准入与文件预留**：Connection Save 在同一队列头完成 prepare；它可提供文档 overrides、原资源/请求归属复核、同步 confirmed commit 和必释放的 reservation。手动保存不同 endpoint 字符串属于明确工作区离开意图，复用现 workspace admission/selectEpoch 与 file navigation owner；旧文件的 Save/Discard/Cancel 决定在写入偏好前取得，批准的文件与草稿 revision 在写入期间保持预留。确认后同步关闭该文件、推进既有工作区/目录轮次、清空 saved directory 与 work-item 指针、退役旧投影，再通过唯一 API configure 发布新连接；失败只释放准备，保留原编辑器和真实已成功文件写入。相同 endpoint 的凭据更新保留工作区；原生管理器确认同 owned-root 进程轮换也保留工作区，复用 API authority 更新并显式标 connecting 等待既有 monitor 重新绑定。endpoint 字符串是操作员导航策略，不是数据库身份推断。
- **请求归属**：现 API-state 的 URL/认证 owner 只增加一个 reactive revision，URL/凭据实际变化或明确确认的 native same-URL rotation 推进一次；directory 保留其原 epoch。每个逻辑读取、写入、批次和复合请求捕获一次 ApiAuthority 并贯穿所有 await。ApiAuthorityChangedError 是本地退休结果，保留原响应、真实 transport failure 或原 stream-close fact；不制造 HTTP status/request ID，不重放旧 mutation 到新连接。新健康探测的 synchronous onHealthy 回执提供该探测的精确 token，初始化不借用 await 后另一动作的 token。原请求正常与 finally/retry 路径只能修改它仍拥有的投影。
- **拒绝与修正**：结构或地址保存校验都进入既有 saved/failed outcome，使用同一 confirmed snapshot 调用 onFailure 并释放队列；不能跳过调用者的 provisional-state reconciliation。已有非法活动地址在使用时返回明确本地错误，修正后沿原保存事务恢复。username 必须为 string，但显式空字符串可加载、确认和保存，不被冷加载替换为默认用户名；空 password 仍按原契约生成未认证请求。

**字段**：

- 连接：`serverUrl` · `autoServer` · `password`
- 身份：`username`
- 开发入口：`projectEditor` · `preferredProjectEditor` · `initGit`

`initGit` 默认关闭，只控制手动打开非 Git 目录时是否询问初始化；用户确认后才执行。
客户端启动始终只读取目录现状，不自动初始化仓库。该选项在 General 的 Git 区域可见。
- 工作区恢复：`directory` · `workspaceTaskID` · `workspaceDirectory`
- 输入框偏好：`projectComposerIntents` 保存每个 server URL / canonical project directory 的最后一次显式 Code/Work 与 Chat/Mission 选择；历史会话浏览不写入此偏好。权限模式仍只由 Layer 1 的项目 `permission_mode` 保存。
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

`network.proxy.username/password` 保存原始非空字符串，包括外围空格和字面百分号。
Network 保存/测试草稿和 Config schema 不裁剪认证字段；仅代理地址保留外围空白正规化。
唯一 `authenticatedProxyUrl` 把原始身份分别编码一次后交给 URL userinfo，Bun fetch、
Node Undici 与 BrowserRuntime 按同一 URL 合同解码。配置文件不存储预编码的身份。
先前已裁剪并保存的字符无法恢复，需由用户重新输入。
Network保存将清空的认证字段显式投影为merge patch的null，移除当前配置文件的旧值；
独立连通测试仍使用省略空字段的完整草稿。删除项目覆盖保留既有全局继承语义，
不等于关闭上层配置的认证。代理URL为空仍走原整项删除合同。

```
opencorvus.jsonc ──→ 声明层 + 累积校验/合并 ──→ Config.get() ──→ 带 source revision 的缓存
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

## JSONC 语法错误诊断

`ConfigJsonError` 保留现有 `{path, message?}` 与具名 HTTP 500 合同。两个配置 parser 共享
`ConfigPaths.jsonErrorMessage`，按 parser 顺序仅输出错误码及 1 基行、列；列按 UTF-16 offset，
行边界识别 CRLF、CR 和 LF。读取仍先展开 env/file 引用，位置对应实际解析的展开文本；writer
仍解析并保存字面引用，位置对应候选原文本。诊断不提升配置全文、出错原行或指针行，
同一安全 message 供具名序列化、实际日志、CLI 和 Provider `config.read` 局部失败使用。
I/O 错误、schema 验证与成功读取配置保持各自原契约。

## 空对象与 overlay 删除标记

JSON Merge Patch（JavaScript Object Notation Merge Patch，JSON 合并补丁）的对象补丁先将缺席、scalar 或 array 目标初始化为对象，再递归应用成员；现有对象保留未触及的成员。明确 `{}` 因此可以建立空对象或替换非对象，但不表示清空已有对象。JSONC 文本 writer 与内存 merge primitive 使用同一 RFC 7396 合同，原注释、数组整体替换和候选校验继续保留。

Session overlay 的 nested null 是删除当前覆盖的标记。preview 先将该标记应用到当前 overlay，再向 base 投影；缺席覆盖的删除仍形成合法空对象，删除已有覆盖恢复 base。持久 configOverlay 使用归一化后的 nextOverlay，原无 null 完整性校验保持。直接 mergeOverlay 对传入 base 的删除仍遵循同一 merge patch 语义。

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
边界。`Config.global()` 与 `Config.getGlobal()` 发布前按 `Config.Info` 补齐默认值；canonical
global 文件缺失、空白或空对象时发布相同的完整默认配置。每个canonical文件层均只拥有其
显式声明的字段：以当前累计低层值与本层声明值进入唯一`Config.Info`校验/正规化，再按原声明
形状投影`Config.Source`参与原层级合并，不把schema补出的默认当作较高层覆盖。嵌套关系按
真实继承值校验；扩展数组仍在实际层合并处追加去重，源数组正规化保留本层原归属。
`Config.getProject()`及atomic writer的currentWritable返回真实声明源，global callback的effective
仍为完整Info；写候选与冷读遵循同一投影。null删除项目字段恢复全局继承，删除global字段
恢复schema默认；不会修改已持久化的Task选择或Session权限策略。上述接口共享同一个 generation
read/write owner；writer 从 candidate、canonical replace、cache reset、runtime projection 到事件确认均在
同一 write generation 内。写 generation 中自然产生的嵌套读取会被登记并在释放前排空；继承 context 但在
generation 结束后才运行的读取必须重新取得 owner；嵌套 mutation 以
`ConfigGenerationReentrantMutationError` 拒绝，不能逃逸或自锁。`Config.get()` 域内 reader 的进程内顺序是 generation →
Project state lifecycle → source-cache owner。writer 先进入 Skill durable catalog current owner，
取得 Skill catalog reference mutation 与 Conversation capability reference mutation，再在继承的
SkillManager durable owner 内进入 Config generation write，之后取得 canonical-file owner；
commit hook 内取得 state-lifecycle owner 完成 reset。catalog/reference owner 必须先于 generation write，
因为 capability preflight 在 Skill/Conversation reference read 内可以读取 Config；反向取得 owner 会形成环。
外层 reference read 是不同的 owner 域，不能把上述 Config.get reader 顺序当作全部操作的统一锁序。
canonical-file owner 与 reader 的 source-cache owner 也不是同一把锁。

Conversation capability 和 Skill catalog 的 reference mutation/read owner 覆盖 callback Promise 的成功或失败结算，
之后才释放当前 lease；继承同一 owner 与 read-to-write 拒绝规则保持原合同。Skill 外层 durable catalog current
owner 仍负责实际跨进程 publication/recovery，不能用内层 reference lease 替代该事实层。
原 DurablePublicationStore subject lease 的 callback scope 覆盖已接受的嵌套 callback，父 callback 释放前
排空它们；子 callback 保留自己的返回值和错误。只读 isCurrent 引用即时读取原 heldSubjects 与
activeSubjectLeases，已退出子 scope 可继承仍活跃的同 lease 祖先，全部退休后的晚到调用重新排队。
SkillManager 直接使用该引用，不维护另一份 owner 寿命、锁或状态表。
进程内 generation read/write fence 排除对应 Config 读写并发，state-lifecycle owner 又不跨进程，
因此不存在一条伪造的统一读写锁序契约。

进程内 convergence monitor 只轮询“已经成功加载且其 Project Instance 仍活跃”的 Project state；显式
reset 只失效 cache，不丢失仍活跃 reader 的观察资格，Instance 释放才移除资格。monitor 的 interval 使用
`unref()`，它可以在已有 backend 生命周期中推进收敛，但不能成为短命 CLI/worker 的进程 owner。只加载过
global config、尚无 Project state 的 backend 也会比较 global revision，并在 peer commit 后发布原有
`global.disposed`。global writer 可以为已注册 Project 使用 identity lease 做 runtime settlement，但只对
此前已加载且仍活跃的 Project rewarm Config state，不能让 inactive Project 泄漏新的 cache owner。

Global candidate validation captures the previously loaded Project owners before
its inspection reads. Each registered/active directory retains one existing
Project identity lease through both configuration snapshots and complete
model/profile/capability validation. Independent Projects
use the shared settled-work queue with the host's available parallelism; every
admitted operation settles before a candidate error can release the write
generation. Results and original errors retain directory enumeration order.
Only after the entire candidate succeeds may canonical persistence and the
existing runtime transitions proceed. The paired before/after snapshots capture
one actual physical Git worktree boundary and each load their own stable source
generation through the same snapshot reader. Public standalone snapshots keep
their independent boundary discovery. No Project is omitted and no cross-write
source cache or alternate identity authority is introduced.

Skill assignment validation consumes the candidate Project's effective Config.
The same Skill catalog loader accepts explicit Config data for current runtime,
global summaries and a candidate snapshot; the candidate uses the original
publication/reference owners and does not publish into runtime state. Its source
paths, URLs, implicit directories, builtins and duplicate-source rules therefore
match actual discovery. Assignment validation receives its catalog reader explicitly:
candidate reads use that snapshot, while runtime settings use current installed facts.
There is no separate removed-global-Skill inference or inventory/risk projection
performed solely to guess which names a candidate removed. A Project-owned or
implicit source remains valid, adding a source and assignment can commit together,
and removing the sole source returns the existing assignment error before persistence.

MCP's shared state accessor enters the same Config generation read callback
before creating or joining its initialization promise. Initialization reads both
project-owned and effective configuration and settles staged credentials before
publishing runtime status. A concurrent reader queued behind a Config writer
therefore cannot publish an initializer that the writer then waits for during
reconciliation. Writer-owned initialization reuses the existing generation token;
the callback keeps its original pending-read drain and failure semantics. Pure
state inspection keeps the original Instance state source and does not initialize
MCP. This adds neither a second state cache nor a new configuration owner.

Ordinary and inherited Instance capability preflights acquire their existing
Skill catalog/reference and Conversation reference owners before reserving the
Project lifecycle turn. A preflight waiting behind a Config writer therefore
keeps the current Project identity available to that writer. The same preflight
body, exact-entry checks, lease cleanup and successful initialization fact remain
authoritative. This boundary does not extend reference reads into the initializer
body or change refresh/teardown serving-drain semantics.

Config-consuming Instance preparation and refresh bodies acquire the same durable
catalog owner before their entry turn. Their original tracked lease covers admission,
execution and accepted child callbacks; lifecycle execution context opens only when
the body actually enters, so catalog recovery is not a recursive initializer.
Metadata-only first activation with no initializer retains its original independent
path. If a queued activation now needs a Git-shape refresh, it enters the same teardown.
Teardown drains old serving work before retaining new catalog authority, then rechecks
serving under its entry turn. An already-current catalog owner may finish the original
identity/active serving read while all teardown parks are still draining and no turn
is entered. Once cleanup starts, the park seals those reads. All Project deletion,
exact-entry, health, process and global shutdown admission checks remain authoritative;
ordinary provide keeps its teardown barrier.

The canonical global commit retains the enumerated Project identities through
candidate validation, persistence, cache resets and runtime reconciliation.
The Instance scope reserves existing entries before workers begin and retains
newly discovered entries before awaiting their identity. It uses the existing
non-serving leases, so idle convergence cannot retire an identity between those
stages. Callback serving leases, explicit refresh, canonical validation and the
normal bounded-cache policy after settlement keep their original authority.
Success and failure both release the retained resources; background and peer
work enter outside this scope. This retention carries no configuration values
or new persistent facts.

The existing DEBUG phase diagnostics also observe the two configuration PATCH
routes under their original HTTP request IDs, including Project inventory,
paired snapshots, candidate validation, persistence, resets and reconciliation.
Phase metadata carries identities, counts and timing rather than configuration
field values; observation retains each operation's original value and error.
The same observer distinguishes shared Project-directory admission, held work
and release, with identity and physical-registry subphases. Queue wait sums
across concurrent Projects are not elapsed request time. Project discovery
reads the Git top-level and absolute common directory concurrently through the
existing supervised Git adapter; the initial discovery and the admitted
revalidation still use the same identity implementation and durable ownership
boundaries.

peer backend 替换 Project/global 文件后，owner 加载稳定 generation，并统一结算 MCP（Model Context
Protocol，模型上下文协议）、Provider、native Agent 与 Channel projection；全部 projection 成功后才通过
该 backend 原有的 `config.changed` 事件刷新客户端。本地 writer 的 direct transition 也登记在同一个在途
状态机中，因此事件回调里的并发读取不会重复发布同一 target。projection 或事件失败保留 exact
before/after transition 供重试；较新的 canonical generation 只更新 queued latest target，前一 transition
成功后才构造 `previous.after → latest`。本地 direct settlement 完成后仅 rewarm 活跃 state；若 canonical
source 已由另一生产 writer 推进，则显式结算 `direct.after → current`，不以 reset 丢失最新 generation。

未取得active上下文的投影候选，必须先取得原预留runtime owner并复核exact pending，才能退休inactive peer状态。
原writer失败后保留的transition继续由原writerRetry事实驱动；同一peer monitor也调度identity-only writer的重试，
每次通过原pending settlement集合和runtime owner去重。连续投影失败保留同一目标，成功后按原advance规则结算。

Provider 与 native Agent 的默认读取先取得当前 `Config.get()` snapshot，再以 canonical config digest
选择各 Project 的内容寻址缓存；缓存 holder 仍由 Project Instance state 生命周期拥有。显式 config
snapshot 继续走原有 canonical cache。由此正确性不依赖 writer 进程能否向 peer 进程广播 reset，
同时 Project 释放会清理它拥有的默认 derived cache。

### 已提交回执的业务与诊断边界

Global/Project Config 的已提交协调错误通过唯一 committedMutationReceipt 返回完整配置快照及协调原因。
Overlay 用一个纯 typed receipt 解码器供三个 Config writer 消费与 Provider 保存判断复用；原 ApiError.body
及当前 owner 的配置快照保留原值，错误仍携带原请求身份。诊断视图只投影 name、committed、message、failures，
不把整份 config 或可携带快照的附加 stack 放入详情、console 或 AppLog。普通错误保留自己的原合同；
HTTP 409 状态本身不是已提交证明。此边界不承诺识别任意上游 free text 中的秘密。

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
