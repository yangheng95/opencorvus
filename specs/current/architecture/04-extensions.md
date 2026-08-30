# 04 — 扩展入口

> 对应代码：`src/expert-squad/` · `src/plugin/` · `src/mcp/` · `src/acp/`

## 四条扩展入口

系统对外提供四个**语义不同**的扩展点，常被混淆，必须区分：

| 入口             | 位置            | 扩展的是                                           | 典型对象                                 |
| ---------------- | --------------- | -------------------------------------------------- | ---------------------------------------- |
| **Expert Squad** | `expert-squad/` | 动态 Agent、Skill、tool、MCP 与 scheduler guidance | manifest v1 package                      |
| **Plugin**       | `plugin/`       | 进程内 hook / provider auth                        | `@opencorvus-ai/plugin` API 下的任意实现 |
| **MCP**          | `mcp/`          | Model Context Protocol client 与 package tool host | 任意实现 MCP 的工具服务                  |
| **ACP**          | `acp/`          | Agent Client Protocol（编辑器集成）                | Zed 等外部编辑器                         |

## 单一内部运行时

Task 不再选择 Executor。`engine_task`、Task/Run API、Overlay settings、OpenAPI 和 SDK
均没有 `executor` / `executor_ref` 字段，也没有 `set_executor`、`/executor` 或外部
coding process registry。Codex 与 Claude Code 仍可作为人类显式启动的 coding CLI，
Codex provider auth 与 `.claude` / `.codex` Skill discovery 也仍存在，但它们不是 Task 运行身份。

**调用链**：

```
Orchestrator 从当前 `dispatch_agent` schema 选择
`capability_projection.agents.<agentID>` 声明的动态 Agent ID → 已解析投影的
`base_role` 由 `RuntimeTemplateRegistry.get(baseRole)` 取得 runtime template →
template 的 `dispatchAdapterID` 由 `DispatchAdapterContractRegistry.get(...)`
取得 core-owned adapter contract → build adapter 进入 `build/agent.ts`
(`dispatch_agent.use_worktree` 是所有 Agent 一致的唯一公开选择：仅当并发
Agent 会双写重叠修改面或争夺同一所有权边界时传 `true`；只读 Agent、修改面
和所有权面已证明互不相交的并行 Agent 均传 `false`，保守避免无必要 worktree；
Build 将它映射到私有 `worktreeUsage`，
其他 adapter 由统一 dispatcher 在独立 managed worktree 的 Instance 中执行) →
   internal SessionLoop + AgentRunner → projected tools / Skill mounts /
   package MCP → Task/dispatch runtime evidence
```

Managed worktree 是 dispatch 的物理执行选择，由 Build/runtime 管理并绑定 dispatch
lineage；Delivery Slice 不记录、复用或回收 workspace。

## Plugin —— 进程内插件

**代码**：`src/plugin/index.ts`

- 通过 `@opencorvus-ai/plugin` SDK 加载第三方 Hook / auth plugin
- 内置 Provider Auth Plugin：OpenAI Codex、GitHub Copilot、GitLab、Poe、Cloudflare Workers、
  Cloudflare AI Gateway、Azure、DigitalOcean、Snowflake Cortex、xAI
- 运行时注入 `Plugin.state`，暴露 `Bus` / `Session` / `Config` / `Server` 给 plugin
- installed plugin 是显式信任的进程内可执行扩展，不是 sandbox，并遵循严格失败契约。安装、加载、config 与 service 注册失败会终止项目启动；其他 hook 失败会终止触发它的 LLM、命令、工具或事件操作，不会继续消费未修改或部分修改的结果

Plugin receives one runtime-neutral structured process capability, not a Bun shell object. Its command is always an
explicit executable plus argv; the public contract expresses environment as strings, I/O as asynchronous byte
sources/sinks, signals as strings, a caller-visible occurrence identity, abort/deadline settlement and one terminal
receipt. Plugin initialization and hooks receive a **host-owned** facade: the OpenCorvus host adapts it to
`ProcessSupervisor`, so those children participate in the live host-owner registry and Windows native process-tree
cleanup, but they do not acquire a Task lease or claim Task-cancellation settlement. Explicit Task command callers bind
the same contract through the separate Task-scoped adapter and lease. One occurrence-level control lease derives the
physical admission signal, caller abort and wall-clock deadline from the coordinator's shared `Atomics.waitAsync` clock;
the host adapter forwards that signal and does not create a second timer. The SDK releases this startup-only lease after
accepting the framed readiness receipt, so the admitted server is thereafter owned only by `close()`. Inactivity uses the
same clock. A no-op keepalive exists only while entries are outstanding; parallel process occurrences do not each create
a polling clock.

The native Overlay launcher binds its managed backend to the launcher's exact operating-system process occurrence before
spawn. It passes both the positive Process Identifier (PID) and the platform process-instance fingerprint; managed
`serve` admission requires the complete pair and never reconstructs or falls back to PID-only identity in the child.
The watchdog keeps serving only while that exact occurrence is observable. Exit, PID reuse, or loss of exact
observability converges once through the normal backend shutdown owner.

`@opencorvus-ai/util/process` is a publishable package and owns only the host-neutral contract and execution coordinator;
`@opencorvus-ai/util/process-node` is its explicit Node adapter for the JavaScript SDK and Channel runtime. Windows
`owned_tree` admission launches the repository's native supervisor helper, assigns the target to a Job at creation, and
does not settle until the helper publishes an exact occurrence marker with `active_processes: 0`; cleanup therefore does
not infer identity from a reusable Process Identifier (PID) or depend on the root remaining alive. Node obtains the owner
creation-time identity through an abortable asynchronous helper probe; the supervisor opens the owner and verifies that
same identity before target creation. Bare executables are resolved through an equally abortable asynchronous PATH probe.
POSIX `owned_tree`
uses a dedicated process group and likewise settles only after group disappearance. Core host and Task trees continue to
use `ProcessSupervisor`'s durable occurrence/helper identity fence. A detached Browser or system-terminal launcher states
that ownership explicitly and unrefs only after successful spawn. PTY, Execution Capsule and process-occurrence probes
remain below this facade as platform adapters; they are not an alternate public command capability.

`public-package-release.ts` is the sole util → SDK → Plugin release orchestrator. It builds and stages each package,
removes workspace-only export conditions, resolves `workspace:`/`catalog:` versions, inspects each packed manifest, and
publishes only those exact archives in dependency order. Its Windows helper is built from the locked Cargo graph. Both
check and publish modes run the same preparation and isolated consumer verification before publish can perform an external
write. `check:process-package-publication`
then lets offline npm resolve and install the archives one at a time in that order before the Node runtime import and
deadline check; manually copying all three packages into one `node_modules` tree is not release evidence. The SDK observes
its atomic startup receipt through an abortable directory watcher; the receipt remains the only readiness fact and its
positive safe-integer PID must equal the spawned root before acceptance releases the startup control lease.

Plugin 提供生命周期回调、auth 和 rewrite 能力，不承担 Task 调度身份。OpenAI Codex 和
GitHub Copilot Provider Auth Plugin 把订阅 OAuth（Open Authorization，开放授权）、模型目录和
流式 Provider 请求投影进 OpenCorvus 的统一 LLM（Large Language Model，大语言模型）链路。
消息级 `chat.params` / `chat.headers` hook 只处理具有真实 User Message 的对话 occurrence，
因此 `message` 保持必填，现有第三方 Plugin 不会收到合成消息或 `undefined`。物理 Provider 约束由
Host-internal `provider.chat.params` / `provider.chat.headers` 单独拥有；它们不属于公开项目 Plugin
hook 面，专用触发器只执行内置 Provider/Auth owner。其输入携带真实 `requestID`、字符串 Agent ID
和可选真实消息，对包括 memory/helper 在内的每次流式 LLM occurrence 都执行。用户消息路径先执行
消息级 rewrite，再由物理 Provider hook 最后收敛实际参数和 header；因此项目 Plugin 不能重新引入
Provider 明确拒绝的字段，也不能覆盖 Provider 必需 header。helper 路径直接进入同一物理层，不建立
Provider 特判或第二套请求实现。

普通 Skill 市场和 git/URL Skill source 安装属于用户全局配置面。skills.sh 是当前唯一 Skill Market
authority；全局与项目限定路由共用 `SkillManager` 的 provider、搜索、详情和精确安装契约。Market 搜索返回
稳定候选 identity 和实时 installed projection；详情下载并校验精确候选 bundle；安装必须携带详情 digest，
原子发布单个带 provenance 的 managed Skill，更新全局配置并失效 Skill discovery。运行时 Primary Agent 和
Settings 共用该服务。不存在可配置的 fallback registry，也不通过 Market 路径安装整个 repository；普通
path、URL index 和 git source import 保持为独立高级入口。Market identity 统一为小写并逐段映射到
`skills-market/skills-sh/<owner>/<repository>/<skill>`，替换或删除前必须由目标 manifest 证明同一 identity；
上游网络、HTTP 或响应校验故障统一发布 `SkillMarketUpstreamError` 与 HTTP 502，不能退化为匿名 500。

运行时 `skill_market` Tool 提供搜索、检查和精确安装。搜索与检查是 network read；安装是经普通 Tool
permission authority 单独授权的 local write。新安装 Skill 只在后续 turn 可被 mount；当前 turn 已冻结的
Skill Tool surface 不热更新。`/global/skill/install` 与项目安装路由仍调用同一个通用
`SkillManager.install` owner。Skill mount matrix、project-local
file/folder/ZIP import 和 MCP（Model Context Protocol，模型上下文协议）仍要求明确项目目录，不能因
市场全局化而变成第二份全局投影。

## Expert Squad Package —— Agent 能力包

**代码**：`src/expert-squad/` · `src/expert-squad/prompt-profile-resolver.ts` ·
`src/agent/runtime-template-registry.ts` · `src/skill/`

Fixed native Host, Helper, and Primary Agent registries share one runtime-neutral materialization-cache authority. An explicit `Config.Info` snapshot is parsed once, canonicalized with a domain-separated SHA-256 source, and reused only after exact canonical-byte equality; SHA-256 is an index rather than identity. Recognized functions in schema-declared runtime option fields retain their exact references but disable cross-call reuse, while every other non-canonical value fails closed. Default materializations remain project-scoped, explicit snapshots are process-global because their complete config is the only build input, and one lifecycle owner returns exact detachment receipts for current-project or all-project reset.

Expert squad 是 OpenCorvus 内部的 scenario / agent capability package，不是外部
Codex skill。运行时内置 package 只保留默认便捷开发包 `base`、完整通用团队 `advanced`、研究交付团队 `research-studio` 与专家团生成包 `squad-sdk`；这四个 embedded package 是无需安装即可使用的完整默认集合。其他 squad 的分发形态是
payload，只进入 Squad Market，不由项目 bootstrap 写入安装目录。分发 payload 由
`packages/opencorvus/script/generate-expert-squad-payload.ts` 在构建前从仓库作者源
`expert-squads/<namespace>/<id>/` 明文包生成，禁止手写平行清单。运行时安装包仍只存在于
项目或用户全局 `.opencorvus/expert-squads/<namespace>/<id>/`，运行时 resolver 不扫描仓库作者源。
当前仓库源分区包括 `builtin/<id>`、`mirror/prism`、`tanzeqi/mirror-watch` 和 `wujiang/opentest`。`namespace` 是来源和安装分区，
不是 active identity；manifest `name` 是可选的中文或英文人类可读名称，缺省时 Registry 使用必填 `label` 作为 catalog、Market 与 UI 展示名；`prompt_profile.active` 仍然使用 manifest `id`：

Catalog 同时投影 manifest `name` 与 `label`；`display_label` 只从 manifest label 与 canonical namespace 生成：`builtin`
namespace 直接显示 label，其他 package 显示精确的 `namespace/label`。README 不声明 display
prefix，Overlay 不根据产品名、source kind、安装路径或 built-in 状态再次推导名称。

