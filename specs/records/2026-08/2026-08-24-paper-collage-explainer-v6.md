# OpenCorvus 长程 Agent 科普片 V6：纸拼贴解释片 Gate 1

状态：**AWAITING USER APPROVAL / 禁止生成静帧与视频**  
适用 Skill：`paper-collage-explainer-generator`  
目标成片：16:9，128 秒（2:08），不超过 5 分钟

## Recall

### 用户原始要求

- 保留当前 Desktop V5 为待定候选，再制作一个“类似科普风格”的完整版本。
- 新版本同样必须遵守专门视频 Skill，不能由主 Agent 自由发挥后直接生成。
- 沿用已经确认的核心内容：长程 Agent 的故障机制、Mission 的持久编排、独立验收、开源控制、专家团自进化、短 DeBERTa 真实案例、个人长工作流与 OpenCorvus 品牌入口。

### 验收指标

- 观众先理解“为什么聪明 Agent 做不完长任务”，再理解 Mission 怎样补上运行层。
- 主要信息通过物体关系和定格动作解释；不靠 PPT 卡片、术语墙、节点图或大段 UI 截图。
- 6 个宏观知识段、32 个逐一审批的纸拼贴镜头；每镜固定 4 秒并绑定一张 Gate 2 最终静帧。
- 全片 16:9、少于 5 分钟；拼贴风格、色板、纸张材质、阴影和音效节奏一致。
- H3 画面不生成可读文字、Logo、指标、代码或 UI；品牌、产品名、URL 和真实数字只做确定性后期。
- 片头与片尾均展示官方 OpenCorvus Logo、品牌、官网、主仓和作者，使用不同构图；片尾另给案例仓库。
- 案例只证明结论，不抢占故事；指标必须同时保留 single seed 42、1,800 条训练样本和 fixed-run 限制。
- 静帧与视频均须抽帧人工复核；最终修改后由未参与实现的独立 Agent 只读复核。

### 硬约束

- 严格执行 Skill 两个门：Gate 1 生产计划审批；Gate 2 每段最终静帧审批。两门通过前不得生成视频。
- Skill 默认音频是纸张滑动、弹入、压平、轻敲和摩擦等 collage SFX；不得默认添加 BGM、旁白或字幕。
- 纸片必须逐件 `appear → bounce → press flat → pause → lock`；禁止整体淡入、慢推镜、数字图层漂移、快速旋转、混乱飞入和相机缩放。
- 不使用脏污、泛黄、牛皮纸和重度褶皱；底色为干净的彩色纸场。
- 不生成真人、人物面孔或需要跨镜保持身份的角色；采用物体驱动的视觉隐喻，规避人物漂移。
- V5 成片与证据继续保留；V6 使用独立文件名、目录和 build digest，不覆盖 V5。
- 用户确认前不 push。

### 已读资料

- `D:\myhexin-local\demos\minimax-h3-local-5090\skills\paper-collage-explainer-generator\SKILL.md`（完整读取）。
- `specs/records/2026-08/2026-08-24-minimax-h3-mission-promo-video.md` 的用户纠正、真实案例口径、V5 证据和拒绝方向。
- `script/video/minimax-h3-mission-promo/README.md` 的当前 V5 生产事实、5090 H3 路径和证据边界。

### 搜索结果与兼容性

- 本地同时存在手绘实拍、纸拼贴、纸艺定格和极简广告 Skill；`paper-collage-explainer-generator` 与“抽象知识科普”最匹配。
- Skill 原始兼容层依赖 MiniMax Hub；当前环境没有 Hub canvas，但已有单张 RTX 5090 上验证过的 MiniMax H3 I2V 路径。后续只替换执行工具，不改变 Gate、静帧锚点、动作语法、音频默认和 QA 规则。
- 本轮只到 Gate 1，不需要启动 7883/7884、ComfyUI 或 H3，也不读取用户凭据。

### 独立 Agent 反馈

