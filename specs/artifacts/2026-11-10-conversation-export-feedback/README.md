# 对话导出状态证据

对应 [根因与验收记录](../../records/2026-11/2026-11-10-conversation-export-feedback.md)。对照与验收使用真实隔离开发桌面和当前普通聊天接口建立的持久记录。

| 场景 | 人工复核原图 |
| --- | --- |
| 修改前 | [原聊天标题](01-before-title.jpg)、[导出覆盖标题](02-before-export-pending.jpg)、[失败覆盖标题](03-before-export-failed.jpg)、[提示随后消失](04-before-export-feedback-cleared.jpg) |
| 最终版英文 | [进度与原名](09-final-export-pending.jpg)、[持久失败入口](10-final-export-failed.jpg)、[重试说明和原始诊断](11-final-export-en-diagnostic.jpg) |
| 最终版中文 | [同一原始诊断](12-final-export-zh-diagnostic.jpg)、[另一聊天保持自身](13-final-export-other-chat.jpg)、[Markdown 下载启动](14-final-export-markdown-success.jpg)、[JSON 下载启动](15-final-export-json-success.jpg)、[在途切换](16-final-export-switch-during-read.jpg) |

[浏览器下载文件内容回执](after-downloads.json)。实时应用程序接口结构校验：[对照](before-baseline-tcp.json)、[建立候选会话](after-create-tcp.json)、[最终持久状态](after-settled-tcp.json)。[对照代理](before-proxy.jsonl)和[候选代理](after-proxy.jsonl)保留了实际路由、请求身份、截断、放行与取消。
