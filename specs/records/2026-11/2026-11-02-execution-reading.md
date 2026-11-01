# 执行、来源与成果的可理解性

## Recall

用户要求持续自主排查完整UI（User Interface，用户界面）与功能、实际验证后提交推送，并明确“整个UI界面让人迷惑的地方可不止这一处”。最新直接约束是只用单agent、不操作正在使用的窗口/18571；旧Goal中三个Astra文字已被用户后续单agent指令覆盖。用户已明确授权使用原OpenAI认证及配对完整模型目录做GPT-6.1 Sol端到端，并要求本人刷新登录；874已按现有Provider generation owner续期成功，不重复登录或使用管理权限。

上一轮是实际进展：533d0f05b已正常推送，远端main与本地0/0；入口/文档/审阅/焦点改动、37张实页原图、8个真实流式请求、归档恢复继续通过。875继续执行/来源/成果理解链路，不把874结果当作本轮通过，更不倒填原873未完成。持续Goal保持active。

本轮前工作区179条无关媒体删除/索引修改保留。已读874 Recall/结果、当前07-panel执行/来源/文件阅读合同、utils/tool、CardParts、InlineToolPart、SourceParts及ToolPayload；已搜索全部describeToolCall/Part、displayToolIconName及同义命名。后续补查折叠活动/输入/原始标识owner、既有来源样本及真实页面，在根因/影响明确后落盘具体方案再改产品。

## 修改前调查与影响分析

- 已见现象：874真实任务里read、apply_patch、bash等技术ID与文件来源并列，尚未说明面向普通用户的操作；复杂Task成果还带较多执行身份。是否网页Sources存在新问题目前未知，不能只凭旧截图或命名定根因。
- 定义/调用：utils/tool.describeToolCall同时被CardParts、InlineToolPart与session dialog调用，返回label原始ID；InlineToolPart另直接render toolName()，而CardParts使用display.label，两个显示读口会阻止统一。displayToolIconName另被CardHeader调用。后续在同一现有显示owner处理，工具真实ID、参数、结果、状态和Source顺序必须保留，不改模型可用工具/路由/提示词或消息协议。
- 旧路径遗漏：874优先入口、文档、审阅与焦点，明确保留了工具标识及高级原文，不代表执行区已可理解。任何名称改进应覆盖主/侧/成员与旧会话读取，不能另造一套摘要消息或按关键词猜模型进展。
- Sources合同：原Source publisher title、URL/文件/范围、原文摘录、复制与打开沿用原权威；已有首条直达、其余折叠、来源同名区分和片段位置语义保留。先实测本地与网页来源，未知处不预填通过。
- 文档共性遗漏：07-panel约760已写Markdown新身份无range默认Preview，但约800旧句仍写所有新资源默认Source，与874实现冲突；本轮同步改为相同唯一合同，不保留双源表述。
- 数据/风险：从已闭合合格874-focus复制（schema9/92表、251392行、95项目、223附件、累计1235请求）；不触碰真实用户DB，不改schema/调度/权限。真实新QA项目可正常产生数据，全部旧行/原项目业务/Git/附件保护。若出现调度/队列/恢复/并发/终态异常，立即按AGENTS共享机制全入口横审。
- 验收：禁止UI自动化/文案或DOM断言/组件/截图基线。真实CLI `/ui/`后台交互与原图人工复核；纯显示改动不新增测试，非UI契约如有变化须聚焦正向测试。遇到已有UI测试须删除不运行；已读tool-path.test仅服务器路径关系正向数据合同，本轮尚不改路径关系，不运行无关测试。
- 交付：具体实施方案先于产品修改；root specs三索引与docs:check同步，范围清晰提交，fresh fetch/普通merge、完整待推送集合与正常hook/push，不创建分支、worktree或发布。

## 首次资源和真实输入

875 before/after首次各16个精确Sol流式请求，共用首次准备前落盘75分钟绝对截止并至少留5分钟正常闭合；不提升live额度、不重启旧occurrence（执行轮次）、不延长截止，失败/未用额度分别退休。before页面复用当前已交付、已实际构建的874-focus UI产物及原构建回执，不伪称重新构建；after必须构建当前修改代码。新实例均从闭合资格来源复制，配对完整auth/models、分别验证原凭据和模型投影/实际请求；不把目录缺失误报认证。认证内容不进prompt/日志/规格/Git。

在本人新项目放明确合成的任务简报，只读取给定两份官方网页与本地brief，写一份中文Markdown参考笔记并回读核对，保留真正来源。仅当前会话、项目、单agent，不创建Task/其他agent，不安装、不提交推送。网页原文和Source事实保真，不用夹具替代。具体URL/可访问性在运行前确认；模型请求计数以真实Provider audit为准。原native句柄、public shutdown200、精确出生链与物理/输出/请求结清、配对副本退休和完整旧数据资格均需收集。

