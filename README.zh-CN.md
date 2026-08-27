<p align="center">
  <img src="assets/readme-head.png" alt="OpenCorvus" width="440" />
</p>

<h3 align="center">能跑完的长任务，还会越跑越好。</h3>

<p align="center">
  <a href="https://github.com/yangheng95/opencorvus/releases"><img alt="最新版本" src="https://img.shields.io/github/v/release/yangheng95/opencorvus?include_prereleases&sort=semver&label=release&color=2946d3" /></a>
  <a href="./LICENSE"><img alt="许可证" src="https://img.shields.io/github/license/yangheng95/opencorvus?color=2946d3" /></a>
  <img alt="项目状态：Beta" src="https://img.shields.io/badge/status-beta-e04b22" />
</p>

<p align="center">
  <a href="./README.md">English</a> · <strong>简体中文</strong> ·
  <a href="https://opencorvus.com/zh-cn/">文档</a> ·
  <a href="https://opencorvus.com/zh-cn/market/">专家团</a> ·
  <a href="https://github.com/yangheng95/opencorvus/releases/latest">下载</a>
</p>

---

OpenCorvus 是把模型变成 agent 的那层运行时 —— 循环、工具路由、上下文管理、记忆、权限、
恢复、调度。冲着跑得久的活儿做的。

长任务跑到一半死了，大家习惯怪模型。多数时候不是模型。再强的模型，放进一个会丢任务状态的
运行时里，照样跑不彻底。

项目已发布的证据显示：**OpenCorvus Mission 在 100 个 AutomationBench case 上的严格通过率为
34.00%**。页面展示的 Luna **8.07%** baseline 来自外部参考，并不是仓库内已版本化了数据集、
评分器和逐 case 结果的同批对照运行；这两个数字只能作为背景，不能解读为受控的 4.21 倍提升。

## 跑起来

