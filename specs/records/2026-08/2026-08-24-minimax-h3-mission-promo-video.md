# MiniMax H3 Long-Horizon Mission Promo Video

## Recall

| Item | Record |
| --- | --- |
| User request | 搜索并安装 MiniMax H3，编写并实际迭代一支 OpenCorvus 宣传视频：从长程任务的重要性与痛点、同类软件为何难以做好，讲到 Mission 的设计与愿景，展示真实 DeBERTa ABSA Mission 执行；长任务命令使用打字效果，穿插真实截图，美化最终产物，并通过抽帧分析验收。 |
| Desired outcome | 一套可复现的视频生产流水线、中文旁白与分镜、真实产品/产物素材、可播放的本地样片，以及在具备 MiniMax API 凭据时用 `MiniMax-H3` 生成和替换氛围镜头的端到端命令。 |
| Acceptance | 16:9、1080p、H.264/AAC；叙事覆盖痛点→差异→Mission→实例→真实产物→行动号召；命令逐字出现且停留可读；产品画面来自真实 7884 或已留存运行证据；不伪造训练/论文/发布结果；逐段抽帧、黑帧/冻结/时长/音轨自动检查和人工接触表复核通过。 |
| Hard constraints | 不重启、刷新或修改用户正在使用的 7884 服务；不把模型自述当作运行证据；H3 生成镜头不能伪装成产品截图；API Key 不落盘、不入日志、不入提交；先用 768P 草稿迭代，只有通过验收的 H3 镜头才升级；不得下载一个本机无法合理加载的 200GB 级权重包。 |
| Repository sources read | `AGENTS.md`、`README.md`、`README.zh-CN.md`、`specs/current/architecture/public-website.md`、`2026-08-12-promotion-case-engine-strategy.md`、`2026-08-09-deberta-absa-mission-e2e.md`，以及 DeBERTa Mission 的训练监控、图表、论文与 GitHub 发布证据目录。 |
| Whole-repository search | 搜索了 `Mission`、`long-horizon`、长程、视频、宣传、Artifact、Expert Squad 和现有媒体。当前已有 1:44 无声演示、Mission/Work 真实图库，以及本次 Mission 的监控页、推理页、模型架构图和发布回执；没有现成 MiniMax H3 客户端或凭据。 |
| External research | MiniMax 官方 H3 发布说明、模型仓库、Prompt Writing、Brand Promo、3D Animation 与 Paper Collage Skills；H3 V2 API；Google ABCD 与 YouTube 制作指南；Adobe 动画流程与十二原则；Wistia Explainer 指南；vLLM-Omni 与社区 5090 适配。 |
| Local environment | RTX 5090 32GB、系统内存 64GB、FFmpeg/FFprobe 可用、D 盘剩余约 1.7TB。官方 BF16 路径不可行；用户进一步要求寻找单卡第三方适配。选定 ComfyUI 原生 H3 节点、约 20.97GB 的 pruned INT8 ConvRot DiT、约 15.69GB 的 NVFP4 AWQ Qwen3-VL、约 5.8GB 的视频/音频 VAE 和 DynamicVRAM（动态显存卸载）。第三方 5090 实测证明该组合可在 32GB 显存运行并输出 H.264/AAC。 |
| Credential status | 当前没有 MiniMax API Key。主路径已改为本地开源权重，不需要 API Key；官方 API 仅保留为用户主动选择的可选路径。 |
| Existing dirty worktree | 开始时只有无关未跟踪 `packages/opencorvus/script/benchmark/` 与 ``；必须保留且不纳入本任务提交。 |
| Independent agent feedback | 实施前无。首轮验证后按仓库规则委托未参与实现的 agent 只读复核。 |
| User correction | 首版 animatic 被明确否决：不能做成 BPPT（带轻动效的幻灯片），必须用连续动画形式科普。保留真实截图、旁白、命令打字和 H3 本地生成要求，但痛点、机制、Mission、执行和产物段落必须通过对象运动、因果关系、状态变化和镜头连续性来解释。 |
| User correction 2 | 第二版仍被否决。用户要求先学习文案、视频、推广与 H3，而不是继续盲目生成。已停止在途动画渲染；正式生成前新增强制创意确认门，并以 `script/video/minimax-h3-mission-promo/creative-brief-v2.zh-CN.md` 为当前创意事实源。 |
| User addition | 结尾必须给出工作上需要长工作流的具体场景。V2 收束新增模型训练与评测、深度研究与报告、软件开发测试发布、数据分析与审计四个连续场景，再进入唯一 CTA。 |
| User correction 3 | 本地 RTX 5090 已真实生成 4.458 秒“琥珀任务核心 + 青色接力滑轨”H3 风格测试，但用户明确否决并要求咨询 Claude。该方向标记 rejected，不得继续生成。Claude Code 2.1.237 显示 Max 登录态，但推理返回 `403 Request not allowed`；浏览器 OAuth 涉及持久凭据授权，未获用户确认前不得继续。 |
| User decision | 用户停止 Claude 路线并要求寻找专用 Skill。完整比较 MiniMax 官方极简产品广告、纸艺定格科普与手绘实拍混合 Skill 后，用户批准 `papercraft-stop-motion-explainer` 路线 D「一份交付的一生」与约 80 秒目标；当前授权范围仅到三张 16:9 视觉预览，不含 H3 正式镜头或 push。 |
| Preview evidence | `assets/previews/papercraft-v2/` 已生成三张 16:9 预览：夜班失败、清理假文字后的专家交接、锁定档案身份并减法构图的四类工作场景。三张图只用于确认成人向编辑纸艺的世界、材质、主角和协作隐喻；用户确认前不得生成 H3 镜头。 |
| User correction 4 | 用户否决纸艺路线，指出其与科技和 AI 完全无关。`papercraft-v2` 只保留为失败证据，不得继续迭代。当前切换到 MiniMax 官方 `brand-promo-video-generator` 的 AI/SaaS 故事骨架，并结合 `h3-prompt-writing`；候选方向 E「Silicon to Delivery」必须以真实 Mission UI、CUDA/GPU 计算、真实子会话和证据交付为主角，用户确认前不得生成或 push。 |
| User narrative | 新旁白以“Agent 已经会做事，真正的问题是能否把一件大事做完”为传播钩子；用有限上下文导致遗忘约束、计划走样、提前收尾和半成品交付解释痛点，再以调研→设计→实现→测试→部署说明多个重型 Task 的放大效应，最后引出 Mission 中 Task 锁定精确专家团版本及工作流、可恢复状态、带来源 Artifact 与独立验收。 |
| Scale-claim evidence | 全仓未发现单个 Mission 已真实调度几十或上百个 Agent Team 并完成交付的证据。宣传口径保持“扩展到更多 Team 和更长工作链”的设计目标；若要使用已完成规模实验的口径，必须补 Mission ID、持久化活动、Provider 活动和交付证据。 |
| Real-case runtime | Mission `ae773cbff6362f19` 从 2026-08-23 19:05:25 派发至 2026-08-24 07:50:44 最后任务更新，墙钟时间 12.76 小时。六个 Task 的 `lifecycleStatus` 均为 `completed`。 |
| Real-case orchestration | Mission status 的会话拓扑合计 46 个唯一 Agent 会话、20 种角色；创建元数据限定 `research-studio`、`base`、`advanced` 三个内置专家团。文案必须区分 Agent 会话、角色和专家团数量。 |
| Real-case model quality | 三组 RTX 5090 CUDA 实验中，`innovation-smoothing-seed42` 验证 Macro-F1 0.8343229869，较基线绝对提升 0.0146971878；测试 Macro-F1 0.8360914009、准确率 0.8428143713。仅单 seed 42、1800 条训练样本预算，不得外推为普遍优势。 |
| Real-case deliverables | 已核对模型/数据基础、三组实验及最佳检查点、训练监控与推理网页、两张多格式架构图、五页 ACL 风格论文、独立审校证据、公开 GitHub 仓库及匿名回读回执。Stage 6 记录 114 文件发布审计、portable 11 passed、canonical 25 passed、targeted 11 passed 及 RTX 5090 CUDA 干净环境复验；测试组可能重叠，不相加为总测试数。 |
| Promotional figure redraw | 将原始论文纵向模型架构图和横向实验生命周期图重绘为两张 16:9 科技宣传图。生成模型只负责无文字的高端计算视觉底板；所有模型名、流程、指标、箭头与证据限制通过确定性 SVG/HTML 后期准确排版。不得让生成模型伪造 UI、指标、代码或实验关系。原论文图保留不覆盖，宣传版使用新文件名。 |
| Brand and credits | 片头和片尾均展示官方 OpenCorvus 渡鸦 Logo、品牌名、网站 `https://opencorvus.com`、项目仓库 `https://github.com/yangheng95/opencorvus` 和作者 `Heng Yang (@yangheng95)`；两处使用不同构图。案例结果段及片尾展示实例仓库 `https://github.com/yangheng95/deberta-v3-absa-public-evidence`。地址使用确定性排版，不由生成模型绘制。 |
| Production authorization | 用户于 2026-08-24 明确要求“开始做视频”，解除候选方向 E 的生产门。`storyboard.zh-CN.json` 升级为 schema 2 / approved，使用审核通过的 V7 旁白，目标总时长不超过 5 分钟。被否决的 BPPT、接力轨道、纸艺路线仍禁止复用。 |
| Production edit | 生产版 13 段：差异化品牌片头；H3 硅芯片开场；长任务失效机制；软件工程连续链；运行层缺口；真实 Mission 设计与命令；真实执行、产物、指标和质量门；H3 长工作流场景；信息型品牌片尾。H3 只生成两段无文字 B-roll，其余使用真实证据或确定性运动设计。 |
| User correction 5 | 用户审看 4:36 animatic 接触表后指出影片与 Agent 关联不明显，且站在系统/企业而非用户视角；OpenCorvus 面向 2C，不是 2B。该 animatic 标记 rejected，不得进入最终 H3 合成。新版本必须以个人用户的挫败和收益为主角，真实展示具名 Agent/专家团会话与协作；技术机制和 CUDA 指标降为证明。结尾场景转为毕业论文、个人开源项目、副业产品、求职作品集和独立研究等个人长工作流。 |
| User addition: comparison | 用户要求加入 WorkBuddy、DeepSeek Harness、Codex、Claude Code 的对比。采用“同一个个人长项目，各产品重点解决哪一层”的动态定位带，不使用企业采购表、主观评分或绝对贬损。核对日期为 2026-08-24：本站官网比较的 WorkBuddy 是 `workbuddy.ai` 商业云端桌面产品，强调一句话交付办公成品与平台内 Expert Group，不得误用同名 `work-buddy.ai` 开源项目；DeepSeek Harness 是插件化且运行可追踪的开发者 Harness；Codex Cloud 在隔离环境并行运行编码任务；Claude Code 提供 subagent、agent view、实验性的 Agent Teams 与动态工作流。OpenCorvus 的本片差异只陈述为开源、自托管的跨研究、训练、网页、论文和发布的多专家团 Mission 接力与验收。 |
| User addition: open-source pillars | 用户强调最大杀手锏是开源，并要求不得遗漏官网现有卖点。已以 `packages/web/src/content/landing-copy.ts` 为事实源，新增独立动画段呈现：开源（MIT、全部源码公开、可自托管/审计/fork）、定制（模型/工具/权限/专家团）、可控（本机运行、不可逆操作需确认）、透明（工具调用/参数/结果全程可回看）。这些能力同时支撑官网三条长程承诺：跑不彻底、结果不能用、永远不会变好。 |
| User correction 6 | 用户否决 4:55 的 2C comparison animatic，先指出不喜欢暗色背景，再要求解释为什么丑。根因不是单一配色，而是仍沿用 PPT/采购表/中心节点图语法：标题、卡片和底部字幕竞争注意力；没有一个具体用户贯穿；青黑橙渐变、扫描线与发光描边形成廉价模板感；真实浅色 WebUI 与伪科技动效割裂；“最大杀手锏 + MIT 圆心”把开源讲成口号。该 animatic 标记 rejected，不得作为最终视频或进入网站。下一版禁止只换白底，必须用明亮编辑动画中的同一用户、同一项目和连续动作来呈现对比、开源、本机控制、透明记录与可回退修订。 |
| User production override | 用户随后明确要求“我要看视频，你等谁呢”，授权跳过三张关键帧确认门，直接制作并交付一版可播放的明亮完整视频。该授权只解除视觉预览门，不解除真实证据、H3 不生成文字/UI、五分钟上限、人工抽帧复核、独立审查、提交但不 push 等约束。 |
| User correction 7 | 用户查看明亮版关键截图后再次否决，指出仍是 PPT。根因是只把暗色卡片换成浅色卡片，继续用大标题、流程线、圆点、居中说明和功能排版代替角色与事件。第三次合成已立即中断。下一版必须是角色驱动的连续动画：具体用户与 Agent 在同一空间中行动，失忆、停工、追问、交接、复核和交付都由事件表现；禁止大标题页、功能卡、采购表、时间线、节点图和流程图。 |
| User correction 8 | 用户进一步明确“核心是故事，例子占比很小”，并禁止用 WebUI 截图糊弄。案例只允许在结尾用十几秒说明：真实 DeBERTa ABSA 项目做了什么、规模和重要产物、公开项目地址；不得再展示 7884 截图、训练页面截图或论文页充当主体。主片必须完整讲述用户交出梦想项目、Agent 快速承诺后遗忘/停工/交半成品、用户被迫当项目经理、多开 Agent 更乱、Mission 介入分工/交接/恢复/独立复核，最终拿到完整成果的故事。 |
| User correction 9 | 全片只能使用动画角色，不出现真人或写实人物。主角必须从头到尾是同一个角色，脸型、发型、服装和色板一致；所有 Agent 使用同一套卡通造型语言，只以颜色、工具和动作区分职责。除片头片尾的官方品牌 Logo 外，故事中不得出现渡鸦、鸟、Corvus 化身或类似意象。纯 T2V 独立生成会导致人物漂移，禁止作为成片路径；必须先冻结角色设定图，再使用参考图驱动的视频工作流。此前真人开场、人物漂移和渡鸦编排器镜头全部作废。 |
| User correction 10 | 一致角色本身不构成合格故事。上一轮“机器人搬箱子、分工、交付”的通用项目管理叙事被否决：没有讲明白简单大纲，也没有呈现长程 Agent 的技术需求。返工版必须按单一因果线说明上下文淘汰、目标/约束/计划持久化、Task 依赖、完整专家团、调度/队列/唤醒/occurrence 恢复、带来源 locator 的 Artifact 交接、独立验收退回、终态收敛、反馈修订和开源运行控制。每个机制必须成为角色事件中的可观察因果，不得只在旁白中报术语。DeBERTa 仍只承担短 Proof。此次未纳入仓库的通用搬箱关键帧全部视为 rejected exploration，不得进入新分镜。 |
| User correction 11 | 用户进一步要求分镜必须参考专门 Skill，不接受主 agent 自由发挥。已完整读取本地 `h3-prompt-writing`、`brand-promo-video-generator`、`3d-animation-short-generator` 及其 `storyboard-guidelines.md`、`shot-table-spec.md`、`qc-checklist.md`，并读取 H3 `base-en.txt` 与 `DIRECTOR_PLAN_GUIDE_en.md`。返工顺序锁定为：前期简报/故事/角色与场景锚点 → 六列标准镜头表 → 六项自检 → 用户确认 → 单文本分镜 → H3 I2V 提示与片段。禁止跳过确认门继续生成。 |

