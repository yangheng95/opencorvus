# Work Capability Incident Diagnosis and Route Authority Hardening

## Recall

### 用户原始要求

用户提供真实 Work Settings 截图：项目作用域已显示为 `project`，但页面只呈现
`Work capabilities are unavailable` 与 `Reconnect to the project service, then try again.`。
本任务按缺陷报告处理：调查 Work capability assignment 无法读取的故障边界；只修复能由当前证据证明的结构缺陷，原事故精确异常若缺少当时日志则明确标记未知，不能只改错误文案、增加后备路径或把相关加固包装成已复现根因。

### 验收指标

1. 当前生产 `GET /work/capability` 在一个正常、隔离的真实项目上返回精确 Work harness、默认 `work-artifacts` Skill assignment 和项目 MCP（Model Context Protocol，模型上下文协议）资源清单。
2. Work capability 的读取不依赖与设置页无关的任务队列、调度器、会话恢复或其他完整运行时初始化；其项目上下文权限必须与真实读取依赖一致。
3. 连接状态变化、项目切换和并发请求不能把旧项目或旧失败投射到当前 Work 页面。
4. 非 UI（User Interface，用户界面）聚焦正向测试进入真实 Server route 与项目上下文 checker，断言明确的成功响应与 route authority。
5. 不新增、修改、运行任何 UI 自动化测试。最终验收使用隔离服务、真实页面交互、截图和人工视觉复核。
6. 只修改本任务拥有文件；保留当前工作树中 Expert Squad、runtime、SDK、Overlay clipboard、Scheduled 等并行改动。

### 硬约束

- 一个当前实现和一个事实来源；不增加 fallback、双读写、兼容 alias、host 路由旁路或仅遮蔽错误的 UI 补丁。
- 修复前完成可观察现象、直接触发点、控制/数据流根因、旧结构未根治原因，以及定义、调用点、公共契约、测试、文档、交付与风险分析。
- 若接口或 OpenAPI 契约变化，必须同步生成 SDK；若只修正现有 route 的上下文分类，则不得制造无语义变化的生成 diff。
- 非 UI 修复必须有聚焦正向测试。UI 只做真实页面和截图人工验收。
- 实现完成后委托未参与实现的独立 agent 只读审查；有效发现全部修复并复验。
- 本任务产生的修改必须形成范围清晰的提交；提交后检查完整 `upstream..HEAD`，安全时自动 push。

### 已读资料

- `AGENTS.md`
- `specs/current/architecture/08-agent-tool-adapter.md`
- `specs/current/architecture/17-code-work-agent-platform.md`
- `specs/records/2026-07/2026-07-24-settings-capability-scope-navigation.md`
- `specs/records/2026-07/2026-07-29-work-harness-chat-mission-infrastructure-convergence.md`
- `specs/records/2026-07/2026-07-30-settings-code-work-information-architecture.md`
- `specs/records/2026-08/2026-08-12-work-artifact-harness-p0-implementation.md`
- `packages/overlay/src/components/settings/ConversationCapabilityPanel.tsx`
- `packages/overlay/src/services/{conversation-capability,api}.ts`
- `packages/opencorvus/src/server/{server,project-route-context}.ts`
- `packages/opencorvus/src/server/routes/{app,conversation-capability}.ts`
- `packages/opencorvus/src/conversation/capability.ts`
- `packages/opencorvus/src/project/{instance,bootstrap}.ts`
- `packages/opencorvus/src/work/harness.ts`
- `packages/opencorvus/src/skill/{manager,builtin-payload}.ts`

### 全仓搜索结果与影响面

