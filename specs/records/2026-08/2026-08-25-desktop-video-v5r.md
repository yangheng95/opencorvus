# OpenCorvus Desktop 技术故事 V5R

状态：**USER REVIEW READY / 1.25 倍中文口述、自然声场与 AutomationBench 适配段已完成，未 push**

2026-08-25 用户提供卡通专家团接力物料，并明确要求必须在 V5R 基础上使用，不能替换 V5R。V5R 的 12 段故事、旁白、技术机制、真实证据、时长和桌面主视觉保持权威；卡通素材只进入 R01 用户痛点、R02 上下文遗忘/残缺交付和 R07 专家团 Artifact 交接的短 B-roll。独立卡通方向见 [`2026-08-25-cartoon-task-metaphor-video-v5c.md`](2026-08-25-cartoon-task-metaphor-video-v5c.md)，已降级为素材试验记录。

## Recall

### 用户要求

- 用户明确终止 V10，要求回到 V5 版本打磨并重新生成。
- 先检查 V5 问题，再开始重生成；目标仍是 `tech storytelling`，不是 PPT 或抽象隐喻。
- 保留 V5 的同一用户桌面、真实输入、真实状态、真实证据和 2C 叙事。
- 视频不超过五分钟；开头和片尾含 OpenCorvus 品牌、Logo、作者、官网、主仓，案例段含实例仓。
- 用户观看并认可前不得 push。
- 首版完整成片观看反馈：音轨密度太低。保留 V5R 画面、旁白、字幕和三处卡通边界，只重制声音设计。
- 同轮视觉反馈：形式与内容没有问题，但页面层过于单调，缺少丰富且有意义的形状、几何和动画；片尾构图显得歪斜。保持技术信息架构不变，补充运动几何语法并重做片尾对齐。
- 第二版观看反馈：不要用连续“嘀嘀嘀”拖音轨，应调整口述脚本。冻结已通过的页面动效和片尾构图，重写旁白以覆盖技术因果，删除作为填充物的高频电子节拍与 data beep。
- 新增证据要求：加入 AutomationBench 结果，但必须改造成视频语言，不能直接搬运深色仪表盘。用户补充同模型 Luna 原始严格通过率为 `8.07%`；随后提供最新更新：Mission base + `openai/gpt-5.6-luna` 已核验 `100 / 600`，严格通过率 `34.00%`。旧 dashboard 的 `95 / 600`、`28.42%` 与 `68.67%` 只作历史输入，不进入最新成片口径。

### 验收指标

1. 开场 3 秒内出现用户项目痛点；不以品牌欢迎页起手。
2. 每场只引入一个核心因果，静音时仍可从屏幕变化理解。
3. 1920×1080 母版中主信息不小于 34px；辅助文字不小于 26px；真实证据允许局部放大而不是嵌套缩略图。
4. 连续一秒平均视觉差不能大面积接近零；除有意收束外不复制静帧。
5. 技术口径与当前架构一致：真实 scheduler 模型判断与 coordination call；进程丢失终结 abandoned assistant 并创建 successor activation；Artifact 使用 `type/source/locator/digest`，resource path 只在适用时显示；feedback 与 metric evolution 分开。
6. 有中文字幕、键盘/点击/断线/恢复/回执等真实可辨的交互音效，不以单一正弦波冒充完整声场。
7. 案例数字与限制同屏；只称 fixed-run evidence，不称普遍 SOTA 或 Mission closed。
8. 完整成片经过逐场五帧检查和独立只读复核后才能进入用户批准。
9. 声音不能只靠旁白、连续底噪和少量提示音：12 段每段都有可辨的环境/操作层与状态事件，平均事件间隔不超过约 3 秒；旁白存在时效果层自动降噪让位，段落边界仍能听出节奏变化。
10. 每段除文字和面板变化外至少有一条持续运动的几何关系（轨道、依赖线、状态节点、证据流或进度脉冲）；几何必须解释当前因果，不增加功能卡片。片尾品牌、作者、主仓、案例仓使用统一水平基线和稳定终帧，不应用摄像机透视或缩放。
11. 口述应承担故事和技术解释的主体，每段旁白覆盖约 75–90% 场长并留出自然呼吸；不得通过连续合成节拍、规律蜂鸣或相似提示音填补空白。音效只在画面发生真实动作或状态转折时出现。
12. AutomationBench 段必须表现“同模型原始 8.07% → Mission base 34.00%”以及 `100 / 600` 覆盖；官方 held-out 数字只能放在独立参考标尺，并与“不同样本上下文、不做跨样本排名”同屏。不得把本地 100 例结果说成完整 600 例或官方榜单名次；未获得最新部分得分前，不沿用旧 `68.67%`。

