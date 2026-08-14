# OpenCorvus Promotion Case Engine Strategy

## Recall

| Item | Record |
| --- | --- |
| User request | 调查并分析如何用大量案例推广 OpenCorvus。用户已有方向包括复杂任务录屏剪辑、游戏生成、由 `grill-me` 驱动的网站设计、`autoresearch`、Feature 展示和 User Interface（UI，用户界面）展示，希望得到最佳策略。 |
| Desired outcome | 给出能持续生产大量案例、又能让受众记住 OpenCorvus 差异的定位、案例组合、制作模板、渠道、节奏、指标和首批选题。 |
| Acceptance | 策略必须基于当前仓库能力和真实运行证据；区分流量案例与信任案例；提供可直接执行的首月计划；不把尚未生成、渲染、发布或验证的内容描述成已经完成。 |
| Hard constraints | OpenCorvus 当前定位是面向长程任务的开源 Agent Workbench；每个 Task 固定一个 Expert Squad 及其版本；协作、工具结果、Artifact、宿主观察、权限和验收证据保持可见。推广案例不得虚构效果、客户、指标或媒体产物。 |
| Repository sources read | `README.md`、`README.zh-CN.md`、`packages/web/src/content/landing.ts`、`CHANGELOG.md`、`specs/current/architecture/README.md`、`2026-08-12-advanced-requirements-grill-me-trial.md`、`expert-squads/builtin/{frontend-innovate,deep-research,evolution-lab,marketing-growth,product-video,viral-content,one-person-company-operating-system}/**`、内置 Expert Squad 清单以及相关 benchmark 记录。 |
| Whole-repository search | 搜索了 promotion、marketing、demo、video、case study、game、`grill-me`、`autoresearch`、frontend、benchmark 等相关记录与能力。仓库当前有 116 个内置 Expert Squad；存在真实长任务、算法修复、前端、研究、自演化与需求澄清证据，但没有统一的公开案例产品面。未检索到名为 `autoresearch` 的当前内置 package；本文将它视为“自动研究/实验闭环”内容方向，而不是已存在的同名产品 Feature。 |
| External research | OpenAI、Anthropic、Cursor 的近期官方产品/客户案例；GitHub 面向开源维护者的推广建议；YouTube、TikTok、LinkedIn 的官方视频与衡量资料；OpenCorvus 官网与 GitHub 当前公开呈现。完整链接见文末。 |
| Existing dirty worktree | 工作区存在大量其他任务改动。本文只新增本记录并向两个 spec 索引追加精确条目，不触碰其他改动。 |
| Independent agent feedback | 独立只读审查发现首版把 Advanced 的 `grill-me` 与独立 `frontend-innovate` package 写成了看似可在同一 Task 中串接的链路；已改为 Advanced `greenfield-interface-visual-delivery` 单 Task，并把跨 Squad 版本明确建模为 Mission 下的两个固定 Task 与精确 Artifact 导入。审查还要求对被忽略的新 spec 和两个含并行改动的索引执行精确 staging。 |

## Executive decision

OpenCorvus 不应被推广成“又一个一句话生成网站或游戏的 AI”。网站、游戏和漂亮 UI 是高效的流量入口，但它们本身无法解释为什么用户需要 OpenCorvus，而不是任意一个生成式编码工具。

应把推广组织成一个可重复的 **Case Engine（案例引擎）**：

1. 用高视觉结果获得注意力；
2. 用任务过程中的分工、澄清、失败、恢复和人工决策建立差异；
3. 用真实页面、测试、引用、Artifact 和可复现输入证明完成；
4. 用同一份完整案例派生短视频、长视频、图文、案例页和可复现仓库；
5. 用观看和激活数据决定下一批案例，而不是一次性制作宏大品牌片。

推荐的一句话内容承诺是：

> **See a real team of agents carry ambiguous work to reviewed delivery.**<br>
> 看一支可检查的 Agent 团队，如何把模糊任务推进到经过验收的交付。

这条承诺能同时容纳游戏、网站、研究、工程修复、专业工作流、权限和 UI，又与当前产品的 Workbench、Expert Squad、Task、Mission 和 evidence 模型一致。

## Why this strategy fits the market

