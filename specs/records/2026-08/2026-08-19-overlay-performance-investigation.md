# Overlay performance and scalability investigation

## Recall

- User request: 深入调查 overlay 的性能问题；当前 UI 前端既没有考虑 scalability 也没有考虑 performance。
- Acceptance indicators: 用可复现的测量而不是印象给出结论；定位到具体函数与调用路径；给出每个瓶颈的量级、增长规律与影响面；区分「确实写坏了」和「已经做过优化」的部分；产出按收益排序的整改方案。
- Hard constraints: 只调查不改产品代码（用户要的是调查）；不得新增或运行 UI 自动化测试；不得干扰用户正在运行的 0.0.47-beta 应用；保留工作区中他人未提交的改动。
- Read materials: `packages/overlay/src/services/tree-writer.ts`、`services/conversation.ts`、`services/events.ts`、`services/event-policy.ts`、`store/card-tree-stats.ts`、`store/card-tree.ts`、`components/Conversation.tsx`、`components/CardParts.tsx`、`components/TextPart.tsx`、`components/text-part-model.ts`、`components/WorkLedger.tsx`、`utils/markdown.ts`、`utils/icon-html.tsx`、`vite.config.ts`、`package.json`、已构建的 `packages/overlay/dist-vite/**`。
- Measurement corpus: 用户真实任务 `tsk_g00VSiJU3Q003vu16aoq`（日式 RPG 原型）的完整 hydrate 载荷，4.1 MB、69 条 transcript 消息、1350 个 part、496 条协议事件，投影后 92 张卡 / 986 个 part。探针 `overlay-perf-probe.ts` 直接 import 生产模块（`tree-writer`、`event-policy`、`markdown`），在 Bun 中跑真实投影路径，不使用 mock。
- Independent agent feedback: 无（本会话运行配置禁止调用 Agent 工具）。

## Measured results

所有数字为中位数，Bun 1.3.14 / Windows x64，同机重复 15–25 次。

### 1. 实时事件路径：每条事件重算整个会话

| 事件 | 单次耗时（92 卡 / 986 part） |
| --- | --- |
| `message.part.updated`（text） | **12.97 ms** |
| `message.part.updated`（tool） | **10.18 ms** |
| `message.part.updated`（reasoning） | 0.35 ms |
| `message.part.updated`（step-start / step-finish） | 0.01 / 0.03 ms |

- 把这个任务**按真实到达顺序**重放（1585 条 message/part 事件，即用户当时实际看到的直播过程）：
  - 现状，每条一次 `applyEvent`：**4.51 s** 纯主线程投影耗时（不含任何 DOM 渲染、不含 markdown）。
  - 同样的事件按 20 条一帧放进 `deferConversationTreeProjection`：**0.47 s**，**快 10 倍**。
- 同一条事件重复 40 次：逐条 450.3 ms vs 单次 defer 包住 12.2 ms，**快 37 倍**。
- 成本构成（固定消息集、只变 part 总数）：151 part → 5.59 ms，985 part → 10.42 ms。拟合为 **≈5 ms 固定开销 + ≈6.5 µs × 会话总 part 数**。固定开销来自「每张卡整体重写」，可变部分来自「重建每张卡的 parts」。
- 对象身份变化：一条事件后 **92 张卡中有 86 张拿到全新的 `parts` 数组**；单个 part 对象身份不变（858/858 保持）。

### 2. 流式 markdown：活动块每次重解析

`renderMarkdown` 对整段文本做 `marked.parse` + `hljs.highlight`，缓存键是完整原文，因此流式增长时每次都是 miss。

| 场景 | 耗时 |
| --- | --- |
| 12 188 字符的助手消息，冷渲染 | **40.4 ms** |
| 同一段，命中缓存 | 0.08 ms |
| 围栏代码块流式增长时的**单次**重渲染：100 行 / 6.7 KB | 6.9 ms |
| 同上：400 行 / 27 KB | 17.5 ms |
| 同上：800 行 / 55 KB | **38.4 ms** |

按行推进的累计阻塞：100 次 0.23 s，400 次 3.42 s，800 次 **11.29 s** —— 明确的 O(n²)。
`PART_DELTA_FLUSH_INTERVAL_MS = 50` 把 delta 合并成最多 20 次/秒，所以真实代价是
「每秒 20 × 当前活动块渲染耗时」。活动块超过约 500 行时（38 ms × 20 = 760 ms/s）主线程即被打满。
`STREAMING_ACTIVE_TEXT_LIMIT = 12_000` 只截断显示文本，不阻止大块重解析。

### 3. 启动包体

