# OpenCorvus 代码结构说明

本文档基于当前仓库源码、`package.json` workspace 配置、README 和 `docs/packaging.md` 整理，用于快速理解本代码仓的模块边界。

## 1. 仓库总体定位

OpenCorvus 是一个面向 AI 编码代理的开发编排工具。它把用户任务转换为需求、目标、构建执行、证据复核和迭代修正流程，并提供多种使用入口：

- Headless HTTP API（由 `opencorvus serve` 提供）。
- CLI 命令行入口（任务、会话、鉴权、模型、调试、导入导出等）。
- Overlay 桌面 UI（Solid.js + Tauri）。
- 多渠道运行时（Slack、Telegram、Discord、Feishu 等聊天渠道适配）。
- JavaScript SDK、插件接口、专家团/技能扩展包。

仓库是 Bun workspace + Turborepo monorepo，根 `package.json` 声明 `packageManager: bun@1.3.14`，workspace 覆盖 `packages/*` 和 `packages/sdk/js`。

## 2. 顶层目录

| 路径 | 功能 |
| --- | --- |
| `packages/` | 主要源码包。核心服务、Overlay UI、SDK、插件协议、渠道运行时、文档站都在这里。 |
| `script/` | 根级工程脚本，负责打包矩阵、版本同步、发布资产校验、缓存清理、统计和诊断。 |
| `docs/` | 仓库级工程文档。当前重点文档是 `docs/packaging.md`，描述 CLI、Overlay、Linux bundle、容器和发布 CI 的包形态。 |
| `expert-squads/` | 可安装或内置的专家团包，如 frontend replica、research studio 和 review debug 等。 |
| `github/` | GitHub Action 集成说明和相关入口。 |
| `.github/` | GitHub CI/CD workflow。`build.yml` 是 canonical GUI release 流程。 |
| `assets/` | README、站点或产品展示资产。 |
| `patches/` | Bun patchedDependencies 使用的依赖补丁。 |
| `nix/`, `flake.nix`, `flake.lock` | Nix 开发/构建环境相关配置。 |
| `.husky/` | Git hook 配置。 |
| `bun.lock` | Bun 锁文件。 |
| `turbo.json` | Turborepo 任务图。当前定义 `typecheck`、`build` 和 `opencorvus#test`。 |

## 3. Workspace Packages

| Package | 路径 | 功能 |
| --- | --- | --- |
| `opencorvus` | `packages/opencorvus` | 核心 CLI、HTTP server、任务引擎、编排器、LLM provider、工具池、持久化、专家团投影、浏览器预览、插件运行时和打包脚本。 |
| `@opencorvus-ai/overlay` | `packages/overlay` | 桌面 Overlay UI。前端使用 Solid.js/Vite，原生壳使用 Tauri/Rust。 |
| `@opencorvus-ai/channel-runtime` | `packages/channel-runtime` | 多聊天渠道运行时，将 Slack/Telegram/Discord/Feishu/Teams 等消息接入 OpenCorvus 任务或会话。 |
| `@opencorvus-ai/channel-config` | `packages/channel-config` | 渠道配置 schema 和解析入口，依赖 Zod。 |
| `@opencorvus-ai/sdk` | `packages/sdk/js` | JavaScript SDK。封装客户端、服务端启动、OpenAPI 生成客户端、默认配置、专家团 authoring 类型等。 |
| `@opencorvus-ai/plugin` | `packages/plugin` | 插件开发接口。提供 tool、artifact catalog、task artifact、project path、webpage evidence 等协议类型和 helper。 |
| `@opencorvus-ai/transport-protocol` | `packages/transport-protocol` | OpenCorvus server、desktop host、browser overlay 和测试共享的传输协议契约。 |
| `@opencorvus-ai/util` | `packages/util` | 通用工具函数，如二进制路径、错误类型、lazy、node runtime、slug 等。 |
| `@opencorvus-ai/script` | `packages/script` | 小型共享脚本工具包，目前导出 `src/index.ts` 和版本辅助。 |
| `@opencorvus/web` | `packages/web` | OpenCorvus 公共文档站，使用 Astro + Starlight。产品文档位于 `packages/web/src/content/docs/**`。 |

