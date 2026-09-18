<p align="center">
  <img src="assets/readme-head.png" alt="OpenCorvus" width="280" />
</p>

<h1 align="center">复杂任务，协同推进。</h1>

<p align="center">
  <strong>面向长程、复杂任务的多智能体调度系统。</strong><br/>
  开源，可自托管。
</p>

<p align="center">
  <a href="https://github.com/yangheng95/opencorvus/releases/latest">下载</a> ·
  <a href="https://opencorvus.com/zh-cn/">官网</a> ·
  <a href="https://opencorvus.com/zh-cn/start/quickstart/">快速开始</a> ·
  <a href="https://opencorvus.com/zh-cn/market/">专家团</a> ·
  <a href="./README.md">English</a>
</p>

---

OpenCorvus 将调研、设计、实现与独立复核组织在同一任务中。
专家按职责与依赖开展工作，产物连接各个阶段，复核发现的问题回到实现修正。

[![有向执行图：调研分支汇入架构，实现分支进入复核，两条修正边返回实现](packages/web/public/media/task-coordination-zh.svg)](https://opencorvus.com/zh-cn/#execution)

_角色与修正主题来自任务记录，连线采用工作流示意；返工起点不代表事件归因。非原始产品界面或精确执行时序。_

## 各有所长，彼此相连。

**专家团（Expert Squad）** 将专业角色、工具与工作流组合在一起。
**Mission（任务编排）** 围绕目标协调任务与专家团。
从软件交付到[跨领域项目](https://opencorvus.com/zh-cn/concepts/squad-composition/)，按需要选择合适的流程。

## 任务继续，上下文也继续。

目标、阶段与产物随任务保留。中途补充决定，或在交付后继续修改，都可以在同一个任务里展开。
执行需要运行时在线、模型服务可用。

## 完成之后，再看一遍。

选择含独立复核的专家团，由不同角色检查实现与证据，发现问题后修正、再复核。
交付保留仍未解决的限制；仅凭完成状态，不能判断结果是否准确。

## 真实案例：做一个坦克大战网页游戏

一句需求，在一个交付专家团内展开为 **19 项验收要求**、**35 关数据溯源**，
并经历 **两轮修正回流**。

1. **调研与定需求：** 确定原版基准、玩法规则、范围与验收标准。
2. **设计：** 明确架构、数据契约和像素界面状态。
3. **实现：** 接通地形、敌坦、道具、计分、双人同屏与建造模式。
4. **复核与修正：** 独立测试、界面复核、系统审查将发现的问题交回实现。
5. **交付：** 汇总产物、验证证据和仍然存在的限制。

两轮回流体现了调度的价值：一轮修复跨关计分与结算呈现；
另一轮根据操作者对数据来源的裁定，替换地图与敌坦编成，再进行核对。

[查看完整案例](https://opencorvus.com/zh-cn/cases/tank-battle/) ·
[查看来源摘录](./specs/artifacts/2026-09-19-task-coordination/source-excerpts.json)

这次任务有人工裁定参与，不用于宣称与原版完全等价、成本节省或普遍成功率。
留存测试报告与收尾报告存在差异，部分真实游玩证据也未补齐，案例中保留了这些边界。

## 从你手头的项目开始

1. [下载桌面应用](https://github.com/yangheng95/opencorvus/releases/latest)，支持 Windows、macOS 和 Linux。
2. 打开项目，配置可用的模型提供商并选择模型。
3. 选择合适的专家团，说明目标、范围和验收标准。
4. 查看交付文件与证据，在同一任务里补充反馈。

可以这样描述任务：

> 检查这个项目的导入流程，复现我提供的问题，修复根因并验证真实操作路径。
> 交付改动文件、验证证据和剩余限制；不要发布上线。

[逐步上手](https://opencorvus.com/zh-cn/start/quickstart/) ·
[安装说明](https://opencorvus.com/zh-cn/start/install/) ·
[选择专家团](https://opencorvus.com/zh-cn/market/)

## 工作过程由你掌握

OpenCorvus 开源，可在本机或托管环境运行。模型、工具、权限和专家团流程由你选择。
长期有效的反馈可以形成[专家团修订](https://opencorvus.com/zh-cn/expert-squads/evolution/)，经你确认后采用。

执行需要运行时在线、模型服务可用。耗时、成本和结果质量取决于任务、模型、工具与可获得的证据。
重要结果仍需要检查，必要授权和关键决定由你掌握。

## 开发与集成

源码安装前请先准备[开发依赖](./CONTRIBUTING.md#developing-opencorvus)，
Windows 包括原生 Rust/C++ 工具链。

```bash
git clone https://github.com/yangheng95/opencorvus.git
cd opencorvus
bun install
bun run --cwd packages/opencorvus build
bun packages/opencorvus/src/index.ts doctor
```

源码启动与模型配置见[快速开始](https://opencorvus.com/zh-cn/start/quickstart/)。
集成入口包括 [HTTP 接口](https://opencorvus.com/zh-cn/reference/api/)、
[外部 Agent 接入](https://opencorvus.com/zh-cn/integrations/agent-hosts/)和 [GitHub Action](./github/README.md)。

- [参与贡献](./CONTRIBUTING.md) · [更新记录](./CHANGELOG.md) · [支持](./SUPPORT.md)
- [安全](./SECURITY.md) · [行为准则](./CODE_OF_CONDUCT.md)
- [运行时架构](./specs/current/architecture/README.md) · [长程执行](https://opencorvus.com/zh-cn/concepts/long-horizon/)
- [概念验证论文——研究中](https://opencorvus.com/papers/opencorvus-poc.pdf)

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
