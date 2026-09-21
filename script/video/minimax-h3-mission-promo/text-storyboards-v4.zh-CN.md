# OpenCorvus Mission 技术故事动画 · Text Storyboards V4

- video model: MiniMax H3 I2V
- working resolution: local ~768P; deterministic final 1920×1080
- storyboard mode: single text storyboard
- shot-table self-check: passed 2026-08-24T19:00:37+08:00
- character card: `character-card-v3.png@4d980f60bd7d...`
- scene cards: `scene-cards-v3.png@f9d4d8b8d016...`

## 目录

- S01 / 3s · reveal
- S02 / 7s · setup
- S03 / 7s · reversal
- S04 / 7s · suspense
- S05 / 8s · reveal
- S06 / 8s · reversal
- S07 / 7s · expression-beat
- S08 / 10s · reveal
- S09 / 8s · setup
- S10 / 8s · reveal
- S11 / 8s · suspense
- S12 / 8s · reveal
- S13 / 8s · reversal
- S14 / 8s · reveal
- S15 / 8s · suspense
- S16 / 8s · callback
- S17 / 10s · reveal
- S18 / 8s · reversal
- S19 / 8s · reveal
- S20 / 12s · reveal
- S21 / 8s · callback
- S22 / 10s · tender

## S01 / 3s — 开场即建立同一主角与品牌

- **Hook 类型**：reveal
- **场景 & 角色**：scene:Home-Studio-Day | char:Creator-01, char:Agent-Engineer-01
- **空间锚点卡**：
  - 固定地标：Home-Studio 左窗虚化在后、绿色台灯右侧
  - 人物位置：Creator-01 中央前景、面向镜头、直立半身姿；Agent-Engineer-01 右后景、面向 Creator、双足静止双手垂下
  - 退场人物状态：无
  - 光位基线：左后暖日光
