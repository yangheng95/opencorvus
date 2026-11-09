# 能力分配保存确认的实页证据

对应 [Recall、修改前根因和验收](../../records/2026-11/2026-11-09-capability-assignment-confirmation.md)。图片是本人查看的 1280×720 开发桌面原图，仅使用隔离项目和已随产品提供的内置技能描述。

- 前态：[01 原分配](01-before-work-capability-accepted-assignments.jpg)、[02 真实写入等待](02-before-assignment-response-pending.jpg)、[03 已写入却显示读取失败](03-before-committed-write-displays-load-failure.jpg)、[04 重新打开才看到实际值](04-before-reopening-reads-committed-work-assignment.jpg)、[05 还原操作等待](05-before-normal-write-restores-isolated-assignment.jpg)、[06 还原完成读回](06-before-original-assignment-restored-after-real-read.jpg)。
- 英文后态：[07 初始值](07-after-normal-work-assignment-view.jpg)、[08 保存未确认与最后确认的列表](08-after-unconfirmed-save-keeps-last-confirmed-assignments.jpg)、[09 只读核对在途](09-after-read-only-check-retains-diagnostic-and-focus.jpg)、[10 核对也失败保留两个诊断](10-after-failed-check-preserves-both-original-diagnostics.jpg)、[11 读回实际提交及焦点交接](11-after-confirmed-current-assignment-and-scope-focus.jpg)、[12 正常还原](12-after-normal-write-restores-original-skill-assignment.jpg)。
- 中文后态：[13 冷读取失败](13-after-chinese-chat-cold-read-offers-real-retry.jpg)、[14 原位重试焦点](14-after-chinese-cold-read-retry-stays-focused.jpg)、[15 恢复正确角色并保留用户焦点](15-after-chinese-chat-current-role-recovers-without-stealing-focus.jpg)。
- [前态观察](before-observed.json)、[Work 后态观察](after-work-observed.json)、[Chat 后态观察](after-chat-observed.json)、[前态真实响应](before-proxy.jsonl)、[Work 后态](after-work-proxy.jsonl)、[中文 Chat 后态](after-proxy.jsonl)及[前态代理](capability-response-proxy.mjs)、[后态代理](capability-check-response-proxy.mjs)。
- [接口检查器](check-capability-tcp.mjs)、[前态恢复](before-restored-tcp.json)、[后态初始](after-initial-tcp.json)、[真实提交](after-committed-tcp.json)、[后态恢复](after-restored-tcp.json)和[项目原文件及端口核对](owned-final-check.json)。