Composer 选择 expert squad 时把 manifest `id` 写入 Mission 的 immutable held-Squad snapshot；Mission
本身没有 active profile。Mission 是用户可见的 Task 管理者，负责把工作规划并创建为 Mission-owned
child Task；Overlay 不直接创建 expert-squad Task。每个 Mission child Task 必须显式携带一个 held
`promptProfile`，中央 Task API 在创建事务前校验 membership，再由 `PromptProfileResolver` 固定该 Task
的精确 package revision；缺失、未持有或运行期切换都返回 typed authority error。
Mission 只把一个已选 squad 明确拥有的完整交付面写入同一 child Task。若 selector、投影能力和完整 workflow
只覆盖原始请求中一个可独立验收的较早阶段，Mission 先创建该固定 `promptProfile` 阶段 Task，把未覆盖的依赖交付面、
验收边界和所需额外 squad authority 保留在 Mission 台账，并仅在创建后续阶段前请求 operator 授权。Task request
中的 `Original user input` 原文是审计证据，不得反向扩大本阶段明确写明的 in-scope、out-of-scope 与 acceptance。
Task 粒度以可独立验收的交付闭包、可变资源所有权和真实证据依赖为准。同一固定 squad 可以拥有多个 Task；当结果能够
独立验收、重试和交付，且不消费另一并行结果尚未产生的决策、合同、数据、实现、环境或证据时，它们属于同一 ready
frontier。一个结果内部的数据、实现、报告、审计、测试、修复与最终封装仍由 package workflow 在 Task 内闭环。
工作量、验收条目数、目录、交付格式、Agent 角色、Goal 数量和追求并行本身都不决定拆分；同一 squad 也不决定合并。
不同固定 squad、真实外部终态证据/操作者权限边界，或操作者明确要求独立生命周期时，同样形成新的 Mission Task。
`multica_catalog` 只属于显式 Multica 导入 Mission，不用于发现、校验、激活或恢复 Composer 已选择的 expert squad。

Manager 的 folder/ZIP 安装协议要求 caller 显式选择 `project | global` scope，分别解析到当前项目
`.opencorvus/expert-squads/<namespace>/<id>/` 或
`Global.Path.config/expert-squads/<namespace>/<id>/`；HTTP、OpenAPI、SDK 和 Overlay 使用同一字段，
不存在默认值、产品名分支或第二入口。普通 folder/ZIP caller 继续显式选择 scope；Generate Expert Squads
的 SDK authoring 与 Multica import 固定选择 project。Squad Market 的可浏览目录只有公开网站
`https://opencorvus.com/market/` 一个当前展示面；Overlay 设置页只显示 Manager 返回的目录总数、网页浏览与
作者贡献入口，并保留使用同一 folder/ZIP Manager 协议的本地安装面，不复制搜索、筛选、条目或详情目录。
作者入口指向公开 `/publish/` 构建与贡献说明；在第三方 Registry 身份、审核和撤回服务开放前，不得表述为
自助上架或维护第二套上传状态。网站选择精确
package 后通过可见 handoff 返回 Overlay，Overlay 校验 archive/package digest、要求操作者明确选择
`project | global` scope，再使用同一 Manager 安装协议按需安装 repository-hosted payload。Composer 与 Mission
的 editable Expert Squad picker 提供打开这个 Market 入口的动作；Mission 创建入口还会把
operator 输入的 Expert Squad 查询交给同一 Market 模糊检索；排序输入包括 manifest selector、package-owned Skill 与
Agent prompt 的 bounded discovery text，并只返回未安装建议。每条建议提供精确 public Market 页面和显式 project-scope
安装动作。该建议面不是第二个可浏览目录；安装完成后只刷新 picker catalog，不会把打开或安装动作写成 Squad 选择或
激活 profile，也不会自动覆盖现有安装。Native argv、single-instance 与 deep-link producer 只更新一个 latest pending
handoff；renderer listener 在全局启动 readiness barrier 之外异步安装，event 只负责唤醒同一个 reconciliation
consumer。只有 handoff 已完成解析、窗口展示与可见安装面打开后，renderer 才 compare-and-acknowledge 同一 pending
value；失败、重载或更新值竞态不得 destructive read、丢失 receipt 或阻塞 Settings/API/health 初始化。旧版本可能留下
`.opencorvus/.r/project/expert-squad-payload-provisioning.json`，它不再被读取、写入或作为更新/删除权限；
旧版本已经安装的 package 原样保留，后续只通过普通显式安装、更新与卸载生命周期管理。普通 package
replacement 在移动旧 target 前保存 `.package-replacement-<id>.json` 持久 intent；进程在任一 rename
窗口或递归 scratch 清理中终止时，Registry/Manager reconciliation 从精确 before/after digest 与
`absent | exact package | partial scratch` 状态回滚未完成替换，或确认 backup 已开始清理后的完整新
target，并收敛 intent 自有的 scratch 与 journal。每份 intent 使用一个 UUID v4 operation ID，把 staging、backup 与
discard 精确绑定为同一 namespace/ID 的三个不同 canonical scratch 子目录；任意 scratch root、别包路径
或路径 alias 在文件状态读取前失败。回滚从不递归删除安装 target：只有 target 仍是精确 after digest 时
才先原子 rename 到 intent 自有 discard，再原子恢复精确 before backup；partial target 被视为 operator
或未知字节并原样保留、失败关闭。目录暂时缺失不会被误判成 operator removal。Registry 分别维护
project 与 user-global 的严格安装清单，并为精确
项目上下文生成单一有效 catalog；project 的同 ID package 覆盖 global package 并产生 typed warning，
同一 scope 跨 namespace 重复仍在写入前失败。只要 project identity 已存在，即使其 package 损坏也
禁止 fallback 到同 ID global package。安装不修改
`prompt_profile.active`。全局配置候选中的 `prompt_profile.active` 只从 canonical global package
location 校验，项目配置、Task 和 Session 候选则从 global + exact project catalog 校验；两者都由
同一个 Registry 和 Resolver 执行，禁止用缺失 project directory 把合法 global package 误判为未知。

这里的写前保证以物理安装 scope 为边界：project 与 global 安装分别检查各自 scope 内的 namespace
唯一性，并共用 manifest-ID 跨进程锁来串行发布；global 安装不扫描注册项目阻止合法覆盖。不同项目
可以各自拥有同名 project-local package，扫描不会把它们合成一个 catalog，也不会因无关 ID 重复
阻止安装。平台从不扫描用户文件系统；从未注册的目录在首次打开时也使用相同的项目覆盖解析。

- `expert-squad.jsonc` 声明 profile identity、scheduler projection、dynamic agent projections、不可变的 binding `virtual_workflows` contract、skills、package tools、package MCP servers/tools 和可选严格 `configuration.fields`，且 `namespace` 必须匹配父目录；scheduler 和每个 worker 的 13 个 resource array 都必须显式存在，空投影写 `[]`，registry 不补默认值。Workflow node 天然为 Task 级且每个 Task 只实例化一次；可选 Slice revision refs 只是 typed subject，不改变 node cardinality。Orchestrator 从真实 predecessor evidence、active Session、Task 并发容量与 ownership 自然决策，Host 不计算、持久化、自动准入或自动调度 frontier；
- 专家团必须 self-contained：每个 shipped package 至少保存一个 package-local `SKILL.md`，并由 manifest 的 `package_skill_refs` 精确投影给 scheduler 及所有实际使用该方法的 worker；平台 default Skill、README、selector、Agent prompt 或未被投影的同名文件都不能替代这一契约。模型可见资料只存在于一个显式投影 Skill 的目录闭包，工具专用的不可变模板和数据只存在于顶层 `assets/**`，并由 package tool 静态 import 进入内容寻址 bundle。运行时禁止解析 project/global 安装路径、回读源仓库、复制平行 authority、环境变量或路径 fallback。普通 Task 输入与显式外部服务仍由调用契约声明，不伪装为 package asset；
- manifest 的 `configuration.fields` 只声明 `text | boolean | secret` 字段形态，不包含值。值的唯一来源是 `Global.Path.data/expert-squad-configuration.json`，以 installation scope、project ID、namespace 与 manifest ID 组成的精确安装身份索引，并以原子 mode `0600` 写入；HTTP（Hypertext Transfer Protocol，超文本传输协议）和 Overlay 只返回字段声明、非 secret 值与 secret 的 `configured` 布尔状态。Resolver 只把精确 active package 的声明和安装身份带到其 package tool，工具调用时通过 `ToolContext.configuration` 读取；配置不得进入 prompt、隐藏消息、catalog secret、Bash、terminal 或进程环境。未投影 package tool 不存在调用面，因此 inactive package 不获得配置值；
- `selector.md` 是 Orchestrator-visible selector skill 的完整说明来源；
- `getLoadedBuiltInPackages()` 是内置 package 的唯一加载面，只返回默认 `base`、完整 `advanced`、`research-studio` 与 `squad-sdk`；不存在
  flattened built-in profile facade。非通用 squad 即使随应用分发，也只有经操作者显式选择 `project | global`
  scope 安装为明文 package 后，才通过 package discovery / registry / resolver 进入 catalog；
