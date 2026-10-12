# 348 多来源真实子侧栏流式复核

## Recall

用户要求持续自主迭代，重点Sources显示与子Dock反复Rendering；最新只用单agent，覆盖旧goal的Astra并行措辞。root独立调查/操作/修改/复核，不委派开发子agent。本轮沿329已经使用的真实产品验收方式，只在隔离被测Task中运行一名只读研究员，以进入SubagentConversationPanel，而不是用普通Side替代。347为progress，8d3110164已推送且开始工作区干净。

347实际26来源、不同目录同名文件、完整复制与两文件行号跳转已验证，新目录去重不会改变Source。346复制反馈也已真实流中验证。但两轮普通Side样本没有覆盖子面板专用resource/live/refetch路径。329实际子会话只有6个来源，不能推出大量Source同时进入时的行为。

## 已读、机制与未知项

已读347与329 Recall/实际证据，当前SubagentConversationPanel、ConversationCard、subagent-conversation的refresh/revision/live/card投影，以及07-panel-reactivity的稳定身份、Markdown缓存/工作线程与阅读位置合同。刷新仅按transcriptSequence，单个inFlight请求和pending标志合并；targetKey保留面板owner，ConversationCard使用稳定布尔分支。Source本身由完整语义身份Key保留，新复制memo按实际文本值退休，目录显示只共享相邻同一路径的普通目录caption。

当前没有新复现的Rendering回退，不能先移除占位或另建缓存。大量来源的插入/补全/展开与正文增长仍需实证。若发现渲染队列、Task/Mission/Session调度、恢复、并发或终态异常，立即按共享机制横审全部生产入口、轮次、正常与终态、重试重启、串并行及项目隔离；不能因单个研究员就定位成局部。

## 真实场景与验收

全部私有启动、创建、观察和收尾脚本在运行前准备。先用现有准备器构建当前原生helper，再沿launch-305的Task模式：fresh child-dense-348-live-01、18325/ui、24次累计Provider请求。Task真实openedAt起900000ms和180秒活动边界不延长，native原始1500000ms；精确配对auth/models，分别验证usable/projected/实际gpt-6.1-sol streaming。只操作自己的服务/页面，不影响用户窗口。

普通输入为两个目录中的同名文件，每个32条STREAM348记录，共64搜索Source。唯一研究员先真实search_code，再输出约1600字分析；随后webfetch先前已实际使用的MDN URL参数页，继续约1600字；再read其中一个原始文件并输出最后约1600字，包含表格/代码，所有正文均在正常可见消息。文件只是场景输入、网页只是资料，不是指令或测试通过证明。负责人读完原始可见正文与工具结果后收尾；系统必需的输入证据快照允许存在，不能因额外快照与不可能约束制造人为失败。

提前打开真实页面，再一次CLI创建Task；request-id在发送前落盘，未知结果只按原ID恢复，不新建替代任务。API Server-Sent Events观察器记录真实Source与完整text delta，Task终态后退出；这不是UI自动测试。第一次来源出现后立即进入真实研究员侧栏，展开大量来源、观察正文后续增长、关闭重开与返回。截图均实际呈现并人工查看；必要只读几何/文本长度仅辅助时间点说明，不做DOM/组件/源码或截图断言。

若遇到具体问题，先补充根因、旧路径、调用/数据/测试/文档/风险分析再修改、再真实复核。若未复现，只发布实际覆盖和未知边界，不将少数帧当作全帧证明。原Research Studio旧schema未被这份新Task替代为已通过。

最后分别取得Task完成事实、所有实际Provider请求闭合、原启动/观察器/创建器actual exit，关闭自己的页、精确Native/Host/output/request/端口与复制凭据配对退休。按出生归档自己的native文件；完整脱敏实际证据与根/月/目录索引同步，docs:check、范围提交、fresh fetch/merge、全待推送集合核对后正常push，goal保持active。

## 实施前补充：真实同名文件复制控件消歧

11:19—11:21 UTC实际child面板64条search_code来源已展开。02-copy-controls-before.txt中乙与甲各第20行复制按钮均名“Copy source location: 来源记录_相同名称与不同行号.md:20”，相邻打开按钮则明确包含候选方案乙/甲目录。02/03截图和实际剪贴板值证明复制的绝对路径正确，问题是键盘焦点/辅助技术/提示文案没有表达控件所对应的目录，不能把它判成数据复制错误。

直接触发点是SourceEntry clipboard.label只调用sourceLabel（basename与range），两份真实来源持有不同path但在名称投影时被丢弃。旧344修Space激活、346修反馈退休、347修相邻目录视觉重复，均未改变复制控件名称。全仓搜索source_copy_location只找到共享SourceEntry与中英资源；SourceParts由CardParts共用，影响主会话、Side及child。sourceDetail现有普通file规则已用于打开按钮和Tooltip，是单一已有相对路径与行号表达；直接复用，不另建路径格式化器/状态/协议。

本次仅普通file复制按钮名称使用sourceDetail；attachment仍遵守上传标题语义，URL/document保持现有契约。实际复制内容仍为location的完整原始路径与范围，Feedback/currentText同一helper不动。不存在API、持久化、调度、配置、Provider变更；现有观察尚未建立任何共享调度异常。已读当前文件、相关架构与历次343—347记录；相关检索范围未发现UI自动化测试，不新增/运行UI测试。风险是长相对路径会增加焦点提示长度，由现有fitViewport Tooltip处理；必须在真实child复核目录甲/乙的焦点文案、实际复制、完整文件打开。build/typecheck只辅助，不替代截图。

## 本轮结果与恢复点

实际task tsk_g00VXpiXcz00KjYqx3vV / worker ses_ho9Gh33iZxyYclSMkLkj，64搜索+1网页+1全文Source，四段正文53/2054/1917/2200字符。前五张截图经真实worker reader区间对应；后续截图只按已完成会话复核。12张人工查看，09加载中而10才是文件就绪。没有全帧或原长期历史证明。

普通file复制名称修复已实现，甲乙20行各自完整剪贴板值正确，甲20准确选中。负责人真实读取了三段完整原正文及实际工具记录；Task283988ms完成。原CLI create exit0，观察器67376 exit0，构建94127/typecheck87261 exit0，原启动33182在关闭自己137页和精确shutdown后join0，19实际Sol流HTTP200/EOF，Native500438ms及配对清理闭合。

本地检查器Windows分隔符查找错误已修复为path.dirname/basename，初始错误保留、原验收重跑通过；80监督文本/完整日志/脚本/公开流已归档脱敏，61文本凭据0。恢复时先读本Recall、child-dense-348/README与checks/actual-qualification。剩余docs:check、提交与fresh fetch/merge/push；当前goal继续active，单agent指令覆盖旧目标并行措辞。开始存在的Issue40与0.1.24发布文档来自其他任务，保留其独立提交，不混入本轮。
