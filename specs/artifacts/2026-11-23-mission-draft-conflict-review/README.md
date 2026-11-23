# 多步任务并发草稿的桌面证据

Windows 桌面独立标签，基线开发服务 `40568`、构建 `main-0HQLd2Cf.js`。两项目、标题及请求为独立验收数据。

| 截图 | 人工核对 |
| --- | --- |
| [01](01-baseline-en-editor-with-authored-request.jpg) | 北区原编辑框保有本人尚未保存的文字。 |
| [02](02-baseline-en-conflict-instructs-copy-and-reopen.jpg) | 原保存被拒，文字保留，界面要求复制和重开。 |
| [03](03-baseline-en-changed-conflict-diagnostics.jpg) | 展开原诊断，看到实际 409、原路径和请求标识。 |
| [04](04-baseline-en-reopening-requires-discard.jpg) | 按取消后出现实际未保存决定，原本地文字仍在。 |
| [05](05-baseline-en-reopen-shows-only-saved-request.jpg) | 独立测试文本退出后重开，只读取到最新已保存内容。 |

首轮候选 `40570`，构建 `main-COjy6Dp1.js`。

| 截图 | 人工核对 |
| --- | --- |
| [06](06-candidate-en-conflict-focuses-review.jpg) | 确定冲突之后保留本地文字，焦点进入审阅入口。 |
| [07](07-candidate-en-saved-and-authored-requests.jpg) | 同一对话框展示两个确切版本，键盘聚焦只读版本。 |
| [08](08-candidate-en-review-returns-focus-to-own-request.jpg) | 确认后，焦点回原文字，已保存版本仍可复查。 |
| [09](09-candidate-en-saved-merged-request.jpg) | 实际合并保存有准确文本和成功回执。 |
| [10](10-intermediate-zh-long-request-starts-at-end.jpg) | 首轮长稿的初始焦点正确，阅读区从该版本末尾开始。 |

最后候选 `40570`，构建 `main--fSyB91_.js`。

| 截图 | 人工核对 |
| --- | --- |
| [11](11-final-zh-long-request-starts-at-first-line.jpg) | 简中首次审阅长请求，从已保存版本第一行开始。 |
| [12](12-final-zh-long-request-keyboard-reaches-last-line.jpg) | 在真实只读区用 Page Down 停在完整末行。 |
| [13](13-final-zh-second-conflict-keeps-authored-request.jpg) | 读取后再发生新写入，服务再次拒绝过期保存，原稿和审阅按钮保留。 |
| [14](14-final-zh-reread-shows-the-new-actual-winner.jpg) | 重新查看只读取第二个确切已保存版本。 |
| [15](15-final-zh-board-saves-merged-request.jpg) | 用户自己合并并保存后，中文看板的北区草稿收到明确回执。 |
| [16](16-final-en-list-reviews-both-versions.jpg) | 英文列表入口打开两个真实版本，保留不同文字。 |
| [17](17-final-en-reconciled-north-and-original-south.jpg) | 英文合并保存指向北区，南区保留原稿。 |

[长稿只读区初始及键盘滚动位置](candidate-long-read-geometry.json)

[规格和验收](../../records/2026-11/2026-11-23-mission-draft-conflict-review.md)
