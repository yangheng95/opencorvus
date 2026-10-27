# Goal用量范围证据

记录见[Goal用量归属的可见说明](../../records/2026-10/2026-10-28-goal-usage-scope.md)。真实开发CLI（命令行）的/ui页面，1280×720桌面，中英文原始截图均实际呈现并人工复核。

- [01 英文首次详情](01-english-scope-details.png)：说明可读，但展开的只读预算使创建操作落在首屏之外。
- [02 同页实际滚动](02-completed-action-after-scroll.png)：创建操作在正文后方，确认布局密度问题。
- [03 英文最终详情](03-english-completed-compact.png)：已完成预算默认收起，说明、计数和创建操作同时可见。
- [04 预算选择保留](04-budget-choice-retained.png)：手动展开后查看帮助再返回，保留原选择。
- [05 中文最终详情](05-chinese-completed-details.png)：中文说明、真实计数、创建与关闭操作可读。
- [06 中文刷新后](06-chinese-after-reload.png)：实际关闭、刷新和重开后的状态一致。

[运行事实](runtime-review.json)记录精确用量关联、公有接口与两个隔离实例的结清。页面中的模型暂不可用提示来自无凭据的历史阅读验收副本；本轮零模型调用。源和副本各92表2427条原行保持，schema（结构）9；未改动真实用户数据库或模型记账。没有UI（用户界面）自动化测试。