近期头部 Agent 产品的公开案例已经从“能生成代码”转向“真实工作负载、端到端流程、可量化结果和组织采用”：OpenAI 的公开案例强调真实仓库、反馈回路和吞吐；Cursor 的客户页把每个故事标题直接写成业务结果；Anthropic 的内部案例覆盖工程、数据、设计、增长和法律等角色，而不只展示代码生成。这说明单纯录一段飞快滚动的终端已经很难形成可信差异。

对 OpenCorvus 更有利的空位不是宣称模型更聪明，而是展示：

- 一个任务为何需要不同责任的专家，而不是匿名 Agent 池；
- 模糊需求怎样被逐项澄清并固化成 RequirementSet；
- 长程工作如何经历失败、等待、继续、复核和最终验收；
- 哪些动作需要用户授权，哪些事实来自 Host observation 而非模型自述；
- 同一个结果怎样保留来源、版本、交接和验收证据。

因此，**结果负责吸引，过程负责区分，证据负责转化**。

## Audience and message order

前 60 天不建议同时面向所有 116 个专业领域平均发力。推荐按以下顺序建立受众：

| Priority | Audience | Their current question | The proof they need |
| --- | --- | --- | --- |
| P1 | Agent power users、开发者、技术 Founder、开源维护者 | “这和 Codex、Claude Code、Cursor 或一个 subagent wrapper 有什么不同？” | 长任务、具名责任、可见交接、真实验收、开源可检查性 |
| P2 | 产品经理、设计师、研究者、独立创业者 | “我不是纯开发者，它能否把模糊业务问题推进成可用产物？” | `grill-me`、前端创新、深度研究、数据与文档交付 |
| P3 | 团队负责人和高专业门槛领域实践者 | “能否控制权限、固定能力版本、追溯证据并复核？” | permission、Artifact、固定 Expert Squad revision、专业工作流 |
| P4 | Skill / Agent / Expert Squad 作者 | “我能否把自己的方法封装、验证并分发？” | Squad SDK、自演化、Market 安装与复用 |

首页式总叙事只需要回答“为什么 OpenCorvus”；每个案例只回答一个更窄的问题。不要在单条视频中解释所有对象和 Feature。

## The four-series content portfolio

建议把所有选题归入四个固定栏目。栏目名、封面结构和片尾 Call to Action（CTA，行动号召）保持一致，让大量案例形成记忆，而不是彼此无关的 demo。

### Series A — “Can it finish this?”（流量入口，约 40%）

高视觉、高冲突、结果一眼可懂。包括游戏、网站、数据可视化、复杂界面、文档或演示交付。它负责触达新受众，但每条必须至少露出一个 OpenCorvus 独有过程和一个验收证据。

### Series B — “The task fought back”（差异建立，约 30%）

展示真实困难：需求冲突、测试失败、错误假设、工具中断、长任务恢复、研究证据矛盾。重点不是“零人工”，而是系统如何让问题可见、如何请求精确决策、如何继续到完成。

### Series C — “Why this is a workbench”（信任建立，约 20%）

用短而清晰的 Feature/UI 片段解释权限询问、固定 Expert Squad revision、Mission 依赖、typed Artifact、证据审查、Task 恢复、Slack/API/desktop 连续性。Feature 展示不作为孤立的更新日志朗读，而要绑定一个用户风险：例如“如果 Agent 想运行这个命令，谁决定？”

### Series D — “Build the expert”（生态飞轮，约 10%）

展示如何把领域方法封装成 Expert Squad、如何检查角色和工作流、如何做 incumbent–challenger 自演化、如何贡献和复用。它服务贡献者和专业用户，也为后续社区案例供给打基础。

## Case portfolio: what to make first

评分采用 1–5 分：`Hook` 是第一眼吸引力，`Diff` 是 OpenCorvus 差异，`Proof` 是可客观验收程度，`Cost` 越高表示制作越费时。优先级不是简单求和；首批需要同时覆盖流量、差异和信任。