- 首轮只读复核发现：212 秒目标与六张静帧审批不一致，会让约 53 个实际镜头绕过 Gate 2；P3 未逐一锁定产品重心；P5 未明确映射官网四支柱；新 spec 受 `/specs/` ignore 影响需要精确强制跟踪。
- 处置：目标收紧为 128 秒；新增 32 镜逐镜表且 Gate 2 必须审批 32 张静帧；补全五产品映射和四支柱映射；提交前只对本文件使用精确 `git add -f`。
- 二次只读复核脚本化确认 32 镜时间连续、每镜 4 秒、总长 128 秒，逐镜 final frame / motion / SFX / continuity 非空；五产品、四支柱、Gate 2 数量、V5 保留和禁 push 均无未解决发现。

## Brief

### 主题与学习目标

不是解释“Agent 不够聪明”，而是解释：长程任务为什么会超出单个上下文；为什么增加 Agent 数量仍会失控；为什么需要一个把目标、依赖、状态、产物、验收和反馈保存到上下文之外的 Mission 运行层。

观众看完应能复述三句话：

1. Context Window 会满，旧约束可能在压缩后失去作用。
2. 多 Agent 没有共同持久状态，只会放大碎片化和交接成本。
3. Mission 用持久契约、依赖调度、可恢复 occurrence、可定位 Artifact、独立验收和版本化专家团修订，让长任务诚实收敛。

### 受众与使用场景

- 受众：学生、研究者、独立开发者、开源作者和副业创作者。
- 使用：官网、GitHub、Bilibili/YouTube 横版介绍和产品演示前导。
- 视角：2C；讨论“为什么我又要替 Agent 收尾”，不是企业采购或管理汇报。

### 画幅、时长、语气与节奏

- 16:9，1920×1080 交付；32 个 H3 小镜头各 4 秒。
- 六个宏观段共 128 秒；每段由 4–6 个经 Gate 2 审批的定格镜头组成。
- 语气：好奇、尖锐、清晰、最后转为可信和有希望；不做胜利号角或万能承诺。
- 节奏：前 36 秒建立失败实验；中间 72 秒逐层解释机制；最后 20 秒给受限证据、个人场景和 CTA。

### 视觉风格

高级编辑纸拼贴：干净彩色纸场、黑白 halftone 摄影剪影、选择性色卡、暖奶油描边、轻微纸纤维、柔软物理阴影、撕边和清楚的前中后景。全片没有人物面孔；主角是同一组可追踪物件：项目卷宗、约束卡、任务车厢、Artifact 档案、审查透镜和版本抽屉。

控制色板：

- burnt orange：时间压力、遗忘和提前结束；
- mustard yellow：警告、工具与累积错误；
- deep purple：上下文、记忆与结构；
- teal：协作、执行与系统流；
- ink green：判断、复核与恢复；
- rose red：荒诞的重复劳动和 rejected。

片头前 4 秒在干净 cream 纸场上使用官方 Logo 的确定性图层，短暂给出 `OpenCorvus`、`opencorvus.com`、主仓与作者后，Logo 像一枚纸制铆钉压入项目卷宗并进入 P1；片尾最后 8 秒在完成后的个人 Mission 卷宗内用不同构图展示同一品牌信息和案例仓库。Logo、文字与地址都不由 H3 生成。

### 媒体方式

Skill 默认：保留或生成纸拼贴 SFX；当前 Gate 1 **不添加 BGM、旁白或字幕**。科普长片建议用户显式批准“中文旁白 + collage SFX + 克制 BGM”，可不烧录字幕；未批准则按 SFX-only 生产。

## 六个视觉隐喻

### 1. 有限窗口吞掉旧约束（00:00–00:20）

