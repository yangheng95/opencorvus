# Subagent Conversation Selector Deduplication

## Recall

- 用户要求：截图中两个内容相同的专家团 `work` 项重复展示，需要调整。
- 验收指标：同一子会话只显示一个选择项；选择项展示该会话最新执行状态；不同子会话仍分别可选；底层执行 occurrence（执行轮次）历史保持完整。
- 硬约束：不按显示名称去重，不删除或合并执行历史，不改变子会话 transcript（会话记录）加载接口；不新增、修改或运行 User Interface（用户界面）自动化测试，使用真实页面截图人工复核。
- 已读资料：`AGENTS.md`、用户截图、`packages/overlay/src/components/SubagentConversationPanel.tsx`、`packages/overlay/src/store/conversation-agents.ts`、`packages/overlay/src/components/TaskDirBar.tsx`、`packages/overlay/src/components/SubagentProgressGrid.tsx`、`packages/overlay/src/utils/agent-activity.ts`、`specs/README.md`、`specs/records/2026-08/README.md`。
- 全仓搜索结果：`SubagentConversationPanel` 是右侧“专家团 Agents”会话选择栏的唯一渲染点；`conversationAgentStore.records` 以 input Message 表示执行 occurrence，允许多个 occurrence 共享一个 `sessionID`；`conversationAgentRecordForSourceSession` 已是按 `lastObservedAt`、`startedAt` 选择会话最新 occurrence 的单一公共实现；会话 transcript 路由只接受 `sessionID`。
- 独立 agent 反馈：实施前无；首轮验证通过后按仓库规则执行只读独立审查。

## 问题分析

### 可观察现象

“专家团 Agents”面板顶部连续出现两个名称、头像、状态和内容均相同的 `work` 选择项。点击后加载的是同一段会话内容。

### 直接触发点与根因

`SubagentConversationPanel` 直接执行 `records().map(record => record.sessionID)`。存储记录的身份是执行 occurrence，而面板标签和 transcript 的身份是子会话；当同一子会话发生多个 input Message occurrence 时，同一个 `sessionID` 被重复放入 TabList，产生多个指向相同 transcript 的标签。

### 旧路径未根治原因

底层按 occurrence 保存记录是正确契约，Conversation Agent Rail 也需要逐 occurrence 展示历史。若按 `agentID` 或可见名称去重，会错误合并两个名称相同但会话不同的专家；若在存储层按 `sessionID` 合并，则会破坏执行历史。修复必须位于“会话选择投影”边界。

### 影响面与排除项

- 修改：`SubagentConversationPanel` 的会话 ID 集合、当前记录和菜单计数投影。
- 保持：执行 occurrence 存储、Agent Rail、Task 环境计数、transcript 服务与状态事件。
- 数据迁移、后端协议、公共路由：不适用。
- 风险：同一会话多个 occurrence 状态不同时，标签必须采用最新记录；复用现有 `conversationAgentRecordForSourceSession`，不建立第二套选择规则。

## 实施方案

1. 会话标签 ID 使用保持首次出现顺序的唯一 `sessionID` 集合。
2. 所有标签、菜单项和当前选择记录统一通过 `conversationAgentRecordForSourceSession` 读取该会话最新 occurrence。
3. 溢出菜单的显示条件与计数改用唯一会话数量。
4. 执行 Overlay typecheck、build 和 docs check。
5. 启动隔离真实 Overlay 页面，构造同一会话多 occurrence 的真实 store 状态并截图人工复核；不创建 UI 自动化测试。
6. 委托未参与实现的 agent 只读审查完整差异和验收证据，修复有效问题并重验。

## 验收证据

- `bun run --cwd packages/overlay typecheck`：通过。
- `bun run --cwd packages/overlay build`：通过；仅输出仓库既有第三方 `use client` 与 chunk size 告警。
- `bun run docs:check`：通过，`322 ops, 25 groups`。
- 真实页面：在 `http://127.0.0.1:4179/?acceptance-locale=zh-CN` 启动隔离 Vite Overlay，通过 Node.js + Playwright Core + 本机 Edge 打开当前真实 Work 会话和“专家团 Agents”面板；未创建或运行 User Interface 自动化测试。
- 真实 store 验收输入：注入 3 条 occurrence，其中 `acceptance-input-1` 与 `acceptance-input-2` 共享 `acceptance-worker-session`，另有独立 `acceptance-review-session`；前两条分别为 `completed` 与更新的 `running`。
- 页面查询结果：`labels=["work","review"]`、`sessions=["acceptance-worker-session","acceptance-review-session"]`、`titles=["work · 运行中","review · 空闲"]`，确认 3 条 occurrence 只投影 2 个唯一会话标签，且共享会话采用最新状态。
- 真实页面截图：`.scratch/subagent-selector-deduplicated.png`。人工复核确认原截图红框位置不再连续显示两个相同 `work`；验收期间当前 Work 的实时事件可能另行追加不同 `sessionID` 的真实 `work`，因此精确去重判定以截图前的 `data-session-id` 查询为准，不按名称合并独立会话。
- 隔离 Vite 服务验收后已关闭，并确认 `4179` 不再监听。
- 独立审查：未参与实现的 agent 只读核对了完整差异、occurrence/session 身份边界、最新状态选择、标签与菜单计数/选中态、真实页面查询和截图，并独立复跑 typecheck、build、docs check 与 `git diff --check`；代码无未解决发现。审查发现 `/specs/` 受 ignore 规则影响，提交时必须显式纳入本文件，避免两个 README 索引形成断链。