### Skill-driven storyboard review findings

- `standard-shot-table-v3.zh-CN.md` 曾被主 agent 过早标记通过；独立复核证明它违反 Skill 顺序。当前状态已改为 `INVALID PREMATURE DRAFT`。
- 阻塞 1：只有无文字的角色 lineup 与故事关键帧，没有带稳定名称/标签的角色卡，也没有六个 environment-only 场景卡及用户锁定证据。
- 阻塞 2：S10 只演出 Task-1 的三角色协作；S11–S16 没有继续展示 Task-2/Task-3 各自绑定和启动完整专家团，仍可能被理解为通用机器人流水线。
- 阻塞 3：多数锚点缺少逐角色朝向与完整初始姿势；退场角色没有按 Skill 连续追踪两镜。
- 阻塞 4：S13→S14 缺少 Research 被唤醒、从同一 occurrence 获取文件并形成 Artifact 的因果动作。
- 阻塞 5：第六列音频轨没有在所有镜头中独立提供时间锚点、表情路径、眼线和身体动作，不能以逐秒描述代替。
- 阻塞 6：失效镜头表遗漏“用户反馈 → 版本化专家团修订 → 展示差异与回退点 → 等待用户确认 → 安装或保持旧版”的角色因果链；已补回当前故事大纲，重写镜头表时必须落成独立节拍。
- 处理：回到故事大纲确认门。用户批准后按角色卡 → 无人物场景卡 → 六列表 → 自检 → 文本分镜顺序返工；确认前不生成任何新媒体。

