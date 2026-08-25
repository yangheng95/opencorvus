# OpenCorvus 科技博客叙事视频 V10

状态：**REJECTED BY USER / 30 秒样片与 H3 receipts 仅保留为失败证据**

## 2026-08-25 用户终止

- 用户要求停止 V10，回到 V5 桌面版本打磨并重新生成。
- V10 未进入全片生产；30 秒样片、H3 take 与 receipt 保留在外部 demo 目录，不进入 V5R 成片。

## Recall

### 用户原始要求

- 目标不是“文案吻合的抽象动画”，而是能被普通 Agent 用户看懂的 `tech storytelling`，视觉接近一篇会动的科技博客。
- 仍然面向个人用户（2C），从真实痛点开始；案例只占很小比例。
- 核心必须覆盖：有限上下文、compaction、instruction loss、plan drift、premature termination、多 Agent state fragmentation、Mission durable state、Task/Squad 调度、恢复、Artifact、独立复核、专家团自进化、开源、受限案例证据和个人长工作流。
- H3 负责生成镜头与环境运动；不得拿主 Agent 自画静态草稿冒充生产素材。Logo、术语、代码、状态、数字和地址必须确定性后期排版。
- 用户看过视频前不得 push。

### 验收指标

1. 静音观看也能回答每章的三个问题：发生了什么、为什么发生、OpenCorvus 改变了哪条状态或控制流。
2. 每个术语首次出现时，必须与一个可观察事件同屏；禁止只有旁白定义。
3. 每章只维护一条因果链，不在同一镜头同时介绍多个新机制。
4. Agent、Mission、Task、Squad、Occurrence、Lease、Artifact、Review、Mutation Receipt 均使用真实技术名词和当前契约，不依赖私有隐喻字典。
5. 先交付 30 秒开场样片；用户确认“看得懂”后才扩为全片。

### 已读资料

- `expert-squads/builtin/product-video/skills/method/SKILL.md`：冻结 brief 与 claim ledger，叙事和视觉分别规划，生成前核验工具能力，最终以可检查媒体验收。
- Stripe Engineering：技术文章以问题、实现和度量组织，而不是功能口号。
- Vercel Agent Stack / AI Cloud：用明确的 runtime primitives、架构关系和工作流状态解释系统。
- V9 完整产物与三轮独立复核：证明素材来源、画质与机制事实正确，但用户否决其可理解性。

### 全仓搜索结果

- 当前 H3 runner 支持 `--manifest`，可为 V10 建立独立机器事实源，不需要修改或复用 V9 prompts。
- 真实官网图标、字标、案例事实和本地 H3/Real-ESRGAN 运行时均已验证。
- V9 生产代码不进入 V10 视觉法源；V9 H3 资产只能在明确作为 H3 生成参考时使用，不能回流其活字隐喻。

### 独立 Agent 反馈

- 无；30 秒样片完成后再进行只读复核。

## 影响面与根因分析

- 可观察现象：观众能听懂单句旁白，却无法解释光标、环带、陶砖与真实 Agent runtime 的对应关系；字幕撤掉后几乎失去技术信息。
- 直接触发点：V9 的镜头动作主要证明“物件在动”，没有逐帧显示 prompt、context、plan、tool call、state transition 与 evidence 如何变化。
- 数据/控制流根因：技术事实被放在旁白/字幕层，H3 画面只承担隐喻层，两者没有共享可验证的对象标识和状态连续性。
- 旧路径未根治原因：此前修复集中在 H3 provenance、停帧、画质、Logo、伪字和颜色语义；这些提高了制作品质，但没有改变信息架构。
- 影响定义与交付：新建 V10 brief、claim ledger、时码脚本、视觉语法、H3 manifest、30 秒样片合成与检查。V9 不删除、不覆盖。
- 风险：精确界面过多会退化为 PPT；控制方法是使用一个连续技术工作台、真实时间线和因果高亮，所有框线必须属于同一运行视图，不按页面切卡。

## 冻结 Brief

- 受众：已经用过 ChatGPT、Codex 或 Claude，但没有分布式系统背景的个人用户。
- 渠道：官网与社交媒体横版，1920×1080，中文旁白与中文字幕。
- 时长：全片目标 4:40–4:55；当前只生产 30 秒开场。
- 核心问题：Agent 会做局部任务，但长项目会因有限上下文、状态碎片和缺少持久执行契约而失去可靠交付。
- 核心承诺：OpenCorvus Mission 把目标、约束、任务状态、产物、恢复和验收放到对话之外的持久运行层，并以专家团推进每个重型 Task。
- CTA：`opencorvus.com` 与 `github.com/yangheng95/opencorvus`。

## Claim Ledger

| ID | 声明 | 来源/边界 |
|---|---|---|
| C01 | Agent 的上下文有限，长任务中早期要求可能被压缩或淡化 | 问题陈述；画面使用机制重建，不称所有模型必然如此 |
| C02 | 多开 Agent 不自动形成共享持久状态 | 系统设计问题；不宣称其他产品绝对做不到 |
| C03 | Mission 持久记录 goal、constraints、acceptance、Task dependencies 与 evidence | 当前 OpenCorvus 架构与 V9 已核验事实 |
| C04 | Queue 是 hint；调度前重读 durable facts，由模型判断并发出真实协调调用 | 当前架构契约 |
| C05 | 运行恢复使用 Task occurrence、lease、durable facts 与 successor activation | 当前架构契约；不说旧进程复活 |
| C06 | DeBERTa 案例数字只代表 single-seed fixed run | 已核验证据；不称普遍 SOTA |