从[最新 Release](https://github.com/yangheng95/opencorvus/releases/latest) 下个安装包，
或者从源码构建：

```bash
git clone https://github.com/yangheng95/opencorvus.git
cd opencorvus && bun install
bun run --cwd packages/opencorvus build
bun packages/opencorvus/src/index.ts doctor   # 缺什么它会告诉你
```

然后在你想让它干活的仓库里起服务：

```bash
cd ~/your-repo
opencorvus serve
```

工作台在 `http://127.0.0.1:7878/ui/`。或者直接走 HTTP：

```bash
curl -X POST http://127.0.0.1:7878/task \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PWD" \
  -d '{"request": "为 src/foo.ts 补单元测试，覆盖正常路径和两条错误路径。"}'

curl -N http://127.0.0.1:7878/task/<task_id>/events   # 断了用 ?after=<sequence> 续上
```

> 不设 `OPENCORVUS_SERVER_PASSWORD` 就把 `serve` 暴露到 localhost 之外，它照样会起，
> 只打印一行 `server is unsecured`。那行字就是你的仓库和整个网络之间唯一的东西。

## 装完就有的东西

- **119 支专家团** —— 带版本的能力包：角色、工作流、Skills、工具、适用说明、版本和 digest
  冻在一起。4 支内嵌即用，115 支可导入。任务创建时锁死一个版本，中途不会被悄悄换掉。
- **87 个供应商、2,579 个模型**，来自同一份内置目录，含本地运行时。
- **43 个内置工具**，外加 MCP（Model Context Protocol，模型上下文协议）服务器和插件。
- **可持久化的执行** —— 租约、事件日志和协调器。有主的工作在重启后接着跑；已完成、已失败
  或已取消的任务，收到你下一条消息就在新的执行轮次里继续。
- **接入面** —— 桌面端、带 SSE 的 HTTP API、13 个聊天渠道、GitHub Action、定时自动化。

上面每一项同时也是配置面。一个项目文件（`<repo>/.opencorvus/opencorvus.jsonc`）就能换模型、
收窄工具、收紧权限，或者替换整支专家团 —— 不用改源码。

## 这个项目不肯做的几件事

下面这些是代码真的被约束着的规矩，不是口号。

- **不许有 fallback。** 修源头，不修消费端。一个能力只能有一个实现、一个事实来源 ——
  没有影子状态，没有兼容层，没有"先兜一下让它跑起来"。
- **不拿猜出来的总时长限制开放式 agent 工作。** 模型和 Task 不会因为任意墙钟到点就被终止，
  活性由可观察的无活动边界判断；网络请求、启动、benchmark 观察和清理等有界子操作仍各自拥有
  明确的墙钟 deadline。
- **子 agent 就是 agent。** 每一个都有自己的模型、工具和推理循环，不是套上"委派"外衣的
  宿主函数调用。
- **不许拿关键字顶替真东西。** 不靠匹配字符串给 agent 指路，也不靠它冒充沙箱。一条换个说法
  就能绕过去的黑名单，骗到的只有写它的人。
- **不会背着你改自己。** 修订会被起草、校验成可运行的包并挂起，你确认之后才安装，
  返回的回执就是撤销凭据。

还有一条，不亲身撞上会以为是玩笑：worktree 隔离的是文件系统，**不是进程表**。所以 `bash`
直接拒绝 `taskkill /IM`、`killall`、`pkill` —— 一个 agent 在清理"自己的"进程时，不该有能力
把你整台机器一起带走。

## 它做不到什么

- 运行时离线时什么都不会执行。它不是托管服务，也不承诺无限自治。
- 结果取决于你选的模型、它能访问的来源、你装的能力，以及这次运行拿到的证据。
- 它协调兼容的模型、工具和执行器，没法让任意第三方代码变得兼容或安全。
- 还在 beta，而且跑得很快 —— 从 `0.0.35beta` 到 `0.0.55beta` 之间是 743 个提交、二十个版本。
  接口和打包的集成会在版本之间变。

## 其余的都在这儿

| | |
| --- | --- |
| [快速开始](https://opencorvus.com/zh-cn/start/quickstart/) · [配置](https://opencorvus.com/zh-cn/config/) · [工具](https://opencorvus.com/zh-cn/tools/) · [权限](https://opencorvus.com/zh-cn/permissions/) | 把活干成 |
| [长程](https://opencorvus.com/zh-cn/concepts/long-horizon/) · [架构](https://opencorvus.com/zh-cn/concepts/architecture/) · [Mission](https://opencorvus.com/zh-cn/concepts/mission/) | 底下是怎么转的 |
| [专家团](https://opencorvus.com/zh-cn/market/) · [组合](https://opencorvus.com/zh-cn/concepts/squad-composition/) · [进化](https://opencorvus.com/zh-cn/expert-squads/evolution/) · [发布](https://opencorvus.com/zh-cn/publish/) | 能力层 |
| [SDK](./packages/sdk/js) · [OpenAPI](./packages/sdk/openapi.json) · [插件](./packages/plugin) · [GitHub Action](./github/README.md) | 在上面接着建 |
| [参与贡献](./CONTRIBUTING.md) · [更新日志](./CHANGELOG.md) · [安全](./SECURITY.md) · [支持](./SUPPORT.md) | 一起做 |

有一个 4 分钟的产品故事，有声旁白带字幕，比读字快：
[简体中文](https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-zh-CN.mp4)
· [English](https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-en-US.mp4)。
一次 12 小时 Mission 的审计证据是公开的 —— 从模型训练一路到经审校的论文和推上去的仓库：
[`deberta-v3-absa-public-evidence`](https://github.com/yangheng95/deberta-v3-absa-public-evidence)。

Issue 和专家团都欢迎。如果你写的某支专家团比我们内置的干得更好，那是我们最想要的贡献。

## 站在谁的肩膀上

OpenCorvus 从 [OpenCode](https://github.com/anomalyco/opencode) 演进而来，并且在模型供应商、
GitHub Copilot 和 provider 插件几个面上仍保留着显式同步的 OpenCode 工作。感谢它的维护者们
提供的这份基础。

后端 harness 和桌面前端都写在这个仓库里，底下没有套第三方 Agent 引擎 —— 这样每一层才换得动。
它站在大量开源项目的肩膀上：[Bun](https://github.com/oven-sh/bun)、
[Vercel AI SDK](https://github.com/vercel/ai)、[Hono](https://github.com/honojs/hono)、
[Drizzle](https://github.com/drizzle-team/drizzle-orm)、[Tauri](https://github.com/tauri-apps/tauri)、
[SolidJS](https://github.com/solidjs/solid)、[Playwright](https://github.com/microsoft/playwright)、
[MCP](https://github.com/modelcontextprotocol/typescript-sdk) 与
[ACP](https://github.com/agentclientprotocol/typescript-sdk) 的官方 SDK，以及更多。
完整记录在 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)，每个上游项目保留各自的
许可与商标。

## 许可证

[MIT](./LICENSE)
