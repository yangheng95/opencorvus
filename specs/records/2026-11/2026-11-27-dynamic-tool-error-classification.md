# 动态工具失败分类与真实来源读取复验

## Recall

- 用户要求本人持续迭代，不用子agent（代理）；先调查与影响分析落盘，再真实页面、截图人工复核、聚焦正向测试、清晰提交、最新上游普通合并和正常推送，直到明确停止。现有凭据及完整模型目录成对使用已授权，精确流式GPT-6.1 Sol请求不限；秘密与加密推理不得提交或打印。
- 上批7e793032740d4e6a1cd51d320eaf5b4d7b911d91已推送，原push（推送）句柄80499正常join（等待原进程）退出0，远端/本地/上游一致、暂存空、原177工作区状态保留。run35–37均正常退出、reader（响应读取器）结算、配对副本退役。本批不重复验收上批交付。
- 已读上批Recall、当前06-provider的共享流式SDK（Software Development Kit，软件开发工具包）入口/prepareStep（步骤准备）/真实execute（执行）所有权合同，07-panel的ToolFailureCause（工具失败原因）呈现及历史事实合同、共享transport-protocol（传输协议）、tool-failure-cause、processor、MCP（Model Context Protocol，模型上下文协议）普通及Scoped（限定范围）定义/执行入口、processor-producer-boundary与tool-failure-metadata现存正向测试。
- 已全仓搜索tool-input-invalid、ToolFailureClassification、toolFailurePresentation、dynamicTool及相关调用。classification（分类）当前生产赋值入口仅session/processor.ts的tool-error分支；共享协议及数据库约束已有tool-input-invalid/tool-execution，两值无需结构迁移。前端据规范原因呈现，不能按英文错误文本猜测类别。检索测试均为后台契约；不运行或新增界面自动化。
- 自有仓外tool-classification runner（运行器）复用已退出run37项目及数据库，原21文件/全部五类现存行先复制保护。修正仓外runner默认uiURL（界面地址）为合法/ui/，不改产品路由、不重启用户服务；仅自有新服务run38。所有模型请求用既有配对预检/流式审计，停服前等待读取结算。

## 现象、根因与影响（修改前）