### 已读资料

- `expert-squads/builtin/product-video/skills/method/SKILL.md`。
- `desktop-brief-v5.zh-CN.md`、`desktop-script-v5.zh-CN.md`、`desktop-storyboard-v5.zh-CN.json`、`produce-desktop-v5.py`。
- V5 成片、构建 manifest、inspection report 与 47 张抽帧。
- `specs/current/architecture/task-control-plane.md` 的 physical attempt、lease、successor activation、Artifact 与 Mission occurrence 契约。

### 全仓搜索与诊断

- V5 在 217 个一秒差分中有 137 个低于 0.1；D07 15/17、D11 12/15、D14 9/9 秒近乎静止。
- renderer 在 1280×720 画布使用大量 10–17px 字体，放大至 1080p 后仍只有约 15–26px。
- D08 旧旁白把进程丢失说成同一 assistant 从游标续跑；D09 缺 `type/digest`；D11 把两条进化路径合并。
- D05 比较段位于产品机制之前，打断用户痛点；D12 在 25 秒轮播八类小截图。
- 实现没有字幕和交互音效；只有旁白与三条正弦波音乐床。D11、D12 原始旁白必须约 1.17× 加速才能塞入场长。
- 片头片尾使用旧方形图标，不是当前官网鸟形图标与字标。

### 独立 Agent 反馈

- 首轮只读复核指出字幕曾拆分 `Mission`、`checkpoint`、`Task`、`attempt`、`fixed run` 等语义单元，R01 品牌签名停留过久，R02/R07 卡通切换缺少视觉与声音过渡，C02B 机器人身份漂移；均已修复。
- 第二轮只读复核核对最终成片、逐场抽帧、音视频结构、源片绑定、测试与文档后无未解决发现。
- 音轨与页面动效重制后的第三轮只读复核无未解决发现：复算 SHA/build digest 与 receipt 一致；119 个 cue、12 段覆盖、sidechain、响度、真峰值和无静默区通过；逐段原分辨率抽帧未发现几何遮挡；R12 在 235.9/236.5/237.2/237.9 秒保持水平稳定。复核工具不能替代用户在人耳/真实扬声器上的主观试听，因此仍以本轮用户观看为发布门。
- 口述与 benchmark 修订后的第四轮复核发现三项有效问题：post-build 源码与旧 final digest 不一致；用户提供的 8.07/100/600/34 被 `CAPTURED EVIDENCE` 错误包装；旁白说到 34% 时动画仍在 30.61%/0%。当前版本已重新构建并关闭：receipt 绑定当前 renderer；benchmark 相位不再显示 captured-evidence 标签，画面和旁白同屏说明“用户提供最新更新 / 本地旧仪表盘仅作历史快照”；34% 与 34/100 在对应句开始前完成动画。
- 修复后的第五轮只读复核无未解决发现：复算 renderer/storyboard/build/final SHA 一致；22 项测试恢复通过；226.5 秒旁白与 34%/34 of 100 已同步；用户 claim revision、历史 dashboard、官方保留集与不可排名边界各自清楚；固定 1.25 倍口述、67 个动作 cue、DeBERTa 边界和片尾均无回归。工具不能替代真人听感，用户试听仍是发布门。

## 影响面与根因