| Case | Hook | Diff | Proof | Cost | Role in portfolio | Decision |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Advanced 单 Task：模糊的一句话 → `grill-me` 逐项决策 → `greenfield-interface-visual-delivery` → 真实网站 | 5 | 5 | 5 | 4 | 在一个固定 Expert Squad 内串起需求、实现和独立视觉验收 | **Flagship #1** |
| “做一个好玩的游戏” → 玩法澄清 → playable build → 实际游玩与修复 | 5 | 4 | 5 | 4 | 最大众的视觉入口；必须展示可玩性而不只看画面 | **Flagship #2** |
| 自动研究闭环：假设 → 多次实验 → 失败 → 图表 → 新结论 | 4 | 5 | 5 | 5 | 证明长程任务和真实反馈回路 | **Flagship #3** |
| 在真实仓库中定位一个间歇性 bug，经历失败并恢复到测试通过 | 3 | 5 | 5 | 3 | 最适合开发者，复用现有 benchmark 证据 | **Flagship #4** |
| 同一产品 brief 的 generic one-shot 与 OpenCorvus evidence-led redesign 对照 | 5 | 5 | 4 | 4 | 直接回答“为何不是普通网站生成器” | **Flagship #5** |
| 深度研究：争议问题的多视角来源、引用审计和最终报告 | 3 | 5 | 5 | 3 | 吸引研究/知识工作受众，建立证据品牌 | **Flagship #6** |
| Permission：危险命令触发 Ask，用户拒绝后任务安全改道 | 4 | 5 | 5 | 2 | 极短、强冲突的信任内容 | **Short #1** |
| Expert Squad 自演化：incumbent vs challenger 的冻结评测与晋级建议 | 3 | 5 | 5 | 5 | 高阶差异与社区叙事 | **Long-form #1** |
| 一个 Mission 连接研究、产品、设计和实现四个 Task | 4 | 5 | 4 | 5 | 最能解释产品完整模型，但不适合作为第一条 | 第二波 |
| 复制参考网页并人工视觉比对，再修复偏差 | 5 | 4 | 5 | 3 | before/after 明确 | 第二波 |
| 30 天独立公司经营证据对账与下周三项决策 | 3 | 5 | 4 | 3 | Founder 场景，需使用公开或合成且明确标注的数据 | 第二波 |
| 学术论文审查：引用幻觉、方法重算和主张矩阵 | 3 | 5 | 5 | 4 | 专业可信度 | 第二波 |
| Slack 中启动任务，桌面审查证据，API 获取结果 | 3 | 4 | 5 | 2 | 多入口连续性 | Feature short |
| 从零创建一个新 Expert Squad 并在 Market 安装复用 | 3 | 5 | 5 | 3 | 贡献者转化 | Ecosystem tutorial |

### The three user-proposed directions

#### 1. Game generation

这是很好的 **reach case**，但不是最好的品牌锚点。常见失败是只展示 prompt、代码滚动和成品画面，观众会把功劳归给底层模型。

最佳脚本应包含：

1. 0–2 秒直接展示最有趣的实际游玩时刻和挑战：“它能不能把一句模糊想法做成真的可玩游戏？”
2. 显示原始模糊要求；由 Requirements 追问一个会实质改变玩法的决定。
3. 快速呈现设计、实现、测试/视觉审查的具名责任切换。
4. 保留一个失败：碰撞异常、关卡不可完成、帧率或输入问题。
5. 显示 Agent 根据真实运行证据修复，而不是用旁白宣称修复。
6. 最后进行 10–15 秒未经剪切的实际游玩，并叠加测试结果、耗时、模型、人工决策次数和仓库链接。

首批游戏应小而完整，例如一屏 Roguelike、物理解谜或节奏躲避；不要先挑战开放世界。验收指标应包括能启动、核心循环可完成、失败/重开状态存在、键盘输入正常和实际游玩画面。

#### 2. `grill-me`-driven website design

这是最适合做第一支旗舰案例的方向，因为它把 OpenCorvus 的差异放在成品之前：系统知道什么必须问用户、什么应该自己从仓库查、什么时候理解已经足够，以及如何把决定传到设计和验收。

首选执行面是 **Advanced Expert Squad 的单个 Task，并显式选择 `greenfield-interface-visual-delivery`**。该固定 package revision 内的 Requirement Engineer 已精确获得 `grill-me`，同一工作流也包含实现、测试与独立 Visual Reviewer；不要在一个 Task 中途切换到 `frontend-innovate`。若要专门展示 Frontend Innovate 的多方向证据设计能力，应改成一个 Mission：先用 Advanced requirements Task 产生精确 Artifact，再把该 Artifact 导入一个固定 Frontend Innovate Task。两种形式是不同案例，不能在叙事里合成成一次无缝换队。