- 默认内置 `base` 是 `advanced` 的紧凑替代，投影相互独立的 `base-planner`、`base-researcher`、`base-developer` 与 `base-tester`。Planner 使用不含 shell/edit/write 的 plan-only Tool 投影；`planner-execution-verification` 以 Planner → command-capable Developer → independently executable Tester 处理需要 project Skill、命令、本地 client、package Tool、MCP 或 browser mutation 的交付；`planner-parallel-delivery` 只在 Researcher 能用其真实 repository/web 读工具完成一个独立完整分区时，才让它与 Developer 共享 Planner 后的 dependency-ready frontier。两张图都让 Tester 依赖 Developer，在实现节点结算后验证已停止变化的结果。动态业务状态交付先关闭 request 指向的 candidate authority sources，再由 Developer 建立 entity/rule/effect action matrix；Tester 在读取实现声明前从原始请求与 current authoritative sources 独立重建矩阵，并逐行核对缺失、额外、替代、身份与规则优先级。验收范围不来自实现方报告。Base 不投影 Integrity 或 Visual Quality Assurance 身份；真实页面证据仍由计划指定的实现或测试分区负责。它不创建或消费 RequirementSet、ContractGraph、Goal 或 Delivery Slice 计划事实；
- 内置 `advanced` 的 manifest v1 投影完整的十四 Agent 软件开发团队，包括 package-owned 的 Build `implementation-engineer` 与 Delegated Worker `test-engineer`。每张交付图保留 Requirements → Architect 依赖并按真实 Tool projection 分配 repository read、web research、executable discovery/mutation、independent readback 与 Artifact review；`researched-planned-delivery` 在外部 web 事实会改变需求时让 `research-investigator` 先于 Requirements，普通 `planned-delivery` 则把动态 client source 交给 implementation/testing owner。RequirementSet 与 Slice acceptance specs 保留 candidate-source closure 和 action-matrix contract；外部状态的直接验收由具备执行/读回能力的 Tester 从 raw authorities 独立重建矩阵后完成。无 shell/client 的 `system-integrity-reviewer` 依赖已结算的 Test evidence，再独立审计 requirement coverage、authority closure、action-matrix mapping、freshness 与 contradiction。Agent 身份、职责、依赖图和协作提示全部由 package 拥有，不进入 host Core prompt、Delivery Slice 控制工具或 runtime template；
- 内置 `research-studio` 投影 Planner、Deep Researcher、Evidence Analyst、Fact Checker 与 Report Writer 五个精确身份，分别以 direct-writing、evidence-synthesis 与 full-research 三张 binding workflow 交付可引用研究报告。其共享 `analysis-report-quality` package Skill 连同固定报告模板和 Draft 2020-12 JavaScript Object Notation (JSON) Schema 完整内化在 package 闭包内，并只投影给 Analyst、Fact Checker 与 Writer；Analyst 先生成可复现计算证据，Fact Checker 独立复算，再由 Writer 从同一结构化模型派生 Markdown 与集成 Hypertext Markup Language (HTML)。浏览器可见报告必须由 Writer 和 Orchestrator 分别读取真实 `browser_preview_capture` 图像完成两次人工视觉复核；它不进入 payload、Market 或项目 provisioning；
- `universal-build` 是平台唯一通用实现/修复身份：明确的有限改动与已规划交付均按 Task workflow node 调度，并可携带精确 Slice revision refs；它由 Resolver 只投影到 scheduler dispatch inventory，不属于 Advanced 或任何外置 package；同一个 `build` runtime template 只提供 typed adapter Application Binary Interface (ABI) 种子，不构成运行身份；
- Advanced 的 `planned-delivery`、`researched-planned-delivery`、`evidence-investigation`、`greenfield-interface-delivery`、`greenfield-interface-visual-delivery` 和 `reference-interface-delivery` 是六张不可变 manifest v1 scheduler contract 图；researched 图只用于一个 load-bearing external web evidence gap 必须先于 Requirements 的非界面交付，禁止把 `research-investigator` 当作选中图之外的 optional node；greenfield 图自带完整需求、架构、原创界面设计、工作量复核、真实渲染复核与界面完整性谱系，不需要参考 URL，也不得与非界面 planned 图重叠选择；只有 reference 图要求 `interface-investigator` 与一个 operator 已提供的 source URL。Orchestrator 可见地选择精确图后必须完成全部声明 node/依赖，但这些图不是 host 执行引擎、状态机、active/default workflow 字段或持久化进度；
- 激活任意其他 squad 会完整替换当前 Base、Advanced 或 Research Studio 投影，不继承或组合它们的 Agent、prompt、skill、tool、mount、MCP resource 或 virtual-workflow contract；
- 每个 active squad 都由 `PromptProfileResolver` 获得平台 `universal-build`，且只进入 scheduler 的 `dispatch_agent` schema；manifest、virtual workflow、catalog member、public `projected_agent_ids` 和普通 worker surface 都不得声明或显示它。review / acceptance evidence 已证明需要修改 repository 时，Orchestrator 通过 prompt 自然选择负责的精确领域 producer，或在没有更窄责任时选择 `universal-build`；host 不加 route gate。领域 package 可以声明真实实现 Agent，但不得把它包装成平台兜底 Build；
- manifest `version` 严格使用 `YYYY.MM.DD.N`，其中 `N` 是该 Squad 在该日的正整数修订序号；Registry 拒绝任意 SemVer、裸日期、时间戳、伪日期和零/前导零序号；
- `PromptProfileResolver` 负责把 Task 创建时绑定的 active expert squad 精确 revision 投影成 scheduler
  capability、worker capability、active scheduler/worker production skill grants、package tools 和 scoped
  package MCP providers。Selector metadata 只进入 Task 规划和安装管理 catalog，不进入已有 Task 的运行时
  tool 或 skill surface。Mission 的跨 squad 阶段切换必须创建下一个显式 `promptProfile` 的固定 profile
  Task，禁止修改既有阶段 Task。Task 创建事务会冻结 active profile 与精确 package revision；同 ID 的
  后续 wake 从创建绑定 revision 恢复，不读取已安装 package 的较新 bytes，任何换 ID 请求都返回 typed
  conflict，并要求创建新 Task。
  Task 创建时无论 caller 是否显式传入 `promptProfile`，root Session 都在 Task row 可见前原子持久化
  创建快照与显式 active ID；进程中断不能留下缺少 profile owner 的可执行 Task。
  Session config writer 从 Task-root ownership 与创建绑定校验 profile 不变性，禁止 caller 可选 guard；
  workflow binding writer 必须在同一事务证明 workflow package revision 等于 Task 创建绑定。
  Selector metadata 不进入普通 `Skill.all()`、production `skill` tool、worker grants 或 runtime hashes；
- Registry identity discovery 只读取每个外部 package 的 manifest 一次，并从同一份 raw manifest
  生成 declaration inventory。Resolver 的 list/search surface 每页最多二十个 bounded index entry，
  只含 identity、显示字段、product pillar、system role 与物理来源；README、selector 正文、workflow、
  Agent、Skill、tool、MCP、绝对路径与 package digest 不进入该 index。一个精确 planning inspection
  只返回所选 Squad 的 bounded selector guidance 与一页 workflow summary；Settings exact detail、
  active runtime、collision proof 才读取一个精确 package tree。Catalog revision 覆盖每个物理
  identity 的完整 manifest declaration revision，package version/workflow/selector 变化会使 cursor 与
  inspection cache 一起失效；project/global scope 顺序 canonical，consumer 禁止原地修改 Registry cache；
- `active_agent_projection`、scheduler、各 active agent 和 `active_skill_projection` 的 `projection_hash` 才表示有效运行投影。Scheduler hash 覆盖 `virtual_workflows`，worker hash 覆盖其完整 projected resources；声明 hash 与运行 hash 字段不同，禁止用声明摘要冒充运行身份或缓存键；
- 每次被选中的 built-in/project/global package 都按 manifest identity 与完整内容 digest 物化到
  `Global.Path.data/expert-squad-package-revisions` 的持久化 content-addressed revision。Task binding、
  Orchestrator wake、fresh worker 与 existing Session 只解析该精确 revision；existing Session 的
  `WorkerTurnDescriptor.packageRevision` 与新 Turn 不一致时返回明确 stale-identity error，不能把同一
  Session 漂移到新 package bytes；
- `capability_projection.scheduler` 是固定 host Orchestrator 的唯一 package 配置面；它不是 worker identity；
- `capability_projection.agents.<agentID>` 的 key 是唯一动态 worker identity，也是 `dispatch_agent.dispatch.target` 的精确 literal。`base_role` 只选择 core prompt、model、tool、session、adapter 和 runtime template seed，不能反向推导或替代 `agentID`；
- 每个 worker 的 canonical resource root 是 `agents/<agentID>/`。Prompt、skills、tools 和 MCP refs 必须由同一个 projection 显式声明；未知 owner、orphan directory 和未投影资源直接失败；
- manifest 不存在 top-level `agents`、`virtual_agents`、`team` 或 dispatch identity 面，也不存在 `virtual-agents/**` resource root；动态身份只来自 `capability_projection.agents.<agentID>`；
- `capability_projection.virtual_workflows` 是 package 声明的不可变 scheduler contract；显式 `{}` 表示普通 direct-dispatch Squad 没有 binding workflow，禁止为它虚构阶段。非空记录只包含 workflow label/description 以及 node 的动态 `agent_id`、description 和 `depends_on`。Orchestrator 在首次 domain dispatch 前记录一次不可变、可见的 workflow-selection decision，绑定 Task、workflow、精确 package revision/digest 和真实 scheduler message/tool identity。每个 node 在该 Task 中只实例化一次；dispatch lineage 可引用精确 Delivery Slice revisions 作为输入与证据 subject。图没有 dispatch scope、active/default workflow、current node、step status、auto-advance、session binding 或 persisted workflow state；
- 对话驱动创建 Squad 时，简单 direct-dispatch Squad 写 `virtual_workflows: {}`。需要协作图时，authoring 默认优先一个 Planner 根节点加至少两个只依赖 Planner 的并行 worker；只有消费者确实需要生产者 Artifact 时才声明更丰富的 binding DAG。Requirements、Architect、Integrity 与 Slice 组合属于具体 package 的 authoring/prompt contract，不是平台通用合法性；SDK 和 Registry 的通用 validator 只校验 manifest v1 数据形态、workflow identity、引用、依赖排序与无环图，内置包另走 `validateBuiltInExpertSquadTopologyPolicy()` 防止非 Advanced 回归到平台 Visual/Integrity 角色或 Requirements → Architect → Build 串行链。所有新建 source package 都必须先经过 `validateExpertSquadPackageDefinition()`，再由唯一 `@opencorvus-ai/sdk/expert-squad-authoring` writer 通过同父目录 staging 和 rename 原子物化，并继续走 Registry validation 与显式 Manager import；禁止手写第二套 package writer；
- 任务推进由 scheduler scope 的 Orchestrator 通过自然判断和真实工具调用决定。Virtual workflow 的 dependency 不自动 dispatch、不形成 host hard gate，也不创建第二套 workflow engine、dispatch、context packet 或 broad task-manipulation tool；它通过模型必须遵守的 prompt contract 防止无效越序工作。
- 用户界面的 Goal 是 versioned Delivery Slice contract，只提供目标、验收、owned paths、priority、kind 和精确需求/契约引用；它没有 execution、status、retry、workspace、`depends_on` 或 readiness ancestry。Task 是唯一 business lifecycle；Session/dispatch 是 physical execution；panel 分别读取 current revision、独立 activity/evidence/review association 与 Task Completion Decision acceptance，禁止合成为 Goal progress 或 lifecycle。ContractGraph 只保存 producer/consumer interface contracts，不能推导调度顺序；未发布项目只有这一种严格结构，不声明协议代际。

专家团开发复用现有 `@opencorvus-ai/sdk`，不建立第二套 manifest schema、package loader 或
archive 实现。`squad-sdk` 是与 `base`、`advanced`、`research-studio` 同级的第四个 embedded system
package，也是异构算法导入与 SDK 专家团生成的唯一 capability package，显示名称固定为
`Generate Expert Squads`；干净应用 catalog 无需 payload release 即可选择它。普通 Chat、
Base 与 Advanced 不再投影 authoring/import Skill 或写入工具。Task 选择 `squad-sdk` 后必须先选择
`sdk-authoring` 或 `heterogeneous-import` binding workflow。它的 package-local method Skills 只属于
该 active package，不是全局可选 capability identity。Composer 只把它作为普通 Expert Squad catalog
条目显示并写入 `@squad("squad-sdk")`；manifest 的 `system_role: "expert_squad_generator"` 是 catalog 与
User Interface（UI）统一特殊标识的唯一语义来源，界面使用现有 Icon/Badge primitives，禁止按 label
或目录猜测。禁止恢复独立 authoring Action 或全局 authoring Skill 入口。
`expert_squad_author` tool
向模型暴露由 SDK identity/graph/resource leaf schema 与 Host runtime-template identity 组合出的
compact structured blueprint：README、selector、scheduler 与 Agent prompt 作为内联 text，Host
确定性投影 canonical manifest path 和 package file tree，随后构造唯一 SDK package definition
并交给同一个 SDK writer、Registry validation 与显式 Manager import；该 tool 只是对话
transport，不实现第二套 runtime schema、writer、loader 或安装路径。package-local authoring Skill 携带一个由相同
结构化 tool schema、SDK validator 与 Registry 正向校验的完整 definition contract，
用于呈现 canonical field、runtime template 与 package path，而不复制合法性实现。
Mission launch 把当时授权的精确 ID 集合固定为整个 Mission 的 held-Squad authority。Mission 通过
每次最多二十项的 `capability_search` 检索该 frozen set，再用 `panel.expert_squad_inspect` 读取一个
精确 held Squad 的一页 planning guidance；完整 held catalog 从不写入 tool result 或 Session frontier。
Mission Session 的首次数据库提交就是唯一身份提交：`kind="mission"` 的 Session row 与同事务
`session.created` occurrence 已携带 canonical `metadata.mission.id`、channel key、cwd、product pillar
和 immutable held-Squad snapshot。SQLite 对同一 project、directory、Mission ID 只允许一个 row，
并拒绝缺失或事后改写 Mission ID；进程内锁不是唯一性 authority。`missions/<mission-id>/` runtime
directory 只是可重试的 derived state，若文件系统创建在 Session 提交后失败，重启会复用同一完整
Session 再创建目录，不新增或推断 orphan Session。
Search diagnostics expose only the held count, pillar-filtered visible count, Mission product pillar, catalog revision,
and bounded result count. A zero result therefore distinguishes held authority, pillar/catalog visibility, and query
matching without enumerating the held identifiers or broadening the immutable snapshot.
For a Mission caller the persisted Mission product pillar is canonical even if
the model supplies a contradictory request filter; diagnostics expose that
requested pillar separately while search remains inside the canonical pillar.
Composer 中一个或多个可见
`@squad("<id>")` 引用只授权这些 ID；没有 Squad 引用时，包括只选择
`@mission("<name>")`，launch path 把当时全部已安装 Squad 的精确 ID 快照持久化。后续新安装不会
扩展该 Mission；Host 中央 Task 创建 authority 同样要求显式 `promptProfile` 属于该快照，错误只返回
count/hash 而不枚举 held IDs。Mission Skill 只约束编排，不增加、生成、安装或
替换 Squad authority。每个阶段只能选择 held set 中一个能以正向 catalog guidance 完整拥有
outcome、deliverables、responsibility 与 acceptance boundary 的 Squad。

