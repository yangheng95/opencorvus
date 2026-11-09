# 连接提示键盘焦点证据

对应 [根因与验收记录](../../records/2026-11/2026-11-10-connection-notice-focus.md)。截图来自实际独立开发页面；切断和恢复只作用于该页面的隔离实时流代理。

| 场景 | 人工复核原图 |
| --- | --- |
| 修改前 | [实际在线](01-before-online.jpg)、[提示持有焦点](02-before-banner-focus.jpg)、[恢复后焦点落到页面根](03-before-recovered-focus.jpg) |
| 修复后英文 | [原聊天输入](05-after-original-composer-focus.jpg)、[焦点进入提示](06-after-focus-inside-banner.jpg)、[恢复后焦点回到原输入](07-after-returned-composer-focus.jpg) |
| 修复后中文 | [重新加载按钮持焦点](08-after-chinese-banner.jpg)、[主动移到更多操作](09-after-user-focus-elsewhere.jpg)、[恢复后仍是更多操作](10-after-outside-focus-kept.jpg) |

实际流和后端健康：[修改前代理](before-proxy.jsonl)、[修复后代理](after-proxy.jsonl)。实时结构校验：[修改前恢复](before-recovered-tcp.json)、[修复后基线](after-baseline-tcp.json)、[流中断](after-cut-tcp.json)、[归还焦点](after-recovered-tcp.json)、[保留外部焦点](after-outside-tcp.json)。
