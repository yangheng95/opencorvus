# OpenCorvus 科普宣传动画 V9：活字运行层

状态：**FULL H3 FILM READY FOR USER REVIEW / 210 帧检查与三轮独立复核通过**

## Recall

### 用户输入与来源

- 用户在 Claude 生成并发布完整 A–I 方案：`https://claude.ai/code/artifact/26b573c9-0c32-414e-b8a7-d1d55af27a97`，Artifact 标题 `活字运行层`。
- 公共直链受会话权限保护；主 Agent 已通过用户授权的 Chrome 已登录标签页完整读取 A–I、42 镜、三个 H3 Prompt 与 Anti-PPT 终检，不再依据摘要猜写。
- 用户明确采用 Claude 方案替代 V8；V8 人物工作室方向已隔离。

### 选定方向

工作标题：**《活字运行层 / The Movable-Type Runtime》**

时长：4:36，16:9，42 镜，全动画，无真人；面向已经使用 Agent 的个人用户。

核心设计公理：Agent 的四个机器特征必须成为身体构造，而不是角色标签：

1. 光标即身体：执行体是一根会眨动的钴蓝光标，无脸、无四肢。
2. 环带即上下文：定长微字环写满后从尾端挤出、褪灰、剥落；实例死亡时环带彻底消失，successor 不继承。
3. 调用丝即行动：执行体只能通过调用丝把参数包送入器台，并接收结果包写回环带。
4. 材质即论证：发光是短命计算；哑光陶石是持久事实；半透明是候选；橙色只属于人的意志与裁决。

### 设计与品牌制度

- 暖白 `#f9f8f8`：现实和运行层共同世界。
- 钴蓝 `#2946d3`：执行体、调用丝和机器认知。
- 深蓝 `#172b8f`：巡进门架与独立验官等制度角色。
- 辅蓝 `#3558db/#8fa6e8`：役印、环带、未激活状态。
- 裁决橙 `#e04b22`：只属于用户话语、指印、阈门、回执选择与用户确认；Reviewer 判断、系统状态和证据不得使用橙色。
- 墨黑 `#1e232c`：刻痕和确定性后期文字。
- 官网 mesh 只转译为高调环境光；细网格只出现在运行层地面，透明度不高于 6%；不复制官网 Header、卡片或比较表。
- 官方 Logo、品牌、URL、作者、案例仓和所有文字、数字、UI 都由确定性后期完成，H3 不生成。

### 角色与机制法源

- 用户：20 代中性青年，手绘线条和平涂，暖灰连帽衫、橙色耳机线；全片唯一有脸的角色，永不发光。
- 单 Agent：圆角竖光标核、定长上下文环带、头顶役印。策划=罗盘多边形，检索=透镜环，构建=尖括号，测试=量规弧，撰写=笔尖菱形。
- Expert Squad：暖白陶质浮空班台；每个成员环带独立、不相接；班台立一块作法版。
- Mission Orchestrator：深蓝巡进门架。它先扫读 durable ledger、prerequisite 与新事实，停驻形成模型判断，再通过独立的深蓝 scheduler 调用丝向调度印机发出真实 `dispatch_agent` 协调工具调用；只有接受回执返回后，目标班台才降落或接续。它不执行检索、构建、测试等 worker domain tools，也不以 Host 状态机自动推进。未满足 prerequisite 时不发 dispatch，留下可见的等待/无动作判断并停驻。
- Reviewer：深蓝执行体、量规+槛线役印、独立复现台；不参加班台构建。
- Durable State：哑光任务龙骨，承载目标印、硬约束锁、验收槛线、依赖刻槽、执行事实、证据插槽和 lease 灯座。
- Artifact：哑光陶砖；进入成品廊/catalog。砖的确定性后期字段以当前 schema 为准：`type/source/locator/digest`；只有适用 resource 才有 path。下游 `search → read → select`，原砖留廊，取走发光副本。
- Attempt/Lease/Successor：旧光标核崩散，环带湮灭；lease 到期后旧 physical attempt 终结。successor 是新核、空环带、不同 activation identity；它从刻痕和砖重新读，不是原进程复活，也不是通用 cursor 续跑。
- Feedback evolution：原话橙条 → 半透明候选覆版 → 用户按印 → 安装 → mutation receipt。画面不得出现 Campaign、trial 或 comparison。
- Metric evolution：六封印先冻结 Campaign；同源 baseline/candidate 对照；回归候选入弃匣不安装；recommendation=promote 才送用户确认。
- Restoration：仅在已有 mutation receipt 后；引用 prior receipt，预览恢复结果，再次按印，恢复后生成新的 receipt。