- 核心意义：Agent 能快速开工，但有限 Context Window 在持续输入下发生 compaction，早期约束被挤出，随后 plan drift 和 premature termination。
- 情绪：惊讶 → 不安。
- 视觉命题：一条长纸带穿过很小的紫色取景框；新纸片不断进入，最早的 CUDA 芯片卡、测试尺和发布钥匙从背后掉落；半成品模型却被玫红印章提前封箱。
- 关键物件：紫色 context 框、长纸带、CUDA 芯片卡、测试尺、发布钥匙、半成品封箱。
- 底色与强调：deep purple → burnt orange；mustard 警示边。
- 组装顺序：空纸场 → context 框 → 项目纸带 → 新结果片 → 旧约束掉落 → 半成品提前封箱。
- SFX：纸带滑入、压缩折叠、三次掉落、错误印章闷响。

### 2. 更多 Agent 放大碎片（00:20–00:36）

- 核心意义：没有共同持久状态，多 Agent 会重复实现、互相等待并遗留无人拥有的依赖。
- 情绪：荒诞、焦躁。
- 视觉命题：四把不同颜色的剪刀同时裁同一张蓝图，得到四套无法拼合的零件；线轴互相缠住，一枚关键齿轮孤零零留在画外。
- 关键物件：共享蓝图、四把剪刀、重复零件、缠结线轴、孤立齿轮。
- 底色与强调：rose red + mustard；少量 deep purple。
- 组装顺序：蓝图铺平 → 剪刀弹入 → 重复裁切 → 零件冲突 → 线轴打结 → 孤立齿轮停住。
- SFX：剪纸、重复弹响、线绳摩擦、小齿轮滚停。

### 3. 工具层次与 Mission 外部记忆（00:36–01:00）

- 核心意义：不同工具分别聚焦办公成品、可组合运行时、软件工程与编码协作；长目标还需要保存契约和编排责任的层。
- 情绪：澄清、重新掌握方向。
- 视觉命题：四种纸制工具围绕一个空缺的档案槽；OpenCorvus 的卷宗从下方滑入，目标石、约束锁和验收尺被铆接到卷宗上，随后展开六个 Task 页签。
- 关键物件：办公压印机、模块工具箱、代码夹具、协作线板、Mission 卷宗、目标石/约束锁/验收尺。
- 底色与强调：warm cream + teal + ink green。
- 组装顺序：四种工具依次出现 → 中央空槽显露 → Mission 卷宗滑入 → 三种契约物件压平 → Task 页签展开。
- SFX：四次轻敲、档案滑入、铆钉压合、页签连弹。
- 确定性后期映射：`WorkBuddy → 一句话交付办公成品`；`DeepSeek Harness → 开发者可组合运行时`；`Codex → 软件工程 Agent`；`Claude Code → 编码与并行协作`；`OpenCorvus → 开源、跨领域、长程 Mission`。只说工作重心，不排名、不画勾叉、不宣称其他产品做不到。

### 4. 调度与同一轮次恢复（01:00–01:24）

- 核心意义：Task 依赖决定 waiting/ready/running；queue 只是提示，系统重读持久事实并取得 activation lease 后才执行；专家团版本在创建时冻结；中断后从同一个 occurrence 和游标恢复，不重复派发。
- 情绪：精密、可信。
- 视觉命题：六节纸制任务车厢由依赖铆钉连接；信号灯按条件依次翻片。运行到第三节时纸场被撕开，书签和编号封条跨过裂缝保持位置；纸场重新拼合后同一节车厢继续，不出现复制车厢。
- 关键物件：六节任务车厢、依赖铆钉、翻片信号灯、专家团版本封条、断裂纸场、occurrence 书签。
- 底色与强调：teal + ink green；中断瞬间 burnt orange。
- 组装顺序：轨道压平 → 车厢逐节出现 → 版本封条锁定 → queue 小票弹出但信号不动 → 持久事实铆钉到位 → lease 封蜡落下 → 信号翻片 → 第三节运行 → 纸场撕裂 → 书签保留 → 原车厢恢复。
- SFX：铆钉轻压、翻片、纸张撕裂、短静默、重新压合、同节奏继续。

### 5. Artifact、独立验收与专家团自进化（01:24–01:48）