- 直接触发点：旧 renderer 每场返回一个完整桌面静态状态，主要动画只是鼠标点击、文字渐显与状态切换。
- 控制流根因：storyboard 是“页面列表”而不是“事件时间线”，没有把同一对象的 before/after 状态延续到下一场。
- 视觉根因：同一层级同时显示桌面、应用壳、内容面板、Inspector、终端和角标；有效信息面积太小。
- 声音根因：首版合成器虽增加 25 个短促 cue，但仍以旁白、两条正弦底床和大片听觉空白为主；cue 音色相近、缺少操作簇、转场纹理、状态主题和侧链式让位，因此客观有事件但主观仍显稀疏。
- 修改影响：V5 storyboard、renderer、README 与新 spec。旧 V5 外部成片保留，新输出使用独立目录和文件名。

## 冻结 Brief 与 Claim Ledger

- 受众：已使用 ChatGPT/Codex/Claude 的个人用户。
- 渠道：官网与社交媒体横版；1920×1080、25fps、中文旁白与字幕。
- 目标时长：约 4:05–4:20；加入 AutomationBench 适配段后的目标为 4:11。
- CTA：`opencorvus.com`、`github.com/yangheng95/opencorvus`。
- 主张：Agent 能完成局部任务，但长项目需要对话之外的持久执行与验收层；Mission 通过目标/约束/依赖/证据、专家团、恢复、Artifact 和独立复核推进交付。
- 边界：不保证成功；合法终态包括 accepted 与 blocked with evidence；比较不排名；DeBERTa 仅为 single-seed fixed-run 证据。

## 修订后的顺序

| 段 | 目标时长 | 单一问题/机制 |
|---|---:|---|
| 01 用户项目 | 0–18s | 一条真实长需求，品牌只作角标签名 |
| 02 为什么失败 | 18–42s | context 增长 → compaction → 约束变淡 → plan drift → premature Done |
| 03 多 Agent 仍失控 | 42–58s | duplicated work → orphaned dependency → 用户复制上下文 |
| 04 Mission record | 58–80s | goal / constraints / acceptance / dependencies 持久化 |
| 05 Scheduler | 80–105s | durable facts → model judgement → dispatch_agent → receipt → running |
| 06 恢复 | 105–126s | abandoned attempt terminalized → successor activation → re-read facts |
| 07 Artifact | 126–145s | type/source/locator/digest → read → select |
| 08 独立验收 | 145–164s | reproduce → rejected → fix → accepted / blocked |
| 09 专家团自进化 | 164–187s | feedback candidate 与 frozen metric campaign 分开，用户确认与 receipt |
| 10 开源与生态位置 | 187–201s | MIT/self-host/audit/fork；同类工具只描述层级 |
| 11 双证据 proof | 201–235s | DeBERTa 运行规模/CUDA/限制 + AutomationBench 同模型 8.07%→34.00% 与不可排名边界 |
| 12 个人工作流与 CTA | 235–251s | 六类个人项目 → New Mission → 品牌收束 |

## 视觉与声音执行

- 仍为一个桌面，但摄影机围绕当前因果对象连续移动；背景窗口降级，当前状态占画面 65–80%。
- 术语在事件发生后出现，最多同时保留两个；不再显示六项标签墙。
- D05 产品比较移到开源/生态段，使用一个纵向层级视图，不使用五张产品卡。
- 案例只放大 Mission 汇总、CUDA+指标和产物/仓库三组证据。
- 卡通物料不是新大纲：R01 前 6 秒使用用户痛点片段并以 0.35 秒溶解回到桌面打字；R02 在两段桌面证据之间插入 5.5 秒有限上下文片段并使用双向 0.35 秒溶解；R07 在 Artifact 字段读取与选择回执之间插入 4 秒专家团交接片段并使用双向 0.35 秒溶解。卡通合计 15.5 秒，约占全片 6.5%。
- C02B 残缺礼盒虽然通过素材试镜，但机器人身份相对 V5R 发生漂移，已从最终成片移除；淘汰证据保留在 V5C 门禁记录中。
- 使用当前官网鸟形图标与 `logo-light.svg` 字标。
- 字幕按场次时间生成 ASS；音效轨包括 type、click、disconnect、resume、artifact receipt、rejected、accepted、confirmation。
- 音乐使用低密度多段合成脉冲并在事件处 duck，不再是一条不变的三正弦波。

