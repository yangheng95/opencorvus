# 文件工作台解释链接指向的章节缺失

## Recall

用户要求本人独立持续按批迭代，先落盘根因和影响、再实施、真实桌面交互和人工截图复核、聚焦正向测试、合并上游并正常推送。上批 `061507d4f` 已与远端 `main` 匹配，原工作区 177 项逐条一致。本次只用隔离手册项目，没有模型或凭据依赖。

已读 `FileEditorPane` 的真实文件读取、已接受草稿、最新揭示版次、预览滚动及焦点归属，`TextPart` 文档所有者/唯一章节处理/渲染完成回调、`text-part-model` 工作线程块完成撮合、`Feedback` 原语和工作台样式、`file-workbench` 目标与返回记录、`file-reference` 解析和 `/file/content` 路由。全仓查 `MarkdownRenderedHandler`、`markdownSection`、`previewRevealedRevision`、反馈与现有错误键；完成通知只在 `FileEditorPane` 用于文件章节或文件返回。浏览器、会话文本片段、Notebook（笔记本）和 Presentation（演示文稿）没有这个回调，图像/文档类其他消费者继续走既有入口。核对当前面板架构中的 [章节所有权](../../current/architecture/07-panel.md)、[跨文件标题](2026-11-19-markdown-cross-file-headings.md)、[返回原位置](2026-11-19-markdown-return-to-document.md)、[文档内导航](2026-11-08-markdown-section-navigation.md)。所查范围未发现界面自动化测试。

## 根因与影响（实施前）

Windows 桌面真实 `/ui/` 40472 使用 `main-C75z3Pwu.js`。从 `arrival.md` 的有效链接进入 `warehouse.md#handoff-checklist`，实际将焦点交给 `Handoff checklist` 标题（01）。点击返回后恢复来源链接焦点，Tab 到下一条 `Open the archived checklist`（02），Enter 打开 `warehouse.md` 同一份有效文件，焦点落到整个 Preview，而原三个二级章节中没有 `archived-checklist`，界面没有解释这个回退结果（03）。两份原文件正式读取均为 HTTP（超文本传输协议）200，内容与磁盘原文相同。原图已逐张复核。见[基线证据](../../artifacts/2026-11-23-markdown-missing-linked-section/README.md)。

直接触发是跨文件链接的文件存在，渲染完成后真实标题序列没有目标精确片段。`file-workbench` 已正确保留文件目标、片段及返回位置；`TextPart` 已使用当前文档自己的标题序列和唯一解析器。`MarkdownRenderedHandler` 只回传布尔值，把未命中和不能渲染混成一类；`FileEditorPane` 用两种 `false` 共同进入已有的预览焦点路径，不呈现已打开文件与缺失章节之间的差异。早先修复了解码、重复标题和点返回的位置，无需改动原路径或查找规则。队列、调度、唤醒、重启、Task（任务）/Mission（多步任务）/Session（会话）执行或终态没有参与这条界面导航。

## 实施与验收计划

复用 `TextPart` 的标题查找，给唯一的工作台回调区分已匹配、成功渲染后未匹配、渲染失败。仅由当前已接受的文件、权限来源、揭示版次和实际渲染正文决定即时结果。将查找与移动焦点分离，让晚到的结果在用户已移动焦点时仍能说明状态，继续尊重原焦点保护；同次揭示仍只移交一次焦点，正常文档返回的滚动、焦点归属及链接行为保持。真正未匹配时，用现有非阻塞状态原语显示英中文短句并保持文档可读；不把真实渲染/读取失败映射成缺章。切文档、选择他处、切视图或正文改变时不显示过期结果，当前文本重新渲染后以实际标题更新。只覆盖工作台跨文件片段，不改变同文档锚点、其他 Markdown 使用者、原文写入、接口、发布、数据库、权限设置或模型。

候选从相同真实来源逐条进入有效链接、缺失链接和无章节的普通链接，核对标识、缺失提示、真实焦点、可阅读文件及返回时的来源位置。中文重复缺章/返回；真实修订通过编辑器临时添加确切标题，预览验证重新解析，并沿原草稿流程退出，原文件逐字保留。用聚焦的 `markdown-section`、`file-reference`、`file-workbench-revision` 维持当前匹配、文件身份和返回合同，正常类型、双语、样式令牌、构建、文档及架构检查辅助。截图人工复核，正式文件读、项目身份和隔离数据库核验，按实际启动回执关停，再范围提交和同步推送。真实渲染失败或系统屏幕阅读器只有实际覆盖才计入验收事实。