- 核心意义：交接的是带来源和 locator 的真实产物；实现者不能自验；任务只能以 accepted 或 blocked-with-evidence 诚实收敛；失败证据进入候选 revision，经 diff、聚焦验证、回滚点和用户确认后才服务新任务。
- 情绪：审慎、可控。
- 视觉命题：Artifact 档案由一根 teal 线连接到来源卷宗，locator 透镜精确对准其中一格；独立审查透镜发现裂口，玫红退回片弹出。修补通过后，裂口形状被压成一张候选专家团补丁，与旧版并排放入透明开源抽屉；确认拨片落下，新任务取新版，运行中车厢仍保留旧封条。
- 关键物件：Artifact 档案、来源线、locator 透镜、审查透镜、退回片、修补片、旧/新版本抽屉、确认拨片。
- 底色与强调：ink green + deep purple；rejected 使用 rose red，accepted 使用 teal。
- 组装顺序：Artifact 建立来源 → locator 锁定 → 独立审查 → rejected 退回 → 修补复验 → accepted；无法继续的分支进入带证据的封存袋 → 候选补丁生成 → old/new 并排 → 确认 → 新旧任务分流。
- SFX：线绳绷紧、透镜咔哒、退回弹响、补丁压平、抽屉滑动、确认拨片。
- 开源支柱：透明抽屉表现审计；可替换模块表现模型/工具；钥匙表现权限；旧版抽屉表现 rollback；确定性后期只在必要处解释 MIT、自托管和可审计。
- 官网四支柱锁定映射：`开源 = MIT / 自托管 / fork`；`定制 = 可替换模型 / 工具 / 权限规则 / 专家团`；`可控 = 不可逆操作确认 / user confirmation / rollback`；`透明 = Artifact lineage / diff / tool audit`。四项必须在同一开放式工作台中由动作连续揭示，不排成四张功能卡。

### 6. 受限证据回到个人项目（01:48–02:08）

- 核心意义：DeBERTa Mission 证明机制能够长时间协调真实产物，但不证明普遍 SOTA；这些机制最终服务个人论文、开源项目、副业、作品集和独立研究。
- 情绪：可信、开放、有行动欲。
- 视觉命题：一个小型证据陈列架依次放入 GPU 芯片、三个实验条、网页窗、两张图和五页论文；天平另一侧始终保留 single-seed 限制砝码。陈列架折叠成六个个人项目文件夹，最后一个文件夹滑入 OpenCorvus Mission 卷宗。
- 关键物件：证据架、GPU 芯片、三条实验纸、网页窗、两张图、五页纸、限制砝码、六个项目文件夹、Mission 卷宗。
- 底色与强调：warm cream + ink green + teal；品牌处少量官方蓝。
- 组装顺序：空架 → 证据逐件落位 → 限制砝码压稳 → 架子折成文件夹 → 六类项目展开 → 其中一个滑入 Mission → 品牌收束。
- SFX：陈列轻放、砝码闷响、折纸、文件夹翻动、卷宗压合。
- 确定性后期：12h45m、6 Tasks、3 squads、46 sessions、20 roles、RTX 5090、三组 CUDA、83.43%/83.61%、single seed 42、1,800 examples、主仓/案例仓/官网/作者。

## Silent Visual Beat Track

在用户没有显式批准旁白前，不写口播稿。无旁白版本依靠以下理解链：

1. 项目要求完整进入，但窗口容量有限；旧约束被挤出，半成品被提前封箱。
2. 多把剪刀不是协作；没有共同卷宗，结果互不兼容且留下孤儿依赖。
3. 四类工具各自有效，但中央仍缺长期契约；Mission 卷宗补上这个外部记忆。
4. 依赖铆钉、信号灯、版本封条和 occurrence 书签共同解释调度与恢复。
5. Artifact 来源线与独立透镜解释可追溯验收；失败形状进入可审查、可回滚的新专家团修订。
6. 真实案例证据与限制砝码同时出现；最后回到个人项目和唯一 CTA。

