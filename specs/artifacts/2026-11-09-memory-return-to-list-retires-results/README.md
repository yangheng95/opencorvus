# 第 121 批：退出搜索回到列表的真实桌面证据

真实开发服务与隔离 SQLite 笔记。代理延后已完成的原搜索和随后的列表响应六秒；候选第二次退出的列表响应只交付原正文的前 32 字节。WebSocket 与独立普通读取保持原样。

| 截图 | 本人复核 |
| --- | --- |
| [01](01-before-initial-two-notes.jpg)、[02](02-before-expanded-search-result-with-original-note.jpg)、[03](03-before-clear-keeps-old-result-original-and-actions-in-flight.jpg)、[04](04-before-full-list-appears-only-after-response.jpg) | 原两条笔记；清除后仍显示旧展开原文，列表实际交付后才转换。 |
| [05](05-before-blank-submit-keeps-old-action-in-keyboard-order.jpg)、[06](06-before-late-list-replacement-strands-focus.jpg) | 空值提交仍能 Tab 到旧结果的删除动作；不激活该控件。真实列表到达后焦点落根。 |
| [07](07-after-real-search-and-original-note.jpg)、[08](08-after-escape-shows-list-loading-and-keeps-input.jpg)、[09](09-after-normal-list-returns-with-two-original-notes.jpg) | 候选原搜索/原文正常；Escape 即进入普通加载，保留输入焦点并读回两条笔记。 |
| [10](10-after-chinese-real-search-result-before-blank-submit.jpg)、[11](11-after-blank-submit-shows-list-loading.jpg)、[12](12-after-aborted-return-has-list-error-and-real-diagnostic.jpg)、[13](13-after-list-retry-restores-two-notes.jpg) | 中文第二份原文、空值返回的加载、真实中断后的列表错误和键盘重试。 |

[基线](before-observed.json)、[候选](after-observed.json) 为实页观察；`*-proxy.jsonl` 记录实际请求身份、延迟和响应。[代理](notes-search-to-list-proxy.mjs) 用法：`node notes-search-to-list-proxy.mjs <代理端口> <服务端口> <项目目录> 6000 [中断第几次延后的列表，0 表示完整]`。[持久写入](initialize-memory.ts)、[真实公开接口检查](check-memory-tcp.mjs)、前后 `*-tcp-schema-check.json` 与[原 Git 文件/端口](owned-final-check.json) 一并保留。
