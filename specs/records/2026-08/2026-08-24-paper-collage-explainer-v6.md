# OpenCorvus 长程 Agent 科普片 V6：已否决的纸拼贴方向

状态：**REJECTED / 不得用于成片**

适用 Skill：`paper-collage-explainer-generator`

目标成片：16:9，280 秒（4:40），40 个逐镜审批的 7 秒镜头。时长和叙事结构可供后续版本参考，视觉合同已被用户否决。

## 2026-08-24 用户否决与证据保留

- 用户纠正：“读取官网的视觉，不要瞎撺”。官网视觉必须成为唯一品牌事实源。
- 本方向在纠正前生成了 S01–S19 的探索静帧；它们已原样移出仓库并保存在 `D:\myhexin-local\demos\opencorvus-video-rejected-paper-collage-v6-20260824`，仅作为被拒证据保留，不进入后续合成，也不代表 OpenCorvus 品牌视觉。
- 纸拼贴的紫色、青色、芥末黄、撕边、halftone 和纸纤维都不是官网当前视觉语言；后续不得通过“换个色板”继续复用。
- 替代方案以 `2026-08-24-site-native-explainer-v7.md` 为当前事实源；本文件不再是生产入口。

## Recall

### 用户原始要求与纠正

- 保留 Desktop V5 为待定候选，再制作一个真正的科普风格版本，并继续遵守专门视频 Skill。
- 核心内容不变：长程 Agent 的故障机制、Mission 持久编排、调度恢复、Artifact、独立验收、开源控制、专家团自进化、短 DeBERTa 真实案例、个人长工作流和品牌入口。
- 用户明确否决 2:08 方案：“2 分钟讲不清，更别说专家团自进化”。因此 128 秒方案作废，不得进入 Gate 2。
- 修订后目标为 4:40；专家团自进化成为独立 70 秒章节，不再压成一句功能介绍。

### 验收指标

- 观众先理解“为什么聪明 Agent 做不完长任务”，再理解 Mission 为什么是上下文之外的运行层。
- 主要信息由物体关系和定格动作解释，不靠 PPT 卡片、术语墙、节点图或截图轮播。
- 六个宏观章节、40 个连续镜头；每镜 7 秒并绑定 Gate 2 的一张最终静帧。
- 专家团自进化完整覆盖：反馈证据归因、候选 revision、old/new diff、聚焦验证、回归拒绝、rollback、用户确认、新旧任务版本隔离。
- H3 不生成可读文字、Logo、指标、代码或 UI；术语、品牌、产品名、URL 和真实数字只做确定性后期。
- 案例只证明结论，不抢故事；指标必须同时保留 single seed 42、1,800 条训练样本和 fixed-run 限制。
- 片头片尾均有官方 Logo、品牌、官网、主仓和作者，构图不同；片尾另给案例仓库。
- 静帧与视频均须抽帧人工复核；最终修改后由未参与实现的独立 Agent 只读复核。

### 硬约束

- 严格执行 Skill 两个门：Gate 1 生产计划审批；Gate 2 四十张最终静帧逐镜审批。未批准镜头不得生成视频。
- Skill 默认音频为纸张 slide、pop、press、tap、rustle、snap 等 collage SFX；不得默认添加 BGM、旁白或字幕。
- 纸片必须逐件 `appear → light bounce → press flat → pause → lock`；禁止整体淡入、慢推镜、数字图层漂移、快速旋转、混乱飞入和相机缩放。
- 使用干净彩色纸场、轻微纤维与柔和阴影；禁止脏污、泛黄、牛皮纸和重度褶皱。
- 不使用真人、人物面孔或需要跨镜保持身份的角色；采用同一套项目卷宗、约束卡、任务车厢、Artifact 档案、审查透镜和版本抽屉贯穿。
- V6 使用独立文件名、目录与 build digest，不覆盖 V5。
- 用户确认前不 push。

### 已读资料

- `D:\myhexin-local\demos\minimax-h3-local-5090\skills\paper-collage-explainer-generator\SKILL.md`（完整读取）。
- `specs/records/2026-08/2026-08-24-minimax-h3-mission-promo-video.md` 的用户纠正、真实案例口径、V5 证据和拒绝方向。
- `script/video/minimax-h3-mission-promo/README.md` 的当前 V5 生产事实、5090 H3 路径和证据边界。

### 搜索与兼容性

