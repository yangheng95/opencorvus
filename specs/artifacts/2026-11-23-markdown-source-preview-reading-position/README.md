# Markdown 视图切换的实页截图

Windows 桌面专用标签。基线端口 40552，构建 main-gMBBzVGS.js。正文来自本人创建的真实 Git 项目文件。

| 截图 | 人工核对 |
| --- | --- |
| [01](01-baseline-en-deep-markdown-reading.jpg) | 预览正常滚至第 10 节附近。 |
| [02](02-baseline-en-source-finds-heading.jpg) | 从预览调用原查找后，源码中确实命中第 18 节。 |
| [03](03-baseline-en-preview-resets-to-top.jpg) | 原稿件和导览未变，回到预览时跳回文档标题。 |
| [04](04-baseline-en-pointer-roundtrip-resets.jpg) | 不调用查找，只点两个视图按钮也回到文档开头。 |

[规格和验收](../../records/2026-11/2026-11-23-markdown-source-preview-reading-position.md)

候选端口 40554，最终构建 main-C9KWBp2b.js。

| 截图 | 人工核对 |
| --- | --- |
| [05](05-candidate-en-original-reading-position.jpg) | 读者预览位于第 10 节附近。 |
| [06](06-candidate-en-actual-source-hit.jpg) | Ctrl+F 在源码中实际匹配第 18 节。 |
| [07](07-candidate-en-find-roundtrip-restores-reading.jpg) | 切回后的第 10 节读点与 05 一致。 |
| [08](08-candidate-en-pointer-roundtrip-restores-reading.jpg) | 在第 14 节附近鼠标往返两种视图，保留新读点。 |
| [09](09-candidate-en-new-document-own-start.jpg) | 另一文件从自身标题开始。 |
| [10](10-candidate-en-explicit-heading-wins.jpg) | 该文件的链接确实打开第 08 节并聚焦。 |
| [11](11-candidate-zh-reading-before-keyboard-toggle.jpg) | 中文界面预览滚动至第 13 节附近。 |
| [12](12-candidate-zh-reading-after-keyboard-toggle.jpg) | 方向键切回预览后同一读点，焦点仍在切换按钮。 |
| [13](13-candidate-zh-changed-draft-fresh-preview.jpg) | 实际临时稿件有新正文及未保存文案，使用新预览。 |
| [14](14-candidate-zh-undo-restores-original.jpg) | 撤销恢复原标题及没有未保存更改。 |