建议任务不是“给咖啡店做网站”，而是带有真实取舍的产品，例如：

> 为一个开源模型评测平台设计发布页。当前要求只有“可信、技术感、不要像 AI 模板”。保留现有信息架构，先 grill me；每次只问一个真正需要我决定的问题，然后研究参考、给出三个有名字的方向、实现选中方向，并在真实桌面页面上视觉复核。

视频必须突出三个瞬间：

- 问了一个能改变结果的问题，而不是让用户补充可自行查到的事实；
- 三个方向有可解释的取舍，用户选择留下了明确决策；
- 视觉 Reviewer 看到了真实页面缺陷并让实现再做一次，而不是一次生成即结束。

长版可以是 6–10 分钟 case documentary；短版只讲“一个好问题如何改变最终网站”。

#### 3. `autoresearch`

当前仓库没有同名内置 package，因此传播时不要把 `autoresearch` 当作已发布 Feature 名。可以把它制作成 **Autonomous research loop / 自动研究闭环** 案例，使用现有 scientific research、data analysis、deep research、Evolution Lab 或代码执行能力组合完成。

好的研究案例必须有真实反馈，不是搜索后生成一篇长文：

- 明确可证伪的研究问题和基线；
- 冻结数据、评估指标和停止条件；
- 展示至少一次失败实验或被证据否定的假设；
- 用真实脚本/运行结果生成表格或图表；
- 分离事实、推断和未知；
- 最后交付可复现命令、原始结果和结论边界。

推荐第一个选题贴近已有资产，例如“让一个 Expert Squad 的任务成功率在冻结案例集上超过 incumbent”，或“在公开小数据集上改进一个明确基线”。这比“AI 自己发现新科学”可信得多，也更容易通过严格 checker。

## One run should produce ten assets

不要为不同渠道重复跑十次任务。每个旗舰 Task 保存一份完整 evidence bundle，再派生：

1. 20–35 秒 vertical hook；
2. 45–90 秒 result/process/proof cut；
3. 6–12 分钟 narrated case documentary；
4. 一张 before/after 或 problem/result 封面；
5. 一个 3–6 图 carousel；
6. 一个无声循环 GIF；
7. 一篇带指标和局限的案例页；
8. 一个可复现输入/fixture 仓库或目录；
9. 一条 Founder/maintainer 视角的复盘帖；
10. 一个 Feature micro-clip，解释案例中真正发挥作用的单一机制。

这会把“tons of cases”从“录很多不同视频”改造成“少量高质量运行 × 大量有目的的内容切片”。推荐前两个月只做 6–8 次旗舰运行，但产出 60–80 个分发资产。

## Canonical case evidence bundle

每次录制前冻结以下字段；缺一项就标记未知，不补写营销话术：

```text
case-id/
  brief.md                 # 受众、问题、原始输入、成功标准、非目标
  input/                   # 可公开的初始仓库、数据或截图
  task-receipt.json        # Task / Squad / workflow / revision / model
  decisions.md             # 人工问题、建议、回答和时间点
  timeline.md              # 关键事件、失败、恢复、交接
  outputs/                 # 最终文件和可运行产物
  acceptance.md            # 测试、真实页面、引用或人工验收证据
  metrics.json             # wall time、active time、cost、turns、interventions
  limitations.md           # 未完成、不可归因、已知边界
  media/                   # 原始录屏、旁白、截图、授权信息
```

公开指标至少包括：总耗时、人工决策次数、使用模型、最终 checker、是否从头重跑、是否人工剪掉等待时间。能测 token/cost 时公开；暂时不能可靠测量就写 unknown。不要使用“100% autonomous”“zero-shot”“production-ready”等词，除非案例的精确定义和证据真的支持。

## Video grammar

### Short form: 20–35 seconds

| Time | Beat | Example |
| --- | --- | --- |
| 0–2s | Payoff first | 真实游戏画面、最终网站、图表反转或危险命令弹窗 |
| 2–5s | Concrete challenge | “原始要求只有 13 个字。” / “这个 bug 只在恢复后出现。” |
| 5–13s | One distinctive mechanism | `grill-me` 的关键问题、具名专家交接、permission、失败证据 |
| 13–25s | Conflict and resolution | 显示失败/审查，不连续播放无意义工具滚动 |
| 25–32s | Proof | 实际运行、测试、截图对照、引用审计 |
| Last 2–3s | One CTA | “复现这个 Task”优先于泛化的“关注我们” |

