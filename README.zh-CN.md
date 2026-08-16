<p align="center">
  <img src="assets/readme-head.png" alt="OpenCorvus" width="440" />
</p>

<h3 align="center">开源多 Agent Harness 平台</h3>

<p align="center">
  <strong>开箱即用的完整 Harness —— 而每一层都可以由你重建。</strong>
</p>

<p align="center">
  <a href="https://github.com/yangheng95/opencorvus/releases"><img alt="最新版本" src="https://img.shields.io/github/v/release/yangheng95/opencorvus?include_prereleases&sort=semver&style=for-the-badge&label=release&color=2946d3" /></a>
  <a href="./LICENSE"><img alt="许可证" src="https://img.shields.io/github/license/yangheng95/opencorvus?style=for-the-badge&color=2946d3" /></a>
  <img alt="项目状态：Beta" src="https://img.shields.io/badge/status-beta-e04b22?style=for-the-badge" />
  <a href="https://github.com/yangheng95/opencorvus/actions/workflows/typecheck.yml"><img alt="类型检查" src="https://img.shields.io/github/actions/workflow/status/yangheng95/opencorvus/typecheck.yml?branch=main&style=for-the-badge&label=typecheck" /></a>
  <a href="https://github.com/yangheng95/opencorvus/actions/workflows/codeql.yml"><img alt="CodeQL" src="https://img.shields.io/github/actions/workflow/status/yangheng95/opencorvus/codeql.yml?branch=main&style=for-the-badge&label=codeql" /></a>
</p>

<p align="center">
  <a href="https://opencorvus.com/zh-cn/"><img alt="文档" src="https://img.shields.io/badge/docs-opencorvus.com-111310?style=for-the-badge&logo=readthedocs&logoColor=white" /></a>
  <a href="https://bun.sh"><img alt="运行时：Bun" src="https://img.shields.io/badge/runtime-Bun%201.3-111310?style=for-the-badge&logo=bun&logoColor=white" /></a>
  <img alt="87 个模型供应商" src="https://img.shields.io/badge/model%20providers-87-2946d3?style=for-the-badge" />
  <img alt="119 个专家团" src="https://img.shields.io/badge/expert%20squads-119-2946d3?style=for-the-badge" />
  <img alt="13 个聊天渠道" src="https://img.shields.io/badge/chat%20channels-13-2946d3?style=for-the-badge" />
</p>

<p align="center">
  <a href="./README.md">English</a> | <strong>简体中文</strong>
</p>

<p align="center">
  <a href="https://opencorvus.com/zh-cn/">官方网站</a> ·
  <a href="https://opencorvus.com/zh-cn/start/quickstart/">快速开始</a> ·
  <a href="https://opencorvus.com/zh-cn/download/">下载</a> ·
  <a href="https://opencorvus.com/zh-cn/market/">专家团</a> ·
  <a href="https://opencorvus.com/zh-cn/mission/">Mission</a> ·
  <a href="https://opencorvus.com/zh-cn/use-with-agents/">Agent 接入</a>
</p>

---

**Agent Harness** 是把模型变成 Agent 的运行层：循环、工具路由、上下文管理、记忆、
权限执行与故障恢复。多数项目只给你一个框架，剩下的自己搭。

OpenCorvus 直接交付一套已经组装好的 Harness。安装之后你立刻拥有：覆盖五个主要角色的
流式 Agent 循环、42 个内置工具、87 个模型供应商、持久化的权限授权、项目与会话记忆、
自动上下文压缩、可在重启后恢复的编排，以及包含 119 个可检查专家团的目录 —— 首次启动
即可运行。

而下面的每一层都是配置面：换模型、收窄工具集、收紧权限规则、替换整支专家团，或者
直接用 SDK 驱动整个 Harness。

<table>
  <tr>
    <td width="50%"><img src="packages/web/src/assets/lander/harness-gallery/work-harness.png" alt="OpenCorvus Work Harness" /></td>
    <td width="50%"><img src="packages/web/src/assets/lander/harness-gallery/mission-composer.png" alt="OpenCorvus Mission 输入区" /></td>
  </tr>
  <tr>
    <td><strong>Work</strong> 把长篇交付与复核界面留在一起。</td>
    <td><strong>Mission</strong> 把同一份可见上下文变成责任清晰的协同工作。</td>
  </tr>
