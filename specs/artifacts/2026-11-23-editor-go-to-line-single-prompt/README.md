# 编辑器跳转到行的实页截图

独立开发页面 `40584/ui/`、`40586/ui/` 的基线与候选实证。

| 画面 | 观察 |
| --- | --- |
| [01 首次快捷键](01-baseline-first-shortcut-opens-one-line-prompt.jpg) | 正文按快捷键，显示一个输入，预填第 1 行。 |
| [02 回正文再次按键](02-baseline-second-editor-shortcut-duplicates-line-prompt.jpg) | 新建预填 `8` 的输入，原来输入的 `130` 留在另一行。 |
| [03 Escape 只关闭新框](03-baseline-escape-leaves-original-line-prompt.jpg) | 原 `130` 输入仍占用底部区域。 |
| [04 工具栏恢复旧输入](04-baseline-toolbar-returns-to-existing-line-value.jpg) | 既有按钮把 `130` 恢复为当前焦点，随后按 Enter 能正常定位。 |
| [05 候选重复按键](05-candidate-repeat-shortcut-refocuses-130.jpg) | 从正文返回原 `130` 输入，只有一个输入框。 |
| [06 实际跳到第 130 行](06-candidate-mixed-entry-jumps-to-130.jpg) | 快捷键与工具栏混用后，回车定位并聚焦正文。 |
| [07 取消后原位](07-candidate-cancel-restores-editor-at-130.jpg) | 输入新行号后取消，正文焦点回第 130 行。 |
| [08 文件查找](08-candidate-find-still-locates-line-146.jpg) | 独立查找仍选中真实第 146 行。 |
| [09 中文 Markdown 复用输入](09-candidate-zh-markdown-shortcut-preserves-107.jpg) | 从预览进入源码，再按快捷键聚焦同一个 `107` 输入。 |
| [10 中文到第 107 行](10-candidate-zh-arrives-at-segment-27-line-107.jpg) | 正文显示并聚焦原来的 `Segment 27` 标题。 |
| [11 相对跳行](11-candidate-zh-relative-line-still-works.jpg) | 输入 `+4` 后到第 111 行 `Segment 28`。 |
