# Task续跑原文与失败唤醒

对应[共享机制调查与实施](../../records/2026-10/2026-10-29-task-terminal-checkpoint-recovery.md)。

本轮修复原选文与真实Tool请求/结果的绑定，以及完成错误回复的Scheduler投递结算。原失败数据库分别通过真实Message.filterCompacted与投递audit复现red，并在相同原件复制上通过green；没有改写原消息或receipt。正式回归与真实页面/Provider验收分别记录，原完整代码任务的自动Git提交仍待继续修复。

- [检查与原始输出](checks.json)：前三项是修复前正式失败；后续原件投影/审计、104项后端回归、类型与当前源码拓扑通过。各项`.log`保存实际输出，未使用UI自动化。
- [原选文投影](original-text-projection.json)、[投递修复前](before-wake-settlement.json)与[修复后](after-wake-settlement.json)：同一关闭的原数据进入真实读取器和审计，保留原错误身份与时间。
- [真实Task证据](real-task-journey.json)：同一Task/Orchestrator Session、原测试与差异工具输出、协调回执、真实询问超时及明确park。未获提交批准，原完整代码任务未完成。
- [运行结算](runtime-settlement.json)：9次真实gpt-6.1-sol流式HTTP200/EOF，累计882，公开shutdown200、原执行链退出0及三项完成事实，成对凭据/目录副本清退。没有复制任何凭据正文。
- [逐行数据与原件对照](data-review.json)：原92表146855行未变，新隔离库148796行/schema9；39份原附件、6份tracked文件和原HEAD完全一致。
- [目录读取准入](catalog-binding.json)：实际schema3、125项descriptor可读，配对模型目录完整。

四张截图均在真实开发页38360/ui交互后保存并实际查看：

1. [Sol预检](01-sol-preflight.png)：实际OK。
2. [原Task限定输入](02-original-task-diagnostic-input.png)：保留原Task并只读核验。
3. [续跑结论与真实询问](03-resumed-original-task-question.png)：仍等待真实回答，没有提交批准。
4. [询问超时后的页面](04-readonly-recovery-result.png)：保留原证据结论并显示Question expired；后续真实no_action明确park，不能冒充操作者回答。

此批只证明选文重放与失败唤醒结算修复。终态自动Git提交、活动Review聚合口径继续调查；没有宣称全产品或原完整提交工作流通过，没有新增数据库迁移。
