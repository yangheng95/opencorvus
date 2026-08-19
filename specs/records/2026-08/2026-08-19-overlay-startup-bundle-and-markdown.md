# Overlay P1 (streaming markdown) and P2 (startup bundle)

## Recall

- User request: 继续做 P1(流式 markdown 的 O(n²))和 P2(2.8 MB 启动 chunk)。
- Acceptance indicators: 用测量决定做什么、做到哪；启动 chunk 明确下降并给出前后数字；不改变渲染语义；测试与类型检查通过。
- Hard constraints: 不新增依赖；不新增 UI 自动化测试；不动用户运行中的应用；保留工作区中他人未提交的改动（`tauri.conf.json`、`titlebar.css`、`packages/web/**`）。
- Read materials: `components/TextPart.tsx`、`components/text-part-model.ts`、`utils/markdown.ts`、`components/InteractiveArtifactPart.tsx`、`components/ConversationArtifactInspector.tsx`、`components/ConfigDialogHost.tsx`、`components/FileEditorPane.tsx`、`components/ui/CodeEditor.tsx`、`vite.config.ts`、构建产物与 sourcemap。
- Independent agent feedback: 无（本会话运行配置禁止调用 Agent 工具）。

## P1 — 结论：原定问题不存在，只剩一处窄暴露

### 先前结论的更正

上一份调查里「流式代码块每次 delta 重解析、800 行累计 11.29 s」是**用合成循环反复调用
`renderMarkdown` 测出来的，不是 app 的真实路径**。真实路径见 `TextPart.tsx`：
`StreamingMarkdownPart` 把文本切块，完成块渲染一次后冻结 DOM，**活动块以纯文本节点显示，
流式期间完全不解析 markdown**。

### 实测（`StreamingTextPartController`，假渲染器计数）

围栏代码块逐行流入：

| 行数 | 全过程总耗时 | 最后一次 flush | markdown 调用次数 |
| --- | --- | --- | --- |
| 100 | 2 ms | 0.018 ms | 0 |
| 800 | 20 ms | 0.032 ms | 0 |
| 1600 | 72 ms | 0.056 ms | 0 |

普通段落流入 1600 行：markdown 恰好调用 1599 次，即每个完成块一次，增量正确。
**流式路径没有需要修的东西。**

### 残留暴露

一次性整篇渲染确实有悬崖，`marked` 本身超线性（2.32 → 8.97 ms/KB）：

| 文档大小 | 整篇 `renderMarkdown` | 按块渲染（会话消息实际走的路径） |
| --- | --- | --- |
| 12 KB | 44.8 ms | 22.7 ms |
| 49 KB | 351 ms | 25.9 ms |
| 98 KB | **1190 ms** | **35.6 ms** |

会话消息已经是按块，所以不受影响。整篇渲染只发生在 `StaticTextPart`，其消费者中只有
`DocumentArtifact`（整篇文档 artifact）可能很大，`MARKDOWN_RENDER_CHAR_LIMIT = 120_000`
意味着最坏约 1.2 s 主线程阻塞。

**没有把 `StaticTextPart` 改成按块**：实测按块会改变 markdown 语义 —— 引用式链接被打断
（`See [the spec][ref].` 原样输出，定义行变成可见文本），跨空行的列表、引用块、脚注同样受影响。
普通正文按块与整篇输出一致。文档查看器要的是保真，这个取舍不能替用户做。
保真且不阻塞的做法是把解析移出主线程（Web Worker），属于独立的一件事，本次未做。

（注：上一轮探针报「102/102 条消息按块渲染结果不同」是探针自身加的去缓存后缀造成的假象，实际普通正文一致。）

## P2 — 启动 chunk 从 2.89 MB 降到 1.70 MB

### 归因方法

用 `--sourcemap` 构建后解析 main chunk 的 sourcemap，按 mapping 段宽度把生成字节归到源模块，
再按 npm 包 / 应用目录聚合。不是猜。

