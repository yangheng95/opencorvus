---
title: "部署、定制与外部 Agent 集成"
description: "安装与开发指南，以及 Hermes Agent、OpenClaw 和聊天渠道接入。"
locale: "zh-cn"
key: "deployment-and-integrations"
category: "practice"
order: 7
---

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

把 `<version>` 替换成 Release 页面显示的版本，例如 `0.0.61-beta`。只需下载实际要
安装的那一个文件。

### 从源码安装

执行下列命令前，先准备[开发依赖](https://github.com/yangheng95/opencorvus/blob/main/CONTRIBUTING.md#developing-opencorvus)，
包括 Windows 上的 Rust/C++ 原生工具链。

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

启动前，在项目的 `.opencorvus/opencorvus.jsonc` 中配置可用的模型提供商与精确的
`provider/model`。模型设置、范围明确的首次任务和 PowerShell 命令见
[快速开始](https://opencorvus.com/zh-cn/start/quickstart/)。

```bash
OPENCORVUS_SOURCE=/path/to/opencorvus/packages/opencorvus/src/index.ts
cd /path/to/your/repo
bun "$OPENCORVUS_SOURCE" serve
```

打开本地 Overlay `http://127.0.0.1:7878/ui/`，或通过 HTTP API 创建 Task，
使用已配置的模型和当前激活的专家团：

```bash
curl -X POST http://127.0.0.1:7878/task \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PWD" \
  -d '{
    "productPillar": "code",
    "request": "检查此仓库并创建 docs/architecture-overview.md。说明入口、主要模块及已有的构建或测试命令，附上精确源码路径。核验这些路径，区分已证实事实与不确定项。不要修改应用源码。"
  }'
```

服务会返回 `202`，包含 `task_id`、`project_id` 和 `directory`。请求被接受不代表完成。
把 `TASK_ID` 设为返回值，通过服务器发送事件（Server-Sent Events，SSE）持续接收进度：

```bash
TASK_ID='paste-the-returned-task-id'
curl -N "http://127.0.0.1:7878/task/$TASK_ID/events"
```

打开项目中的 `docs/architecture-overview.md`，对照仓库核验引用路径、模块说明及构建或测试命令。
Task 进入终态本身不能证明概览准确；需要修正时，按[快速开始的后续消息示例](https://opencorvus.com/zh-cn/start/quickstart/)
在同一个 Task 中提出。

> [!TIP]
> 如果要在本机之外暴露 `opencorvus serve`，请先设置
> `OPENCORVUS_SERVER_PASSWORD`。

## 定制成你自己的

内置默认值只是起点，不是边界。配置集中在一个项目文件中，以下全部是可选项。

| 你想要…              | 配置项                                               |
| -------------------- | ---------------------------------------------------- |
| 换模型或供应商       | `model`、`small_model`、`provider`                   |
| 增加或收窄能力       | `tools`、`mcp`、`plugin`                             |
| 改变谁可以做什么     | `permission` 规则（允许／询问／拒绝）与 shell 作用域 |
| 重新定义某个 Agent   | `agent` 配合 `prompt` 或 `prompt_append`             |
| 替换或覆盖专家团     | `expert_squads`                                      |
| 补充项目上下文与规范 | `instructions`                                       |
| 增加可复用操作       | `command`、`formatter`、`keybinds`                   |

除配置之外，还有三条扩展路径让 Harness 本身保持开放：

- **JavaScript SDK** —— [`packages/sdk/js`](https://github.com/yangheng95/opencorvus/blob/main/packages/sdk/js)，并提供
  [OpenAPI 描述](https://github.com/yangheng95/opencorvus/blob/main/packages/sdk/openapi.json)，用于在你自己的代码中驱动 Task。
- **插件 API** —— [`packages/plugin`](https://github.com/yangheng95/opencorvus/blob/main/packages/plugin)，用于自定义工具、产物生成器
  与证据来源。
- **开放协议** —— 用 Model Context Protocol 服务扩展能力，用 Agent Client Protocol
  把 OpenCorvus 嵌入其他客户端。

你也可以把专业知识封装成可检查的专家团 —— 角色、工作流、Skills、工具、选择说明、
版本与摘要一起交付 —— 并通过仓库贡献。参见[专家团作者路径](https://opencorvus.com/zh-cn/publish/)。

## 让 Hermes Agent 或 OpenClaw 通过 Skill 控制 OpenCorvus

仓库内置了可移植的 [`opencorvus` Agent Skill](https://github.com/yangheng95/opencorvus/blob/main/skills/opencorvus/SKILL.md)。它会教
兼容 Agent Skills 的助理检查、配置、运行和排查 OpenCorvus，创建并跟进 Task，发送
后续输入，以及审阅交付证据。安装 Skill **不会**安装 OpenCorvus 运行时，因此请先
完成上面的任一安装流程，并复制包含 [`references/`](https://github.com/yangheng95/opencorvus/blob/main/skills/opencorvus/references/)
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
配置模型提供商，启动本地或密码保护的服务，创建或跟进 Task，通过后续消息继续工作，
在得到明确授权后取消 Task，并在宣告完成前检查 board、events、
Artifact 和真实阻塞。宿主专用安装细节、PowerShell 命令、安全凭据处理与完整操作
示例见 [`skill-installation`](https://github.com/yangheng95/opencorvus/blob/main/skills/opencorvus/references/skill-installation.md) 和
[`operations`](https://github.com/yangheng95/opencorvus/blob/main/skills/opencorvus/references/operations.md)。

## 平台入口

| 入口          | 状态       | 提供的能力                                                                                                               |
| ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| 桌面 Overlay  | 可用       | Conversation、Mission、Task、专家团、证据与交付审阅                                                                      |
| 无头 HTTP API | 可用       | Task 生命周期路由和 SSE 进度流                                                                                           |
| Slack 网关    | 可用       | 从 Slack 话题串启动并操作编排工作                                                                                        |
| 多频道适配器  | 仓库内已有 | Slack、Telegram、Discord、飞书、WhatsApp、Google Chat、Microsoft Teams、Line、Matrix、Mattermost、Signal、企业微信和钉钉 |
| GitHub Action | 可用       | 参见 [`github/README.md`](https://github.com/yangheng95/opencorvus/blob/main/github/README.md) 中的仓库自动化说明                                                         |

常用 Task 端点：

- `GET /tasks`，需要项目目录
- `GET /task/<task_id>`，不需要项目目录
- `GET /task/<task_id>/board`，不需要项目目录
- `POST /task/<task_id>/message`，需要 Task 项目目录
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
