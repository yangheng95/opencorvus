# 侧聊 Goal 与 Sources 的实际执行体验

## Recall

544继续用户长期自主迭代要求，以最新仅单开发agent指令为准，不委托。优先反馈是Sources呈现、侧栏Rendering闪烁和Goal使用/默认页布局；不能以一次认证成功替代这些目标。上一轮543为明确进展：当前OpenCorvus热认证实际2次Sol流式200/原EOF、回复OK、正常shutdown/native/exec0和四配对成员退休，7618bc318已正常hook推送且fresh0/0。工作区仅保留原.bun/、packages/opencorvus/bun/缓存。

用户已授权内置浏览器调试和完整OpenAI凭据/模型目录配对的gpt-6.1-sol真实验收。已读543/542 Recall及结果、533 Goal真实执行记录、continuous-goal/06-provider架构、SideChatPanel/side-chat transport与后端identity/list、Goal store/controller/routes/UI service、TextPart/text-part-model、当前package scripts与543修正后的隔离工具。全仓搜索Goal owner、三个挂载、SideChat sourceSessionID、流/刷新和Rendering唯一显示路径。相关三个测试文件经imports确认是非UI transport/event合同，没有UI自动化；本轮不运行UI自动化。继续已使用的benchmark-debug-template和computer-use技能，UI只用真实操作和人工截图。

## 修改前分析与影响面

已知SideChat创建表单可保留草稿和预算，542修复了主/侧确认缺少具体归属名；另一用户任务已简化当前表单并同步OpenAPI。尚未验证SideChat真实Goal执行、预算结束/完成时侧栏正文及Sources的连续呈现。直接路径是侧栏独立Session→同一Goal接口/store→controller真实作者Message→原SessionWake与流→SideChat按messageID保留正文组件→同一Goal只读投影刷新。SideChat以metadata.sideChat.sourceSessionID链接主Chat，不以parent_id链接；kind=assistant且无Task归属，满足现行Chat Goal owner契约。尚未观察新的故障，不预先改产品。

Rendering只在Markdown仍pending且已提交块为0时出现；现行文本模型保留append结果和稳定HTML身份，SideChat列表保留messageID。可能风险在实际stream/终态/切换时的owner或内容重建、Sources开合和有限预算入口；具体触发与根因需要实页证明。若发现调度/队列/恢复/终态异常立即横审全部Task/Mission/Session正常/终态、重试/重启、串并行和多项目入口。公共API、数据schema、迁移、配置策略和版本发布预期不改；若需改动须补全定义/调用/历史和正向合同再实施。

## 先固定的执行与验收方案

1. 新side-goal-live-544-before隔离runtime，19085；必要修复后的独立after预留19087。每scope最多12真实模型尝试，before/after全批最多24，只先准备before；包含preflight、自然memory和SDK重试。各scope原生资源边界20分钟，启动/preflight采用既有180秒无活动判定。资源上限不是功能超时，读流及Goal已安全结算后立即关闭，文档整理在关闭后进行。
2. 当前正式Node Vite构建先完成，再复制当前App的完整OpenAI条目与相邻全models目录。固定Bun1.4.0、原413/446前台原生监督、543已验证的普通Source CLI与RealProviderAudit，清理环境并使用新唯一canonical配置。新空库由真实runtime初始化；不读取/复制/迁移用户库，不重启用户应用或操作原页面，不单独起Vite服务器。
3. preflight分别核对实际OAuth、Sol投影、实际请求型号/stream/200/EOF。通过自有/ui真实控件打开刚创建的真实Chat，再创建独立SideChat。主/侧目标确认名称、折叠预算可达、草稿正确；设置turnBudget=2，tokenBudget留空。
4. 实际Goal输入限定读取https://www.rfc-editor.org/rfc/rfc2606.txt并简短中文解释保留域名；每轮三句、保留真实来源，不委派、不创建业务任务、不修改文件、不运行命令，由操作员结束专项Goal。只用真实UI提交/批准必要只读网页权限/查看Sources及Details。至少取得实际正文、来源展开及预算/完成状态的截图并人工查看；不合成消息或为展示篡改数据库，不以DOM文本/类型检查充当视觉验收。
5. 用只读HTTP（Hypertext Transfer Protocol，超文本传输协议）与闭合SQLite记录实际主/侧身份、Goal事件/累计用量/两轮预算及真实Message/Source。若模型提前完成或阻塞，按实际状态处理，不能伪称两轮预算已覆盖。优先完成专项Goal后结清所有reader；公开shutdown200、原exec join/native/输出/request/精确出生结算，退休四配对成员，扫描凭据值。
6. 如有确证问题，补充真实触发、根因、旧路径原因与影响面，修唯一实现并在独立after实页复验。无问题则保留当前资格与未达项，不制造补丁。同步三索引、docs/architecture/适当聚焦检查、范围提交，fresh fetch/merge/待推集合审查、正常push。长期Goal保持active。

