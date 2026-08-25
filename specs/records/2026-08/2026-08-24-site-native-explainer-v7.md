# OpenCorvus 长程 Agent 科普片 V7：官网原生视觉 Gate 1

状态：**REJECTED / 静态官网信息图方向不得进入成片**

## 2026-08-24 用户否决

- 用户评价本轮审美不可接受，并要求改用 `grill-me`、`design-taste-frontend` 与 `product-video-method` 重新建立设计。
- 直接触发点是三张样片仍以“大标题 + 玻璃卡片 + 流程线”为主要构图；根因是把官网组件外观误当成视频叙事语法，没有让角色、场景物件和镜头运动承担故事。
- 三张 PNG 与 HTML 渲染源已原样移出仓库，保存在 `D:\myhexin-local\demos\opencorvus-video-rejected-site-native-gate1-v7-20260824`。它们仅作为拒绝证据保留，不得继续调色、加动效或进入 V8。
- V8 的当前事实源是 `2026-08-24-character-led-product-video-v8.md`。

目标：16:9，4:40 左右；保持 V6 已审核过的长篇技术叙事，完全重置视觉执行。

## Recall

### 用户原始要求与最新纠正

- 从用户真正的痛点讲：Agent 在有限上下文里忘记要求、不按计划、擅自停止、交付半成品；多个重型任务串联时问题更严重。
- 核心故事必须讲清 Mission 的持久编排、几十到上百个 Agent Team 的长程调度、真实案例、专家团自进化、开源和个人长工作流。
- 案例只做短证据：说明做了什么了不起的事、运行多久、产物与质量、项目地址；不能用截图轮播或 BPPT 代替故事。
- 对比必须覆盖 WorkBuddy、DeepSeek Harness、Codex、Claude Code；不捏造对方能力，不做虚假“谁都做不到”。
- 片头片尾必须有 OpenCorvus 官方 Logo、品牌、作者、官网和项目地址，案例项目另给地址。
- 用户不喜欢暗色满屏背景；允许真实 WebUI 作为局部暗色产品证据，但全片主画布必须采用官网浅色主题。
- 最新纠正：“读取官网的视觉，不要瞎撺”。旧纸拼贴视觉已否决。

### 官网事实源与实页核对

已通过 `http://127.0.0.1:4325/zh-cn/` 实际查看当前官网浅色主题、Hero、自进化、四支柱和产品对比区，并读取以下源文件：

- `packages/web/src/styles/tokens.css`
- `packages/web/src/styles/primitives.css`
- `packages/web/src/components/OcHeroBackdrop.astro`
- `packages/web/src/content/landing-copy.ts`
- `packages/web/src/components/OcHeader.astro`
- `packages/overlay/src/opencorvus-logo-light.svg`
- `packages/overlay/src/opencorvus-logo-dark.svg`
- `packages/web/public/og.png`
- `packages/web/src/assets/lander/harness-gallery/work-harness.png`
- `packages/web/src/assets/lander/harness-gallery/mission-composer.png`

官网可观察视觉不是纸艺，也不是暗色科技大屏：

1. 主画布为暖白 `#f9f8f8`，Hero 由 `#f7f5f1 → #f9f8f8 → #f1f2f7` 的近白层次构成。
2. 背景使用很轻的 cobalt / orange / periwinkle / deep-blue 径向光晕、细微 grain 与 90px 网格；光晕不承担文字可读性。
3. 主文字 `#1e232c`；品牌钴蓝 `#2946d3`，深蓝 `#172b8f`，中蓝 `#3558db`，浅蓝 `#8fa6e8`，点睛橙 `#e04b22`。
4. 字体角色：Montserrat 做大标题，DM Sans 做正文，Fragment Mono 做运行事实、代码、指标和地址。
5. 卡片只在表达产品结构时出现：白色或轻玻璃基底、16/24px 圆角、细边与很轻的影子。不能每一镜都做标题加卡片。
6. 官网 Logo 是蓝色鸟形标识与 OpenCorvus 字标；Logo 只能使用仓库官方资产，不交给生成模型重绘。
7. 产品真实证据是深色 WebUI；只能以窗口、放大镜、局部录像或 Artifact 证据形式嵌入浅色主画布，不能把全片做成暗色桌面录屏。

### 影响面与旧路径未根治原因

- 旧 V6 把某个视频 Skill 的默认纸拼贴风格误当成品牌风格，导致故事即使正确也和官网身份断裂。
- 只换纸张色板不能修复根因，因为媒介、构图、纹理、运动语法和字体层级都与官网不一致。
- S01–S19 已生成静帧只能作为被拒证据保留；它们已从仓库移至 `D:\myhexin-local\demos\opencorvus-video-rejected-paper-collage-v6-20260824`，不得裁切、调色或继续生成 S20–S40 来形成平行事实源。
- V5 桌面版仍是历史候选，不覆盖；V7 使用独立目录、文件名和 build digest。