## 音轨密度重制计划

- 保留原旁白，不改故事节奏；声音轨拆成持续工作室环境、低密度节拍、键盘/滚动/调用操作簇、状态事件、转场扫频和段落终止六层。
- 为 12 段建立显式 cue ledger，覆盖输入、compaction、重复工作、持久写入、dispatch/receipt、lease/恢复、Artifact read/select、rejected/accepted、candidate/metric/rollback、开源层级、CUDA/指标和 CTA。
- 事件音不使用同一频率的蜂鸣替代：点击/键盘使用短噪声瞬态，写入/回执使用双音确认，失败/lease 使用低频下坠，恢复/accepted 使用上行和弦，Artifact 交接使用纸张/机械锁扣质感。
- 声音效果轨先保持足够动态，再在最终混音中对旁白频段让位；目标综合响度约 `-16 LUFS`、归一化目标 `-1.5 dBTP`，AAC 交付文件真峰值安全上限 `-1.0 dBTP`，48kHz 双声道。
- 新版必须输出独立 digest 和文件名，保留首版作为用户反馈证据；重新执行音频探测、cue 覆盖检查、完整合片检查和独立只读复核。

## 口述优先修订

- 逐段补齐“用户为什么在意 → 屏幕上发生什么 → Mission 改变哪条控制流 → 用户得到什么”的口语化因果，不增加新的产品主张或技术术语。
- R04–R09 是原旁白空白最多的机制段，优先解释持久契约、模型调度、physical attempt、Artifact pull、独立复核与两条自进化路径；R11 保持受限证据口径，不继续堆数字。
- 取消为了达到固定事件间隔而设计的 cue 密度指标；删除连续 86 BPM 脉冲与周期 shimmer。保留自然低噪环境，以及与实际动作严格同步的输入、纸张、点击、断线、落盘、恢复、退回、验收和片尾收束声。
- 新旁白必须重新生成物理语音文件并按实际时长生成字幕，禁止整体强行加速；若单段超长则继续改文案，而不是压缩语速。

## AutomationBench 视频化证据

- 本地 dashboard 事实源：`D:/myhexin-local/opencorvus-benchmark-results/luna-mission-base-v20260822-r3/index.html`，SHA-256 `b75664353b1c2ea4695efbdea711ada1a0ec763d198433d6ae11cfe2667d16d8`，更新时间 `2026-08-25T03:08:26.471Z`。
- 用户截图输入 SHA-256：`17a38a42681804a83105fafe0686d960de9ba121ce3219ff34f3a37011c848b8`；仅用于核对视觉与口径，不直接进入成片。
- 本地 dashboard 历史结果：base profile、`openai/gpt-5.6-luna`、已核验 `95 / 600`、严格通过率 `28.42%`、平均部分得分 `68.67%`、总 token `544,805,475`、模型调用 `9,975`。
- 用户随后提供最新结果：已核验 `100 / 600`、严格通过率 `34.00%`。该更新高于旧 dashboard 的时间点，作为当前宣传片 claim revision；由于用户未提供对应的新部分得分、token 和调用数，视频不得把旧统计拼接到 100 例结果上。
- 用户提供的同模型原始严格通过率 `8.07%` 在当前本地 dashboard 中没有独立行，成片须标为“原始 Luna 对照（用户提供）”，不得包装成当前本地 runner 复算结果。
- 官方 AutomationBench 页面说明其主指标由确定性最终状态断言产生，公开 600 任务集用于研究，榜单运行使用 held-out private set；当前官方参照为 Gemini 3.7 Flash High `30.44%`、Claude Opus 5 Max `26.94%`、GPT-5.6 Terra Max `21.00%`、GPT-5.6 Sol Max `19.63%`。这些数字只能进入独立灰色参考标尺。
- 视觉改编：不截屏 dashboard；先用 600 格抽象案例轨点亮 100 格，再用同模型提升箭头连接 `8.07%` 与 `34.00%`，并显示 `+25.93` 个百分点；最后在独立灰色标尺显示官方 held-out 上下文和不可排名边界。