### 归因结果（整改前，2.89 MB）

| 来源 | KB | 占比 |
| --- | --- | --- |
| zod | 251 | 9.8% |
| @codemirror/* 合计 | ~364 | 14% |
| @lezer/* 合计 | ~201 | 8% |
| lightweight-charts | 154 | 6.0% |
| @kobalte/core | 152 | 5.9% |
| highlight.js | 80 | 3.1% |
| @tanstack/table-core | 51 | 2.0% |

### 根因

`InteractiveArtifactPart.tsx` 已经把 13 个 artifact 渲染器做成 `lazy()`，但**另外 7 个是静态引入**
（Document / Table / Candlestick / McpApp / Code / Media / Notebook）。
`ConversationArtifactInspector.tsx` 又静态引入了其中 3 个。这些静态边把
lightweight-charts、@tanstack/table-core，以及经由 Code/Notebook → `CodeEditor` 的
整套 CodeMirror + Lezer 语法都钉在了启动块里 —— 而一个窗口可能整个生命周期都不显示任何 artifact。
`FileEditorPane` 静态引入 `CodeEditor` 是 CodeMirror 的最后一个锚点。
另外 `ConfigDialogHost` 静态引入 15 个设置面板（含仓库里最大的几个文件），而设置对话框只在用户点击后打开。

### 改了什么

1. `ConfigDialogHost` 的 15 个设置面板改 `lazy()`（面板只在对话框打开且切到该 tab 时渲染）。
2. `InteractiveArtifactPart` 剩余 7 个渲染器改 `lazy()`，与同文件既有的 13 个统一为一条策略。
3. `ConversationArtifactInspector` 的 Code / Document / Media 改 `lazy()`，`ArtifactCodeLanguage` 降为 `import type`。
4. `FileEditorPane` 的 `CodeEditor` 改 `lazy()`（该面板为保留状态常驻挂载，按需加载的是编辑器本身）。

全部沿用文件里既有的 `lazy(async () => ({ default: (await import(...)).Named }))` 写法，未引入新机制、未加依赖、未改 `vite.config.ts`。

### 结果

| | 整改前 | 整改后 | 变化 |
| --- | --- | --- | --- |
| 启动 chunk（raw） | 2,885,966 B | 1,702,171 B | **-41%** |
| 启动 chunk（gzip） | 853.7 KB | 477.1 KB | **-44%** |

移出启动路径并各自成块（均已在 main 中被正确引用）：
CodeEditor 644 KB、CandlestickArtifact 164 KB、McpAppArtifact 60 KB、TableArtifact 55 KB，
以及 Document / Code / Media / Notebook 四个薄封装。
剩余启动块中最大项是 zod 250 KB（15.3%）与 @kobalte/core 152 KB，都要动共享包或 UI 基座，收益风险比不划算，未做。

中途试过一次 `FileEditorPane` 单独改 lazy，rollup 明确报「仍被 4 个 artifact 静态引入，不会移出」，
体积零变化，已回退；等 artifact 侧改完后再做才生效。这一步保留在记录里，因为它说明了这类改动的顺序依赖。

## 验证

- `bun run typecheck`：通过。
- `bun run test:unit` 全量：**280 通过 / 0 失败**。
- 产物层面：8 个被改的渲染器各自成块且在 main 中被引用（动态导入接线完好）。
- 隔离运行时加载重建后的产物：静态资源全部 200、**控制台零错误**、零请求泄漏到用户端口。

## 未达成项

- 仍**未取得真实会话的视觉验收**：Overlay 在 Tauri 之外不发 API 请求，拿不到会话页面，
  因而无法在真实渲染中触发这些 lazy artifact。产物层面的成块与引用检查、类型检查、
  单元测试可以证明接线正确，但不能替代「打开一个代码 artifact 看它确实渲染」。
  要补齐需启动 Tauri 桌面外壳，会在用户桌面弹窗，未获授权故未执行。
