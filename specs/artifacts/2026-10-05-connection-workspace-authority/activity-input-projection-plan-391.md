# 391 历史活动与交接输入投影

## Recall

用户要求持续自主体验、修复与改进，重点是Sources显示和成员dock闪烁；最新人工约束仅单agent开发，旧goal的Astra委托文字不执行。上轮390是progress：4341de9807675b2c6170c53beef1b3eb27ffdd6c已正常推送，完整8工作区types、routes/docs、lease、architecture/package/release/module与secret检查通过。所有390页面/Native句柄/复制auth和models已闭合。首次三次配置类型检查失败仍保留，不改写。

本轮已读390 Recall、03与05实际截图、公开parent/child conversation和SSE原事实，当前conversation/view、MessageStore活动SQL、Session/Task conversation路由、transport-protocol活动定义、overlay conversation-agents、SubagentProgressGrid与subagent-presentation、相关backend活动/执行测试及07-panel-reactivity。全仓查询latestConversationAgentActivityByExecution、projectConversationAgentView和projectConversationAgentActivityPart定义/调用；Task route读取独立有界活动Map，普通Session/Side/Mission通过完整transcript投影活动，两条历史入口都必须修。开发不委托；实际成员只用于测试产品委派功能，沿用户已授权的gpt-6.1-sol流式验收。

## 根因与影响

390 child ses_-zUS3f1RWzzGYhiJ6sfA/input msg_g0VXwKyb3002di2ihcUN在未刷新03截图的进展为首段、read工具和最终正文三行；05刷新后多出一行英文交接输入，而Handoff context仍折叠。公开HTTP agentView.activity确实含该user Message的TextPart。这不是模型新增内容、Markdown闪烁或执行身份再次变化；同一持久原始Message/Part被恢复路径重复用于不同语义槽位。

实时applyLiveConversationAgentMessageUpdated对role=user不创建产出；PartUpdated把该正文投为inputPreview并返回，其他角色才进入activity。历史projectConversationAgentView则对transcript所有消息直接映射parts，无角色限制；Task使用MessageStore的独立有界读取，SQL显式把m.id=input_message_id并入活动范围，预执行Session范围也包括所有角色。现有compact tests创建user Message但没有其TextPart，所以此前没有证明输入和产出的归属。390仅统一执行actor，未更改活动来源，故不会根治本问题。

影响：Task正常/待执行/重连、普通Session、Mission、Side和委派的历史活动，输入附件也可能占据24项活动额度。定义、调用、SDK（Software Development Kit，软件开发工具包）形状不改；原始Message、Part、inputPreview、来源身份及权限不改；全部消息仍在完整会话和交接区域可见。没有发现调度/队列/唤醒/恢复终态异常：这是读取分类差异，不改执行状态机。多轮、并行、多Project、终态读取以及时间上限仍沿当前精确occurrence查询；必须在SQL排序/限额前按真实role取assistant产出，不能按英文内容、消息标题或命名过滤。

## 实施方案

1. 先加真实DB正向测试，保存user正文/附件与assistant正文/工具/来源；明确断言原输入可从完整Message读取、inputPreview为真实输入，activity为成员产出的精确有序集合。分别证明Task compact query和Session transcript投影；复用原多轮/并行/限额正向测试并补真实输入正文。
2. MessageStore的活动范围只选择role=assistant的Message；有input时只取实际parentID匹配的回复。删除旧m.id=input分支。projectConversationAgentView映射活动时也仅映射role=assistant的Message。完整transcript、历史分页、user inputPreview保留真实内容，不加副本/缓存/fallback（后备路径）或UI补偿。
3. 更新当前架构活动合同和相关目录索引；不改UI控件、文案或模型提示词。所有已触及UI路径只做代码调查，不新增或运行UI自动化。
4. 新隔离Native开发服务/ui复用389-final正式UI（后端改动），成对授权auth/models，分别验证credential usable、catalog projected、实际模型gpt-6.1-sol且stream=true。600000ms总时限、180000ms无活动、20次累计请求不续期。真实页面生成一次有界只读成员，截图首段/工具/最终Source与进展；刷新重开再次人工检查一致，展开Handoff确认完整输入仍可读，打开Source确认第2—3行。规范DB/公开HTTP/协议/模型终态单独核验，不把UI文本或分数当视觉验收。

## 验收与风险

聚焦backend正向测试、types、docs:check、check:architecture-index及正常push hooks；Source/file/Tool contracts回归不得被角色分类改坏。若历史consumer有明确需要用户输入作为activity的当前合同，先调查并更新设计，不能盲删。保留原390失败与391修前证据；真实页面截图须人工查看。完成后精确关闭所有本轮页面/Native资源与复制凭据，提交本轮文件，fresh fetch/merge、审查完整待推送集合、正常push；不发布、不建分支/工作树。原Research Studio长历史及其他未覆盖场景不冒称完成，整体goal继续active。

## 原结果和实施边界

修前测试0pass/4fail，其中3项确实复现输入TextPart污染有界活动，新加transcript测试则遗漏真实Session ledger而返回空view（测试输入问题）。修后第一轮17pass/1fail仍是该ledger缺失；改用生产listConversationAgentSessionsForSessionTree后4项聚焦全部通过，其余14项在前次通过。类型检查通过。失败原日志全部保留，不能把新测试夹具问题算产品根因。

第一次真实Native scope `activity-input-projection-391-live` 失败：成员Message明确Provider过载，父Tool产生ZodError/handoff空值，持久成员终态却是completed。已经立即启动[横向调查](activity-input-projection-391/delegate-error-audit.md)，未将其降级为局部问题，也未改全局终态保护。此原范围已关闭、原句柄均exit0并清理复制凭据，6次传输EOF不等于成员业务成功。独立`after`范围使用同一修复/正式UI继续本轮活动与Source验收，不复用/续期失败Native scope；新暴露的委派错误路径继续作为未完成事项。

独立after完成：child ses_-zUS3Vepszzhhmpbd5rA/input msg_g0VXwULBG000W3YyCBME，7次真实流式请求。01与02实际截图显示刷新前后同样三行产出进展，03/04实际展开并滚动阅读完整交接与中文请求，05Source实际选中2—3行。HTTP agentView活动与完整assistant产出Part ID一致，inputPreview与原user正文一致，重连事件仍work。规范checker已通过。Host89084/Target69688在353887ms结算，页面13关闭、launch29035/HTTP reader14173/shutdown均exit0；复制auth/models清理。全部211完整脱敏归档、215文本/解压项凭据扫描0命中。types、docs:check（348 ops）、check:architecture-index（19文档）通过。剩余工作是正常范围提交/同步/push，以及下轮继续委派错误共享审计与修复；原整体目标继续active。