## before实测与修改前确证

正式Node构建1m3s，main-DZFqfqsm.js；原exec93170、独立页159、19085正常Source CLI。真实主Chat ses_h238eVWSwaYsklb8CifJ、侧聊ses_-zURCV8kZzz0a0as44PI；Goal pev_g0VYnV5Qb00mTZAM971f实际两轮自动续跑，网页权限按原Allow Once批准，真实webfetch读取RFC2606。主Chat Goal仍为空，侧Goal达到budget_limited/2/2/98693 tokens；同UI写入具体观察证据后complete，原累计值保留。6/12实际Sol请求全部流式200/API型号正确/原EOF，未见新的调度异常。实际截图04/05未捕获反复Rendering，不能扩大为所有生命周期均已排除闪烁。

确证Sources阅读故障：图08/09/10中展开完整Output后，指针位于实际来源正文区域的滚轮无法移动页面。只读DOM（Document Object Model，文档对象模型）显示来源content的clientHeight=scrollHeight=7699、overflow-y=auto、overscroll-behavior-y=contain；外侧侧聊scrollHeight=9593/clientHeight=254/scrollTop=595。相同一页滚轮移到侧栏左边缘后，图11真正呈现原文Abstract，父scrollTop=1315。前者不是空来源或Markdown异步Rendering，而是没有内部滚动范围的容器截断了向父级滚动。

全仓搜索唯一ToolPayload组件、messages.css两条规则、InlineToolPart的Input/Metadata/Output调用及当前07-panel-reactivity架构；git blame确认原contain继承自旧公共样式，而expanded规则只撤销max-height。ToolPayload自己的阅读恢复effect明确在expanded且非live时退出，说明该态已将阅读交给外层，但CSS仍保留了内部scroll container。MDN官方[overscroll-behavior说明](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overscroll-behavior)确认无可滚动溢出的scroll container仍处于边界，contain会阻断祖先滚动。

唯一修复方案：在现有expanded且非live的同一CSS规则中设置overflow:visible，撤销这个已经没有高度边界的内部scroll container，按原组件控制流由外层Conversation滚动。保留折叠/流中360px边界及内部阅读恢复，完整原文、换行、复制值、Source身份、顺序、缓存、接口与持久化不变。所有Chat/Task/Mission/侧聊/成员使用的该共享payload呈现均受益；没有新增JS监听器、第二滚动状态或例外路径。风险是展开内容外溢，现有pre/值的pre-wrap与overflow-wrap:anywhere已覆盖长行，实际after还需复核完整原文、折叠恢复、主/侧/中文显示。纯CSS改动不编写UI自动化测试。

before已完成专项Goal、关闭159，公开shutdown200，原exec/native/launcher均0，physical/output/request及原出生链结清，四配对成员退休。修复后的after改为完整只读复制这个闭合before的数据库与canonical配置，以同一实际主/侧/Goal/Source身份复核CSS；不是重造相似数据。仍用19087、独立12次上限和新自有20分钟边界，预检后只读同一原历史，不再创建业务Goal。完整枚举原表/字段/时间并在闭合后确认源保持，实际新preflight与租约变化分开记录。

