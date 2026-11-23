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

首轮候选 40558，构建 `main-DTXx41KE.js`。

| 截图 | 人工核对 |
| --- | --- |
| [11](11-candidate-zh-move-keeps-original-error.jpg) | 中文移动保留实际 409、请求诊断和待修正路径。 |
| [14](14-intermediate-zh-parent-keeps-focus.jpg) | 首轮草稿决定出现后，下层重命名框仍占有键盘焦点。 |
| [15](15-intermediate-zh-pointer-cancels-dirty-decision.jpg) | 首轮用鼠标选「继续编辑」可回到原文件，界面呈现取消。 |

最后候选 40558，构建 `main-DTMBeKuP.js`。

| 截图 | 人工核对 |
| --- | --- |
| [16](16-final-zh-dirty-dialog-owns-initial-focus.jpg) | 上层草稿决定的初始焦点在「继续编辑」。 |
| [17](17-final-zh-keyboard-cancel-restores-source.jpg) | 键盘取消后，源行重新得到焦点，并收到中性结果。 |
| [18](18-final-zh-cancel-keeps-authored-draft.jpg) | 取消后重新查看编辑器，原文件两行草稿仍标记未保存。 |
| [19](19-final-zh-keyboard-save-and-continue.jpg) | 反向 Tab 将焦点移到「保存并继续」。 |
| [21](21-final-zh-saved-draft-original-content.jpg) | 新文件路径展示保存后的两行内容，编辑器显示没有未保存的更改。 |
| [22](22-final-en-rename-conflict-retains-input.jpg) | 英文重命名保留实际 409 诊断和名称输入。 |
| [23](23-final-en-rename-success.jpg) | 修正同一表单后，成功回执与新行蓝色焦点一起出现。 |
| [24](24-final-zh-move-conflict-retains-input.jpg) | 中文移动冲突将焦点留在可修正的原路径输入。 |
| [25](25-final-zh-move-success.jpg) | 新行选中并得到焦点，原冲突目标仍并列存在。 |
| [26](26-final-zh-move-already-at-destination.jpg) | 确认原位置显示中性反馈，焦点留在同一行。 |

[规格和验收](../../records/2026-11/2026-11-23-explorer-single-transfer-conflict-retry.md)
