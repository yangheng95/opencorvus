![OpenCorvus 把 Agentic 系统和传统算法适配为契约、证据与 Artifact，并汇入一条经过审阅的工作流](assets/heterogeneous-algorithm-foundry.png)

<p align="center">
  <strong>OpenCorvus</strong>
</p>

<p align="center">
  <a href="./README.md">English</a> | <strong>简体中文</strong>
</p>

<p align="center">
  <strong>围绕你的工作方式，组建一个 AI 组织。</strong><br>
  <em>定制专家团，运行长程 Mission，让专业协作汇聚为经过审阅的交付。</em>
</p>

<p align="center">
  <a href="https://opencorvus.ai">官方网站</a> ·
  <a href="https://opencorvus.ai/docs">产品文档</a> ·
  <a href="#快速开始">快速开始</a>
</p>

OpenCorvus 是一个用于组建专属人工智能（Artificial Intelligence，AI）组织的开源
Agent Harness，而不只是另一个聊天机器人。你可以定义工作所需的专家、工具、模型和
工作方法，再给它们一个真实目标；持久化 Mission 会跨越多天、多个阶段和多个领域
协调工作。

每支专业团队只对自己的 Task 负责。研究可以为规划提供证据，规划可以指导实现，
独立审阅者可以挑战最终结果；它们通过已经验收、可追溯的 Artifact 协作，而不是
依赖共享的隐藏上下文。最终得到的是一个围绕你而定制的组织，以及从需求到审阅结果
完整可见的交付链路。

> [!IMPORTANT]
> OpenCorvus 仍在积极开发。本 README 描述的是当前仓库已有能力。实际输出质量取决于
> 所选模型、可访问的数据源、已安装能力，以及真实运行能够获得的证据。“全天候”
> 表示本地或托管的 OpenCorvus 运行时持续在线；已经关机的电脑无法继续执行工作。

## 选择 OpenCorvus 的三个理由

### 1. 定制一个组织，而不只是修改提示词

一个 **Expert Squad（专家团）** 就是一个自包含的组织单元：专业角色、指令、Skill、
工具、模型上下文协议（Model Context Protocol，MCP）服务器和声明工作流一起打包。
你可以从内置的编码、研究、办公与商业专家团开始，也可以通过 Squad 软件开发工具包
（Software Development Kit，SDK）创建符合自己领域和标准的新团队。

通过显式适配器和自包含能力包，接入兼容的模型、编码 Agent、Agentic 系统、确定性
工具、优化模型与传统算法：

**适配 → 契约 → 证据 → Artifact**

OpenCorvus 统一的是能力进入工作流和交付结果的方式，并不会把任意第三方代码包装成
“自动兼容”或“自动安全”。

### 2. 让长程工作始终保持连贯

从结果开始，而不是从 Agent 拓扑开始。持久化 **Mission** 会把大型目标拆分成责任
明确的 **Task**，并在工作推进时保留需求、决策、谱系、交互和已经验收的 Artifact。
后续阶段从经过审阅的证据继续，而不需要你重新讲述背景，也不需要相信一段来自记忆
的摘要。

Task 可以恢复，周期性工作会保留运行历史，真实阻塞始终可见。只要本地或托管运行时
保持在线，OpenCorvus 就能在单轮聊天或单次桌面会话结束后继续推进无人值守工作。

### 3. 让多个专家团像一个交付组织一样协作

每个 Task 固定使用一个专家团和一张声明工作流，因此责任归属始终清楚。Mission 负责
协调更大的结果：互不依赖的团队可以并行工作；依赖型团队要等所需证据通过验收后才
开始；Typed Artifact 会携带精确来源和决策，在团队之间完成交接。

跨领域协作因此成为一条真实链路：研究专家团把证据档案交给规划专家团，开发专家团
实现已经验收的方案，测试与审阅专家团再独立检查结果。最终交付会保留每个阶段的贡献
和证据。

![一个 OpenCorvus Mission 协调编码、研究、办公和商业专家团队，再汇聚为一份经过审阅的交付](assets/agent-teams-workflow.png)

### 交付才是终点

Agent 停止运行不等于 Task 完成。OpenCorvus 会保存 Typed、内容寻址的
**Artifact**、精确谱系、实现与来源证据，并引入独立审阅。缺少必要证据时，真实阻塞
会保持可见，而不会被包装成一次成功交付。

## 为结果组建一支完整组织

| 目标               | 专家团协作链路                                        | 可审阅交付                                               |
| ------------------ | ----------------------------------------------------- | -------------------------------------------------------- |
| 完成真实仓库改动   | 需求与架构 → 开发 → 测试与审阅                        | 实现、验证、版本控制证据与独立审阅结论                   |
| 完成深度研究       | 研究章程 → 多个来源专家并行调查 → 证据综合 → 引用审阅 | 来源档案、带引用报告、假设与审阅证据                     |
| 分析公司或市场     | 来源研究 → 财务或市场分析 → 风险审计                  | 带日期证据、情景、风险和经过独立挑战的结论               |
| 创建可编辑演示文稿 | 研究与叙事 → Office Artifact 制作 → 渲染与视觉审阅    | PowerPoint Open XML Presentation（PPTX）包与精确审阅文件 |
| 执行周期性工作     | 定时分类 → 领域专家团 → 审阅或经过授权的操作          | 可见目标、运行历史、保留上下文和待处理状态               |
| 添加自己的专业能力 | Squad SDK 创作 → 能力包验证 → Mission 分配            | 具有精确身份、工作流和能力的自包含专家团                 |

