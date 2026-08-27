<p align="center">
  <img src="assets/readme-head.png" alt="OpenCorvus" width="440" />
</p>

<h3 align="center">能跑完的长任务，还会越跑越好。</h3>

<p align="center">
  <strong>一套开源的 Agent Harness，为跑得久的工作而做 —— 长任务交给组合起来的专家团，
  每次交接都留证据，专家团还会按你的反馈改自己。</strong>
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
  <img alt="119 支专家团" src="https://img.shields.io/badge/expert%20squads-119-2946d3?style=for-the-badge" />
  <img alt="43 个内置工具" src="https://img.shields.io/badge/built--in%20tools-43-2946d3?style=for-the-badge" />
</p>

<p align="center">
  <a href="./README.md">English</a> | <strong>简体中文</strong>
</p>

<p align="center">
  <a href="https://opencorvus.com/zh-cn/">官方网站</a> ·
  <a href="https://opencorvus.com/zh-cn/start/quickstart/">快速开始</a> ·
  <a href="https://github.com/yangheng95/opencorvus/releases/latest">下载</a> ·
  <a href="https://opencorvus.com/zh-cn/market/">专家团</a> ·
  <a href="https://opencorvus.com/zh-cn/concepts/long-horizon/">长程</a> ·
  <a href="https://opencorvus.com/zh-cn/concepts/squad-composition/">组合</a> ·
  <a href="https://opencorvus.com/zh-cn/expert-squads/evolution/">进化</a>
</p>

---

## 先把话说清楚

长任务跑到一半死了，大家习惯怪模型。多数时候不是模型的问题。

**Agent Harness** 是把模型变成 Agent 的那一层运行时：循环、工具路由、上下文管理、记忆、
权限执行、故障恢复和调度。长程能力是这整套系统的属性，不是模型单独的属性 —— 再强的模型，
放进一个会丢任务状态的 Harness 里，照样跑不彻底。

OpenCorvus 就是这一层，已经组装好，而且是冲着长程工作去的。装完你立刻拥有：覆盖五个主要
角色的流式 Agent 循环、43 个内置工具、87 个模型供应商、能扛过重启的编排、持久化的权限
授权、项目与会话记忆、自动上下文压缩，以及 119 支可以打开看的专家团 —— 首次启动就能跑。
再往下每一层都是配置面：换模型、收窄工具集、收紧权限规则、替换整支专家团，或者直接用
SDK（Software Development Kit，软件开发工具包）驱动整个 Harness。

后端运行时和桌面前端都写在这个仓库里，底下没有套第三方 Agent 引擎。这不是什么值得炫耀的
事，而是「每一层都换得动」的前提。它同样站在大量开源项目的肩膀上 —— Bun、AI SDK、SolidJS、
Tauri 等等。

<p align="center">
  <a href="https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-zh-CN.mp4"><img src="https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-zh-CN-poster.jpg" alt="OpenCorvus Mission 产品故事" width="880" /></a>
</p>

<p align="center"><sub>长程 Agent 为什么会失败、Mission 怎么调度可恢复的工作，以及一次 12 小时 45 分钟的 DeBERTa 运行交付了什么。4 分 11 秒，有声旁白与字幕：<a href="https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-zh-CN.mp4">简体中文</a> · <a href="https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-en-US.mp4">English</a>。</sub></p>

> [!IMPORTANT]
> OpenCorvus 处于活跃开发中。本文描述的是仓库里当下真实存在的能力。产出质量取决于你选的模型、
> 它们能访问的来源、你安装的能力和这次运行拿到的证据。无人值守的工作只在你本地或自托管的
> OpenCorvus 运行时在线时继续。

## Harness 到底值不值这个钱？看数

要诚实地验证这句话，唯一的办法是把模型固定住，只改 Harness。

**AutomationBench**，100 个冻结样本，按严格通过标准计分：

| 运行方式                                    | 严格正确率 |
| ------------------------------------------- | --------: |
| `openai/gpt-5.6-luna`，裸跑                  |   8.07 %  |
| **同一个模型，跑在 OpenCorvus Mission Base 里** | **34.00 %** |

**绝对提升 25.93 个百分点，严格通过率 4.21 倍。** 同一个模型、同一批 case、同一套计分口径 ——
差别全部来自外面这层 Harness。