Mission 不自动生产 Expert Squad，也不能把普通 Expert Squad authoring capability 当成越权路径。
对话驱动的显式 Squad authoring 仍由获得明确 operator 授权且固定选择 `squad-sdk` 的 Task 使用
`sdk-authoring` workflow 与唯一 tool 完成。Generate Expert Squads 的 authoring surface 只有一个
安装结果：Host 显式把生成物导入当前项目 canonical `.opencorvus/expert-squads/<namespace>/<id>/`
root，使成功 receipt 对应的 manifest ID 随后出现在当前项目 Registry catalog；tool input 不再暴露
project/global 分支。SDK authoring 与 heterogeneous import 都在同一原子 Manager transaction 的 staging tree 内写入
Host-owned `.opencorvus-meta.json`，source folder/ZIP 不得提供该保留文件；元数据记录固定 generator Squad、精确 Task、scheduler Session、生成时间、
生成方法以及适用的 source/mapping digest。该文件是 project execution provenance，不进入 portable
package digest 或 export；Registry 是唯一 reader，存在但损坏时必须报告 discovery error，禁止忽略或
回退为普通安装。该行为只完成项目安装，
不修改 `prompt_profile.active`，也不创建第二套 package writer、catalog 或同步副本。旧的 write-capable
`/multica/import` HTTP 路由已删除，read-only catalog/preview 仍服务 evidence collection，实际写入只允许固定
`squad-sdk` Task 的 `multica_import` tool。其结果只有在后续
Composer 选择或新的“全部已安装” Mission 中才进入 held set。当前 Mission 若没有任何 held Squad 能拥有某个依赖阶段，必须保留该
阶段、验收义务与 blocker，完成所有独立可接受的已授权阶段后请求 operator 重新选择权限。catalog /
Registry 故障、现有 package 损坏、凭据、model、permission、dependency 或 network 缺失属于原
owner 的修复面，也不能被解释成新增 Squad authority。

Registry 的 `package_digest` 对完整 validated package tree 的 canonical relative path、byte length 与
exact bytes 做稳定摘要，覆盖 prompt、Skill、tool、MCP、asset、README、selector 和 manifest。
它与仅覆盖 catalog declaration 的 `declaration_hash` 是不同身份。Manager 在同一 manifest-ID install
所有 package publication 只由 Manager 的 manifest-ID 跨进程锁内 primitive 执行。create-only 重试时，
同 ID、同 exact scope、相同 `package_digest` 返回 `unchanged` 回执而不重写；不同 digest 返回 typed
conflict。任何替换或恢复都必须携带 `expected_current_package_digest`，Manager 在锁内重新读取当前 digest
并执行 Compare-And-Swap（CAS，对比后交换），成功后返回 before/after 完整 revision 回执。通用
`replace` boolean、锁外预检查和无 CAS 写入入口均不存在。

Expert Squad Manager 的 import/install/update 结果返回 canonical installed `version` 与
`packageDigest`。Market 同时返回 bundled `package_digest`、每个 installation 的
`installed_version` 与 `installed_package_digest`；`update_available` 在 version 或 digest 任一变化时为
true，因此同版本的本地 byte drift 也会成为明确更新事实。
Node-only `@opencorvus-ai/sdk/expert-squad-authoring` 只负责把由生成 OpenAPI
类型约束的 manifest 和调用者文件写入一个全新目录；它拒绝不安全路径、重复路径和覆盖。
SDK（Software Development Kit，软件开发工具包）的 `expertSquadAssetPath()` 生成唯一顶层
`assets/` 路径；folder/ZIP import、export、payload release 和 Registry 对同一完整文件闭包做字节保留，
package-tool bundler 只允许从显式 package tool/lib 依赖图静态导入该闭包中的受支持文本/JSON 资源。
`@opencorvus-ai/plugin` 的 `tool({ args })` 在 package bundle 自己的 Zod runtime 内一次性构造完整 object `inputSchema`；Resolver 只投影该 schema，不得在 host Zod runtime 中从跨 bundle 的 field schema 二次拼装。
`client.expertSquad.validateFolder` 通过项目作用域后端调用同一个 `ExpertSquadRegistry` 做只读
语义校验，不安装也不激活；显式安装仍只走 `ExpertSquadPackageManager` 的 import 路径。
SDK 的 `validateExpertSquadPackageDefinition()` 是所有新建专家团共用的 authoring hook：在写盘前校验
workflow identity/引用/依赖/无环拓扑、Goal/Integrity dispatch 语义、canonical package path、
manifest 文件所有权，以及 README/selector/projected prompt entrypoint 的存在性、UTF-8 文本类型、
非空内容和 owner path。`renderExpertSquadPackageFiles()` 与 `writeExpertSquadPackage()` 都经过该入口；
portable template 与 Multica import 只调用这个 writer。SDK 的
`validateExpertSquadManifestDispatchTopology()` 同时由 Registry、collaboration 与 source-capability
校验复用；严格 manifest shape、identity/version、configuration、runtime template 与资源闭包只由
Registry schema 和 package loader 校验，SDK 不手写第二份 schema。所有 workflow
node 都是 Task-level；node 可引用受影响的 Slice revisions，但不得按 Slice 扩增实例。
SDK 的 `validateExpertSquadCollaboration()` 只校验一个或多个 manifest 之间的静态 Mission Task 契约：
定义必须至少包含一个 stage 并声明 `stage_execution: "mission_task"`；每个 stage 引用精确 squad/workflow、只依赖更早 stage、消费可达的
可见 evidence 并拥有唯一输出。整个 fixed-profile Task 与所选 binding workflow 共同拥有 stage，禁止再指定一个 worker 冒充 stage owner 或 repair owner。Stage workflow 可以先有
Task-level requirements/architecture 与 delivery。它不安装或选择 package，
不创建 Mission Task/Delivery Slice，不 dispatch agent，不保存 step/state，也不自动流转。组合运行时只使用
Mission-owned fixed-profile Tasks、Task-local Slice revisions、可见消息、每个 Task 的 `prompt_profile.active` 和
Resolver 投影；领域 squad 只规划并交付自己的阶段 Task。
SDK 的 `validateExpertSquadSourceCapabilities()` 校验仓库唯一 source-capability contract：每个 source
路径只能被一个 active role、imported Skill closure、native tool replacement 或 pipeline asset 认领；
typed agent owner 必须解析到精确 squad/agent，pipeline owner 必须解析到精确 squad、collaboration 或
声明的平台 surface，native surface 与 collaboration 引用也必须闭合。原始 pipeline step group 还必须
逐组绑定到已校验 collaboration stage、平台 surface 或明确 unavailable capability，不能用一段人工说明
代替归属。SDK 只检查摘要格式；仓库文件系统审计负责核对文件数与 SHA-256（Secure Hash Algorithm
256-bit，安全散列算法 256 位）真实内容。该合同只证明 source inventory 与当前 package owners 的静态
闭包，不安装资源、不访问 source root、不 dispatch workflow，也不把缺失的外部协议标记为可用。
条件交付与恢复路径必须拆成不同的 SDK 校验 collaboration definition，禁止在主交付定义中放 optional stage。Mirror Prism 只有一个 `mirror-prism-ainvest` 主定义并只创建一个固定 `prism` Task；其 lean manifest 绑定 19 个强制节点。任意授权参考页面只是子系统发现入口；Mirror Watch 与 general researcher 必须形成唯一、证据驱动的 `subsystem_closure`，覆盖完成业务能力所必需的全部关联子页面、共享 shell/service/data/state、导航边、deep-link/return/recovery 路径和端到端 journey。单页面只有在证据证明没有必需关联页面或跨路由延续时才构成闭包；页面文件只是内部工作单元，不能单独验收。随后强制 AInvest mapper 把相关 AInvest 产品能力、Nova 语义 token、组件、资产、交互、行情颜色、合规和 light/dark 规则投影成唯一带引用的 `prism/ainvest-product-design-authority` Artifact；Wiki 只投影给 mapper，所有下游 Agent 消费该 Artifact。普通 `mirror-prd-stage-planner` 必须同时选择参考系统合同与 AInvest authority，再发布唯一 `prism/delivery-plan`；该 plan 在 PRD、设计、实现与 review 间保持 closure member equality、共享 owner 和 material journey 联合验收。Planner 不创建 RequirementSet、ContractGraph、Goal、Delivery Slice、phase Task 或 workflow state。Prism 只拥有 AInvest 原创产品设计，Planner 固定 `frontend_design_mode: greenfield_original`；参考页面只作为产品结构、行为、数据、可访问性观察和 adopt/defer/reject 灵感，不能成为 screenshot/region/geometry/style parity authority。clone、replica、port 与高保真复刻由独立 `frontend-replica` Expert Squad 拥有。Prism 的设计、代码和 MirrorTest 视觉复核只比较 AInvest authority、Product Requirements、批准的 Prism AInvest 原创设计与当前产品截图，并必须启动真实组装后的子系统、遍历所有 closure member 和 material journey；孤立 preview、placeholder destination、断裂导航或 state discontinuity 都不是完整交付。`mirror-design-page-designer` 通过自身 manifest 投影显式获得 `default/skill/design-taste-frontend`，作为仅限 Prism 的试点；该授权不从 `frontend-design` base role 推断，也不扩散到其他 Prism Agent、其他 Expert Squad 或 native runtime template。每个 Prism Task 都绑定 Mission provision 的 canonical AInvest child repository；不存在 generic destination 或第二个输出身份。Mission 不复制节点状态，也不按 phase 创建或切换 Task。MirrorTest 分类后的非视觉与视觉产品缺陷分别选择固定 `review-debug/debug-repair` 与 `review-debug/visual-debug-repair` Task，随后创建新的固定 MirrorTest retest Task。测试资产缺陷仍由 MirrorTest 修复，错误上游 artifact 返回统一 delivery Task 或精确 recovery Task。
仓库便携模板由根 `script/generate.ts` 调用同一 SDK writer 生成，因而示例和生产 authoring
接口不会形成平行文件树实现。

### Squad / Skill 更新来源

已安装 Squad 与 Skill 的更新只有两个显式来源：`builtin` 和 `server`。caller 必须在
`POST /expert-squad/update` 或 `POST /skill/update` 的 `source` 字段中选择其一；更新失败直接返回错误，
禁止在两个来源之间 fallback。Squad 更新还必须携带安装时的精确 `project | global`
`installationScope`，Manager 只替换该 scope 中已存在的同 ID package，不改变
`prompt_profile.active`。Skill 的 builtin 更新只重写生成的 builtin cache；server 更新只替换当前
Skill inventory 中同名且 writable 的目录。
显式卸载会把项目配置与未绑定 root Session 引用替换为 Base，但已经拥有 workflow occurrence 的
Task root 保留其 frozen active ID，并继续从持久化 content-addressed package revision 解析原闭包；
卸载不能改写已发生执行的 package owner。

`builtin` 来源分别读取生成的 `packages/opencorvus/generated/expert-squad-payload.ts` 与
`packages/opencorvus/src/skill/builtin-payload.ts`，完整替换目标目录，
因此本地残留文件不会保留。`server` 来源共用 `package-update/client.ts`，唯一配置为
`package_updates.server_url`。客户端按 kind 和 identity 请求相对路径
`v1/expert-squads/<id>` 或 `v1/skills/<name>`，并严格接收
`{ kind, identity, version, sha256, archive_base64 }` JSON（JavaScript Object Notation，
JavaScript 对象表示法）信封；kind、identity、canonical base64 与 SHA-256 摘要任一不符都会在写盘前失败。
Squad 还要求信封 `version` 与归档 `expert-squad.jsonc` 的 version 完全一致。当前没有部署默认服务器，
未配置 `package_updates.server_url` 时 server 更新明确失败，不存在隐含公共地址。

