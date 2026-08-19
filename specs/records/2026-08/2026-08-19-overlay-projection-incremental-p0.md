# Overlay projection P0: frame coalescing and incremental timeline regrouping

## Recall

- User request: 按调查结论「P0 全做:帧合并 + 投影增量化」整改 overlay 性能。
- Acceptance indicators: 同一份真实语料(`tsk_g00VSiJU3Q003vu16aoq`,1585 条 message/part 事件)重放耗时显著下降并给出前后数字;单条 `message.part.updated` 不再随会话规模线性增长;卡片内容、分段、顺序、状态与整改前逐字段一致;聚焦正向测试通过;typecheck 通过;不新增 UI 自动化测试。
- Hard constraints: 修根因不加旁路;不得引入 fallback 或第二套投影;复用现有 primitive(`createAnimationFrameScheduler`);保留 `packages/overlay/src-tauri/tauri.conf.json` 与 `src/styles/surfaces/titlebar.css` 中他人未提交的改动;不干扰用户运行中的应用。
- Read materials: `services/tree-writer.ts` 全文关键路径(`applyEvent`、`applyVisibleCardTreeEvent`、`deferConversationTreeProjection`、`handleMessageUpdated`、`ensurePartProjection`、`handlePartUpdated`、`handlePartDelta`、`projectPersistedConversationPart`、`upsertPart`、`insertSessionPartByOrderKey`、`regroupTimelineSegments`、`collectTimelineParts`、`rebuildTopLevelOrder`、`syncSessionTopLevelVisibility`、`resetWriter`)、`services/events.ts`、`services/sse.ts`、`services/tauri-transport.ts`、`utils/animation-frame.ts`、`test/tree-writer-review-stream.test.ts`、`test/animation-frame-scheduler.test.ts`。
- Repository search: `regroupTimelineSegments` 共 8 处调用;`rebuildTopLevelOrder` 共 10 处;`applyEvent` 的生产调用点只有 `services/conversation.ts:400`(hydrate/replay,已在 defer 内)与 `services/events.ts:39/44`(直播,未 defer)。`createAnimationFrameScheduler` 已有 10 处使用与专属测试,是既有 primitive。
- Independent agent feedback: 无(本会话运行配置禁止调用 Agent 工具)。

## Analysis

### 为什么 `handlePartUpdated` 的全量重算是纯浪费

`ensurePartProjection` 已经完成了全部定位工作:用 `session.messageCardIDs.get(messageID)` 找到拥有该消息的卡,再由 `upsertPart` 写入。
`upsertPart` 有两条路径,都已是精确的:

- part 已存在 → `setCardTreeStore("cards", cardID, "parts", index, normalizedPart)`,O(1) 原位更新。
- part 是新的 → `insertSessionPartByOrderKey` 按 part orderKey 插到该消息在卡内的连续区段的正确位置,并维护 `partIndex`。

因此当消息**已经**有分段归属时,part 落位后卡片内容已经正确,随后的 `regroupTimelineSegments()` 只是把同样的结果重算一遍并整卡重写。

分段本身只可能在这些时刻变化:新消息出现、消息被移动或删除、interaction 边界变化、以及 part-first 路径**新建**了一个消息投影。前四种分别由 `handleMessageUpdated`、`handleMessageMoved`、`handleMessageRemoved`、`rebuildBoardDerivedCards` 触发,都已各自调用 regroup。只剩 part-first 需要在 `handlePartUpdated` 里触发。

边界(`__boundary__`)不会漏:只有当消息已在 `messageCardIDs` 中时才走快路径,而那意味着它已经被某次 regroup 分过段、边界已经写好;消息不在其中时走的正是 part-first 路径,该路径新建 turn 卡并需要 regroup 结算归属。

`handleMessageUpdated` 早已用 `needsTimelineRegroup = priorMessageCount > 0 || insertsBeforeKnownTail` 做过同类守卫,`projectPersistedConversationPart`(hydrate 路径)也只调 `rebuildTopLevelOrder()` 而不 regroup。本次是把同一条既有约定补到直播 part 路径上,不是新机制。

### 为什么还需要帧合并

即使 part 路径不再 regroup,`message.updated` 仍会 regroup,而一次任务里 `message.updated` 数以百计。
`applyVisibleCardTreeEvent` 用 Solid `batch()` 合并了渲染,但没有合并重算;`events.ts:39` 对每条 SSE 事件直接调一次 `applyTreeWriterEvent`。
传输层两条路径行为不同:`tauri-transport.ts:283` 的 fetch 流会在一个宏任务里同步派发一整个网络分片的全部事件;原生 `EventSource` 每事件一个宏任务。帧窗口对两者都有效,微任务窗口只对前者有效,因此选帧窗口。

`requestAnimationFrame` 回调在同帧的布局与绘制之前执行,所以「窗口内只写入、帧末统一重算」不会让用户看到未结算的中间帧。窗口需要一个定时兜底,因为隐藏窗口不触发 rAF。

## Plan

