# 多步任务草稿的动作可读出所属卡片

## Recall

- 用户要求本人持续分批并行调查、先写根因和影响、再实施、真实桌面和本人截图、聚焦正向测试、范围提交、普通合并上游和推送；不用子代理。上批 `38bd6f02f` 已推送，上游 0/0，原 177 条工作区状态逐行一致。
- 已读 `MissionBoardCard` 的列表/看板共用呈现、`MissionDraftEditDialog`、`mission-board` 的记录合并、真实 `/mission/draft`、草稿更新和执行分发，核对[当前界面架构](../../current/architecture/07-panel.md)、[多步任务表单](2026-11-02-mission-form-validation.md)、[未保存输入保护](2026-11-02-mission-unsaved-input.md)和[列表恢复](2026-11-10-mission-board-read-recovery.md)。全仓查 `mission_board.edit.action`、`mission_board.create.dispatch`/`dispatching`、编辑和开始绑定、组合辅助名称及相关服务检查；没有触及界面自动化。
- 验收：在真实列表和列看板中，两个草稿的「编辑请求」和「开始」各能读出所属原任务；两种语言保留可见动作在名称前、原排列和键盘行为。实际从命名后的入口保存一条隔离草稿，核对另一个原请求、身份和待规划状态。不触发开始或删除，不使用凭据或模型。

## 实施前证据、根因与影响

真实基线 `39638/ui/` 用 `main-CqH1K2i_.js`。公开 `mission.createDraft` 200 `3685ef30-b0c6-4dc6-95d1-fd1119293180` 生成 `Review meeting notes` (`draft-6d598f9ff5c16a2a612ef95cecb806fe`, `ses_hzd5VMpXOWjVr6foF0G2`)；200 `f3f6721e-583f-47ae-b850-8fc147f06d56` 生成 `Check onboarding checklist` (`draft-231c198fcc84802cd9c53bbc8544a12b`, `ses_hTZbpsnMD6YZIPjwbs17`)。原请求不同，两条均未分发。列表中按 Tab 从第一张卡片经过 `Edit request`、`Start` 到第二张，四个实际按钮的名称只有这两个通用词。回车打开第二张的编辑按钮，编辑器正确显示 `Review meeting notes` 与 `Sort the isolated meeting notes by topic.`；Escape 取消后回到第二个仍同名的按钮。切到列看板又得到相同重复名称。本人复核三张真实基线原图，已关闭自有页面和服务。

根因是 `MissionBoardCard` 的标题在既有打开卡片按钮内；编辑和开始各是独立按钮，辅助名称只来自其可见动作文案。视觉位置可以把按钮与标题关联，连续键盘焦点和辅助名称没有这个关系。已有编辑窗口的标题和真实请求到打开后才出现；早先草稿编辑和错误恢复保证的是目标与写入，未关联卡片内按钮的辅助名称。未观察到请求绑定错误、数据丢失或调度、队列、唤醒、恢复、终态异常。

范围是同一个 `MissionBoardCard` 在列表和列看板共用的两个待规划动作；已选入口、右键单目标删除、任务子行、动作实现、实际状态、配置和数据契约不改。用户标题为原文；两语动作沿用当前翻译。相同标题的多步任务身份区分是独立议题，本批有两条不同原名的实证。风险是跨卡片引用、翻译的可见文案不再包含在名称、给布局增加换行或干扰真实焦点和写入。

## 实施与验收（修改前）

为每张卡片的真实标题、编辑和开始可见文字各分配当前组件唯一标识。两按钮用 `aria-labelledby` 首先引用自己的可见动作，再引用同卡片标题；开始等待时自然读原正在开始文案，不维护额外文案或值。参考 [W3C Web Content Accessibility Guidelines（网页内容无障碍指南）的 Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)，可见动作置于可读名称开头。复用真实卡片和对话框，其它视觉、行为及作用范围不变。

候选真实开发网页覆盖英中两布局、逐个键盘焦点名称和本人截图；用英文和中文真实打开不同目标，从其中一个保存新请求，另一个取消，并读回两个正式草稿、会话和零任务/消息。只观察「开始」的真实焦点、名称和可用状态。聚焦已有草稿端到端接口契约与类型、本地化、样式、构建、文档和架构检查；无界面自动化或模型调用。

## 候选实证

在 `39639/ui/` 加载 `main-KD5lrZmM.js`。英文列表实际按 Tab 依次经过 `Edit request Check onboarding checklist`、`Start Check onboarding checklist`、打开第二张卡的按钮和 `Edit request Review meeting notes`。英文列看板两卡名称仍各自正确，焦点可停在 `Start Review meeting notes`。简体中文列表和看板均读出 `编辑请求`、`开始执行` 加对应英文原任务名，动作样式与顺序没有变化。中文列表打开另一草稿可读到 `Review the isolated onboarding checklist.`；Escape 归还到同卡的 `编辑请求 Check onboarding checklist`。本人复核九张基线与候选原图；[选取的画面与边界](../../artifacts/2026-11-10-mission-draft-action-names/README.md)保留真实焦点与保存前后上下文。

英文列表从第二卡的具名按钮真实保存 `Sort the isolated meeting notes by topic, then mark follow-up items.`。正式接口前后各八条均 200：项目、台账、草稿列表、两会话与各自消息、任务列表。保存后 `mission.list` 请求 `ad93ad17-1e49-435d-8ac4-f0989d6b2be5` 与 `workLedger.list` 请求 `0bcd0ff2-e759-4f73-b0be-ac6aeb6aa01d` 对应同一原草稿、会话与项目；另一请求、两会话身份及待规划状态相同；两个会话各零消息、零子任务。两隔离服务和页面都正常关闭。

另观察到保存时焦点先回到第二张编辑按钮，最新活动将该卡重排为首张后落到页面。取消未重排时焦点仍在原按钮。这是独立焦点问题，尚需用旧构建对照和追查渲染时序；本批不把保存后的焦点连续性列为已解决。

`bun test test/server/mission-draft-edit.test.ts test/work-ledger-mission-request.test.ts` 通过（2 项、51 断言），类型、3125 本地化键、9301 样式令牌引用、构建与渲染公开面、文档及架构检查通过。「开始执行」只核对可用动作和名称；不触发执行或模型，不包含安装版原生窗口验收。