## Impact analysis

### Observable need

现有 1:44 演示没有音轨，也没有解释长程任务的故障模型、Mission 的责任边界和 DeBERTa 案例的真实证据链。用户需要的是可用于宣传的叙事成片，而不是模型生成的一组无关短片。

### Direct trigger and data flow

V2 先以 `creative-brief-v2.zh-CN.md` 冻结受众、单一承诺、故事主线、视觉方向、证据与 CTA。用户确认后再重写唯一的 `storyboard.zh-CN.json`，由它驱动旁白、命令打字、H3 官方格式提示词、时间线和抽帧检查点。当前被否决的是 295 秒暗色卡片 storyboard；它只保留作证据且 `production_status=rejected`，生产入口在新分镜获批前必须失败。

### Root constraints and why a naïve path fails

- H3 每次生成 4–15 秒，不能直接一次生成一支叙事完整、产品 UI 字体准确的长视频。
- 生成模型不适合复刻可核验的小字号 UI；让 H3 画产品界面会制造假截图。
- 当前主机不足以加载官方完整 BF16 组件，必须使用经过 5090 实测的量化和动态卸载组合。
- 本地适配来自 Comfy-Org 权重重打包、ComfyUI 原生节点与社区 API 工作流；必须固定提交、核对文件 SHA-256，并把“第三方量化”写进生成 manifest。