## V10 信息架构

全片是“一篇会动的技术博客”，不是多个全屏页面：同一条 execution trace 从上到下持续生长，摄影机沿 trace 移动。

1. **真实输入**：用户键入一个包含模型、CUDA、测试、论文、部署和发布的长项目。
2. **失败可见化**：context 占用增长 → compaction → 三条硬约束变淡 → plan 跳步 → `Done` 与未完成 acceptance 同屏。
3. **多 Agent 反例**：两个 session 同改一个文件，第三个等待不存在的 checkpoint；定义 state fragmentation。
4. **Mission record**：相同需求被拆成 persistent goal、constraints、acceptance、Task dependency graph。
5. **真实推进**：scheduler 读 durable facts → model judgement → `dispatch_agent` → accepted receipt → occurrence running。
6. **中断恢复**：lease 到期、旧 attempt 终结、successor 从 durable facts 与 Artifact 重读。
7. **交付与复核**：Artifact 显示 source/path/locator/digest；独立 Reviewer rejected → owner 修复 → accepted 或 blocked with evidence。
8. **专家团自进化**：feedback candidate 与 frozen metric campaign 分开；diff、regression、用户确认、mutation receipt、restoration。
9. **生态定位与案例**：不做赢家表；以层级图说明编码 Agent、办公 Agent、runtime harness 和 Mission orchestration 的不同位置；DeBERTa 只作 15–20 秒证据。
10. **个人工作流**：论文、开源软件、副业应用、作品集、独立研究沿同一 trace 展开，回到品牌 CTA。

## 视觉语法

- 空间：暖白连续技术工作台，背景有官网浅网格；镜头像滚动技术文章一样沿一条纵向 execution trace 前进。
- 用户：只出现同一用户的手、鼠标和桌面边缘；需要情绪时才短暂见脸。
- Agent：真实执行 pane，含 streaming tokens、tool call、result、context meter 和 session ID；不再用角色替代。
- Mission：左侧固定 durable facts rail；Task graph 在中央；右侧 event trace 显示 occurrence、lease、dispatch 和 receipt。
- H3：生成真实手部动作、桌面景深、摄影机推进、屏幕光与空间转场；Prompt 禁止生成可读文字。
- 确定性后期：所有 prompt、代码、术语、状态、数字、Logo 和地址；文字必须锚定到正在变化的对象。
- Anti-PPT：没有功能卡、比较表、标题黑场、独立图标陈列；任何文字块都必须属于运行视图、代码、日志或注释边栏。

## 30 秒技术样片

| 时间 | 可观察事件 | 术语/旁白目的 |
|---|---|---|
| 00:00–00:06 | 用户在同一输入框打出六项长项目要求；三条硬约束高亮 | 先让观众知道“我到底交给 Agent 什么” |
| 00:06–00:12 | tool result 不断进入；`context 63% → 96%`；早期约束保持可见 | 展示长度如何增长，不先说术语 |
| 00:12–00:18 | `Context compaction #3`；`CUDA ONLY / RUN TESTS / CONFIRM BEFORE PUBLISH` 被折入 summary 并变淡 | 同屏命名 compaction 与 instruction loss |
| 00:18–00:24 | plan cursor 从 CUDA 实验跳到写报告；终端显示 `device: cpu`，测试仍未运行 | 同屏命名 plan drift |
| 00:24–00:30 | Agent 输出 `Done`；右侧 acceptance 仍有三项红色未完成；镜头停在矛盾处 | 同屏命名 premature termination，并提出“聊天记录不是运行状态” |

样片通过条件：不给观众解释任何自定义符号，仅凭屏幕事件就能复述 `长输入 → context 满 → compaction 丢约束 → plan drift → 过早 Done`。

## 样片生产与验收证据

- H3 生产 manifest：`script/video/minimax-h3-mission-promo/v10-tech-blog-opening-manifest.json`。
- 合成器：`script/video/minimax-h3-mission-promo/compose-tech-blog-v10.py`。
- H3 角色/工作台 take：`T01 take-002-f4edaa18d189`；首个写实 `T01 take-001-2a0252a4fba1` 因近似真人被拒绝，仅保留证据。
- H3 context take：`T02 take-001-0366640ab380`。
- H3 compaction/plan take：`T03 take-001-0f32751a65dc`。
- 三个选用 take 都有真实 H3 generation receipt 与物理输出 SHA；T01/T02/T03 的参考源均为 H3 生成帧，没有 ImageGen 或主 Agent 静态草稿。
- 当前样片：`D:\myhexin-local\demos\opencorvus-tech-blog-v10-20260825\opencorvus-tech-blog-v10-opening-82cfac919f7b.mp4`。
- 结构：30.000 秒、1920×1080、H.264、48 kHz 双声道 AAC。
- 抽帧：2/6/12/17/22/26/29 秒共七张，位于 `D:\myhexin-local\demos\opencorvus-tech-blog-v10-20260825\opening-inspection\82cfac919f7b`；人工复核确认每一因果节点都有屏幕状态支撑，不需要学习私有物件词典。
- 当前只进入用户可理解性门审；用户没有确认前不得扩成全片或 push。
