# 392 委派失败与真实终态

[Recall、共享审计与方案](../delegate-terminal-plan-392.md)。修复391中已实际记录的Provider失败被空交接校验覆盖、并被提前发布为completed的错误。

单agent开发。本次没有委托开发子agent；真实页面中的一个session-local成员是被验收的产品能力。错误转换现在只有agent/run-error.ts一个定义，Task worker、Orchestrator与delegate均使用它。delegate先核对返回Message、原错误、取消、完成形态和非空交接，再发布绑定真实input/final Message的终态。

聚焦后端合同最终15pass/46断言，覆盖原Provider错误（含部分正文）、输出上限、取消、空交接、缺失错误诊断、父取消竞争及同/不同Project并行和持久事件回放。修前真正使用规范持久Message的基线0pass/8fail保留；前两次夹具缺字段与不可变Part错误也保留，不当产品证据。包typecheck、文档348个操作/26组、19份架构索引通过。

真实Native scope完成7次gpt-6.1-sol流式请求，启动前分别确认凭据可用、完整models目录已投影、实际模型一致。[实际数据检查](runtime-review.json)将Source与read Tool、真实Message、父子HTTP活动、Server-Sent Events（SSE，服务器发送事件）回放及全部持久生命周期关联。唯一terminal在最终Message完成后发布，携带其input与final_message_id，原记录未改写。

人工查看的完整截图：[实时Sources](01-live-sources.png)、[点击来源后高亮2—3行](02-source-range.png)、[刷新恢复的侧栏](03-refreshed-sources.png)。文件名、行号与目录保持可读，刷新后产出与交接输入归属保持一致。本轮未修改UI，使用此前已验收的389-final正式bundle；没有新增或运行UI自动化。

Host56440/Target4584在147737ms内退出，端口18425、页面14与原始launch/HTTP句柄均闭合；auth/models复制对已清理，原始凭据保留。完整脱敏归档还包括391提交后的push/module/release检查日志。

本次真实模型正常完成，没有重现Provider过载；修后真实Provider失败端到端、原Research Studio长历史与全部Task/Mission恢复资格仍未完成。ACP错误被当作end_turn的独立问题已记录，继续处理；整体goal仍active。
