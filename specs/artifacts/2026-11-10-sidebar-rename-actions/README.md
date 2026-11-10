# 侧栏改名和键盘接续的证据

见[调查、范围和验收](../../records/2026-11/2026-11-10-sidebar-rename-actions.md)。下列图从本人直接操作并复核的真实桌面画面裁切；均来自隔离开发服务的 `/ui/`，只包含测试项目及测试记录。

| 画面 | 可见结果 |
| --- | --- |
| [基线对话菜单](01-baseline-keyboard-menu.jpg) | 主区在 `Rename observer`，目标行菜单没有重命名。 |
| [基线双击](02-baseline-double-click.jpg) | 打开改名输入之前已把主区切到 `Rename target`。 |
| [基线多步任务菜单](04-baseline-mission-menu.jpg) | 可下载、置顶和归档，缺少重命名。 |
| [英文项目行菜单](05-candidate-en-chat-menu.jpg) | 键盘焦点在 `Rename conversation`，主区仍是 `Rename observer`。 |
| [英文原名输入](06-candidate-en-chat-dialog.jpg) | 输入选中 `Rename target`，背景仍是观察会话。 |
| [项目行保存与焦点](07-candidate-en-chat-saved-focus.jpg) | 两处显示同一保存结果，焦点回项目行。 |
| [最近行取消与焦点](08-candidate-en-recents-cancel-focus.jpg) | 取消另一个输入名，焦点回最近行，仍显示已保存标题。 |
| [中文多步任务菜单](09-candidate-zh-mission-menu.jpg) | 键盘焦点在「重命名多步任务」。 |
| [中文原名输入](10-candidate-zh-mission-dialog.jpg) | 中文界面保留原草稿名称和当前观察会话。 |
| [中文草稿保存与焦点](11-candidate-zh-mission-saved-focus.jpg) | 项目和最近显示新名，焦点回项目草稿行，主区仍是观察会话。 |