### 事实边界

- Mission 不保证成功；合法终态可为 accepted 或 blocked with evidence。
- Queue 只是 hint；协调者读事实、prerequisite 和 ledger 推进 frontier。
- WorkBuddy、DeepSeek Harness、Codex、Claude Code 与 OpenCorvus 只做公开定位与层级说明，不排名、不宣称谁做不到。
- DeBERTa 案例口径：六个 Task 在约 12h45m 后全部完成并交付证据；3 个内置 Expert Squad；46 个 Agent 会话；20 种角色；RTX 5090；三组 CUDA；validation Macro-F1 83.43%；selected test 83.61%；single seed 42；1,800 examples；`fixed-run evidence only`。没有 Mission closure receipt，不能说 Mission closed。
- 最终案例仓：`https://github.com/yangheng95/deberta-v3-absa-public-evidence`。旧 `publication.json` 指向已退役仓，不得使用。

### 对 Claude Artifact 的生产校准

- Claude 的 42 镜叙事、Visual Bible、动词表和 Anti-PPT 审查作为创意权威。
- Claude 提供的三个 H3 Prompt 是创意草案，不是本地 H3 最终格式：必须按 `h3-prompt-writing` 的 I2VA/FL2VA/Ref2VA 结构改写为 `integrated_multimodal_description / overall_soundscape / non_diegetic_music`，并绑定真实 reference SHA、workflow/model/script/prompt/output digest。
- Prompt 3 把双路径、安装、receipt 和 restoration 压入 14 秒，生产时应按 S28–S33 六镜拆分，不用模型漏步骤测试冒充审美验收。
- S26 的 successor 必须表现为新 activation identity，不得用“同一盏灯”让观众误读为旧 lease/旧 attempt 复活。
- S37 后期文字必须写 `46 Agent sessions`，不写笼统 `46 sessions`。
- 用户补充要求参考画面也由 H3 按技能规范自举；两张 ImageGen 概念草稿已明确拒绝并移至 `D:\myhexin-local\demos\opencorvus-video-rejected-imagegen-drafts-20260825`，不进入 manifest、不作为 H3 reference。当前路径为 T2VA `R00` → 五帧人工审查 → H3 自身帧 hash-lock → Ref2VA/FL2VA。

### 独立 Agent 反馈

独立只读复核发现并已纳入本轮修订：

1. 原 O1 设计隐藏了 scheduler scope Orchestrator 的模型判断与真实协调工具调用，容易误画成 Host 自动状态机。
2. 旧运行器仍读取 rejected storyboard，并用 graphite/cyan `smoke` prompt 形成第二事实源。
3. 镜表声明 I2VA/FL2VA/Ref2VA，但运行器当时只有 T2VA/单首帧 I2VA；模式必须与本机 ComfyUI 节点和物理权重逐项核验。
4. 模型 receipt 只信 inventory SHA 且只校验 size；同尺寸篡改可通过，必须计算物理文件 SHA。
5. 原本地镜表缺 Claude G 的完整旁白、声效、起始/结束状态、连续性和三字段 H3 prompt；Reviewer/system evidence 误用了用户橙色。

成片首轮独立复核随后发现七项发布阻塞并已修复：

