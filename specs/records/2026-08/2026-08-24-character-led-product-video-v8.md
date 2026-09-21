# OpenCorvus 长程 Agent 科普片 V8：角色驱动的连续动画

状态：**REJECTED / “人物工作室 + 小工人 + 箱子”隐喻不得进入成片**

## 2026-08-25 用户否决与替代方向

- 用户指出该方向仍然“跟 Agent 没关系”，并委托 Claude 产出完整 A–I 方案。
- Claude 方案的结构性诊断成立：类人小工人、搬箱子和工作室空间不携带有限上下文、工具调用、短命实例和销毁重启这些 Agent-only 特征；基础隐喻错误无法靠调色和 prompt 修复。
- 本轮 2.5D 角色、三张 anchor、H3 Gate 计划、四个 prompt、joined handoff 与 V8 品牌合成脚本已原样移出仓库，保存在 `D:\myhexin-local\demos\opencorvus-video-rejected-character-workshop-v8-20260825`，仅作拒绝证据。
- 通用的本地 H3 receipt 与五帧检查修复保留在 `generate-local-h3.py`；它不绑定 V8 视觉方向。
- 当前唯一生产方向改为 V9「活字运行层」，事实源见 `2026-08-25-live-type-runtime-video-v9.md`。

方法组合：`grill-me` → `design-taste-frontend` → `product-video-method`；正式 H3 提示阶段再使用 `h3-prompt-writing`。

## Recall

### 用户要求与 GrillMe 决策

- 用户把余下创意决策授权给主 Agent，不再逐项询问。
- 唯一视觉主角：同一位普通个人用户；Agent 与专家团是同造型语言的动画助手，不出现真人，不使用 Corvus/乌鸦意象。
- 媒介：高质量 2.5D 几何卡通，有稳定角色轮廓、表演、景深和空间运动；不是 Pixar 模仿、纸艺、桌面录屏、PPT、流程图或纯 UI 动效。
- 叙事：从个人用户反复给 Agent 收尾的痛点开始；案例只占短证据段；结尾回到论文、开源项目、副业、作品集与独立研究。
- 官网只提供经核验的 Logo、色彩、字体和品牌气质，不把官网 Header、卡片或表格直接搬成视频镜头。
- 总长控制在 5 分钟内，目标约 4:30–4:45，16:9，中文旁白；片头片尾均有不同构图的品牌、官网、作者与仓库地址。

### 旧路径为何失败

- V6 失败：把纸拼贴 Skill 的默认媒介当品牌视觉。
- V7 失败：把官网设计 token 与页面组件拼成三张静态信息图，形成典型 AI 生成界面：重复眉题、巨大标题、等宽玻璃卡、流程线和功能说明页。
- 只修颜色、圆角、字号或连线不能根治；新方向必须替换视觉主语、镜头空间、角色表演和转场因果。

### 已读权威资料

- `packages/opencorvus/src/skill/builtin/grill-me/SKILL.md`
- `packages/opencorvus/src/skill/builtin/design-taste-frontend/SKILL.md`
- `expert-squads/builtin/product-video/skills/method/SKILL.md`
- `packages/web/src/styles/tokens.css`
- `packages/web/src/components/OcHeroBackdrop.astro`
- `packages/web/src/content/landing-copy.ts`
- `packages/web/src/components/OcHeader.astro`
- `specs/current/architecture/task-control-plane.md`
- `packages/opencorvus/src/expert-squad/feedback-revision.ts`
- `packages/opencorvus/src/expert-squad/evolution-mutation.ts`

### 独立 Agent 反馈

两条互相隔离的只读链路已完成 narrative 与 visual 方案；主 Agent 已在 `script/video/minimax-h3-mission-promo/v8-production-handoff.zh-CN.md` 合并。独立审查确认故事与连续空间方向通过，同时发现生产粒度、样段覆盖、片头品牌、案例边界、Mission 协调、开源主线、Artifact 字段、自进化条件、信息密度和可访问性问题；这些问题已写入 canonical handoff 修订。待 H3 逐镜 Gate 表完成后再次复核。

## Frozen Product-Video Brief