Expert Squad 目录更新使用同目标父目录内的 staging/backup/rename 原子替换路径：新归档先完成解析、
身份与内容校验，随后才移动旧目录；安装后校验失败会恢复 backup。普通 Skill 的 Market 安装、文件导入
和 writable server update 则共用一个以完整 catalog 为 subject 的 durable publication occurrence：在第一次
authority rename 前持久化有序目标集合、每个目录的 before/after digest、由 occurrence ID 确定性派生的
staging/backup 路径、更新类型和 global config revision。全部目标精确达到 after digest 后才发布 catalog
phase，再幂等提交同一 occurrence 记录的 path/policy 语义并发布 configured phase，最后写 committed receipt；
未形成完整 after catalog 的 occurrence 只能按精确 digest 恢复完整 before catalog 并写 rolled-back receipt，
任何 foreign bytes 都保留并阻断恢复。所有 Skill catalog projection 先在跨进程 catalog owner 下收敛 open
occurrence，并以全部 terminal receipt identity 的稳定集合摘要作为进程内 Skill/global-config/inventory cache
revision，因此另一个 backend 不能继续投影 mixed 或 stale catalog。所有 global config writer 使用同一个 `catalog owner → config
file owner` 锁序，并在修改配置前先收敛 open Skill replacement；replacement 的 before/configured revision
会对真实磁盘配置和语义 effect 重新校验。每增加一个终态都必然改变 cache revision，不依赖 caller wall clock
或 UUID 顺序。Overlay 只展示来源明确的更新按钮，调用成功后重新读取
catalog/market 或 canonical Skill mount matrix，不维护本地 shadow 状态。

Expert Squad Market 只从严格 bundled declaration 和已安装 package identity/location 投影
`installation_scope`，不把 boolean installed 与 scope 维护成两个来源。Market、builtin install/update、
payload release、folder/ZIP validate/import 是 package provisioning/repair 控制面：它们仍要求精确项目
directory，但服务端只进入 project identity context，不执行完整 runtime bootstrap。因而旧 manifest 可以继续被
catalog 严格拒绝，同时用户仍可从 Market 按已安装 scope 显式执行 builtin replacement；catalog、activation、
export、uninstall 和普通 runtime routes 执行完整 bootstrap，但 bootstrap 只发现四个 embedded 默认团、
已安装 package 与待恢复的 replacement intent，不安装或协调 repository-hosted payload。这里没有无条件
自动覆盖、默认受管更新、旧 schema 兼容或 source fallback；显式安装与替换只走
`ExpertSquadPackageManager` 的严格原子 compare-and-swap 与持久 replacement-intent 恢复实现。

### Built-in Skills —— inventory 与运行投影分离

普通内置 Skill 的可审查准源位于 `packages/opencorvus/src/skill/builtin/**`，构建前由
`packages/opencorvus/script/generate-builtin-skill-payload.ts` 生成唯一的
`packages/opencorvus/src/skill/builtin-payload.ts`。
生成描述符保留每个 `SKILL.md`、supporting file、许可证和 provenance；运行时不联网下载。
Skill frontmatter `name` 是身份准源，包含 `:` 的名字使用完整身份的 SHA-256（Secure Hash
Algorithm 256-bit，256 位安全哈希算法）摘要作为 Windows-safe cache 目录名，摘要不构成别名。
普通 Skill inventory 对来源采用一个明确的 authority 顺序：内置 Skill、OpenCorvus 自有
`.opencorvus/{skill,skills}`、显式配置 path/URL 与显式安装来源保持严格校验；自动兼容发现只扫描
`.claude/skills`、`.agents/skills` 与 `.codex/skills`，属于非权威可选输入。自动候选无法解析或读取时
记录 `Skill.Warning` 和日志 warning 后忽略；多个自动候选声明同一 `name` 时全部隔离，禁止按扫描顺序
任选一个；显式来源与一个自动候选同名时，显式来源成为唯一 catalog entry 并记录自动候选被遮蔽的
warning。两个显式来源或显式来源与 builtin 冲突仍由 `SkillInvalidError` 失败。`Skill.warnings()` 与
`Skill.all()` 读取同一个 instance state，不形成第二份 inventory。项目 bootstrap 只在 Chat
`skill_refs` 非空时枚举 inventory；未引用 Skill 的 Chat、Provider 与其他项目路由不会因为无关的显式
Skill definition 错误而失败，真正访问 Skill catalog 时仍保留严格错误。
普通 Skill 与专家团 package Skill 的 frontmatter 都只投影 OpenCorvus 已声明的字段；其他字段由
同一 Zod object schema 在解析时 strip，不阻断 Skill inventory 或 expert-squad catalog，也不因此
获得运行语义。`metadata` 只投影字符串值；对象、数组、数字、布尔值和 null 等不支持的 entry 被
同一 schema 丢弃，既不获得运行语义，也不阻断 Skill inventory、mount matrix 或 catalog。其他已
声明字段仍按 schema 校验，类型或值非法时继续返回带来源路径的解析错误。
`platforms` 是 Hermes 可移植扩展，唯一公开值域是 `windows | macos | linux`；Node.js 的
`win32 | darwin | linux` 只在 Skill mount eligibility 边界映射一次，不能写入或导出为 Skill metadata。

当前全局内置 inventory 包含 `design-taste-frontend`、`grill-me`、`work-artifacts` 和
`research-report`。inventory 本身不代表 Agent 可调用：

项目或 Session 的 `skill_mounts` 以 active Expert Squad ID、精确 Skill owner ID 和
`default/skill/<name>` 为唯一 operator grant 坐标。canonical mount matrix 同时列出 package scheduler、
scheduler-only platform worker 与 package worker；`orchestrator` 是保留的 projected scheduler owner，
不是普通 dynamic worker ID，但可通过同一 operator mount route 获得一个已安装 project Skill。真实
Orchestrator Turn 与 worker Turn 都经 `PromptProfileResolver` 和 `SkillMount.resolve()` 重算同一
projection；matrix row 不是第二份执行授权。每个 owner 仍必须拥有物理 `skill` Tool，Skill eligibility
仍按 platform、required tools 与 permission 独立判定。改变角色名称或 `base_role` 不会继承 mount；例如
Advanced `source-investigator` 只有在 manifest 显式使用 Skill-mountable runtime 且 operator 精确挂载后，
才可通过其真实只读命令/Skill surface 调用项目客户端。

- `advanced` manifest 的 scheduler 与精确 `requirement-engineer` worker 各自通过 `default_skill_refs`
  显式获得 `grill-me`；Requirements worker 被鼓励用它逐个澄清当前决策 frontier，但问题仍经可见的
  worker coordination → Orchestrator `ask_user` interaction → 同 lineage continuation 链路返回，最终
  RequirementSet 仍只由 typed Requirements adapter 注册，不存在按 `base_role`、provider 或模型继承；`squad-sdk` scheduler
  独占 package-local authoring/import method Skills 与 `expert_squad_author | multica_catalog |
  multica_preview | multica_import`，每个 worker 的授权只来自该 worker 的精确动态投影；
- Prism manifest 只给 `mirror-design-page-designer` 的 `default_skill_refs` 显式授予
  `design-taste-frontend`；其他 Prism Agent 与其他 Expert Squad 不继承该试点授权，也不存在按
  `base_role` 或 runtime template 自动推断的前端 Skill；
- native Chat 与 Work 都不继承 `advanced` 的生产投影。各自的
  `primary_assistant_capabilities.<chat|work>.skill_refs` 是唯一持久默认授权；Work harness
  默认分配 `work-artifacts`，Chat 默认为空，二者通过同一个参数化 capability 实现读写但绝不
  互相覆盖。默认项进入对应 conversation turn 并可由模型自动发现；Chat Composer 的 `@skill` 菜单则读取
  当前项目完整 installed Skill catalog。用户可见文本中的精确 `@skill("<name>")` 由 Overlay 与
  server 共用同一 directive parser，server 只把点名且已安装的 Skill 增挂到该次 Chat turn 的同一个
  `skill` surface。显式点名不会写回项目配置、session overlay 或其他 shadow state；下一 turn 未再次
  点名时仍只保留默认授权，未默认且未点名的 Skill 继续不可搜索、不可加载；
- `work-artifacts` 是平台唯一结构化工作产物 Skill，只指导同一个 Work Artifact Harness 的
  `work_artifact_inspect | work_artifact_author | work_artifact_validate |
work_artifact_deliver` typed tools，不拥有第二套 serializer。profile registry 是格式、操作、Skill
  resource、runtime、限制和 qualification 的唯一公开目录；当前资格矩阵只声明
  `office.presentation@1` 的新 PPTX authoring，不声明 transform。DOCX/XLSX/PDF、existing-file
  editing 与其他格式必须在同一 harness 完成 profile qualification 后扩展 discriminated schema，
  禁止增加平行格式 Skill、库或兼容 tool identity。`validate` 生成由 canonical Attachment Store
  持久化、与 source SHA、profile、runtime lock revision、最终 package SHA 和 fresh render SHA
  绑定的 receipt；`deliver` 只消费该精确 receipt，并在发布前重新执行完整校验和逐页渲染。
  OfficeCLI 只作为该 profile 的固定 adapter/runtime；统一 runtime lock 声明来源、下载上限、包内
  路径、file kind、执行策略与 smoke argv，target package manifest 在权限归一与平台签名后生成并
  校验 SHA、大小、目标 OS/架构和 mode。类 Unix 的 executable 固定为 `0755`，shared library/data
  固定为 `0644`，工作目录固定为 `0700`、暂存输入固定为 `0600`；magic discovery 只补漏并按 kind
  审计，不把所有 native 文件递归改成可执行；
- Work Ledger 的 Multica 导入入口先启动一个可见的 `advanced` Mission。Mission 通过其受限的
  `panel` 协调面读取完整 Multica Squad catalog；adapter 用精确 manifest ID 对 combined Registry
  投影权威 `installed` 状态，并对每个 Squad 读取官方 members endpoint，把完整成员列表归一化为
  catalog 的唯一 `members` 字段，禁止用上游截断的 `member_preview` 构造 mapping。Mission 使用原生
  `question` 的 `multiple: true` 交互展示全部 Squad；每个 option 以精确 Squad 名称作为人类可读
  `label`、以精确 Squad UUID 作为稳定 `value`，已安装项通过通用 Question option 的
  `disabled: true` 保持可见但不可选择，再为每个选中的未安装项创建一个
  `promptProfile: "squad-sdk"` 的独立 Task，并固定选择 `heterogeneous-import` workflow。Mission 独占选择与并行分发职责；
  每个 Task 只对请求中固定的一个 UUID 执行 catalog 证据校验、mapping、preview、修复和 import，
  不再向用户选择 Squad。项目级 `prompt_profile.active` 不因此改变，导入结果仍保持 inactive；
- `PromptProfileResolver` 是 production `skill` tool surface 的唯一投影者；SkillTool 只能从当前
  turn-resolved surface 精确加载名字，并在首次精确加载时物化 supporting files；加载后的相对
  supporting-file 路径仍由同一个 Skill-family tool 以精确 `name + file` 读取，并经过相对路径与
  realpath 包含校验。通用 project `read` 不获得 `projected-skills` cache bypass；
- command registry 不把 `Skill.all()` 自动注册成 slash command，因此不存在绕过 active profile
  或 agent grant 的第二条执行路径；
- built-in risk 根据描述符中的真实 script、agent、reference、template 和 asset 文件计算，不能把
  带可执行辅助文件的 Skill 宣告为 low-risk / script-free。

Personal Codex skills, local checklists, or historical task records may describe
how a developer once edited these packages, but they are not runtime authority
for expert-squad behavior. When they disagree with current code, tests, or
`specs/current/**`, current repository sources win.

### Mission Skills —— 独立目录与 Mission-only 编排面

Mission Skill 复用普通 Skill 的 `SKILL.md` definition、严格 identity、平台与工具 eligibility、
权限、模糊搜索、精确加载、supporting-file materialization 和结果渲染内核，但拥有独立 catalog：

