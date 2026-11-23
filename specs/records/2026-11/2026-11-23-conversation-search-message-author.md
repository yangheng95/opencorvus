# 对话内查找使用原消息一致的作者显示

## Recall

用户要求本人独立连续分批迭代 OpenCorvus。先记录证据、根因、影响及方案，随后修复、真实桌面验收和截图复核、聚焦正向验证、提交、合并上游和普通推送。上一批远端 `main` 的 `dfdf89718c7ccda770d5ee37629ed9e932e0ff2a` 已确认，本地原 177 条状态逐项一致。只操作自建回环服务、隔离项目和专用页面，无 Provider 凭据。

已读 `ConversationSearchDialog`、`conversation-search`、`conversation-snapshot`、`conversation-export`、`ComboboxControl`、`ChatBubble`、`utils/message`、`tree-writer` 中分段边界、`App` 标题和快捷键、两语言角色目录、Session（会话）导出与 Task（任务）转录接口、隔离验收的对话创建和真实 Shell 输入。全仓核对 `ConversationSearchHit`、`readConversationSnapshot`、`readTaskConversationSnapshot`、`findConversationMessages`、`agentIdentityLabel` 和 `continuous_goal.controller`，以及[原搜索读取状态](2026-11-10-conversation-search-read-status.md)、架构 07-panel 与聚焦搜索、转录、导出测试。所查范围没有界面自动化测试。

## 根因与影响（实施前）

`40604/ui/` 基线加载 `main-C96Dvviq.js`。用正式 `POST /coding/chat/session` 创建隔离对话，以真实 `POST /session/:id/shell` 执行仅输出文本的 `echo Copper note receipt 420`。Shell 返回退出码 0；项目内正式导出返回用户输入 `msg_ReviewCopper420baseline`（`role=user, author=user`），及自然产生的 Shell 结果（`role=assistant, author=chat`）。本地检查最初误把含标准退出元数据的工具结果当纯文本；实际导出核对后按原输出首行和独立退出码重新验收。同一请求身份复读得到同一对消息。验收使用明确的无凭据占位模型标识作为 Shell 记录元数据，不调用模型。隔离项目没有配置记忆模型，出现明确的记忆配置通知，已在基线页面关闭；运行范围在收尾再次核对。

英文真实原消息卡显示 `User`，查找同一消息却显示小写 `user`。切换简体中文，原消息为「用户」，同一结果的可见文字和无障碍选项仍读到 `user`，日期、计数和正文则正确。用真实结果进入原消息成功，表明搜索、结果身份和跳转与显示问题可区分。本人逐张查看四张截图。[基线证据](../../artifacts/2026-11-23-conversation-search-message-author/README.md)

快照已校验原始消息 `role` 及 `author`，现有结果保留 `author` 但不向呈现层传递 `role`，窗口把协议作者直接渲染。原消息卡已经翻译直接用户和持续目标控制器，并保存协调者的原身份；同一个协议 `role=user` 也用于其他参与者发起的输入，不能因属于输入角色便统称「用户」。既有搜索读取修复处理快照、失败和加载状态，未修改结果作者。影响限 Task、Session 共用查找结果的可见及无障碍作者标签，以及共用原消息卡作者计算。保留原始作者、消息和来源身份、正文、排序、导出、结果定位、项目边界、执行、调度、队列和恢复。只有搜索内的作者呈现变化，原消息卡沿用现有规则。没有接口、数据格式、配置或发布变动。

## 方案与验收

让结果读取已在快照校验的 `role` 及原 `author`，使用原消息卡的用户作者规则，原规则移入既有消息显示工具供两处引用。直接人类发送者显示当前语言用户名称；已声明的持续目标控制器沿用气泡原语言，其他确切参与者继续显示真实身份。把同一作者显示值提供给选项的可见标签和现有键盘公告，匹配正文和定位仍用真实快照。风险是把协调输入误标成人类用户、翻译原标识、泄漏变化到导出或改变结果标识。

候选 `40606/ui/` 通过同一正式隔离流程写入真实对话历史。分别实测中英文当前结果的可见/无障碍作者、原文和计数、键盘选中及精确定位、由当前标题控制返回焦点。聚焦正向检查覆盖普通人类、协调者输入和真正参与者角色/作者、共享 Task 转录、完整导出和查找来源。类型、双语、正式构建、文档和架构检查。核对两个数据库只含自己的预期对话、Shell 消息与真实输出，无模型使用和其它项目，核验专用服务正常退出，范围提交并合并后普通推送。