- 产品：OpenCorvus 开源 Agent harness 与 Mission 长程编排。
- 受众：已经使用 Agent、但被长项目交付不完整折磨的学生、开发者、研究者、开源作者和独立创作者。
- 用户处境：我把复杂项目交给 Agent，最后仍要自己追问、复制上下文、补测试、找文件、重新发布。
- 传播目标：让观众先产生“这就是我”的识别，再理解 Mission 是上下文之外的持久运行层，最后愿意打开官网或仓库试用。
- 渠道：官网、GitHub、Bilibili、YouTube 横版。
- 画幅与时长：1920×1080，16:9，约 4:30–4:45。
- CTA：访问 `https://opencorvus.com` 或 `https://github.com/yangheng95/opencorvus`；不在片中执行发布行为。
- 语言：中文旁白；术语和运行事实使用简短英文后期排版；不烧录长字幕墙。
- 音频：旁白为主，角色与物件有同步 Foley；音乐从焦虑的机械脉冲逐步过渡到稳定、有推进感的电子/原声混合，不用企业宣传片史诗鼓点。

## Design Read 与三项设计旋钮

一句话 Design Read：这是给个人用户看的技术科普故事，必须让一个可共情角色在连续世界里经历失败、获得运行层并交付真实项目；品牌视觉克制，技术证据准确，不能让营销版式取代剧情。

- `DESIGN_VARIANCE = 7/10`：允许不对称构图、环境变形和匹配转场，但角色与核心物件保持强连续性。
- `MOTION_INTENSITY = 8/10`：镜头、角色、道具和场景都有因果动作；技术术语只跟随事件出现，不做漂浮 HUD。
- `VISUAL_DENSITY = 4/10`：每个镜头只承担一个主因果；复杂技术通过连续多镜解释，不堆在一张图上。

## 选定的故事与视觉命题

工作标题：**《别再替 Agent 收尾》**

视觉命题：**一座不断扩建的个人项目工作室。**

- 同一位用户把“研究、实现、训练、测试、论文、发布”六件任务交给一个 Agent 助手。
- 工作室随工具结果不断扩建；代表上下文的移动工作台却容量有限，早期约束被新材料覆盖，Agent 把半成品推到用户面前。
- 用户复制便签、搬运文件箱、同时指挥多个 Agent；重复零件、无人领取的依赖和互相等待通过表演发生，而不是用流程图说明。
- Mission 不是一张卡片：它是工作室地下被点亮的持久基础设施。目标、约束、验收和 Task 依赖成为房间结构；多支专家团在同一建筑里分区协作。
- 进程中断时，当前 physical attempt 熄灭；durable facts、Task occurrence 与 lease 历史仍留在建筑中，successor activation 重新接管工作台。
- Artifact 是带来源铭牌和 locator 的真实可搬运产物；下游角色能打开它，独立 reviewer 可以退回缺陷并触发修复复验。
- 专家团自进化发生在工作室旁的工具维护间：用户反馈路径直接形成候选工具包并由用户接受；度量路径冻结 Campaign、对照 baseline/candidate 再给 promote recommendation。回归候选进废料槽，不安装；安装回执之后才出现需要再次确认的 restoration 路径。
- 真实 DeBERTa 案例只在工作室最终交付架上出现 20–25 秒：运行时长、Task/专家团/会话/角色规模、CUDA 实验、网页、图表、论文、仓库与限制条件同时可核对。

## Claim Ledger

