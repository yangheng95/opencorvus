# 不同标签页中的对话草稿可各自恢复

## Recall

用户要求本人独立持续分批迭代。每批先复现并分析根因和影响，落盘后实施，实际桌面交互与人工复核截图，运行聚焦正向检查，再按范围提交、普通合并上游、推送。前批离线重试已推送 `b34cb0492`，上下游 0/0，保留原有 177 项工作区状态。当前只处理同源标签页的未发送草稿持久化。使用专用服务、合成对话、真实项目路径和实际浏览器，不调用模型、凭据、用户服务或用户文件。

已读[侧栏文字草稿](2026-11-10-sidebar-local-conversation-drafts.md)、[界面契约](../../current/architecture/07-panel.md)、[实时投影](../../current/architecture/07-panel-reactivity.md)、[控制](../../current/architecture/03-control.md)，以及完整 `composer-draft`、主编辑器和侧对话输入、工作记录行、启动和设置切换。全仓搜索 `oc_composer_drafts_v1`、`setComposerDraftStore`、`setComposerDraft`、`setComposerQuotation`、`captureComposerDraftRevision`、`clearComposerDraftRevision`、`prepareComposerDraftDeparture`、`forgetComposerSubmission`、`moveComposerDraft`、`composerSubmission`、`indexedDB`、`navigator.locks`、`StorageEvent` 及现有测试。浏览器存储规范依据为 [HTML Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html#the-localstorage-attribute) 和 [Indexed Database API（浏览器索引数据库接口）的读写事务调度](https://www.w3.org/TR/IndexedDB/#transaction-scheduling)。

## 复现、根因和影响面

- 实际 `41804/ui/`、`main-BMcmOYAm.js` 与专用进程 `37664`。同源的两个标签页都先打开，在正常 Chat「Draft review Alpha」手动输入 `Alpha draft: reconcile the sample invoices.`，在另一个 Work「Draft review Beta」输入 `Beta draft: verify the second inventory sheet.`。两次输入都标出 Draft，本人截图看到对应正文。第三个新标签页先打开 Alpha，输入框为空，侧栏只剩 Beta 的 Draft；打开 Beta 恢复原句。实际服务数据库保留两条会话，消息、执行任务、模型提供商请求各 0。关闭三页及服务并确认端口释放。[原始桌面证据](../../artifacts/2026-11-24-composer-drafts-across-tabs/README.md)
- 模块初载用 `loadComposerDraftRecords` 读取共享键 `oc_composer_drafts_v1` 一次。后续各写入和删除从自己的 Solid（界面框架）内存映射计算下一份全表，用 `setItem` 或 `removeItem` 直接替换整键。无同源失效通知，也无跨标签读取、计算再写的独占区段。Beta 打开的较早快照中没有 Alpha，其任何一次输入将 Alpha 从持久映射删除。旧的单标签会话切换、重载保留、已提交请求身份以及过期回执保护，都在本页的映射内工作，无法覆盖这个丢失路径。只在写之前再读本地存储也不能保证两个浏览器文档的读、改、写原子。
- 共用入口包括无会话的新输入框及项目范围、Chat 和 Work 会话、Task 和 Mission（任务和多步任务）的输入、侧对话的引用与正文、连续目标引导、工具指令预选、已确认的输入转移，以及工作记录的只读草稿标识。身份按现有键分隔，不能将标签页编号引入真实身份。已确认提交仍只消费捕获的原始草稿修订；取消及重试只处理精确消息身份；已确认连接切换继续按现有契约移除原连接语义并保留作者正文。标准主输入、侧输入、任务绑定、旧版记录字段、最近记录上限与零网络传输都是现有合同。文件编辑器草稿、有独立持久合同的 Mission 表单、文件附件和后端工作记录均不使用这个存储键。
- 这是请求发出前的局部浏览器数据竞争。核查主 Chat、Work、Task、Mission、侧对话的生产提交、取消、重试及回执位置，共用草稿中的提交标识，后端执行轮次、启动、终态和任务请求没有运行或持久异常。并发分析覆盖两个标签页的不同范围、同一范围的旧回执，以及已关闭后从原页面重新进入。输入事件的先后以及是否同一范围由真实操作与既有键决定。需避免修补带来的异步初始化覆盖、先提交后保存、迁移中断丢失、最后一个窗口关闭时挂起的写入和旧页面反向覆盖。

## 实施前方案和验收

- 浏览器本地草稿由一个带版本的索引数据库拥有。打开版本时从旧键一次导入有效条目，提交成功后移除旧存储键。保留正文、引用、已分配的消息身份、时间和范围键。失败或被中止时保留可重试的原始输入；新实现无旧键的双读写。历史版本的已打开页面需要重新加载才能参与新的存储事务，单独记录实际验收范围。
- 将现在所有全表覆盖改成准确的范围操作。同一个读写事务读取最新持久映射并按操作当前契约提交，应用持久结果作为本页可见投影。不同项目、会话、任务及侧对话并行只触及各自目标；已有的跨范围转移、连接脱离和修订消费按其原授权合同在事务内进行。立即响应普通打字所需的本地投影只是进行中操作，应用新持久结果时保留仍待落盘的本页输入。跨页只通知已提交变更，收件页重新读取当前事实，通知不承载草稿正文。
- 接收动作使用提交事务返回的真实请求身份或修订结果。过时的发送回执或取消与已经变动的同一草稿比对。首次加载、旧格式迁移、普通刷新、可靠的关闭和失败后的现有输入可读性均要核对；存储方案不得要求重新配置提供商或改变网络、任务权限和接口。
- 正向检查以现有草稿服务测试为起点，验证合并独立范围、精确清除旧提交和保留新的真实修订、迁移字段、上限、已确认转移和提交重试身份。真实桌面在同一来源验证旧版恢复后的草稿、分别写两条后在新标签打开两条原文、清理一条后另一条保持。独立查公开会话和消息以及本地数据库无提交副作用。按实际完成记录浏览器和原生宿主覆盖；同时运行聚焦类型、文档、构建和相关检查，不运行界面自动化。
