# Markdown 跨文档章节的桌面证据

- `baseline-guide-link.png` 和 `baseline-same-document.png` 显示指南及当前同页章节对照。
- `baseline-cross-document-leaves-pane.png` 显示实际点击跨文档章节后浏览器访问了嵌套应用地址，文件面板已退出。
- `baseline-source-line.png` 显示同一指南的 `#L3` 对照仍精确打开目标文件源码的第 3 行。
- `baseline-target-receipt.json` 核对真实文件服务返回内容与目标文件原件一致。
- `candidate-first-heading.png`、`candidate-keyboard-second-heading.png` 和 `candidate-encoded-heading.png` 对应首个标题、键盘进入第二个同名标题及编码中文标题。
- `candidate-missing-heading.png`、`candidate-same-document.png` 和 `candidate-source-line.png` 对应缺失标题打开正常预览、同文档原地定位及源码第 3 行。
- `candidate-unsaved-dialog.png` 和 `candidate-draft-preserved.png` 显示源文件原有离开确认和取消后的未保存文字。`candidate-file-receipts.json` 证实源文件字节、候选公开读取与磁盘相符。
- `candidate-focus-during-read.png` 和 `candidate-focus-after-read.png` 显示真实目标加载前后，会话输入框持续持焦。`candidate-delayed-read.jsonl` 记录目标路径、延后交付和正常 200。

[根因和验收规格](../../records/2026-11/2026-11-19-markdown-cross-file-headings.md)