## 确定性技术术语轨

术语只在对应纸片事件发生时短暂出现，不能独立形成术语墙：

| 段 | 后期术语 |
|---|---|
| P1 | `Context Window`、`Context Compaction`、`Instruction Loss`、`Plan Drift`、`Premature Termination` |
| P2 | `State Fragmentation`、`Duplicated Work`、`Orphaned Dependency` |
| P3 | `Persistent Mission Record`、`Final Goal`、`Hard Constraints`、`Acceptance Contract`；五个产品只陈述工作重心 |
| P4 | `Task Dependency`、`Squad Revision · Frozen`、`Queue Hint`、`Wakeup`、`Activation Lease`、`Occurrence`、`Durable State`、`Resume Cursor` |
| P5 | `Artifact Lineage`、`artifact_read`、`artifact_select`、`Independent Review`、`Rejected`、`Accepted`、`Blocked with Evidence`、`Expert Squad Self-Evolution`、`Rollback`、`User Confirmation`、`MIT`、`Self-hosted`、`Audit` |
| P6 | 案例运行时、规模、CUDA、产物、指标和 single-seed/fixed-run 限制；品牌、官网、主仓、作者与案例仓 |

## Gate 1 Storyboard

| 段 | 时间 | 最终画面 | 动作核心 | SFX | 连续性 |
|---|---:|---|---|---|---|
| P1 有限上下文 | 20s | 半成品箱被提前封住，三张约束卡散落在 context 框外 | 纸带进入、压缩、掉卡、封箱 | slide / fold / drop / stamp | 紫→橙，项目卷宗首次出现 |
| P2 多 Agent 碎片 | 16s | 四套重复零件互不兼容，线轴打结，孤儿齿轮停住 | 裁切、冲突、打结、滚停 | cut / pop / rub / stop | 保留同一项目蓝图 |
| P3 Mission 外部记忆 | 24s | Mission 卷宗锁住目标、约束、验收并展开 Task 页签 | 工具轮换、卷宗滑入、铆接、页签展开 | tap / slide / press / pop | 红色混乱回归 cream/teal 秩序 |
| P4 调度与恢复 | 24s | 裂缝修复后，同一第三节车厢从原书签继续 | 车厢组装、事实/lease、生效、撕裂、原位恢复 | press / flip / tear / relock | 版本封条始终不换 |
| P5 证据、验收、自进化 | 24s | 新任务取候选新版，运行中任务继续持有旧版 | 定位、退回、修补、验证、抽屉、确认 | click / reject / patch / drawer | Artifact 来源线贯穿全段 |
| P6 Proof 与个人场景 | 20s | 个人项目文件夹进入 Mission，品牌与入口后期出现 | 证据陈列、限制砝码、折叠、文件夹、压合 | place / weight / fold / press | 证据色板过渡到品牌收束 |

## 32 镜 Gate 1 逐镜表

每一行都对应 Gate 2 的一张最终静帧和后续一个 4 秒 H3 clip。用户可按镜头编号单独批准或退回；未批准镜头不得进入视频生成。