| 项 | 大小 |
| --- | --- |
| `main-*.js`（启动即加载） | **2.82 MB**（gzip 828 KB） |
| `main-*.css` | **545 KB**，3305 条规则 |
| 全部 JS 产物 | 20.9 MB / 166 个 chunk |
| 字体 | 108 个文件 / 4.5 MB（`@fontsource-variable/noto-sans-sc/index.css` 全量引入） |

- 全仓只有 **15 处 `lazy()`，全部是 interactive artifact 渲染器**。settings 面板（≈7000 行）、BrowserPreviewPanel（1926 行）、FileExplorerPanel（1637 行）、WorkLedger、ExpertSquad 市场、Providers、自动化面板等全部静态进入启动 chunk。
- CodeMirror 在启动 chunk 内（`cm-content` / `cm-editor` 标记命中）；xterm 已被拆出。
- `vite.config.ts` 的 `rollupOptions` 没有 `manualChunks`。

## Root cause

`handlePartUpdated`（`tree-writer.ts:1238`）在 part 具有显示内容时调用 `regroupTimelineSegments()`（`:2714`）。
该函数是**全量重算**：排序全部消息 → 重新分段 → `collectTimelineParts()` 遍历
`Object.values(cardTreeStore.cards)` 的每张卡的每个 part → 对**每个 segment** 执行
`setCardTreeStore("cards", id, {...base, parts: []})` 再 `setCardTreeStore(..., "parts", rebuiltParts)`，
并逐卡调用 `refreshMetadataProjectionForCard` 与 `markCardStatsDirty`。
一次只影响一个 part 的事件，代价与**整个会话的规模**成正比，与「变化了什么」无关。

`applyVisibleCardTreeEvent`（`:515`）用 Solid 的 `batch()` 合并了**渲染**，但没有用
`deferConversationTreeProjection` 合并**重算**。`events.ts:39` 的 `writeToTree` 对每条 SSE 事件
直接调一次 `applyTreeWriterEvent`，因此 hydrate 路径享受了 defer 合并（465 事件 49 ms），
而真正高频的直播路径完全没有。

## What is NOT the problem

调查同时确认了以下部分已经做过认真的优化，报告中不应把它们算进「写坏了」：

- `components/Conversation.tsx` 与 `FileChangesView.tsx` 用 `virtua` 做了虚拟滚动。
- `CardParts.tsx` 用 `<Index>` 而非 `<For>`，位置键控吸收了 parts 数组身份变化，未挂载的卡不付代价。
- `store/card-tree-stats.ts` 已经把子树聚合从 O(visible × subtree) 降到 O(depth) 增量维护。
- `components/text-part-model.ts` 对流式文本做了块级冻结，只有活动块重渲染。
- `renderMarkdown` 有 512 条 LRU + 后台 prewarm；`highlight.js` 用 `lib/core` 按需注册语言；`lucide-solid` 是具名可摇树导入。
- `handlePartDelta`（`:1290`）走的是精确路径写 `cards[id].parts[i].text`，O(1)，没有问题。

结论：**瓶颈在数据投影层（tree-writer），不在组件层。**

## Remediation plan (by measured payoff)

1. **P0-a｜直播事件按帧合并**（已测 10×）。在 `events.ts` 的 tree-writer 分发处按
   `requestAnimationFrame` 聚合一批事件，包进一个 `deferConversationTreeProjection`。
   机械改动，风险集中在事件顺序与 rollback 语义，需要针对乱序、跨任务切换、hydrate 竞态的正向测试。
2. **P0-b｜`regroupTimelineSegments` 增量化**。只重算受影响 session 的受影响 segment，
   不重写未变化的卡；`collectTimelineParts` 改为按 messageID 走已有 `partIndex`，
   不再遍历全部卡。目标是把每事件成本从「O(会话规模)」降到「O(变化量)」。
3. **P1｜流式代码块渲染**。围栏未闭合时不做 `hljs.highlight`（或只高亮尾部窗口），
   闭合后一次性高亮；或把高亮移出主线程。目标是消除活动块的 O(n²)。
4. **P2｜启动 chunk 拆分**。settings 面板、BrowserPreview、FileExplorer、CodeMirror 编辑器改 `lazy()`，
   并给 `vite.config.ts` 加 `manualChunks`。目标：启动 chunk < 1 MB。
5. **P3｜字体子集化**。`noto-sans-sc` 全量 4.5 MB，按实际字符集裁剪或按需加载。

## Notes

- 探针脚本保存在会话 scratchpad（`overlay-perf-probe.ts`），未进入仓库；调查过程未修改任何产品代码。
- 工作区中 `packages/overlay/src-tauri/tauri.conf.json` 与 `src/styles/surfaces/titlebar.css` 有他人未提交改动，全程未触碰。
