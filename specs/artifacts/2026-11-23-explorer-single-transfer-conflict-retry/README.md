# 单项重命名和移动冲突的实页截图

Windows 桌面专用标签，基线端口 40556，构建 main-C9KWBp2b.js。图中所有文件均为隔离测试自建内容。

| 截图 | 人工核对 |
| --- | --- |
| [01](01-baseline-en-rename-conflict-input.jpg) | 重命名输入以真实存在的文件作为目标。 |
| [02](02-baseline-en-rename-closes-on-conflict.jpg) | 冲突后原输入已关闭，侧栏报告确切目的地。 |
| [03](03-baseline-en-rename-original-409.jpg) | 实际英文原错误为 409，带请求标识。 |
| [04](04-baseline-zh-move-closes-on-conflict.jpg) | 中文单项移动冲突同样关闭输入。 |
| [05](05-baseline-zh-move-original-409.jpg) | 中文移动显示实际目标及正式 409 诊断。 |
| [06](06-baseline-zh-dirty-draft-protected.jpg) | 受影响的实际草稿先进入原未保存决定。 |

[规格和验收](../../records/2026-11/2026-11-23-explorer-single-transfer-conflict-retry.md)