- 项目来源固定为 `.opencorvus/mission-skills/<package>/SKILL.md`；
- user-global 来源固定为 `Global.Path.config/mission-skills/<package>/SKILL.md`；
- 随应用发布的 author source 位于 `src/mission-skill/builtin/**`，构建生成唯一
  `src/mission-skill/builtin-payload.ts`，精确加载时物化到独立 built-in cache；
- 三类来源按 frontmatter `name` 合并成严格 catalog，重复 identity 直接失败，不存在 precedence、
  alias 或 filename fallback；
- 共享 owner classifier 只把上述 project/user-global canonical root 内的文件归给 Mission Skill；
  普通 `Skill.all()` 即使扫描更宽父目录也不会吸收这两棵树，而非 canonical 的同名
  `mission-skills` 路径仍按普通 Skill 处理，不会落入无 owner 区域。

`mission_skill` 是 core registry 中的 deferred Skill-family tool，只由
`agent="mission"` 且 `session.kind="mission"` 的 native Mission turn 解析并绑定。Chat、Coding、
Control、Orchestrator、runtime-template worker、Expert Squad package Skill projection、`/skill/**`
与 Skill Manager 均不接收 Mission Skill catalog、prompt 或 tool surface。这里的不可访问是
capability isolation，不承诺对拥有通用 filesystem/process tool 的 Agent 提供原始文件保密。
每个 native Mission turn 都重新解析严格 catalog；若 Composer 读取后文件被删除、改名或变成
非法 definition，真实 `mission_skill` surface/load 会在执行面可见失败，不沿用旧目录快照。

Composer 的 `@mission("<exact-name>")` 与 `@squad("<manifest-id>")` 都是可见原子实体，
并在 Chat/session/task submission 之前直接调用现有 `POST /mission/wake`。Mission-Skill-only
请求不发送 `promptProfile`，继续继承 Mission 当前有效 Expert Squad；同时存在显式 `@squad`
时才发送该 manifest ID。原始可见文本原样成为 Mission user message，Mission 必须通过可见
`mission_skill` tool call 加载每个精确 Skill，再把 durable workflow commitments 写入既有
Mission state files。Mission Skill 不新增 active field、workflow state machine、自动推进或
Task-local squad switching；跨 squad 合作仍由 Mission 创建固定 `promptProfile` 的依赖阶段 Task。

Composer 的 Expert Squad 与 Mission Skill catalog 请求并行执行，但只有两者同时成功后才以一个
scope-keyed snapshot 发布。任一请求失败时 UI 显示同一个 catalog failure，不保留另一类资源的
partial snapshot；键入和菜单导航不发起网络请求。

随应用分发的唯一内置 Mission Skill 是 `general`。它只在用户精确选择
`@mission("general")` 后加载，并把用户定义的目标交给既有 native Mission 协议、Mission state 与
固定 profile Task 协调面；它不声明领域 workflow、Expert Squad 偏好、自动选择、隐藏状态、alias 或
fallback。项目与 user-global Mission Skill 继续通过同一严格 catalog 添加更具体的显式编排合同。

## Language Server Protocol removal

Language Server Protocol（LSP）子系统已删除：生产代码没有 LSP client、server supervisor、language catalog、
tool、permission、feature flag、Project state、Execution Capsule descriptor field 或公开 HTTP route。严格配置会拒绝
`lsp` 键，旧的 disable/experimental 环境变量不再存在。Session Message 继续拥有通用 `Range` 数据结构；该结构位于
`session/range.ts`，不代表或启动语言服务。保留的 VS Code protocol package 只允许作为其他产品依赖的传递依赖，
不得重新投影为 OpenCorvus LSP 能力。

## MCP —— Model Context Protocol

**代码**：`src/mcp/`

| 文件                                      | 作用                                            |
| ----------------------------------------- | ----------------------------------------------- |
| `index.ts`                                | MCP client 管理（连接、生命周期）               |
| `materialize.ts`                          | 把 MCP 工具实例化进 ToolRegistry / agent 上下文 |
| `auth.ts`                                 | MCP 鉴权                                        |
| `oauth-callback.ts` · `oauth-provider.ts` | OAuth 流                                        |

OpenCorvus 作为 client / host 接入外部或 package-scoped MCP server，并把 active projection
授予的工具暴露给 Agent。`mcp browser` 是内置浏览器 MCP 的独立 stdio 入口，Task 调度只使用
内部 projected-agent runtime。Browser MCP 的 Playwright Page 是浏览、截图、诊断和用户观看的唯一页面事实源。
`browser` 是该内置 provider 的保留 server identity：配置缺省时注入内置 local declaration，严格
`{ enabled: false }` override 可将其关闭；显式 typed declaration 只有 command 与当前内置 provider 精确一致时
才可调整 environment、timeout 或 enabled 等 local options。remote 或其他 local command 必须在配置解析时以
稳定的 `mcp.browser.type` / `mcp.browser.command` custom issue 拒绝，不能继承 Browser 的 connection ownership、
permission ledger 和 result materialization 语义，也不能被 host 静默替换。内部唯一
`configuredDeclaration` 以 `BrowserMCPConfigurationError` 表达原因；`Config.Info` 把它映射为上述 Zod issue，
配置文件 loader 再通过 `Config.InvalidError` 投影同一 issue，而不把内部 NamedError 作为公共配置错误冒充出去。

MCP OAuth callback broker 是本地 redirect 的唯一 finish 与 HTTP answer adapter。每个 data root 在
`mcp-oauth-callback-broker.json` 保存 mode-`0600` 的稳定 positive loopback port（1–65535）、随机 generation 与 proof secret；文件只描述
broker identity，不描述 OAuth flow。第一个 backend 绑定该 port，peer 通过随机 challenge 的 HMAC
（Hash-based Message Authentication Code，基于哈希的消息认证码）响应验证它确属同一 data root，并在 owner 退出后
重绑同一 port。peer probe/takeover 在每个 runtime 内 single-flight；identity handoff 会先停止旧 local server，再替换
runtime handle。listener 已 `unref`，因此复用它的 backend 正常存活时 callback 可达，而一次性 CLI 不会因 listener
悬挂。proof timeout、连接失败或 response body 读取失败是 `unreachable`，不是身份否定：若旧 port 仍被占用，peer 明确拒绝破坏性轮换；
收到完整 HTTP response 后，非 2xx、JSON/shape 解析失败或 generation/proof/HMAC 认证失败都把 owner 判为 `foreign`、选择新 port/generation 并结算旧 generation 的
pending flow。broker identity 或 generation settlement 的 atomic rename 若返回不确定结果，owner 重读 exact identity/flow facts；
一次 `unreachable` takeover refusal 不 retire 当前 peer monitor；只有 replacement 已成功 bind、publish identity 并结算 generation，
或显式 stop，才替换/退役原 runtime。短暂 stall 恢复后 monitor 继续验证同一 owner，owner 随后退出仍自动接管同一 URI。
proof 请求与响应都使用 `Connection: close`，runtime 退役则等待 `server.stop(true)` 完成；因此接管判断不会复用旧 owner 的
keep-alive 连接，显式 stop 返回时旧 listener 及其存量连接都已退出。
每条 ensure 路径在返回 binding 前重试 generation settlement。不同 data root 不共享 secret，因而不能把另一 root 的
listener 误认成自己的 broker。
port `0` 只允许作为进程内动态 bind 请求，不能发布为 durable identity；schema-valid broker 必须已经携带实际 listener port，
损坏 identity 以 typed parse failure fail closed，不 probe、bind 或结算其 generation。
每个 root 的 broker startup 也在进程内 single-flight，并登记在 stop owner 下；stop 与并发 stop 共享一个 settlement，递增 stop epoch，
等待 startup/peer takeover 后再次 retire 全部 runtime。任何跨越 stop epoch 才完成的 startup 都只返回固定 retired error，不能复活
listener 或 monitor；stop 完成后下一次显式 ensure 才能重新启动 broker。

`mcp-auth.json` 是 flow、PKCE（Proof Key for Code Exchange，授权码交换证明密钥）、dynamic client 与 credential 的唯一
事实源。pending state 同时绑定 authorize-time server URL、OAuth client credential identity、callback generation 与完整 redirect URI；dynamic client registration
使用独立的 client callback binding，不能被后来 state 写入伪装成已为新 URI 注册。callback broker 按 exact state 扫描
store，解析 canonical `projectID:mcpName`，从 SQLite Project owner 映射 worktree，再通过
`runWithInitializedIndependentProject` 进入该 Project；不扫描 active Instance，也没有 process-local Project authority
registration。升级前没有 generation 的 pending state/verifier/client facts 在首个 broker generation 下原子结算，token
与 static credential 保留。token commit 同时快照它实际使用的 dynamic client；broker rotation 可删除仅供未来 authorize
使用的旧 client registration，但 refresh token 仍使用该 token snapshot，直至 token set 本身被 invalidate。
每个 OAuth provider connection admission 都通过 store lock 为 absent 或 upgrade-era material entry 初始化一个 non-empty revision；
初始化不 supersede/clear flow，但此后所有 refresh/client/token writes 都携带该 exact revision。显式 remove 之后，已捕获的 legacy
refresh writer 不能以 `expectedRevision=undefined` 复活 credential。
OAuth provider 的 authority 显式分成 `connection` 与 `authorization`。普通 startup/admission 的 connection provider 只读取或
刷新已存在的 credential；没有有效 token 时在第一个 interactive SDK boundary 返回 `UnauthorizedError` 并投影 `needs_auth`，
不能 dynamic-register client、读写 state/PKCE verifier 或 redirect，也不能借用另一个 pending occurrence。只有显式 authorize、
finish 和用户主动运行的 OAuth debug probe 取得 authorization authority。connection refresh 记录本次 SDK attempt 实际读取的
token 与 selected client snapshot；save 以及 SDK 对 `tokens`/`client`/`all` 的 invalidation 都在 store lock 内比较 snapshot。
`clientInformation()` 与 `tokens()` 两次 SDK await 之间会在返回 refresh token 前重读 exact token、selected client 和 durable revision，
并再次验证 canonical Project MCP definition；same-value revision replacement 或配置提交都在任何远端 refresh side effect 前中止旧
attempt。callback 或另一 refresh 已提交新输入时，旧 attempt 不能向旧端点发送 token/client、覆盖或删除 winner。普通 `MCP.add`
不等待 callback broker，也不给 connection provider callback binding；broker maintenance 是 stop-tracked background work，因此有效 token 的
连接和 refresh 不依赖 callback listener 可达。authorization provider 不读取旧 token/token client；首个 broker generation 会在删除旧
client registration 前把 legacy `tokens + clientInfo` 快照为 `tokenClientInfo`，保留 refresh 所需的真实 client owner。

