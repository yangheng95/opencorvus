# 374 项目引用与附件编辑边界证据

范围与Recall见[实施方案](../source-file-identity-plan-374.md)。改前实页证据复用[373绝对引用只读](../source-colon-range-373/after/03-absolute-range.png)及[相对引用可编辑](../source-colon-range-373/after/04-anchor-control.png)。

本轮真实开发服务18381，页面199，正式main-Hg2zJLcN.js；9张PNG由单agent实际查看，不是自动截图断言：

| 图 | 人工观察 |
| --- | --- |
| [01](after/01-relative-draft.png) | 相对正文引用2:4处键入x，草稿与Save可见。 |
| [02](after/02-absolute-keeps-draft.png) | 绝对引用保留同一草稿，定位仍为2:4。 |
| [03](after/03-source-keeps-draft.png) | 实际Sources打开L2，草稿保持。 |
| [04](after/04-project-saved.png) | 保存完成，星号清除。 |
| [05](after/05-attachment-source.png) | canonical附件显示原始名称、Attachment与只读。 |
| [06](after/06-attachment-relative.png) | 普通正文相对blob路径只读，实际1–2行。 |
| [07](after/07-attachment-absolute.png) | 同一blob绝对路径仍只读。随后按x，人工观察内容保持原文。 |
| [08](after/08-external-read-only.png) | 项目外来源只读。 |
| [09](after/09-absolute-open-edit-save.png) | 关闭后绝对引用重新打开，键入y并Ctrl+S成功。 |

checks/runtime-qualification.json核对3个真实Source及完整ToolOutcome、完整文件字节、实际Provider流与Native闭合；after/live-file-api.json记录实际上传后读取及附件400只读错误。最终项目文件44字节保留CRLF，附件及外部输入字节完整一致。原14714 exit0，Native239504ms，9请求均EOF，完整auth/models副本及进程、输出、请求、端口、页面均关闭。

checks保存聚焦测试、构建、类型、准备与核对脚本的完整压缩记录；AX、运行日志完整压缩，保留私有原件并扫描解压文本。首次准备路由末尾斜杠404和首次Markdown反斜杠转义歧义写入Recall；正斜杠更正通过真实聊天消息完成，未合成消息或来源。

范围：NativeService与桌面浏览器；不宣称外部原生IDE、359首次复制、非UTF8文件或不同数据库附件目录均已验。本轮也未全面限制独立的文件管理与工具操作。直接正文blob路径的标题仍为存储名，留作下一轮可读性调查。