## 4. 核心包 `packages/opencorvus`

### 4.1 入口与 CLI

| 路径 | 功能 |
| --- | --- |
| `src/index.ts` | 主 CLI 入口。安装运行时 shim，初始化日志和 capability preflight，并通过 `yargs` 注册命令。 |
| `src/launcher.ts` | 启动器相关入口。 |
| `src/overlay-launcher.ts` | Overlay server sidecar 使用的入口。 |
| `src/overlay-server.ts` | Overlay 绑定服务端入口。 |
| `src/cli/cmd/*` | CLI 子命令：`run`、`serve`、`auth`、`doctor`、`models`、`mcp`、`github`、`pr`、`session`、`db`、`import/export`、`upgrade/uninstall` 等。 |

### 4.2 HTTP Server 与 API

| 路径 | 功能 |
| --- | --- |
| `src/server/server.ts` | Server 装配核心。 |
| `src/server/routes/*` | HTTP 路由。覆盖 app、auth、browser-preview、channel、config、conversation、expert-squad、file、mission、orchestrator、panel、permission、plugin、project、provider、pty、session、skill、terminal、work-ledger 等。 |
| `src/server/sse.ts` | Server-Sent Events 事件流支持。 |
| `src/server/overlay-ui.ts` / `overlay-ui-embedded.generated.ts` | Overlay UI 静态资源服务与嵌入资源。 |
| `src/server/project-route-context.ts` | 项目目录上下文解析，用于 project-scoped API。 |
| `src/task-api/*` | 任务创建、任务根消息、全局任务服务和调用方元数据。 |

### 4.3 任务引擎与持久化

| 路径 | 功能 |
| --- | --- |
| `src/engine/*` | 任务、目标、run、artifact、interaction、event log、queue、pipeline、状态投影、取消、工作区导出、跨 task artifact import 等核心业务模型。 |
| `src/engine/engine.sql.ts` | 引擎 SQL 定义或 SQL 片段。 |
| `src/storage/*` | SQLite 存储封装、DDL、schema、attachment store、MySQL transfer。 |
| `src/bus/*` | 运行时事件总线。 |
| `src/decision-log/*` | 编排决策日志。 |
| `src/timeline/*` | 时间线/事件呈现相关模型。 |

### 4.4 编排器与 Agent 运行时

| 路径 | 功能 |
| --- | --- |
| `src/orchestrator/*` | 编排主循环和阶段工具。包含需求阶段、架构阶段、研究、前端研究/设计、构建、完整性复核、视觉 QA、任务生命周期工具、读上下文/读消息工具、dispatch 工具等。 |
| `src/agent/*` | Agent 身份、runtime template、tool pool、prompt profile、动态 agent、session runtime、权限、原生 agent 注册和投影模型。 |
| `src/scheduler/*` | 调度相关逻辑。 |
| `src/delegated-worker/*` | 委托 worker 执行模型。 |
| `src/requirements/*`, `src/architect/*`, `src/goal/*` | 需求、架构、目标建模相关域逻辑。 |
| `src/integrity/*`, `src/visual-qa/*`, `src/verification/*`, `src/evidence/*` | 验证证据、完整性判断、视觉检查证据和验收相关逻辑。 |

### 4.5 LLM、Provider 与 Prompt

| 路径 | 功能 |
| --- | --- |
| `src/provider/*` | LLM provider 配置、鉴权、模型 schema、vendor adapter、DashScope discovery、sampling、strict tool schema 等。 |
| `src/llm/*` | LLM API 包装、prompt budget、JSON repair、tool hooks、活动记录。 |
| `src/prompt/*` | prompt 构造与投影。 |
| `src/config/*` | OpenCorvus 配置读取、合并和更新。 |

### 4.6 工具、执行与开发环境操作

