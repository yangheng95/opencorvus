# 对话快照读取期限和重试诊断

## Recall

- 用户要求持续分批、本人独立，先保存根因和影响，再实施、真实桌面及截图复核、聚焦正向检查、清晰提交、上游合并和普通推送。本批在两个隔离项目使用正式入口创建的空 Chat/Work（对话/通用工作），不执行模型。查找和导出的成功、读取超时、显式取消、原查询重试和下载都可在这类输入中观察。
- 已读 `AGENTS.md`、`07-panel.md` 对话查找与导出、[查找读取状态](2026-11-10-conversation-search-read-status.md)、[导出反馈](2026-11-10-conversation-export-feedback.md)、[工作列表读取期限](2026-11-09-work-ledger-list-read-deadline.md)。全仓查 `ConversationSearchDialog`、`App.exportConversation`、`readConversationSnapshot`、`readTaskConversationSnapshot`、`export.session`、`task.transcript`、`apiJsonWithTimeout`、`transportRequestSignal`、`serverSettledRequest` 及现有读路径测试。应用直接读会话导出有查找和下载两个入口；独立 Task（任务）查找使用原转录入口，Task 导出路由已退役。此批不扩大到其它操作的超时策略。

## 根因与影响

1. 真实 `39841/ui` 连接 `39840`，使用 `main-tLs2f8PF.js`。代理持有原 Chat 的真实导出 HTTP（Hypertext Transfer Protocol，超文本传输协议）200 响应。查找 `374e5b89-3766-4ad9-ad18-755b43d71e88` 在超过 16 秒仍显示 Loading，输入保持、刷新不可用，直到按 Escape 才由客户端关闭，焦点回到原标题菜单。通过同菜单导出 JSON（JavaScript Object Notation，结构化文本格式）得到独立 `1e2cc6bb-87dc-4bf8-a140-16290aadddfc`，同样超过 16 秒仍等待，切换另一项目 Work 后原读取关闭。两份已生成的响应都来自原会话且消息为零。[基线桌面和请求](../../artifacts/2026-11-12-conversation-snapshot-read-deadline/README.md)
2. 两个入口都将连接和选择所有者的 `AbortController.signal` 直接传给 `apiJson`。`transportRequestSignal` 在调用者已有信号时直接使用它，因此绕过常规 15 秒读取期限。Task 查找在同函数采用相同调用形状。现有取消和请求归属机制正确处理离开或关闭，无法在使用者留在当前页面时诊断未收敛读取。运行执行、停止等 `serverSettledRequest` 的响应完成语义独立且不变。
3. 另一项目 Work 查找的真实 200 `75dbebd1-fc53-4a2a-ba60-92e935214528` 截断后展开原诊断。开始原目标重试 `3e35f4f4-fa45-48f1-b902-3f0b30f1f0d4` 后，按钮仍为 Retry，但详情消失、布局缩短；完整回复确认真实空记录。当前判别状态用布尔值保留重试按钮标签，读取中未携带原诊断供 Feedback 显示。
4. 影响为对话查找、原会话导出菜单的网络读期限、诊断和手工重试。后端快照、导出格式、选择和取消、工作项身份、下载手交、数据库结构及运行事件无变更。未见任务调度、轮次、恢复或终态异常。风险为截止错误与关闭混淆、错误挤压重试、跨项目读取或错误下载，按真实隔离响应验证。

## 实施与验收

- 复用现有标准读期限和 `apiJsonWithTimeout`（合并限时与调用者取消）。会话导出和查找共用一个真实会话快照读取，任务查找的转录采用同期限和原目录/所有者。保持当前数据校验、导出格式和连接保护。显式关闭或换会话继续提前退休原请求，超时则由原入口反馈及允许手工重试。
- 在查找读取中的判别状态保留上一读取失败的诊断，重试使用同一按钮和已展开详情，成功后显示已确认结果。复验英文 Chat 的查找、原查询重试、正常及超时的真实导出和本地下载，中文 Work 查找截断和原诊断、明确关闭和同目录验证。任务读取按同一纯服务路径做正向合同检查，桌面边界在验收中说明。用实时接口合同、真实前后数据和 SQLite（嵌入式数据库）对账，执行现搜索/导出聚焦检查、构建、类型、两语言和文档。

## 首轮候选复核

真实 `main-Cm2oHPnN.js` 到达期限后出现 Retry 并保留查询。展开详情时，`apiJsonWithTimeout` 的通用包装显示 `Error`、完整百分号编码路径和 `signal timed out`，遮住浏览器原 `TimeoutError` 类型且扩大了诊断内容。快照读取改用同一标准期限和既有 `mergeAbortSignals`，将组合信号交给 `apiJson`，保留原错误对象。三种读取的正向合同都改为直接核对原类型和原因。最终候选重做超时、在途反馈和完整路径复验。

## 最终验收

- 最终 `39845/ui` 使用 `main-DyGL8tCT.js`、连接独立 `39844`。英文查找 `57c658c2-9eef-4ce2-aaea-3b1d3657a752` 与导出 `63532878-fc17-443f-acd9-e671d28b4ca4` 在真实回复分别被持有 15.018 秒和 15.013 秒后终止，详情直接显示 `TimeoutError: signal timed out`。查找保留原查询和已展开的诊断，重试等待时原按钮仍持有焦点，额外 Enter 与 Space 只有一笔在途读 `807c4754-ce73-44e6-9b74-44a54df7ad9d`，完整回执才显示真实 `0`。明确 Escape 和切换会话分别于 41、134 毫秒提前终止原请求。[截图与正式响应](../../artifacts/2026-11-12-conversation-snapshot-read-deadline/README.md)
- 实际通过菜单重试 JSON 导出 `901be17f-ece7-4e16-98ba-1afbfde80ae7`，浏览器下载文件名为 `Conversation deadline review - ses_hEb3GuOmQc8b3qzqmQ4o.json`，内容逐字段等于正式同会话快照。中文 Work 查找截断后，原 `TypeError` 在重试期间仍展开可见，`a9b1caca-0748-4ff8-a856-328711a5a67a` 返回该项目的真实空会话。使用另一项目读取 Chat 得到正式 `NotFoundError`；两条原会话的标识、目录、项目、标题与时间完全保持。SQLite 完整性检查通过，零消息、任务和模型请求。
- 界面端快照期限、查找及导出正向契约 24 项、核心导出身份 3 项通过。最终构建、类型、双语字典、文档和架构索引通过，本人复核所列截图。桌面仅使用隔离 Chat/Work。Task 转录的目录、期限与完整读取通过聚焦服务合同，本批未启动任务或模型。
