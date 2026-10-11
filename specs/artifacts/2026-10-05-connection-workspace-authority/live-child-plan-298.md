# 298 子侧栏实时正文合并调查

## Recall

用户持续要求自主体验、修复Sources显示与子侧栏Rendering闪烁，最新要求只用单agent。297是有效进展，ccb8b24ec已推送、开始时工作区干净：修复主虚拟会话滚动时点击落背景，真实鼠标/键盘/弹窗/来源/工具验收通过。原子侧栏流式问题仍未知。本轮只有root进行代码调查与修复，不委托Codex子agent。

已读297 Recall、当前07-panel消息身份/子会话契约、SubagentConversationPanel、subagent-conversation、SideChat/事件路由/流游标、Task子正文与Session SSE（Server-Sent Events，服务端事件推送）路由、ProtocolStore、消息bridge、Session Part writer、processor的200ms前缀保存。全生产消费者只有子侧栏与SideChat；普通Chat/Mission共用Session路径，Task有live_sequence/live_epoch，SideChat连接快照会清空旧overlay。当前子侧栏HTTP（Hypertext Transfer Protocol，超文本传输协议）刷新只更新base，旧实时snapshot与messageInfo仍优先叠加；它不检查base游标，因此存在旧状态覆盖新读取的风险。这个代码事实还不能单独证明截图中的Rendering根因。

消息Part创建先发布并等待再发送delta；前缀周期保存与delta交付可能交错，bridge同步准备后按ProtocolStore分发，尚未取得真实错序证据。禁止先用最长字符串、保留旧DOM或延迟渲染掩盖问题。Task与Session读取边界不同，不能只修一个调用点再宣称共享问题根治；若证实队列/恢复/终态异常，立即按共享机制审计所有入口、轮次与隔离。

## 真实诊断方案

本轮单agent是Codex工作方式。为了进入产品真正的子侧栏流式路径，在全新隔离产品目录创建一条自然只读研究请求，要求产品仅一名研究成员读取三份指定官方网页并给出约1800字分段正文，负责人直接核对和收尾；不用于委托代码工作，不修改仓库文件或发布外部内容。所有产品消息与工具结果自然生成并完整可见。使用用户已授权的OpenAI凭据和相邻完整models目录，经成熟启动器分别验证凭据、目标投影及实际gpt-6.1-sol流式请求。密钥绝不进入提示词、日志、spec或Git。

先临时记录子侧栏实际base/live/display投影中每个文本Part的身份、长度及发生差异时的实际文本，和Markdown组件的真实挂载/退休/初始渲染状态；使用现有AppLog INFO，不改事件、数据、调度、handler或显示内容。消息内容只来自本次指定公共网页研究，仍在公开归档前执行精确凭据扫描。日志按真实变化去重和有界保存，不生成UI夹具、伪事件或自动化断言。通过开发模式/ui实际打开成员，在真实生成时人工查看截图。

临时诊断会影响耗时，因此只供定位；任何生产修复须补完直接触发、根因、旧路径不足、契约与全部消费者，再删除诊断、正常构建，并进行相应真实验收。纯数据契约测试只能证明局部合并，不能代替端到端或视觉。不得运行或新增UI自动化测试。

## 启动与闭合

新live-child-298-live-01/18258，先完成build后才启动。Task资格使用已有严格原生启动器：同一实例请求预算20，包含preflight和辅助调用；准备上限600000ms，实际接受Task后固定900000ms，原生物理上限1500000ms，不因进展续期。启动器持有Task真实request/Project/Session/epoch/生命周期身份，UI创建后据真实接受记录绑定；不以名称或模型自述作为完成依据。

长任务分阶段唤醒查看，避免持续日志监听。结束关闭自己页面、sole shutdown、原exec实际join、独立物理/输出/请求/端口/成对凭据清理、检查真实Task终态与全部Provider请求。失败保留原结果，不包装成通过。只修改本轮范围，同步文档索引、文档检查、范围提交、fetch/merge、审核全部待推送集合后正常push；goal持续active。

## 实际结果与边界

本轮由root独立完成，产品功能验收仅一个base-researcher。前端当前Chat/Mission模式选择没有独立Task创建入口，因此使用现有正式CLI task create，精确绑定真实接受的Task、Project、request和openedAt，再从真实/ui侧栏选择该Task并打开成员。没有注入消息、手写数据库或浏览器夹具。

实际Task tsk_g00VXk62Kd009TdxRiqF，研究员Session ses_hiMeFBUS0P1I5RrYejzV，epoch 1于2026-10-11T12:16:14.383Z完成。全程13次实际gpt-6.1-sol流式请求正常EOF（End of File，流读取结束），包含preflight和辅助请求。三条真实source-url、2921字符最终正文、表格与两个代码块均由真实模型/工具生成。W3C原路径404，研究员在可见正文说明并读取同篇.html地址；这是真实网页结果，不能抹掉原失败。

真实截图01至05覆盖来源生成、正文增长、回看三条来源、点击MDN实际网页和任务完成。页面中未观察到重复Rendering闪烁。临时诊断共500条触顶：73次正文投影样本未记录persisted前缀比displayed长，三位子侧栏文本owner分别从69/1/11字符读到69/92/1356字符，记录窗口内挂载后进入content，没有retired记录。这仅说明该窗口内观察，不证明未采样后半程或原Research Studio截图已解决。

诊断on(initial,...)接收的是普通函数，依赖变化时即使结果仍false也重复记录content，导致上限提前耗尽。后续若继续诊断应先将状态转为memo或显式去重，并让重要挂载/退休记录不被文本样本耗尽。这个诊断缺陷不属于产品渲染根因。本次撤掉全部诊断，三个生产文件恢复为原提交内容；不为尚未证实的旧overlay风险增加补丁、最长字符串或并行状态。

主会话首次加载同一Part在同一时间记录owner 2（77字符）退休、owner 3（14字符）挂载，随后恢复77字符。它发生于点击Task后首次呈现，不是子侧栏重复退休的证据。需后续结合主树快照/事件加载边界确定是否只是首屏重排；当前根因未知，不称共享调度异常。

原exec 98045真实join exit 0，独立检查Host/Native原生进程出生身份均终止、18258端口释放、auth/models成对清理。自己创建的52/53页已关闭，用户页面和服务未操作；五个本次Bun运行时文件按出生时刻/精确路径归档。证据、限制和后续方向见[本轮记录](live-child-298/README.md)。