因此采用单一事实源：真实截图和产物用本地合成，本地 H3 只负责明确标注的生成镜头；旁白、字幕和画面时间线由同一分镜文件生成，避免双源漂移。

### Affected surfaces

- 新增独立宣传视频工具，不改 OpenCorvus Runtime、Overlay、Mission、Provider 或网站产品代码。
- 输出写入仓库外的演示目录，避免把大体积中间视频混入源码历史。
- `specs/README.md` 增加本记录索引。
- 不新增或运行 UI 自动化测试；7884 只做隔离标签页的人工截图采集。

### Risks

- 本地 H3 权重约 42.5GB，安装与校验耗时较长；下载必须可恢复并逐文件 SHA-256 校验。
- 当前 pagefile 只有 4GB，且约 39GB 物理内存空闲；先以 0.4MP、3秒、10步做单镜头验收，监测 RAM/VRAM。若内存不足，降低到 0.2MP，不修改系统 pagefile，除非另获授权。
- 真实页面可能含敏感或无关信息：截图前只显示本案例区域，成片再裁切。
- 中文字体与 FFmpeg 文本转义易出错：文本先由 Pillow 渲染为帧，不依赖 `drawtext`。
- 长生成卡死：API polling 以状态变化为活动信号，草稿 12 分钟无活动即失败；下载 2 分钟无字节活动即失败。

