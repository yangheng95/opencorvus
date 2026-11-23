# 关闭对话框后的桌面交接证据

真实 OpenCorvus 开发模式 `/ui/`，桌面视口 1280×720；隔离环境，原图由本人逐张复核。[规格](../../records/2026-11/2026-11-23-dialog-close-keyboard-release.md)

| 基线实拍 | 实际画面和焦点 |
| --- | --- |
| [01 滑块 150%](01-dialog-keyboard-150.jpg) | 实际键盘将滑块调到 150%。 |
| [02 视图保持 150%](02-view-menu-keeps-150-after-escape.jpg) | 关闭后分步打开 View，实际菜单显示 150%。 |
| [03 快速重开视图](03-rapid-reopen-menu-focus-remains-on-trigger.jpg) | 菜单展开但焦点留在标题触发器，方向键没有进入列表。 |
| [04 快速访问帮助](04-rapid-zoom-close-help-focus-result.jpg) | 关闭 Zoom 后紧接 Alt+H，Help 未打开。 |
| [05 分步访问帮助](05-settled-close-then-help-focuses-command.jpg) | 同一帮助命令分步可以打开并聚焦 Documentation。 |
| [06 打开的普通模态](06-ordinary-dialog-retains-own-focus-while-open.jpg) | Alt+H 之后目标输入仍聚焦。 |
| [07 快速退出普通模态](07-ordinary-dialog-rapid-close-help-lost.jpg) | 关闭目标输入后紧接 Alt+H，只回到原启动按钮。 |
| [08 通道原行回焦](08-existing-immediate-channel-return.jpg) | 关闭使用现有即时离场规则的 Telegram 编辑后，回到同一行。 |
| [09 通道快速交还](09-existing-immediate-channel-allows-help.jpg) | Telegram 编辑关闭后快速 Alt+H 正常打开并聚焦帮助菜单。 |

| 候选实拍 | 实际画面和焦点 |
| --- | --- |
| [10 缩放入场](10-candidate-zoom-150-preserves-entry.jpg) | 英文 Zoom 的滑块聚焦并显示 150%。 |
| [11 缩放到帮助](11-candidate-rapid-zoom-close-help-command-focus.jpg) | 连续 Escape、Alt+H 后 Documentation 聚焦。 |
| [12 缩放到视图](12-candidate-rapid-view-reopen-language-focus.jpg) | 快速重开并导航到语言项，数值仍为 150%。 |
| [13 普通模态仍打开](13-candidate-open-modal-keeps-objective-focus.jpg) | Alt+H 后 Objective 仍聚焦。 |
| [14 普通模态关闭](14-candidate-rapid-goal-dialog-close-help-focus.jpg) | 连续 Escape、Alt+H 到 Documentation。 |
| [15 命令面板](15-candidate-command-palette-real-settings-result.jpg) | 查询 `MCP` 返回实际 MCP Connections 设置。 |
| [16 中文缩放](16-candidate-zh-zoom-entry.jpg) | 中文对话框保持 150%，焦点在滑块。 |
| [17 中文鼠标关闭](17-candidate-zh-pointer-close-returns-view.jpg) | 用鼠标关闭后，辅助技术确认回焦视图。 |
| [18 页面重载](18-candidate-reload-keeps-zh-and-150.jpg) | 真实重载后菜单维持简体中文与 150%。 |
| [19 中文通道编辑](19-candidate-zh-telegram-modal-entry.jpg) | Telegram 编辑保留原表单和最初焦点。 |
| [20 中文鼠标取消通道](20-candidate-zh-channel-cancel-same-row-focus.jpg) | 辅助技术确认焦点返回原 Telegram 编辑按钮。 |
| [21 中文通道到帮助](21-candidate-zh-channel-rapid-help-focus.jpg) | 快速关闭后使用文档聚焦。 |
| [22 外层表单](22-candidate-zh-mission-modal-nested-project-list.jpg) | 所属项目输入聚焦，候选当前折叠。 |
| [23 内层候选](23-candidate-zh-mission-project-popup-open.jpg) | 方向键展开真实所属项目候选。 |
| [24 关闭内层](24-candidate-zh-project-popup-escape-keeps-parent.jpg) | 第一次 Escape 只收起候选，保留外层和输入焦点。 |
| [25 关闭外层](25-candidate-zh-close-parent-immediate-help.jpg) | 第二次 Escape 关闭表单，Alt+H 进入使用文档。 |
| [26 即时卸载](26-candidate-immediate-unmount-returns-view.jpg) | 快速只读观测确认对话框已卸载，焦点回到视图。 |
