# 工作区导航提示的绘制层

## Recall

- 用户要求本人独立持续按批迭代，先真实体验、落盘根因与影响，再实施、真实桌面输入、人工截图复核、聚焦正向检查、范围提交、合并上游和普通推送。第 435 批 `6954f0d28` 已推送，原 177 条工作区状态一致。本批为导航提示的可见层级，无凭据和 GPT-6.1 Sol 调用需求。
- 已读 `AGENTS.md`、[当前界面架构](../../current/architecture/07-panel.md)、[上一批对话框交接](2026-11-23-dialog-close-keyboard-release.md)、工作台导航 `WorkLedgerNavigationAction`、App 的左栏与设置页、共享 Tooltip、Kobalte Popper 的定位层、菜单以及 `activity.css`、`titlebar.css`、`tooltip.css`、`design-language.css`。搜索六个导航组件调用、`work-ledger-*-tooltip`、公共 `.oc-tooltip`、`--ui-z-overlay`、`--ui-z-titlebar`、`--ui-z-dialog` 及标题菜单配置和聚焦合同。所触及路径未发现用户界面自动化测试。
- 参考 W3C（万维网联盟）的悬停与聚焦提示指引及层叠绘制顺序。此次保留提示的触发、存续和可访问描述，校正导航提示的适当绘制层。 [悬停或聚焦内容](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) [层叠顺序](https://www.w3.org/TR/CSS22/visuren.html#z-index)

## 根因与影响

1. 真实隔离开发页 `40668/ui/` 加载 `main-oAexEKuY.js`。英文 1280×720、150% 缩放，鼠标点击 Tasks 后常驻在原位置，提示完整可读。立即按 Alt+H 时 Help 打开，Documentation 聚焦；提示盖住 Open Logs 和 About 的文字区。按 End 已聚焦 About，但仍看不到文字。直接读到 Help 内容和定位容器层均为 `10000`，提示内容和定位容器层均为 `10002`，提示不参与指针命中。两框分别为 `237,51,414,207` 与 `98,133,420,105`，实际宽 281 像素的相交区域由提示盖住菜单。另一真实入口 Scheduled 的同一现象让已聚焦的 About 被遮住，在设置页面也会发生。 [基线实拍](../../artifacts/2026-11-23-navigation-tooltip-workspace-layer/README.md)
2. WorkLedger 导航的六个入口都使用非模态的工作区导航提示，提示经 Kobalte Portal 和 Popper 提升到同一顶级宿主。共用 Tooltip 默认层用于也可能出现在活动对话框内的提示，因此它在 `--ui-z-dialog` 之上。Kobalte 按所挂载提示内容的计算样式设置定位容器层。鼠标仍悬停时键盘打开标题菜单，非模态标题菜单不解除背景悬停，提示仍合理存在，但按错误的高层角色绘制。B435 修复的是关闭后键盘焦点和挂载，帮助菜单本批已经能够正常建立焦点，未改变这个绘制顺序。
3. 同样从 Tasks 打开的普通多步任务模态能清理提示，从 Scheduled 打开的左栏 More（更多）下拉也只保留自身菜单并聚焦 Archive。Chats 那次打开 View 时提示未出现，是独立的界面对照。没有证据表明需要改变共用 Tooltip、消除悬停状态、改菜单焦点或普遍抬高菜单。此次范围为复用 `WorkLedgerNavigationAction` 的提示，包括项目侧 New chat 与左栏 Tasks、Scheduled、Chats、Expert Squads、Settings。单独的卡片、行状态、对话框内提示、更多菜单、标题栏和工具提示公共实现使用原层级。桌面设置、任务和定时列表只有读取和视图选择，未发起运行、写入配置或出现任务、队列、唤醒、恢复和终态异常。服务、公开协议、持久数据和发布无需改动。

## 实施与验收

- 将 WorkLedger 导航提示显式标记为工作区覆盖层，使用现有 `--ui-z-overlay`，位于应用正文之上、前台标题菜单之下。保留 Tooltip 的真实生命周期、描述、停留、定位和非命中语义。更新当前界面架构。没有新层级常量、额外状态或事件处理。
- 候选在真实桌面复核两条基线路径，显式以方向键聚焦和操作 Help About，菜单完整可读。确认提示在没有前台菜单且仍悬停时完整显示，并观察真实位置、内容及定位容器层。复核英文和中文、高缩放与常规桌面、至少一个左侧独立 More 菜单或普通模态。聚焦原导航和菜单非界面合同、类型、国际化、样式、构建及文档。正式项目读取、数据库及 Git 原文件核对确保测试范围。完毕关停自有端口、提交、合并上游并推送。