1. 片头片尾只有字标、缺少官网正式鸟形图标；现从 `packages/web/public/web-app-manifest-512x512.png` 读取物理图标，片头右上叠加、片尾居中碑式收束，并分别绑定图标与字标 SHA。
2. S04/S06/S07/S10/S21/S24/S28/S29/S34/S35/S41 的选择段短于镜头时长，旧合成器以末帧和静音补齐；现 edit plan 覆盖完整时长，聚焦测试逐镜断言选择段不短于目标，S10/S29 另有持续摄影运动。
3. 46 个 H3 源片原生为 `608×352`，旧候选只用 Lanczos 放大；现由 RTX 5090 对 46/46 段运行 Real-ESRGAN `realesr-animevideov3` 2× 逐帧修复，再缩放为 1920×1080 母版。每段保存原 H3 receipt、输入/输出帧数、可执行文件、模型文件与输出物理 SHA；没有把修复模型称作 H3 原生 1080p。
4. S14 仅靠旁白宣称调度；现按时间显示 `durable facts/prerequisites → model judgement → dispatch_agent(squad_revision, task_occurrence) → accepted receipt/Squad active`。
5. S14/S17/S27 的系统物件污染用户橙色；现对系统红黄范围去色，用户所在镜头的真实确认橙不受影响。
6. S19/S35/S36 的 H3 伪字过强；现使用羽化蒙版做局部修复，并用确定性 `Artifact · type/source/locator/digest`、`Codex/Claude Code · code session` 文字承担语义。
7. 片头逐行白底像默认字幕且遮挡用户；现收敛为官网图标、字标、作者和两个仓库组成的右上品牌签名，与片尾居中碑式构图区分。

第二轮独立复核只剩 ASS（Advanced SubStation Alpha，高级字幕格式）色序问题：`Fact` / `Mechanism` 误把普通 RGB 写入 `AABBGGRR` 字段，导致深蓝渲染成红褐色。当前实现改为 `&H008F2B17` 并增加正向契约测试。第三轮只读复核确认 S14、S19、S35、S36、S37–S39 均为深蓝，媒体结构与 210 帧检查继续通过，无 P0–P2 未解决发现；候选进入用户观看与批准环节。

### 影响面与根因分析

- 可观察现象：旧入口默认生成已拒绝的暗色方向；Ref2VA/FL2VA 名称与真实 workflow 不一致；重复 take 会覆盖；receipt 无法证明实际加载模型就是 inventory 文件；镜表不足以驱动 42 镜和配音。
- 直接触发点：`generate-local-h3.py` 的 `smoke` 分支、`storyboard.zh-CN.json` 读取、单 `--reference-image` 参数、固定输出路径和 inventory-only identity。
- 控制流根因：创意法源、生产 manifest、runner 参数和 receipt 没有收敛为一条可拒绝错误输入的链；Markdown 仅作人读索引，运行器仍持有旧 prompt。
- 旧路径未根治原因：此前只给现有 runner 增加摘要哈希和五帧抽取，没有替换旧 storyboard 数据流，也没有核验 ComfyUI `MiniMaxH3ImageToVideo.last_frame` 与 Ref2VA 物理权重。
- 影响定义/调用点：本视频目录的 runner、tests、README、V9 spec、42 镜表、workflow 选择、reference asset 身份、输出目录与 receipt。未发现仓库生产代码调用该脚本；旧 V5/V7/V8 文档继续作为 rejected 历史证据，不参与执行。
- 交付与风险：Ref2VA 权重已通过 Hugging Face 断点续传安装，物理大小 `20,970,379,616` bytes，SHA-256 `9255f52b6677845ad238f20dfaafa94727053694127ab7f255c048f0f9365779` 与 inventory 完全一致。Ref2VA 实测峰值约 `31,501 MiB` VRAM、最低剩余约 `2.75 GiB` RAM；连续多轮后曾出现一次 `HostBuffer.read_file_slice failed`，仅重启本任务隔离的 8188 ComfyUI 后恢复，未操作 7883/7884。

### 生产与验收证据

