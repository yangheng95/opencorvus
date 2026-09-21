# OpenCorvus Mission 技术故事动画 · 前期方案 V3

状态：`text-storyboard-production`。本文件按 MiniMax H3 `brand-promo-video-generator`、`3d-animation-short-generator` 和 `h3-prompt-writing` Skill 编写。用户在阅读独立审查结论后于 2026-08-24T18:40:18+08:00 明确要求“修复后生成完整视频”，作为后续推荐生产门的继续授权。带名称角色卡、无人物场景卡和 V4 六列镜头表已锁定，V4 自检通过；按推荐项进入单文本分镜。旧 V3 镜头表仍是失效草案。

- Project Brief gate：`approved by user · 2026-08-24T18:40:18+08:00`
- Story Outline gate：`approved by user · 2026-08-24T18:40:18+08:00`
- Character Card gate：`approved by continuing user instruction · character-card-v3.png · sha256 4d980f60bd7d4b2cda9db2c23abbc8e4c5603bdef21ac5be09082280f86be261`
- Scene Card gate：`approved by continuing user instruction · scene-cards-v3.png · sha256 f9d4d8b8d016e2996c90a23459a431cfcc0cf95b7ad950bcfbc6b45241b12de8`
- Shot Table gate：`approved by continuing user instruction · standard-shot-table-v4.zh-CN.md · self-check passed 2026-08-24T19:00:37+08:00`
- Storyboard mode：`single text storyboard · recommended default`

## 项目简报

- 工作标题：`别再给 Agent 当项目经理`
- 一句话 What-if：如果 Agent 很聪明，却因为上下文、状态和交接机制不足而无法完成长任务，用户能否用一个开源 Mission 让多支专家团持续推进、恢复、交接并验收？
- 情绪前提：从“明明用了 AI，却还要亲自盯每一步”的疲惫，转向“我能看见系统如何把工作推进到可检查交付”的可信感。
- 目标观众：用 AI 做毕业论文、课程项目、个人开源软件、副业应用、作品集和独立研究的个人技术用户。
- 目标感受：先认出自己的痛点，再理解长任务失败的技术原因，最后相信 OpenCorvus Mission 值得亲自尝试。
- 画幅：16:9 横屏。
- 总时长：169 秒（2:49），低于用户给定的 5 分钟上限。
- 语言：中文离屏旁白；角色不口播，嘴部保持闭合，以表情和动作表演。
- 视觉：明亮、温暖、风格化 3D 卡通；同一主角、同模 Agent；无真人、无鸟/渡鸦/Corvus 化身；官方 Logo 只作为片头片尾品牌资产。
- 生产模型：MiniMax H3 I2V；角色卡和逐镜首帧作为参考。单镜失败按 Skill 先强化锚点，再拆到不超过 6 秒；不静默混入旧片段。
- 分辨率：本地 RTX 5090 先生成约 768P 工作片，最终确定性合成为 1920×1080；不得称为 H3 原生 2K。
- 分镜模式：尚未选择。必须先批准故事、角色卡、场景卡和六列镜头表自检，再选择“单文本分镜”或“文本 + 铅笔分镜”。

## 品牌事实与来源摘要

| 资产 ID | 角色 | 来源 | 状态与用途 |
| --- | --- | --- | --- |
| `brand-logo-light` | 官方 Logo | `packages/web/src/assets/logo-light.svg` | 仓库官方资产；仅确定性片头片尾，不交给生成模型重绘 |
| `brand-logo-ornate-light` | 官方装饰 Logo | `packages/web/src/assets/logo-ornate-light.svg` | 仓库官方资产；仅在安全空间允许时使用 |
| `brand-copy` | 定位与产品事实 | `packages/web/src/content/landing-copy.ts`、README、架构 spec | 只使用已核验的开源、Mission、专家团、Artifact、恢复与修订口径 |
| `character-bible-v1` | 主角与 Agent 身份源 | `assets/character-story/character-bible-v1.png` | 当前冻结身份参考；不得改脸、发型、服装、机器人本体 |
| `case-evidence` | DeBERTa Proof | Mission `ae773cbff6362f19` 与实例仓库发布证据 | 只在 S19 使用核验数字，不用 H3 伪造产品 UI |
| `case-repository` | 实例地址 | `github.com/yangheng95/deberta-v3-absa-public-evidence` | 片尾与 Proof 确定性文字 |

## 故事大纲

### 主角

- Want：把自己的复杂项目真正做完。
- Need：不再靠自己维持上下文、派发、交接和验收，而是拥有一个可持久运行、可恢复、可核对的 Mission 层。
- 缺陷：开始时把“Agent 回复很聪明”误认为“项目会被完整交付”，并试图通过多开会话解决系统性问题。