- UI 触发点只有 `ConversationCapabilityPanel`。它在项目目录与 experience 变化时调用 `loadConversationCapability()`，对过期 generation 已有丢弃逻辑；错误详情目前只保存在 signal，不直接呈现。
- Overlay service 通过唯一 `HostTransport` 请求 `work/capability?directory=...`；`appStore.connected` 为 false 时在请求前拒绝。
- Server 的 `ConversationCapabilityRoutes("work")` 调用唯一 `ConversationCapability.settings("work")`。该函数读取 Config、固定 Work harness、已安装 Skills 与 MCP 配置，并严格校验 Chat/Work assignments。
- Server project middleware 对 route 选择 `persisted | identity | runtime` 三种最小权限。目前 `/work/capability` 和 `/chat/capability` 未列入 identity 集合，因此默认进入完整 `InstanceBootstrap`。
- 完整 bootstrap 还初始化 Plugin、FileWatcher、Version Control System（VCS，版本控制系统）、Task Artifact recovery、Scheduler、Engine、消息 bridge、Task queue、Channel supervisor 等；这些都不是 capability settings 读取依赖，任一失败会阻断页面读取。
- Config、Provider、Skill mounts、MCP 与 conversation history 等只读/配置 route 已明确使用 identity context，证明 settings/control-plane route 与完整 runtime route 已有正式分界。
- 2026-08-12 Work Artifact 改动将内置默认 Skill 从 `office-artifacts` 一次性替换为 `work-artifacts`。默认运行根、当前仓库项目配置与已检索临时项目配置中未发现旧引用；当前证据不足以把该升级断点认定为截图根因。
- 用户截图创建于 2026-08-13 02:02:59。调查时没有活动 OpenCorvus 服务或对应 listener；默认运行根没有同一时刻日志。因此截图直接证明的是 Overlay 无法取得 Work capability，不能从通用错误卡反推 request-level server exception。
- 公共契约的响应 schema 与 route path 当前没有证据需要改变。初始最小修复候选是 route authority 分类与其正向生产 route 测试；若隔离复现反驳该候选，必须先更新本记录再实现其他改动。

### 独立 agent 反馈

无。实现后按仓库规则执行独立只读交付审查，并把反馈与处置补记于本文。

## 问题深度与根因边界分析

### 可观察现象

项目 badge 已有目录，但 Work capability sections 未渲染，页面进入统一 error state。截图不能证明网络断开，因为任何 service rejection 或 HTTP 非 2xx 都进入同一个卡片；调查时不存在可连接的项目服务，证明当前环境当时无法重现一个已连接的成功页面，但不能反推截图生成时的精确异常。

### 直接触发点

`loadConversationCapability(directory, "work")` 被拒绝后，`ConversationCapabilityPanel` 将 error signal 设为异常消息；渲染只根据 error 是否为空选择通用 unavailable state。

### 控制与数据流

```text
Work Settings
  -> loadConversationCapability(project, work)
  -> HostTransport GET /work/capability?directory=project
  -> server project middleware
  -> projectRouteContextKind defaults to runtime
  -> Instance.provide(..., init: InstanceBootstrap)
  -> full project bootstrap and validation
  -> ConversationCapability.settings(work)
  -> Work harness + Config + installed Skills + MCP settings
```

### 旧结构未根治原因

路由本身拥有正确的 Work/Chat 参数化实现，但 route authority 分类没有同步登记这组后加的 settings routes。默认 `runtime` 是最大权限路径，所以功能在完整 bootstrap 健康时看似正确，却让一个只读能力设置页继承所有 runtime 子系统的可用性。Overlay 的通用错误卡进一步把 transport failure 与这种后端耦合收敛成同一个“重连”状态。

### 当前证据结论

截图只证明 Overlay 未能取得 Work capability；由于缺少截图时刻的 request/server 日志，原事故的精确 transport 或 server 异常未知。调查时没有可连接项目服务，但该晚到状态不能反推截图时刻。`/chat/capability` 与 `/work/capability` 的 route authority 缺失是独立、已由代码证明的结构缺陷：它把 capability settings 错误绑定到完整 runtime bootstrap，因此本任务只把生产改动定义为 route authority hardening。修改前隔离生产 route 已返回 200，明确排除了“当前 Work handler 必然失败”这一结论；健康服务的成功响应和最小 authority 是加固验收，不是原事故回归证明。

### 风险与排除项

- Identity context 仍必须提供 Project/Instance identity、Config、Skill discovery 与 agent materialization 所需状态；聚焦 route 测试必须验证真实 200 payload，不能只断言分类字符串。
- PATCH capability 会原子写项目 config 并执行 reference validation；它也属于配置控制面候选，但在验证读路径前不擅自扩大范围。
- UI error 文案准确描述当前 transport state，暂不修改。只有确认仍需区分 typed server error 时才设计可见呈现。
- 不修改或运行 UI 自动化。不存在需要维护的相关 UI snapshot/baseline。
- 不主动关闭、重启或刷新用户应用。真实验收只启动隔离页面与独立服务。

## 实施与验证方案

