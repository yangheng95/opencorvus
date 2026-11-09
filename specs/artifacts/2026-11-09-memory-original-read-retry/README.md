# 第 117 批：笔记原文读取失败的桌面证据

在隔离开发服务中以真实领域接口写入两条确定的笔记。代理只在目标目录的同一笔记 GET 真实返回 200 后局部中断正文，浏览器的原 WebSocket 和其他请求正常转发。

| 截图 | 人工复核 |
| --- | --- |
| [01](01-before-notes-list.jpg)、[02](02-before-original-read-fails-with-raw-message.jpg)、[03](03-before-reopening-shows-stale-error.jpg) | 前态：真实两条笔记，原文失败，重开仍显示旧异常。 |
| [04](04-before-neighbor-reads-original-while-target-error-stays.jpg)、[05](05-before-english-transport-message-in-chinese.jpg)、[06](06-before-remount-loads-the-same-original-note.jpg) | 相邻笔记在线；中文仍显示英文异常；重进原文可读。 |
| [07](07-after-real-full-text-result.jpg)、[08](08-after-original-failure-keeps-result-and-query.jpg)、[09](09-after-first-original-diagnostic.jpg)、[10](10-after-chinese-note-failure-keeps-search.jpg) | 候选真实搜索，原文失败仍保留查询和当前条目；英文/中文摘要，打开诊断可见原错误首行。 |
| [11](11-after-same-retry-button-stays-focused-while-reading.jpg)、[12](12-after-second-failure-keeps-retry-available.jpg)、[13](13-after-retry-focuses-complete-original-with-search.jpg) | 在途和再次失败都保持控件焦点，最终读取完整原文并聚焦原文区域。 |
| [14](14-after-list-note-can-retry.jpg)、[15](15-after-reopening-failed-note-reads-original.jpg)、[16](16-after-neighbor-reads-its-own-original.jpg)、[17](17-after-revisiting-successful-note-preserves-original.jpg) | 独立列表页中，原失败条目重开成功，相邻原文独立，已读条目保留原文缓存。 |

[基线](before-observed.json)、[候选搜索](after-observed.json) 和[独立列表](reopen-observed.json) 是真实页面观察；相应 `*-proxy.jsonl` 记录实际原响应、目录、身份和断流。代理用法：`node note-detail-proxy.mjs <代理端口> <服务端口> <项目绝对目录> <文件 ID> [中断次数] [第二次及以后的延时毫秒]`。

[真实领域初始化](initialize-memory.ts) 写入两份原始内容。[实际接口检查](check-memory-tcp.mjs) 与 [基线结果](before-tcp-schema-check.json)、[候选结果](after-tcp-schema-check.json) 对齐运行时 schema、项目范围、文件身份和原文；[自有数据及端口](owned-final-check.json) 记录原 Git 文件与正常退出后的监听状态。未访问用户数据或模型。