| ID | 可说内容 | 权威来源 | 边界 |
|---|---|---|---|
| C01 | OpenCorvus 官网当前品牌使用暖白、钴蓝、橙色点睛、90px 网格、柔和 mesh 与官方 Header Logo | `tokens.css`、`OcHeroBackdrop.astro`、`OcHeader.astro` | 只约束品牌识别，不复制页面版式 |
| C02 | OpenCorvus 主项目 MIT 开源，可自托管；模型、工具、权限和专家团可替换 | 官网 landing copy、仓库 `LICENSE` | MIT 不外推给案例仓库或第三方产品 |
| C03 | 长程 Mission 把目标、硬约束、验收和 Task 依赖保存在对话上下文之外 | 当前 Mission/Task 架构与官网公开文案 | 不声称永不失败或必然完成 |
| C04 | Queue 是 hint；执行资格来自 durable facts 与有效 lease；进程丢失是 physical-attempt boundary，过期 lease 后终结遗弃 attempt 并获得 successor activation | `specs/current/architecture/task-control-plane.md` | 不使用通用 `resume cursor` 或“原进程继续”说法 |
| C05 | Artifact catalog 保留 type/source/locator/digest，特定 Task resource 才有 path；search、read 与 select 是不同动作，引用不跨新的 physical Turn 自动复用 | Task control-plane 与 Artifact 架构 | 不把一句总结当 Artifact；不宣称每个 Artifact 都有通用 path |
| C06 | 反馈驱动 revision 没有 Campaign、trial 或 comparison；用户接受是裁决，mutation receipt 是返回路径 | `feedback-revision.ts`、`evolution-mutation.ts` | 不包装成自动 A/B 验证 |
| C07 | 度量驱动 promotion 冻结 Campaign，要求 baseline/candidate/comparison 同源且 recommendation=promote；restoration 引用 prior mutation receipt 并再次授权 | `evolution-mutation.ts` | 回归 rejected 不安装；rollback 不是安装前步骤 |
| C08 | 官网定位 WorkBuddy 为一句话交付成品，DeepSeek Harness 为 MIT 插件内核，OpenCorvus 为完整 harness 开箱后再替换 | `landing-copy.ts` | 不排名，不声称对方做不到 |
| C09 | Codex / Claude Code 与 OpenCorvus 不在同一层，可一起使用；OpenCorvus 是模型无关、多 Agent、自托管 harness | 官网 FAQ | 不贬低编码助手 |
| C10 | DeBERTa 受限案例：六个 Task 在 12h45m 后全部完成并交付证据；3 squads、46 Agent sessions、20 roles、RTX 5090、三组 CUDA、83.43%/83.61%、single seed 42、1,800 examples | 持久数据库、Mission/项目 evidence、`push-receipt-final.json`、`repair-report.json` 与 comparison evidence | 没有 Mission closure receipt，不能说 Mission 正式闭环；`fixed-run evidence only`；不宣称普遍 SOTA 或多 seed 置信 |

## 角色与世界约束

- 用户角色：成年但无明确职业标签的个人创作者；简洁几何脸型、深灰短发、暖白上衣、钴蓝外套或围巾、橙色腕带。每镜保持同一比例、服装、轮廓和配色。
- Agent 助手：同一基础造型语言的矮小工作伙伴，面部简洁、动作清楚；不同职责只通过胸前工具符号和单一辅色区分，不用机器人金属壳、发光眼或公司吉祥物。
- 专家团：一支完整小队在同一任务区域协作；不能把单个 Agent 图标冒充专家团。
- 世界：实体化的个人项目工作室；文件、代码、GPU、测试、图表、论文和发布都是可触碰物件。技术机制改变空间结构，而不是弹出解释卡。
- 质感：2.5D flat-shaded geometry、柔软环境光、细腻阴影、少量材质纹理；官网 mesh 只出现在环境光与空间过渡里。
- 禁止：卡片矩阵、信息图、流程线墙、讲台式大标题、真人、Corvus 意象、纸艺、赛博朋克、默认紫色霓虹、Pixar 模仿、假 UI、模型生成 Logo/代码/URL。

## 生产顺序

1. narrative branch：带 claim ID 的时码文案、旁白、替代开场与 CTA。
2. visual branch：不依赖文案排版的连续场景、角色行为、镜头、转场、资产来源与 motion owner。
3. 主 Agent 合并：逐镜对齐 claim、角色动作、物件连续性和时长，删除一切能被静态幻灯片替代的镜头。
4. delivery review：独立 Agent 核对技术、叙事、审美、版权、可访问性与执行依赖。
5. 角色卡、环境卡和四段真实运动 Gate（10 秒用户痛点、10 秒 Mission/专家团、8 秒双进化路径、8 秒 receipt/restoration）；`script/video/minimax-h3-mission-promo/v8-h3-motion-gate-table.md` 与四个 `prompts/v8-gate-*-i2va.txt` 已冻结输入模式、时长、参考标签、首尾连续性、本地命令与验收；四段都通过，才扩展到全片。
6. H3 生产：使用 `h3-prompt-writing`，一镜一提示、一镜一抽帧复核；Logo、术语、真实 UI、数字和地址全部确定性后期。