## 实页根因与实施方案（产品修改前）

875-before的真实Sol会话ses_-zUQFwhQIzzDtCnSCPjY完成7个HTTP200/流式EOF请求，依次读取brief、抓取Python csv/json两份官方文档、写入并回读reference-notes.md。4个原始Source及两份网页title/URL/toolPartID均正确。01–03原图显示：连续webfetch合并后展示最后一次json网址，但同排Sources首先展示csv标题，聚合操作和首条来源因此看似错误配对。展开后原始顺序和对应关系正确，排除数据错配；旧的两列紧凑布局没有区分单次与聚合操作，是直接显示根因。

1. 现有utils/tool内以一份精确工具ID映射同时提供图标与本地化动作名称，替换原图标分支；未知扩展工具保留真实名称。不按文本关键词猜行为。describeToolCall保持原始name用于参数/结果/退出码解析，另给label作显示。CardParts、InlineToolPart、session dialog、派生成员活动及原始工具卡标题统一读取这一owner；原始ID保留在名称title和展开输入标题，原始JSON/结果/状态/失败不变。
2. ExecutionEventRun以现有tools列表派生多次操作属性，messages.css仅在聚合操作时让Sources单独占完整一行。单次操作保持当前密度；既有首条直达、其余原生Disclosure、完整来源标题/URL/原文/复制/打开不改变。不新增Source数据/状态/平行render。
3. 次数文案改为操作/Actions，并补全中英动作与输入身份文案。apply_patch的成功摘要是生产者原文，当前文件变化helper反向依赖tool；本轮不另造英文结果解析、不引入循环依赖，成果仍通过现有审阅与当前文件入口阅读。
4. 07-panel同步统一新Markdown身份无range默认Preview、其他资源Source的合同，补充显示名称和原始身份的职责。工具注册/模型请求/消息/持久化/调度/权限/schema不变，无非UI协议改动。

875-before已正常shutdown200、原native句柄exit0、物理与输出结清，7请求+9未用额度退休；完整251392旧行、95项目业务/Git、223附件及原schema9/92表保护验证通过。after从该闭合资格来源准备，仍使用首次16请求和原绝对截止。真实中文/英文页面核验折叠/展开操作、两份来源、技术输入、来源复制/打开、本地成果、窄工作区；只做人工交互/原图复核，不运行UI自动化。随后正常构建/本地化/样式/docs检查与提交推送。

## 实施与实际验收

执行显示的图标/名称已合并到原utils/tool内唯一精确ID映射；调用的真实name与本地化label分开，参数/结果/命令退出码继续使用name。主对话、InlineToolPart、原工具卡、session dialog和派生成员活动共用该owner，原ID在名称提示及输入标题可查。多操作Sources仅派生现有tools长度并独立占行，没有修改Source数据、顺序或工具协议。两语言操作文案和既有Markdown默认阅读文档同步。

- 真实后测ses_-zUQFsbQTzz6DkAoBl1a：7个精确openai/gpt-6.1-sol流式HTTP200/EOF请求，5个工具正常完成，两个准确网页Source各自归属原webfetch；412字符Markdown交付并回读，含875-after、原题名/URL、两句各不超过25字用途。非UI业务检查读取真实数据库工具/Source记录、原文件及Provider audit，不以模拟、页面断言或源码字符串替代。
- 13张原图逐张人工查看：英文真实流式、中文聚合/单次操作与两来源、原始输入、网页摘录、本地成果右侧Preview、窄主区和旧base-developer成员侧栏。复制单条来源为json准确网址，组复制为csv/json两行原URL；点击csv真实打开相应官方页，位于本人隐藏验收浏览器的临时tab，核对后关闭，未操作用户窗口。旧成员记录只读，没有新增模型请求；原命令0退出与组中非零退出1事实均保留。
- 完整后测资格：schema9/92表，253318原行→255244结果行，原96项目业务/Git、225附件及来源DB保留；无文件系统豁免。两阶段正常public shutdown200，原exec句柄74748/98995各exit0，精确出生身份、物理进程、请求与输出结清，配对副本各2个及9个未用额度退休。累计请求从1235→1242→1249。未改变首次额度/截止或重启occurrence。
- Node实际构建main-CctzHIFd.js、2715键双语言、样式token、docs:check及overlay typecheck全部exit0。没有新增或运行UI自动化测试。浏览器两次控件定位初次失败分别因加载后模型控件身份变化、输入Raw状态已保留；读取当前状态后完成正确操作，不重发任务、不伪报产品错误。

详见[原图、动作及非敏感资格](../../artifacts/2026-11-02-execution-reading/README.md)。边界：09图显示窄Markdown预览中长网址表格仍难读，下一批继续；本批没有宣称整个UI已全部完成。生产者原始成功结果及未知专业扩展ID保持真实文本，未新增英文结果解析或循环依赖。持续Goal保持active，单agent要求持续有效。
