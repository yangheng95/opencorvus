# 侧栏布局和排序各自是一组单选项

## Recall

- 用户要求本人独立、持续分批调查并先落盘根因和影响，再实现、本人实页和截图复核、聚焦正向检查、范围提交、普通合并上游与推送；不用子代理。第 218 批 `a11e25ba0` 已推送，分支 0/0，177 条原工作区状态逐行一致。
- 已查 `WorkLedger` 整理菜单、现 `checkedMenuIcon`、共享 `DropdownMenu` 与 `Tooltip`、已安装 Kobalte 的 Checkbox/RadioGroup/RadioItem、生产 `ComposerPermissionControl` 的同语义单选、`createPersistedSelectionOwner`、`settings.save/load` 和 Web 宿主。全仓查 `workLedgerOrganization`/`workLedgerSort` 及持久契约、默认值、类型、排序、两语词条、样式和测试；读[配置](../../current/architecture/05-config.md)、[界面架构](../../current/architecture/07-panel.md)、[菜单和解释层 Escape](../2026-10/2026-10-29-menu-escape-ownership.md)及[列表焦点](2026-11-10-sidebar-item-pin-focus.md)。无界面自动化。
- 验收：英文、简体中文实际菜单各展示有名称的布局和排序单选组，每组独立保持一个值；方向键、回车、键盘归还及解释层顺序保持。两个真实项目四段空会话，实际切换分组和可见排序，原阅读会话不跳转，重载恢复两种偏好；没有模型或凭据需求。

## 实施前证据、根因与影响

隔离 `39632/ui/` 的真实基线为 `main-mZqk0FJJ.js`。正式接口注册 `sidebar-layout-review` 项目及三段会话 `Layout first/second/third`，另一个真实项目 `sidebar-layout-secondary` 有 `Secondary layout example`。本人打开 `Layout second`，路由保持 `ses_hxiwRxYNceR9lyTqIIu2`。默认菜单勾选 `By project` 和 `Last updated`；按回车再次激活已勾选 `By project`，它保持选中。方向键选 `In one list` 后分组压平，但排序仍为最近更新；按 End 和回车选 `Created` 后，单列表按 first/second/third/secondary 排列。第一下 Escape 先关闭解释层，仍焦在 `Created`，第二下返回整理按钮。重载同一自有页后，单列表和创建时间同时恢复，同一会话仍选中。三张基线原图已逐张人工复核。

持久契约是两个互相独立的枚举，`by-project`/`one-list`、`priority`/`updated`/`manual`；`createPersistedSelectionOwner` 对重复值保持当前状态。同一组没有“清空”或多选语义。直接根因是五个可操作项各自用 `DropdownMenu.CheckboxItem`，当前安装库输出 `menuitemcheckbox`；视觉标题只是相邻文本，实际辅助功能树没有命名分组。菜单因此向辅助技术暴露五个能独立勾选的选项，而实际只能替换每个组的当前值。此前的菜单 Escape、项目排序和偏好保存解决的是它们各自的行为，没有修正菜单角色。采用 [W3C 的 `menuitemradio` 规范](https://www.w3.org/TR/wai-aria-1.2/#menuitemradio)：同组互斥，多组以独立的 `group` 容器表达。没有宣称基线保存失败或 Escape 失效。

范围只在侧栏整理菜单、显示标题、辅助功能名称和角色、保持原布局密度所需样式。其他菜单、侧栏布局模式与排序规则、会话选择、真实项目、数据和版本均不演进。无新公开接口、持久字段、迁移、权限或发布；未见任何 Task（任务）/Mission（多步任务）/Session（会话）调度、队列、唤醒、恢复或终态异常。风险是分组嵌套改变键盘遍历或解释层关闭次序、切一组选错另一组、意外更改设置保存行为，或菜单高度和焦点可见性退化。

## 实施与验收（修改前）

用已有 `DropdownMenu.RadioGroup` 和 `RadioItem` 分别绑定原两个类型化偏好和原保存所有者，组通过稳定的自身可见标题提供名称。将第一组标题译为 `Layout`／「布局方式」，第二组沿用 `Sort by`／「排序方式」。沿用原提示内容、动作顺序、勾选视觉、间距、菜单保持打开及 Escape 所有权。无第二个值源、无全局键盘改动；局部样式只让两个语义容器维持原间距。

候选独立开发端口复用已关闭的隔离数据。英文实际切换单列表和创建排序，验证目标会话和四条顺序，重载恢复两项；中文检查两组标题、切换排序及分组、两次 Escape 返回当前按钮，并核对当前真实记录。以公开工作记录和会话直读核对两项目、身份、原数据及零消息，聚焦正向的设置和工作记录契约、类型、双语、样式、构建、文档和架构索引。真实视觉截图不使用界面自动化。

## 候选验收

`39633/ui/` 提供 `main-DWJTOas0.js`。英文实际辅助功能树显示命名容器 `Layout` 和 `Sort by`，五个菜单项归于对应组。空格重选默认「按项目」保持现值；方向键和回车选择 `In one list`、End 和回车选择 `Created`，另一组的值不受影响，四条实际会话按 first/second/third/secondary 排列。第一下 Escape 先关闭解释层，第二下将焦点还给整理按钮。重载独立页面，实际仍显示同一四条顺序及 `In one list`、`Created` 的组值，主区会话标识未变。

切到简体中文，同一辅助功能树包含「布局方式」「排序方式」。键盘回车切回「按项目」恢复两个真实项目，仍保持「创建时间」；再依次选择「优先级」「最近更新」，布局不变，焦点在所选项，两次 Escape 后仍回到原整理按钮。全部页面验收维持 `ses_hxiwRxYNceR9lyTqIIu2` 当前，未使用屏幕阅读器语音或验收已安装原生窗口。本人逐张复核三张基线和八张候选原图，并复核[十张裁切归档](../../artifacts/2026-11-10-sidebar-preference-single-choice/README.md)，菜单项、两组标题、选中和键盘焦点清晰，解释层未遮挡当前项。

前后各 11 次真实公开直读按运行时接口结构核对。`workLedger.list` 200 `1150ec57-85d1-46b1-93ec-57b04a185e76` 和 `20df5799-9958-4a73-97e4-96892b24c3df`，两项目和四会话归属、标题、身份、创建/更新时间、置顶值一致，四段消息皆为空。两个自有开发服务正常关闭，无凭据或模型请求。`bun test test/settings-save-transaction.test.ts`（在 `packages/overlay`）9 项、37 个断言通过；Overlay 类型、双语 3123 键、样式令牌、构建和渲染公开面通过；`docs:check`（353 操作、26 组）和 `check:architecture-index`（20 篇）通过。
