# 文件工作台跳转到行的实页截图

Windows 桌面浏览器实际操作自建开发页面，原截图经本人复核。[方案与结果](../../records/2026-11/2026-11-23-file-workbench-go-to-line.md)

| 原图 | 实际结果 |
| --- | --- |
| [01 长文本工具栏](01-baseline-file-toolbar-only-find.jpg) | 当前打开原长文本，仅能在工具栏发起内容查找。 |
| [02 原生快捷键](02-baseline-native-shortcut-opens-line-dialog.jpg) | 编辑器中 Ctrl+Alt+G 打开原跳行面板，并聚焦输入。 |
| [03 原生跳到 130](03-baseline-native-shortcut-reaches-line-130.jpg) | 输入 130，高亮真实源行，焦点回文件。 |
| [04 Markdown 预览](04-baseline-markdown-preview-no-line-entry.jpg) | 默认预览原文正常，文件工具栏没有跳行入口。 |
| [05 首轮候选](05-candidate-text-toolbar-with-line-entry.jpg) | 新按钮可见，但文件名和操作区折行。 |
| [06 最终工具栏](06-final-text-toolbar-in-one-row.jpg) | 默认宽度下文件名和工具栏同一行，新按钮位于查找之后。 |
| [07 重复打开](07-final-repeat-focuses-same-line-input.jpg) | 重复点击聚焦同一个输入，保留已填的 130。 |
| [08 定位第 130 行](08-final-text-jumps-to-130.jpg) | 确认真正的文档行高亮，焦点交回文件。 |
| [09 快捷键定位第 148 行](09-final-keyboard-jumps-to-148.jpg) | 原 Ctrl+Alt+G 仍能打开输入并到达第 148 行。 |
| [10 取消跳转](10-final-escape-keeps-line-148.jpg) | 输入另一个行号后 Escape，仍在原第 148 行。 |
| [11 Markdown 预览工具栏](11-final-markdown-preview-line-entry.jpg) | 预览打开时跳行入口可使用。 |
| [12 源码跳行输入](12-final-markdown-source-native-prompt.jpg) | 实际从预览切源码后，原跳行框获得焦点。 |
| [13 Markdown 第 106 行](13-final-markdown-lands-on-106.jpg) | 进入第 106 行源码标题。 |
| [14 原查找回归](14-final-existing-find-from-preview.jpg) | Markdown 预览仍可通过原查找定位该标题。 |
| [15 中文跳行输入](15-final-zh-markdown-line-prompt.jpg) | 中文预览打开跳行时显示已聚焦的本地化输入和当前第 106 行。 |
| [16 中文第 2 行](16-final-zh-markdown-jumps-to-2.jpg) | 实际到达第 2 行，保留未修改状态，焦点回原文件。 |
