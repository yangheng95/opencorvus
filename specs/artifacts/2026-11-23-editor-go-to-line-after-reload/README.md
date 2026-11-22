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
| [07 候选长版](07-candidate-prompt-open-on-long-revision.jpg) | 同一个新隔离服务上先打开长版原跳行框。 |
| [08 候选短版](08-candidate-reloaded-short-with-original-prompt.jpg) | 操作重新加载后，短版取代正文，待提交输入仍在。 |
| [09 候选第 30 行](09-candidate-retained-prompt-jumps-to-updated-30.jpg) | 通过原输入提交 30，实际定位新版第 30 行。 |
| [10 相对行和列](10-candidate-relative-line-and-column.jpg) | `+2:3` 高亮第 32 行。 |
| [11 现列偏移](11-candidate-column-offset-selects-next-character.jpg) | Shift+Right 选中第四个字符，符合列偏移 3。 |
| [12 短版末行](12-candidate-short-document-upper-bound.jpg) | 输入 999 定位第 41 空行，保留原末尾边界。 |
| [13 中文恢复长版](13-candidate-zh-restored-long-keeps-entered-line.jpg) | 恢复原件后同一输入保留已输入的 30。 |
| [14 中文第 30 行](14-candidate-zh-restored-source-line-30.jpg) | 提交 30 精确定位长版第 30 行。 |
| [15 百分比定位](15-candidate-percentage-uses-restored-line-count.jpg) | `50%` 实际到长版第 61 行。 |
| [16 取消输入](16-candidate-escape-keeps-restored-line-61.jpg) | Escape 保留第 61 行与编辑器焦点。 |

[实际浏览器错误](baseline-line-selection-error.json)与第 04 张截图对应。
