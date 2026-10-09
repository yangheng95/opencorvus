# 249 侧栏完成后的真实耗时

## Recall

用户要求持续自主体验/修复产品，重点 Sources 和子侧栏 Rendering；最新只用 root 单 agent，不能采用旧目标中的 Astra/并行要求。248 为进展：流式列表沿唯一 parser 呈现，真实 Working 两帧早于实际 EOF（End of File，流结束），原 Native/foreground0与9次Sol stream/200/EOF、pair完整退役，79acb30c039ce3a78e782810dc99641fc43d6095 已推送，起始工作区干净。原子 agent Dock全程闪烁、终态垂直位移及全矩阵仍未达成。授权已有OpenAI完整auth/models、实际gpt-6.1-sol流式验收，不启动子agent、不触碰用户IAB23/18107、不建branch/worktree或发布。

已读248 Recall/Working及terminal照片与尺寸、SideMessage/ConversationCard/ChatBubble/CardHeaderChrome/cardDurationMs、子对话projector/Scroll调用者、AgentActivityRecord字段和已有terminal helper、tree-writer的assistantMessageSettlement/当前activity settlement、Message.TextPart与processor/loop时间写法、当前07-panel-reactivity/typography。全仓搜索确认SideMessage唯一按消息构建侧栏CardNode，projectSubagentConversationCard唯一生产caller是SubagentConversationScroll，两个返回值均缺timeCompleted；Main tree-writer已沿真实Message/当前activity完成事实提供该字段。检索既有subagent-conversation-service tests：纯transport/数据身份/事件覆盖，无组件/DOM（Document Object Model，文档对象模型）或视觉渲染；本轮不修改/运行它们，也不新增UI自动化。

## 修改前根因与范围

248真实Side在生成时有46s、结束后耗时消失。原canonical Message实际包含completed=18:57:58.637UTC；SideMessage仅用它决定completed status，没有传给CardDurationChip。该共享组件严格从node.time/timeCompleted计算完成耗时，只有running可以读当前时钟；缺字段导致终态返回null。子对话服务也漏完成字段，但其卡片代表整个选中的执行会话，不应借用最后一个可见Message的end：控制消息可被过滤、旧历史可跨轮次，真实当前AgentActivityRecord才是它已有status的authority。原Main正确，不能在共享chip里猜Date.now或按Part.time代替。

Side应保留同消息created/完成时间；子对话应使用同一selectedRecord.startedAt/completedAt与现isAgentActivityTerminalStatus，处于pending/running/idle时不能沿旧completedAt冻结时钟。删除projector的first visible message.time字段，避免旧历史作为当前执行耗时的第二来源；orderKey/消息边界不改。Scroll将status和timing都从已有selectedRecord取得，并在record与conversation SID不符时不投影，避免选择/恢复期间混用身份。无新存储、计时器、状态源、fallback（后备路径）、API（Application Programming Interface，应用编程接口）或模型流程门。

横向审计：Main普通/Task/Mission共享tree-writer终态Message/currentactivity字段；Side每条真实消息与继承历史经同SideMessage；子Dock当前源选取sessionRecords/selectedRecord，已有Source/Project/authority和execution occurrence（执行轮次）筛选，Clock只映射当前记录。正常/错误/中止沿真实completed事实；重试或新轮次的running阶段须以现terminal helper选择completedAt，不能借旧终态；cold reload/reentry从持久Info/actor投影；多项目和串并行不新增全局状态。未发现新的调度/队列/唤醒/执行终态失败，本轮是呈现字段遗漏，原248运行链全部实际0。原Research子Dock尚未物理复测，不能由Side或静态代码宣称其全程闪烁通过。

截图中intro的垂直位移不能只凭耗时消失解释：header有最小高度，输入区466→388、footer出现和Markdown批次均可能参与。原照片缺绑定对象边界，实际顺序仍未知；after记录同Card/header/首段/上条User与scroll/composer实际矩形，仅作为人工截图解释，未消除的位移另行追查。另有已证明的processor natural text-end重写Part.start，但耗时chip读Message/Activity，排除它作为本缺陷根因，本轮不顺手修backend。

## 实施与验收准入