仅作量级参考，所附官方 held-out 对照：Gemini 3.7 Flash High 30.44 %、Claude Opus 5 Max
26.94 %、GPT-5.6 Terra Max 21.00 %、GPT-5.6 Sol Max 19.63 %。
**这些不是同一批样本，因此不构成横向排名** —— 它们只说明这个 benchmark 大概有多难，不说明谁更强。

## 一个真实的 Mission 长什么样

不是演示用的提示词。一个 Mission，一次运行：拿到 DeBERTa v3 Base ABSA v1.1，检索或合成
可追溯的训练数据，配好仅限 CUDA 的训练环境，超过明确基线，建一个自动更新的训练监控和推理
网页，画出可发表级别的图表，写一篇四页以上的 ACL 风格短文，再让另一支专家团把它批一遍，
最后推一个组织清晰的仓库。

**6 支专家团 · 44 个具名角色**，全部是目录里现成的：

|    | 阶段            | 专家团                                                                                    | 角色 | 交给下一段什么                                                     |
| -- | --------------- | ----------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------ |
| 01 | 模型与数据      | [深度研究](https://opencorvus.com/zh-cn/market/builtin/deep-research/)                      |    6 | 核验过的模型来源、当前 ABSA 证据，以及检索或合成训练数据的可追溯方案 |
| 02 | CUDA 训练系统   | [Advanced](https://opencorvus.com/zh-cn/market/builtin/advanced/)                           |   14 | 仅限 CUDA 的运行环境、基线与候选训练、实验台账，以及实时网页        |
| 03 | 架构证据        | [数据分析与商业洞察](https://opencorvus.com/zh-cn/market/builtin/data-analysis/)             |    7 | 最佳实验对比，以及绑定精确 checkpoint 的可复现图表                  |
| 04 | ACL 短文        | [研究工作室](https://opencorvus.com/zh-cn/market/builtin/research-studio/)                  |    5 | 基于相关工作与最佳实验、四页以上、简洁且信息密集的论文              |
| 05 | 独立审校        | [学术论文审查](https://opencorvus.com/zh-cn/market/builtin/academic-paper-review/)          |    8 | 事实、引文、新颖性、方法、图表与幻觉风险的逐项结算                  |
| 06 | Mission 仓库    | [Base](https://opencorvus.com/zh-cn/market/builtin/base/)                                   |    4 | 可复现的 Git 仓库：阶段图、经审查的文档，以及已验证的 GitHub 推送   |

把同一个结果再展开一层，就是 **18 支专家团 · 99 个角色**，分成五条泳道：模型与数据证据、
CUDA 训练与实验、实时产品、研究与发表、复现与发布。

📦 **那次运行的审计证据是公开的：**
[`yangheng95/deberta-v3-absa-public-evidence`](https://github.com/yangheng95/deberta-v3-absa-public-evidence)

要看的是这条链的*形状*，不是某一段。这六支里有四支带着一个角色，它唯一的职责就是不相信别人
干的活 —— 深度研究的引文复核、数据分析的事实核查、研究工作室自己的事实核查，以及学术论文
审查的引文与幻觉审计。这是一支长期运行的队伍无论提示词写得多好都拿不到的属性。

## 五分钟跑起你的第一个 Task

### 安装

从[最新 Release](https://github.com/yangheng95/opencorvus/releases/latest) 挑一个安装包：

| 操作系统            | 推荐资源                                | 备选                                     |
| ------------------- | --------------------------------------- | ---------------------------------------- |
| Windows x64         | `OpenCorvus_<version>_x64-setup.exe`     | `.msi`，适合受管安装                     |
| macOS Apple 芯片    | `OpenCorvus_<version>_aarch64.dmg`       | `.app.tar.gz` 归档                       |
| macOS Intel         | `OpenCorvus_<version>_x64.dmg`           | `.app.tar.gz` 归档                       |
| Linux x64           | `OpenCorvus_<version>_amd64.AppImage`    | Debian/Ubuntu 用 `.deb`，Fedora/RHEL 用 `.rpm` |
| Linux ARM64         | `OpenCorvus_<version>_aarch64.AppImage`  | `_arm64.deb` 或 `.aarch64.rpm`           |

把 `<version>` 换成 Release 上的版本号，例如 `0.0.55-beta`。终端或无界面场景，同一个 Release
为每一行都发布了完整的 `opencorvus-<platform>.tar.gz` 命令行运行时；x64 平台另外提供
`-baseline.tar.gz` 变体，给不支持 AVX2（Advanced Vector Extensions 2，高级矢量扩展 2）的处理器用。

或者从源码构建：

```bash
git clone https://github.com/yangheng95/opencorvus.git
cd opencorvus
bun install
bun run --cwd packages/opencorvus build
bun packages/opencorvus/src/index.ts doctor
```

`doctor` 会在你踩坑之前告诉你缺什么。

### 跑点东西

在你想让 OpenCorvus 干活的仓库里起服务：

```bash
cd /path/to/your/repo
opencorvus serve            # 或者：bun "$OPENCORVUS_SOURCE" serve
```

浏览器打开本地工作台 `http://127.0.0.1:7878/ui/`，或者直接用 HTTP 创建一个 Task：

```bash
curl -X POST http://127.0.0.1:7878/task \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PWD" \
  -d '{
    "request": "为 src/foo.ts 补单元测试，覆盖正常路径和两条错误路径。"
  }'
```

返回 `202` 和一个 `task_id`。然后就能看着它干活：

```bash
curl -N http://127.0.0.1:7878/task/<task_id>/events
```

流上每个事件都是同一个信封，所以不开界面也能跟完整个过程：

```jsonc
data: {
  "event_id": "prt_…",
  "task_id":  "tsk_…",
  "type":     "engine.artifact",     // 发生了什么
  "summary":  "…",                   // 一行人话
  "sequence": 214,                   // 持久化游标 —— 用 ?after=214 续上
  "payload":  { /* 按事件类型定型 */ }
}
```

一次正常运行里会看到的类型包括 `task.created`、`task.execution.opened`、
`agent.execution.lifecycle`、`permission.asked`、`interaction.requested`、`engine.artifact`、
`task.heartbeat`，以及 `task.completed` / `task.failed` / `task.cancelled` 三者之一。
断开连接不等于丢了这次运行：带 `?after=<sequence>` 重连，流就接着往下走。

> [!TIP]
> 如果你把 `opencorvus serve` 暴露到 localhost 之外，先设 `OPENCORVUS_SERVER_PASSWORD`。
> 不设它也能起，但会打印 `server is unsecured` 并且不启用 HTTP Basic 认证 ——
> 那行警告就是你的仓库和整个网络之间唯一的东西。

<table>
  <tr>
    <td width="50%"><img src="packages/web/src/assets/lander/harness-gallery/work-harness.png" alt="OpenCorvus 工作台" /></td>
    <td width="50%"><img src="packages/web/src/assets/lander/harness-gallery/mission-composer.png" alt="OpenCorvus Mission 编排器" /></td>
  </tr>
  <tr>
    <td><strong>Work</strong> 把长文交付物和它的复核面放在一起。</td>
    <td><strong>Mission</strong> 把同一份可见上下文变成有主的协同工作。</td>
  </tr>
</table>

## 长程工作到底断在哪

三种失败。每一种后面都是一个真实机制，不是一句承诺。

### 一、跑不彻底

某一步被跳过、进程死了，或者一个 Task 在目标只完成一半时就进了终态。

需求会产出带各自验收条件和明确非目标的 `REQ-N` 条目，专家团的工作流则声明谁依赖谁。
物理归属是一份只追加的租约：进程消失时，协调器在租约到期这个确定的时间戳上把被遗弃的 Turn
收敛为终态，之后才获取继任者。每一条被接受的输入都要通过一次全序归约，其中每个状态都有名字。

**终态也不是终点。** 已经 `completed`、`failed` 或 `cancelled` 的 Task，收到你的下一条消息
就会在一个新的执行轮次里继续，旧的轮次原样保留为不可变事实。这里没有另外一个"重试"或
"重新规划"按钮要你去找 —— 一个只能靠特殊词汇离开的状态，就是一个你没法用普通动作离开的状态。

### 二、结果不能拿来用

报告说成功了，但交上来的是一段你没法核对的总结。

交接是带出处和精确定位的类型化 Artifact，跨因果边界读取，而这条边界只暴露已完成的前序输出。
宿主独立于任何 agent 的自述记录文件改动和命令结果。事实核查、完整性复核和视觉质量保证都是
有名字的阶段，各自有自己的 agent。一个合格的 Work Artifact —— 目前是可编辑的演示文稿
profile —— 只有在被渲染、检查并拿到校验回执之后才算交付。

### 三、工作流永远不会变好

第十次运行重复第一次的错误，因为那次纠正随着对话一起死了。

把你真正想要的告诉专家团，它会根据你说的话起草一份修订；你点头，回执就是撤销凭据。或者跑一次
有度量的进化实验室 campaign。没有你的确认，什么都不会安装 —— 见下一节。

边界是真的：无人值守的工作只在你的运行时在线时继续，产出仍然取决于模型、能访问的来源和拿到的
证据。完整说明见[长程工作在哪里断](https://opencorvus.com/zh-cn/concepts/long-horizon/)。

## 专家团组合起来

最长的工作不是一支队伍干更久，而是几支各自负责一段，每一段都交给下一段一份它读得懂的东西。

Mission 在启动时记录哪些专家团 ID 可用；之后再安装的能力不会悄悄把这个集合撑大。每个子 Task
再把一个被准入的 ID 解析到一个精确的包版本加上它选定的工作流，在该 Task 的整个生命周期里固定。
组合发生在 Mission 层，归属留在 Task 层。

目录里现成的组合：

| 组合                          | 链路                                                                                                                                       | 专家团 · 角色 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| DeBERTa 研究工程              | 深度研究 → Advanced → 数据分析 → 研究工作室 → 学术论文审查 → Base                                                                             | 6 · 44        |
| 让 OpenCorvus 写自己的系统论文 | 科研设计 → 深度研究 → Advanced → 数据分析 → 复核与调试 → 专利版图 → Office 交付 → 研究工作室 → 学术论文审查                                    | 9 · 55        |
| 交易尽调                      | 并购尽调 → 法务会计调查 → 商事法律 → 税务合规 → 内审控制保证                                                                                  | 5 · 29        |
| 从一次事故到沉淀下来的知识    | 服务可靠性事故处置 → 数字取证调查 → 复核与调试 → 知识库运营                                                                                   | 4 · 18        |
| 把东西发出去                  | 产品管理 → 市场与增长 → SEO 与生成式引擎优化 → 产品视频 → 本地化与适配                                                                        | 5 · 26        |

在一段交付可以被独立负责、独立验收或被别人依赖的地方切开。为切而切只会制造没有主人的协调开销。
见[专家团组合](https://opencorvus.com/zh-cn/concepts/squad-composition/)。

## 会修订自己的专家团

专家团是一个带版本的包，不是你改过一次的提示词。两条路径通向一次修订，终点都是一次必须由你
给出的确认。

**从你说过的话来。** 说出一个持久的偏好 —— 那种下次同类任务还会成立的偏好 —— 宿主会复制精确的
已安装版本、套用改动、把结果校验成一个可运行的包，然后挂起一个携带你这条偏好的候选；起草的
agent 被要求逐字复现你的原话，而不是转述。能力不允许变宽：一个授予专家团原本没有的 Tool、
Skill、base role 或引用的候选会被拒绝。声称改写了冲突指令的说法会被拿去和字节比对 ——
说改写、实际只追加，候选同样被拒绝。（追加会让那条更旧、更具体的指令继续生效，这也是一次修订
看起来什么都没改的常见原因。）

**从度量结果来。** 进化实验室专家团会在任何候选被起草*之前*先冻结目标版本、用例、评分器、
环境、对照臂顺序、预算和变异面，然后跑对照臂，并把完整性复核和对比建议作为类型化、持久化的
Artifact 产出。

只有三个操作会改变一个已安装的包 —— `feedback_revision`、`promotion` 和 `restoration` ——
每一个都要求一条真实的操作者消息，绑定到那个精确的 Project、Task 和 root Session，并且携带
该改动对应的精确确认文本。**OpenCorvus 不会在后台改自己的专家团**：没有自主重写循环，也没有
哪个修订会因为某个指标动了就装上去。一个目标持有过的每一个版本都会留在列表里，而恢复就是针对
这张列表的撤销 —— 它引用一份更早的变更回执，把目标退回到那份回执本身见证过的版本。见
[专家团怎么进化](https://opencorvus.com/zh-cn/expert-squads/evolution/)。

## 首次启动就在跑的，以及你能换掉的

下面每一项装完就在跑，同时每一项也都是配置面。

| 层                | 开箱即用                                                                                                                                | 怎么换                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Agent 循环**    | 五个角色 —— `coding`、`chat`、`work`、`control`、`mission` —— 跑在流式循环上，工具结果是类型化的。                                          | `agent`、prompt 覆盖                   |
| **工具**          | 43 个内置工具（`bash`、`read`、`edit`、`search_code`、`websearch`、`browser_preview`、`memory`、`planner`、`delegate_agent` 等），外加 MCP（Model Context Protocol，模型上下文协议）服务器和插件。浏览器与计算机控制作为默认能力块提供。 | `tools`、`mcp`、`plugin` |
| **模型**          | 一份内置目录解析出 87 个供应商、2,579 个模型，含本地运行时。                                                                                | `model`、`small_model`、`provider`     |
| **上下文**        | 自动压缩与逐回合上下文预算，让长时间运行留在窗口内。                                                                                        | 模型与预算配置                         |
| **记忆**          | 项目与会话记忆，支持检索、整理和显式注入。                                                                                                  | `instructions`、记忆配置               |
| **权限**          | 每一次副作用在执行前都要通过唯一一个持久化的 allow / ask / deny 授权。                                                                       | `permission` 规则、shell 作用域        |
| **专家团**        | 119 支可检查的专家团 —— 4 支内嵌即用、115 支可导入。一个 Task 锁定一个精确版本，中途不会被悄悄换掉。                                          | `expert_squads`，或者自己写            |
| **持久化执行**    | 进程租约、事件日志和协调器让有主的工作在重启后接着跑。                                                                                       | 平台保证                               |
| **验证**          | 完整性复核、事实核查和视觉质量保证都是有名字的阶段。                                                                                         | 验收配置                               |
| **证据**          | 宿主观测独立于任何 agent 的总结，记录文件改动和命令结果。                                                                                    | 平台保证                               |
| **接入面**        | 桌面端、带 SSE（Server-Sent Events，服务器发送事件）的 HTTP API（Application Programming Interface，应用程序接口）、13 个聊天渠道、定时自动化。 | SDK、插件 API、Agent Client Protocol |

## 改成你自己的

配置就一个项目文件：`<repo>/.opencorvus/opencorvus.jsonc`。里面没有任何一项是必填的；
出厂默认只是起点，不是边界。

```jsonc
{
  "$schema": "https://opencorvus.ai/config.json",
  "model": "github-copilot/claude-haiku-4.5",

  // 每一次副作用在执行前都要过这道授权。后声明的规则覆盖先声明的。
  "permission": {
    "bash": { "git push*": "deny", "*": "allow" },
    "webfetch": "allow",
  },

  "instructions": ["./docs/house-rules.md"],
}
```

单条规则的动作是 `allow` 和 `deny`。没被规则命中的调用是先问你还是直接放行，取决于项目的
`permission_mode` —— `full_access`（默认）或 `ask`，在会话第一次发生带权限的调用时冻结。

| 你想…                     | 配置                                             |
| ------------------------- | ------------------------------------------------ |
| 换模型或供应商            | `model`、`small_model`、`provider`               |
| 增加或限制能力            | `tools`、`mcp`、`plugin`                         |
| 改谁能干什么              | `permission` 规则（allow / deny）和 shell 作用域 |
| 重新定义某个 agent 的行为 | `agent` 配合 `prompt` 或 `prompt_append`         |
| 替换或覆盖某支专家团      | `expert_squads`                                  |
| 加项目上下文或团队规矩    | `instructions`                                   |
| 加可复用的操作            | `command`、`formatter`、`keybinds`               |

完整配置面见[配置参考](https://opencorvus.com/zh-cn/config/)。配置之外，还有三条扩展路径，
让 Harness 本身保持开放：

- **JavaScript SDK** —— [`packages/sdk/js`](./packages/sdk/js)，附带发布的
  [OpenAPI 描述](./packages/sdk/openapi.json)，用你自己的代码驱动 Task。
- **插件 API** —— [`packages/plugin`](./packages/plugin)，写自定义工具、产物生产者和证据源。
- **开放协议** —— 用 MCP 服务器扩展能力，用 Agent Client Protocol 把 OpenCorvus 嵌进别的客户端。

把专业知识打包成一支专家团也是同一类事：角色、工作流、Skills、工具、适用说明、版本和 digest
一起走，而且始终可以打开看。见[专家团作者路径](https://opencorvus.com/zh-cn/publish/)。

## 它在整个生态里的位置

### 和最接近的两个比

每一格都是关于已公开能力的可核查事实，不是评价。

| | [WorkBuddy](https://www.workbuddy.ai/) | [DeepSeek Harness](https://www.deepseek.com/harness/) | **OpenCorvus** |
| -------- | ---------------------- | ------------------------ | ---------------------------------- |
| 许可     | 商业，Token 套餐计费    | MIT 开源                 | **MIT 开源**                       |
| 运行位置 | 云端服务                | 本地                     | **本地或你自己的服务器**           |
| 出发点   | 一句话交付成品          | 插件内核，能力自行组合    | **完整 harness 开箱即用，再逐层替换** |
| 能力封装 | 平台内的 Expert Group   | 插件生态                 | **带版本与 digest 的专家团（119 支）** |
| 上手     | 桌面客户端              | `npx` 一行拉起 Web UI     | **安装包或源码构建**               |

DeepSeek Harness 同样是 MIT 开源，也同样把运行过程完整留痕；它的插件内核比我们更彻底。
选它还是选这里，取决于你要的是自己拼一套，还是拿到一套再改。

### 大家真正会问的问题

<details>
<summary><strong>和 Claude Code、Codex 这类编码助手是什么关系？</strong></summary>

不在一层，而且能一起用。它们是绑定各自厂商模型的编码会话，OpenCorvus 是底下那层 harness：
模型无关、多 Agent 协调、自托管。桌面端还能认出本机装好的 Claude Code、Codex、Gemini Code、
GitHub Copilot、GLM Code，在当前项目目录直接打开。
</details>

<details>
<summary><strong>我已经在用其中一个，还有必要吗？</strong></summary>

看你缺哪一块。只是想要更好的单次编码对话，不必换。需要跨任务协调、锁版本的专家团、统一的
权限与证据、重启后接着跑 —— 那是这里在做的事。
</details>

<details>
<summary><strong>代码会离开我的机器吗？</strong></summary>

运行时在你自己的机器或服务器上，MIT 开源，源码全都能审。模型请求只发给你自己配的 provider；
用本地模型就完全不出网。
</details>

<details>
<summary><strong>「专家团」到底是什么？</strong></summary>

一个能打开看的能力包：角色、工作流、Skills、工具、适用说明、版本和 digest 冻在一起。任务创建
时锁死一个版本，中途不会被悄悄换掉。资源包在落盘前先校验签名和 SHA-256。
</details>

<details>
<summary><strong>这套东西是自己写的吗？</strong></summary>

是。后端 harness 和桌面前端都在这个仓库里，底下没有套第三方 Agent 引擎 —— 这样每一层才换得动。
它站在很多开源项目的肩膀上：Bun、AI SDK、SolidJS、Tauri。
</details>

<details>
<summary><strong>长程到底能长到什么程度？</strong></summary>

取决于你的运行时在不在线。工作能扛过重启，靠的是租约、事件日志和协调器，不是靠某个进程一直
活着。已完成、已失败或已取消的任务，收到你下一条消息就在新的执行轮次里继续，旧历史原样保留。
</details>

<details>
<summary><strong>它会背着我改自己吗？</strong></summary>

不会。修订会被起草、校验成可运行的包并挂起，只有你用自己的消息确认之后才安装；返回的回执就是
恢复上一个版本的凭据。
</details>

## 它做不到什么

明说，因为一个永远只赢的工具是一个你会停止相信的工具。

- 它协调兼容的模型、工具和执行器。它没法让任意第三方代码变得兼容或安全。
- 持久化的 Task 可以恢复，但**运行时离线时不会有任何工作在执行**。它不是托管服务，也不承诺
  无限自治。
- 结果取决于模型行为、来源可达性、已安装能力，以及这次运行拿到的证据。
- 项目处于活跃开发中。接口和打包的集成在 beta 版本之间可能变化。

## 接入面与集成

| 接入面           | 状态       | 提供什么                                                                                                            |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| 桌面工作台       | 可用       | 会话、Mission、Task、专家团、证据与交付复核                                                                          |
| 无界面 HTTP API  | 可用       | Task 生命周期路由与 SSE 进度流                                                                                       |
| Slack 网关       | 可用       | 从一个 Slack thread 启动并操作编排工作                                                                               |
| 多渠道适配器     | 仓库内     | Slack、Telegram、Discord、飞书、WhatsApp、Google Chat、Microsoft Teams、Line、Matrix、Mattermost、Signal、企业微信、钉钉 |
| GitHub Action    | 可用       | 仓库自动化，见 [`github/README.md`](./github/README.md)                                                              |

常用 Task 端点 —— 标了*需要目录*的，要在 `x-opencorvus-directory` 头里带上 Task 的项目目录：

| 端点                        | 用途                 | 需要目录 |
| --------------------------- | -------------------- | -------- |
| `GET /tasks`                | 列出项目 Task        | 是       |
| `GET /task/<id>`            | Task 状态            | —        |
| `GET /task/<id>/board`      | 看板视图             | —        |
| `GET /task/<id>/events`     | SSE 流，可断点续接   | —        |
| `POST /task/<id>/message`   | 追加一条后续消息     | 是       |
| `POST /task/<id>/retry`     | 用同一方案重试       | 是       |
| `POST /task/<id>/replan`    | 丢弃方案，重新规划   | 是       |
| `POST /task/<id>/cancel`    | 取消                 | 是       |

### Slack

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_APP_TOKEN=xapp-...
bun run --cwd packages/channel-runtime dev
```

网关从 thread 的第一条消息启动工作，镜像规划和交付更新，接受 `allow`、`always`、`reject`
这类权限回复，并把操作者的后续消息带回 Task。

### 从别的助手控制 OpenCorvus

仓库里带了一个可移植的 [`opencorvus` Agent Skill](./skills/opencorvus/SKILL.md)。它教任何兼容
Agent Skills 的助手怎么检查、配置、运行和排查 OpenCorvus；怎么创建和监控 Task、发送后续输入、
复核交付证据。装这个 skill **不会**装上运行时 —— 先完成上面任一条安装路径，再把整个 skill
目录连同 [`references/`](./skills/opencorvus/references/) 一起复制过去。

```bash
# Hermes Agent
mkdir -p ~/.hermes/skills/developer-tools
cp -R ./skills/opencorvus ~/.hermes/skills/developer-tools/opencorvus
hermes skills list

# OpenClaw
openclaw skills install ./skills/opencorvus --as opencorvus
openclaw skills check
```

开一个新会话，然后用 `/opencorvus`（Hermes、消息渠道）或 `$opencorvus`（OpenClaw 控制界面）
调用它：

```text
/opencorvus 检查 OpenCorvus 是否已安装且健康。不要改动任何东西。
```

具体宿主的安装细节、PowerShell 命令、凭据的安全处理和完整操作示例，见
[`skill-installation`](./skills/opencorvus/references/skill-installation.md) 和
[`operations`](./skills/opencorvus/references/operations.md) 两份参考。

## 核心模型

| 对象         | 职责                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------- |
| Mission      | 协调跨多个 Task 的结果，并记录它们之间的依赖。                                                |
| Task         | 拥有一个项目域内的工作单元、一支固定的专家团、选定的工作流、它的 Session 以及生命周期决策。    |
| 专家团       | 打包 agent 名册、指令、Skills、工具、MCP 访问权限和声明的工作流。                              |
| 工作流       | 声明一个 Task 会运行哪些 agent，以及它们的依赖顺序。                                          |
| Artifact     | 存放带出处的类型化输出或文件快照，让另一个 agent 或 Task 能读到精确结果。                      |
| 宿主观测     | 独立于 agent 的自述，记录文件改动、命令结果这类事实。                                          |

对一个 Task 来说，选定的专家团保持固定，选定的工作流同样固定。Worker 流式产出消息和工具调用，
在契约要求时发布 Artifact，并把精确的 Artifact 引用传给下游 worker。编排器依据这些记录和宿主
观测做生命周期决策。没解决的限制和阻塞会留在 agent 消息里，不会被抹平进一句总结。

![Mission 与专家团执行流程](assets/agent-teams-workflow.png)

## 开发

```bash
# 仓库根目录
bun install

# 核心命令行与编排器
bun run --cwd packages/opencorvus typecheck
bun run --cwd packages/opencorvus test

# 渠道运行时适配器
bun run --cwd packages/channel-runtime test

# 重新生成 JavaScript SDK
bun ./packages/sdk/js/script/build.ts
```

仓库结构、构建细节和发布流程见 [`CODEBASE_STRUCTURE.md`](./CODEBASE_STRUCTURE.md)、
[`BUILD_AND_DEV_QUICKSTART.md`](./BUILD_AND_DEV_QUICKSTART.md) 和 [`RELEASE.md`](./RELEASE.md)。

## 文档与参与

- 文档：<https://opencorvus.com/zh-cn/start/quickstart/>
- 更新日志：[`CHANGELOG.md`](./CHANGELOG.md)
- GitHub Action：[`github/README.md`](./github/README.md)
- 参与贡献：[`CONTRIBUTING.md`](./CONTRIBUTING.md)
- 获取支持：[`SUPPORT.md`](./SUPPORT.md)
- 安全策略：[`SECURITY.md`](./SECURITY.md)
- 行为准则：[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- 第三方声明：[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)

Issue 和专家团都欢迎。如果你写的某支专家团比我们内置的干得更好，那是我们最想要的贡献。

## 开源致谢

OpenCorvus 从 [OpenCode](https://github.com/anomalyco/opencode) 代码库演进而来，并且在模型
供应商、GitHub Copilot 和 provider 插件几个面上仍然保留着显式同步的 OpenCode 工作。感谢
OpenCode 的维护者与贡献者提供的这份基础。

主要的运行时与分发依赖包括：

- **运行时与 Agent 核心：**[Bun](https://github.com/oven-sh/bun)、
  [Vercel AI SDK](https://github.com/vercel/ai)、
  [Hono](https://github.com/honojs/hono)、
  [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm)。
- **开放互操作：**官方
  [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)、
  [MCP Apps](https://github.com/modelcontextprotocol/ext-apps)、
  [Agent Client Protocol TypeScript SDK](https://github.com/agentclientprotocol/typescript-sdk)。
- **桌面应用：**[Tauri](https://github.com/tauri-apps/tauri)、
  [SolidJS](https://github.com/solidjs/solid)、
  [Kobalte](https://github.com/kobaltedev/kobalte)。
- **执行与证据：**[Playwright](https://github.com/microsoft/playwright)、
  [CUA](https://github.com/trycua/cua)、
  [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI)。
- **打包的命令行运行时：**[Node.js](https://github.com/nodejs/node)、
  [ripgrep](https://github.com/BurntSushi/ripgrep)。
- **交互式工作台：**[CodeMirror](https://github.com/codemirror/dev)、
  [xterm.js](https://github.com/xtermjs/xterm.js)、
  [Mermaid](https://github.com/mermaid-js/mermaid)、
  [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)、
  [PDF.js](https://github.com/mozilla/pdf.js)、
  [Reveal.js](https://github.com/hakimel/reveal.js)、
  [Vega-Lite](https://github.com/vega/vega-lite)、
  [Cytoscape.js](https://github.com/cytoscape/cytoscape.js)、
  [Univer](https://github.com/dream-num/univer)。
- **内置能力来源：**内置的设计与访谈 Skills 借鉴了
  [Taste Skill](https://github.com/Leonxlnx/taste-skill) 和
  [Matt Pocock's Skills](https://github.com/mattpocock/skills) 的思路与协议。它们的出处与许可
  文件随改编后的 Skills 一起保留。
- **文档：**[Astro](https://github.com/withastro/astro)、
  [Starlight](https://github.com/withastro/starlight)。

完整的依赖与声明记录在仓库清单和 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) 中。
每个上游项目保留各自的许可与商标。

## 许可证

[MIT](./LICENSE)
