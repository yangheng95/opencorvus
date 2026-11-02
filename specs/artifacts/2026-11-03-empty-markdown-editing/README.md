# 空Markdown文件编辑验收

本轮按照[调查方案](../../records/2026-11/2026-11-03-empty-markdown-editing.md)在隔离原生开发页面38673/38674实际交互，14张截图均已人工查看。[验证记录](qualification.json)记录实际读取、原数据与资源结清。

空Markdown文件现在默认进入源码编辑，继续使用原编辑器的显式打开/焦点机制；非空文档默认预览，用户选择、指定行和同身份草稿保持。

| 截图 | 人工复核结果 |
| --- | --- |
| [01](01-before-new-empty-preview.png)、[02](02-before-manual-source-required.png) | 修改前：实际新建0字节文件默认空白Preview，编辑器隐藏、焦点在页面背景，需手动切Source。 |
| [03](03-after-empty-source-ready.png) | 修改后空文件直接Source，原编辑器可见并获得真实输入焦点。 |
| [04](04-after-first-save.png)、[05](05-after-explicit-preview.png) | 实际输入并保存71字节后Source保持；显式预览可读。 |
| [06](06-after-reload-cancel-draft.png)、[07](07-after-close-cancel-draft.png) | 取消重载/关闭，完整第三段草稿保持，焦点分别回原重载/关闭按钮。 |
| [08](08-after-saved-reload-source.png)、[09](09-after-nonempty-reopens-preview.png) | 保存182字节后实际重载保持Source；关闭后重新打开非空文件默认Preview。 |
| [10](10-after-real-missing-file.png)、[11](11-after-retry-default-preview.png) | 实际移动本人文件取得具名缺失反馈；恢复原件并Retry，首次成功读取选择Preview。 |
| [12](12-after-chinese-preview-retained.png)、[13](13-after-chinese-empty-source.png) | 切中文保留已有Preview；中文新建第二份0字节文件直接Source并获得焦点。12有不遮挡文件区域的设置提示。 |
| [14](14-after-explicit-line-source.png) | 本人文档实际保存`#L3`链接，点击后Source第3行高亮、编辑焦点正确。 |

正式接口与物理文件对照：before空文件0字节，after为空0、首存71、继续保存123、完整草稿182、实际恢复重试182、中文空文件0、最终含链接221字节，共八次成功读取；另一次正式404/FileNotFoundError确认具名缺失，暂存原件与移回后的182字节完整。最后221字节为随后真实编辑增加定位链接，未覆盖旧项目文件。

两实例公开关闭200、原句柄0并完成物理/输出/请求结清，四配对认证/模型目录副本退休。结构10/92表、全部原行精确保持，源库、105/106原项目业务文件/Git及265附件/元数据保持。四检查点15 Mission、4 Task状态/根会话、24 Mailbox及查询、915原Goal（complete/345102/1轮、会话idle）和12次原文件读取合同保持；0模型请求、累计1319。

另有切换会话后来源按钮首次激活未显示文件区域的时序观察；随后正文链接与同一来源重开成功。尚未确认该观察的根因，本轮不宣称修复Sources交互。未操作现用窗口、真实用户数据库、消息或发布，未运行UI自动化。