1. **投影增量化**:`ensurePartProjection` 返回值增加 `createdMessageTurn: boolean`(part-first 分支置 true)。`handlePartUpdated` 仅在该标志为真时 `regroupTimelineSegments()`,否则与非显示 part 一样走 `rebuildTopLevelOrder()`。
2. **帧合并窗口**:在 tree-writer 增加 `openConversationTreeProjectionWindow(run)` —— 首次调用时提升 `projectionDeferralDepth` 并用既有 `createAnimationFrameScheduler` 安排帧末关闭,另加 `PROJECTION_WINDOW_FALLBACK_MS` 定时兜底;窗口内的后续调用直接执行。窗口关闭时走与 `deferConversationTreeProjection` 完全相同的 flush 分支(同一份实现,不复制)。导出 `flushConversationTreeProjectionWindow()`。
3. **接入点**:`events.ts` 的 `writeToTree` 把 `applyTreeWriterEvent(event)` 放进窗口。逐事件的错误处理、`advanceHandledSelectedTaskSequence`、`markHandledSelectedLiveEvent` 语义完全不变——窗口只推迟派生重算,不推迟事件应用。
4. **一致性**:`resetWriter()` 取消窗口;依赖派生顺序/层级的导出读接口(`renderedConversationCardTargetForMessage`)先 flush。
5. **测试**:新增 `test/tree-writer-incremental-projection.test.ts`,用真实事件形状断言(a)已投影消息上的 part 更新落到正确卡的正确下标且不重排其他卡,(b)part-first 事件仍然建卡并结算分段,(c)窗口内多事件只结算一次且帧末结果与逐事件结算逐字段一致。复用 `test/animation-frame-scheduler.test.ts` 的假 rAF 手法。
6. **验收**:同一份 4.1 MB 语料重放,给出整改前后耗时;`bun run test:unit` 相关文件;`typecheck`;`git diff --check`。

## Results

### 改了什么

1. `ensurePartProjection` 增加 `createdMessageTurn`,`handlePartUpdated` 只在该标志为真时 `regroupTimelineSegments()`。
   已投影消息上的 part 由 `upsertPart` 独立完成落位,不再触发全会话重算。
2. `regroupTimelineSegments` 的分段写回改为条件写:先算出 `projectedFields` 与 `rebuiltParts`,
   与既有卡逐字段比较(边界行按值比,其余按引用比),相同则整段跳过 `setCardTreeStore`、
   `refreshMetadataProjectionForCard` 与 `markCardStatsDirty`;需要写时合并为一次写入,
   不再「先写空 parts 再写回」。`partIndex` 无条件重建,与是否跳过写入无关。
3. `applyVisibleCardTreeEvent` 不再每条事件同步 `flushCardStats()`;显示聚合改由
   `createAnimationFrameScheduler`(既有 primitive)在绘制前的那一帧统一结算。
   宿主没有帧时钟时立即结算,行为不变、只是不合并。
4. `card-tree.ts` 新增 `publishCardTreeVisibleNow()`:结算已经发生在将要绘制的那一帧内,
   再走 `markCardTreeVisibleChanged()` 会多等一帧,并可能在聚合结算前先发布投影令牌。

### 实测(真实语料 `tsk_g00VSiJU3Q003vu16aoq`,93 卡 / 987 part)

单条事件延迟(中位数 / p95):

| 事件 | 整改前 | 整改后 |
| --- | --- | --- |
| `message.part.updated`(text) | 8.91 / 10.51 ms | **0.15 / 0.27 ms** |
| `message.part.updated`(tool) | 10.19 / 16.74 ms | **0.21 / 0.41 ms** |
| `message.part.updated`(reasoning) | 0.41 / 0.55 ms | 0.17 / 0.50 ms |
| `message.updated` | 8.72 / 11.23 ms | **2.49 / 5.34 ms** |

整任务重放(1585 条 message/part 事件,按真实到达顺序):

| 每帧事件数 | 整改前 | 整改后 |
| --- | --- | --- |
| 1(最坏,无合并收益) | 9989 ms | 1234 ms |
| 20 | — | 686 ms |
| 60 | — | 583 ms |

regroup 内部占比从 ~1288 ms 降到 ~300 ms;卡片写入 155 次、跳过 6858 次。

### 等价性

用 6 种到达顺序 ×3 种帧粒度(1/20/60)对比整改前后的完整投影快照
(order、每张卡的 kind/stage/status/agentID/title/accent/sessionID/parentSessionID/messageID/
orderKey/time/childIDs/collapsedContextMessageIDs/parts 序列/subtreeCounts,以及
usageAggregate 与 screenshotItems):**全部逐字段一致**。
到达顺序包括 message-then-parts、all-parts-first、parts-before-own-message、
messages-reversed、shuffled、message-updated-repeated。

### 验证

- 新增 `test/tree-writer-incremental-projection.test.ts`(3 个正向测试)。
  其中「只重写一张卡、其余卡保持原 parts 数组」在整改前为 `rewritten=2 / untouched=0`,
  整改后为 `rewritten=1 / untouched=1`,确认这是能咬人的回归护栏。
- `bun run test:unit` 全量:**280 通过 / 0 失败**。
- `bun run typecheck`:通过。

### 未达成项

- **未取得真实页面截图验收**。Overlay 的浏览器宿主路径在 Tauri 之外不会发起任何 API 请求
  (`initApp` 走到 `checkServerConnection` 后无请求、无告警,页面停在「后端无法访问」),
  仓库也没有既有的浏览器验收脚手架。已用隔离运行时(复制 runtime root、独立 7979 端口)
  重建并加载了改动后的产物页面:资源全部 200、**控制台零错误**、零请求泄漏到用户端口,
  但没有渲染出真实会话卡片,因此不能声称完成视觉验收。
  要补齐需启动 Tauri 桌面开发外壳,会在用户桌面弹窗,未获授权故未执行。
- 因此本次结论建立在投影层逐字段等价 + 单元测试 + 类型检查之上,视觉层面未经人工确认。