</table>

> [!IMPORTANT]
> OpenCorvus 仍在开发。本 README 只描述当前仓库已有能力。输出质量取决于所选模型、
> 可访问的数据源、已安装能力和本次运行取得的证据。无人值守任务只会在本地或托管的
> OpenCorvus 运行时在线时执行。

## 首次启动即可运行

| 能力           | 内置内容                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| **模型供应商** | 从一个内置目录解析 87 个供应商、2,579 个模型，并支持本地运行时。                                                |
| **工具**       | 42 个内置工具，浏览器与计算机控制作为默认能力块提供。                                                           |
| **专家团**     | 公开目录中共 119 个 —— 4 个已内置可直接使用，115 个可导入。                                                     |
| **Agent 角色** | 五个主要角色：`coding`、`chat`、`work`、`control`、`mission`。                                                  |
| **聊天渠道**   | Slack、Discord、Telegram、飞书、钉钉、企业微信、WhatsApp、Line、Signal、Matrix、Mattermost、Microsoft Teams、Google Chat。 |
| **接入界面**   | 桌面应用、带服务器发送事件（SSE）的 HTTP API，以及定时自动化。                                                  |

## Harness 逐层可见

每一层在安装后立即运行，同时每一层也都是配置面。

| 层             | 开箱运行                                                                    | 可替换为                                |
| -------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| **Agent 循环** | 五个主要角色运行在带类型工具结果的流式循环上。                              | `agent`、提示词覆盖                     |
| **工具**       | 42 个内置工具，外加模型上下文协议（MCP）服务与语言服务器协议（LSP）。       | `tools`、`mcp`、`lsp`、`plugin`         |
| **模型**       | 87 个供应商、2,579 个模型，统一来自一个内置目录。                           | `model`、`small_model`、`provider`      |
| **上下文**     | 自动压缩与逐轮上下文预算，让长程运行始终留在窗口内。                        | 模型与预算配置                          |
| **记忆**       | 项目与会话记忆，具备检索、组织与显式注入能力。                              | `instructions`、记忆配置                |
| **权限**       | 每一次副作用执行前，都要经过一道持久化的允许／询问／拒绝授权。              | `permission` 规则、shell 作用域         |
| **专家团**     | 119 个可检查的专家团；任务锁定一个精确版本，不会静默切换。                  | `expert_squads`、自行编写               |
| **持久化执行** | 进程租约、事件日志与协调器，在重启后恢复已归属的工作。                      | 平台保证                                |
| **校验**       | 完整性复核、事实核查与视觉 QA 作为具名阶段运行。                            | 验收配置                                |
| **证据**       | 宿主观测独立记录文件变更与命令结果，不依赖 Agent 的自述总结。               | 平台保证                                |
| **接入界面**   | 桌面端、带 SSE 的 HTTP API、13 个聊天渠道、定时自动化。                     | SDK、插件 API、Agent Client Protocol    |

## 快速开始

### 下载桌面安装包