## 页面动效重制计划

- 全局面板增加轻量层叠深度、角标节点和可移动的时间轨，不改变文字位置与信息层级。
- 12 段分别绑定一个可解释的运动几何：输入汇聚、context 环形占用、会话分叉、durable anchor、scheduler frontier、attempt 断裂/继任、Artifact 流、review loop、双路径 evolution、可组合层、evidence scan、个人 workflow 汇聚。
- 几何层仅占边缘、留白与关系线区域，透明度受限，不覆盖真实字段、字幕和证据数字。
- 片尾改为固定网格构图：左侧 Logo/轨道，右侧品牌身份，下方单独的主张与案例仓带；所有文本水平排版，最后 2 秒完全稳定。

## 最终成片与验收证据

- 当前成片：`D:/myhexin-local/demos/opencorvus-desktop-promo-v5r-20260825/opencorvus-desktop-v5r-eca5affd1fae.mp4`
- SHA-256：`c9019eea7006027fa452d521051a1fbc3ed29a2af4e3e302541439b8402432b1`
- 构建 digest：`eca5affd1fae2aa30f932d97d53ed8bd7fc432d48a8f7e2cdc27b9c94ec623be`
- Receipt：`D:/myhexin-local/demos/opencorvus-desktop-promo-v5r-20260825/builds/eca5affd1fae/receipt.json`
- Inspection：`D:/myhexin-local/demos/opencorvus-desktop-promo-v5r-20260825/inspection/opencorvus-desktop-v5r-eca5affd1fae/inspection.json`
- 输出：`1920×1080`、25fps、H.264、AAC 48kHz 双声道、251 秒；结构检查通过，静帧比例 `0.01600`，一秒运动差中位数 `1.96436`。
- 旁白由 `zh-CN-YunxiNeural` 以固定 `+25%` 生成；12 段 receipt 的额外 `tempo` 全部为 `1.0`，没有二次强制加速。逐段实际口述覆盖率约 `75.7%–97.2%`，字幕按物理语音时长收束。
- cue ledger 从被用户否决的 119 个规律事件降为 67 个真实动作 cue；连续 86 BPM pulse 与周期 shimmer 已删除，只保留低密度房间底噪、输入、纸张、点击、断线、落盘、恢复、退回和验收声。
- 最终混音实测综合响度 `-16.45 LUFS`、LRA `4.80 LU`、AAC 真峰值 `-1.38 dBTP`；自然声场继续以旁白为 sidechain 让位源。
- AutomationBench 没有搬运 dashboard：成片使用确定性动画展示 `100 / 600`、同模型 `8.07% → 34.00%`、`+25.93` 个百分点、`34 / 100` 严格通过案例，以及独立的官方保留集参考标尺和不可排名边界；旧 `68.67%` 明确未并入。
- 12 段新物理候选五帧总览和 R11 原分辨率终帧已人工复核；片尾固定水平网格和三处卡通插入边界保持不变。
- 聚焦检查共 22 项通过，覆盖 H3 manifest、V5C 素材合片、V5R 视觉/旁白/cue/benchmark claim/完整合片与 V10 失败证据；`py_compile`、文档检查和差异检查通过。
- 版本 `9c98f429c344` 保留为 benchmark 来源边界与相位同步修复前证据；`390e8a355777` 为用户否决“嘀嘀嘀”填充前证据；`50462593e438` 为页面动效重制前证据，均不再作为当前候选。
- 用户明确要求观看后再决定是否发布，因此本轮只提交本地 Git 历史，不执行 push。
