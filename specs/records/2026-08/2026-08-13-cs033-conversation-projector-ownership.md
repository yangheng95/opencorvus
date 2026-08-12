# CS-033 — Conversation projector ownership

## Recall

- 用户要求持续直接修复 code-smell 长清单，并让并行 agent 做独立反证；push 前必须先 fetch 并合并 remote。
- 验收目标：基础 Conversation view 只声明 transcript/ledger 事实，Agent view 单独拥有 execution lifecycle；所有 hydrate/history/session/turn-artifact callers 使用同一清晰合同，公共 HTTP response schema不变。
- 硬约束：一个事实来源；不增加兼容签名、fallback或host gate；聚焦非 UI 正向测试；实现后由未参与 agent 只读复审至PASS。
- 已读资料：审计 CS-033；`conversation/view.ts`；Session/Orchestrator routes；Overlay conversation hydration consumers；timeline/transport message ownership primitives；相关 architecture与现有tests。
- 全仓搜索：`projectConversationView` 只有 `conversation/view.ts` 内部调用和 Session/Orchestrator route调用；部分caller传空 lifecycle，部分传真实events，但实现统一 `void lifecycleEvents`。`projectConversationAgentView` 是唯一读取、排序并投影 execution lifecycle的owner。公共响应同时保留 `view` 与 `agentView`，Overlay分别消费二者；raw events也仍独立返回。
- 独立 agent 反馈：方案PASS。基础projector的lifecycle参数确为纯伪输入；Agent view仍是唯一读取、排序和投影lifecycle的owner；routes的raw events/public response均未丢失或改形。

## 根因与影响面

基础 `projectConversationView(transcript, lifecycleEvents, ledgerSessions)` 的第二个数组参数从未参与输出，但与真实 Agent lifecycle projector具有同名同型语义。调用者因此可以把events传入一个不会消费它们的边界，同时位置参数让ledger ownership也不直观。删除事件流或把lifecycle混入基础投影都会制造事实丢失/双源：events仍是raw replay合同，execution status/error/activity只应由Agent view拥有。

本项只收窄内部投影函数合同和caller装配。`ConversationView`、`ConversationAgentView`、HTTP/OpenAPI/SDK、持久数据与Overlay响应结构均不变；无需migration或生成文件更新。

## 实施方案

1. 将基础projector改为一个命名输入 `{ transcript, ledgerSessions }`，彻底删除 `lifecycleEvents` 参数和 `void` 伪消费；不保留overload。
2. `projectConversationAgentView` 继续是execution lifecycle唯一owner，其内部调用基础projector时只传transcript/ledger。
3. 同步全部Session/Orchestrator hydrate、history、session-page与turn-artifact callers；这些route仍按原合同单独返回raw events和/或Agent view。
4. 新增聚焦正向测试：同一真实typed transcript/ledger生成稳定基础view；同一slice加lifecycle后由Agent view产生exact completed execution，而基础身份/message projection保持一致。

## 正向验收

- `bun test --timeout=0 test/conversation-projector-ownership.test.ts`
- `bun run typecheck`（packages/opencorvus）
- `bun run api:routes-check`
- `bun run docs:check`
- task-owned `git diff --check`
- 独立只读交付复审至PASS。

## Verification Log

- 方案独立复核：PASS，无actionable。
- 实现/验证：完成。基础projector已改为唯一命名输入 `{transcript, ledgerSessions}`，全部Session/Orchestrator callers和Agent view内部调用已迁移，无旧overload。真实typed transcript/ledger+lifecycle测试1/1、2 assertions PASS；OpenCorvus typecheck、routes check、docs check、task-owned diff-check PASS。
- 独立交付复审：PASS。全仓caller均已迁移唯一对象签名；raw events/public shape不变；Agent view仍为唯一lifecycle owner；focused production projector测试与最终diff无actionable。