### 独立 Agent 反馈

未参与改写的独立 Agent 完成四轮只读复核：首轮发现 Logo 事实源、两处官网原文、V5/V7 生产权威和 ignored spec 入库四类问题；二轮确认前三类已关闭、Git 纳入仍未完成；三轮确认 Git 与被拒资产路径已经收敛，但发现本节仍写成“待复核”；四轮核对复核历史与当前暂存差异后，确认最终无未解决发现。

## 当前内容合同

保留 4:40 六章结构：

| 章节 | 时长 | 必须讲清的技术点 | 官网原生视觉动作 |
|---|---:|---|---|
| 1. 为什么长任务会坏 | 00:00–00:49 | Context Window、Compaction、Instruction Loss、Plan Drift、Premature Termination | 一个真实“我的项目”工作区连续生长；要求、消息、工具结果越堆越多，早期硬约束从可见工作层被挤走，进度条却错误封顶 |
| 2. 加更多 Agent 仍不等于协作 | 00:49–01:24 | State Fragmentation、Duplicated Work、Orphaned Dependency | 同一工作区分成多条并行执行流，交接点没有共同状态；重复产物和断开的依赖在一个连续场景里出现，不使用人物群像或节点墙 |
| 3. Mission 是上下文外的运行层 | 01:24–02:06 | Persistent Mission Record、Final Goal、Hard Constraints、Acceptance Contract、Task Dependency、冻结 Squad revision | 官网 Hero 的玻璃工作台从背景网格中建立；目标、约束、验收和依赖写入一个持久 Mission 记录，多个专家团围绕同一事实源运行 |
| 4. 如何真的跑完 | 02:06–03:02 | Queue Hint、Activation Lease、Task Occurrence、Durable Facts、Physical Attempt Boundary、Successor Activation、Artifact Lineage、独立验收、诚实终态 | 任务沿一条持久事实轨道推进；进程丢失后，过期 lease 终结被遗弃的 physical attempt，再由 reconciler 归约事实并获取 successor activation；不是从通用游标继续。Artifact 引用也不跨 physical Turn 偷渡，后续执行重新 search/read/select |
| 5. 专家团如何自进化 | 03:02–04:12 | Feedback Candidate、Frozen Campaign、Baseline/Candidate Comparison、Promotion Recommendation、Regression Rejected、Mutation Receipt、Restoration Confirmation、Task 版本隔离 | 严格采用官网“两条路径”：反馈路径没有 Campaign/trial/comparison，候选包校验后由用户接受裁决；度量路径冻结 Campaign 并比较 baseline/candidate，只有完整 promote recommendation 才到用户确认。回归分支不安装；restoration 只能在已有 mutation receipt 之后另行发起并再次确认 |
| 6. 受限案例与个人工作流 | 04:12–04:40 | 真实运行规模、产物、质量、证据边界、个人场景、CTA | DeBERTa 只占短证据窗；真实指标与限制同屏。随后工作区展开为论文、开源项目、副业、作品集和独立研究，回收成片尾品牌入口 |

## 官网原生视觉合同

### 必须使用

- 浅色官网主画布、官方 Logo、准确品牌色与字体角色。
- 90px 细网格、低对比蓝橙 mesh 光晕、极轻 grain；始终服务内容层级。
- 连续空间叙事：元素从前镜运动到后镜，Camera 可以平移、跟随和穿越工作区，避免“一镜一页”。
- 运行事实、术语、数字、Logo、URL、代码和产品名全部由确定性后期绘制，不由 H3 或图片模型生成。
- H3 只负责无字的背景运动、材质与连续空间过渡；WebUI、表格、Diff、指标和仓库地址使用真实资产或代码渲染。
- 暗色产品界面最多占画面约 55%，并始终嵌在浅色品牌环境内。

### 明确禁止

- 纸拼贴、撕纸、halftone、芥末黄/深紫主色、牛皮纸、手账贴纸。
- 暗色满屏背景、霓虹赛博朋克、粒子隧道、乌鸦/Corvus 意象、真人或风格不一致的卡通角色。
- 每镜“标题 + 三张卡 + 图标”的 BPPT 结构；大段静态对比表；用截图轮播冒充故事。
- 模型生成 Logo、可读 UI、代码、数字和 URL；夸大成 SOTA、多 seed 结论或“自动保证越跑越强”。

## 对比口径

不把五个产品塞进一张营销排行表。使用官网已有的两层关系：