纯UI（User Interface，用户界面）呈现适配：Side补timeCompleted；子Scroll从确切selectedRecord提供开始和终态时间，退役projector的旧显示时间。消息/transport/事件/持久层契约不变，不写UI组件/model/DOM/源码文案/快照/Playwright测试。typecheck/build/docs辅助，实际新开发 `/ui` 显示同长题的running与terminal耗时、正文/Source、关闭重开完成历史及空输入；完整表格/代码视窗能取得时实际看，不宣称未捕帧。若耗时仍丢失或时钟继续走，保留新失败、回到事实修复，不删除label遮蔽。

新scope准备R2026-10-10/completion-duration-249-live-01、E completion-duration-249/live-01、port18184，成熟NativeService固定600000ms/累计12实际请求；完整paired/catalog、credential usable/target projected/actualgpt-6.1-sol/stream分别预检。先备sole shutdown、原foreground join、独立closure、完整脱敏归档/canonical事实/精确自身pile，再启动；操作后及时close/退役，不扩期限、不重启原scope，不操作用户服务。

落盘方案先于生产修改，保存精确preimage，更新root/月/证据/current架构索引，当前docs/差异检查，范围commit，fetch/merge upstream、全待推送集合核查和保留hooks的普通push。goal持续，原子Dock与未验证范围明确保留。

实施时初次typecheck真实TS2741：CardNode.time是必填字段，删除旧显示时间后service返回的内容投影不能仍声明完整CardNode。全仓已确认唯一UI生产caller负责补当前selectedActivity时间；将内容投影类型准确收窄为Omit<CardNode,time/timeCompleted>，caller组装真实完整Card，不能用0/Date.now或保留first.time作兼容。原types日志保留，修后原验收重新执行。既有transport数据测试没有断言projector时钟字段，不修改/运行UI测试。首build实际0/49.74s是修前类型诊断阶段的辅助产物，最终类型/构建和真页面另有实际结果。

## 实际结果

最终typecheck57059实际join0/build90952实际join0/48.53s/renderer boundary1/1，当前main-CvIYQtNa.js确实进入自建IAB91。R completion-duration-249-live-01/18184，原fore62209、Target71392/Host75620，完整paired/preflight分别usable/projected/actualgpt-6.1-sol/stream。Main ses_-zUSPoDO8zzwTek0z4Xt/Source4/277字符；Side ses_-zUSPo7AjzzD0XQkUcFT/继承4消息，233字符真题/new User msg_2ab387b7-b776-4ec4-bdb4-e1866c66a052/Assistant msg_g0VXaByDO0097NwkUzpI/TextPart prt_g0VXaBzTB00hXUaexz83。Message原created19:34:47.734UTC、completed19:35:57.543UTC，实际69809ms；SourceReader最后字节19:35:57.292/EOF.482，最终3295原始字符。

19:35:19.825 Working31s正确格式首段；19:36:28.033/.235 terminal1m9s，同scrollTop407.3333435058594、标题top151.59375/height20、首段top185.59375/height117.55208587646484保持，client466→388。图片与keypress/frame先后不能靠DOM数字替代，旧248照片位移原因未知，不做猜测补丁。ArrowUp使top367.3333435058594，19:37:37.637固定1m9s截图、19:37:38.467整Dock真卸载后重开同SID/Message/耗时/标题首段边界保持；Source真标题/域名、继承抓取5s、代码/部分表格实际看过，输入空/可用。未捕全表格行列或原子Dock；后者仅代码/类型证明时间来源更正，不声称真实全面通过。

Own91关闭、sole shutdown、原fore62209 join实际0，原Native19:39:27左右0早于固定期限、9/12Sol200/stream/EOF、独立closure0、10893新日志/unknown0、pair完整退役。原页面/运行链和当时observers结束后归档5个精确本次pile；后来19:41:47.820追加terminal SQLite只读标量命令0，无新pile，保留真实先后不伪称running。所有本轮命令已join；无用户app操作/新agent/branch/worktree/release。原类型失败/初build与最终0分别保留，UI日志副本仅行尾换行规范、原件private保存；仍需docs/差异/范围提交/merge/push。目标active，Part.start独立问题和原Dock/全矩阵继续调查。

最终文档辅助检查：docs:check实际0（345ops/25groups），architecture-index实际0（18 current/links），unstaged diff --check实际0。当前formatDuration源码Math.floor(ms/1000)与真实69809ms→1m9s吻合，不是重算期望值的functional gate。提交仅3个UI呈现文件、当前架构、root/月/相关索引和249原事实；staged diff复查、普通fetch/merge upstream与完整outgoing审查后push，实际Git交付以提交/远端回读为准，不预称成功。
