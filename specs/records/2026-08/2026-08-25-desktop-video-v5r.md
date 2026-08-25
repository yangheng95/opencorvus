# OpenCorvus Desktop 技术故事 V5R

状态：**USER REVIEW READY / 音轨密度与页面动效重制完成，未 push**

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

## 影响面与根因

- 直接触发点：旧 renderer 每场返回一个完整桌面静态状态，主要动画只是鼠标点击、文字渐显与状态切换。
- 控制流根因：storyboard 是“页面列表”而不是“事件时间线”，没有把同一对象的 before/after 状态延续到下一场。
- 视觉根因：同一层级同时显示桌面、应用壳、内容面板、Inspector、终端和角标；有效信息面积太小。
- 声音根因：首版合成器虽增加 25 个短促 cue，但仍以旁白、两条正弦底床和大片听觉空白为主；cue 音色相近、缺少操作簇、转场纹理、状态主题和侧链式让位，因此客观有事件但主观仍显稀疏。
- 修改影响：V5 storyboard、renderer、README 与新 spec。旧 V5 外部成片保留，新输出使用独立目录和文件名。

## 冻结 Brief 与 Claim Ledger

- 受众：已使用 ChatGPT/Codex/Claude 的个人用户。
- 渠道：官网与社交媒体横版；1920×1080、25fps、中文旁白与字幕。
- 目标时长：约 3:50–4:05；最终为 3:58。
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
| 11 DeBERTa proof | 201–222s | 运行规模、CUDA、指标限制、关键产物与实例仓 |
| 12 个人工作流与 CTA | 222–238s | 六类个人项目 → New Mission → 品牌收束 |

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

## 页面动效重制计划

- 全局面板增加轻量层叠深度、角标节点和可移动的时间轨，不改变文字位置与信息层级。
- 12 段分别绑定一个可解释的运动几何：输入汇聚、context 环形占用、会话分叉、durable anchor、scheduler frontier、attempt 断裂/继任、Artifact 流、review loop、双路径 evolution、可组合层、evidence scan、个人 workflow 汇聚。
- 几何层仅占边缘、留白与关系线区域，透明度受限，不覆盖真实字段、字幕和证据数字。
- 片尾改为固定网格构图：左侧 Logo/轨道，右侧品牌身份，下方单独的主张与案例仓带；所有文本水平排版，最后 2 秒完全稳定。

## 最终成片与验收证据

- 当前成片：`D:/myhexin-local/demos/opencorvus-desktop-promo-v5r-20260825/opencorvus-desktop-v5r-390e8a355777.mp4`
- SHA-256：`926dbc395892b7efef2f0f3f7e50c3d7d26ba8f29526c7cf8ad7e2df010ab9d7`
- 构建 digest：`390e8a35577752c36de617d19c6386c99a671004ecefa9fbc4a164c16bb3f748`
- Receipt：`D:/myhexin-local/demos/opencorvus-desktop-promo-v5r-20260825/builds/390e8a355777/receipt.json`
- Inspection：`D:/myhexin-local/demos/opencorvus-desktop-promo-v5r-20260825/inspection/opencorvus-desktop-v5r-390e8a355777/inspection.json`
- 输出：`1920×1080`、25fps、H.264、AAC 48kHz 双声道、238 秒；结构检查通过，静帧比例从首版 `0.07595` 降到 `0.01688`，一秒运动差中位数为 `2.01152`。
- 声音 cue ledger 共 119 个事件，覆盖 12 段，段内最大相邻间隔不超过 3 秒；效果轨均方响度相对首版提升约 2.8dB，`-45dB / 0.5s` 检测无静默区。
- 最终混音实测综合响度 `-16.71 LUFS`、LRA `10.60 LU`、AAC 真峰值 `-1.41 dBTP`；效果轨按旁白侧链压缩后再混合，旁白频段优先。
- 12 段新物理候选的五帧总览与 R02、R05、R12 原分辨率关键帧已人工复核；片尾最后两秒使用固定水平网格，无摄像机缩放或透视漂移。
- 最终字幕按实际旁白时长收束并按词边界换行；三处卡通插入边界保持不变。
- 聚焦测试覆盖 H3 manifest、试镜合片、V5R 视觉、cue ledger、声音文件与混合合片，共 18 项通过；文档检查与差异检查通过。
- 首版 `50462593e438` 保留为用户“音轨密度低、页面单调、片尾歪斜”反馈前的证据，不再作为当前候选。
- 用户明确要求观看后再决定是否发布，因此本轮只提交本地 Git 历史，不执行 push。
