# Session 成员快照恢复实页证据

[调查与修复方案](../../records/2026-10/2026-10-23-session-member-snapshot.md)；[数据与资源记录](evidence.json)；[低频生命周期记录](lifecycle.json)。全部截图来自自有 Source CLI /ui，内置浏览器手工操作并实际查看；不是 UI 自动化测试。

## 修复前

- [旧历史基线](02-before-baseline.png)：32 段正文、10 条来源。
- [首次恢复](04-reconnected.png)：35 段正文、11 条来源已出现，但选中 occurrence 只有 input ID，空活动与定位目标；开始时间误用末次状态时间，页面显示 04:38 PM。
- [后续完整加载补齐](06-source-visible.png)：8.624 秒后成员信息才恢复。正文与来源保持可读。

## 修复后

- [相同旧历史](08-before-verified.png)、[同页离线](09-offline-verified.png)：原 32 段正文和 10 条来源保持。
- [首次重连](10-restored-verified.png)：第一次新 occurrence 即包含三条消息、四项活动、真实目标和开始时间，页面为正确的 04:31 PM。
- [来源与成员摘要](11-source-and-member-verified.png)：Disclosure 来源卡片、长文、主区成员摘要同时可读；旧正文 owner 21–52 和十个来源 owner 保持，新正文 owner 53–55、来源 owner 26 追加。

原先 observedAt 字段为 renderer 的单调时钟，日志 capturedAt 保留浏览器捕获的 UTC 时间，两者分别保存。不同日志批次可能重叠；生命周期按原 timestamp+message 去重，同页事件按 capturedAt 排序，不把多次读取当作多次挂载。DOM 记录仅用于解释身份和阅读位置，截图才是视觉证据。

首次修复在真实来源历史中失败：共享 Activity schema 遗漏三类 Source，严格连接帧校验拒绝真实记录。补齐共享契约后重新生成 SDK/OpenAPI，并重新启动整套历史对照，失败 scope 与最终通过分别保留。

五个隔离服务均公开 shutdown 200、原 exec/native/launcher 0、输出与 reader 闭合。实际 10/16 次 gpt-6.1-sol 流式请求全部200/EOF，20份 runtime/private auth/models 配对成员退休。90表完整源数据保持；目标原行只有两条运行租约变化，schema3和用户数据库保持原边界。Mission 本轮有后端真实路由合同，没有独立 Mission 页面复验；瞬时模型配置提示和 ResizeObserver 通知保留为后续调查项。