从 [GitHub 最新 Release](https://github.com/yangheng95/opencorvus/releases/latest)
下载适合当前系统的一个安装包，也可以查看
[全部版本](https://github.com/yangheng95/opencorvus/releases)。GitHub Actions 运行页里
体积较大的平台 artifact 是同时容纳多种格式的构建中转容器；公开 Release 会把每个
安装包作为独立文件提供下载。

| 操作系统         | 推荐文件                                | 其他格式                                           |
| ---------------- | --------------------------------------- | -------------------------------------------------- |
| Windows x64      | `OpenCorvus_<version>_x64-setup.exe`    | 适合集中部署的 `.msi`                              |
| macOS Apple 芯片 | `OpenCorvus_<version>_aarch64.dmg`      | `.app.tar.gz` 压缩包                               |
| macOS Intel      | `OpenCorvus_<version>_x64.dmg`          | `.app.tar.gz` 压缩包                               |
| Linux x64        | `OpenCorvus_<version>_amd64.AppImage`   | Debian/Ubuntu 使用 `.deb`，Fedora/RHEL 使用 `.rpm` |
| Linux ARM64      | `OpenCorvus_<version>_aarch64.AppImage` | `_arm64.deb` 或 `.aarch64.rpm`                     |

用于终端或无头运行时，同一个 Release 还会为每个平台提供完整的
`opencorvus-<platform>.tar.gz` 命令行界面（Command-Line Interface，CLI）运行时；
x64 平台同时提供适用于不支持高级矢量扩展 2（Advanced Vector Extensions 2，AVX2）
处理器的 `-baseline.tar.gz` 版本。

把 `<version>` 替换成 Release 页面显示的版本，例如 `0.0.44-beta.1`。只需下载实际要
安装的那一个文件。

### 从源码安装

```bash
git clone https://github.com/yangheng95/opencorvus.git
cd opencorvus
bun install
bun run --cwd packages/opencorvus build
bun packages/opencorvus/src/index.ts doctor
```

上面的源码构建是仓库内安装路径。桌面下载由对应 Release 的 GitHub Actions 原生
打包矩阵验证；开发运行里的 Actions artifact 不是公开安装包下载渠道。

### 启动服务

在希望 OpenCorvus 工作的仓库中启动无头服务：

```bash
OPENCORVUS_SOURCE=/path/to/opencorvus/packages/opencorvus/src/index.ts
cd /path/to/your/repo
bun "$OPENCORVUS_SOURCE" serve
```

打开本地 Overlay `http://127.0.0.1:7878/ui/`，或通过 HTTP API 创建 Task：

```bash
curl -X POST http://127.0.0.1:7878/task \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PWD" \
  -d '{
    "request": "实现所需改动，完成验证，并在结果可以接受审阅或出现真实阻塞后停止。"
  }'
```

服务会返回 `202` 和一个 `task_id`。通过服务器发送事件（Server-Sent Events，SSE）
持续接收进度：

```bash
curl -N http://127.0.0.1:7878/task/<task_id>/events
```

> [!TIP]
> 如果要在本机之外暴露 `opencorvus serve`，请先设置
> `OPENCORVUS_SERVER_PASSWORD`。

## 定制成你自己的

内置默认值只是起点，不是边界。配置集中在一个项目文件中，以下全部是可选项。

| 你想要…                | 配置项                                          |
| ---------------------- | ----------------------------------------------- |
| 换模型或供应商         | `model`、`small_model`、`provider`              |
| 增加或收窄能力         | `tools`、`mcp`、`lsp`、`plugin`                 |
| 改变谁可以做什么       | `permission` 规则（允许／询问／拒绝）与 shell 作用域 |
| 重新定义某个 Agent     | `agent` 配合 `prompt` 或 `prompt_append`        |
| 替换或覆盖专家团       | `expert_squads`                                 |
| 补充项目上下文与规范   | `instructions`                                  |
| 增加可复用操作         | `command`、`formatter`、`keybinds`              |

除配置之外，还有三条扩展路径让 Harness 本身保持开放：

- **JavaScript SDK** —— [`packages/sdk/js`](./packages/sdk/js)，并提供
  [OpenAPI 描述](./packages/sdk/openapi.json)，用于在你自己的代码中驱动 Task。
- **插件 API** —— [`packages/plugin`](./packages/plugin)，用于自定义工具、产物生成器
  与证据来源。
- **开放协议** —— 用 Model Context Protocol 服务扩展能力，用 Agent Client Protocol
  把 OpenCorvus 嵌入其他客户端。

你也可以把专业知识封装成可检查的专家团 —— 角色、工作流、Skills、工具、选择说明、
版本与摘要一起交付 —— 并通过仓库贡献。参见[专家团作者路径](https://opencorvus.com/zh-cn/publish/)。

## 让 Hermes Agent 或 OpenClaw 通过 Skill 控制 OpenCorvus

仓库内置了可移植的 [`opencorvus` Agent Skill](./skills/opencorvus/SKILL.md)。它会教
兼容 Agent Skills 的助理检查、配置、运行和排查 OpenCorvus，创建并跟进 Task，发送
后续输入，以及审阅交付证据。安装 Skill **不会**安装 OpenCorvus 运行时，因此请先
完成上面的任一安装流程，并复制包含 [`references/`](./skills/opencorvus/references/)
在内的完整 Skill 目录。

### Hermes Agent

在 OpenCorvus checkout 中执行：

```bash
mkdir -p ~/.hermes/skills/developer-tools
cp -R ./skills/opencorvus ~/.hermes/skills/developer-tools/opencorvus
hermes skills list
```

启动新会话或执行 `/reset`，然后用斜杠命令点名 Skill：

```text
/opencorvus 检查 OpenCorvus 是否已经安装且健康。不要修改任何内容。
```

### OpenClaw

把同一个本地包安装到当前 workspace：

```bash
openclaw skills install ./skills/opencorvus --as opencorvus
openclaw skills check
```

启动新会话，然后在 Control 用户界面中使用 `$opencorvus`，或在消息频道中使用
`/opencorvus`：

```text
使用 $opencorvus 为 /absolute/path/to/project 启动 OpenCorvus，针对我的目标创建一个 Task，并报告 task ID 和可观察进度。
```

Skill 被调用后，助理会选择包内对应 reference，并通过 OpenCorvus 当前的命令行界面
（Command-Line Interface，CLI）或 HTTP API 完成操作。你可以让它只读检查安装，
配置模型提供商，启动本地或密码保护的服务，创建或跟进 Task，发送后续消息，重试或
重新规划工作，在得到明确授权后取消 Task，并在宣告完成前检查 board、events、
Artifact 和真实阻塞。宿主专用安装细节、PowerShell 命令、安全凭据处理与完整操作
示例见 [`skill-installation`](./skills/opencorvus/references/skill-installation.md) 和
[`operations`](./skills/opencorvus/references/operations.md)。

## 核心模型

| 对象         | 作用                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| Mission      | 协调由多个 Task 组成的目标，并记录 Task 之间的依赖关系。                           |
| Task         | 管理一项项目内工作、一个固定的专家团、已选工作流、相关 Session，以及生命周期决策。 |
| Expert Squad | 把 Agent 阵容、指令、Skill、工具、模型上下文协议（MCP）访问和已声明的工作流打包。  |
| Workflow     | 声明一个 Task 要运行的 Agent 及其依赖顺序。                                        |
| Artifact     | 保存带来源信息的类型化输出或文件快照，供其他 Agent 或 Task 读取同一份结果。        |
| 宿主观察     | 独立记录文件改动、命令结果等事实，不依赖 Agent 的文字总结。                        |

一个 Task 选定专家团后不会中途更换；如果选了工作流，工作流也保持不变。Worker 以流式
方式发送消息和工具调用，在契约要求时发布 Artifact，并把精确的 Artifact 引用交给下游
Worker。Orchestrator 根据这些记录和宿主观察处理生命周期决策。未解决的限制和 blocker
保留在 Agent 的可见消息中。

![Mission 与 Expert Squad 执行流程](assets/agent-teams-workflow.png)

## 平台入口

| 入口          | 状态       | 提供的能力                                                                                                               |
| ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| 桌面 Overlay  | 可用       | Conversation、Mission、Task、专家团、证据与交付审阅                                                                      |
| 无头 HTTP API | 可用       | Task 生命周期路由和 SSE 进度流                                                                                           |
| Slack 网关    | 可用       | 从 Slack 话题串启动并操作编排工作                                                                                        |
| 多频道适配器  | 仓库内已有 | Slack、Telegram、Discord、飞书、WhatsApp、Google Chat、Microsoft Teams、Line、Matrix、Mattermost、Signal、企业微信和钉钉 |
| GitHub Action | 可用       | 参见 [`github/README.md`](./github/README.md) 中的仓库自动化说明                                                         |

常用 Task 端点：

- `GET /tasks`，需要项目目录
- `GET /task/<task_id>`，不需要项目目录
- `GET /task/<task_id>/board`，不需要项目目录
- `POST /task/<task_id>/message`，需要 Task 项目目录
- `POST /task/<task_id>/retry`，需要 Task 项目目录
- `POST /task/<task_id>/replan`，需要 Task 项目目录
- `POST /task/<task_id>/cancel`，需要 Task 项目目录

### Coding CLI 快捷入口

桌面端可以发现已安装的 Claude Code、Codex、Gemini Code、GitHub Copilot 和 GLM Code
命令行界面（Command-Line Interface，CLI），并在当前项目目录的终端中打开所选 CLI。
这只会启动一条交互式终端命令，不会把 Task 分配给外部执行器。

### Slack

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_APP_TOKEN=xapp-...
bun run --cwd packages/channel-runtime dev
```

网关可以从话题串第一条消息启动工作，同步规划与交付更新，接收 `allow`、`always`
和 `reject` 等权限回复，并把操作者的后续消息送回 Task。

## 开发

```bash
# 仓库根目录
bun install

# 核心命令行界面与编排器
bun run --cwd packages/opencorvus typecheck
bun run --cwd packages/opencorvus test

# 频道运行时适配器
bun run --cwd packages/channel-runtime test

# 重新生成 JavaScript 软件开发工具包（Software Development Kit，SDK）
bun ./packages/sdk/js/script/build.ts
```

## 限制

- OpenCorvus 只负责编排兼容的模型、工具和执行器，不会让任意第三方代码自动兼容或安全。
- 持久化 Task 可以恢复，但运行时离线期间不会执行工作。
- 结果取决于模型行为、来源访问、已安装能力和本次运行可取得的证据。
- 项目仍在开发；Beta 版本之间的接口和随包集成可能变化。

## 文档与贡献

- 产品文档：<https://opencorvus.com/zh-cn/start/quickstart/>
- 更新日志：[`CHANGELOG.md`](./CHANGELOG.md)
- GitHub Action：[`github/README.md`](./github/README.md)
- 贡献指南：[`CONTRIBUTING.md`](./CONTRIBUTING.md)
- 使用支持：[`SUPPORT.md`](./SUPPORT.md)
- 安全策略：[`SECURITY.md`](./SECURITY.md)
- 社区行为准则：[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- 第三方声明：[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)

## 开源致谢

OpenCorvus 从 [OpenCode](https://github.com/anomalyco/opencode) 代码库演进而来，
当前模型 Provider、GitHub Copilot 和 Provider 插件中仍保留了明确标注、持续同步的
OpenCode 工作。感谢 OpenCode 的维护者和贡献者奠定了这部分基础。

主要运行时和分发依赖包括：

- **运行时与 Agent 核心：** [Bun](https://github.com/oven-sh/bun)、
  [Vercel AI SDK](https://github.com/vercel/ai)、
  [Hono](https://github.com/honojs/hono) 和
  [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm)。
- **开放互操作：** 官方
  [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)、
  [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) 和
  [Agent Client Protocol TypeScript SDK](https://github.com/agentclientprotocol/typescript-sdk)。
- **桌面应用：** [Tauri](https://github.com/tauri-apps/tauri)、
  [SolidJS](https://github.com/solidjs/solid) 和
  [Kobalte](https://github.com/kobaltedev/kobalte)。
- **执行与证据：** [Playwright](https://github.com/microsoft/playwright)、
  [CUA](https://github.com/trycua/cua) 和
  [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI)。
- **随包交付的命令行运行时：** [Node.js](https://github.com/nodejs/node) 和
  [ripgrep](https://github.com/BurntSushi/ripgrep)。
- **交互式工作台：** [CodeMirror](https://github.com/codemirror/dev)、
  [xterm.js](https://github.com/xtermjs/xterm.js)、
  [Mermaid](https://github.com/mermaid-js/mermaid)、
  [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)、
  [PDF.js](https://github.com/mozilla/pdf.js)、
  [Reveal.js](https://github.com/hakimel/reveal.js)、
  [Vega-Lite](https://github.com/vega/vega-lite)、
  [Cytoscape.js](https://github.com/cytoscape/cytoscape.js) 和
  [Univer](https://github.com/dream-num/univer)。
- **内置能力来源：** 随产品提供的设计与访谈 Skill 分别改编自
  [Taste Skill](https://github.com/Leonxlnx/taste-skill) 和
  [Matt Pocock Skills](https://github.com/mattpocock/skills)。对应本地 Skill 仍保留来源与
  许可证文件。
- **文档：** [Astro](https://github.com/withastro/astro) 和
  [Starlight](https://github.com/withastro/starlight)。

完整依赖与声明见仓库清单和 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。各上游
项目仍遵循自己的许可证和商标规则。

## 许可证

[MIT](./LICENSE)
