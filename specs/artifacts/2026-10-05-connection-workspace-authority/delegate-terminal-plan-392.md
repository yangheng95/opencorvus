# 392 委派成员的真实失败与终态

## Recall

用户要求持续自主改进产品，重点是Sources与成员dock；最新人工指令仅单agent开发，旧goal并行文字不执行。391为progress：0370acd0fbde71e1fd49a832a2a8f3262574be35已在远端main，正常push51206 exit0因并发发布显示Everything up-to-date；8工作区types、docs/routes/lease/package/secret通过，另对精确0370执行module（1151模块/5895边/4 clean imports）与release-mutation检查通过。两个391 Native scope、页面12/13、原句柄和复制auth/models均闭合。该批修复历史活动中的重复交接输入；新发现的错误传播/终态问题未修，保持原失败记录。

已读391 Recall和delegate-error-audit、原live-failure-detail、delegate-agent、SessionPrompt公开入口/run/owner/SessionStatus、Session/Tool/Message错误类型、completed-reply、Task runner/Orchestrator、Control/GitHub/CLI/ACP、Mission wake/recovery/closure以及task-control-plane合同。全仓检索SessionPrompt.prompt/loop/continuePersistedPrompt、SessionStatus.set、AgentRunError/buildHardErrorFromFinalMessage和SessionActor。后者只有namespace定义，无生产引用；本轮不扩大为删除无关死代码。已读既有delegate-agent成功测试：其返回Message是未持久化的旧形状，需要按现在的精确输入/输出合同改为真实持久消息，mock只作为Prompt边界的局部合同，不称端到端。

## 根因和影响面

真实391-live child ses_-zUS3Y9iKzzVF1wc1CZj，input msg_g0VXwRqJB006xS7s04a0，assistant msg_g0VXwRqM200gYTElRuC5已保存finish=error和UnknownError/Provider过载正文。父delegate Tool却保存ZodError/handoff空字符串，child协议最后是terminal completed（pev_g0VXwRqnq00NY2XBxJvr）。delegate-agent把Prompt Promise返回当成功：未读info.error/finish就发布completed，再校验文本；catch的error终态被正确的首终态保护拒绝。仅调整错误文案、放宽空handoff或改全局终态锁都不解决真实writer错误。

错误与完整性契约影响provider error（含仍有部分正文）、输出上限、取消、空交接、正常完成及对精确input/final Message的归属。既有Task hard-error转换可复用，但不应让Tool导入整个Task runner：把当前唯一AgentRunError与buildHardErrorFromFinalMessage移入轻量agent模块，并同步迁移全部内部引用，删除原定义且不保留兼容转发。HTTP/SDK/Tool成功JSON形状不改；现有lifecycle可选final_message_id可以携带真实返回Message，inputMessageID显式绑定其parent输入。真实失败Message/Part保留，不合成用户或assistant消息。

## 共享横向审计