## 修复后实页与闭合验收

生产改动仅messages.css原expanded/non-live规则的一行overflow:visible；当前07-panel-reactivity合同同步。CSS token检查8881引用/268token通过；after正式Node构建52.42秒，真实19087页面加载main-BsFxMhnc.js。没有添加或运行UI自动化，也没有为CSS改动制造后端mock测试。

after完整复制闭合before的90表1847原行。独立页160实际打开同一主/侧Chat、已完成Goal和8008字节RFC来源。图15展开时，正文clientHeight=scrollHeight=7699且overflowY=visible，父scrollTop=610；图16在相同正文坐标滚轮down1后父scrollTop=1330，实际原文Abstract进入视野。图17折叠后正文恢复358px/overflow:auto，原生滚轮使内部scrollTop从0→720，外层保持610；再次展开/折叠恢复内部720。不是删除内容、模拟滚动或只凭样式检查通过。

设置中通过原语言控件切为中文，图19的目标、来源操作及控件同步中文，用户/模型与RFC原文保持原样；正文区域滚轮同样可继续阅读。切换后实际模块仍为BsFxMhnc、lang=zh-CN。原主Chat展示、侧Goal complete/2轮/98693用量和原始Source身份保持。图07私有文件名source-body-readable实际是来源链接/域名与第一段回答；归档按实际画面命名source-link-and-reply，不能冒充完整原文截图。图09的0.4页滚动没有产生移动，不单独作为故障证据；图10同一点down1不动与图11边缘down1移动构成真实对照。

after只有两次新preflight Sol请求；全批实际8/24（before6、after2）均流式HTTP200/API型号一致/原EOF。159/160均关闭，两个公开shutdown均200，原exec93170/98022 join0、native和launcher0，physical/output/request及精确出生链结清，共8份runtime/private auth/models成员退休。两scope都在原自有资源边界内正常结束，没有deadline失败或扩大预算。源认证条目与metadata、完整模型目录字节与mtime保持，实际秘密值扫描0。

闭合数据checker逐表核对90表1847原行的主键/rowid/所有字段和时间、完整schema3对象、integrity和canonical配置。before源所有原数据及库size/mtime保持；after原行仅两条runtime_execution_capacity_lease的lease/owner/时间字段自然变化，原Goal、Message/Part、权限结果和Source均完整保留。Provider activity行4→5，与实际网络请求次数是不同计数，不混用。

归档checker首次只读tool_part_outcome.output而忽略该真实工具的resultAttemptID，正确地在正向完整输出验收处失败，未产出伪通过证据。按生产completedToolOutcomeOutput的唯一持久化合同追到permission_execution_result（kind=json/value.output），重新核对同一真实请求/结果ID，得8008字节和1条来源，与原webfetch的originalBytes一致；原输出未丢失。这是诊断读法修复，不是产品故障或新增兼容路径。完整[九张人工截图与正向事实](../../artifacts/2026-10-23-side-goal-live-experience/README.md)归档后再做实际凭据值扫描。

本批交付覆盖实际侧Goal创建→两轮预算→人工完成，以及同一Source完整展开滚动、折叠内部滚动、位置恢复和中英文显示。没有捕获反复Rendering，不据此宣称所有Task/Mission/重连/live生命周期均已完成；长期目标保持active，继续单agent排查。

交付复核：docs:check为345操作/26组、architecture-index为20文档、git diff --check均通过；17份待交付文本/图片约1.48MB实际凭据值扫描0。私有完整数据快照、临时启动器和诊断日志留在隔离临时目录，不混入产品提交；归档只含可审查的最小非秘密证据。最终提交、上游同步和正常push以Git实际输出为准。
