# Task终态检查点与协调恢复

## Recall

用户要求单agent持续自主找问题、分析后修复、真实页面验证、范围提交并正常合并上游/推送；不得只记录问题或继续围绕已修好的Rendering。793先修复Build协调出口跳过Host事实发布：25项正式后端合同通过，两模式真实Git/SQLite/SessionProcessor及失败、重试、恢复、删除和多Project并发覆盖；80次真实Sol流式请求中实际写文件、两项Python测试、协调前及中断重启后Review都验证了原不可变差异。整体Goal继续active。原场景完整提交工作流未通过，不能将单项修复包装成全流程成功。

继续工作前必须重读[上一轮Recall及结算](2026-10-29-build-handoff-observation.md)和[原始事实索引](../../artifacts/2026-10-29-build-handoff-observation/README.md)。源码当前已读engine/state.ts的terminalTask、engine/git.ts的checkpoint入口与命名、当前task-control-plane Git检查点合同；已全仓搜索终态checkpoint、EngineGit prepare/complete及原CompactionUserTextIntegrityError线索。完整调用点、实际错误源与共同根因尚未完成分析，以下均不得直接据名称补丁。

793两个自有服务均已公开shutdown200，原exec/native/launcher0、物理/输出/请求结清、成对凭据和全模型目录副本清退；IAB验收tab6关闭，用户18571未操作。原30min绝对截止不续期，不复开该付费阶段。原源库92表116096行完全不变；本轮QA库schema9、146855行、原附件27份逐字节不变。累计真实模型873。无额外代理、交付branch/worktree或数据库迁移。

## 现象与已证事实

实际Task为tsk_g00VZRQQAP00yaqEnUZF，Project为prj_h5W7734ywOJ64549AGYm，实现Session为ses_hqAWulrYXGNRzSZruMte。真实用户任务明确要求写文件和测试后请求协调，并在操作者确认前禁止本地commit。原执行者确实在真实request_orchestrator_decision处返回，Host观测art_hV82RiBkTPWCx2iDmjdP完整记录counter.py +1/-1、test_counter.py +15/-0并retained。

1. 首阶段checker本地请求上限64触发后，真实Git checkpoint result:1于12:39:04Z进入并在12:39:06Z以created_commit生成1b6ae6e649db0022aa197592e5a7c8f24d264ef8、移动主分支并收净两个文件。没有实际操作者提交确认。engine/state.ts terminalTask对completed/failed、非cancelled且非preExecutionInfrastructureFailure调用EngineGit.prepare/complete，Git请求/结果行与真实提交一致；不能归咎于Builder未守提示词。产品当前checkpoint公开合同允许repository publication，是否需要整体更改其分支/索引副作用、配置面和用户可见合同待完整审计；禁止用提示词关键字判断授权。
2. 同次本地预算错误期间持久化了55条E2E_REQUEST_BUDGET_EXHAUSTED失败Message，前三类Session涉及独立审阅、Task Orchestrator和Mission；Mission在约1秒节奏持续产生新失败回复。64是实际网络请求总数，55条本地拒绝不重复计为模型请求。该现象属于共享唤醒/终态收敛异常，必须立即横查全部生产入口、Task/Mission/Session执行轮次、终态/重试/重启、串并行与多Project隔离，不能归为某专家团或模型偶发。原停止及时结算，不保留后台重试者。
3. 同一数据的一次有界续验中，Mission实际调用panel_resume_task复用原Task；随后出现CompactionUserTextIntegrityError，明确指向保留来源prt_task-root-control_art_h2ha9iFjsVuwA50xxr6P_art_h2ha9iFjsVuwA50xxr6P的原身份/范围不匹配。错误全文及原时间见followup-facts；直接数据流、来源文本及首次构造点仍未知。完整性保护本身不能删除、弱化或以重新计算期望摘要绕过；应找到当前真实参与者的原输入与范围为何漂移，并保持用户文本完整可见。

另有活动期Review两种实际来源并列时摘要2文件、筛选All4及Lines unknown的口径差异；重启后只保留Build comparison时为All2/+16/-1。先查来源聚合和活动期事实生命周期，禁止隐藏来源或删除证据以改截图。此呈现问题不冒充前三项机制根因。

## 实施前调查与验收计划

先完整读取相关定义、生产调用、同语义实现、历史决策、当前架构和正向测试，将数据/控制根因及旧路径未根治原因补入此记录，明确公共接口、持久数据、测试、文档、交付与风险，分析未完成不修改生产代码。

终态Git横查baseline/result/acceptance_round所有入口、当前项目/managed worktree、多仓库树、HEAD/分支/索引/私有ref所有权，正常/失败/取消/接受修复及重启恢复，区分真实用户提交与Host数据保全；保持单一事实源，不能另加fallback、平行checkpoint或文案gate。需要更换合同就同步删除旧副作用路径，保留用户数据和已发布迁移。

唤醒/恢复横查显式Mission创建、Chat/Work handoff、用户输入、Task状态与协调通知、定时与恢复入口，物理发生轮次/输入消费/失败终态事实、持久队列与lease及启动重放。用真实数据库事实和正式checker重现，聚焦正向输出/状态/事件，不写“不再调用/不存在”型断言，不运行UI自动化或无目标全量测试。

压缩错误先从793关闭后的原件重现文本、身份和范围，沿真实control输入→Session/Turn→compaction source保存/恢复→Provider投影完整追踪，不构造伪消息或改写旧证据。确认当前合同后再修复唯一数据流。

实现后重跑原正式验收及相关恢复/隔离合同，启动新有限真实开发页场景，分别证明用户要求与实际Git效果、永久失败终态的有界收敛、同一真实输入的协调续跑。真实Provider须成对auth/models、目标投影和实际流式模型核对，开始前固定新阶段截止与额度，失败与中断如实保留。截图必须实际呈现并人工查看。任何修改均范围提交并fresh fetch/merge，审查完整待推集合、正常hooks与push；不发布Release/tag/PR。