`finishAuthCallback` 在 spend 前先要求当前 canonical MCP definition 与 authorize-time server/client identity 精确一致；不一致时
通过 exact revision + state（finishing 时再含 owner）compare-and-swap 发布 terminal；若新 flow 已先取得 auth key，只读取旧 state
的 `superseded`，绝不撤销新 lease。不匹配的当前 occurrence 发布 `revoked` terminal，不构造 token transport。已进入 exchange 后，唯一 transport 仍从 durable authorize-time server/client
identity 与 redirect binding 构造；configuration 在途变化不能把旧 code、verifier 或 redirect URI 送往 replacement endpoint。
若 provider write/renew/reconnect identity fence 观察到 mismatch，已 spend occurrence 收敛为 `exchange_uncertain`；若 old endpoint
在 fence 再次运行前先返回网络或 exchange error，则收敛为固定 `failed`。每次 provider write 与 post-exchange connection
publication 都重新验证当前 identity。
`finishAuthCallback` 通过 credential store 内 compare-and-clear 的单次 spend 完成唯一 admission，并把 pending state
原子移动到随机 owner、credential revision 与 expiry 共同 fencing 的 `oauthFinishing` occurrence。live owner 在 exchange 和
post-auth connection 期间续租，每个 token write 也在 store lock 内验证 exact owner 与未过期 lease；broker 轮换不能改写
或清除 finishing occurrence 的 authorize-time generation、redirect、client 与 verifier。live finishing 阻止新 credential
lease；owner 消失或停顿越过 expiry 后只发布 `exchange_uncertain` 并清理 flow material，永不重放 authorization code。
成功、provider rejection、missing code、exchange failure、pending-generation rotation 与新 flow supersession 分别发布
exact-state durable callback terminal。terminals 是按 state 保存的 occurrence history，至少保留 24 小时；新 lease 不删除旧
terminal，pending 被替代时先发布 `superseded`。terminal publication 清理 finishing state/verifier/binding，但不复制
authorization code、token、provider error text 或其他 secret；tombstone 只额外保留当次非敏感 callback generation，使完成后、
Project 删除后到达的 HTTP duplicate 可由 `state + generation` 精确投影同一 terminal，而无需保留 spendable state。atomic write 的
不确定结果通过重读 exact state/outcome 收敛。
authorization-code token commit 也保存本次写入的 exact token/client/server/credential target；rename 后报错仅在 revision、live
finishing owner 与完整 target footprint 重读一致时视为成功。terminal publish 与 pending abandon 在 rename 前瞬时失败时，仅在
同一 revision 和 exact pending/finishing owner 仍 live 的边界内受限重试同一幂等 mutation；owner 或 outcome 改变时立即停止，
不会把本地成功/失败与 peer waiter 的 durable outcome 分裂。若 authorization server 已成功返回 token，但所有 token-store
pre-rename 写入均失败，唯一 occurrence 发布固定 `exchange_uncertain`，listener/local/peer 都拒绝重放 authorization code。
若 successful 或 failed exchange 的 terminal publication 在 exact owner 上耗尽全部有界重试，owner 停止续租并等待该 lease
到期，再由同一 `settleExpiredOAuthFinishing` owner 发布/读取 canonical `exchange_uncertain`；listener、local waiter、peer waiter
和 duplicate 不得先投影 process-local publication error。

同一进程的 OAuth owner、finish、terminal claim、interactive waiter 与 auth-key-to-state 索引都把 exact `Global.Path.root` 纳入 key；
相同 Project ID、MCP 名和 state 在两个 data root 中仍是两个独立 occurrence。一个 root 的 start/cancel/remove/finish 只能命中该 root
的内存 owner，并由该 root 的 durable credential store 与 callback generation 决定结果。

interactive `authenticate` 不再次 exchange authorization code。发起进程保留 process-local waiter fast path，同时按
`authKey + state` 观察同一个 durable callback terminal；callback 落到 peer broker 时，peer 完成 exchange/terminal write，
发起进程据此立即得到 connected 或固定 typed failure，而不是等待本地 Map timeout。`finishAuthCallback` 在同一 runtime
仍为精确 `authKey + state` 保持一个 in-flight operation：listener duplicate 与公开 SDK callback route 加入同一 Promise，
已进入 resolution 的 callback 通过 callback-owned receipt 穿过 live-map cleanup。命中 durable `finishing` 但没有本进程
operation 的 callback 不得重放 authorization code；它等待 live lease 的 durable terminal，lease 到期则原子发布并返回
固定 `exchange_uncertain` failure。只有 exact `connected` status 可发布成功；`disabled`、`disconnected`、`connecting`、
`failed`、`needs_auth` 与 `needs_client_registration` 都发布同一个固定 failed terminal，因此 listener 与 peer waiter 不会
对同一 exchange 得出不同结论。provider-controlled error description 与 process-local exchange exception 只作内部 cause；只要
durable terminal 已发布，listener response、local finisher、local waiter 与 peer waiter 都投影同一个固定 terminal message。
terminal poll 的 I/O rejection 被计数并在 waiter 边界转换为固定 durable-read failure，
不会形成 unhandled rejection。
`mcp debug` 复用 canonical streaming SDK authorization probe，不另建一套 provider 流程；它以 reject-pending admission 保留已有交互授权，
并在只读探测结束时按捕获 revision terminalize 自己未完成的 state/PKCE occurrence、撤销该 lease，保留允许复用的 dynamic client facts。
公开 SDK callback 入口遵循相同 join 规则：若 peer 已把 exact state 移入 `oauthFinishing`，本进程忽略 duplicate code 并等待
canonical terminal。若 durable state 的 scoped Project row 已删除，broker 以 exact occurrence CAS 结算：pending 发布 `revoked`，
finishing 发布 `exchange_uncertain`，并直接投影该 terminal；listener、本地 waiter 与 peer waiter 不等待 timeout。credential retirement 保留 terminal-only tombstone 时为每个 key
预生成新的 revision；atomic rename 的 ambiguous catch 只有重读到 exact absent/tombstone footprint 才能视为提交，旧 revision 不能
在 pre-rename failure 后复活 credential。Project 删除在 SQLite commit 前耐久发布唯一 v4 active cleanup manifest；commit 后同一个
cleanup owner 才在一个 auth-store lock/read/write 中选择并退役该 `projectID` 下全部 MCP auth keys，再清理 quarantine；key enumeration
不在 lock 外形成 TOCTOU window。同 Project 的 token/client/static/staged material 一并清除，
其他 Project 的同名 key 保持完整。退役 publication 对 exact pre-rename failure 有界重试；连续失败返回
`committed_with_residue` 并保留 active manifest，startup recovery 重试同一清理。active residue 关闭相同确定性 Project ID 的再准入，
避免新 generation 与旧 credential 共用 key；completed ledger 只重试旧 quarantine，不再退役 MCP credential，因而不能删除重建
Project 的新 token/client。已发布 v3 manifest 通过 fsync 完整新字节和 atomic write-through replace 一次性迁移为 v4；ambiguous
replace 重读 exact current fact，迁移后只有 v4 是当前事实。退役为仍活跃的 callback 保留上述 terminal tombstone。
Instance 初始化在公共 `Project.Info` 之外捕获不可复用的 SQLite Project-row generation。所有 project-scoped OAuth lease admission、
static credential stage/promote/rollback、reconcile invalidate/remove 与 stale-credential cleanup 都在 auth-store mutation 内复核 exact
Project ID、worktree 和该 generation；删除前先获 auth lock 的 writer 会被后续 prefix cleanup 包含，删除后或 same-ID 重建后的旧 Instance
writer 则在写入前被拒。Project deletion cleanup 是唯一不走该 ordinary admission fence 的 project-wide credential retirement owner。
`Instance.refresh` 原地切换 Project context 时同步替换这个 generation；刷新后的 context 可写入新 occurrence，而刷新前捕获的旧 writer
仍由 store 内 fence 拒绝。
OAuth callback 和 dynamic-client 日志只投影 correlation/presence 等固定字段；connection failure 只投影 endpoint presence，不记录 URL、
userinfo/query、provider query error、client id、token SDK error 或 broker proof material。已向远端披露 stored refresh token 后的
`UnauthorizedError` 属于固定 failed connection，不重新解释为首次 interactive `needs_auth`。
只有仍为 `pending` 的 provider rejection 和 missing-code callback 才能在一个 store write 中同时 abandon state/verifier 并
发布 terminal；若 code finish 在其后抢先 spend，先加入 callback receipt 捕获的同 runtime operation；若 peer process 已将 exact
state 移入 finishing，则等待 durable terminal，若 peer 已发布 terminal 则直接投影其真实 outcome。connected 与任一固定 failure
都不能被当前 provider-error/missing-code query 重新解释。interactive caller 观察 callback
rejection 后会 best-effort clear 仍由自己 revision 拥有的 pending state；若该 cleanup 本身失败，返回保留 callback error 为 cause
且同时携带 callback/cleanup errors 的 `AggregateError`。

本地运行默认连接用户已打开的稳定版 Google Chrome。BrowserRuntime 读取其默认 profile 发布的
`DevToolsActivePort`，经 Chrome DevTools Protocol (CDP) 连接 default context，并仅创建和关闭 MCP 自己的 Page。
若 Chrome 尚未授权，runtime 返回包含 `chrome://inspect/#remote-debugging` 的稳定操作指引，由用户在正在使用的
Chrome 中打开并勾选 “Allow remote debugging for this browser instance”；runtime 不会启动 Chrome 来打开该地址，
因为多 profile 环境会进入错误的 Profile Picker。它不会静默获得权限，也不会隐式降级到未登录浏览器。连接后
Browser MCP 复用当前 Chrome 的账号、Cookie、网站登录态和扩展；shutdown 只断开 Playwright 并关闭 MCP 自己的
Page，不关闭 Chrome、BrowserContext 或无关 tab。
已附着的 Chrome 可在页面内正常使用既有登录态，但 `storage_state_export` 不会导出 default context 的 Cookie
或 localStorage；需要导入或导出 storageState 时必须明确选择 MCP 自有的 `isolated` profile。

设置 `OPENCORVUS_BROWSER_MODE=isolated` 时，Browser MCP 通过同一个 BrowserRuntime 启动独立、未登录的系统
Chrome；桌面默认 headed 可见，无图形显示的 Linux 自动 headless，也可用 `BROWSER_HEADLESS=true` 显式选择。
该模式为明确配置而非 CDP 授权失败后的 fallback，profile 随进程结束，不承诺跨运行保存登录态。
Playwright launch 不注册自己的 `SIGHUP`、`SIGINT` 或 `SIGTERM` handler；当前 HTTP 或 stdio composition root 是
Browser Node 进程的唯一信号 owner。两种 root 都把外部信号、正常 transport/stdio 关闭和显式 close 收敛到同一个
幂等终态回执：停止接纳操作，尝试关闭当前 Page，等待已接纳操作，尝试关闭迟到 Page 和 profile，最后断开 browser
connection。每个安全阶段都要执行，Page/profile 关闭失败在 connection 断开后聚合上抛；仅全部成功时使用对应信号
退出码，任一清理失败统一退出 1。Browser resource 层不直接终止进程，也不安装异步 `exit` handler。

附着与独立是两个**浏览器身份**（不同 Cookie、不同登录态），不是同一能力的两个档次，所以跨越这条边界只能由调用方
显式声明，不能由 runtime 在 CDP 失败时代为决定：默认的 `OPENCORVUS_BROWSER_MODE=chrome` 在 Chrome 不可附着时以
具名错误失败并给出精确原因；只有 `OPENCORVUS_BROWSER_MODE=chrome_or_isolated` 表示操作者接受在另一个浏览器身份下
工作，此时才会退到独立浏览器，并在日志中记录所依据的策略与原因。

设置 `OPENCORVUS_BROWSER_CDP_ENDPOINT` 时，runtime 不再解析 Chrome channel 或 launch，而是经 Chrome DevTools Protocol
(CDP) 显式附着已有 Chromium 系浏览器的 default context，并只新建、关闭 MCP 自己的 Page；shutdown 只断开
Playwright transport，不关闭外部 Chrome 或其 BrowserContext。`session_create` 返回 `browserMode`、
`browserProduct` 和 session 绑定的 `liveViewUrl`；`browserMode` 为 `cdp` 或 `isolated`。stdio 与 HTTP transport 都在 loopback monitor 上投影同一
Page 的只读 Live View；Live View 不创建第二个 Browser、BrowserContext、Page 或可变状态，也不复用 Task
Browser Preview WebView。

直接 Chat/Work 为每个 Conversation Session 的 Browser 投影创建独立 scoped MCP connection owner，并在该 owner
下枚举 server 当前暴露的完整 model-visible tool 集合；切到 scoped owner 不得缩窄工具面。只有配置和 assignment
都接纳 Browser 后才创建 owner。Browser 的 Page、Cookie 和 storage 状态位于该 owner 持有的 Browser MCP 进程中，
Conversation disposal 会 await 该 owner 的 close 回执再完成，因此不需要在 Browser 内另建 Session tag、host 侧
销毁路由或 Project 共享的影子 owner。Computer takeover 只替换同 Conversation 的 Computer adapter owner；它不会
关闭 Browser owner，Browser 状态持续到 Conversation disposal。

### Computer Use