1. 新增聚焦 Server route 正向测试：隔离项目请求 `GET /work/capability`，断言 200、`agent_id=work`、项目 scope、默认 `work-artifacts` assignment 与固定工具表面。
2. 为 `projectRouteContextKind` 增加 Chat/Work capability routes 的精确 authority 断言；根据真实依赖选择最小 identity context。
3. 若基线 route 测试因完整 bootstrap 的非能力子系统失败或停滞，则记录原始错误/阶段并将 route 分类修正为 identity；随后复跑同一测试证明真实路径恢复。
4. 评估 PATCH route 的真实依赖与原子配置事务；若同样只需 identity context，则同一单一分类表覆盖 GET/PATCH，不复制 handler 或引入旁路。
5. 运行聚焦 tests、OpenCorvus typecheck、route/docs freshness 与 `git diff --check`。生成器只在契约实际变化时运行写入模式。
6. 启动随机端口、隔离 runtime root 与隔离项目的真实服务和 Overlay 页面，进入 Work Settings，人工检查工具、Skill、MCP sections 与项目 badge，保存截图到 `specs/artifacts/` 并更新本记录。
7. 委托独立 agent 只读审查完整差异、测试与视觉证据；修复有效发现，复验并再次审查直到无未解决发现。

## 执行记录

- 2026-08-13：完成截图检查、仓库身份/脏工作树边界、UI/service/server/config/bootstrap 调用链搜索。开始时 `main` 与 `origin/main` 无提交差异；并行未提交改动不属于本任务。
- 2026-08-13：默认 runtime 配置、当前项目配置和已检索临时配置均未发现 `office-artifacts`，因此不把旧 Skill 引用迁移作为无证据修复。
- 2026-08-13：识别出 capability routes 默认进入完整 runtime context，而相邻 config/provider/MCP/settings reads 使用 identity context。
- 2026-08-13：基线隔离生产 route 返回 200，证明 Work handler、默认 `work-artifacts` assignment 与当前资源投影健康；测试最初只因错误假设默认 MCP 清单为空而失败，真实响应正确包含 `browser` 与 `computer`，测试修正为当前正式契约。
- 2026-08-13：`project-route-context.ts` 将 Chat/Work capability GET/PATCH 纳入 identity 配置控制面；新增 production route 正向测试覆盖 Work read、Skill assignment mutation 与后续 canonical reread。
- 2026-08-13：聚焦测试 `4 pass / 0 fail / 11 expect()`；`api:routes-check` 通过 6 条规则与 34 个 route 文件；`docs:check` 通过 338 operations / 25 groups；任务文件 `git diff --check` 通过。
- 2026-08-13：OpenCorvus package typecheck 首次运行 73 秒后被并行未提交的 `expert-squad-package-host.ts` 缺失导出阻断；该并行依赖收敛后，本任务原样重跑 typecheck 并在 58 秒内通过，没有修改或绕过那条并行代码。
- 2026-08-13：当前生产 Overlay bundle 构建成功（7107 modules，2 分 26 秒）。随后在随机端口 `51398`、隔离 runtime/database/project 的真实 `/ui/` 页面进入 Work Settings；人工滚动检查 Built-in Tools、默认勾选的 `work-artifacts` 与 MCP sections，页面 error log 为空。保存的首屏截图只证明 Online、`Project · project`、已连接的 Built-in Tools 顶部和错误卡消失；Skill/MCP 投影由生产 route 测试覆盖，不把未入镜区域作为截图证据。只关闭了 PID 19196 的本任务隔离服务，端口复查无 listener。

## 独立审查

- 第一轮只读审查提出 5 项发现：原事故根因表述越过证据边界、共享索引含并行 Scheduled 条目、typecheck 状态过时、截图声明超过画面范围、测试重复销毁 Instance。
- 处置：将交付明确收窄为 incident diagnosis + route authority hardening，并标记原事故精确异常未知；提交阶段只纳入 Work 索引 hunk；依赖收敛后重跑 typecheck 成功；收窄截图所证明范围；删除两处重复 `Instance.disposeAll()` 及无用 import。
- 修复后第二轮独立只读复审确认 5 项发现全部关闭，GET/PATCH identity authority、生产 route 正向契约、canonical reread 与任务范围差异均未发现新增回归；结论为“无未解决发现”。

## 最终证据

- [真实 connected Work Settings 首屏截图](../../artifacts/2026-08-13-work-capability-connected.png)：证明页面 Online、项目作用域、Built-in Tools 已开始渲染且 unavailable 错误卡消失；不用于证明未入镜的 Skill/MCP sections。
- `bun test test/project-route-context.test.ts test/server/conversation-capability-route.test.ts`：4 pass / 0 fail。
- `bun run api:routes-check`：本任务首次执行时通过；最终复查被同一并行 conversation-history route 尚未生成的 OpenAPI closure 阻断，本任务未写入该并行契约。
- `bun run docs:check`：本任务首次执行时通过；最终复查被并行新增 `/session/{sessionID}/conversation/history` 尚未生成的 API markdown 阻断，本任务未改写或冒领该并行 route closure。
- `bun run build:vite`（`packages/overlay`）：通过。
- OpenCorvus package `bun run typecheck`：通过。
