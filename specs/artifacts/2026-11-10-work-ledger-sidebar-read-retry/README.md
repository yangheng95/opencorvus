# 左侧工作列表读取重试实页证据

对应[根因和方案](../../records/2026-11/2026-11-10-work-ledger-sidebar-read-retry.md)。基线由本人目视复核首次错误、等待焦点落网页主体、项目恢复、后台刷新保留原项目及两条真实草稿恢复。两条草稿只存在于本批隔离数据库，未启动执行。

- 基线：[冷读等待失焦](baseline-en-cold-retry-loses-focus.jpg)、[详细信息只显示原消息](baseline-en-refresh-diagnostic-only-message.jpg)、[两条草稿恢复仍失焦](baseline-en-refresh-accepted-sidebar-drafts-focus-lost.jpg)；首轮：[完整堆栈被压在窄列](candidate-en-cold-original-stack.jpg)。
- 最终英文：[整卡诊断](final-en-diagnostic-uses-full-card.jpg)、[键盘滚到原堆栈末尾](final-en-keyboard-scrolls-original-diagnostic.jpg)、[等待焦点留在原按钮](final-en-cold-retry-keeps-focus-diagnostic.jpg)、[完整接纳后到 Projects](final-en-accepted-project-heading-and-draft.jpg)。
- 最终中文：[刷新错误和原草稿](final-zh-refresh-error-diagnostic-and-last-draft.jpg)、[等待原焦点和原草稿](final-zh-warm-retry-keeps-draft-and-focus.jpg)、[真实超时保留原草稿及主动移焦](final-zh-timeout-keeps-original-draft-and-search-focus.jpg)、[接纳两条后保持用户搜索焦点](final-zh-accepted-drafts-with-user-search-focus.jpg)。
- [运行回执](receipts.json)包含请求、真实交付字节、耗时、达到截止的未交付响应、两种列表的原行、隔离库和三次关停。