| 路径 | 功能 |
| --- | --- |
| `src/tool/*` | Agent 可调用工具注册表与具体工具实现。包含 shell、apply_patch、read/write/edit、grep/glob/ls、webfetch/websearch、browser preview、panel、memory、question、todo、plugin tool host、artifact 工具等。 |
| `src/shell/*`, `src/pty/*`, `src/system-terminal/*` | Shell/PTY/终端执行面。 |
| `src/file/*`, `src/patch/*`, `src/worktree/*`, `src/workspace/*` | 文件、补丁、worktree 和工作区生命周期。 |
| `src/browser/*`, `src/browser-preview/*` | Browser Preview、截图/布局证据、target、viewport、region comparison、dev-server 命令等。 |
| `src/mcp/*` | MCP 鉴权、OAuth callback、materialize、provider 接入。MCP 是 Model Context Protocol，用于外部工具/资源协议。 |
| `src/acp/*` | ACP 相关实现。ACP 是 Agent Client Protocol，用于 agent client 交互协议。 |
| `src/lsp/*` | LSP 支持。LSP 是 Language Server Protocol，用于语言服务能力。 |

### 4.7 产品域与扩展

| 路径 | 功能 |
| --- | --- |
| `src/expert-squad/*` | 专家团注册、manifest、resolver、内置 general 专家团等。 |
| `src/mission/*`, `src/mission-skill/*` | Mission 和 Mission Skill 运行模型，用于多阶段/跨专家团任务组织。 |
| `src/skill/*` | 内置技能、技能加载和技能投影。 |
| `src/plugin/*` | 插件管理和运行时接入。 |
| `src/capability/*` | 能力目录、搜索和 preflight。 |
| `src/panel/*`, `src/gui/*`, `src/workbench/*` | Overlay/Panel 展示模型、workbench board/brief 等 UI 数据投影。 |
| `src/channel/*` | 渠道接入相关服务端域。 |
| `src/memory/*`, `src/quicknote/*`, `src/share/*` | 记忆、quick note 和共享能力。 |
| `src/task-artifact/*`, `src/artifact-catalog/*`, `src/interactive-artifact/*` | 任务产物、产物目录、交互式产物。 |
| `src/work-ledger/*`, `src/work-office/*` | 工作台 ledger 和办公文档/演示相关能力。 |

### 4.8 核心包脚本与测试

| 路径 | 功能 |
| --- | --- |
| `packages/opencorvus/script/build.ts` | Bun compile 主构建脚本，支持 CLI 和 `--overlay-server` 两种 flavor。 |
| `packages/opencorvus/script/build-targets.ts` | 构建目标过滤逻辑。 |
| `packages/opencorvus/script/build-artifact.ts` | artifact 命名、入口、外部模块、native runtime 规则。 |
| `packages/opencorvus/script/docs/render-api-md.ts` | 从路由元数据生成 API 文档。 |
| `packages/opencorvus/test/**` | 核心包非 UI 单元/契约测试、fixture、脚本测试。 |

## 5. Overlay 桌面 UI `packages/overlay`

Overlay 是用户可见桌面端，前端为 Solid.js，原生容器为 Tauri 2。

| 路径 | 功能 |
| --- | --- |
| `src/main.tsx` | Solid 应用入口。挂载 Overlay root，初始化设置、主题、SSE、工作区、任务/会话选择、右侧 dock、浏览器预览、composer 等。 |
| `src/components/` | UI 组件。包含 conversation、board、composer、work ledger、file explorer/diff/editor、browser preview、mailbox、right dock、settings、基础 UI primitives 等。 |
| `src/services/` | 前端服务层。封装 API、SSE、任务、mission、conversation、workspace、browser preview、terminal、config、diagnostics、theme、native transport 等。 |
| `src/store/` | Solid store 状态。覆盖 app、board、messages、settings、right dock、conversation UI 等。 |
| `src/i18n/` | 国际化资源。 |
| `src/styles/` | CSS 样式与设计 token。 |
| `src-tauri/` | Tauri 原生壳。含 Rust 源码、Cargo 配置、Tauri 配置、图标、资源、build.rs。 |
| `script/build-overlay.ts` | 开发者本地完整 Overlay 构建：i18n check、Vite build、SDK rebuild、overlay-server build、Tauri no-bundle。 |
| `script/build.ts` | Release Overlay 构建：构建 sidecar、Vite、清理资源并生成平台 installer/bundle。 |
| `script/build-docker.ts` | Linux Overlay Docker 构建。 |