`default/mcp/computer` 是平台内置的 host-native Computer Use MCP，
不是 Expert Squad、Mission workflow 或 Browser 的别名。Browser 与 Computer 的已配置声明都只是 capability inventory；
直接 Chat/Work 的默认 MCP assignment 为空，Project 只有通过显式
`primary_assistant_capabilities.<agent>.mcp_server_refs` 才激活精确 provider。active Expert Squad 只能通过
Harness 中精确的 `default/mcp/computer/tool/*` refs 投影同一组平台工具。两种入口都保留相同的八个
`mcp_tool` identity 和四类 Session permission；Harness visibility 不授予 permission。

Conversation capability catalog 由唯一 `mcp-config` owner 一次发布 configured server 与当前精确投影的
MCP tool 完整集合，重复 owner 继续失败关闭。`tool` 与 `mcp_tool` 是不同 canonical kind；跨类型搜索使用
`next_owner_kinds:["call_tool"]`，禁止 generic source merge、kind alias 或隐藏扩展。显式 assignment
只决定能力投影，不替代 permission；server 与其 tool 必须在同一 snapshot 中一致为 `visible`。

每个 Conversation Session 拥有独立的 Computer scoped MCP connection owner；不同 Session 不共享
controller、CUA Driver logical session 或 observation authority，删除 Session 会关闭精确 owner，而 takeover 只关闭
Computer owner 并保留上文独立的 Browser owner。每次 `observe`
形成一个绑定 computer、display、observation、digest 与像素边界的单次 capability；动作在第一次异步
backend 调用前原子消费它。create、input 与 destroy 都是 effect operation，派发后响应丢失统一返回
`COMPUTER_OUTCOME_UNKNOWN`，不得 retry、reconnect replay 或切换 transport。

OpenCorvus 固定依赖并随应用分发 `@trycua/cua-driver`。Host 通过同进程 `CuaDriver.create()` 创建唯一 native
driver，不发现或启动 daemon、`PATH` executable、Python、Virtual Machine（VM，虚拟机）、guest image、viewer
或 cloud runtime。Windows 使用 Win32 与 UI Automation（UIA，用户界面自动化）；macOS 使用 Accessibility
与 Screen Recording 权限，权限归属签名后的 OpenCorvus application identity。产品不提供第二 runtime 或 fallback。

每个 scoped owner 在同一物理桌面上启动独立 CUA logical session。`session_create` 返回 host desktop、真实 display
与 driver version，不承诺虚拟机级进程、凭据或屏幕隔离。`observe` 直接返回当前桌面 PNG（Portable Network
Graphics，便携式网络图形）Attachment；click、text、key chord、point scroll 与 drag 通过 typed SDK 输入执行。
takeover 撤销当前 Agent run capability 并断开其 MCP adapter，桌面与 CUA session 继续存活且由用户直接操作；
return 生成不同的 run capability，新的 controller 必须先用可见 `session_create` 附着，再 `observe`。显式
destroy 只结束精确 logical session 并保留当前 adapter 建立下一会话的能力；Session disposal 结束精确 owner，
只有 host authority disposal 才关闭 application-owned driver。模型面仍只有八个工具，不存在
viewer tool、Browser WebView、文件轮询或 UI-only lifecycle source。

Multica Squad 导入复用同一 MCP client 与 package projection，不创建第二套运行时。mapping 为每个 source
Agent 显式声明 `base_role`；普通 routing Squad 使用 `{}` workflow 和 Task direct
dispatch，只有 source evidence 证明固定多阶段契约时才声明 workflow，禁止按 node 名称、label、member 顺序或
leader 身份推断 typed adapter。adapter 接受不含
credential、header、OAuth（Open Authorization，开放授权）、command 或 environment 的公开 remote
HTTP/SSE（Server-Sent Events，服务器发送事件）配置，并在 preview 阶段真实连接、遍历分页、精确读取
tools/prompts/resources。能力清单进入 source digest，import 会重新发现并拒绝漂移；生成声明归属于精确
Agent 的 `agents/<agent>/mcp/*.jsonc`，由 `package_mcp_server_refs` 和 `PromptProfileResolver` 单源投影。

结构完整、无 secret / remote 字段的 local process 声明只能先成为 typed repair candidate，仍然保持 blocker。
当 Agent 根据完整 source evidence 确认它是 browser automation capability 时，必须在同一 Task 内直接修复
mapping，不弹出“修复后导入 / 取消导入”Question；host 禁止用 command / server 名关键字推断语义。
修复后的 mapping 通过精确 source Agent 与 server identity 声明唯一的 `opencorvus-browser`
replacement，重新 preview 并把 target Browser MCP tool refs 同时绑定到 source / mapping digest；生成 package
只给相应 Agent 投影既有 `default/mcp/browser/tool/**`，不写入或执行原 command / args。redacted、带
credential/environment、畸形或语义未知的 local process，以及不可达、重复/空能力或分页异常的 remote MCP
仍然是 blocker，除非 mapping 用精确 source Agent/server 元组和非空 evidence reason 显式声明该单一 MCP
不进入 target projection；该 omission 进入 source/mapping digest、preview、README 和最终报告。redacted 配置没有
可验证 server identity，不能使用 omission。禁止 generic ignore、静默丢弃、host 自动推断替换、导入 Multica
PAT（Personal Access Token，个人访问令牌）或把 MCP credential 写入 package。Human member 与 archived source
entity 只作为 roster/runtime provenance 记录，不成为 OpenCorvus worker，也不单独阻止 package materialization。

Multica 生成 package 时复用 `@opencorvus-ai/sdk/expert-squad-authoring` 的唯一 writer，不手写第二套
manifest/目录 materializer。导入 source `updated_at` 的日期表示该 source revision 日期，首次生成的
OpenCorvus package version 为 `YYYY.MM.DD.1`；source digest 仍是 preview/import freshness authority。
mapping 不创建、映射或引用 `universal-build`，该能力由 runtime scheduler projection 独立提供。Task
Artifact 的 `artifact_search` / `artifact_read` / `artifact_select` 由 runtime 投影给继承 base tools 的 scheduler 和所有 worker；
明确设置 `inherit_base_tools: false` 的 scheduler 只获得 manifest 在 `built_in_tool_ids` 中显式声明的 Tool，
需要 Artifact catalog 时必须显式列出相应平台 Tool，runtime 不在 resolved projection 后追加隐藏 Tool；
consumer 必须先完整精确读取，再对 typed output 的每个语义来源调用 `artifact_select`。完整但未选择的读取只进入
`observed_artifact_locators`，成功选择的来源进入 `source_artifact_locators`，且 source 必须是 observed 的子集；
零选择与缺省可选字段均合法。即时 `artifact_publish` 显式提交本次发布专属的
`source_selection_refs`；Host 只从同一 Session、同一物理 Turn 中更早的持久化选择恢复完整 canonical
`source_artifact_locators`，因此一个 Turn 的多次发布不会互相污染。模型 transport 不重复提交 locator 结构。
`artifact_search` 的 opaque pagination cursor 由当前 runtime 使用进程随机 HMAC-SHA-256 authority 签发；cursor
携带的 frozen revision、membership、provider state、total 与 position 在验证前均不可信。runtime restart 会使旧 cursor
明确失效，caller 必须从第一页重新开始；不保留 unkeyed checksum decoder 或跨 runtime fallback。
`artifact_snapshot` 投影给继承 base tools 或显式声明它的 scheduler，并继续投影给所有 worker；`artifact_publish` 只投影给 worker；
Multica mapping、prompt 和 Skill 不遮蔽或复制这些平台工具及 Artifact body，非继承 scheduler 的 manifest 显式声明本身就是唯一 capability source。
`artifact_snapshot` 返回内容寻址的 `resource_set`，并为 snapshot 与每个 resource
返回 Host-minted `artifact_locator_ref`。其模型输入由冻结 runtime contract 投影：scheduler 与没有精确 Build `merge_back` 私有 stage surface 的普通
worker 只获得当前主项目 `files`；只有该 managed Build surface 获得必填 `source_commit`，且 Host 再次校验它等于最近完成 merge 的
`primary_head`。schema 收窄不替代执行权限校验。
后续 Session 的 `artifact_search` 从同一个已验证 snapshot record 确定性投影一个 parent snapshot entry 和逐资源
分页的 `task_artifact_resource` entries。consumer 把 search/snapshot 返回的 `artifact_locator_ref` 交给 `artifact_read`，再把完整读取返回的
`artifact_read_ref` 交给 `artifact_select`；Host 从同 Turn 持久化 Tool facts 恢复 canonical locator，不按 path、label 或当前 catalog 猜测，
模型也不手工重构 path、bytes 或 SHA-256。publisher 仍只接收
紧凑 `resource_set`；完整 refs 由 `TaskArtifactHost.resources` 在可信 Host 边界内验证并按 UTF-8 字节路径顺序展开，不把整组 refs 作为发布
输入重复传输。面向模型的
`artifact_publish` 应用二进制接口（Application Binary Interface，ABI）只接受对象键唯一的严格 JSON 文本
`payload_json`，并要求无文件时显式传 `resource_set: null`，避免 provider schema 暴露递归动态 record 或
随资源数量增长的结构化输出；
Host 只解析一次并把结构化 `payload` 交给与 Plugin ToolHost `engineArtifacts.publish` 相同的
`publishExpertArtifact` authority，两条入口只有 transport 不同。跨 Task 导入在 `import_lineage.source_provenance`
保留源 Artifact 的原始 observed/source provenance；导入 envelope 自身的 observed/source 仍是目标 Task 本地事实。
workflow dependency 只表达 evidence
topology。生成包 README 记录 source 与
mapping digest；导入的 Agent instruction、完整 Skill directory 和 MCP 声明是不可变快照，不是后台同步源。

Expert Squad catalog refresh token 是 Overlay 唯一的目录失效信号。Overlay 自己执行的 install / import /
update / uninstall 在写成功后直接推进它；Task 内执行的 Multica 等 package 写入不经过这些 UI service，因此由
全局 task-list SSE（Server-Sent Events，服务器推送事件）的 `task.completed` / `task.failed` /
`task.cancelled` 终态通知推进同一个 token。这样 Task 快速完成、未被选中或当前页面没有经历 busy→idle
采样时，安装结果仍会立即进入所有 catalog consumer，不存在第二份 installed shadow state。

## ACP —— Agent Client Protocol

**代码**：`src/acp/`

- 外部编辑器（Zed 等）通过 ACP 协议调用 OpenCorvus
- 编辑器扮演 client，OpenCorvus 扮演 agent
- 与 `ChannelIngress` / `ControlMessage` 并列为入站入口之一（见 [03-control.md](03-control.md)）

文件：`agent.ts` · `session.ts` · `types.ts`（README 存于目录内）。

## Public Market runtime

公共网站的 Expert Squad Market 已不再由构建期 TypeScript 清单或本地文件系统 simulation 提供运行时数据。生产 Market、详情、Registry API 与健康检查以单一 active SQLite publication 为事实源，ZIP 使用 release 外的不可变内容寻址 blob；签名目录仍只承担桌面批量安装的信任合同。完整服务、签名、部署、回滚和灾备边界见 [public-website.md](public-website.md)。

## 常见误区

1. **"Codex Provider plugin 会把 Codex 变成 Task runtime 吗？"** — 不会。Provider plugin 只负责
   ChatGPT 订阅认证与当前进程内的流式模型调用。
2. **"MCP 能不能替代 plugin？"** — 理论上可以，实际上 plugin 更紧耦合（in-process 调用，类型共享），MCP 是远程协议（有序列化开销 + 权限/鉴权流）。
3. **"Task 怎么选择运行身份？"** — active expert-squad 的
   `capability_projection.agents.<projection_id>` 是动态 Agent 身份；`base_role` 只选择 runtime template seed。

## 相关文档

- [task-control-plane.md](task-control-plane.md) — Orchestrator 如何通过 tools 调度动态 Agent
- [03-control.md](03-control.md) — ACP 作为入站入口与 channel/control 的关系
- [06-provider.md](06-provider.md) — LLM Provider（另一条独立扩展轴）