短视频默认采用 9:16、原生字幕、放大的局部 UI 和可读的 5–10 words/second 屏幕文字。YouTube 已把 Shorts 支持到三分钟，但初期仍建议以 20–35 秒测试 hook，并在 Analytics 里看 `Engaged views`，不要只看新口径下的播放次数。

### Long form: 6–12 minutes

结构为：结果预告 → 为什么任务难 → 原始输入与成功标准 → 团队/权限 → 关键决策 → 一次真实失败 → 证据如何改变行动 → 最终验收 → 花费与局限 → 复现。长版不是完整实时录像；完整时间线作为补充证据链接。

### Editing rules

- 先展示结果或风险，不以 Logo 动画、安装过程或“大家好”开场；
- UI 只放大当前叙事相关区域；不让观众阅读整屏小字；
- Agent 工具滚动只作为 0.5–2 秒的转场，不能替代解释；
- 必须保留一个真实 setback，过度顺滑会降低可信度；
- 明确标注 `8× speed`、删减的等待时间和人工介入；
- 成品镜头尽量保留一段未经切割的操作；
- 使用一致的颜色标记：User decision、Agent action、Host evidence、Acceptance；
- 每条内容只放一个 CTA，并链接到该案例而不是一律链接首页。

## Distribution system

### Global / developer channel stack

| Channel | Native asset | Job |
| --- | --- | --- |
| YouTube | 6–12 分钟案例 + Shorts | 可搜索的长期案例库与发现 |
| X | 20–60 秒 clip + 证据 thread | Agent builder 讨论与快速反馈 |
| GitHub | showcase README、复现仓库、Discussion | 把注意力转成验证、Star、Issue 和贡献 |
| Hacker News | 少量重磅、技术诚实的 Show HN | 首批开发者认知；只发可运行且可回答问题的节点 |
| Reddit / 专业社区 | 针对具体问题的复盘 | 不做跨社区复制粘贴；先贡献方法和失败经验 |
| LinkedIn | 45–90 秒 + 业务结果/方法 | 团队负责人、专业工作受众和 B2B 信任 |

### Chinese channel stack

| Channel | Native asset | Job |
| --- | --- | --- |
| Bilibili | 5–12 分钟完整案例、合集 | 技术深度、搜索和系列沉淀 |
| 微信公众号 / 知乎 | 案例文章、证据图、复盘 | 可索引的中文解释和专业可信度 |
| 即刻 / X 中文圈 | 短 clip、build-in-public 记录 | Founder 与 AI 从业者反馈 |
| 抖音 / 视频号 / 小红书 | 20–45 秒 outcome-first vertical | 扩大触达；文案用具体任务而非 Agent 术语堆叠 |

不建议一开始为每个平台维护独立选题。使用同一 canonical case，按渠道重写 hook、画幅、字幕和 CTA；英文与中文旁白分别录制，避免只用机器字幕替代本地叙事。

## Landing and discovery prerequisites

发布第一批旗舰案例前需要一个 `/showcase/` 或 `/cases/` 事实来源。每个案例页包含视频、原始要求、关键决策、Expert Squad、时间线、最终产物、验收、指标、局限和复现 CTA。

当前公开检查还暴露两个发现面问题：

- 搜索结果仍可能显示旧版 opencorvus.com 占位摘要，虽然当前页面已经是新的 Workbench 定位；需要检查 canonical、sitemap、Search Console 抓取与重新索引状态；
- GitHub 的公开索引仍可能显示旧 README 文案，而且 repository About 当前没有 description、website 或 topics。应在有外部写入授权时统一这些字段；本文不执行该外部修改。

所有外发链接使用 case-specific UTM（Urchin Tracking Module，流量归因参数）并直接落到对应案例。首页适合品牌搜索，不适合承接每一个具体视频承诺。

## Measurement: optimize for activated proof, not raw views

建立一条从内容到真实使用的漏斗：

