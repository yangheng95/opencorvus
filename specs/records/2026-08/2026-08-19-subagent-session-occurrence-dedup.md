# Sub-agent surfaces addressed one Session per execution occurrence

## Recall

- User request: 修复子 agent 选择器重复的 bug（在决定不合并 `work-0810` 之后单独修）。
- Acceptance indicators: 同一 Session 只出现一次；查到的记录是最新那次执行而不是最旧的；聚焦正向测试能在修复前咬人；全量单测通过。
- Hard constraints: 不新增 UI 自动化测试（组件渲染/DOM 断言）；保留工作区中他人未提交的改动（`tauri.conf.json`、`titlebar.css`）。
- Read materials: `components/SubagentConversationPanel.tsx`、`utils/subagent-presentation.ts`、`store/conversation-agents.ts`（`conversationAgentRecordForSourceSession`、`conversationAgentIndexForOccurrence`、`hydrateConversationAgentView`）。
- Prior art: `origin/work-0810` 修过选择器这一处（用户已决定不合并该分支，分支已删除）。本次独立复核了根因并扩大到它没覆盖的进度网格。
- Independent agent feedback: 无（本会话运行配置禁止调用 Agent 工具）。

## Defect

`hydrateConversationAgentView` 以 **execution occurrence** 为键建记录（`record.id` 取
`executionID ?? inputMessageID ?? sessionID`），因此一个跑过多次的 Session 会有多条
activity record，`sessionID` 相同。而所有子 agent 界面都是**按 Session** 寻址的
—— 一个 agent 一个 tab、一个溢出菜单项、一块进度网格 tile。两者不匹配，产生两个后果：

1. **重复渲染。** `SubagentConversationPanel` 的 `sessionIDs` 直接
   `records().map(r => r.sessionID)`，重复的 sessionID 就渲染出重复 tab；
   `buildSubagentConversationItems` 同样对每条 record 推一个 timeline 条目，
   进度网格里同一 Session 出现多块。实测：三条 record（`ses_a` 两次执行 + `ses_b`）
   得到 `["ses_a","ses_a","ses_b"]`。
2. **取到陈旧记录。** 面板用 `records().find(...)` 取**第一条**匹配，即最旧的那次执行，
   于是 tab 显示的是那次的状态与目标；而 `buildSubagentConversationItems` 里
   `new Map(records.map(...))` 保留的是**最后一条**。同一语义在两处有两种取舍。

`store/conversation-agents.ts` 的 `conversationAgentIndexForOccurrence` 在不给
occurrence 时已经定义了正确规则——取 `lastObservedAt` 最大、并列时 `startedAt` 更晚的那条——
但这两个界面都没走它。

## Fix

在 `utils/subagent-presentation.ts` 新增纯函数 `subagentSessionRecords(records)`：
每个 Session 保留一条记录，按上述「最新执行」规则取舍，顺序沿用各 Session 的首次出现，
使后到的执行不会重排界面。

- `buildSubagentConversationItems` 先经过它再构建 timeline。
- `SubagentConversationPanel` 以它派生 `sessionRecords` → `sessionIDs`，
  tab、溢出菜单、计数和按 sessionID 的查找全部读同一份去重结果。

去重规则因此只有一处实现，两个界面共用；面板不再需要向 store 单独查询。

## Verification

- 修复前后同一输入对比（一次性探针，未进仓库）：
  `["ses_a","ses_a","ses_b"]` → `["ses_a","ses_b"]`。
- 新增 `test/subagent-session-records.test.ts`（4 个正向测试）：重复 Session 收敛为最新执行、
  `lastObservedAt` 并列时取更晚的 `startedAt`、顺序按首次出现、进度网格只列一次。
- `bun run test:unit` 全量：**284 通过 / 0 失败**。
- `bun run typecheck`：通过。

## 未达成项

- 未取得真实页面视觉验收：Overlay 在 Tauri 之外不发 API 请求，拿不到带子 agent 的真实会话。
  去重逻辑已由纯函数测试覆盖，但「tab 在界面上确实只剩一个」未经人工目视确认。
