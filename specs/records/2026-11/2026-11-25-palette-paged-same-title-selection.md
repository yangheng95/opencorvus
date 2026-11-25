# 同名搜索结果翻页时保留会话选择

## Recall

- 用户要求单人持续分批调查，根因和影响先落盘，再改动、进行真实桌面交互、人工复核和聚焦验证，范围提交与正常推送后继续。上批 `8b22e7b7d` 已核对远端，0/0，工作区保留原 177 条状态。上一批针对同名对话的首屏和单个匹配，本批补测标签取决于加载集合的边界。
- 已读 [同名搜索结果](2026-11-25-palette-distinguishes-same-title-conversations.md)、[保留翻页焦点](2026-11-24-palette-continuation-retains-active-result.md)、`CommandPalette.loadLedger`、共享 `ComboboxControl`、正式工作记录分页和 `workLedgerConversationOrdinals`。全仓搜索 `preserveListFocusOnTab`、`optionValue`、`cursorRowKey`、`workLedgerConversationOrdinals` 及工作记录的搜索和草稿检查。使用实际工作会话，无需调度或模型授权。

## 实页、数据与结论

- 在隔离 Windows 项目通过实际工作会话创建入口建立 14 个同标题的 Work（通用工作）对话。当前 `/ui/` 加载 `main-Bsbf8Qbx.js`。第一页展示 12 个同名选项，用实际方向键激活首页最后一条，编号为 `1.`。通过 Tab 进入 Load more（加载更多）并按 Enter 后，两条更早的会话加入，原条目的标签变为 `3.`。输入焦点、同一 `aria-activedescendant` 和约 67.33 像素滚动保持。按 Enter 打开确切原会话 `ses_hveZAMAQzqHfzP8RPY8t`。再次续页后按一次向下和 Enter，正确打开第二页第一条 `ses_hZ2DhauZkSMsvb5IQzrM`。[实页截图与键盘回执](../../artifacts/2026-11-25-palette-paged-same-title-selection/README.md)
- 正式工作记录请求 `77b46967-9f4d-4103-b921-79bc2a6a1f95` 返回 12 条及真实游标，下一页请求 `8be4f4ae-7a11-4632-b14f-bae303bd8b2f` 返回 2 条。拼合次序与一次正式读取 14 条逐字段一致，两次打开均核对到原身份和空消息列表。编号随已加载集合变化，组合框以原结果的稳定身份保有当前项，回车仍走原导航。此场景符合当前分页和选择合同，未发现需改动的行为。未覆盖网络续页错误或模型执行。
- 工作记录搜索与已保存 Mission（多步任务）请求的 9 项聚焦检查及 80 项断言通过，文档与架构索引检查通过。隔离页面和后端已正常关闭。