| 生产入口/路径 | 当前事实及边界 |
| --- | --- |
| Session-local Coding/Chat/Work委派 | 仅conversation authority准入，真实新child已有parent Session/Tool绑定；漏检错误、成功发布顺序错误已由实际DB/协议/页面复现。各并行调用创建独立Session，需正向测试验证失败/成功各自输入与终态。 |
| Task worker | completeProjectedWorkerTurn在publishSettledWorkerTerminal前调用共享hard-error转换；物理settlement的outcome标签用于关闭诊断，不发布completed。保留原descriptor、Task binding、physical owner和取消语义；加相同持久错误形态的共享转换正向检查。 |
| Task Orchestrator | 相同转换在Task terminal publication前执行，异常再走settleOrchestratorExecutionFailure。保留现有execution epoch/显式重试；本轮不宣称真实Task Provider失败端到端已覆盖。 |
| 公共Session/Chat/Side/CLI | API可返回失败Message这一真实事实；completed-reply明确区分settled与completed。CLI精确读取自身输入的info.error后抛出，不靠无输入ID的session.error猜归属。 |
| Control/GitHub | Control检查assistantErrorText；GitHub原轮和summary轮检查info.error后抛错，未发现本次硬错误被这些消费者发布为completed的相同writer。 |
| Mission/自动化/事件wake/重启 | SessionWake绑定真实message/owner并等结束；processor持久错误后idle不代表Mission完成。Mission closed有独立opened occurrence和物理owner/未完assistant frontier约束；恢复以原Message/控制与已证dead generation驱动，不改成新队列。本轮保留这些路径，全部真实恢复场景资格仍不扩大宣称。 |
| ACP（Agent Client Protocol，智能体客户端协议） | prompt/command返回当前会无条件end_turn，发现另一处返回错误被忽略的缺口；需独立协议正向验收后接续修，不宣称整个公共错误投影已全部修好。已查官方[Prompt Turn](https://agentclientprotocol.com/protocol/v1/prompt-turn)：结束原因区分正常、取消和输出上限。 |
| 公共终态保护/串并行/多Project | 首个terminal固定是防旧owner覆盖事实的合同；必须修首次publication之前的判断。精确Session/input/final Message约束、相同与不同Project并行和持久Protocol回放分别验收，不覆写历史错误事件。 |

## 实施与验收方案

1. 先把delegate局部测试的Prompt返回物改为真实持久user/assistant/Part，保持实际工具execute和Protocol bridge；补过载空正文/部分正文、上限、取消、正常空交接、正常完成，断言明确Error/cause、精确terminal状态与input/final identity，修前失败日志保留。验证失败后独立新调用及同/不同Project并行；失败原记录不改写。
2. 迁移唯一AgentRunError/hard-error转换。保留其Task取消处理合同；对finish=error但没有error记录给明确诊断完整性错误，避免把坏错误形态当成功。delegate先核验返回assistant归属、原错误/取消与completed-reply，再生成合法非空交接；最后发布completed。catch依据真实取消或硬错误发布各自终态，使用返回消息的精确输入/最终Message；不改全局first-terminal规则。
3. 聚焦backend正向检查和types/docs/architecture。真实开发/ui、新Native隔离scope，成对auth/models预检且实际gpt-6.1-sol流式，20累计请求、180000ms无活动、600000ms资源预算。通过真实页面再次做有界成员读取Source；若自然复现Provider失败，单独核对原错误、父Tool与持久error终态，保留原失败；若未复现，明确局部错误合同与真实成功路径的不同资格，不把stub冒充真实Provider错误端到端。
4. 所有UI资格仅真实交互、截图、人工复核；复用未改的正式UI，不新增/运行UI自动化。原句柄/Job/output/request/端口/页面及复制凭据清理，完整脱敏归档、范围commit、fresh fetch/merge/待推送集合审查/正常push。原Research Studio长历史及ACP等后续事项仍在整体active goal内。

## 当前实施与原检查记录

AgentRunError与转换已迁入agent/run-error.ts，runner/Orchestrator和delegate同步引用；旧定义/过时位置注释删除，没有转发兼容层。delegate检查真实assistant Session归属、ctx取消、原错误/输出上限/错误诊断完整性、真实completed reply与非空handoff后才发布completed。返回后的所有终态都绑定实际parent input与final Message；取消返回用MessageAbortedError，原始Message/Part不改。全局终态保护不变。

测试夹具第一次缺tokens.total，第二阶段又以非原子方式在已完成Message之后追加Part，分别被真实schema与immutable admission拒绝。这两类夹具失败不当产品根因，原日志before-tests/before-contract-tests/after-tests保留；夹具现使用Session.persistMessage原子保存完整回复。仅将本任务delegate补丁精确反向再恢复，重跑原writer的before-canonical-tests：6类错误/取消/空交接被错误完成，2个成功用例尚无新final-message关联，共0pass/8fail。修后相同合同13pass，补父取消竞争及同/异Project并行后最终15pass/46断言；持久Protocol、原消息与重入回放均检查。types通过。UTC+8日期已到2026-10-14，新Native使用该日独立目录。

## 真实验收和剩余项

392-live正常结束；child ses_-zUS3ECxnzzAYeefUeoJ、input msg_g0VXwln3q00ESBcR3bU0、final msg_g0VXwloQX008mxDjSX23。持久Protocol的session aggregate用aggregate_id定位，其session_id列为null；公开投影才提供session_id。checker按真实存储合同读取全部lifecycle，唯一terminal pev_g0VXwlqQX00kxoA3XvUj在final完成后，含对应input/final；HTTP与SSE相同。7次真实Sol流式请求，Source指向原文件2—3行。人工截图01–03确认实时、打开行区间与刷新恢复；没有UI自动化。原始launch87832、HTTP89495、shutdown正常exit0；Host56440/Target4584在147737ms完成Native关闭和凭据复制对清理。docs348/26、architecture19通过。

本次未自然复现Provider失败，故只将正常路径称真实端到端。修后错误路径资格来自15项后端合同；历史391错误证据保持原状。ACP、原Research Studio长历史和全部Task/Mission真实恢复仍待完成。接下来先完成392范围提交与正常推送，再继续ACP调查和聚焦协议验收。
