# 单项复制冲突的桌面证据

来自真实隔离开发入口 `40596/ui/` 的基线截图。

| 画面 | 观察 |
| --- | --- |
| [01 英文原输入](01-baseline-en-copy-destination-entered.jpg) | 文件复制表单录入 `copies/booklet.txt`。 |
| [02 正式失败和表单退出](02-baseline-en-conflict-destroys-destination.jpg) | 真实 409 显示在文件树，原输入框已关闭。 |
| [03 重开默认建议](03-baseline-en-reopen-resets-to-suggestion.jpg) | 重开后回 `booklet-copy.txt`。 |
| [04 中文自复制校验](04-baseline-zh-directory-inside-itself-closes-dialog.jpg) | 向目录内部复制被本地拒绝，表单已关闭。 |
| [05 中文目录冲突](05-baseline-zh-copy-directory-conflict-closes-dialog.jpg) | 已有目的目录拒绝，表单已关闭。 |
| [06 目录正式诊断](06-baseline-zh-directory-original-http-conflict.jpg) | 原诊断确认 `copies/notes` 的正式 409。 |