## 6. Channel Runtime `packages/channel-runtime`

该包把外部聊天渠道消息接入 OpenCorvus server。

| 路径 | 功能 |
| --- | --- |
| `src/main.ts` | 运行时入口。加载 bundled env、DashScope runtime、OpenCorvus 配置、STT/Vision pipeline，然后注册各渠道 adapter 并启动 runtime。STT 是 Speech-To-Text，负责语音转文本。 |
| `src/index.ts` | 库导出入口，导出 ChannelRuntime、adapter 类型和各渠道 adapter。 |
| `src/core.ts` | ChannelRuntime 核心协调逻辑。 |
| `src/adapters/*.ts` | 渠道适配器：Slack、Telegram、Discord、Feishu、WhatsApp、Google Chat、Microsoft Teams、Line、Matrix、Mattermost、Signal、WeCom、DingTalk 等。 |
| `src/stt/` | 语音转文本 pipeline、限制和 provider setup。 |
| `src/vision.ts` | 图像/视觉输入处理 pipeline。 |
| `src/registry.ts` | 渠道 adapter 注册与 ready/planned 渠道声明。 |

## 7. SDK、Plugin 与共享协议

### JavaScript SDK `packages/sdk/js`

| 路径 | 功能 |
| --- | --- |
| `src/client.ts` | OpenCorvus HTTP client 封装。 |
| `src/server.ts` | 从 SDK 启动 OpenCorvus server 的 helper。 |
| `src/index.ts` | 统一导出，并提供 `createOpenCorvus()` 同时创建 server 和 client。 |
| `src/gen/` | OpenAPI 生成客户端代码。 |
| `src/expert-squad-authoring.ts` / `expert-squad-manifest-v1.ts` | 专家团 authoring 和 manifest 类型。 |
| `script/build.ts` | SDK 生成/构建脚本。 |

### Plugin Package `packages/plugin`

| 路径 | 功能 |
| --- | --- |
| `src/index.ts` | 插件包主导出。 |
| `src/tool.ts` | 插件工具定义协议。 |
| `src/artifact-catalog.ts` | 插件产物目录协议。 |
| `src/task-artifact.ts` | 任务产物 helper。 |
| `src/project-path.ts` | 项目路径协议/工具。 |
| `src/webpage-evidence.ts` | 网页证据相关类型。 |

### Shared Packages

| Package | 功能 |
| --- | --- |
| `packages/transport-protocol` | 共享 transport contract，服务端、桌面 host、browser overlay 和测试共同使用。 |
| `packages/channel-config` | 渠道配置 schema。 |
| `packages/util` | 通用基础工具和错误类型。 |
| `packages/script` | 脚本共享 helper。 |

## 8. Web Docs `packages/web`

这是公共文档站，使用 Astro + Starlight。

| 路径 | 功能 |
| --- | --- |
| `src/content/docs/**` | 产品文档内容单一来源。 |
| `src/pages/` | Astro 页面。 |
| `src/components/` | 文档站组件。 |
| `src/i18n/` | 文档站国际化资源。 |
| `config.mjs` | Starlight/Astro 站点配置。 |

## 9. Expert Squads

`expert-squads/` 存放项目级专家团 package。每个专家团通常包含：

- `expert-squad.jsonc`：manifest，声明唯一 ID、能力投影、agent、skills、tools 等。
- `README.md`：专家团说明。
- `selector.md`：选择该专家团的说明。
- `agents/**/system.md`：agent system prompt。
- `skills/**/SKILL.md`：专家团私有技能。

当前可见分区包括：

| 路径 | 功能 |
| --- | --- |
| `expert-squads/builtin/frontend-replica` | 前端复刻专家团。 |
| `expert-squads/builtin/frontend-innovate` | 前端创新/生成专家团。 |
| `expert-squads/builtin/research-studio` | 研究写作与事实核查专家团。 |
| `expert-squads/builtin/review-debug` | 审查与调试专家团。 |