| Stage | Primary metrics | Diagnostic metrics |
| --- | --- | --- |
| Attention | 3 秒后继续观看率、Engaged views、完整观看率 | Hook 版本、来源、语言、视频长度 |
| Intent | case page click-through、GitHub unique visitors、download click | 哪个 proof beat 带来点击 |
| Activation | 安装成功、`doctor` 通过、创建首个 Task | 安装平台、失败步骤、从点击到 Task 的时间 |
| Value | 首个 Task 到 accepted delivery、第二个 Task、安装 Expert Squad | 任务类型、耗时、interaction、checker |
| Community | Star、Discussion、复现报告、Issue、Squad contribution | 贡献者首次响应时间与案例来源 |

北极星指标建议用 **每周由案例带来的 accepted first Tasks**，而不是总播放量或 Star。若暂时无法隐私安全地连接 download → first Task，先使用 case page → download 和 GitHub clone/Discussion 作为代理，并明确数据缺口。

每 4 条同系列短视频做一次小复盘：只比较一个变量，例如 outcome-first 与 problem-first hook；不要同时改变案例、时长、旁白、封面和渠道后声称得出结论。保留未爆内容，它们仍是搜索和案例库资产。

## 30-day launch plan

### Week 0 — Build the case surface

- 定义 canonical case schema、公开指标和脱敏规则；
- 建立 `/showcase/` 最小页面或仓库内 showcase 索引；
- 为每个案例建立稳定 URL、UTM 和唯一 CTA；
- 修正公开 description、topics、social preview、sitemap/indexing 等发现面问题；
- 制作统一的 9:16、16:9、carousel、thumbnail 和字幕模板；
- 预先写好失败披露、倍速、人工介入和模型/成本标记组件。

### Week 1 — Record two pilots

- Pilot A：Advanced `greenfield-interface-visual-delivery` 的 `grill-me` 网站设计旗舰；
- Pilot B：Permission 风险短片；
- 每个 pilot 先交付 evidence bundle 和长版，再切短版；
- 不追求发布频率，先验证录屏可读性、证据是否完整和 CTA 是否闭环。

### Week 2 — Publish and learn

- 发布 1 个长版、3 个短版、1 篇案例文、1 个 GitHub 可复现入口；
- Founder/maintainer 在评论中回答设计决定、失败和局限；
- 记录 3 秒留存、完整观看、case CTR、download CTR 和复现问题；
- 根据流失点只修改模板，不返工任务事实。

### Week 3 — Add breadth

- 发布游戏生成旗舰及其实际游玩证据；
- 发布真实 bug / long-horizon recovery 案例；
- 用相同视觉语法，测试娱乐型 hook 与工程型 hook 带来的激活质量差异。

### Week 4 — Add authority

- 发布自动研究闭环或深度研究案例；
- 发布“一个 Task 的完整成本、耗时、人工决策和失败”透明复盘；
- 邀请 3–5 位早期用户使用同一 case template 复现或提交自己的任务；
- 依据 accepted first Tasks 选择第二个月主栏目，而不是依据播放量单独决定。

稳态建议为每周 1 个 canonical case、2–3 个 short、1 个 proof thread / carousel、1 次 build-in-public 复盘。只有两个人以下的团队可以降为每两周一个 canonical case，保持证据质量。

## Case factory workflow

1. **Select**：用 Hook、Diff、Proof、Cost 和目标受众评分；必须写下该案例唯一要证明的产品命题。
2. **Freeze**：保存初始输入、成功标准、数据/资产权利、模型、Expert Squad revision 和公开边界。
3. **Run**：完整录制；记录 wall time、interaction、失败、重试和人工动作，不为镜头临时修改事实。
4. **Accept**：进入真实 checker、真实页面/实际游玩/引用审计；不以 agent 自述作为完成证据。
5. **Review**：由未参与执行的人检查事实、剪辑是否误导、敏感信息和版权。
6. **Package**：先案例页和 evidence bundle，再派生媒体。
7. **Distribute**：按渠道原生改写，不复制同一贴文；Founder 亲自参与首轮讨论。
8. **Learn**：把数据写回 case register，决定复刻题材、改 hook 或停止栏目。

OpenCorvus 已有 Product Video Production、Marketing & Growth、Viral Content 等 Expert Squad，可以用它们分别产出 brief/storyboard、渠道实验和文案，但它们的当前 contract 只在具备真实媒体工具与可检查输出时允许声称 rendered-and-verified。内容工厂应遵守这个边界，而不是让 planning Artifact 冒充成片。

