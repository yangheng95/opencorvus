# 对话框关闭后立即交还键盘

## Recall

- 用户要求本人独立持续分批迭代，先调查并保存根因与影响，再实现、真实桌面交互、本人截图复核、聚焦正向检查、合并上游并普通推送。第 434 批已推送 `4d6651eff`，两端一致且原 177 条工作区状态完整。本批是界面退场与键盘焦点，不使用 GPT-6.1 Sol、凭据或外部写入。
- 已读 `AGENTS.md`、[现行界面架构](../../current/architecture/07-panel.md)、[菜单关闭交接](2026-11-09-menu-close-keyboard-handoff.md)、[通道编辑关闭](2026-11-09-channel-editor-return-focus.md)、[视图缩放](2026-11-23-view-menu-zoom-focus.md)。全仓查 `hasForegroundDialog`、`.dialog[data-closed]`、`oc-floating-exit`、`onCloseAutoFocus`、`returnFocusTarget`、`channel-editor-dialog`、`openFromKeyboard`、Kobalte 的 `DialogRoot`、`DialogContent`、`createFocusScope`、共享样式和已有正向合同。19 个直接引用共享 Dialog 的界面会继承该样式，此外还有经这些组件打开的间接调用。当前涉及路径未发现界面自动化测试。
- W3C（万维网联盟）规定活动模态对话框承接键盘，Escape 关闭，关闭后向工作流中的适当位置回焦；菜单展开时应可导航其条目。Kobalte 的受控 `open` 是应用的状态来源，原焦点事件继续用于交接。 [模态对话框](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) [菜单](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) [Kobalte 对话框](https://kobalte.dev/docs/core/components/dialog/)

## 现象、根因与范围

1. 隔离开发服务 `40664/ui/` 实际加载 `main-DEZ6r46y.js`。在 1280×720 的英文页面上，缩放滑块由 100% 经 End 到 160%，两次左移得到 150%，单独按 Escape 后视图项也显示 150%。上一批一次不一致没有在这个序列中重现。复现的是快速接续：从 Zoom 按 Escape 紧接 Alt+H，有一轮帮助未展开、焦点回到 View；分开按时 Help 打开，Documentation 立即聚焦。快速 Escape、Alt+V、End、Up 的一轮中 View 已展开，但焦点停在标题按钮，独立再按 End、Down 也未导航到菜单项。该形态在基线存在，具体第二次焦点争用发生的浏览器事件顺序未知。 [基线实拍](../../artifacts/2026-11-23-dialog-close-keyboard-release/README.md)
2. 快速 Escape 关闭 Zoom 后即时只读页面记录显示原 `.dialog` 仍挂载，`data-closed=true`、`data-expanded=false`、`aria-modal=true`，实际计算的 `animationName=oc-floating-exit`、`animationDuration=0.08s`，焦点仍在原 Zoom 滑块。共享 `dialog.css` 为内容和遮罩都配置退场动画。Kobalte `createPresence` 分别控制挂载，内容卸载时才调度 `createFocusScope` 的归还焦点。与此同时标题栏的快捷键和原生菜单路由根据仍挂载的 `.dialog` 判断前台对话框。按键落入退场窗口时仍被关闭的界面占用。仅修改标题栏条件会让退场层、原控件和共享焦点继续挂载，无法修复其本身；B431 只修复视图菜单到缩放的打开交接，既有菜单退场修复也只覆盖菜单。
3. 同一输入节奏从「Create a continuous goal」按 Escape 后 Alt+H 也有丢失，无模型、任务或目标提交。打开时 Alt+H 保留原 Objective 焦点，证明阻止活动模态的行为仍需保留。现有通道编辑正好已用局部规则关闭退出动画。Telegram 编辑按 Escape 后即时观测为 `dialogs=[]` 并返回原行，紧接 Alt+H 进入 Documentation。这个应用现有对照支持在共同样式修复挂载所有权，而不是改快捷键路由或添加等待。
4. 影响为共享对话框内容/背景的离场呈现、键盘和指针交接、单层与嵌套关闭时序、命令面板、标题栏和既有通道局部退出规则。保留进入动画和对减少动态效果的支持，保留现有按钮、Escape、背景、打开及原回焦语义。移除仅用于废弃局部退出规则的 `channel-editor-dialog` 样式和两处挂接。Popovers（浮出面板）和 Selects（选择器）的动画仍由自身现有规则驱动。主题、语言、缩放偏好数据，API（应用程序接口）、数据库和配置写入、原生权限、版本发布、Task（任务）／Mission（多步任务）／Session（会话）运行与队列、并发、重启和终态不涉及，基线没有启动执行轮次。

## 实施与验收

- 在共享 `dialog.css` 删除内容与背景的关闭动画，从同一当前机制即时卸载并交还键盘。同步删除通道专用覆盖及其唯一类名，并更新公开界面架构。保留当前通用对话框和 Kobalte 的单一焦点协议。若实际候选仍复现已展开却失焦，先补同一规格的根因证据再决定是否追加修改。
- 与基线同一真实桌面和近似连续节奏验证缩放对话框关闭后快速 Alt+V／Alt+H，方向键能进入条目并在正确视图执行后续动作，150% 保持且重载一致。验证普通目标对话框打开时保有键盘并关闭后放行，继续覆盖通道原行回焦及快速标题菜单、中文桌面、Esc 与鼠标关闭。检查共享层中适用的代表性嵌套和命令面板路径。截图逐张由本人复核，并使用正式项目接口与存储确认隔离数据。聚焦菜单就绪与语言偏好正向合同，类型、国际化、样式、构建、文档和架构索引。没有非界面逻辑或协议变化。验收后关停自有实例、提交、同步并普通推送。

## 结果

- 候选 `40666/ui/` 载入 `main-oAexEKuY.js`。从 Zoom 按 Escape 紧接 Alt+H 时，帮助打开且 Documentation 已聚焦。重走 Escape、Alt+V、End、Up，实际焦点到语言项，视图仍显示 150%。关闭瞬间只读观测为 `dialogs=[]`，焦点在「视图」。鼠标关闭也回到同一按钮。通过视图操作切换简体中文，页面重载后实页同时保持中文与 150%。
- 打开的普通目标表单依然将焦点保留在 Objective，关闭之后紧接 Alt+H 进入帮助。命令面板真实搜索返回 MCP Connections（模型上下文协议连接），关闭后可继续通过视图执行语言动作。中文 Telegram 编辑取消后回到原行，Escape 后紧接 Alt+H 可进入使用文档项。多步任务对话框里的项目候选保持可导航，第一次 Escape 仅关闭其候选层，第二次 Escape 关闭外层，紧接 Alt+H 到使用文档项。本人逐张复核 26 张[真实桌面截图](../../artifacts/2026-11-23-dialog-close-keyboard-release/README.md)。
- 两个正式项目接口识别同一准确目录。两份正式通道列表各 27 条，完整响应逐字符相同，Telegram 为 `missing/disabled`，多步任务均为空。已提交的 77 字节项目说明与磁盘完全一致。两份 SQLite 数据库完整性检查通过，会话、消息和三类模型提供商记录均为零。各服务经自身关停接口退出，端口已释放。
- 菜单就绪与语言持久化聚焦测试共 8 项、19 断言通过。Overlay 类型、3277 条界面语言键、9348 处样式令牌引用、真实构建和渲染公开面、接口文档、架构索引均通过。验收覆盖 Windows 上的真实桌面开发页面。未实拍安装版、macOS 系统菜单或全部对话框，也未启动多步任务、写入通道配置或调用模型。
