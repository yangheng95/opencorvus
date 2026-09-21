# 《别再给 Agent 当项目经理》Desktop V5 最终加工稿

本稿由两个互不共享结果的独立 Agent 草稿加工而成：A 版提供 2C 故事节奏、开场、场景收束与 CTA；B 版提供调度、恢复、Artifact、验收、修订和证据边界。唯一机器可读事实源为 `desktop-storyboard-v5.zh-CN.json`。

## 加工原则

1. 同一大纲不变：能干 → 跑不长 → 多 Agent 仍失控 → Mission → 开源 → Proof → 个人场景。
2. 全片始终保留壁纸、任务栏、鼠标和窗口边缘；禁止切成全屏 PPT。
3. 技术词必须贴着可观察现象出现，不单独占屏。
4. D07 使用 B 版的准确调度语义：Queue 是 hint，系统先 reconcile durable facts 并取得 activation lease；Task 创建时冻结专家团 revision。
5. D09 使用 B 版的 Artifact 顺序：source/path/locator → `artifact_read` → `artifact_select`，避免把“看过”和“作为语义来源”混为一谈。
6. D10 保留 accepted 与 blocked-with-evidence 两种诚实终态，不宣传保证完成。
7. D11 把“专家团自进化”放在任务反馈闭环里：失败证据先形成候选 revision，经过 diff、聚焦验证、rollback 点和 compare-and-swap 确认后才安装；新版本服务新任务，不改写已有 Task/occurrence。这不是模型在线漂移，也不是静默改 prompt。
8. D12 只用留存真实证据，并明确 `CAPTURED EVIDENCE · NOT LIVE`；旧 `publication.json` 不能作为当前仓库地址证据。

## 桌面连续性

- 浅灰青壁纸、底部任务栏、左侧项目文件夹和右下时钟固定。
- OpenCorvus、浏览器、终端、VS Code、文件资源管理器共用一致浅色窗口框。
- 鼠标每次移动都连接“要求 → 状态 → 文件 → 验收”的下一环。
- 技术机制重建角标为 `MECHANISM RECONSTRUCTION · 机制重建`。
- 真实证据角标为 `CAPTURED EVIDENCE · 2026-08-24 · NOT LIVE`。
- H3 不重绘任何 UI、文字、代码、Logo 或指标；V5 默认完全使用确定性桌面合成。

## 音频

- 中文离屏旁白按 JSON 场次逐段生成和时长绑定。
- 一条连续电子/钢琴/轻打击音乐床；多会话段节奏变乱，Mission 创建后重新对齐，Proof 段明亮，片尾自然收束。
- UI 点击、键盘、终端、断线、恢复、文件定位、Rejected、测试通过、确认安装均使用克制的确定性音效。

## 交付边界

- 218 秒，1920×1080，H.264/AAC。
- 不宣称实时录屏；当前 7883/7884 离线。
- 不宣称其他工具做不到，只描述工作重心。
- OpenCorvus 的 MIT 只绑定主项目。
- DeBERTa 数字与 single seed 42、1,800 条训练样本预算同屏。
