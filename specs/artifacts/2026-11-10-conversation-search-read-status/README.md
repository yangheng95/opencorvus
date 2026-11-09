# 对话查找读取状态证据

对应 [根因与验收记录](../../records/2026-11/2026-11-10-conversation-search-read-status.md)。截图来自隔离开发服务的真实 1280×720 桌面；任务和空聊天均是项目的实际持久化记录。故障代理只截断指定快照的响应，从未伪造消息或改变持久数据。

| 场景 | 人工复核原图 |
| --- | --- |
| 修改前 | [任务读取中](01-before-task-pending.jpg)、[任务失败误报零匹配](03-before-task-query-failed.jpg)、[普通聊天失败误报已载入零条](04-before-chat-failed.jpg)、[普通聊天真实空记录](05-before-chat-confirmed-empty.jpg) |
| 最终英文任务 | [在途和查询](12-final-task-pending.jpg)、[失败](13-final-task-failed.jpg)、[原始诊断](14-final-task-diagnostic.jpg)、[键盘重试](15-final-task-retry.jpg)、[已确认零匹配](16-final-task-accepted.jpg)、[关闭还原焦点](17-final-task-focus.jpg) |
| 最终中文聊天 | [在途](18-final-chat-zh-pending.jpg)、[失败](19-final-chat-zh-failed.jpg)、[原始诊断](20-final-chat-zh-diagnostic.jpg)、[已确认空记录](21-final-chat-zh-confirmed-empty.jpg)、[关闭还原焦点](22-final-chat-zh-focus.jpg) |

真实服务响应及模式校验：[修改前](before-baseline-tcp.json)、[修改后创建普通聊天](after-create-tcp.json)、[修改后最终持久状态](after-settled-tcp.json)。真实浏览器只读传输：[旧版代理日志](before-proxy.jsonl)、[改后代理日志](after-proxy.jsonl)，其中第 3–6 个读取来自最终构建。