- 本地同时存在手绘实拍、纸拼贴、纸艺定格和极简广告 Skill；`paper-collage-explainer-generator` 与抽象知识科普最匹配。
- Skill 原始执行层依赖 MiniMax Hub；当前环境没有 Hub canvas，但已有单张 RTX 5090 上验证过的 MiniMax H3 I2V 路径。后续只替换执行工具，不改变 Gate、静帧锚点、动作语法、音频默认和 QA 规则。
- 当前只到 Gate 1，不启动 7883/7884、ComfyUI 或 H3，也不读取用户凭据。

### 独立 Agent 反馈

- 首轮只读复核发现：旧计划 212 秒却只承诺审批六张静帧；P3 未逐一锁定产品重心；P5 未明确映射官网四支柱；新 spec 受 `/specs/` ignore 影响。
- 首次处置曾收紧为 128 秒、32 镜，但用户明确认为两分钟无法讲清，尤其无法讲清专家团自进化。
- 当前处置：改为 280 秒、40 镜；专家团自进化独占 S27–S36 共 70 秒；保留五产品与四支柱映射；提交时只对本文件精确 `git add -f`。
- 第三轮只读复核确认 40 镜时间、六章节区间和自进化十步因果一致，但指出 P6/S38 未把 `fixed-run evidence only` 锁进实际画面；已补入案例确定性后期与 S38 anchor/motion/continuity。最终只读复核无未解决发现，且确认未生成任何 V6 媒体。

## Brief

### 主题与学习目标

本片不解释“Agent 不够聪明”，而是解释：长任务为什么超出单个上下文；为什么增加 Agent 数量仍会失控；为什么需要一个把目标、依赖、状态、产物、验收和反馈保存到上下文之外的 Mission 运行层；专家团又如何在证据和用户控制下进化。

观众看完应能复述四句话：

1. Context Window 会满，旧约束可能在 compaction 后失去作用。
2. 多 Agent 没有共同持久状态，只会放大碎片化和交接成本。
3. Mission 用持久契约、依赖调度、可恢复 occurrence、可定位 Artifact 和独立验收让长任务诚实收敛。
4. 专家团自进化不是静默改 prompt，而是证据驱动、可验证、可拒绝、可回滚、由用户确认的版本升级。

### 受众、画幅与节奏

- 受众：学生、研究者、独立开发者、开源作者和副业创作者。
- 使用：官网、GitHub、Bilibili/YouTube 横版介绍和产品演示前导。
- 视角：2C；讨论“为什么我又要替 Agent 收尾”，不是企业采购汇报。
- 交付：1920×1080、16:9、4:40；40 镜 × 7 秒。
- 节奏：前 84 秒建立失败与工具层次；中间 98 秒解释 Mission 运行机制；70 秒讲透专家团自进化；最后 28 秒给受限案例、个人场景和 CTA。

### 视觉风格

高级编辑纸拼贴：干净彩色纸场、黑白 halftone 摄影剪影、选择性色卡、暖奶油描边、轻微纸纤维、柔软物理阴影、撕边和清楚的前中后景。全片没有人物面孔；主角是可追踪物件。

控制色板：

- burnt orange：时间压力、遗忘与提前结束；
- mustard yellow：警告、工具与累积错误；
- deep purple：上下文、记忆与结构；
- teal：协作、执行与系统流；
- ink green：判断、复核与恢复；
- rose red：重复劳动、rejected 与回归风险。

片头在 cream 纸场上使用官方 Logo 的确定性图层；Logo 像铆钉压入项目卷宗并进入故事。片尾在完成后的 Mission 卷宗内使用另一种构图展示品牌、官网、主仓、作者和案例仓。Logo、文字与地址都不由 H3 生成。

### 媒体方式

Skill 默认：collage SFX only；当前 Gate 1 不添加 BGM、旁白或字幕。对于 4:40 科普片，制作建议是“中文旁白 + collage SFX + 克制 BGM，无烧录字幕”，但必须由用户显式批准后才写口播和生成音频。

## 六章知识结构

### P1｜有限上下文怎样毁掉长任务（00:00–00:49，S01–S07）

- 因果：完整要求进入 → Context Window 持续填满 → Context Compaction → 旧约束掉出活动记忆 → Instruction Loss → Plan Drift → Premature Termination → 用户重新收尾。
- 隐喻：长项目纸带穿过狭小紫色窗口；CUDA 卡、测试尺、发布钥匙被压缩折叠后掉出；半成品箱却被提前盖章。
- 术语后期：`Context Window`、`Context Compaction`、`Instruction Loss`、`Plan Drift`、`Premature Termination`。

