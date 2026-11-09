# 会话诊断复制的归属证据

对应 [根因与验收记录](../../records/2026-11/2026-11-10-conversation-diagnostics-copy-ownership.md)。桌面和网络证据只来自隔离开发项目。原诊断内容不随仓库提交。

| 场景 | 人工复核原图 |
| --- | --- |
| 修改前 | [原会话复制在途](01-before-copy-origin-in-flight.jpg)、[切到另一聊天](02-before-other-chat-before-release.jpg)、[旧反馈覆盖新标题](03-before-stale-copy-failure.jpg) |
| 候选英文 | [进度与标题](04-after-copy-pending.jpg)、[切到另一聊天](05-after-other-before-release.jpg)、[迟到响应后仍是另一聊天](06-after-late-success-keeps-other.jpg)、[首个徽标截断](07-after-menu-copy-current.jpg) |
| 最终版本 | [英文菜单复制与完整徽标](08-final-copy-success-en.jpg)、[原聊天标题](09-final-origin-before-doubleclick.jpg)、[中文双击](10-final-copy-success-zh-doubleclick.jpg)、[中文进度](11-final-zh-copy-pending.jpg)、[中文迟到响应后保留标题](12-final-zh-late-copy-stays-scoped.jpg) |

[修改前](before-proxy.jsonl)和[修复后](after-proxy.jsonl)代理日志保留两条实际读取的状态和响应交付时序。实时结构校验：[原版本](before-baseline-tcp.json)、[修复后初始](after-baseline-tcp.json)、[修复后最终](after-settled-tcp.json)。剪贴板独立读回未确认，详见验收记录。
