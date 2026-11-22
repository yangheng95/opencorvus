# 跳行在文件重新加载后的实页证据

Windows 桌面浏览器连接专用本机开发页面。本人查看了原始截图。[方案与结果](../../records/2026-11/2026-11-23-editor-go-to-line-after-reload.md)

| 原图 | 实际结果 |
| --- | --- |
| [01 原长版](01-baseline-line-prompt-on-original-revision.jpg) | 工具栏打开原跳行框，内容仍是原长版。 |
| [02 磁盘重新加载中](02-baseline-reloaded-document-retains-prompt.jpg) | 已点击真实重新加载，现输入随编辑器保留。 |
| [03 新短版](03-baseline-shortened-text-with-same-prompt.jpg) | 同一个输入框现在与新的短行内容同在。 |
| [04 提交 30 仍在第一行](04-baseline-valid-new-line-stays-at-one.jpg) | 新版有效行号 30 关闭面板，编辑器位置仍在第 1 行。 |
| [05 同新版重新打开](05-baseline-fresh-prompt-reaches-line-30.jpg) | 重新打开跳行框后，同样的 30 确实可以定位。 |
| [06 恢复长版后错位](06-baseline-short-to-long-jumps-to-line-5.jpg) | 短版打开的框在重新加载长版后提交 30，落到第 5 行。 |

[实际浏览器错误](baseline-line-selection-error.json)与第 04 张截图对应。