- 修复后候选：`D:\myhexin-local\demos\opencorvus-live-type-v9-20260825\opencorvus-live-type-runtime-v9-c6fb61a398ae.mp4`。
- build receipt：`D:\myhexin-local\demos\opencorvus-live-type-v9-20260825\builds\c6fb61a398ae\reports\build-receipt.json`。
- 结构验收：`276.000s`、`1920×1080`、H.264、AAC、48 kHz、stereo；42 镜连续无缺口。
- 抽帧验收：每镜 start/quarter/middle/three-quarter/end，共 210 张；inspection report 与 42 镜联系表位于 `D:\myhexin-local\demos\opencorvus-live-type-v9-20260825\inspection\opencorvus-live-type-runtime-v9-c6fb61a398ae`。
- H3 来源：46 个 edit-plan 资产都绑定各自生成 receipt 与输出物理 SHA；参考帧全部来自 H3 的 T2VA bootstrap 或已验收 H3 镜头。两张 ImageGen 概念草稿不在 manifest/edit plan/source receipts 中。
- 清晰度修复：46 个 H3 源片全部通过 `realesr-animevideov3` 2× 修复；修复 cache 与逐段 receipt 位于 `D:\myhexin-local\demos\opencorvus-h3-restored-x2-v9-20260825`。这是 H3 后期修复，不宣称 H3 原生 1080p。
- 文字与身份：真实 OpenCorvus `web-app-manifest-512x512.png` 图标与 `logo-light.svg` 字标分别物理绑定；旁白、字幕、官网、主仓、作者、案例仓、案例数字和边界短语都在后期添加，未让 H3 生成。
- 聚焦测试：`python -m unittest script\\video\\minimax-h3-mission-promo\\test_generate_local_h3.py script\\video\\minimax-h3-mission-promo\\test_compose_live_type_v9.py`，9/9 通过；`npm run docs:check` 通过。

## 12 段故事结构

| 时间 | 镜头 | 事件 |
|---|---|---|
| 00:00–00:20 | S01–S04 | 用户目标成为橙条；执行体接收、计划、调用工具；环带尾端验收约束剥落；未调用测钟却掷出轻飘 DONE 绿章；用户被迫验收 |
| 00:20–00:45 | S05–S08 | 用户重复重灌上下文；Agent 斜换计划产生 drift；Agent 熄眠，用户实际收尾；五秒静默 |
| 00:45–01:05 | S09–S12 | 多会话重复、等待、冲突和悬空依赖；用户手画依赖，便签上长出口号；橙光下潜进入运行层 |
| 01:05–01:30 | S13–S16 | Mission 龙骨刻入目标/约束/验收/依赖；巡进门架扫读、抬亮、停驻；用户用掀盖、换芯、上锁、回看四个动作看到开源、定制、可控、透明 |
| 01:30–02:00 | S17–S21 | 完整五角色 Squad；真实工具；重砖替代轻飘宣称；Artifact 入 catalog；下游 search/read/select；多 Squad 并行 |
| 02:00–02:20 | S22–S24 | 独立验官按槛线复跑、拒收；拒绝写入龙骨；修复重交复验后 accepted |
| 02:20–02:40 | S25–S27 | physical attempt 崩散、环带湮灭；successor 新核拾取新 activation 并从事实重读；另一路 blocked with evidence |
| 02:40–03:25 | S28–S33 | Feedback 无 Campaign；Metric 冻结/同源比较/回归拒绝；两路都由用户确认；receipt 后 restoration 再确认 |
| 03:25–03:45 | S34–S36 | WorkBuddy/DeepSeek Harness/Codex/Claude Code/OpenCorvus 在不同生态层真实使用，无表格与排名 |
| 03:45–04:08 | S37–S39 | 23 秒 DeBERTa fixed-run 证据沿骨刻入；数字与限制同级；产物砖展开为网页、图表、论文、测试与公开仓 |
| 04:08–04:28 | S40–S41 | 同一桌面连续变形成六种个人长工作流；用户只提目标、给约束、看证据、给反馈、按确认；清晨首尾对照 |
| 04:28–04:36 | S42 | 暖白碑式片尾，前 4 秒依次出现、后 4 秒完全静止 |

## 当前生产入口

- 本地 42 镜表：`script/video/minimax-h3-mission-promo/v9-live-type-runtime-shot-table.md`
- 本地 H3 运行器：`script/video/minimax-h3-mission-promo/generate-local-h3.py`
- 机器生产 manifest：`script/video/minimax-h3-mission-promo/v9-live-type-runtime-manifest.json`
- hash-locked edit plan：`script/video/minimax-h3-mission-promo/v9-live-type-runtime-edit-plan.json`
- 合成与 210 帧检查：`script/video/minimax-h3-mission-promo/compose-live-type-v9.py`
- Claude Artifact：创意法源；不得从链接无法访问时自行重建。
- V6、V7、V8 全部为拒绝或历史候选，不得混用素材。
