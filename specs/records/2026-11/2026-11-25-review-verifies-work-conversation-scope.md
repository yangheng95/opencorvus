# 工作对话切换后的文件审阅核验

## Recall

- 用户要求本人持续分批并行核对产品界面、功能及缺陷，先将实际根因和影响落盘，有证据时实施，再真实桌面操作及截图复核、聚焦检查、范围提交、普通合并并推送。上批 [页头操作反馈](2026-11-25-chat-header-keeps-action-feedback-readable.md) 已验证远端为 `4cb77d9ec`，原 177 项无关工作区状态保留。
- 已读 [面板与审阅合同](../../current/architecture/07-panel.md)、[前次组合搜索](2026-11-23-file-change-combined-search.md)、[搜索结果焦点](2026-11-24-file-review-search-result-focus.md)、`ConversationArtifactSummary`、`ChangesPanel`、`FileChangesView`、`review-focus`、`activeTaskID`、实际工作对话选择入口和工作台标签重置。全仓核对 `scopeKey`、`savedSessionChangeGroups`、`SessionSummary.writeDiff`、`Snapshot.diffFull` 与正式 `/session/:sessionID/conversation`。所查验收路径无界面自动化测试。

## 真正的路径与结果

- 正式开发页 `41810/ui/` 加载 `main-C-xJO_hb.js`。从公开工作对话入口创建 `Release review North`（`ses_hPMjvBo90zqIjbSsM56f`）和 `Release review South`（`ses_hwgoWTFVj3VxcTnmvCER`）。同一自有 Git 项目中分别产生两份真实文件差异，由 `Snapshot.trackRequired`、`Snapshot.diffFull` 和 `SessionSummary.writeDiff` 写入原始归属。正式会话读取 `b23babf3-9e08-4582-bec0-acf2308d9ca5`、`27cf7537-f311-4bb0-bddd-42d088b97451` 确认各自两项和准确正文。[文件、会话与项目回执](../../artifacts/2026-11-25-review-verifies-work-conversation-scope/README.md)
- 实际打开 North 审阅，输入 `b630-review-north.txt` 后显示 1 / 2，选中该条。从工作清单进入 South，已有审阅标签随工作台切换关闭。点击 South 的 `Review changes`，搜索为空，显示 South 的 2 / 2，默认项来自 South。`ChangesPanel` 的 `scopeKey` 只消费 `activeTaskID` 一度提示了假设，但真实的 `selectConversationWithUILifecycle` 在新会话进入时通过 `resetCenterWorkbenchToPrimaryPanel` 清除上一工作台标签；重新打开实际创建当前文件列表。实测排除该正常导航路径上的筛选串用。[切换前后实拍](../../artifacts/2026-11-25-review-verifies-work-conversation-scope/README.md)
- 在 South 以 `b630-review-south.txt` 将列表缩到一条，再在会话摘要点击当前被筛掉的 `b630-review-south-notes.txt`。审阅主动恢复 2 / 2，准确选择 notes 和对应比较。再次筛选 notes，从它的 `Read current file` 打开当前文件，编辑器实拍正文 `South follow-up: keep reviewer notes.`。返回同一会话的审阅标签后查询、1 / 2 计数和选中 notes 均继续保留。当前使用的公开会话读、文件路径、切换和选取符合既有契约。[精确导航和返回实拍](../../artifacts/2026-11-25-review-verifies-work-conversation-scope/README.md)
- 比较前后正式回执 `0e062094-0bc0-4f05-a824-bad31b461518`、`f55c5744-3bd4-457b-87c7-60b9a8022b73` 核对两条原会话、同一所属项目、四个确切路径、原始文本及零消息。实际文件正文与持久记录一致。截图本人复核。比较分组和文字检索共 12 项定向数据检查、14 条断言通过，正式读取服务已正常退出。

## 交付边界

本批交付文件审阅导航与隔离的实测记录。现场另外确认了已知的历史比较能力缺口：四条实际保存的差异虽包含原有 `before`、`after` 字段，界面仍提示保存记录不足以可靠预览。现 `Snapshot.diffFull` 读取真实 Git 文本／非文本状态及端点，输出 `FileDiff` 时没有保留足以区分端点缺失和空文本的事实。消费者把已保存的会话比较投影为明确不完整，当前文件读取仍可用。后续调查须同时核对比较生产者、公开类型和历史数据升级，保持真实证据边界。这一限制与本次实际导航假设不同源。
