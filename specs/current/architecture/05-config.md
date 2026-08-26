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
           activity 只拥有流式模型与 task queue 的真实无活动阈值；
           max_executor_groups 是 task 未显式覆盖时的并行 agent 上限；
           未配置时唯一 EngineConfig 默认值为 5。

experimental: auto_question · batch_tool · disable_paste_summary · continue_loop_on_deny
             memory{} · mcp_timeout · primary_tools · openTelemetry
```

> 文档此前未列出的顶级 key：`$schema` / `logLevel` / `server` / `share` / `autoupdate` / `snapshot` / `watcher`（含 `watcher.ignore`） / `disabled_providers` / `enabled_providers` / `tool_permissions`（任务级权限默认值） / `small_model` / `default_agent` / `preview` / `terminal` —— 全部以 `config.ts` 现状为准。
>
> **Locale contract**：顶级 `locale: "en-US" | "zh-CN"` 是 operator-selected system language，用于 assistant replies 和 Overlay localization。**这是行为类设置**（影响 LLM 回复语言 + SDK 透传），属 Layer 1，**不**属 Overlay UI 偏好的 `locale`（后者由当前 host 的 Overlay Settings 文档持久化，仅控制前端 UI 文案）。
>
> **Computer runtime contract**：Computer Use 没有顶级 runtime 配置。OpenCorvus 随应用分发固定版本的
> `@trycua/cua-driver` 并在 Host 进程内控制当前桌面；用户不配置 VM、image、viewer、daemon、Python、`PATH`
> executable 或 cloud runtime。`default/mcp/computer` 仍默认不分配，只有直接 Conversation assignment 或
> active Harness exact projection 决定可见执行面；二者使用同一个 host authority 与八工具契约。
>
> **已删除 schema 字段**：以下旧 schema 字段已删除，不再存在：
>
> - `assistant.spec{}` / `assistant.goal{}` / `assistant.planner{}` / `assistant.evaluator{}` /
>   the deleted acceptance-review assistant config field / `assistant.adaptive{}` — planner / acceptance review 整体下线（见 [01-agents.md](01-agents.md)），
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
opencorvus.jsonc ──→ Config.get() ──→ Zod 验证 + 层级合并 ──→ 缓存
                      │
                      ├─→ EngineConfig.get()     合并 DEFAULTS，返回完整 typed config
                      ├─→ GET  /config                  → Overlay appStore.config (reactive)
                      ├─→ PATCH /config {partial diff}  → mergeDeep → 写文件 → 重置缓存
                      └─→ Bus "config.changed"          → SSE → 所有 Overlay 实例刷新
```

**关键变化**：

1. Overlay 不再 `GET→clone→mutate→PATCH` 全量，只发变化字段
2. Config 变更后 SSE 推送，所有 Overlay 自动 `setAppStore("config", newConfig)`
3. `scaffoldProjectConfig` 直接导入 `EngineConfig.defaults`，不硬编码

## 并发策略

**不做 ETag / 乐观锁** — 单用户本地工具，并发竞态概率极低，避免过度工程化。

## 相关文档

- [07-panel.md](07-panel.md) — Panel 配置 UI 如何映射到 Config.Info
- [02-data.md](02-data.md) — Config.changed Bus 事件与 SSE 通道
