# Shell 输出阅读与完整回执桌面证据

以下三张基线来自真实隔离入口 `40616/ui/`。

| 画面 | 观察 |
| --- | --- |
| [01 静默成功命令](01-baseline-en-silent-command-shows-receipt-as-output.jpg) | 原生命令静默，输出区仍显示机器退出记录。 |
| [02 非零退出有输出](02-baseline-en-nonzero-output-mixed-with-receipt.jpg) | 实际文本与追加退出字段混在同一完整正文。 |
| [03 同名标记确切输出](03-baseline-en-literal-output-and-receipt-both-visible.jpg) | 第一段是命令真实打印，第二段由正式回执追加。 |

八张候选图来自 `40618/ui/`，由本人交互并复核。

| 画面 | 观察 |
| --- | --- |
| [04 英文静默阅读](04-candidate-en-silent-command-readable-empty.jpg) | 本地化无输出和可切换的原始回执。 |
| [05 英文真实静默回执](05-candidate-en-silent-command-raw-receipt.jpg) | 键盘切换后完整退出字段和原控件焦点可见。 |
| [06 实际复制反馈](06-candidate-en-copy-retains-complete-receipt.jpg) | 复制显示确认，剪贴板文本与完整回执逐字吻合。 |
| [07 英文普通输出](07-candidate-en-readable-two-line-output.jpg) | 阅读视图中命令确切输出两行。 |
| [08 中文退出 7](08-candidate-zh-nonzero-command-keeps-exit-and-output.jpg) | 非零退出标记与命令实际文字同时显示。 |
| [09 中文字面标记](09-candidate-zh-literal-marker-remains-visible.jpg) | 实际命令打印的三行全部保留。 |
| [10 中文完整原始内容](10-candidate-zh-raw-keeps-literal-and-receipt.jpg) | 实际三行和独立附加回执可在同一原始正文阅读。 |
| [11 中文静默阅读](11-candidate-zh-silent-command-localized.jpg) | 无输出提醒及原始内容操作均使用中文。 |
