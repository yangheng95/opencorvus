# 385 权限恢复与消息结算证据

[Recall 与方案](../permission-message-settlement-plan-385.md) · [月度记录](../../../records/2026-10/2026-10-13-permission-message-settlement-385.md) · [原始384失败](../permission-message-recovery-384/README.md)

## 已验证结果

[规范证据复核](verification.json)汇总去重后的72项后台合同、289个断言。修复覆盖物理Prompt准入、同Message已批准调用收敛、释放间隙的新决定、原权限上下文结束后新工具执行、Message整体结算、真实Provider中断事实、请求首写身份以及成功请求的安全退休。

| 合同 | 测试 / 断言 |
| --- | --- |
| 消息恢复、受控流式新工具、并发与live peer | 6 / 39 |
| 结算、park/handoff、身份、项目范围、重放、退休 | 10 / 22 |
| Task两种进程断点与Mission待批准边界 | 3 / 24 |
| 既有权限续行恢复 | 8 / 25 |
| 双权限模式、授权与结果回放 | 17 / 56 |
| 传输层待批准请求恢复 | 1 / 4 |
| 383完整结果/Source恢复 | 11 / 44 |
| 处理器生产/消费边界 | 12 / 45 |
| 383实际进程退出与恢复 | 3 / 25 |
| Task activation释放后的结果结算 | 1 / 5 |

受控 HTTP（Hypertext Transfer Protocol，超文本传输协议）服务器经过真实Provider客户端和流式协议：旧Message的两个真实Read完成后，新模型轮的独立read也完成，两个模型请求均stream=true，新Source绑定新Tool/Message。正常与注入旧Provider未结束事实两种情况下均得到最终回复；后一种保留原Message的error，而不伪造原Provider成功。该服务器程序提供确定回复，不是真实Sol或其他真实大语言模型。

真实操作系统进程验证了：活跃peer收到live且原Message/owner保持；Task wait在effect receipt已提交、Tool已完成而Message尚未完成两处退出，新进程的正式Instance启动扫描完成一次真实wait；一个requested owner、一个effect、一份结果和一条wait registration保持，显式重放保持完成时间。Mission死亡owner与待批准Tool走正式process-recovery，已成功Read和Source保留，尚未执行的旧Tool得到真实process-execution-interrupted，正式wake仍可恢复。

## 失败与修正过程

全部日志保存在checks，原错误没有覆盖：

- 初始流式合同暴露夹具的旧build角色、缺少真实用户TextPart，以及跨测试已删除项目污染。已改用当前coding/mission身份、真实输入载体和每例数据库清理，重跑原路径。
- Task跨进程账本证明authorize在已决定请求重放时重复写requested；同一attempt曾被误算为多个成功结果。修正原子首写及按request identity读取，保留完整历史。
- 初版通用Prompt取得了Mission死亡owner后又释放，正式Mission恢复因此缺少证据。已复用既有Mission恢复入口，保留其真实中断/唤醒协议。补齐进程夹具的正式control-plane loaders后重跑成功。
- 请求不能在Tool完成时提前退休；现在先持久化完成Message，再退休成功续行。进程测试先读取真实启动扫描结果，再显式重放，避免手动调用掩盖漏恢复。

checks保存完整日志、证据复核器、归档器及凭据扫描记录。gzip完整解压字节与脱敏原件一致只证明归档完整性，不替代行为验收。没有用户进程或窗口操作；本轮自有测试worker结束时已从进程清单消失。

## 边界

本轮不改用户界面，不运行界面自动化，不复制凭据，也没有真实Sol或页面验收；受控协议测试和真实进程恢复不外推为真实模型端到端。没有新增schema或迁移，未升级/重置用户实例。383的旧schema准入限制与刷新失败、381的请求预算失败保持原结论。真实MCP长期任务服务与所有插件的独立恢复、真实Sol进程中断后的完整用户旅程仍未逐项验收，持续目标保持。