## Current 2C story truth

1. 从用户真正的痛点起手：长要求得到快速回复，但资料、测试、网页、论文仍是半成品，用户被迫给 Agent 当项目经理。
2. 展示个人目标为什么天然是长工作流：论文、开源项目、副业应用、作品集都要跨调研、设计、实现、测试、修改和发布。
3. 在同一用户与同一项目中表现 WorkBuddy、DeepSeek Harness、Codex、Claude Code 与 OpenCorvus 的工作重心不同；不使用采购表，也不比较胜负。
4. 再揭示 OpenCorvus Mission，并单独解释开源、定制、可控、透明四个官网支柱。
5. 以真实 7884 具名 Agent 会话展示调研、实现、测试和独立复核的接力。
6. DeBERTa 案例只作为后半段可信证明，展示 12 小时 45 分、46 个 Agent 会话、产物、受限指标和公开仓库。
7. 回到用户可立即代入的个人长项目，最后给出品牌、作者、官网、主仓和实例仓库。

禁止口径：`100% autonomous`、`production-ready`、未验证的性能提升、未发生的 H3 生成、对具体竞品能力的绝对否定。当前故事顺序只冻结叙事事实，不授权暗色卡片 storyboard 继续生产。

同类资料来源：

- https://www.workbuddy.ai/
- https://deepseek.com/harness/en/
- https://developers.openai.com/codex/cloud
- https://code.claude.com/docs/en/agents
- https://code.claude.com/docs/en/agent-teams