| 镜头 | 时间 | 最终静帧锚点 | 组装与动作 | SFX | 连续性 |
|---|---:|---|---|---|---|
| S01 | 00:00–00:04 | 官方 Logo 后期压在 cream 卷宗铆钉位；品牌/官网/主仓/作者可读 | 空纸场→卷宗→Logo 确定性压入 | paper place / press | 品牌构图 A；Logo 不进 H3 |
| S02 | 00:04–00:08 | 完整长项目纸带与三张约束物件进入紫色窗口 | 纸带滑入，CUDA 卡、测试尺、发布钥匙依次弹入 | slide / pop×3 | 同一卷宗成为项目纸带 |
| S03 | 00:08–00:12 | Context 窗口被新结果纸片填满 | 新结果逐片压入，窗口边缘收紧 | pop / fold / press | 紫色窗口位置不变 |
| S04 | 00:12–00:16 | 三张早期约束掉在窗口外 | 压缩折叠后，约束卡逐张滑落 | fold / drop×3 | 纸带仍向前运动 |
| S05 | 00:16–00:20 | 半成品箱被 rose 印章提前封住 | 缺口箱体弹入，错误印章压下并停住 | pop / stamp | 箱上缺口进入 P2 蓝图 |
| S06 | 00:20–00:24 | 同一缺口蓝图被四把剪刀包围 | 蓝图铺平，四把剪刀从四侧弹入 | paper spread / pop | 延续 S05 的缺口形状 |
| S07 | 00:24–00:28 | 四套相似但不兼容的零件堆叠 | 同步裁切，重复零件轻弹后错位 | cut / pop / tap | 四种职责色首次出现 |
| S08 | 00:28–00:32 | 四个线轴在中央打结 | 线绳逐根滑入、缠绕、拉紧 | slide / rub / snap | 零件仍在四角 |
| S09 | 00:32–00:36 | 孤立齿轮停在画外，中央结无法运转 | 齿轮滚入边缘后停住，其余物件冻结 | roll / stop | 齿轮成为 P3 中央空槽 |
| S10 | 00:36–00:40 | 办公压印机产出整齐成品纸 | 机器纸件组装并压出成品 | assemble / press | 后期锁定 WorkBuddy 重心 |
| S11 | 00:40–00:44 | 模块工具箱展开可组合插槽 | 工具箱滑入，模块逐个扣合 | slide / click | 后期锁定 DeepSeek Harness 重心 |
| S12 | 00:44–00:48 | 代码夹具把零件固定成软件构件 | 夹具合拢，构件压平 | clamp / press | 后期锁定 Codex 重心 |
| S13 | 00:48–00:52 | 协作线板连接多条编码工作线 | 线程卡逐一扣在线板上 | pop / string snap | 后期锁定 Claude Code 重心 |
| S14 | 00:52–00:56 | 四种工具围绕仍为空的长程档案槽 | 工具向外让位，中央空槽显露 | slide / hollow tap | 不排名、不画勾叉 |
| S15 | 00:56–01:00 | Mission 卷宗填入槽位并锁住目标石、约束锁、验收尺、六页签 | 卷宗滑入，三件契约物压平，页签连弹 | slide / press / pop | 后期锁定 OpenCorvus 重心 |
| S16 | 01:00–01:04 | 六节 Task 车厢由依赖铆钉串联 | 轨道压平、车厢逐节出现、铆钉落位 | press / pop / rivet | teal/green 调度色板开始 |
| S17 | 01:04–01:08 | Queue 小票已出现，但信号仍 waiting；持久事实铆钉刚到位 | 小票弹出、信号保持、事实铆钉逐个压下 | ticket pop / rivet | 表明 queue 不是事实源 |
| S18 | 01:08–01:12 | Activation lease 封蜡落下，信号翻到 running | lease 封蜡压入，信号翻片，第二车厢启动 | press / flip / start tap | 版本封条已锁定 |
| S19 | 01:12–01:16 | 第三步 occurrence 书签夹在同一车厢 | 车厢行进三格，书签落在第三格 | rail taps / bookmark | dispatch 仅一份 |
| S20 | 01:16–01:20 | 纸场撕裂，但书签和版本封条跨裂缝保留 | 撕裂穿过轨道，车厢停住 | tear / short silence | occurrence 身份不变 |
| S21 | 01:20–01:24 | 纸场重新压合，同一车厢从第三格继续 | 裂缝压平，原车厢恢复下一格 | press / relock / continue | 没有复制车厢 |
| S22 | 01:24–01:28 | Artifact 档案通过 teal 来源线连接上游卷宗，locator 透镜锁定一格 | 档案滑入、来源线绷紧、透镜咔哒 | slide / string / click | 同一来源线贯穿 P5 |
| S23 | 01:28–01:32 | 下游档案先读取再选中同一来源 | read 透明片落下，selected 边框随后压平 | place / press×2 | 后期标 `artifact_read/select` |
| S24 | 01:32–01:36 | 独立审查透镜发现裂口，rose 退回片弹出 | 透镜移到裂口，退回片反弹 | lens click / reject pop | 实现者与审查者视觉分离 |
| S25 | 01:36–01:40 | 修补通过进入 accepted；另一受阻分支进入带证据封存袋 | 补丁压平，green 封条落下；amber 袋并列封存 | patch / accept / bag seal | 两种诚实终态并列但不成卡片墙 |
| S26 | 01:40–01:44 | 失败裂口形状成为候选专家团补丁，old/new 抽屉并排 | 缺陷轮廓转印到补丁，两个抽屉滑开 | rub / print / drawer | candidate 未自动安装 |
| S27 | 01:44–01:48 | 开放工作台同时可见源码卷、可替换模块、权限钥匙、审计线轴与 rollback 抽屉；确认拨片使新任务取新版、旧任务保留旧封条 | 四支柱物件逐件压入，拨片最后落下，任务分流 | place×4 / confirm / split | 四支柱是连续动作，不是四卡片 |
| S28 | 01:48–01:52 | DeBERTa 证据架装入 GPU、三实验条、网页窗、两图与五页论文 | 证据物逐件轻放并锁定 | place / tap | 真实证据后期可短暂嵌入 |
| S29 | 01:52–01:56 | 结果天平一侧为指标，另一侧为 single-seed/1,800 限制砝码 | 数值后期出现，限制砝码同时落下保持平衡 | weight thud / balance | 不做 SOTA 或普遍承诺 |
| S30 | 01:56–02:00 | 证据架折成论文、课程、OSS、副业、作品集、研究六个文件夹 | 架子连续折叠，六文件夹扇形展开 | fold / folder flutter | 从 Proof 返回 2C 场景 |
| S31 | 02:00–02:04 | 一个个人项目文件夹滑入 Mission 卷宗并压合 | 文件夹滑入、卷宗合拢、目标石重新亮起 | slide / close / press | 与 S15 卷宗同一造型 |
| S32 | 02:04–02:08 | 完成的 Mission 卷宗内显示官方 Logo、品牌、官网、主仓、作者和案例仓 | 纸场安静锁定，品牌确定性图层依次出现并保持 | soft press / final tap | 品牌构图 B；无 H3 文字 |

