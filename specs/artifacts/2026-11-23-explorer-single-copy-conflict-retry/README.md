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

候选 `40598/ui/` 的十张截图由本人在真实桌面页面交互后逐张复核。

| 画面 | 观察 |
| --- | --- |
| [07 文件名和焦点](07-candidate-en-copy-conflict-keeps-input-focused.jpg) | 实际文件冲突后当前输入框保留。 |
| [08 正式文件诊断](08-candidate-en-copy-keeps-original-http-409.jpg) | 当前表单可展开正式 409。 |
| [09 文件重试](09-candidate-en-retry-copies-and-focuses-result.jpg) | 原表单重试成功后选中新文件。 |
| [10 原编辑草稿](10-candidate-en-original-unsaved-draft-is-retained.jpg) | 原件编辑器保留草稿和未保存标记。 |
| [11 目录内复制校验](11-candidate-zh-self-copy-validation-keeps-field.jpg) | 中文本地错误显示于当前路径下。 |
| [12 目录冲突](12-candidate-zh-existing-directory-keeps-same-input.jpg) | 值和输入焦点都保留。 |
| [13 正式目录诊断](13-candidate-zh-original-directory-conflict-details.jpg) | 展开可核对正式 409。 |
| [14 目录重试](14-candidate-zh-directory-retry-focuses-new-copy.jpg) | 焦点准确落在新目录。 |
| [15 递归副本](15-candidate-zh-keyboard-opens-recursive-copy.jpg) | 键盘打开目录副本中的原样文件。 |
| [16 取消焦点](16-candidate-zh-cancel-returns-to-source.jpg) | Escape 将焦点送回本次操作的源目录。 |