## Animation grammar after user correction

- 不使用逐页标题加卡片或要点列表的演示文稿语法。
- 每个非 H3 段落必须表现真实 UI 或真实证据中的一个变化：命令输入、Task/子会话出现、Provider/CUDA 活动、训练曲线更新、Artifact locator 打开、审校完成或发布回执产生。
- 文字只做运动标题、对象标签和必要字幕；核心解释必须从运动关系中看懂。
- 真实截图以用户动作、摄像机推拉、局部放大或对象窗口进入动画，不能静态并排超过 3 秒。
- 相邻段落使用真实屏幕反射、光标动作、相同运动方向、声音和 Artifact locator 连续转场；禁止以发光点、轨道、节点网络或抽象粒子替代真实协作。
- 接触表之外，至少抽取每个动画段的首、中、尾帧，确认对象状态确实发生有意义变化，而不是只做整体缩放。

## Pipeline contract

### Inputs

- `storyboard.zh-CN.json`
- 7884 真实截图、已留存 DeBERTa Mission PNG、PDF 和 JSON
- 隔离 ComfyUI、本地量化权重和扁平 API 工作流
- FFmpeg、FFprobe、Python 3.11、PyTorch CUDA 13.0、Pillow

### Outputs

- `draft/opencorvus-long-mission-animatic-<storyboard-sha12>.mp4`
- `final/opencorvus-long-mission-h3-<storyboard-sha12>.mp4`：只有全部声明的 H3 镜头真实存在时生成
- `frames/animatic-<storyboard-sha12>/contact-sheet.jpg` 与逐段 PNG
- `reports/frame-check-animatic-<storyboard-sha12>.json` 与生成回执

### Commands

```powershell
python produce.py prepare --output D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824
```

`voice`、`animatic` 与 `compose` 当前必须因 rejected storyboard 失败。三张明亮关键帧获用户认可并重写唯一 storyboard 后，才恢复这些生产命令；新的 H3 scene ID 必须来自新 storyboard，不预写 `hook`、`cta` 等旧场景名。

### Benchmark acceptance

- 1920×1080、25 或 30 fps、H.264 视频；最终版含 AAC 音轨。
- 生产版目标总时长 3 分 30 秒至 5 分钟；叙事覆盖具体失败、运行层原因、Mission 持久机制、真实执行、运行时长、产物、受限指标、质量门、长工作流场景与唯一 CTA。
- 每个段落的中点帧非黑；连续检查点不得全同；实际媒体时长与时间线误差不超过 0.5 秒。
- 命令字号在 1080p 下至少 34px，逐字出现后完整停留至少 1.5 秒。
- 真实截图不由 H3 重绘；产物数据、指标和文件名保持来源一致。
- 字幕与旁白共用同一文本源，字幕安全区距离边缘至少 80px。
- 接触表人工检查无黑帧、错误裁切、文字溢出、UI 假字、内容重复或 CTA 截断。

## Iteration policy