### 核心世界规则

1. Agent 可用上下文有限；长任务中的早期目标、约束和计划可能在压缩与新信息中被淡化或丢失。
2. 多 Agent 若没有持久的共同目标、责任、依赖、产物定位与验收标准，只会并行制造更多局部完成。
3. Mission 持久保存目标、硬约束和验收标准，把工作拆成有依赖的重型 Task，并为每个 Task 锁定专家团与工作流。
4. 上游未交付，下游保持等待；依赖满足才唤醒。执行轮次记录进度、工具和结果；中断后从持久状态恢复。
5. Artifact 以文件、来源与 locator 交接；独立复核可以拒绝缺陷。最终要么通过验收，要么留下明确阻塞证据。
6. 用户对专家团的长期反馈先形成一个新的版本化修订；系统展示差异与回退点，只有用户确认才安装，拒绝时保持当前版本不变。

### 八拍因果骨架

1. 能力承诺：Agent 快速完成局部工作。
2. 技术裂缝：上下文有限导致早期约束被淡化，计划开始偏离。
3. 交付破裂：测试、部署和论文仍缺失，Agent 却提前停止。
4. 错误补救：用户多开 Agent，重复工作与断裂交接反而增加。
5. Mission 介入：目标、约束、验收被持久保存并拆成有依赖 Task。
6. 长程机制：完整专家团、等待/唤醒、执行轮次、恢复和 Artifact locator 形成连续因果链。
7. 验收与可信：独立复核退回缺陷，原团队修复并复验；通过时 Mission 才进入 accepted，无法继续时留下证据进入 blocked。用户反馈形成新专家团版本，查看差异后确认安装或保持旧版；开源、自托管、权限确认和记录回放让用户保持控制。
8. 证明与回收：真实 DeBERTa Mission 证明机制跑通过；主角把下一个个人长项目交给 Mission，而不是继续当项目经理。

## 待锁定角色卡

- `char:Creator-01`：短圆卷深色头发、海军蓝圆框眼镜、薄荷绿外套、白 T 恤、深灰翻边裤、珊瑚色鞋；签名道具为长任务笔记本。
- `char:Agent-Research-01`：暖白圆角机器人、黑面屏、青色椭圆眼、青色配件、放大镜与来源册。
- `char:Agent-Engineer-01`：同一机器人本体、蓝色配件、小型工作终端与工具。
- `char:Agent-Test-01`：同一机器人本体、琥珀色配件、测试仪与清单。
- `char:Agent-Reviewer-01`：同一机器人本体、紫色配件、验收册；与实现过程保持角色独立。

## 待锁定无人物场景卡

- `scene:Home-Studio-Day`：暖白墙、左侧大窗、右侧木书架、中央木桌、绿色台灯；日光从左后方进入。
- `scene:Home-Studio-Night`：同一地标不移动；左窗转深蓝夜色，绿色台灯成为右前方暖主光。
- `scene:Mission-Workbench`：由中央木桌连续展开的浅木工作空间；左端为 Mission 账本，中段为 Task 工作位，右端为验收位；不是抽象节点图。
- `scene:Open-Source-Bench`：同一木桌上的可拆解运行机柜；源码册、模型模块、权限钥匙和记录卷轴均为可触摸道具。
- `scene:Case-Proof`：同一工作室清晨状态；只允许确定性数据层显示真实案例数字。
- `scene:Future-Gallery`：同一主角从工作室走入相连的个人创作空间；论文、开源软件、副业应用、作品集与研究台是环境，不是卡片。

## 声音方案

- 中文离屏旁白贯穿；主角和 Agent 不口播。
- H3 原生音频只保留环境声与物理音效：键盘、纸张、队列提示、服务断电与恢复、文件打开、验收退回、权限确认。
- 全片只使用一条连续 BGM，前段稀疏木琴与低弦，中段加入精确打击与轻电子脉冲，Proof 后转为明亮弦乐；不得逐镜拼接不同音乐。
- 后期混音时旁白优先；重要工具结果、退回与确认音效出现时 BGM duck。

## 已知真实性边界

- 不宣称 100% autonomous、保证完成或 production-ready。
- “完整专家团”只绑定本片 DeBERTa 案例；一般 Task 契约是锁定一支专家团及工作流，专家团可以选择单节点流程。
- Mission 遇到凭据、硬件、外部授权或验收失败时可以明确阻塞；不得把“可恢复和可验收”说成“必然成功”。
- 竞品只做不同工作重心的克制定位，不做质量排名、价格表或功能勾选表。