## 一个 Mission，多支专家团队，一个可问责结果

```text
你的长程目标
  → Mission 负责完整交付链路
     ├─ Task A · 研究专家团 ──────┐
     ├─ Task B · 领域专家团 ──────┼─ Artifact 证据通过验收
     └─ Task C · 分析专家团 ──────┘
                                   ↓
                         Task D · 开发专家团
                                   ↓
                         Task E · 独立审阅
                                   ↓
                         一份经过审阅的交付
```

1. 从桌面端、超文本传输协议（Hypertext Transfer Protocol，HTTP）应用程序编程接口
   （Application Programming Interface，API）、Slack 或其他已连接频道提交目标。
2. 由 Mission 识别各个专业阶段及其验收边界。
3. 为每个 Task 固定一个专家团和一张声明工作流，并在完整生命周期中保持不变。
4. 并行运行互不依赖的专家；依赖型专家只在所需证据成功后开始。
5. 在专家团之间传递 Typed Artifact，而不是通过编排消息复制结论。
6. 由独立专家根据领域要求审阅真实的实现、运行时、视觉、来源和 Artifact 证据。
7. 完整证据链足以支撑结果时才交付，否则让真实阻塞保持可见。

## 快速开始

### 下载桌面安装包

从 [GitHub 最新 Release](https://github.com/yangheng95/opencorvus/releases/latest)
下载适合当前系统的一个安装包，也可以查看
[全部版本](https://github.com/yangheng95/opencorvus/releases)。GitHub Actions 运行页里
体积较大的平台 artifact 是同时容纳多种格式的构建中转容器；公开 Release 会把每个
安装包作为独立文件提供下载。

| 操作系统 | 推荐文件 | 其他格式 |
| -------- | -------- | -------- |
| Windows x64 | `OpenCorvus_<version>_x64-setup.exe` | 适合集中部署的 `.msi` |
| macOS Apple 芯片 | `OpenCorvus_<version>_aarch64.dmg` | `.app.tar.gz` 压缩包 |
| macOS Intel | `OpenCorvus_<version>_x64.dmg` | `.app.tar.gz` 压缩包 |
| Linux x64 | `OpenCorvus_<version>_amd64.AppImage` | Debian/Ubuntu 使用 `.deb`，Fedora/RHEL 使用 `.rpm` |
| Linux ARM64 | `OpenCorvus_<version>_aarch64.AppImage` | `_arm64.deb` 或 `.aarch64.rpm` |

把 `<version>` 替换成 Release 页面显示的版本，例如 `0.0.35-beta`。只需下载实际要
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

### 启动你的助手

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

### 外部编码执行器

OpenCorvus 提供内置执行器；安装受支持的编码命令行界面（Command-Line Interface，
CLI）并启用发现后，也可以调度外部执行器：

```bash
export OPENCORVUS_AUTO_DISCOVER_EXECUTORS=1
```

当前执行器显示名称为 OpenCorvus（`opencorvus`）、Codex（`codex`）和 Claude Code
（`claude-code`）。如果所选外部执行器未被发现，请求会被明确拒绝；OpenCorvus 不会
静默换用另一个执行器。

### Slack

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_APP_TOKEN=xapp-...
bun run --cwd packages/channel-runtime dev
```

网关可以从话题串第一条消息启动工作，同步规划与交付更新，接收 `allow`、`always`
和 `reject` 等权限回复，并把操作者的后续消息送回 Task。

## OpenCorvus 处于什么位置

| 类别         | 最擅长的事情              | OpenCorvus 增加的价值                           |
| ------------ | ------------------------- | ----------------------------------------------- |
| Agent 框架   | 构建自定义 Agent 和编排图 | 对长期、跨领域交付负责的用户级 Harness          |
| 工作流自动化 | 连接应用和显式业务逻辑    | 下一阶段可由已审阅证据决定的长期 Task           |
| 编码 Agent   | 在仓库中工作              | 让编码成为与研究、办公和商业并列的一条专业路径  |
| 通用助理     | 提供广泛的对话帮助        | 专属团队、持久上下文、精确谱系和可审阅 Artifact |

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

## 常见问题

### OpenCorvus 会替代我正在使用的编码 Agent 或模型吗？

不会。OpenCorvus 是包裹兼容能力的 Harness。它为这些能力提供持久 Task、专业团队、
权限、远程频道、Artifact 谱系、审阅循环和操作者反馈，让工作过程可观察、结果可审阅。

### OpenCorvus 只能处理代码吗？

不是。Code 与 Work 是同一套 Mission、权限、记忆和 Artifact 底座上的并列路径。
当前仓库已经包含研究、办公、商业、定时工作、频道和专业能力包入口。

### 它会在多次运行之间保留上下文吗？

会。Task、需求、调度谱系、交互、Artifact、验收证据、Session 状态和项目知识都会
持久化到本地 SQLite。Session 范围和全局记忆与偏好可以在同一项目的后续运行中继续使用。

### 它真的可以全天候工作吗？

可以，前提是本地或托管运行时持续在线。Task 是持久且可恢复的，但 OpenCorvus 无法
在已经关机的电脑上继续执行工作。

### 它已经完成了吗？

没有。核心编排循环已经实现，产品能力仍在持续扩展。本 README 描述的是当前仓库能力，
不代表每个规划中的集成都已经完成。

## 文档与贡献

- 产品文档：<https://opencorvus.ai/docs>
- 更新日志：[`CHANGELOG.md`](./CHANGELOG.md)
- GitHub Action：[`github/README.md`](./github/README.md)
- 贡献指南：[`CONTRIBUTING.md`](./CONTRIBUTING.md)
- 使用支持：[`SUPPORT.md`](./SUPPORT.md)
- 安全策略：[`SECURITY.md`](./SECURITY.md)
- 社区行为准则：[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- 贡献指南：[`CONTRIBUTING.md`](./CONTRIBUTING.md)

## 开源致谢

OpenCorvus 从 [OpenCode](https://github.com/anomalyco/opencode) 代码库演进而来，
当前模型 Provider、GitHub Copilot 和 Provider 插件中仍保留了明确标注、持续同步的
OpenCode 工作。感谢 OpenCode 的维护者和贡献者奠定了这部分基础。

当前产品也建立在许多优秀的开源项目之上。下面只列出承担主要产品边界或作为关键能力
随产品交付的项目，不机械复制完整依赖图。

- **运行时与 Agent 核心：** [Bun](https://github.com/oven-sh/bun)、
  [Vercel AI SDK](https://github.com/vercel/ai)、
  [Hono](https://github.com/honojs/hono) 和
  [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) 分别支撑运行时、流式模型集成、
  超文本传输协议（Hypertext Transfer Protocol，HTTP）应用程序编程接口
  （Application Programming Interface，API）与 SQLite 持久化层。
- **开放互操作：** 官方
  [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)、
  [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) 和
  [Agent Client Protocol TypeScript SDK](https://github.com/agentclientprotocol/typescript-sdk)
  将 OpenCorvus 与工具、交互式应用和外部编码 Agent 连接起来。
- **桌面应用：** [Tauri](https://github.com/tauri-apps/tauri)、
  [SolidJS](https://github.com/solidjs/solid) 和
  [Kobalte](https://github.com/kobaltedev/kobalte) 提供原生桌面壳、响应式渲染器和无障碍
  用户界面（User Interface，UI）基础组件。
- **执行与证据：** [Playwright](https://github.com/microsoft/playwright)、
  [CUA](https://github.com/trycua/cua) 和
  [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI) 分别支撑浏览器证据、宿主原生
  Computer Use，以及可编辑 Office Artifact 的检查与渲染。
- **随包交付的命令行运行时：** [Node.js](https://github.com/nodejs/node) 和
  [ripgrep](https://github.com/BurntSushi/ripgrep) 进入受支持的 Release 闭包，分别服务于
  Node sidecar 和高速仓库搜索。
- **交互式工作台：** [CodeMirror](https://github.com/codemirror/dev)、
  [xterm.js](https://github.com/xtermjs/xterm.js)、
  [Mermaid](https://github.com/mermaid-js/mermaid)、
  [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)、
  [PDF.js](https://github.com/mozilla/pdf.js)、
  [Reveal.js](https://github.com/hakimel/reveal.js)、
  [Vega-Lite](https://github.com/vega/vega-lite)、
  [Cytoscape.js](https://github.com/cytoscape/cytoscape.js) 和
  [Univer](https://github.com/dream-num/univer) 共同构成编辑器与交互式 Artifact 表面。
- **内置能力来源：** 随产品提供的设计与访谈 Skill 分别改编自
  [Taste Skill](https://github.com/Leonxlnx/taste-skill) 和
  [Matt Pocock Skills](https://github.com/mattpocock/skills)；对应本地 Skill 仍保留独立的
  来源与许可证文件。
- **文档：** [Astro](https://github.com/withastro/astro) 和
  [Starlight](https://github.com/withastro/starlight) 支撑产品文档站。

感谢这些项目以及仓库清单中众多小型依赖背后的每一位维护者和贡献者。各上游项目仍受
各自许可证和商标规则约束；这份致谢不能替代源码与 Release Artifact 随附的许可证和
NOTICE 文件，也不表示任何上游项目对 OpenCorvus 的背书或关联关系。

## 许可证

[MIT](./LICENSE)
