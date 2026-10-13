# 391 验收中新发现的委派错误传播

此项是待继续修复的共享终态调查，不能以本轮活动投影测试通过宣称完成，也尚未按单一场景降级。

真实scope `activity-input-projection-391-live`：child `ses_-zUS3Y9iKzzVF1wc1CZj`、input `msg_g0VXwRqJB006xS7s04a0`、assistant `msg_g0VXwRqM200gYTElRuC5`持久化finish=error，UnknownError原文为`AI_StreamProviderError: Our servers are currently overloaded. Please try again later.`；父delegate Tool却持久化ZodError/handoff最小长度错误。截图00同时显示父子错误。原始Message、Tool、协议事件在`live-failure.json`与`live-failure-detail.json`完整保留。

更严重的持久事实：成员原事件streaming→idle→terminal completed（`pev_g0VXwRqnq00NY2XBxJvr`），未成为error终态。delegate-agent.ts先无条件发布completed，然后从失败Message拼出空handoff并校验，catch再发布error已经被SessionStatus的首个已完成终态合同拒绝。禁止通过移除终态保护、放宽空handoff、隐藏原错误或只改展示掩盖。

已立即按公共机制查询全部SessionPrompt.prompt/loop、continuePersistedPrompt与SessionStatus.set入口：

| 路径 | 当前证据与待办 |
| --- | --- |
| Coding/Chat/Work session-local delegate | 直接读取返回Message却未处理info.error/finish；以上DB和真实页面证明错误完成先于handoff校验，需修真实writer。 |
| Task worker runner | finalize阶段先buildHardErrorFromFinalMessage，硬错误/输出上限抛AgentRunError；之后才publishSettledWorkerTerminal。需补本次同错误形态的正向回归。 |
| Task Orchestrator | agent.ts已在Task terminal与completed publication前用相同hard-error转换，prompt owner和physical settlement显式等待。不得改为delegate的简化路径。 |
| Session公共HTTP/Chat/Side/CLI/ACP | executePublicSessionPrompt返回真实Message；completedAssistantReplyForUserMessage明确区分error、tool-calls、summary及completed状态。失败Message作为协议事实可返回，不能把“Promise resolved”等同业务成功。具体CLI/ACP消费者仍需补核。 |
| Control及GitHub | Control使用assistantErrorText后抛错；GitHub原轮和summary轮分别检查info.error。Task派发结果另有DispatchOutcome契约。 |
| Mission/自动化/事件唤醒 | SessionWake绑定准确message/owner并等待Session结束；core processor错误保存Message并回到idle，Mission长期待命不等于目标完成。Mission执行关闭/恢复的全部事实仍需核对，不能因共用Loop就宣称已排除。 |
| 首终态保护/重试与重启 | SessionStatus.set首个terminal固定，符合防旧owner覆盖合同；delegate错误顺序必须在首次publication前修正。历史错误终态不得回写；新的输入轮次重试独立验证。SessionActor自然关闭、取消以及重启恢复的公共消费者待继续审计。 |
| 串并行/多Project | 事件和实际输入显式绑定Session/input，390已经验证身份多轮/多Project；本项仍需证明错误、取消、空正文和成功结果均以各自真实轮次收敛。 |

原Native范围在失败后关闭，Host71472/Target12024、页面12、launch11909和shutdown43829均闭合，auth/models复制对清理完成。6次Provider请求均流式且传输EOF，成员业务失败仍单独标记失败；不存在Sources视觉通过结论。本轮活动投影可独立继续验证；委派失败传播在此保持未完成，并在完整分析/新方案后修复。