### P2｜更多 Agent 为什么仍不等于协作（00:49–01:24，S08–S12）

- 因果：没有共同持久状态 → 重复裁切同一蓝图 → 线程缠结 → 孤儿依赖 → 用户继续同步上下文。
- 工具重心锁定：`WorkBuddy → 一句话交付办公成品`；`DeepSeek Harness → 开发者可组合运行时`；`Codex → 软件工程 Agent`；`Claude Code → 编码与并行协作`；不排名、不宣称对方做不到。
- 隐喻：四把职责色剪刀裁出不兼容零件；随后四种纸制工具展示各自强项，但中央长程档案槽仍为空。
- 术语后期：`State Fragmentation`、`Duplicated Work`、`Orphaned Dependency`。

### P3｜Mission 把目标变成外部记忆（01:24–02:06，S13–S18）

- 因果：OpenCorvus Mission 填补长期运行层 → 保存 Final Goal / Hard Constraints / Acceptance Contract → 拆分有依赖 Task → Task 创建时冻结精确专家团 revision → 所有团队读取同一持久契约。
- 隐喻：Mission 卷宗填入中央空槽；目标石、约束锁和验收尺被铆接；六个 Task 页签展开，完整专家团色带锁定在每页。
- OpenCorvus 定位：`开源、跨领域、长程 Mission`。
- 术语后期：`Persistent Mission Record`、`Final Goal`、`Hard Constraints`、`Acceptance Contract`、`Task Dependency`、`Squad Revision · Frozen`。

### P4｜调度、恢复、Artifact 与独立验收（02:06–03:02，S19–S26）

- 因果：queue 只是 hint → 调度器重读 durable facts → activation lease → occurrence running → 服务中断 → 同一 occurrence / cursor 恢复且不重复派发 → Artifact source/path/locator 交接 → downstream read/select → 独立 review → rejected/fix/retest → accepted 或 blocked-with-evidence。
- 隐喻：Task 车厢、依赖铆钉、queue 小票、lease 封蜡、occurrence 书签；纸场撕裂后原车厢继续。Artifact 用来源线和 locator 透镜传递，独立审查透镜退回裂口。
- 术语后期：`Queue Hint`、`Wakeup`、`Activation Lease`、`Occurrence`、`Durable State`、`Resume Cursor`、`Artifact Lineage`、`artifact_read`、`artifact_select`、`Independent Review`、`Rejected`、`Accepted`、`Blocked with Evidence`。

### P5｜专家团如何在控制下自进化（03:02–04:12，S27–S36）

- 核心声明：自进化不是自动保证“越来越强”，不是静默在线漂移，也不改写运行中的 Task。它是版本化工程闭环。
- 十步因果：
  1. Reviewer 的失败证据保留来源、locator 和 occurrence；
  2. 多次证据归因，区分一次性 Task 缺陷与可复用专家团缺口；
  3. 生成独立 candidate revision，current revision 继续冻结；
  4. 展示 old/new diff，只改变被证据支持的步骤；
  5. 使用原 Acceptance Contract 做 focused verification；
  6. 候选产生回归则 rejected，不安装；
  7. 保留 rollback ref 与旧 package digest；
  8. 开源与定制让用户审计源码、替换模型/工具/权限规则/专家团；
  9. 可控与透明让不可逆操作确认、Artifact/diff/tool audit 可回看；
  10. 用户确认后，新 Task 使用新 revision，运行中 Task/occurrence 继续旧 revision。
- 官网四支柱映射：`开源 = MIT / 自托管 / fork`；`定制 = 模型 / 工具 / 权限规则 / 专家团`；`可控 = user confirmation / rollback / 不可逆操作确认`；`透明 = Artifact lineage / diff / tool audit`。四项在同一开放工作台连续出现，不排成四张功能卡。
- 术语后期：`Expert Squad Self-Evolution`、`Failure Attribution`、`Candidate Revision`、`Diff`、`Focused Verification`、`Regression Rejected`、`Rollback Ref`、`MIT`、`Self-hosted`、`Audit`、`User Confirmation`。

### P6｜受限证据回到个人项目（04:12–04:40，S37–S40）