## 全局静帧与视频约束

统一风格签名：

```text
flat bold color field, black-and-white halftone photographic cut-outs, selective colored cardstock accents, warm cream keylines, soft paper shadows, fine uncoated-paper grain, premium editorial paper collage, clean refined hand-torn paper edges, subtle fibrous edges, layered paper seams
```

- 每个最终静帧只保留 3–6 个主要纸组，前中后景清楚，保留负空间。
- 生成画面无可读文字、数字、Logo、UI、代码、字幕或水印。
- 每段从与批准静帧一致的干净色纸场开始；纸片逐件进入，结束时保持批准静帧至少 0.5 秒。
- 品牌、术语、产品名、URL、指标和限制条件全部由确定性后期添加。
- 真实 DeBERTa 证据可在 P6 以短暂确定性窗口出现，但不交给 H3 重绘。

## Gate 1 待用户确认

请一次确认两件事：

1. 是否批准上述六段、32 镜、2:08 的科普结构、纸拼贴隐喻和色板，进入 Gate 2 静帧生成？Gate 2 将交付 32 张逐镜最终静帧，不以六张宏观图代替。
2. 音频选择：
   - A：仅 collage SFX（Skill 默认）；
   - B：中文旁白 + collage SFX，无 BGM（科普信息最清楚）；
   - C：中文旁白 + collage SFX + 克制 BGM（推荐用于官网成片）；
   - 字幕另行明确选择“无字幕”或“确定性字幕”。

只有用户批准 Gate 1 并明确音频后，才进入 Gate 2；Gate 2 先生成 32 张 16:9 最终静帧供逐镜审批，不生成视频。
