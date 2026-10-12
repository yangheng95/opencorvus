# 355 原失败任务的真实恢复

[Recall与方案](../task-recovery-plan-355.md)。单agent真实验收已通过，并完成终态时长区域的可访问性呈现调整。本轮开始于2026-10-12，正式复核与交付跨入2026-10-13；运行证据时间均为UTC。

在原353失败Task的完整隔离副本中，通过真实18337/ui发送operator消息msg_g0VXqoHPx00EXTBTU6md。原epoch1失败pev_g0VXqR1Hl00rlGobCLYi保留；新epoch2于15:47:19.402Z开启、15:49:45.355Z完成，终态pev_g0VXqotpq00fY1Lp8jUs。操作没有创建新Task或新研究员；原launch99677实际exit0，监督器认定同一Task epoch2完成、10个真实Provider请求EOF与原生收尾。

[实际数据checker结果](actual-recovery-check.json)逐Part ID/Message ID比较原37段assistant正文与本轮真实read_agent_message返回：全部5499字符完整读取，原36个Source保留。完整正文分别来自未截断reference/inventory字段、显式evidence_reads和结算message正文，每份都与原始字符串完全相同；不能仅依据preview命名或模型自述算作阅读。初版checker漏计较长但完整的inventory字段，已按当前真实工具合同补足并重跑。新实际工具序列为read_task_message、4次read_agent_message、manage_task，六项均完成；报告包含R01–R36逐项核对。人工通读最终报告，确认R03的null澄清、R26/R28/R32的资料范围限制与五次历史模型中断说明保留，没有把资料语义当作UI交互通过。

实际凭据可用、完整catalog已投影；10次请求模型均为gpt-6.1-sol且streaming，预算32。任务最大900000ms从真实epoch2 openedAt开始，180000ms无活动边界未触发。原Task失败没有改写为成功；本轮证明用户消息可以开启新的成功轮次。自动流内重放策略未改变，上游服务可用性也未被本地修复。

UI（User Interface，用户界面）交付：旧TaskStatusHeader通过CSS隐藏terminal且inactive时的Not running文字，但仍在其title/aria-label保留。旧架构明确允许这点，本轮作为体验调整，统一文字、tooltip、可访问性名称的可见性；独立TaskOutcomeBadge仍是终态唯一展示，普通Chat/Mission活动语义保持。删除只服务旧隐藏路径的CSS规则和data属性，同步07-panel合同。

- [原失败与可用模型](01-original-failure-ready.png)、[真实发送](02-operator-message-sent.png)、[新轮次Running](03-reopened-active.png)、[流式报告](04-live-review-stream.png)。
- [完整收尾](05-epoch-two-completed-report.png)、[原Sources与R36](06-recovered-original-sources.png)、[Dock重开位置保持](07-recovered-dock-return.png)。
- [正式完成标题](08-formal-completed-header.png)及[实际AX记录](08-header-accessibility.txt.gz)：Completed徽标与2m25s时长分别表达同一可见信息。
- [普通Chat活动](09-ordinary-chat-activity.png)及[实际AX记录](09-ordinary-chat-activity.txt.gz)：Not running仍可见且可访问。原AX输出含列表标记尾随空白，按完整字节压缩保留，未为格式检查改写原记录。

9张截图均实际呈现并人工查看。正式main-WAUr09QC.js通过新90表完整副本18338/ui复核；该历史副本没有凭据。typecheck16644与build51402实际exit0，CSS token检查、docs:check（345操作/25组）通过；没有新增或运行UI自动化测试。原live页面150、history页面151均先关闭；history原launch77370实际exit0，两套Native/Host/端口/output/request和auth/models配对闭合。持续迭代目标保持active，范围外的原研究工作区大样本来源验收仍不由本轮36来源测试代替。