- 因果：真实 DeBERTa Mission 证明运行机制能协调长交付，但不证明普遍 SOTA；机制最终服务个人论文、开源项目、副业、作品集和独立研究。
- 隐喻：证据架装入 GPU、三实验条、网页、图表和论文；single-seed 限制砝码与指标同时落下；架子折成个人项目文件夹，其中一个进入 Mission 卷宗。
- 确定性后期：12h45m、6 Tasks、3 squads、46 sessions、20 roles、RTX 5090、三组 CUDA、83.43%/83.61%、single seed 42、1,800 examples、`fixed-run evidence only`、官网/主仓/作者/案例仓。

## 40 镜 Gate 1 逐镜表

每行对应 Gate 2 的一张最终静帧与后续一个 7 秒 H3 clip。用户可按镜头编号批准或退回；未批准镜头不得进入视频生成。

| 镜头 | 时间 | 最终静帧锚点 | 组装与动作 | SFX | 连续性 |
|---|---:|---|---|---|---|
| S01 | 00:00–00:07 | 官方 Logo 后期压在 cream 项目卷宗铆钉位，品牌信息可读 | 空纸场→卷宗→Logo 确定性压入→项目要求纸带露出 | place / press | 品牌构图 A；Logo 不进 H3 |
| S02 | 00:07–00:14 | 长项目纸带完整铺开，CUDA 卡、测试尺、发布钥匙都在 | 纸带滑入，三件硬约束逐件弹入并压平 | slide / pop / press | 同一卷宗转为项目纸带 |
| S03 | 00:14–00:21 | 紫色 Context Window 被新消息、工具结果和代码纸片填至边缘 | 结果纸片逐片出现、轻弹、压平，窗口收紧 | pop / press / fold | 三件约束仍在最早位置 |
| S04 | 00:21–00:28 | Compaction 折页包住最早内容，CUDA 卡开始淡出活动层 | 紫色折页压缩旧纸片，最早约束移到背层 | fold / rustle | 不直接让约束凭空消失 |
| S05 | 00:28–00:35 | CUDA 卡、测试尺和发布钥匙落到窗口外 | 三件约束依次滑落，执行箭头改向省事路径 | drop×3 / paper turn | Context 框仍继续接收新纸片 |
| S06 | 00:35–00:42 | 缺测试、论文和发布的半成品箱被 rose 印章提前封住 | 缺口箱体弹入，错误印章压下，未完成零件仍在外面 | pop / stamp / dull tap | 缺口形状进入下一镜 |
| S07 | 00:42–00:49 | 用户侧项目托盘堆满追问便签、复制纸带和待收尾零件 | 追问纸、复制条和缺口零件逐件堆叠，托盘下沉 | rustle / stack / creak | 无人物，用托盘表现用户负担 |
| S08 | 00:49–00:56 | 同一缺口蓝图被四把职责色剪刀同时包围 | 蓝图铺平，四把剪刀弹入并开始重复裁切 | spread / pop / cut | 延续 S06 缺口 |
| S09 | 00:56–01:03 | 四套相似零件错位堆叠，四根线在中央打结 | 重复零件弹出，线绳逐根滑入、缠绕、拉紧 | pop / rub / snap | 四种职责色稳定 |
| S10 | 01:03–01:10 | 孤儿齿轮停在中央空槽外，系统无法运转 | 齿轮滚近空槽后停住，其余物件冻结 | roll / stop | 空槽成为长程运行层缺口 |
| S11 | 01:10–01:17 | 办公压印机、模块工具箱分别产出成品纸和可组合模块 | 两种工具左右组装并各完成一次动作 | press / click | 后期标 WorkBuddy / DeepSeek Harness 重心 |
| S12 | 01:17–01:24 | 代码夹具和协作线板完成软件构件与并行工作线，但中央槽仍空 | 夹具合拢、线程卡扣合，随后向外让位露出空槽 | clamp / snap / hollow tap | 后期标 Codex / Claude Code；不排名 |
| S13 | 01:24–01:31 | OpenCorvus Mission 卷宗滑入中央空槽 | 卷宗从下方滑入、轻弹、压平并锁定位置 | slide / bounce / press | 后期标 OpenCorvus 重心 |
| S14 | 01:31–01:38 | 目标石、约束锁、验收尺铆接在同一卷宗 | 三件契约物依次落位，铆钉逐个压下 | place / rivet×3 | 对应 goal/constraints/acceptance |
| S15 | 01:38–01:45 | 六个 Task 页签从卷宗展开并按依赖串联 | 页签逐个弹出，依赖纸带从前页连到后页 | pop / string / press | 六个 Task 结构开始稳定 |
| S16 | 01:45–01:52 | 每个 Task 页签绑上完整专家团色带和 revision 封条 | 色带逐支进入，版本封蜡压下 | slide / seal | 精确 revision 在创建时冻结 |
| S17 | 01:52–01:59 | 三支专家团从同一卷宗读取目标、约束和验收 | 三组工具从不同方向接触同一卷宗，不复制卷宗 | tap / shared rustle | 表现共同持久事实源 |
| S18 | 01:59–02:06 | 上游 Task 完成 Artifact 后，下游 waiting 页签刚转 ready | 上游产物落位，依赖带绷紧，下游页签翻色 | place / string snap / flip | 进入调度章节 |
| S19 | 02:06–02:13 | Queue 小票出现，但 Task 信号仍保持 waiting | 小票弹入后停在侧边，信号不动 | ticket pop / pause | 明示 queue 只是 hint |
| S20 | 02:13–02:20 | Durable facts 铆钉全部到位，activation lease 封蜡落下 | 事实铆钉逐个压入，lease 封蜡最后落下 | rivet / seal | 执行资格由事实和 lease 决定 |
| S21 | 02:20–02:27 | 信号翻到 running，同一 occurrence 书签落在 step 3 | 车厢启动三格，书签压在第三格 | flip / rail taps / bookmark | dispatch 仅一份 |
| S22 | 02:27–02:34 | 纸场被撕裂，车厢停住，但书签和 revision 封条跨裂缝保留 | 撕裂穿过轨道，动作冻结 | tear / short silence | occurrence 身份不变 |
| S23 | 02:34–02:41 | 裂缝压合，同一车厢从第三格继续，旁边没有复制车厢 | 纸场重新压平，原车厢继续下一格 | press / relock / continue | no duplicate dispatch |
| S24 | 02:41–02:48 | Artifact 档案通过 teal 来源线连接上游卷宗，locator 透镜锁定一格 | 档案滑入、来源线绷紧、透镜咔哒 | slide / string / click | source/path/locator 后期标注 |
| S25 | 02:48–02:55 | 下游档案先读取再选择同一来源 | read 透明片落下，selected 边框随后压平 | place / press×2 | artifact_read 在 artifact_select 之前 |
| S26 | 02:55–03:02 | 独立审查透镜退回裂口；修补复验后 accepted，受阻分支进入证据袋 | 透镜定位→退回片→补丁压平→green 封条；amber 证据袋并列 | reject pop / patch / seal | accepted 与 blocked-with-evidence 都诚实收敛 |
| S27 | 03:02–03:09 | Reviewer 失败证据连同来源线、locator 和 occurrence 被完整封存 | 证据片逐件进入透明档案并压平 | place / press / archive snap | 自进化从真实失败证据开始 |
| S28 | 03:09–03:16 | 多份证据在归因桌上对齐，一次性 Task 缺陷与专家团共性缺口分开 | 证据按形状分组，一组进入 Task 袋，另一组进入 Squad 槽 | sort / slide / click | 不用关键字匹配冒充归因 |
| S29 | 03:16–03:23 | Candidate revision 在独立工作区生成，current revision 保持封存 | 候选纸从证据轮廓转印而来，旧版抽屉保持锁定 | rub / print / drawer lock | 运行中 Task 不被静默改写 |
| S30 | 03:23–03:30 | Old/new 两版并排，只有证据支持的 preflight 步骤呈绿色新增 | 两版抽屉滑开，新增补丁逐件压在新版上 | drawer / patch / press | 后期展示真实 diff 与 digest |
| S31 | 03:30–03:37 | 原 Acceptance Contract 接入 focused verification 台，候选版进入测试 | 验收尺落下，候选模块逐项通过测试槽 | place / test taps | 验证标准不由候选自己改写 |
| S32 | 03:37–03:44 | 一个回归候选被 rose 退回片弹出，不进入安装槽 | 回归裂口出现，退回片反弹，安装槽保持关闭 | error snap / reject pop | 明示自进化不保证每版更好 |
| S33 | 03:44–03:51 | 通过候选保留 rollback ref，旧 package digest 仍在抽屉中 | rollback 线系住旧版，候选停在确认门前 | string / drawer / pause | 回退点在安装前建立 |
| S34 | 03:51–03:58 | 开放源码卷、MIT 封签和自托管底座在同一工作台展开 | 源码卷展开、MIT 封签压入、本机底座落位 | unroll / press / base thud | 官网支柱：开源 |
| S35 | 03:58–04:05 | 模型、工具、权限规则和专家团模块可替换；审计线轴记录每次动作 | 模块逐件拔插，权限钥匙转动，审计线轴同步收线 | click / key turn / reel | 官网支柱：定制、透明、可控 |
| S36 | 04:05–04:12 | 用户确认拨片落下；新 Task 取新版，运行中 Task 保留旧封条，rollback 抽屉仍可见 | 拨片压下，两条任务路径分流并锁定 | confirm / split / lock | 版本化安装，不改历史 occurrence |
| S37 | 04:12–04:19 | DeBERTa 证据架装入 GPU、三实验条、网页、两图、五页论文和测试仓库 | 证据物逐件轻放并锁定 | place / tap | 真实证据可短暂确定性嵌入 |
| S38 | 04:19–04:26 | 指标与运行规模在天平一侧，`single seed 42 / 1,800 examples / fixed-run evidence only` 三块限制砝码同时压稳另一侧 | 数字与三条限制后期同时出现，三块砝码逐件落下并保持平衡 | weight thud / balance | fixed-run 只证明当前受限实验；不做 SOTA、多 seed 或普遍承诺 |
| S39 | 04:26–04:33 | 证据架折成论文、课程、OSS、副业、作品集、研究六个文件夹，其中一个进入 Mission | 架子折叠，六文件夹扇开，一个滑入卷宗 | fold / flutter / slide | 回到 2C 个人场景 |
| S40 | 04:33–04:40 | 完成的 Mission 卷宗内显示官方 Logo、品牌、官网、主仓、作者和案例仓 | 卷宗压合，品牌确定性图层依次出现并保持 | soft press / final tap | 品牌构图 B；无 H3 文字 |