1. 先制作三张 1920×1080 明亮关键帧：用户痛点、同一项目上的工具切换、开源动作链。用户不认可就只改关键帧，不渲染整片。
2. 三张获认可后重写唯一 storyboard，并先生成不计费的本地 animatic，验证叙事、时长、截图裁切和聊天输入打字效果。
3. animatic 获认可后，在单张 RTX 5090 上用 H3 生成一个 0.2MP、4–5 秒、10 步的无文字明亮个人工作空间镜头；不得生成脱离人物的芯片空镜。
4. 抽取每个 H3 镜头首、中、尾帧；发现人物或文字畸变、闪烁、黑帧、叙事不符时，只改该镜头 prompt 并重生成。
5. 合成后再次自动检查媒体结构，并人工查看完整接触表和关键全尺寸帧；帧差只能证明画面变化，不能替代语义运动判断。
6. 只把人工复核通过的本地镜头纳入最终合成；最终 1080p 由 FFmpeg 高质量放大与真实 UI 原生 1080p 图层共同完成，不把插值描述成 H3 原生 2K。

## Single-5090 local acceptance

- 固定 ComfyUI 提交 `0764232429b8cfb10b79b6f186c8cb23e0b22897` 或验证过的更新提交；运行时与 OpenCorvus 隔离。
- 使用 Comfy-Org `minimax_h3_fl2va_pruned_int8_convrot.safetensors`、`qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`、两个官方重打包 VAE；所有文件按公开 inventory 校验大小和 SHA-256。
- 通过 ComfyUI `/prompt` 提交扁平 API 工作流；不得依赖人工点击完成烟雾测试。
- 烟雾测试必须含 24fps H.264 视频和 32kHz 双声道 AAC 音频；无黑帧；首、中、尾帧可辨且有运动差异。
- 记录峰值显存、峰值系统已用内存、冷启动时长和完整请求时长；任何 OOM 或系统换页失控都视为失败，并先降分辨率再评估，不隐藏故障。

## 2C comparison animatic acceptance

- 失败证据已移动到不会被新分镜覆盖的显式路径：`D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824\draft\opencorvus-long-mission-animatic-rejected-dark-20260824.mp4`；对应帧目录和报告也使用 `rejected-dark-20260824` 后缀。
- 实测媒体：295.0 秒（4:55）、1920×1080、25 fps、H.264、AAC 48 kHz 双声道。
- 自动抽帧：15 段各取首/中/尾帧；全部非黑，旧报告中全部段落的两组整帧差大于 0.5。该检查只能证明媒体结构和抽样帧发生变化，不能证明语义运动；旧渲染器的全局扫描线会制造假阳性，现已删除，字段改为 `frame_change_observed`，不得再称 `motion_verified`。
- 人工复核：查看完整接触表和放大后的 comparison middle、open-source pillars end、real-agents middle、mission-reveal end。比较段五行均可读且用动态焦点表达“重心不同”；开源段 MIT、四支柱、源码地址和可回退修订不遮挡；真实 Agent 会话保留原始截图并能看清具名角色；Mission 命令使用用户聊天气泡而不是终端。
- 当前 `user-pain` 仍是明确标记的 H3 占位动画；正式版必须替换为本地 H3 生成的无文字个人工作空间镜头，并重新执行同一轮检查。
- 用户尚未批准本 animatic；不得 push 或将其称为最终视频。

## Character-story motion proof V1

状态：**REJECTED / INVALIDATED**。用户更正 9 已废除这一版的全部角色与镜头设计；它只能保留为失败过程证据，不能作为风格样片、网站候选或后续 H3 参考。