## What not to do

- 不连续发布十几个“prompt → 漂亮网站”，这会训练受众把 OpenCorvus 理解成通用网站生成器；
- 不把 Feature tour 当首发主片，没人会因为完整菜单录屏而产生需求；
- 不隐藏所有失败、等待和人工选择；真实性正是长程 Agent 的差异；
- 不用工具调用次数、Agent 数量或滚动速度替代结果指标；
- 不为制造数量而使用不可复现的随机任务；
- 不在没有客户基线时宣称节省百分比，不把内部 benchmark 包装成客户案例；
- 不以 116 个 Expert Squad 的数量作为唯一 headline；选择、质量和实证比目录规模更重要；
- 不把每条内容都导向首页或“加入 Discord”；CTA 应与当前案例下一步一致；
- 不等产品“完全完成”才开始。Beta 的失败、修复和证据本身可以成为最可信的 build-in-public 内容，但必须清晰标记版本和限制。

## Recommended first six titles

1. **I gave an agent team a vague website brief. It refused to design—at first.**<br>
   我只给 Agent 团队一句模糊的网站需求，它先拒绝直接开工。
2. **Can an agent team build a game you can actually lose?**<br>
   Agent 团队做的游戏，真的能玩、能输、还能重开吗？
3. **This coding task survived a failure, a restart, and a real test suite.**<br>
   这个长任务经历失败和恢复，最后通过了真实测试。
4. **The agent asked permission. I said no. Here’s what happened next.**<br>
   Agent 请求危险权限，我拒绝后任务如何继续？
5. **An AI research loop disproved its own best idea.**<br>
   自动研究闭环否定了自己最看好的假设。
6. **One brief, three design directions, one evidence-backed choice.**<br>
   同一份需求，三个设计方向，为什么最终选这个？

## Decision summary

如果只能做一件事：先制作 Advanced 单 Task 的 `grill-me → greenfield-interface-visual-delivery → real-page review` 完整旗舰案例，并为它建立可复现案例页。它最能同时证明“不是 one-shot generator”、人类决策权、固定 Expert Squad 内的具名专家协作和真实验收。把 Advanced requirements Artifact 导入 Frontend Innovate 的 Mission 版本留作第二波，用来专门解释跨 Task 证据交接。

如果能做三件事：再加一个可实际游玩的游戏案例负责扩大触达，一个长任务失败恢复/自动研究案例负责建立技术可信度。

Feature 和 UI 内容继续做，但它们应是上述案例中机制的解释切片；不应成为主叙事。最终目标不是拥有很多视频，而是形成一套任何用户和社区贡献者都能复用的、证据一致的案例标准。

## External sources

- [OpenAI: Harness engineering—feedback loops, real workloads, and measured throughput](https://openai.com/index/harness-engineering/)
- [OpenAI: Cisco and Codex—real repositories and quantified outcomes](https://openai.com/index/cisco/)
- [Anthropic: How teams use Claude Code across functions](https://www.anthropic.com/news/how-anthropic-teams-use-claude-code)
- [Anthropic: Agentic coding and persistent returns to expertise](https://www.anthropic.com/research/claude-code-expertise)
- [Cursor customer stories](https://cursor.com/blog/topic/customers)
- [Cursor: Money Forward expands agents to product, design, and QA](https://cursor.com/blog/money-forward)
- [GitHub: Marketing for maintainers](https://github.blog/open-source/maintainers/marketing-for-maintainers-how-to-promote-your-project-to-both-users-and-contributors/)
- [YouTube Help: Shorts creation and Engaged views](https://support.google.com/youtube/answer/10059070?hl=en-GB)
- [YouTube Help: Shorts search and discovery](https://support.google.com/youtube/answer/11914225?hl=en-GB)
- [TikTok: Creative best practices](https://ads.tiktok.com/help/article/creative-best-practices)
- [LinkedIn: B2B video marketing](https://www.linkedin.com/business/marketing/blog/trends-tips/b2b-video-marketing-in-2025-the-top-trends)
- [OpenCorvus public homepage](https://opencorvus.com/)
- [OpenCorvus GitHub repository](https://github.com/yangheng95/opencorvus)