核心包内还带有 `packages/opencorvus/src/expert-squad/builtin/general`，这是运行时默认 general 专家团。

## 10. 构建、打包与发布脚本

根 `script/` 负责跨包构建和发布流程：

| 脚本 | 功能 |
| --- | --- |
| `package-native-binary.ts` | 构建当前主机 native CLI bundle，并归档。 |
| `package-binary-matrix.ts` | 执行当前主机可验证的 CLI 打包矩阵。 |
| `package-gui-installer-matrix.ts` | 构建当前主机 GUI installer row，并输出到 `packages/overlay/dist-artifacts/<platform>/`。 |
| `package-linux-binary.ts` | 在 Linux x64/WSL 上构建 Linux single binary 和 baseline bundle。 |
| `package-local.ts` | 本地聚合打包：overlay-server、当前平台 overlay、Docker Linux overlay。 |
| `sync-version.ts` | 同步 release family 版本，源头是 `packages/opencorvus/package.json`。 |
| `check-release-assets.ts` / `release-asset-contract.ts` | 校验 release artifact 命名和必需文件。 |
| `check-sdk-imports.ts` / `check-ai-runtime.ts` | 根 typecheck 前置校验。 |
| `clean-cache.ts`, `clean-nul-files.ts` | 清理缓存和异常 NUL 文件。 |
| `secret-scan.ts` | Secret scan 工具。 |
| `stats.ts`, `inspect-*.ts` | 本地诊断和统计脚本。 |

主要打包产物：

| 产物 | 输出 |
| --- | --- |
| Native CLI bundle | `packages/opencorvus/dist/opencorvus-<platform>/` 和同目录 archive。 |
| Overlay server sidecar | `packages/opencorvus/dist/opencorvus-overlay-server-<platform>-<arch>/`。 |
| GUI installer | `packages/overlay/dist-artifacts/<platform>/`。 |
| Tauri native bundle | `packages/overlay/src-tauri/target/release/bundle/`。 |
| Linux single binary | `packages/opencorvus/dist/binary/opencorvus-linux-x64/`。 |

## 11. 运行时主流程

典型任务流如下：

1. 用户从 CLI、HTTP API、Overlay UI 或聊天渠道提交请求。
2. Server route 或 channel runtime 创建 task/conversation/mission。
3. `task-api` 写入任务根消息并唤醒 engine queue。
4. `engine` 维护任务、目标、run、artifact、事件和状态。
5. `orchestrator` 根据当前上下文调用需求、架构、研究、构建、复核等阶段工具。
6. `agent` 层根据 prompt profile、专家团和能力投影 materialize 运行时 agent。
7. `tool` 层执行文件、shell、浏览器、panel、插件、MCP 等工具。
8. `storage` 持久化所有任务、消息、证据和产物。
9. Overlay 通过 API 和 SSE 拉取状态，把任务板、对话、文件变化、浏览器预览和证据展示给用户。
10. 完整性/视觉/验证证据达标后，任务进入接受或完成状态；否则继续修正迭代。

## 12. 阅读入口建议

如果要继续深入代码，建议按下面顺序读：

1. `README.md`：产品目标和使用方式。
2. `docs/packaging.md`：构建/打包产物和 release 边界。
3. `packages/opencorvus/src/index.ts`：CLI 入口。
4. `packages/opencorvus/src/server/routes/orchestrator.ts` 和 `src/task-api/*`：任务 API 入口。
5. `packages/opencorvus/src/engine/task.ts`, `queue.ts`, `pipeline.ts`：任务生命周期核心。
6. `packages/opencorvus/src/orchestrator/loop.ts` 和各 stage/tool 文件：编排主循环。
7. `packages/opencorvus/src/agent/*`：agent runtime、prompt profile 和工具池。
8. `packages/overlay/src/main.tsx`：桌面 UI 状态和交互入口。
9. `packages/channel-runtime/src/main.ts`：多渠道接入入口。