- 视频：`D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824\character-story\opencorvus-mission-character-story-v1.mp4`
- 接触表：`D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824\character-story\contact-sheet-v1.jpg`
- 媒体事实：53.0 秒、1920×1080、25 fps、H.264、AAC；片头 3 秒、故事 42 秒、片尾 8 秒。
- 故事镜头：清晨个人项目开场；多个 Agent 把半成品留给用户；渡鸦编排器组织 Agent 接力同一份项目；Agent 团队把包含模型、网页、图表与论文意象的完成项目箱交给用户。中间不使用 7884、训练页、论文页或产品截图。
- 旁白中的案例只说明 DeBERTa ABSA、12 小时 45 分、46 个 Agent 会话、GPU 训练、网页、图表、五页论文和公开仓库；精确项目地址只在片尾显示。
- 否决原因：第一镜包含近真人质感人物；后续至少出现三套不同主角身份；Agent 基础造型不一致；故事将渡鸦拟人化为编排器，直接违反同一角色、同模 Agent、无真人和无 Corvus 意象的新约束。
- 叙事缺失：没有完整演出中断恢复、独立复核退回再修复、开源自托管、权限确认、透明工具记录和可回退修订。竞品差异仅由旁白交代。
- 媒体缺陷：AAC 为 24 kHz 单声道，结尾约 10.64 秒没有有效旁白；生成场景含不可读伪文字。该视频没有与其逐镜一致的权威 storyboard/manifest；`storyboard.zh-CN.json` 当时和现在均为 rejected，不能宣称已批准。
- 用户未批准前不得 push、不得进入网站、不得把 V1 称为最终视频。

## Frozen character direction V2

- 唯一角色设定：`script/video/minimax-h3-mission-promo/assets/character-story/character-bible-v1.png`。
- 第一张故事关键帧：`script/video/minimax-h3-mission-promo/assets/character-story/user-pain-keyframe-v1.png`。
- 主角固定为短卷发、海军蓝圆框眼镜、薄荷绿外套、白 T 恤、深灰裤、珊瑚色鞋的卡通个人创作者。
- 所有 Agent 固定为暖白圆角机器人本体、黑色面屏、青色椭圆眼；仅用青、蓝、橙、紫色配件与工具区别调研、实现、测试和独立复核。
- 故事中禁止真人、写真人、鸟、渡鸦、羽毛和 Corvus 化身。官方 Logo 只允许以确定性品牌图层出现在片头片尾。
- 角色设定图先派生逐镜关键帧，再以 H3 I2V/FL2VA 驱动动作。独立 T2V 片段不得进入成片。
- 第一张关键帧演出用户痛点：调研 Agent 交付不完整资料、实现 Agent 留下松散部件、测试 Agent 给出未勾选清单，用户仍被迫收尾。画面无可读文字、无 UI 截图、无卡片或表格。

### H3 I2V consistency proof

- 哈希绑定样片：`D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824\h3-local\user-pain-character-v2-verified.mp4`。
- 哈希绑定报告：`D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824\reports\local-h3-user-pain-character-v2-verified.json`；原始非缓存运行与报告保留 `user-pain-character-v2` 名称作为性能证据。
- 输入：冻结关键帧 `user-pain-keyframe-v1.png`；ComfyUI 实际使用 `video_minimax_h3_i2v.api.json`、`minimax_h3_fl2va_pruned_int8_convrot.safetensors` 与 `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`。
- 实测：单张 RTX 5090，10 steps，107 帧，原始非缓存生成耗时 35.48 秒；峰值显存 31,902 MiB，最低空闲系统内存 7.07 GiB。加入哈希字段后的同 seed 复跑命中 ComfyUI 缓存，耗时 5.02 秒，不能冒充新的模型推理性能。
- 可复现绑定：参考图 SHA-256 `70f059b473855be9a9974cdea05aea3dd05e3b07a0b19910f802f420ef632c7e`；I2V 工作流 SHA-256 `79591267bfc4371e51436170441993131645575c649bd60c2420a2e81ac3ba81`。
- 媒体：4.458 秒、608×352、24 fps、H.264、AAC 32 kHz 双声道；首中尾非黑且相邻抽帧平均亮度差分别为 31.57 和 30.25。
- 人工抽帧复核：主角发型、圆框眼镜、薄荷绿服装保持一致；三只 Agent 的暖白圆角本体、黑面屏、青色眼睛与角色配色保持一致。画面从半成品堆到用户面前推进到用户按额叹气，没有真人、鸟、渡鸦、Logo、UI 截图、卡片或表格。
- 该样片只通过“痛点镜头与角色一致性”门，不等于整片已获用户批准；完整 storyboard 仍保持 rejected，批准前不得扩展为整片、网站产物或 push。