- **承接上一镜**：开场即建立同一主角与品牌；Logo 的圆形轮廓匹配切到 S02 的台灯光圈。
- **交接下一镜**：匹配切 S02。
- **双绑定**：[char:Creator-01] [char:Agent-Engineer-01] [scene:Home-Studio-Day] [hook:reveal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Creator 抬眼、Engineer 从桌后探头
- 镜头：慢速小幅推近
- 音频 + 锚点：SFX 轻提示音 | 人物中央/右后，Logo 左上安全区
- 表演备注：交接到品牌出现。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：官方 Logo 与 `OpenCorvus` 确定性淡入，角色嘴闭
- 镜头：镜头锁定
- 音频 + 锚点：SFX 柔和确认 | 官网短停
- 表演备注：交接到台灯圆形高光。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Creator 转向桌面长任务笔记，Logo 缩为角标
- 镜头：小幅跟焦到笔记
- 音频 + 锚点：纸张声 | 台灯右侧
- 表演备注：匹配切 S02。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 1–3s：“Agent 已经能自动完成很多任务。”；SFX：0.4s 提示、2.4s 翻页。；SFX：0–1s SFX 轻提示音，1–2s SFX 柔和确认，2–3s 纸张声；表演：0–1s Creator 抬眼、Engineer 从桌后探头，1–2s 官方 Logo 与 `OpenCorvus` 确定性淡入，角色嘴闭，2–3s Creator 转向桌面长任务笔记，Logo 缩为角标；`narrator-mouth-closed: true`。

## S02 / 7s — 承接 S01 的笔记本与目光

- **Hook 类型**：setup
- **场景 & 角色**：scene:Home-Studio-Day | char:Creator-01, char:Agent-Engineer-01
- **空间锚点卡**：
  - 固定地标：左窗、中央木桌、右书架
  - 人物位置：Creator-01 左前景、坐姿面向右、双手压住长任务笔记；Agent-Engineer-01 右中景、站姿面向左侧终端、双手待命
  - 退场人物状态：无
  - 光位基线：左后日光 + 右侧柔反光
- **承接上一镜**：承接 S01 的笔记本与目光；结尾 Engineer 开始高速执行，为 S03 的上下文填充铺垫。
- **交接下一镜**：交接 S03。
- **双绑定**：[char:Creator-01] [char:Agent-Engineer-01] [scene:Home-Studio-Day] [hook:setup]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Creator 将厚任务笔记推向 Engineer
- 镜头：中景锁定
- 音频 + 锚点：纸摩擦 | 笔记中央
- 表演备注：交接到接取。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Engineer 前倾接住，眼睛亮起
- 镜头：小幅推近
- 音频 + 锚点：机械轻鸣 | Engineer 右中景
- 表演备注：交接到终端。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Engineer 打开终端，双手快速操作
- 镜头：右移跟拍
- 音频 + 锚点：键盘声 | 终端右侧
- 表演备注：交接到代码流。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：抽象代码与资料形状迅速生成
- 镜头：越肩近景
- 音频 + 锚点：电子节拍 | 屏幕无可读伪字
- 表演备注：交接到 Creator 微笑。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：Creator 放松靠椅、以为工作在推进
- 镜头：切表情特写
- 音频 + 锚点：轻呼气 | 左前景
- 表演备注：交接到速度提升。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Engineer 同时翻资料、运行工具
- 镜头：小幅环绕
- 音频 + 锚点：纸张与点击 | 桌面中央
- 表演备注：交接到透明上下文环。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：半透明上下文环在 Engineer 身后显现并开始装入彩色信息片
- 镜头：慢推
- 音频 + 锚点：低脉冲 | 环居中
- 表演备注：交接 S03。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–7s：“代码、调研、数据，它都很快。但任务一长，问题就来了。”；SFX：键盘、纸张、工具确认。；SFX：0–1s 纸摩擦，1–2s 机械轻鸣，2–3s 键盘声，3–4s 电子节拍，4–5s 轻呼气，5–6s 纸张与点击，6–7s 低脉冲；表演：0–1s Creator 将厚任务笔记推向 Engineer，1–2s Engineer 前倾接住，眼睛亮起，2–3s Engineer 打开终端，双手快速操作，3–4s 抽象代码与资料形状迅速生成，4–5s Creator 放松靠椅、以为工作在推进，5–6s Engineer 同时翻资料、运行工具，6–7s 半透明上下文环在 Engineer 身后显现并开始装入彩色信息片；`narrator-mouth-closed: true`。

## S03 / 7s — 延续 S02 同一角度与上下文环

- **Hook 类型**：reversal
- **场景 & 角色**：scene:Home-Studio-Day | char:Agent-Engineer-01
- **空间锚点卡**：
  - 固定地标：木桌底部、右书架、上下文环中央
  - 人物位置：Agent-Engineer-01 中央中景、站姿面向终端、双手高速操作
  - 退场人物状态：Creator-01 离屏左，保持桌边坐姿
  - 光位基线：
- **承接上一镜**：延续 S02 同一角度与上下文环；结尾最早的目标片开始褪色，交给 S04。
- **交接下一镜**：交接 S04。
- **双绑定**：[char:Agent-Engineer-01] [scene:Home-Studio-Day] [hook:reversal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：新资料片进入环
- 镜头：静态中近景
- 音频 + 锚点：轻提示 | Engineer 中央
- 表演备注：交接到环容量上升。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：第二批工具结果进入，早期“目标”片向外移
- 镜头：慢速小幅推近
- 音频 + 锚点：叠加提示 | 环后方
- 表演备注：交接到拥挤。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：第三批对话压入，目标片边缘变淡
- 镜头：轻微荷兰角 3°
- 音频 + 锚点：低频增压 | 环中央
- 表演备注：交接到约束受挤。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：`GPU ONLY` 硬约束片从清晰变半透明（后期确定性文字）
- 镜头：极近特写
- 音频 + 锚点：纸片摩擦 | 画面左缘
- 表演备注：交接到测试计划。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：`RUN TESTS` 计划片被折叠到环外
- 镜头：缓慢横移
- 音频 + 锚点：闷响 | 右缘
- 表演备注：交接到 Engineer 视线错过。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Engineer 仍高速工作但没看向被挤出的片
- 镜头：回到中近景
- 音频 + 锚点：键盘继续 | 人物中央
- 表演备注：交接到错误选择。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：褪色约束落向桌边，Engineer 手伸向默认 CPU 图标
- 镜头：快速推近手部
- 音频 + 锚点：单次警示音 | 右下
- 表演备注：交接 S04。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–7s：“Agent 的上下文有限。任务越长，早期目标、约束和计划越容易被淡化，甚至丢失。”；SFX：信息片入环、低压脉冲、末尾警示。；SFX：0–1s 轻提示，1–2s 叠加提示，2–3s 低频增压，3–4s 纸片摩擦，4–5s 闷响，5–6s 键盘继续，6–7s 单次警示音；表演：0–1s 新资料片进入环，1–2s 第二批工具结果进入，早期“目标”片向外移，2–3s 第三批对话压入，目标片边缘变淡，3–4s `GPU ONLY` 硬约束片从清晰变半透明（后期确定性文字），4–5s `RUN TESTS` 计划片被折叠到环外，5–6s Engineer 仍高速工作但没看向被挤出的片，6–7s 褪色约束落向桌边，Engineer 手伸向默认 CPU 图标；`narrator-mouth-closed: true`。

## S04 / 7s — 承接 Engineer 即将选错运行路径

- **Hook 类型**：suspense
- **场景 & 角色**：scene:Home-Studio-Day | char:Creator-01, char:Agent-Engineer-01
- **空间锚点卡**：
  - 固定地标：中央终端、桌边褪色约束片、左窗
  - 人物位置：Agent-Engineer-01 右中景、站姿面向终端、右手伸向 CPU 键；Creator-01 左前景、坐姿面向右、上身前倾并抬起左手
  - 退场人物状态：无
  - 光位基线：
- **承接上一镜**：承接 Engineer 即将选错运行路径；Creator 重新入镜指出约束，结尾暴露测试被跳过。
- **交接下一镜**：交接 S05。
- **双绑定**：[char:Creator-01] [char:Agent-Engineer-01] [scene:Home-Studio-Day] [hook:suspense]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Engineer 指尖接近 CPU 运行键
- 镜头：手部大特写锁定
- 音频 + 锚点：警示音持续 | 右下
- 表演备注：交接到 Creator 反应。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Creator 眼睛睁大、手从左伸入阻止
- 镜头：快速拉远
- 音频 + 锚点：椅脚声 | Creator 左前/Engineer 右中
- 表演备注：交接到约束片。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Creator 捡起 `GPU ONLY` 片放回终端旁
- 镜头：中景左摇右
- 音频 + 锚点：纸拍桌声 | 文字后期清晰
- 表演备注：交接到 Engineer 惊讶。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：Engineer 身体压缩后后仰，眼睛转向约束
- 镜头：表情特写
- 音频 + 锚点：短促机械吸气 | 右中
- 表演备注：交接到纠正运行。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：Engineer 切换 GPU 路径，终端亮青
- 镜头：小幅推近
- 音频 + 锚点：确认音 | 终端中央
- 表演备注：交接到测试清单。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Creator 指向空白测试清单
- 镜头：镜头下倾
- 音频 + 锚点：纸张声 | 桌面前景
- 表演备注：交接到 Engineer 僵住。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：Engineer 停住，背后上下文环仍满载
- 镜头：静态中近景
- 音频 + 锚点：音乐制动 | 人物右、清单左
- 表演备注：交接 S05。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–7s：“它会忘记 GPU 约束、跳过测试、偏离计划。”；SFX：警示、纸拍桌、GPU 确认。；SFX：0–1s 警示音持续，1–2s 椅脚声，2–3s 纸拍桌声，3–4s 短促机械吸气，4–5s 确认音，5–6s 纸张声，6–7s 音乐制动；表演：0–1s Engineer 指尖接近 CPU 运行键，1–2s Creator 眼睛睁大、手从左伸入阻止，2–3s Creator 捡起 `GPU ONLY` 片放回终端旁，3–4s Engineer 身体压缩后后仰，眼睛转向约束，4–5s Engineer 切换 GPU 路径，终端亮青，5–6s Creator 指向空白测试清单，6–7s Engineer 停住，背后上下文环仍满载；`narrator-mouth-closed: true`。

## S05 / 8s — 延续空白测试清单

- **Hook 类型**：reveal
- **场景 & 角色**：scene:Home-Studio-Day | char:Creator-01, char:Agent-Engineer-01
- **空间锚点卡**：
  - 固定地标：桌面清单、终端、右书架
  - 人物位置：Creator-01 左中景、坐姿面向右、双手开始检查产物；Agent-Engineer-01 右中景、站姿面向 Creator、右手保持完成手势
  - 退场人物状态：无
  - 光位基线：
- **承接上一镜**：延续空白测试清单；Engineer 先给出完成姿态，Creator 逐项发现半成品，结尾打开新会话。
- **交接下一镜**：交接 S06。
- **双绑定**：[char:Creator-01] [char:Agent-Engineer-01] [scene:Home-Studio-Day] [hook:reveal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Engineer 自信竖拇指，终端显示绿色完成圆点
- 镜头：中景锁定
- 音频 + 锚点：确认音 | 右侧
- 表演备注：交接到 Creator 检查。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Creator 拉近资料册，发现来源页空缺
- 镜头：桌面俯拍
- 音频 + 锚点：翻页声 | 左下
- 表演备注：交接到测试。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Creator 滑到测试仪，状态未运行
- 镜头：俯拍小幅右移
- 音频 + 锚点：空响 | 中央
- 表演备注：交接到部署。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：部署包仍封闭
- 镜头：大特写
- 音频 + 锚点：胶带摩擦 | 右下
- 表演备注：交接到论文。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：论文只写到第一页草稿
- 镜头：镜头上移到 Creator 皱眉
- 音频 + 锚点：叹气 | 左中
- 表演备注：交接到 Engineer。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Engineer 拇指慢慢放下、眼睛下垂
- 镜头：表情特写
- 音频 + 锚点：机械音降低 | 右中
- 表演备注：交接到用户接管。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：Creator 把四件半成品堆回自己面前
- 镜头：拉远
- 音频 + 锚点：沉重堆叠声 | 桌中央
- 表演备注：交接到新会话按钮。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：Creator 无奈打开第二个 Agent 会话
- 镜头：越肩近景
- 音频 + 锚点：点击声 | 终端左
- 表演备注：交接 S06。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“局部结果看起来不错，它就可能提前停下，留下缺证据的调研、没跑完的测试和一页论文草稿。”。；SFX：0–1s 确认音，1–2s 翻页声，2–3s 空响，3–4s 胶带摩擦，4–5s 叹气，5–6s 机械音降低，6–7s 沉重堆叠声，7–8s 点击声；表演：0–1s Engineer 自信竖拇指，终端显示绿色完成圆点，1–2s Creator 拉近资料册，发现来源页空缺，2–3s Creator 滑到测试仪，状态未运行，3–4s 部署包仍封闭，4–5s 论文只写到第一页草稿，5–6s Engineer 拇指慢慢放下、眼睛下垂，6–7s Creator 把四件半成品堆回自己面前，7–8s Creator 无奈打开第二个 Agent 会话；`narrator-mouth-closed: true`。

## S06 / 8s — 新会话从 S05 终端打开

- **Hook 类型**：reversal
- **场景 & 角色**：scene:Home-Studio-Day | char:Creator-01, char:Agent-Research-01, char:Agent-Engineer-01
- **空间锚点卡**：
  - 固定地标：同一桌、三个分隔工作位由镜头横移依次显露
  - 人物位置：Creator-01 左前景、站姿面向右、怀抱上下文笔记；Agent-Research-01 中景、面向右侧空白工作位、双手待命；Agent-Engineer-01 右中景、面向左侧终端、双手工作
  - 退场人物状态：无；上一 Engineer 视为同一身份延续
  - 光位基线：傍晚左窗
- **承接上一镜**：新会话从 S05 终端打开；第二、第三 Agent 出现，但没有共享状态，结尾形成重复实现。
- **交接下一镜**：交接 S07。
- **双绑定**：[char:Creator-01] [char:Agent-Research-01] [char:Agent-Engineer-01] [scene:Home-Studio-Day] [hook:reversal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Research 新会话醒来，空白上下文环
- 镜头：中景右移
- 音频 + 锚点：启动音 | Research 中央
- 表演备注：交接到 Creator 复制。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Creator 把厚笔记复制一份推过去
- 镜头：俯拍
- 音频 + 锚点：复印声 | 左到中
- 表演备注：交接到 Research 开工。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Engineer 在另一端重新制作同一组件
- 镜头：横移揭示
- 音频 + 锚点：工具声 | 右侧
- 表演备注：交接到重复。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：Research 也开始制作相同组件而非调研
- 镜头：双人中景
- 音频 + 锚点：两组点击重叠 | 中/右
- 表演备注：交接到 Creator 发现。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：Creator 左右看见两份重复零件，眉毛上扬
- 镜头：表情特写
- 音频 + 锚点：短促叹气 | 左前
- 表演备注：交接到询问。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Research 与 Engineer 同时停下互望，均不知道对方责任
- 镜头：静态三人宽景
- 音频 + 锚点：环境音骤降 | 桌横向
- 表演备注：交接到等待。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：两只 Agent 同时举起“等待上游”空牌（后期文字）
- 镜头：轻微荷兰角
- 音频 + 锚点：双提示音冲突 | 中/右
- 表演备注：交接到用户搬运。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：Creator 抱起上下文笔记在两者间来回
- 镜头：跟拍左移
- 音频 + 锚点：脚步和纸响 | 前景
- 表演备注：交接 S07。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“多开 Agent 也不等于协作。没有共享目标、责任和依赖，它们只会重复和等待。”。；SFX：0–1s 启动音，1–2s 复印声，2–3s 工具声，3–4s 两组点击重叠，4–5s 短促叹气，5–6s 环境音骤降，6–7s 双提示音冲突，7–8s 脚步和纸响；表演：0–1s Research 新会话醒来，空白上下文环，1–2s Creator 把厚笔记复制一份推过去，2–3s Engineer 在另一端重新制作同一组件，3–4s Research 也开始制作相同组件而非调研，4–5s Creator 左右看见两份重复零件，眉毛上扬，5–6s Research 与 Engineer 同时停下互望，均不知道对方责任，6–7s 两只 Agent 同时举起“等待上游”空牌（后期文字），7–8s Creator 抱起上下文笔记在两者间来回；`narrator-mouth-closed: true`。

## S07 / 7s — 承接 Creator 搬运上下文

- **Hook 类型**：expression-beat
- **场景 & 角色**：scene:Home-Studio-Night | char:Creator-01, char:Agent-Test-01
- **空间锚点卡**：
  - 固定地标：中央桌、左窗转蓝、绿色台灯点亮
  - 人物位置：Creator-01 中央前景、站姿面向右、双臂抱住厚笔记；Agent-Test-01 右中景、站姿面向左、双手翻开空清单
  - 退场人物状态：Agent-Research-01 离屏左仍重复工作，Agent-Engineer-01 离屏右仍等待
  - 光位基线：台灯右前暖主光
- **承接上一镜**：承接 Creator 搬运上下文；Test Agent 接到口头“完成”却无真实 Artifact，用户彻底成为项目经理。
- **交接下一镜**：交接 S08。
- **双绑定**：[char:Creator-01] [char:Agent-Test-01] [scene:Home-Studio-Night] [hook:expression-beat]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Creator 把笔记重重放到 Test 前
- 镜头：中景锁定
- 音频 + 锚点：纸堆落下 | 中央
- 表演备注：交接到 Test 查看。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Test 翻开只看到“已完成”口头便签
- 镜头：近景
- 音频 + 锚点：单张纸声 | 右中
- 表演备注：交接到寻找文件。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Test 在桌下、终端旁寻找真实文件却找不到
- 镜头：小幅摇摄
- 音频 + 锚点：抽屉声 | 右侧
- 表演备注：交接到 Creator。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：Creator 同时指挥左右两个离屏 Agent，手臂拉成夸张对角线
- 镜头：宽景轻荷兰角
- 音频 + 锚点：多重提示音 | 中央
- 表演备注：交接到疲惫。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：Creator 肩膀塌下，眼镜滑低
- 镜头：表情大特写锁定
- 音频 + 锚点：一声长叹 | 中央
- 表演备注：交接到台灯阴影。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：桌上计时器从白天跳到深夜
- 镜头：插入特写
- 音频 + 锚点：滴答加快 | 右下
- 表演备注：交接到结论。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：Creator 在任务笔记上写下“我在给 Agent 当项目经理”（后期确定性字），笔尖停住
- 镜头：俯拍
- 音频 + 锚点：笔划声 | 中央
- 表演备注：交接 S08。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–7s：“一句‘完成了’不能交接。你反复解释、检查、派活，最后成了 Agent 的项目经理。”。；SFX：0–1s 纸堆落下，1–2s 单张纸声，2–3s 抽屉声，3–4s 多重提示音，4–5s 一声长叹，5–6s 滴答加快，6–7s 笔划声；表演：0–1s Creator 把笔记重重放到 Test 前，1–2s Test 翻开只看到“已完成”口头便签，2–3s Test 在桌下、终端旁寻找真实文件却找不到，3–4s Creator 同时指挥左右两个离屏 Agent，手臂拉成夸张对角线，4–5s Creator 肩膀塌下，眼镜滑低，5–6s 桌上计时器从白天跳到深夜，6–7s Creator 在任务笔记上写下“我在给 Agent 当项目经理”（后期确定性字），笔尖停住；`narrator-mouth-closed: true`。

## S08 / 10s — 从 S07 笔尖停住开始

- **Hook 类型**：reveal
- **场景 & 角色**：scene:Home-Studio-Night | char:Creator-01, char:Agent-Engineer-01
- **空间锚点卡**：
  - 固定地标：Home-Studio-Night 台灯右侧、笔记中央、终端左中
  - 人物位置：Creator-01 左中景、坐姿面向终端、双手悬在键盘上；Agent-Engineer-01 右后景、站姿面向 Creator、双手垂下观察
  - 退场人物状态：Agent-Test-01 离屏右持空清单，Agent-Research-01 离屏左持重复资料
  - 光位基线：台灯暖主光 + 左窗蓝补光
- **承接上一镜**：从 S07 笔尖停住开始；Creator 清空重复会话，输入一条 Mission；结尾命令确认。
- **交接下一镜**：交接 S09。
- **双绑定**：[char:Creator-01] [char:Agent-Engineer-01] [scene:Home-Studio-Night] [hook:reveal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Creator 合上散乱会话，清空桌面中央
- 镜头：俯拍拉远
- 音频 + 锚点：窗口关闭声 | 中央
- 表演备注：交接到新输入。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Creator 点击“New Mission”
- 镜头：越肩近景
- 音频 + 锚点：低确认音 | 终端左中
- 表演备注：交接到光标。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：打字：“完成一个可公开复验的 DeBERTa ABSA 项目”
- 镜头：镜头锁定
- 音频 + 锚点：键盘声 | 输入框中央
- 表演备注：交接到约束。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：打字：“只允许 RTX 5090 CUDA 训练”
- 镜头：保持构图
- 音频 + 锚点：键盘声 | Creator 嘴闭
- 表演备注：交接到监控。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：打字：“记录每次实验，并做监控与推理网页”
- 镜头：小幅推近
- 音频 + 锚点：键盘声 | 文本安全区
- 表演备注：交接到论文。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：打字：“绘图、撰写并独立审校 ACL 短论文”
- 镜头：继续推近
- 音频 + 锚点：键盘声 | 终端中央
- 表演备注：交接到发布。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：打字：“整理仓库，发布前向我确认”
- 镜头：Creator 手指停顿
- 音频 + 锚点：键盘停止 | 确认键右下
- 表演备注：交接到验收。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：验收标准在输入下方逐条出现：GPU、测试、页面、论文、仓库
- 镜头：镜头轻下倾
- 音频 + 锚点：五个柔和提示音 | 终端
- 表演备注：交接到总览。；narrator-mouth-closed: true

#### 8–9s

- 姿态 + 表情：Creator 重新通读，眼神从上到下
- 镜头：表情近景
- 音频 + 锚点：轻呼吸 | 左中
- 表演备注：交接到提交。；narrator-mouth-closed: true

#### 9–10s

- 姿态 + 表情：Creator 按下提交，珊瑚色光沿桌面流向 Mission 账本
- 镜头：跟随光线右移
- 音频 + 锚点：清晰确认音 | 桌中央
- 表演备注：交接 S09。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–2s：“这就是 OpenCorvus Mission 要解决的问题。”；2–10s 保留打字声，旁白停顿。；SFX：0–1s 窗口关闭声，1–2s 低确认音，2–3s 键盘声，3–4s 键盘声，4–5s 键盘声，5–6s 键盘声，6–7s 键盘停止，7–8s 五个柔和提示音，8–9s 轻呼吸，9–10s 清晰确认音；表演：0–1s Creator 合上散乱会话，清空桌面中央，1–2s Creator 点击“New Mission”，2–3s 打字：“完成一个可公开复验的 DeBERTa ABSA 项目”，3–4s 打字：“只允许 RTX 5090 CUDA 训练”，4–5s 打字：“记录每次实验，并做监控与推理网页”，5–6s 打字：“绘图、撰写并独立审校 ACL 短论文”，6–7s 打字：“整理仓库，发布前向我确认”，7–8s 验收标准在输入下方逐条出现：GPU、测试、页面、论文、仓库，8–9s Creator 重新通读，眼神从上到下，9–10s Creator 按下提交，珊瑚色光沿桌面流向 Mission 账本；`narrator-mouth-closed: true`。

## S09 / 8s — 承接珊瑚光进入 Mission 账本

- **Hook 类型**：setup
- **场景 & 角色**：scene:Mission-Workbench | char:Creator-01, char:Agent-Research-01
- **空间锚点卡**：
  - 固定地标：Mission-Workbench 左端账本、中央木桌、右端空工作位
  - 人物位置：Creator-01 左前景、站姿面向账本、右手刚离开提交键；Agent-Research-01 中景、站姿面向 Task-1、双手放在关闭文件夹旁
  - 退场人物状态：Agent-Engineer-01 离屏右观察，Agent-Test-01 离屏右持空清单，三者均保留上一镜状态
  - 光位基线：账本青光为局部补光，台灯基线不变
- **承接上一镜**：承接珊瑚光进入 Mission 账本；目标、约束与验收被持久固定，再展开 Task。
- **交接下一镜**：交接 S10。
- **双绑定**：[char:Creator-01] [char:Agent-Research-01] [scene:Mission-Workbench] [hook:setup]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：账本封面亮起但不拟人化
- 镜头：中景小幅推近
- 音频 + 锚点：低脉冲 | 左端
- 表演备注：交接到三类页签。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：`GOAL` 页固定在最上层（后期字）
- 镜头：俯拍
- 音频 + 锚点：纸页卡扣声 | 左上
- 表演备注：交接到约束。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：`CONSTRAINTS` 页以金属扣锁定
- 镜头：俯拍横移
- 音频 + 锚点：扣合声 | 中央
- 表演备注：交接到验收。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：`ACCEPTANCE` 页锁定
- 镜头：俯拍继续
- 音频 + 锚点：确认音 | 右上
- 表演备注：交接到 Creator 放手。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：Creator 松开笔记，不再亲自搬运
- 镜头：拉远
- 音频 + 锚点：轻呼气 | 左前景
- 表演备注：交接到 Task 文件夹。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：六个 Task 文件夹从账本依赖页依次展开，保持实体纸张和细线连接
- 镜头：顶视轻推
- 音频 + 锚点：展开声 | 桌中央
- 表演备注：交接到 Research。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：Research 打开第一个 Task，内部显示锁定专家团版本与工作流（后期标签）
- 镜头：中景
- 音频 + 锚点：机械提示 | 中央
- 表演备注：交接到队员。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：Research 向离屏右侧示意同团成员加入
- 镜头：镜头右摇
- 音频 + 锚点：脚步/轮声 | 桌工作位
- 表演备注：交接 S10。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“你写下目标、约束和验收标准。Mission 持久保存，再拆成有依赖的 Task，并锁定专家团和工作流。”。；SFX：0–1s 低脉冲，1–2s 纸页卡扣声，2–3s 扣合声，3–4s 确认音，4–5s 轻呼气，5–6s 展开声，6–7s 机械提示，7–8s 脚步/轮声；表演：0–1s 账本封面亮起但不拟人化，1–2s `GOAL` 页固定在最上层（后期字），2–3s `CONSTRAINTS` 页以金属扣锁定，3–4s `ACCEPTANCE` 页锁定，4–5s Creator 松开笔记，不再亲自搬运，5–6s 六个 Task 文件夹从账本依赖页依次展开，保持实体纸张和细线连接，6–7s Research 打开第一个 Task，内部显示锁定专家团版本与工作流（后期标签），7–8s Research 向离屏右侧示意同团成员加入；`narrator-mouth-closed: true`。

## S10 / 8s — 承接 Research 招手

- **Hook 类型**：reveal
- **场景 & 角色**：scene:Mission-Workbench | char:Agent-Research-01, char:Agent-Engineer-01, char:Agent-Test-01
- **空间锚点卡**：
  - 固定地标：Mission-Workbench 中段 Task-1 工作位、左侧账本仍可见
  - 人物位置：Agent-Research-01 左中景、面向中央来源册、左手持放大镜；Agent-Engineer-01 中央中景、面向实现终端、双手待命；Agent-Test-01 右中景、面向测试仪、右手持笔
  - 退场人物状态：Creator-01 离屏左，最后站在账本旁
  - 光位基线：左上暖光 + 桌面青补光
- **承接上一镜**：承接 Research 招手；完整三角色专家团进入同一 Task，共同产出第一个 Artifact。
- **交接下一镜**：交接 S11。
- **双绑定**：[char:Agent-Research-01] [char:Agent-Engineer-01] [char:Agent-Test-01] [scene:Mission-Workbench] [hook:reveal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：三名 Agent 同时围到 Task-1，形成清晰三角剪影
- 镜头：宽景锁定
- 音频 + 锚点：轮声 | 左/中/右
- 表演备注：交接到 Research。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Research 摊开来源册并标出精确段落
- 镜头：左侧近景
- 音频 + 锚点：纸声 | 来源册左下
- 表演备注：交接到 Engineer。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Engineer 根据来源搭建实现，眼神在来源与终端间移动
- 镜头：中景轻右移
- 音频 + 锚点：工具声 | 中央
- 表演备注：交接到 Test。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：Test 预先写下验收用例而非等到最后
- 镜头：右侧近景
- 音频 + 锚点：笔触声 | 清单右下
- 表演备注：交接到并行协作。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：三者交换眼神，Research 指向证据、Engineer 调整、Test 勾第一项
- 镜头：小幅环绕
- 音频 + 锚点：三种物理声同步 | 三角稳定
- 表演备注：交接到产物。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：实现生成真实文件，文件边附 source 与 locator 标签（后期）
- 镜头：俯拍
- 音频 + 锚点：文件落盘声 | 桌中央
- 表演备注：交接到测试。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：Test 运行用例，结果转绿
- 镜头：中近景
- 音频 + 锚点：三声测试确认 | 右侧
- 表演备注：交接到封装 Artifact。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：三者共同把文件、来源、locator 固定为 Artifact-1
- 镜头：慢推近
- 音频 + 锚点：扣合声 | 中央
- 表演备注：交接 S11。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“在这个案例里，每个重型 Task 都由完整专家团围绕同一责任协作、测试和验收。”。；SFX：0–1s 轮声，1–2s 纸声，2–3s 工具声，3–4s 笔触声，4–5s 三种物理声同步，5–6s 文件落盘声，6–7s 三声测试确认，7–8s 扣合声；表演：0–1s 三名 Agent 同时围到 Task-1，形成清晰三角剪影，1–2s Research 摊开来源册并标出精确段落，2–3s Engineer 根据来源搭建实现，眼神在来源与终端间移动，3–4s Test 预先写下验收用例而非等到最后，4–5s 三者交换眼神，Research 指向证据、Engineer 调整、Test 勾第一项，5–6s 实现生成真实文件，文件边附 source 与 locator 标签（后期），6–7s Test 运行用例，结果转绿，7–8s 三者共同把文件、来源、locator 固定为 Artifact-1；`narrator-mouth-closed: true`。

## S11 / 8s — Task-1 的 `research-studio · version locked` 专家团交付 Artifact-1

- **Hook 类型**：suspense
- **场景 & 角色**：scene:Mission-Workbench | char:Agent-Research-01, char:Agent-Engineer-01, char:Agent-Test-01
- **空间锚点卡**：
  - 固定地标：Task-1 中左、Task-2 右中、等待轨位右端
  - 人物位置：Agent-Research-01 左中景、面向 Task-2 等待门、双手持来源册；Agent-Engineer-01 中央中景、面向 Task-2、双手垂下等待；Agent-Test-01 右中景、面向队列槽、双手持测试仪
  - 退场人物状态：Creator-01 离屏左，仍在账本旁观察
  - 光位基线：
- **承接上一镜**：Task-1 的 `research-studio · version locked` 专家团交付 Artifact-1；Task-2 的 `advanced · version locked` 完整专家团先共同等待，依赖满足后一起唤醒入队。
- **交接下一镜**：交接 S12。
- **双绑定**：[char:Agent-Research-01] [char:Agent-Engineer-01] [char:Agent-Test-01] [scene:Mission-Workbench] [hook:suspense]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Task-2 门上显示 `advanced · version locked`，三名团员在灰灯后保持完整三角站位
- 镜头：宽景锁定
- 音频 + 锚点：低等待脉冲 | 右中
- 表演备注：交接到上游状态。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Engineer 透过门查看 Task-1 最后一项测试仍未完成
- 镜头：左侧近景
- 音频 + 锚点：轻警示 | 中央
- 表演备注：交接到等待。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Research 合上自己的来源册但不越过等待线
- 镜头：中近景
- 音频 + 锚点：纸张声 | 左中
- 表演备注：交接到 Test。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：Test 将测试仪保持休眠，三人共同等待而非各自开工
- 镜头：右移跟拍
- 音频 + 锚点：设备低鸣 | 右中
- 表演备注：交接到 Artifact-1。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：Artifact-1 状态变为 ready，source 与 locator 清晰
- 镜头：插入特写
- 音频 + 锚点：确认音 | 中央
- 表演备注：交接到依赖纸带。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：纸带从 Artifact-1 接入 Task-2，门灯由灰转青
- 镜头：慢速横移
- 音频 + 锚点：继电器声 | 中到右
- 表演备注：交接到整团唤醒。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：三名团员同时抬头，Task-2 作为同一队列项进入槽位
- 镜头：宽景小幅推近
- 音频 + 锚点：单次队列咔哒 | 右中
- 表演备注：交接到移动。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：Research、Engineer、Test 一起越过等待线进入 Task-2，Research 手持 locator 领路
- 镜头：跟拍右移
- 音频 + 锚点：三组同步脚步 | 右中
- 表演备注：交接 S12。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“上游没有交付，下游整支专家团就等待；依赖满足后才会被一起唤醒。”；SFX：0–4s 等待脉冲，4.5s ready 确认，5.5s 继电器，6.5s 队列咔哒，7–8s 同步脚步；表演：三者 0–5s 眼线保持上游，6s 同时抬头，7s 身体前倾进入工作；`narrator-mouth-closed: true`。

## S12 / 8s — `advanced · version locked` 三名团员承接同一 locator

- **Hook 类型**：reveal
- **场景 & 角色**：scene:Mission-Workbench | char:Agent-Research-01, char:Agent-Engineer-01, char:Agent-Test-01
- **空间锚点卡**：
  - 固定地标：Task-2 工作位右中、队列槽右下、执行轮次计时器上方
  - 人物位置：Agent-Research-01 左中景、面向 occurrence 卷轴、左手固定来源；Agent-Engineer-01 中央中景、面向 GPU 终端、双手待命；Agent-Test-01 右中景、面向计时器、右手持测试仪
  - 退场人物状态：Creator-01 已连续两镜离屏，不再追踪
  - 光位基线：右上青轮廓光
- **承接上一镜**：`advanced · version locked` 三名团员承接同一 locator；镜头建立唯一执行轮次并记录来源、工具、参数和结果。
- **交接下一镜**：交接 S13。
- **双绑定**：[char:Agent-Research-01] [char:Agent-Engineer-01] [char:Agent-Test-01] [scene:Mission-Workbench] [hook:reveal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Research 用 Artifact-1 locator 打开来源并创建唯一 `occurrence-01`
- 镜头：中景锁定
- 音频 + 锚点：启动音 | 左到上方计时器
- 表演备注：交接到 Engineer。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Engineer 只在来源加载后启动 GPU 工具
- 镜头：中央近景
- 音频 + 锚点：风扇升速 | GPU 终端
- 表演备注：交接到参数。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：`cuda:0 / seed 42` 与 source locator 同写入轮次卷轴
- 镜头：插入特写
- 音频 + 锚点：打印声 | 卷轴中央
- 表演备注：交接到 Test。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：Test 观察 epoch 进度并记录第一组结果
- 镜头：小幅右移
- 音频 + 锚点：节拍提示 | Test 右中
- 表演备注：交接到团内核对。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：Research 对照来源、Engineer 对照运行、Test 对照用例，三者共同确认但不宣布 Task 完成
- 镜头：俯拍拉远
- 音频 + 锚点：落盘声 | 三角工作位
- 表演备注：交接到下一工具。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Engineer 启动第二步，计时器保持同一 occurrence
- 镜头：慢推
- 音频 + 锚点：工具启动 | 中央
- 表演备注：交接到保存。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：occurrence 卷轴保存当前位置、工具、参数、结果与团版本
- 镜头：插入特写
- 音频 + 锚点：保存确认 | 中央
- 表演备注：交接到中断。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：窗外闪电，三名团员同时抬头，卷轴保持固定
- 镜头：快速拉远
- 音频 + 锚点：远雷 | 全景
- 表演备注：交接 S13。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“每次执行都记录进度、来源、工具、参数和结果。”；SFX：0.5s 启动，1.5s GPU 风扇，2.5s 打印，3.5s 进度提示，4.5s 落盘，5.5s 工具启动，6.5s 保存，7.5s 远雷；表演：Research 眼线在来源与卷轴间，Engineer 前倾操作，Test 盯计时器，7s 三者同时停手抬头；`narrator-mouth-closed: true`。

## S13 / 8s — 承接三名团员同时抬头

- **Hook 类型**：reversal
- **场景 & 角色**：scene:Mission-Workbench | char:Agent-Research-01, char:Agent-Engineer-01, char:Agent-Test-01
- **空间锚点卡**：
  - 固定地标：Task-2 右中、occurrence 卷轴中央、队列槽右下
  - 人物位置：Agent-Research-01 左中景、面向 occurrence 卷轴、双手保持来源页；Agent-Engineer-01 中央中景、面向 GPU 终端、右手停在键盘；Agent-Test-01 右中景、面向计时器、双手停在测试仪
  - 退场人物状态：无
  - 光位基线：0–3s 暂时熄灭，4s 后恢复原青/暖基线
- **承接上一镜**：承接三名团员同时抬头；服务中断后恢复同一 occurrence 与同一 `advanced` 团，不从头开始、不复制 Task。
- **交接下一镜**：交接 S14。
- **双绑定**：[char:Agent-Research-01] [char:Agent-Engineer-01] [char:Agent-Test-01] [scene:Mission-Workbench] [hook:reversal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：灯全灭，Research、Engineer、Test 保持上一秒姿势冻结
- 镜头：静态宽景
- 音频 + 锚点：断电声 | 左中右
- 表演备注：交接到黑暗中的卷轴。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：只有 occurrence 编号、团版本与最后结果保持可见
- 镜头：特写锁定
- 音频 + 锚点：低备用电源音 | 中央
- 表演备注：交接到状态核对。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：队列位置、Task 数量和三名团员绑定都不变
- 镜头：俯拍
- 音频 + 锚点：有意静默 | 桌面
- 表演备注：交接到重启。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：台灯重新点亮，系统读取同一 occurrence 与团绑定
- 镜头：慢推
- 音频 + 锚点：启动音 | 中央
- 表演备注：交接到定位。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：指针落在中断前的第二工具结果之后
- 镜头：特写
- 音频 + 锚点：定位咔哒 | 卷轴右侧
- 表演备注：交接到 Research。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Research 指向下一来源步骤，Engineer 从下一工具继续
- 镜头：双人中景
- 音频 + 锚点：键盘声 | 左/中
- 表演备注：交接到 Test。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：Test 对比前后结果，确认没有第二个 Task、轮次或专家团副本
- 镜头：右向左摇
- 音频 + 锚点：确认音 | 右中
- 表演备注：交接到团内完成。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：同一 occurrence 收束为 completed，三名团员共同转向 Artifact 装订位
- 镜头：拉远
- 音频 + 锚点：制动音 | 中景
- 表演备注：交接 S14。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“中断或重启后，Mission 从持久状态继续，不从头猜，也不复制 Task 或专家团。”；SFX：0s 断电，1–2s 备用电源，2–3s silent，3.5s 重启，4.5s 定位，5.5s 键盘，6.5s 核对确认，7.5s 制动；表演：三者 0–3s 冻结，4s 同时恢复眼神，5–7s 按 Research→Engineer→Test 顺序继续；`narrator-mouth-closed: true`。

## S14 / 8s — `advanced` 团从恢复后的同一 occurrence 形成 Artifact-2

- **Hook 类型**：reveal
- **场景 & 角色**：scene:Mission-Workbench | char:Agent-Research-01, char:Agent-Engineer-01, char:Agent-Test-01
- **空间锚点卡**：
  - 固定地标：Artifact 装订位中央、Task-3 等待门右侧
  - 人物位置：Agent-Research-01 左中景、面向 Artifact 装订位、双手准备接收文件；Agent-Engineer-01 中央中景、面向 occurrence 卷轴、双手托住模型文件；Agent-Test-01 右中景、面向装订位、右手持通过清单
  - 退场人物状态：无
  - 光位基线：中央暖主光 + locator 青边光
- **承接上一镜**：`advanced` 团从恢复后的同一 occurrence 形成 Artifact-2；Task-3 的 `base · version locked` 完整专家团只在 locator 就绪后唤醒。
- **交接下一镜**：交接 S15。
- **双绑定**：[char:Agent-Research-01] [char:Agent-Engineer-01] [char:Agent-Test-01] [scene:Mission-Workbench] [hook:reveal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Engineer 从刚恢复完成的 occurrence 取出唯一模型文件
- 镜头：中景
- 音频 + 锚点：文件弹出声 | 中央
- 表演备注：交接到 Research。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Research 接住同一文件并放入 Artifact 装订位，不发生硬切或角色跳现
- 镜头：跟拍左移
- 音频 + 锚点：文件落盘 | 中央到左
- 表演备注：交接到来源。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：occurrence、团版本、工具结果写入 source 字段
- 镜头：特写
- 音频 + 锚点：打印声 | 文件左边
- 表演备注：交接到 locator。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：Test 将通过用例附在文件右侧
- 镜头：俯拍
- 音频 + 锚点：纸扣声 | 中央
- 表演备注：交接到路径。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：locator 显示具体路径与页/行定位
- 镜头：慢推
- 音频 + 锚点：定位提示 | 文件右边
- 表演备注：交接到 Task-3 门。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：三名 `advanced` 团员共同把 Artifact-2 推到 Task-3 输入位
- 镜头：宽景右移
- 音频 + 锚点：滑轨声 | 中到右
- 表演备注：交接到依赖满足。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：Task-3 门显示 `base · version locked`，灰灯转紫，门后 Research/Test/Reviewer 三角色剪影同时抬头
- 镜头：右侧近景
- 音频 + 锚点：继电器声 | 右中
- 表演备注：交接到整团唤醒。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：Task-3 门打开，Artifact-2 与 locator 停在三人之间
- 镜头：静态宽景
- 音频 + 锚点：单次队列确认 | 右中
- 表演备注：交接 S15。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“交接不是一句‘完成了’。Artifact 带着文件、来源和 locator，唤醒下一支完整专家团。”；SFX：0.5s 文件弹出，1.5s 落盘，2.5s 打印，3.5s 纸扣，4.5s 定位，5.5s 滑轨，6.5s 继电器，7.5s 队列确认；表演：advanced 团按 Engineer→Research→Test 完成交接，Task-3 三角色在 6s 同时抬头但未提前越门；`narrator-mouth-closed: true`。

## S15 / 8s — Task-3 的 `base · version locked` 完整专家团接收 Artifact-2

- **Hook 类型**：suspense
- **场景 & 角色**：scene:Mission-Workbench | char:Agent-Research-01, char:Agent-Test-01, char:Agent-Reviewer-01
- **空间锚点卡**：
  - 固定地标：Task-3 验收位右侧、验收标准册下方、Artifact 文件中央
  - 人物位置：Agent-Research-01 左中景、面向 Artifact 来源页、左手指向 locator；Agent-Test-01 中央中景、面向验收终端、双手持复现工具；Agent-Reviewer-01 右中景、面向验收标准册、双手准备检查
  - 退场人物状态：Agent-Engineer-01 离屏左，停在 Task-2 修复位等待退回
  - 光位基线：右上紫轮廓光 + 中央暖光
- **承接上一镜**：Task-3 的 `base · version locked` 完整专家团接收 Artifact-2；Reviewer 保持独立判定，Research 回读来源，Test 负责复现，缺陷带证据退回。
- **交接下一镜**：交接 S16。
- **双绑定**：[char:Agent-Research-01] [char:Agent-Test-01] [char:Agent-Reviewer-01] [scene:Mission-Workbench] [hook:suspense]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：三名 `base` 团员围住同一 Artifact，Reviewer 打开验收册、Research 打开 source、Test 连接复现工具
- 镜头：宽景锁定
- 音频 + 锚点：三种轻音 | 左中右
- 表演备注：交接到第一项。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Reviewer 对照第一项，Research 回读来源定位，Test 执行并通过
- 镜头：右到左小幅摇摄
- 音频 + 锚点：确认音 | 三角工作位
- 表演备注：交接到第二项。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Test 在第二项复现空输入崩溃，Research 确认使用的正是 Artifact locator
- 镜头：越肩近景
- 音频 + 锚点：短警示 | 中央
- 表演备注：交接到稳定复现。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：Reviewer 独立再次触发相同错误，三者眼线集中到失败结果
- 镜头：镜头锁定
- 音频 + 锚点：错误音 | 右中
- 表演备注：交接到证据。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：Research 绑定来源、Test 附复现步骤、Reviewer 写 rejected 判定
- 镜头：俯拍
- 音频 + 锚点：保存声 | 文件中央
- 表演备注：交接到退回。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Reviewer 将状态设为 rejected，Task-3 保持未完成
- 镜头：中景小幅推近
- 音频 + 锚点：低制动音 | 右中
- 表演备注：交接到 Task-2。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：失败 locator 沿同一纸带返回 Task-2，离屏 Engineer 的工作位亮起
- 镜头：横移向左
- 音频 + 锚点：纸带滑动声 | 右到左
- 表演备注：交接到修复者。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：Engineer 的手从离屏左接住缺陷单，base 团留在验收位等待复验
- 镜头：近景
- 音频 + 锚点：纸张声 | 左边缘/右背景
- 表演备注：交接 S16。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“下一支专家团回读来源并独立复现；不合格就带着证据退回，Task 仍不完成。”；SFX：0–1s 册页/工具连接，1.5s 确认，2.5s 警示，3.5s 错误，4.5s 保存，5.5s 制动，6.5s 滑轨，7.5s 纸张；表演：Reviewer 眼线始终独立对准标准，Research 对准 source，Test 对准复现工具，6s 后三者保持等待姿势；`narrator-mouth-closed: true`。

## S16 / 8s — Engineer 带失败 locator 返回

- **Hook 类型**：callback
- **场景 & 角色**：scene:Mission-Workbench | char:Agent-Engineer-01, char:Agent-Test-01, char:Agent-Reviewer-01
- **空间锚点卡**：
  - 固定地标：Task-2 左中、Task-3 右中、Mission 账本左端可见
  - 人物位置：Agent-Engineer-01 左中景、面向失败 locator、双手在键盘上；Agent-Test-01 中央中景、面向测试仪、右手准备运行；Agent-Reviewer-01 右中景、面向验收册、双手保持独立检查姿势
  - 退场人物状态：Agent-Research-01 离屏左，保留来源册
  - 光位基线：
- **承接上一镜**：Engineer 带失败 locator 返回；原团队修复、重验，全部依赖与验收完成后才收敛终态。
- **交接下一镜**：交接 S17。
- **双绑定**：[char:Agent-Engineer-01] [char:Agent-Test-01] [char:Agent-Reviewer-01] [scene:Mission-Workbench] [hook:callback]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Engineer 用失败 locator 直接定位崩溃代码
- 镜头：左侧近景
- 音频 + 锚点：定位音 | 终端左中
- 表演备注：交接到修复。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Engineer 修改边界条件
- 镜头：极近手部
- 音频 + 锚点：键盘声 | 左下
- 表演备注：交接到 Test。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Test 增加空输入用例
- 镜头：中景
- 音频 + 锚点：笔触声 | 中央
- 表演备注：交接到运行。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：Test 运行原失败路径，网页保持稳定
- 镜头：越肩近景
- 音频 + 锚点：测试完成音 | 中央
- 表演备注：交接到 Reviewer。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：修复 Artifact 带新 locator 回到 Reviewer
- 镜头：横移右
- 音频 + 锚点：文件传递声 | 中到右
- 表演备注：交接到复验。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Reviewer 重跑并勾选验收
- 镜头：右侧近景
- 音频 + 锚点：确认音 | 清单右下
- 表演备注：交接到依赖总览。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：Mission 账本检查所有 Task 依赖和验收状态
- 镜头：拉远宽景
- 音频 + 锚点：低脉冲 | 账本左、Task 线中央
- 表演备注：交接到终态。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：最后一个状态从 running 变 completed
- 镜头：三个 Agent 放松但不庆功过度
- 音频 + 锚点：绿色确认和音乐制动 | 宽景锁定
- 表演备注：交接 S17。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“原团队修复并重验。通过后才收敛终态；无法继续时留下明确阻塞证据。”。；SFX：0–1s 定位音，1–2s 键盘声，2–3s 笔触声，3–4s 测试完成音，4–5s 文件传递声，5–6s 确认音，6–7s 低脉冲，7–8s 绿色确认和音乐制动；表演：0–1s Engineer 用失败 locator 直接定位崩溃代码，1–2s Engineer 修改边界条件，2–3s Test 增加空输入用例，3–4s Test 运行原失败路径，网页保持稳定，4–5s 修复 Artifact 带新 locator 回到 Reviewer，5–6s Reviewer 重跑并勾选验收，6–7s Mission 账本检查所有 Task 依赖和验收状态，7–8s 最后一个状态从 running 变 completed；`narrator-mouth-closed: true`。

## S17 / 10s — 从 Mission 完成态匹配切到同一项目在不同工具中的工作重心

- **Hook 类型**：reveal
- **场景 & 角色**：scene:Future-Gallery | char:Creator-01, char:Agent-Engineer-01
- **空间锚点卡**：
  - 固定地标：连续创作走廊，左为办公文件台，中为可组合工具台，右为编码协作台，末端为 Mission 工作台
  - 人物位置：Creator-01 中央中景、站姿面向右、双手抱同一项目；Agent-Engineer-01 右后景、站姿面向右、双手持工具终端
  - 退场人物状态：Agent-Test-01 离屏左留在测试位，Agent-Reviewer-01 离屏右留在验收位，Agent-Research-01 离屏左保留来源册
  - 光位基线：左到右连续日光
- **承接上一镜**：从 Mission 完成态匹配切到同一项目在不同工具中的工作重心；不做表格或赢家徽章。
- **交接下一镜**：交接 S18。
- **双绑定**：[char:Creator-01] [char:Agent-Engineer-01] [scene:Future-Gallery] [hook:reveal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Creator 拿同一项目从办公文件台出发
- 镜头：跟踪中景
- 音频 + 锚点：脚步声 | 左侧
- 表演备注：交接到 WorkBuddy 标签。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：后期短标签 `WorkBuddy · 办公成品` 随文件夹出现
- 镜头：镜头继续右移
- 音频 + 锚点：纸张声 | 左中
- 表演备注：交接到工具台。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Creator 到可组合模块台，Engineer 更换工具插件
- 镜头：跟拍
- 音频 + 锚点：模块咔哒 | 中央
- 表演备注：交接到 DeepSeek 标签。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：后期标签 `DeepSeek Harness · 可组合运行时`
- 镜头：轻推
- 音频 + 锚点：低电子音 | 中央
- 表演备注：交接到编码台。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：Creator 经过一组隔离编码工作位
- 镜头：横向跟踪
- 音频 + 锚点：键盘声 | 右中
- 表演备注：交接到 Codex。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：后期标签 `Codex · 软件工程 Agent`
- 镜头：镜头不停
- 音频 + 锚点：提示音 | 右中
- 表演备注：交接到并行协作。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：两个编码工作位并行协作，后期标签 `Claude Code · 编码协作`
- 镜头：继续跟踪
- 音频 + 锚点：双键盘声 | 右侧
- 表演备注：交接到走廊尽头。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：Creator 转向贯穿调研、训练、网页、论文和发布的 Mission 工作台
- 镜头：小幅拉远
- 音频 + 锚点：音乐上扬 | 末端中央
- 表演备注：交接到定位。；narrator-mouth-closed: true

#### 8–9s

- 姿态 + 表情：后期标签 `OpenCorvus · 开源长程 Mission`，不出现赢家标识
- 镜头：镜头停下
- 音频 + 锚点：稳态脉冲 | 中央
- 表演备注：交接到开源机柜。；narrator-mouth-closed: true

#### 9–10s

- 姿态 + 表情：Creator 打开 Mission 工作台侧面的源码机柜
- 镜头：匹配切齿轮
- 音频 + 锚点：机柜开启声 | 右下
- 表演备注：交接 S18。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–10s：“有的工具做办公成品，有的专注运行时或编码协作。OpenCorvus 负责跨领域长目标的持续推进、恢复、交接和验收。”。；SFX：0–1s 脚步声，1–2s 纸张声，2–3s 模块咔哒，3–4s 低电子音，4–5s 键盘声，5–6s 提示音，6–7s 双键盘声，7–8s 音乐上扬，8–9s 稳态脉冲，9–10s 机柜开启声；表演：0–1s Creator 拿同一项目从办公文件台出发，1–2s 后期短标签 `WorkBuddy · 办公成品` 随文件夹出现，2–3s Creator 到可组合模块台，Engineer 更换工具插件，3–4s 后期标签 `DeepSeek Harness · 可组合运行时`，4–5s Creator 经过一组隔离编码工作位，5–6s 后期标签 `Codex · 软件工程 Agent`，6–7s 两个编码工作位并行协作，后期标签 `Claude Code · 编码协作`，7–8s Creator 转向贯穿调研、训练、网页、论文和发布的 Mission 工作台，8–9s 后期标签 `OpenCorvus · 开源长程 Mission`，不出现赢家标识，9–10s Creator 打开 Mission 工作台侧面的源码机柜；`narrator-mouth-closed: true`。

## S18 / 8s — 承接源码机柜打开

- **Hook 类型**：reversal
- **场景 & 角色**：scene:Open-Source-Bench | char:Creator-01, char:Agent-Engineer-01, char:Agent-Reviewer-01
- **空间锚点卡**：
  - 固定地标：Open-Source-Bench 中央机柜、左侧源码册、右侧权限钥匙、下方记录卷轴
  - 人物位置：Creator-01 中央中景、站姿面向机柜、右手准备更换模块；Agent-Engineer-01 左中景、面向源码册、双手翻页；Agent-Reviewer-01 右中景、面向权限钥匙、右手指向确认位
  - 退场人物状态：Agent-Test-01 第二镜离屏，Agent-Research-01 第二镜离屏
  - 光位基线：左后日光 + 机柜内部青光
- **承接上一镜**：承接源码机柜打开；通过用户动作演出开源、自托管、替换、权限确认和记录回放。
- **交接下一镜**：交接 S19。
- **双绑定**：[char:Creator-01] [char:Agent-Engineer-01] [char:Agent-Reviewer-01] [scene:Open-Source-Bench] [hook:reversal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Creator 完全打开机柜，内部模块可见
- 镜头：中景推近
- 音频 + 锚点：铰链声 | 中央
- 表演备注：交接到源码。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Engineer 翻开 MIT 源码册，Creator 看见真实结构
- 镜头：左侧近景
- 音频 + 锚点：翻页声 | 左中
- 表演备注：交接到替换。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Creator 拔出模型模块并换入另一块
- 镜头：手部近景
- 音频 + 锚点：模块咔哒 | 机柜中央
- 表演备注：交接到工具。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：Engineer 更换工具连接而专家团配置保持版本化
- 镜头：中景小幅横移
- 音频 + 锚点：连接音 | 左/中
- 表演备注：交接到权限门。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：Reviewer 指向受保护操作，权限钥匙停在用户手前等待
- 镜头：右侧近景
- 音频 + 锚点：音乐制动 | 钥匙右下
- 表演备注：交接到确认。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Creator 明确按下确认后钥匙才转动
- 镜头：极近特写
- 音频 + 锚点：清晰确认咔哒 | 右下
- 表演备注：交接到执行。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：Reviewer 展开记录卷轴，工具调用、参数和结果按时间回放（后期确定性文字）
- 镜头：拉远双人中景
- 音频 + 锚点：卷轴声 | 右侧
- 表演备注：交接到本地环境。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：镜头拉到窗内本机工作室，机柜持续运行
- 镜头：宽景
- 音频 + 锚点：稳定风扇声 | 中央
- 表演备注：交接 S19。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“OpenCorvus 采用 MIT 许可，可自托管、审计和 fork。模型、工具、权限和专家团可定制；不可逆操作先确认，记录全程可回看。”。；SFX：0–1s 铰链声，1–2s 翻页声，2–3s 模块咔哒，3–4s 连接音，4–5s 音乐制动，5–6s 清晰确认咔哒，6–7s 卷轴声，7–8s 稳定风扇声；表演：0–1s Creator 完全打开机柜，内部模块可见，1–2s Engineer 翻开 MIT 源码册，Creator 看见真实结构，2–3s Creator 拔出模型模块并换入另一块，3–4s Engineer 更换工具连接而专家团配置保持版本化，4–5s Reviewer 指向受保护操作，权限钥匙停在用户手前等待，5–6s Creator 明确按下确认后钥匙才转动，6–7s Reviewer 展开记录卷轴，工具调用、参数和结果按时间回放（后期确定性文字），7–8s 镜头拉到窗内本机工作室，机柜持续运行；`narrator-mouth-closed: true`。

## S19 / 8s — 承接 S18 的完整记录卷轴

- **Hook 类型**：reveal
- **场景 & 角色**：scene:Open-Source-Bench | char:Creator-01, char:Agent-Research-01, char:Agent-Reviewer-01
- **空间锚点卡**：
  - 固定地标：Open-Source-Bench 中央机柜、左侧版本差异册、右侧珊瑚确认钥匙、下方回退托盘
  - 人物位置：Creator-01 中央中景、站姿面向版本差异册、右手停在确认键上方；Agent-Research-01 左中景、面向反馈页、双手持新旧版本册；Agent-Reviewer-01 右中景、面向回退托盘、左手指向旧版本
  - 退场人物状态：Agent-Engineer-01 离屏左持工具终端，Agent-Test-01 已连续两镜离屏
  - 光位基线：
- **承接上一镜**：承接 S18 的完整记录卷轴；Creator 提交长期反馈，系统生成新专家团版本与差异、保留回退点并等待确认，用户确认后才安装。
- **交接下一镜**：交接 S20。
- **双绑定**：[char:Creator-01] [char:Agent-Research-01] [char:Agent-Reviewer-01] [scene:Open-Source-Bench] [hook:reveal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Creator 写下“以后训练任务先核对 CUDA 环境”的反馈并交给 Research
- 镜头：双人中景
- 音频 + 锚点：纸张声 | 中央到左
- 表演备注：交接到版本生成。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Research 将反馈装入专家团版本册，旧版保持在左页
- 镜头：小幅推近
- 音频 + 锚点：装订声 | 左中
- 表演备注：交接到新版本。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：新版在右页生成，后期确定性差异只标新增检查步骤
- 镜头：俯拍
- 音频 + 锚点：打印声 | 版本册中央
- 表演备注：交接到 Reviewer。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：Reviewer 对照新旧差异并把旧版复制到回退托盘
- 镜头：右移跟拍
- 音频 + 锚点：托盘咔哒 | 右中
- 表演备注：交接到等待。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：安装动作停在灰色 waiting confirmation，Creator 的手悬在珊瑚键上方
- 镜头：手部特写锁定
- 音频 + 锚点：音乐制动 | 中央
- 表演备注：交接到决定。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Creator 通读差异后按下确认
- 镜头：极近特写
- 音频 + 锚点：清晰确认音 | 确认键中央
- 表演备注：交接到安装。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：新专家团版本装入机柜，旧版仍可见于回退托盘
- 镜头：拉远中景
- 音频 + 锚点：模块锁定声 | 中央/右下
- 表演备注：交接到回执。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：Reviewer 展示安装回执与 rollback locator，三者保持克制确认
- 镜头：静态三人宽景
- 音频 + 锚点：完成提示 | 左中右
- 表演备注：交接 S20。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“长期反馈先形成新版本，显示差异和回退点；只有你确认才安装，旧版仍可恢复。”；SFX：0.5s 纸张，1.5s 装订，2.5s 打印，3.5s 托盘，4–5s silent，5.5s 确认，6.5s 锁定，7.5s 回执；表演：Creator 0–4s 眼线逐行阅读，4–5s 手悬停，5s 主动确认；Research 对准差异，Reviewer 对准回退点；`narrator-mouth-closed: true`。

## S20 / 12s — 从用户确认安装的版本回执匹配切到真实 DeBERTa Proof

- **Hook 类型**：reveal
- **场景 & 角色**：scene:Case-Proof | char:Creator-01, char:Agent-Research-01, char:Agent-Engineer-01
- **空间锚点卡**：
  - 固定地标：Case-Proof 中央 Mission 时间带、左侧 RTX 5090 训练设备、右侧交付台
  - 人物位置：Creator-01 左前景、站姿面向交付台、双手扶项目册；Agent-Research-01 中景、面向 Mission 时间带、左手持来源册；Agent-Engineer-01 右中景、面向 RTX 5090 设备、双手在终端上
  - 退场人物状态：Agent-Reviewer-01 离屏右留在记录位
  - 光位基线：清晨左后暖光 + 训练设备青光
- **承接上一镜**：从用户确认安装的版本回执匹配切到真实 DeBERTa Proof；案例只占一个紧凑镜头。
- **交接下一镜**：交接 S21。
- **双绑定**：[char:Creator-01] [char:Agent-Research-01] [char:Agent-Engineer-01] [scene:Case-Proof] [hook:reveal]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：后期标题 `REAL MISSION · ae773cbff6362f19` 出现于角色上方安全区
- 镜头：宽景锁定
- 音频 + 锚点：低确认音 | 中央
- 表演备注：交接到时间。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：时间带从派发走到 12h45m 收敛
- 镜头：轻推
- 音频 + 锚点：计时声 | 中央下方
- 表演备注：交接到 Task。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：六个 Task 状态依次完成，非截图、无卡片墙
- 镜头：横移
- 音频 + 锚点：六次柔提示 | 桌面
- 表演备注：交接到专家团。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：后期事实 `3 built-in squads · 46 sessions · 20 roles`
- 镜头：Creator 看向运行记录
- 音频 + 锚点：左前 | 中景
- 表演备注：纸卷声；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：RTX 5090 设备运行三组 CUDA 实验
- 镜头：右向左摇
- 音频 + 锚点：风扇声 | 左设备
- 表演备注：交接到网页。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：Research 指向训练监控与推理网页的抽象产物图标，非伪 UI
- 镜头：中景
- 音频 + 锚点：确认音 | 中央
- 表演备注：交接到图表。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：两张真实美化图表缩略图由确定性层进入
- 镜头：小幅推近
- 音频 + 锚点：纸张声 | 右中
- 表演备注：交接到论文。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：五页 ACL 论文装订完成
- 镜头：桌面近景
- 音频 + 锚点：装订声 | 右下
- 表演备注：交接到测试。；narrator-mouth-closed: true

#### 8–9s

- 姿态 + 表情：测试报告与公开仓库回执落到交付台
- 镜头：横移右
- 音频 + 锚点：两次落盘音 | 右侧
- 表演备注：交接到指标。；narrator-mouth-closed: true

#### 9–10s

- 姿态 + 表情：后期指标 `Val Macro-F1 83.43% · Test 83.61%` 清晰停留
- 镜头：镜头锁定
- 音频 + 锚点：单确认音 | 上方安全区
- 表演备注：交接到证据边界。；narrator-mouth-closed: true

#### 10–11s

- 姿态 + 表情：后期小字 `single seed 42 · 1,800 training examples`
- 镜头：角色保持闭嘴、表情克制
- 音频 + 锚点：中央 | 静态中景
- 表演备注：音乐制动；narrator-mouth-closed: true

#### 11–12s

- 姿态 + 表情：实例地址 `github.com/yangheng95/deberta-v3-absa-public-evidence` 出现并保持
- 镜头：慢推
- 音频 + 锚点：发布确认音 | 右下安全区
- 表演备注：交接 S21。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–12s：“真实 DeBERTa Mission 运行 12 小时 45 分，完成 6 个重型 Task，使用 3 个内置专家团、46 个会话、20 种角色；交付 CUDA 实验、网页、图表、五页论文、测试和公开仓库。验证 83.43%，测试 83.61%。”。；SFX：0–1s 低确认音，1–2s 计时声，2–3s 六次柔提示，3–4s 左前，4–5s 风扇声，5–6s 确认音，6–7s 纸张声，7–8s 装订声，8–9s 两次落盘音，9–10s 单确认音，10–11s 中央，11–12s 发布确认音；表演：0–1s 后期标题 `REAL MISSION · ae773cbff6362f19` 出现于角色上方安全区，1–2s 时间带从派发走到 12h45m 收敛，2–3s 六个 Task 状态依次完成，非截图、无卡片墙，3–4s 后期事实 `3 built-in squads · 46 sessions · 20 roles`，4–5s RTX 5090 设备运行三组 CUDA 实验，5–6s Research 指向训练监控与推理网页的抽象产物图标，非伪 UI，6–7s 两张真实美化图表缩略图由确定性层进入，7–8s 五页 ACL 论文装订完成，8–9s 测试报告与公开仓库回执落到交付台，9–10s 后期指标 `Val Macro-F1 83.43% · Test 83.61%` 清晰停留，10–11s 后期小字 `single seed 42 · 1,800 training examples`，11–12s 实例地址 `github.com/yangheng95/deberta-v3-absa-public-evidence` 出现并保持；`narrator-mouth-closed: true`。

## S21 / 8s — 从实例仓库地址的水平线匹配切到个人创作空间的道路

- **Hook 类型**：callback
- **场景 & 角色**：scene:Future-Gallery | char:Creator-01, char:Agent-Research-01, char:Agent-Engineer-01
- **空间锚点卡**：
  - 固定地标：Future-Gallery 中央道路、左侧论文研究台、右侧软件工作台、远端作品集墙
  - 人物位置：Creator-01 中央前景、站姿面向道路、双手合上案例项目；Agent-Research-01 左中景、面向论文台、双手持来源册；Agent-Engineer-01 右中景、面向软件台、双手持终端
  - 退场人物状态：Agent-Reviewer-01 第二镜离屏，Agent-Test-01 留在案例测试台后方
  - 光位基线：正前清晨光 + 左右柔反光
- **承接上一镜**：从实例仓库地址的水平线匹配切到个人创作空间的道路；回到用户未来场景。
- **交接下一镜**：交接 S22。
- **双绑定**：[char:Creator-01] [char:Agent-Research-01] [char:Agent-Engineer-01] [scene:Future-Gallery] [hook:callback]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：Creator 合上案例项目，转向前方道路
- 镜头：中景跟拍
- 音频 + 锚点：箱扣声 | 中央
- 表演备注：交接到论文台。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：左侧论文研究台亮起，Research 望向资料
- 镜头：横移左
- 音频 + 锚点：翻页声 | 左中
- 表演备注：交接到课程项目。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：Creator 经过课程实验台
- 镜头：跟踪回中央
- 音频 + 锚点：工具轻响 | 中央
- 表演备注：交接到开源软件。；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：右侧软件工作台启动，Engineer 打开终端
- 镜头：横移右
- 音频 + 锚点：键盘声 | 右中
- 表演备注：交接到副业应用。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：小型产品原型在前景运转
- 镜头：轻推
- 音频 + 锚点：机械声 | 右前
- 表演备注：交接到作品集。；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：远端作品集墙显示完成项目的形状，不含伪文字
- 镜头：拉远
- 音频 + 锚点：音乐上扬 | 背景中央
- 表演备注：交接到独立研究。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：左后研究设备亮起，Creator 眼神依次扫过所有可能
- 镜头：表情近景
- 音频 + 锚点：轻呼吸 | 中央
- 表演备注：交接到向前。；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：Creator 与两 Agent 朝前迈出同一步
- 镜头：低机位跟拍
- 音频 + 锚点：三组脚步 | 中央
- 表演备注：交接 S22。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–8s：“论文、课程项目、开源软件、副业应用、作品集、独立研究——需要完整工作流，就值得交给 Mission。”。；SFX：0–1s 箱扣声，1–2s 翻页声，2–3s 工具轻响，3–4s 键盘声，4–5s 机械声，5–6s 音乐上扬，6–7s 轻呼吸，7–8s 三组脚步；表演：0–1s Creator 合上案例项目，转向前方道路，1–2s 左侧论文研究台亮起，Research 望向资料，2–3s Creator 经过课程实验台，3–4s 右侧软件工作台启动，Engineer 打开终端，4–5s 小型产品原型在前景运转，5–6s 远端作品集墙显示完成项目的形状，不含伪文字，6–7s 左后研究设备亮起，Creator 眼神依次扫过所有可能，7–8s Creator 与两 Agent 朝前迈出同一步；`narrator-mouth-closed: true`。

## S22 / 10s — 承接三者向前一步

- **Hook 类型**：tender
- **场景 & 角色**：scene:Future-Gallery | char:Creator-01, char:Agent-Research-01, char:Agent-Engineer-01
- **空间锚点卡**：
  - 固定地标：Future-Gallery 拱门中央、道路下方、右侧工作台虚化
  - 人物位置：Creator-01 中央中景、站姿面向前方、双手自然垂下；Agent-Research-01 左中景、站姿面向前方、放大镜收在胸前；Agent-Engineer-01 右中景、站姿面向前方、终端合拢在手中
  - 退场人物状态：Agent-Test-01 第二镜离屏，不再追踪
  - 光位基线：正前明亮主光，Logo 区留白
- **承接上一镜**：承接三者向前一步；片尾从角色回收到信息型品牌构图，最后停留 CTA 与地址。
- **交接下一镜**：结束。
- **双绑定**：[char:Creator-01] [char:Agent-Research-01] [char:Agent-Engineer-01] [scene:Future-Gallery] [hook:tender]

### 每面板四象限内容

#### 0–1s

- 姿态 + 表情：三者停在拱门前，Creator 回头看向来路
- 镜头：宽景锁定
- 音频 + 锚点：脚步停止 | 中央
- 表演备注：交接到情绪回收。；narrator-mouth-closed: true

#### 1–2s

- 姿态 + 表情：Creator 看见远处不再需要亲自搬运的旧笔记，轻笑
- 镜头：表情近景
- 音频 + 锚点：轻呼气 | 中央
- 表演备注：交接到 CTA。；narrator-mouth-closed: true

#### 2–3s

- 姿态 + 表情：后期 CTA `别再给 Agent 当项目经理` 淡入
- 镜头：角色嘴闭
- 音频 + 锚点：上方安全区 | 中景小幅拉远
- 表演备注：音乐制动；narrator-mouth-closed: true

#### 3–4s

- 姿态 + 表情：官方 Logo 从左侧安全区进入，绝不重绘
- 镜头：镜头锁定
- 音频 + 锚点：品牌提示音 | 左上
- 表演备注：交接到官网。；narrator-mouth-closed: true

#### 4–5s

- 姿态 + 表情：`OpenCorvus · Open-source Agent Harness for long-horizon work`
- 镜头：信息从角色动作让位后出现
- 音频 + 锚点：中央上方 | 静态
- 表演备注：无额外 SFX；narrator-mouth-closed: true

#### 5–6s

- 姿态 + 表情：`opencorvus.com` 与 `github.com/yangheng95/opencorvus` 清晰出现
- 镜头：静态
- 音频 + 锚点：轻确认 | 中下
- 表演备注：交接到作者。；narrator-mouth-closed: true

#### 6–7s

- 姿态 + 表情：`Heng Yang · @yangheng95` 出现
- 镜头：角色保持自然呼吸
- 音频 + 锚点：左下 | 静态
- 表演备注：环境风声；narrator-mouth-closed: true

#### 7–8s

- 姿态 + 表情：实例仓库地址出现于右下
- 镜头：静态
- 音频 + 锚点：发布确认 | 右下
- 表演备注：交接到最终口号。；narrator-mouth-closed: true

#### 8–9s

- 姿态 + 表情：Creator 与两 Agent 面向前方，Logo 与信息保持
- 镜头：极慢拉远
- 音频 + 锚点：BGM 最后和弦 | 中央
- 表演备注：交接到停留。；narrator-mouth-closed: true

#### 9–10s

- 姿态 + 表情：全部信息安全停留，无新动作
- 镜头：静态
- 音频 + 锚点：尾音自然衰减 | 品牌安全区
- 表演备注：结束。；narrator-mouth-closed: true

### 完整音频与对白轨

旁白 0–3s：“你需要的不只是更会回答的 Agent，而是把长任务推进到可检查、可验收交付的 Mission。”；3–5s：“OpenCorvus。别再给 Agent 当项目经理。”；5–10s 无旁白；角色嘴闭。；SFX：0–1s 脚步停止，1–2s 轻呼气，2–3s 上方安全区，3–4s 品牌提示音，4–5s 中央上方，5–6s 轻确认，6–7s 左下，7–8s 发布确认，8–9s BGM 最后和弦，9–10s 尾音自然衰减；表演：0–1s 三者停在拱门前，Creator 回头看向来路，1–2s Creator 看见远处不再需要亲自搬运的旧笔记，轻笑，2–3s 后期 CTA `别再给 Agent 当项目经理` 淡入，3–4s 官方 Logo 从左侧安全区进入，绝不重绘，4–5s `OpenCorvus · Open-source Agent Harness for long-horizon work`，5–6s `opencorvus.com` 与 `github.com/yangheng95/opencorvus` 清晰出现，6–7s `Heng Yang · @yangheng95` 出现，7–8s 实例仓库地址出现于右下，8–9s Creator 与两 Agent 面向前方，Logo 与信息保持，9–10s 全部信息安全停留，无新动作；`narrator-mouth-closed: true`。