- 上批真实发表表格的首次输入同时含value:null及formula，SDK正确拒绝，模型自然纠正。折叠工具摘要仍展示大段SDK/JSON（JavaScript Object Notation，数据交换格式）原始诊断。这是后续界面候选，不能直接按现有分类翻译成“参数无效”而扩大误导。
- 更深层已确认源码问题：processor仅凭tool-error.dynamic===true决定tool-input-invalid。安装的ai@7.0.138在execute抛错时同样发dynamic:tool.type==='dynamic'，普通和Scoped MCP都使用dynamicTool，故真实执行错误也会被标成输入错误。SDK在真正输入拒绝时先发tool-call.invalid=true，然后把error转为字符串发tool-error；仅在后者检查Error实例不能根治。
- [SDK动态工具定义](https://ai-sdk.dev/docs/reference/ai-sdk-core/dynamic-tool)说明dynamic用于运行时类型；[工具错误合同](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)区分输入验证和执行失败。实际安装源码index.js的executeToolCall/parseToolCall/流式transform已逐段核对，以当前运行版本为准。
- 旧路径不足：工具类型被当成失败阶段，丢弃上游已验证的invalid事实；NamedError（具名错误）序列化只保留已有名字/诊断，不能纠正错误来源阶段。历史记录不可按消息文字重判，不改旧行。
- 影响面：全部共用SessionProcessor的Work（工作）、普通会话、Task（任务）与Mission（多步任务）生产调用，以及动态MCP普通/Scoped两入口；静态输入拒绝同样由SDK转为dynamic invalid事件，须保持正确。分类改变诊断事实，不改变输入、执行器、工具可见性、权限、结果、终态、重试或调度。尚未观察调度/唤醒/并发/恢复异常，不把分类错误臆断成这些异常；如真实发现立即按共享机制横审。
- 未知与风险：尚未取得本批动态MCP实际失败的持久/界面证据，先运行原实现读取一个实际缺失来源和sales.csv，再判定；模型是否自然执行两个读取也未知。必须区分本地协议来源的真实失败和外部生产服务可靠性，不宣称后者验收。

## 方案与验收

1. 使用现有单一OPENCORVUS_CONFIG_CONTENT（运行配置）声明仓外只读sales_source MCP及Work的现有能力引用。服务实际读取自有项目文件：sales-latest.csv当前缺失、sales.csv181字节存在；以真实文件系统错误返回JSON-RPC（远程过程调用）错误，保留请求/错误码/字节记录。真实自然请求要求比较两个来源、如缺失明确报告、以现有文件核对五行统计，不写项目文件、不分派或创建Task/Mission、不提交示例项目。禁止注入伪消息或改数据库制造错误。
2. 若真实证据符合源码，在每个原流式attempt（尝试）中短暂保留已收到tool-call.invalid=true的精确callID（调用标识）。同一call的tool-error按该事实分类；其他动态/静态执行失败为tool-execution。集合仅桥接SDK前后两个事件，随attempt释放，错误消费后删除；不增加持久状态、平行配置、关键词解析、错误重写、工具路由或执行gate（流程门）。
3. 现有真实SDK/processor契约测试增加动态执行错误、动态和静态输入拒绝、并行调用相互隔离的正向明确状态/错误类别/实际输入和输出；Provider仅本地确定性模型作为局部后台测试，不能冒充端到端。先得到旧实现失败，再修复运行同一检查。当前触及测试的旧负向核心断言如遇到应按规则删除/改为正向契约，不为本批扩展无关测试。
4. 候选服务用同一自然真实任务复验：本机MCP调用日志、正式Tool结果接口/持久结果、精确Sol流式审计、真实页面展开错误/后续成功工具与统计、截图本人查看；全体原项目文件和旧行逐项保留。历史错误保持原记录。界面大段摘要单独后续调查，本批先修正根因分类，不将一个UI（User Interface，用户界面）文案修复掩盖数据契约错误。
5. 更新当前06-provider合同与本规格/三个索引、归档脱敏证据；类型/文档/架构等当前检查。范围提交后fresh fetch（获取最新远端）、普通merge（合并）上游、检查全部待推送集合、正常push及原句柄join、精确远端/原177状态验证。无版本升级、发布、标签或新分支。

## 原实现真实复现与运行器修正

- run38在启动阶段由现有项目配置边界明确拒绝：primary_assistant_capabilities只能来自项目，不能放环境配置；0次模型请求、原句柄78835退出1，配对副本已退役。已修复仓外工具链：环境仅保留模型/权限，MCP声明和能力引用都临时写入自有项目同一个现有配置文件，停服后逐字节恢复原文件；不修改产品边界。run39从已正常退出run37重跑成功。
- 本批初次手工深链接遗漏kind（会话种类）/experience（体验）而被WorkspaceLocationError正确拒绝。已通过实际侧边栏“打开项目: project”进入合法/ui/并直接提交，不改产品路由，不把本人的错误地址当作产品缺陷。
- 真实页面提交来源核对任务ses_hcKxecXGrvhy8ETMyGzr。精确Sol自然使用现有capability_search（能力检索）加载专业MCP，实际执行两个文件读取。缺失来源工具prt_g0Vc8uAfJ007g08aTmmX在正式结果接口返回McpError，诊断MCP error -32603 / Sales source sales-latest.csv: ENOENT，却同时kind/classification=tool-input-invalid；随后prt_g0Vc8uBMX0090ctQG5Sj读取sales.csv成功。仓外源服务真实日志与文件系统错误、输入filename契合。未修改消息/结果制造现象。
- 现有303消息/924部分/301请求/301结果/17产物共1846旧行，21文件已建立原始副本。运行中的唯一临时配置与精确生成副本比较，其余文件必须逐字节保持；停服后配置也恢复原始副本。现有类型和持久格式已可表达两类别，无迁移、兼容层或历史行改写。

## 实施、真实候选与交付复核

- 共享处理器仅增加本次attempt内的精确invalid call集合，在原tool-call事件保留SDK验证事实，原tool-error消费并删除后判定已有两种类别；删除旧dynamic猜测。执行器、暂停所有权、结果恢复、重试、终态和公开结构保持原合同。集合随本次尝试释放，未增加持久状态、关键词匹配或宿主流程旁路。
- 新增真实SDK后台正向测试把动态执行失败、静态输入拒绝、动态输入拒绝、静态执行失败和动态成功调用放在同一流，核对精确callID、状态、输入、失败阶段、原始诊断及实际持久结果。旧实现0通过/1失败，动态执行错误分类明确错误；修复后连同已存在处理器/具名错误测试19项通过、66断言，后台类型通过。该局部确定性模型测试不替代真实Provider任务。
- run40从已正常退出run39重新启动，原句柄18192已join退出0、读取结算、临时配置恢复，未重启用户进程。实际打开同一会话完整合法地址，通过真实输入框提交重新读取请求；精确Sol自然重新加载既有专业能力并实际读取两个来源。
- 新失败prt_g0Vc8v1eJ00JPPIpFXgs以同样filename和同样ENOENT诊断记录tool-execution/McpError，新成功prt_g0Vc8v2OD00wwu156dnV正文与181字节源文件逐字节相同。原失败prt_g0Vc8uAfJ007g08aTmmX仍保持原tool-input-invalid，原工具结果全部逐项保留。正式接口与实际tool_part_outcome（持久结果）一致，没有改写历史来制造通过。
- 本人实际展开本轮工具组/详情、收起能力检索辅助字段并滚到本轮结论；after-source-result.png同时可见tool-execution/McpError详情、成功源文件原文、5笔/35.60、华东3/28.25、华南2/7.35、退款/零金额口径及币种未知说明。与修复前两图一并人工查看。另有提交/未完整滚入区域的中间图仅留仓外，不冒充最终截图证据。
- 初版checker（检查器）误把成功持久结果称succeeded并尝试比较不存在的output字段，按真实completed/metadata合同修正；成功正文仍在正式接口直接与原文件比较。基线已退出、候选在线时临时配置属于候选，不能拿基线原配置比较；最终两次都在退出恢复原配置后重跑同一checker通过。原21文件/1846旧行/示例HEAD全部保留，SQLite完整性ok。
- run39/40共15次实际Provider请求全部精确gpt-6.1-sol、流式、HTTP200、settled/eof；停服前正常等待后台记忆等真实响应读取结算，run40原句柄40568已join退出0、配对副本退役、两个端口关闭。未出现调度/并发/唤醒/恢复/终态异常，不将其扩成无证据的调度修复。
- 本批改动未触及UI源码，不需要重建同一已验证界面产物；仍完成真实页面与截图复核。大段原始输入错误摘要尚未修复，留下一批有独立视觉证据的范围。Scoped/Task/Mission共享覆盖仅源码分析，真实本轮仅Work；不宣称全入口端到端。没有新真实输入拒绝任务，原表格记录保持且后台真实SDK覆盖验证。
- [脱敏任务、协议来源、实际工具结果、原文件检查、截图及模型审计](../../artifacts/2026-11-27-dynamic-tool-error-classification/README.md)。接下来文档/架构检查、范围提交、最新上游普通合并/正常推送，精确最终交付收据在仓外tool-classification/delivery-result.json；此段不预写推送成功。
