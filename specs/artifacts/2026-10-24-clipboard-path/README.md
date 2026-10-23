# 剪贴板路径对照

555，单agent，在隔离Source CLI /ui人工逐步操作并查看真实1280×720截图。[非秘密证据](evidence.json)。未运行或新增UI自动化测试。

| 实图 | 实际内容 |
| --- | --- |
| [01](01-stop-details-pasted.png) | 重置已知剪贴板标记后点击产品复制，真实Ctrl+V得到361字符原停止详情，保持未发送。 |
| [02](02-after-reload-pasted.png) | 重载后重新复制和真实粘贴，内容与原361字符完全一致。 |
| [03](03-draft-cleared.png) | 已清空未发送草稿，保留原历史Stopped卡。 |

键盘复制/粘贴23字符、专用API写入/粘贴26字符均匹配已知标记；产品三次复制均保留原requestID，并与原数据库Message完整reason/error逐字一致。554的43字符异常未复现、原因仍未知，不把本次通过包装成已找到其根因；不制造生产补丁。

只读验收没有复制auth或发起模型请求；主会话的Model configuration unavailable提示符合本scope没有认证的边界，不代表用户App热认证失效。源库90表169304行全部字段与时间、源字节mtime、canonical和schema3实际对象/integrity保持；隔离目标原行也零差异。公开shutdown200、原exec8805/native/launcher退出0、物理/output/request与精确进程出生闭合，保留1048404ms收尾；唯一catalog副本已退休。
