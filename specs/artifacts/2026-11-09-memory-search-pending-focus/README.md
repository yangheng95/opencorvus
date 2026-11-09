# 第 120 批：笔记搜索和清除的真实焦点证据

两个隔离开发服务使用真实项目和同样的两份自有笔记。代理仅暂缓已完成的搜索和清除后的列表原 200，随后完整转发；原双向连接和其他路由不变。

| 截图 | 本人复核 |
| --- | --- |
| [01](01-before-draft-input-owns-focus.jpg)、[02](02-before-search-disables-input-and-loses-focus.jpg)、[03](03-before-real-search-result-leaves-focus-at-root.jpg) | 前态输入原本聚焦，搜索在途禁用，收到真实结果后焦点仍在页面根。 |
| [04](04-before-escape-clear-disables-input-during-list-read.jpg)、[05](05-before-escape-clear-completes-with-root-focus.jpg)、[06](06-before-click-clear-also-loses-input-focus.jpg)、[07](07-before-mouse-clear-transitional-root-focus.jpg) | Escape 清除在途和完成均失焦；鼠标也立即失焦，06–07 仅为在途。 |
| [08](08-after-readonly-search-keeps-input-focus.jpg)、[09](09-after-search-result-and-editable-focus.jpg)、[10](10-after-escape-clear-keeps-focus-in-readonly-input.jpg)、[11](11-after-escape-list-completes-with-input-focus.jpg) | 英语搜索和 Escape 清除，输入只读但保持焦点；真实结果/原列表回来后仍聚焦。 |
| [12](12-after-chinese-search-keeps-focus-while-loading.jpg)、[13](13-after-mouse-clear-returns-focus-before-list-reply.jpg)、[14](14-after-mouse-clear-finishes-with-two-notes-and-input-focus.jpg)、[15](15-after-shared-settings-clear-still-accepts-typing.jpg) | 中文搜索、鼠标清除在途和完成，以及普通设置搜索清除后可继续键入。 |

[前态](before-observed.json)、[候选](after-observed.json) 是实页观察，`*-proxy.jsonl` 记录实际响应及延迟；[代理](notes-search-keyboard-proxy.mjs) 用法为 `node notes-search-keyboard-proxy.mjs <代理端口> <开发端口> <隔离目录> 6000`。[真实接口检查](check-memory-tcp.mjs)、前后 `*-tcp-schema-check.json`、[原数据与端口](owned-final-check.json) 分别核对运行时公开契约、两笔记原文、持久身份和退出。
