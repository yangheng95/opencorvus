# OpenCorvus Mission · Desktop 技术故事版 V5

状态：`approved for production by user request · 2026-08-24`

## 核心规则

- 全片始终是同一台用户 Desktop：固定浅色壁纸、任务栏、鼠标、窗口风格和桌面图标。
- 不出现真人、卡通角色、渡鸦化身、全屏功能卡、采购表或脱离桌面的动画空间。
- 技术名词必须由桌面问题触发并被 Mission 机制解决；禁止术语墙。
- OpenCorvus UI、Agent 会话、CUDA 页面、推理页、图表、论文和发布信息只使用真实留存证据或确定性文字层。
- 当前 7883/7884 服务离线；本片是基于真实证据重建的 Desktop 叙事，不宣称实时录屏。

## 故事脊柱

用户在桌面输入一个长项目。Agent 很快工作，但 Context Window 被填满，早期 CUDA 约束与测试计划在 compaction 中淡化；Agent 偏离计划并提前结束。用户多开会话，只得到 state fragmentation、duplicated work 与 orphaned dependency。随后用户在同一桌面创建 Mission：目标、约束和验收标准被持久化，Task 依赖决定 waiting/ready/running，完整专家团被版本锁定。服务中断后，同一 occurrence 从 durable state 恢复；下游用 Artifact locator 打开同一文件；独立复核退回缺陷，修复复验后进入 accepted，无法继续则进入 blocked。失败证据进入专家团自进化闭环，先形成候选 revision，再经过差异审查、聚焦验证、rollback 点和用户确认；新任务使用新版本，运行中的 Task 仍锁定旧版本。最后同一桌面展示 DeBERTa Mission 的真实产物与个人长工作流场景。

## 14 场时间线

| 场 | 时长 | Desktop 事件 | 技术主张 |
| --- | ---: | --- | --- |
| D01 | 5s | 桌面启动，打开 OpenCorvus；Logo/官网/作者/仓库作为桌面品牌签名 | 品牌与用户环境 |
| D02 | 18s | 长 Mission 需求在聊天框逐字输入 | 用户意图与硬约束 |
| D03 | 18s | Context Window 填满；CUDA only、run tests、publish repo 被淡化；Agent 提前 Done | compaction、instruction loss、plan drift、premature termination |
| D04 | 16s | 多个会话窗口重复实现、互相等待，用户复制上下文 | state fragmentation、duplicated work、orphaned dependency |
| D05 | 14s | 同一浏览器标签依次展示 WorkBuddy、DeepSeek Harness、Codex、Claude Code 与 OpenCorvus 的重心 | 克制对比，不排名 |
| D06 | 18s | 创建 Mission，目标/约束/验收进入 Persistent Mission Record | persistent goal、acceptance contract |
| D07 | 18s | Mission Overview 与技术 Inspector 同步：Task waiting→ready→running，专家团版本锁定 | dependency、queue、wakeup、squad binding |
| D08 | 18s | 服务断开；终端重启；同一 occurrence 从 step 3/6 恢复，无重复 Task | durable state、resume cursor、no duplicate dispatch |
| D09 | 15s | File Explorer/JSON 查看 Artifact source/path/locator；下一 Agent 会话打开同一文件 | Artifact lineage、locator handoff |
| D10 | 15s | 独立复核重现缺陷并 rejected；修复、测试后 accepted/blocked 收敛 | independent review、terminal convergence |
| D11 | 16s | VS Code 展示“失败证据 → 候选 revision → 验证 → 用户确认”的专家团自进化；保留 diff 与 rollback | Expert Squad Self-Evolution、MIT、自托管、可审计、versioned revision |
| D12 | 25s | Desktop 依次打开真实 Mission、CUDA/网页、图表、论文和 GitHub 回执 | 12h45m、6 Task、3 squads、46 sessions、20 roles、受限指标 |
| D13 | 12s | 桌面出现论文、课程、OSS、副业、作品集、研究文件夹并创建 New Mission | 2C 长工作流场景 |
| D14 | 10s | 回到整洁桌面；品牌、官网、作者、主仓和实例仓库停留 | CTA |

总时长：218 秒（3:38），16:9，中文旁白，最终 1920×1080。

## 真实性边界

- 不宣称其他产品“做不到”，只描述公开工作重心。
- 不宣称保证完成；终态可以是 accepted 或带明确证据的 blocked。
- DeBERTa 指标仅指 single seed 42、1,800 条训练样本预算下的可复验结果。
- OpenCorvus 的 MIT 许可证只绑定主项目，不外推到案例仓库。