- WorkBuddy：一句话交付成品的产品重心。
- DeepSeek Harness：MIT 开源的插件内核，能力自行组合。
- OpenCorvus：完整 harness 开箱即用，再逐层替换；MIT 开源；本地或自己的服务器；带版本与 digest 的专家团。
- Codex / Claude Code：与 OpenCorvus 不在同一层的编码会话，可被识别并一起使用；OpenCorvus 展示的是模型无关、多 Agent 协调、自托管的长程运行层。

画面用一个连续的“个人工作台层级剖面”表达：编码助手位于执行会话层，WorkBuddy / DeepSeek Harness / OpenCorvus 各自以官网公开定位进入，Mission 运行层继续保存长期事实。不得声称任何一方绝对不能完成某个任务。

## 真实案例口径

DeBERTa 例子仅使用已有、可核对证据：运行 12h45m；6 Tasks；3 squads；46 sessions；20 roles；RTX 5090；三组 CUDA 实验；83.43% / 83.61%；single seed 42；1,800 examples；`fixed-run evidence only`。画面必须把限制和指标同屏展示，不宣称普遍 SOTA。

案例证据窗同时给出真实项目地址；片尾给出：

- 官网：`https://opencorvus.com`
- 主仓：`https://github.com/yangheng95/opencorvus`
- 作者：使用已确认作者信息，不自行补全身份
- 案例仓：使用真实存在且可访问的仓库地址，不生成占位地址

## 新 Gate 1 验收

下一步只制作三张官网原生风格样片帧，三张都要来自同一个连续视觉系统：

1. 痛点帧：个人项目工作区被上下文挤压，仍是暖白官网画布。
2. Mission 技术帧：持久 Mission、Task 依赖、Occurrence/Resume 和 Artifact 交接在一个连续场景中可读。
3. 自进化帧：官网“两条路径”进入候选 revision、Diff、验证、回滚与用户确认。

三张样片必须人工查看并由用户确认后，才重写 40 镜终版表并进入逐镜静帧 Gate；在此之前不生成任何视频。

## Gate 1 样片产物与人工复核

确定性渲染源：

- `script/video/minimax-h3-mission-promo/site-native-v7-gate1.html`

1920×1080 样片：

- `script/video/minimax-h3-mission-promo/assets/site-native-v7/gate1/01-user-pain.png`
- `script/video/minimax-h3-mission-promo/assets/site-native-v7/gate1/02-mission-runtime.png`
- `script/video/minimax-h3-mission-promo/assets/site-native-v7/gate1/03-squad-evolution.png`

人工检查结果：

- 三帧均直接使用官网暖白底、四组低对比光晕、90px 网格、钴蓝/橙色 token、官方 Header Logo 与官网字体角色；没有纸拼贴、暗色满屏、卡通角色或生成式 Logo/UI。
- 用户痛点帧让早期硬约束在 Context Window 内逐步减弱，并把未完成的测试、论文、发布与错误 `Done?` 同屏呈现。
- Mission 帧首稿把进程丢失误画成通用 `Resume Cursor`；修订版必须显示同一 Task occurrence 的 durable facts 保留、abandoned physical attempt 在 lease expiry 后终结、successor activation 重新获得执行权。Artifact locator/read/selection 不跨 physical Turn 复用。
- 自进化帧首稿把两条证据来源画成串行，二稿又错误地让它们共享 Focused Verification 并把 rollback 放在安装前。修订版必须分开表现：feedback candidate 无 Campaign/trial/comparison，由用户接受裁决；metric candidate 走 frozen Campaign、baseline/candidate comparison 和 promote recommendation；regression rejected 不安装；restoration 仅在 mutation receipt 后另行确认。
- 这些帧是后续连续动画的关键时刻，不是把三张静态卡片直接拼成视频。用户确认视觉后才允许进入 40 镜终版表和视频生产。

### 跨帧连续空间锚点

- 三帧共享同一条 `OC spine`：痛点帧中它是被消息压满的上下文执行线；Mission 帧中原线加固为持久 Task dependency rail；自进化帧中同一线在发生可复用失败证据后分为 feedback 与 metric 两条 revision lane。
- 品牌栏、网格、mesh 光晕和镜头坐标保持不切页；大标题只在章节进入时出现，正文动画阶段 Camera 跟随 `OC spine` 上的对象运动。
- `CUDA ONLY` 约束块在痛点帧被挤出后，不消失：它在 Mission 帧变成 Hard Constraint 事实，在自进化帧变成反馈候选或 Campaign 的冻结输入，提供跨章物件连续性。
- Artifact 在 Mission 帧形成的 source/path/locator 视觉物件进入自进化章节时成为 failure evidence；不能用新卡片替换同一证据。
