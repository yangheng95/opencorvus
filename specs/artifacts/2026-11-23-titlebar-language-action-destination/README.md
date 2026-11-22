# 视图菜单的目标语言实页证据

独立基线 `40536/ui/` 由真实开发服务提供，入口 `main-Bnc6E267.js`，台式桌面 1280×720，截图本人已逐张查看。没有接触用户窗口或消息。

| 原图 | 实际观察 |
| --- | --- |
| [01 英文视图菜单](01-baseline-en-menu-current-code.jpg) | 只显示 Language 和当前 en-US，无障碍名称也只有 Language |
| [02 Enter 切为中文后的同一菜单](02-baseline-zh-menu-current-code.jpg) | 立即切换全页，原界面显示「语言」及当前 zh-CN |

候选 `40538/ui/` 加载 `main-DHceUq2y.js`。截图同样来自 1280×720 的真实桌面，由本人复核。

| 原图 | 实际观察 |
| --- | --- |
| [03 英文写明简体中文目标](03-candidate-en-menu-chinese-destination.jpg) | 可见动作、双语目标名及完整可访问名称 |
| [04 按 Enter 切换为简中](04-candidate-zh-menu-english-destination.jpg) | 实际全页切为简中，目标立即变为美国英语 |
| [05 简中重载后的外观](05-candidate-zh-reload-retained-preference.jpg) | 原语言选项已持久保存 |
| [06 命令面板读回同一状态](06-candidate-zh-palette-current-language.jpg) | 简体中文是「当前选项」 |
| [07 鼠标切回英文](07-candidate-en-menu-after-mouse-return.jpg) | 界面恢复英文，下次切换目标再次指向简中 |
| [08 重开后的英文外观](08-candidate-en-reload-retained-preference.jpg) | 新标签加载后的设置明确为 English (US) |
