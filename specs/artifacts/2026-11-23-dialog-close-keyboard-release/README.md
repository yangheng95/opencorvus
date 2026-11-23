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