## 全局静帧与视频约束

统一风格签名：

```text
flat bold color field, black-and-white halftone photographic cut-outs, selective colored cardstock accents, warm cream keylines, soft paper shadows, fine uncoated-paper grain, premium editorial paper collage, clean refined hand-torn paper edges, subtle fibrous edges, layered paper seams
```

- 每张静帧只保留 3–6 个主要纸组，前中后景清楚，保留负空间。
- 生成画面无可读文字、数字、Logo、UI、代码、字幕或水印。
- 每镜从与批准静帧一致的干净色纸场开始；纸片逐件进入，结束时保持批准静帧至少 0.7 秒。
- 品牌、术语、产品名、URL、指标和限制条件全部由确定性后期添加。
- 真实 DeBERTa 证据只在 S37–S38 短暂出现，不交给 H3 重绘。

## Silent Visual Beat Track

在用户没有显式批准旁白前，不写口播稿。无旁白版本依靠以下理解链：

1. 项目要求完整进入，但窗口容量有限；旧约束被挤出，半成品被提前封箱。
2. 多把剪刀不是协作；四类工具各有强项，但中央仍缺长期契约。
3. Mission 卷宗把目标、约束、验收、Task 依赖和专家团版本固定在上下文之外。
4. Durable facts、lease、occurrence、resume、Artifact 和独立审查把运行与交付变成可追溯闭环。
5. 七十秒自进化章节完整展示证据归因、候选版本、diff、验证、回归拒绝、rollback、四支柱、用户确认和版本隔离。
6. 真实案例证据与限制砝码同时出现；最后回到个人项目和唯一 CTA。

## Gate 1 待用户确认

请一次确认两件事：

1. 是否批准上述六章、40 镜、4:40 的科普结构、纸拼贴隐喻和色板，进入 Gate 2？Gate 2 将交付 40 张逐镜最终静帧，不以六张宏观图代替。
2. 音频选择：
   - A：仅 collage SFX（Skill 默认）；
   - B：中文旁白 + collage SFX，无 BGM；
   - C：中文旁白 + collage SFX + 克制 BGM（推荐用于官网成片）；
   - 字幕另行明确选择“无字幕”或“确定性字幕”。

只有用户批准 Gate 1 并明确音频后，才进入 Gate 2；Gate 2 先生成 40 张 16:9 最终静帧供逐镜审批，不生成视频。
