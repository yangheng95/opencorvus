# 237 Sources之后的会话失败提示

## Recall

用户要求持续自主修复UI（User Interface，用户界面）和功能，当前重点Sources；最新只允许单agent。236真实Sol普通会话保存16条来源、9次工具结果，固定累计12次预算后第13次被验收工具拒绝；原foreground1/Native0分别保留并已提交推送2f7ed8042。不能提高、重发或重启原scope，不能把它当作成功Provider验收。用户IAB23/18107与其进程不操作。本轮使用完整真实失败历史，只读独立服务，没有凭据复制、模型调用、任务重启或委托。

已读236 Recall/canonical Sources/prose/messages/runtime及本人查看的budget-boundary截图；已搜ChatBubble、ConversationCard、Card、CardParts、tree-writer、message-part、SubagentConversationPanel、subagent-conversation、SideChatPanel、side-chat、当前07-panel及现错误CSS（Cascading Style Sheets，层叠样式表）与locale。未读取或运行UI自动化测试。已读成熟219全项目readiness/frontier及whole-history copy/native launch/archive/custody边界；Task（任务）历史脚本中的选定Task身份不适用于真实普通Session（会话），本轮私有助手将使用真实Session/Project身份，保留所有表逐行复制校验与原物理关闭证据，不虚构Task。

## 修改前问题深度与影响分析

可观察现象：236真实来源尾部显示Not running、Sources和引用操作，没有明确错误正文，要求的最终答案未完成。直接触发：已经有可见来源/工具结果，再发生真实assistant错误。数据根因分为两层：real-provider-audit第13次尝试拒绝是真实本轮预算边界；消息已持久化finish=error和UnknownError.data.message，writer的assistantMessageSettlement映射到唯一CardNode.status=error/errorReason。显示根因是ChatBubbleEmptyTurnState的!hasVisibleContent条件，已有Sources使正文错误被省略，仅剩长会话顶部header tooltip。旧路径保证空输出错误可见，但未覆盖有输出后的失败。

公共调用：Main经ConversationCard→ChatBubble；Side Chat经SideMessage→同ConversationCard；成员侧栏通过projectSubagentConversationCard→同组件；递归agent child调用当前EmptyTurnState。Generic Card的工具失败由InlineToolPart当前真实结果正文呈现，不改。CardHeaderChrome仍保留现有错误详情tooltip/复制，作为折叠与顶部入口。仅使用现CardNode.errorReason，不从session.error另建状态、不创建合成message/Part、不改协议或持久化。

范围与排除：没有发现Provider/Tool持久化或会话终态不收敛的证据；最后消息明确完成且error，Native关闭实际0。当前是已投影错误的展示缺口，调度/队列/唤醒/恢复修改不适用；完整历史重新启动前仍须横向核对所有Project配置、Task/Mission/Session、请求/工具/发布终态、当前租约与恢复入口，未知项不准入。Side Chat/成员共享调用证明影响范围，不能代替各自视觉矩阵。聚合成员historical error选择规则不在本轮改动范围。

## 实施方案与验收

先以当前代码/真实完整236历史创建独立只读UI（localhost开发服务的/ui）：fresh source physical/birth/port/pair，219当前schema/config/frontier生产reader；人工核对全部结果后才manifest/copy。全部90表原行内容直接比较（不用哈希），选中真实Session/Project/原目录。普通Session不调用Task oracle。Native由成熟ProcessFacade wrapper监督，独立固定900000ms，自己页面，尽快关闭；没有重置原236资格。

实现仅将现ChatBubbleEmptyTurnState替换为同一个失败正文组件，status=error且真实errorReason时显示，无论本轮已有Sources、工具或文字。Main/agent child正文末端（含children之后、steer之前）显示；复用msg-tool-error样式和现错误详情标题，无新持久化或UI状态。已折叠正文仍由既有展开操作控制，header入口继续可用。排除自动retry/工作流gate、Source文本加工、旧路径兼容、模型预算调整。现规则更改时同步去掉无内容参数与死计算。

负责agent本人在真实开发/ui查看before/after截图并修改复核；阅读首个真实长摘要到末段，折叠重开、尾部错误可见、上部Sources仍可读；英文浅色与中文深色观察。不发送新prompt/创建Side Chat，不伪造已验证的独立Side Chat/成员错误样本或流式帧稳定性。纯UI不新增测试；聚焦类型与build、docs/architecture是辅助，不能代替像素。

所有自己UI关闭后sole shutdown，原foreground/Native实际结局、physical/output/request与pair读回；全部观察器终态后最后精确birth/bounds归档自己Bun文件。完整canonical关键表逐行一致与所有Project文件差异人工复核，原失败字段必须仍存在。README/root/月索引同步、当前docs检查；范围提交、fetch/merge、完整outgoing审查与正常push。验收失败保留原结果，goal继续active。

风险：新正文会使失败turn稍增长并出现已有header/正文两个展示入口，但数据来源只有一个；自然跟随滚动可能在终态追加时移动，需实际看；极长错误使用现pre-wrap/word-break/scroll，不裁剪真实信息。Main虚拟退役、Side Chat独立错误、成员历史错误、实时失败新帧与Tauri仍未知。

## 实际收敛

当前readiness/frontier实际0：90表schema一致，两个Project44/63条inventory，四个terminal profile无wouldWrite；plugin/channel/command0，现browser/computer MCP（Model Context Protocol，模型上下文协议）仅原配置。零Task/Mission/dispatch/14恢复表；11个assistant已完成，Provider/Tool/发布/delivery均终态，9个权限成功，两份memory idle。550个当前lease winner仅原runtime_process永久lease未过期，其实际pid/birth已经独立dead_or_reused；两个capacity过期。人工审查后才manifest、完整90表逐行比较复制，普通Session/Project/原目录身份不改，不虚构Task。

own76/18169加载before main-CcagVDdu.js与after main-D6C0wXlu.js（真实HTTP200）。before-clean-tail确认Card已error但正文错误缺失；改为唯一ChatBubbleFailureState显示status/errorReason、删除内容条件和死计算，放在parts/children之后。after英文浅色与中文深色尾部清楚呈现真实预算错误，原header Native Tab提示仍可访问。真实3939字摘要Native Tab/End到末句、ShiftTab/Return关闭再Return重开均1069.333374；原Scroll to bottom可同时读来源末句和错误。五来源group原生Return展开。首次加载/重载home与直接locator Return尚未出现tooltip的原帧均保留、明确不作通过证据。

类型4166/build70884实际0（build50.70s），docs/architecture实际0。own76已关闭，sole shutdown0，原foreground90066与Native44820实际0，12:56:39Z物理/output/request闭合，早于原13:03:47Z固定期限；独立archive actual0，原输入历史13个核心表全行一致（Source与原失败都完整保留），两Project仅primary .git目录mtime变化，没有内容文件属性变化。完整当前400条日志/335条HTTP记录、unknown timestamp0、stdout/stderr脱敏归档actual0。独立Side Chat/成员/空输出失败、实时Rendering与Tauri未重新视觉验证。
