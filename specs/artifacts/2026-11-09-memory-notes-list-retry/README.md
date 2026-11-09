# 第 119 批：笔记列表就地重读的桌面证据

隔离开发服务使用真实持久笔记或真实空列表。代理只中断目标目录的 `GET /panel/knowledge/memory`，转发其他真实响应；正常搜索和原文读取依旧由实际服务提供。

| 截图 | 人工复核 |
| --- | --- |
| [01](01-before-notes-list-read-failure.jpg)、[02](02-before-list-failure-with-unsent-query.jpg)、[03](03-before-search-action-submits-draft-instead-of-reading-list.jpg)、[04](04-before-clear-restores-full-list-and-erases-draft.jpg) | 前态：失败块缺少列表重读；现搜索提交草稿得到一条，清除才恢复两条但清空输入。 |
| [05](05-after-english-list-retry-keeps-draft.jpg)、[06](06-after-chinese-list-error-with-original-diagnostic.jpg)、[07](07-after-delayed-list-retry-retains-button-focus.jpg) | 候选：英中摘要、真实异常和重试；在途保留控件与草稿。 |
| [08](08-after-empty-project-first-read-fails.jpg)、[09](09-after-confirmed-empty-list-focuses-preserved-draft.jpg) | 真实空项目的首读错误及确认空列表，重试成功回到带原稿的输入框。 |
| [10](10-after-second-list-failure-keeps-retry-focused.jpg)、[11](11-after-list-retry-restores-two-notes-and-draft.jpg)、[12](12-after-first-restored-note-opens-original.jpg) | 再次失败按钮仍可用，真正读回两原笔记、保留草稿并聚焦首条；键盘展开原文。 |
| [13](13-after-explicit-search-submits-original-draft.jpg)、[14](14-after-normal-clear-restores-original-list.jpg) | 显式搜索才返回唯一结果，普通清除恢复原列表。 |

[前态](before-observed.json)、[候选](after-observed.json)、[真空列表](empty-observed.json) 为实页观察；`*-proxy.jsonl` 提供目录、方法、原请求 ID、读断流及完整返回。代理用法：`node note-list-proxy.mjs <代理端口> <服务端口> <隔离项目目录> [中断次数] [第二次及以后的断流延迟毫秒]`。有内容原响应交付 32 字节，空数组交付 1 字节。

[写入](initialize-memory.ts)、[真实接口检查](check-memory-tcp.mjs)、[空项目初始化及 schema 验证](initialize-empty.mjs) 和 [原数据/端口核对](owned-final-check.json) 附在此处。前后 `*-tcp-schema-check.json` 记录真实项目、列表和原文，候选另包含全文检索结果。
