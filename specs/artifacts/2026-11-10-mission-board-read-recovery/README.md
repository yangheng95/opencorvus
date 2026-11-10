# 多步任务列表重试实页证据

对应[根因和方案](../../records/2026-11/2026-11-10-mission-board-read-recovery.md)。四张真实基线桌面图由本人复核：原错误、等待焦点落网页主体、真实空状态恢复、刷新失败隐藏已读卡片。传输扰动仅作用于本批隔离服务的真实 `GET /mission`；草稿为本批隔离数据。

- 基线：[原解析错误](baseline-en-first-error.jpg)、[等待失焦](baseline-en-first-retry-lost-focus.jpg)、[接受空列表仍失焦](baseline-en-first-accepted-empty-lost-focus.jpg)、[刷新失败隐藏卡片](baseline-en-refresh-hides-accepted-board.jpg)。
- 最终英文：[详细诊断](candidate-en-first-error-details.jpg)、[重试等待焦点](candidate-en-first-retry-pending.jpg)、[空列表与标题焦点](candidate-en-empty-accepted-heading.jpg)、[失败仍保留空列表](candidate-en-refresh-keeps-accepted-empty.jpg)、[接受真实草稿](candidate-en-retry-reads-real-draft.jpg)、[刷新等待焦点](candidate-en-toolbar-refresh-pending.jpg)、[刷新失败仍显示看板和草稿](candidate-en-failed-board-refresh-retains-card.jpg)。
- 最终中文：[展开诊断并保留列表](candidate-zh-list-error-details-retains-card.jpg)。另外两张本人已查看的原图 `candidate-zh-retry-pending-workspace-local.jpg` 和 `candidate-zh-recovered-search-focus-workspace-local.jpg` 显示精确项目、等待和主动移焦，含本机路径，仅留隔离目录。
- [运行回执](receipts.json)包括真实请求标识、传输尺寸、扣留时间、开发服务列表契约、隔离数据库与服务关闭事实。
