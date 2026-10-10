# 275 共享搜索诊断与单一返回路径

## Recall

用户要求持续单agent自主体验修复Sources/Rendering与UI（User Interface，用户界面）/功能，root不委托/新Task/成员/branch/worktree，不碰用户23/18107。274是progress：当前Sol真实五Source/摘录与实时Side尾部返回、8EOF（End Of File，流正常结束）/原前台30572和Native68560 actual0，f7cfd1ce8ba199aa8901b0835e4278f8583a8597已push/干净。搜索未找到官方资料、实时固定阅读未验、4分钟收尾目标缺51661ms均保留。独立公共Exa HTTP200/SSE含result._meta.ai.exa/rateLimited=true；原调用响应未留，不把此后证据当原调用原因。

已读274 Recall/原诊断、exa-mcp/websearch-service/websearch/codesearch和描述、两个测试及dependency-patch-contract、HTTP响应owner与deadline、NamedError、MCP（Model Context Protocol，模型上下文协议）SDK（Software Development Kit，软件开发工具包）当前schemas及capability-search-runtime。全仓搜索exaMcpCall/ExaMcpResult/parseExaWebSearchText/WebSearchProvider/createWebSearchService/open-websearch：生产调用只有websearch与external_code_search；注释旧stage-agent调用描述过时。宿主库只用于该隐式转移与两个依赖测试/声明，无其他生产调用。

权威资料：[MCP tools/error协议](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)、[当前HTTP/SSE运输](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)、[Exa认证和限流](https://exa.ai/docs/get-started/exa-mcp)、[当前搜索结果格式源码](https://github.com/exa-labs/exa-mcp-server/blob/main/src/tools/webSearch.ts)。当前服务返回Title/URL/Published/Author，body可Highlights或Text，或无preview；空结果有明确文本。现有只接Highlights也可能把有效结果丢掉，依据当前源码修当前两种body，不引入旧协议兼容。

## 完整根因与影响面

现象：明确限流元数据被shared transport丢弃，websearch把无法解析的文本当[]，记录Exa0后换Host并返回不相关结果；codesearch会把限流文本当普通代码。直接触发：HTTP成功但JSON-RPC error、isError、_meta未读取。控制数据根因：手写SSE逐行只提content/structuredContent/text，SDK错误/元数据契约没有进入单一返回；服务catch/空数组触发不同provider，旧tests只验证该切换可用，未覆盖真实协议错误/限流。Bing为何忽略意图缺原HTML/redirect，未知，不以关键词过滤掩盖。

按用户AGENTS禁止fallback，替换服务为原默认Exa单一调用，删除Host adapter/锁/abort shim、隐式attempt状态、旧composition factory/协议声明/依赖。保留原消息与历史open-websearch Source metadata，旧事实不迁移或改写；当前Source URL/标题/摘录/作者日期身份契约保持。失去的是静默Host切换能力，Exa受限时明确失败而非伪称空结果/成功，不能声称第三方限流已解除。EXA_API_KEY既有读取和网络proxy面保留，不新增配置、认证或模型工具白名单。描述删除指挥模型只用某工具的旧切换文案，仅陈述实际能力。

共享transport使用现有SDK schemas校验JSON-RPC和CallToolResult，成熟eventsource-parser处理SSE，并接受当前标准JSON body；一个decoder、一个完整result owner加派生text。NamedError公开code/message/原result或rpcError，isError=true、明确_vendor rateLimited=true、协议error都自然抛出；不匹配错误文案，不合成模型消息。旧HTTP非2xx、整deadline/body owner/abort及清理保持。搜索未知格式明确typed错误，合法空/当前记录正向映射。两消费者影响与公共返回/错误/数据/测试/文档/交付均已审，调度/队列/唤醒/恢复/并发/终态没有新机制；若发现异常仍立即全入口横审。

相关依赖测试保留实际根Axios HTTP检查（根仍使用axios），Express只检查SDK owner；删仅Host的声明与旧切换测试，其他依赖/patch不无关清理。增加eventsource-parser3.1.0直接依赖（SDK当前已同版本），成熟Bun更新锁并审差异，不手算hash作为验收。无UI自动化；纯后端正向协议/结果/错误测试覆盖标准JSON/SSE多行、完整成功meta/structure、RPC error、isError/明确限流及Text/Highlights/无preview/合法空。真实当前公共接口通过生产exaMcpCall复核，fixture不冒充真实验收。

## 实施与验收

先落盘本方案，再改唯一实现/当前architecture、聚焦测试与typecheck、文档/依赖检查。所有实际命令handle join后才开始独立新Sol验证R=2026-10-10/search-diagnostic-275-live-01/E=search-diagnostic-275/live-01，开发/ui18214，600000ms/累计12请求不扩期。用户既有OpenAI auth/models完整配对，分别核对usable/projected/实际gpt-6.1-sol/streaming true。只发正常Main输入，请模型分别做一次网页和外部代码搜索，并按原错误陈述，禁止新的查询/Task/委托/写文件；保留通用工具直接可见。实际UI查看原tool结果/诊断反馈与模型结论，不做DOM/组件/源码文案/截图断言，不声称限流解除。

自己页面关闭/sole shutdown、原前台actual join、独立物理输出请求/精确出生端口/pair退休和完整脱敏归档；目标固定期限前至少4分钟闭合，若未满足保留真实结果。全部checker/observer结束后精确保管自己的五产物。同步根/月/相关README，当前docs:check/architecture-index/凭据/差异，范围提交、fetch/merge upstream、完整待推送集合审核、普通push，goal active；本轮不把诊断修复等同原ResearchStudio全帧闪烁或搜索服务恢复。

## 工具和依赖复核纠正

初始六个协议/结果测试actual0，补充未知格式错误后7pass/12断言。依赖测试改为根Axios时失败：package.json中的axios是catalog而非根直接依赖。旧Axios检查只服务已删除Host，没有当前替代契约，纯删除过期test；SDK Express仍为实际owner，重新聚焦1pass。原失败日志保留，不为旧test保留Host依赖。描述更新的PowerShell表达式首次失败、prettier后patch上下文变化均纠正重跑，无Native在故障时启动。相对路径的纠正记录误写package下，确认只有本次文本后通过精确patch移入此统一根spec；旧空目录不属于Git内容。

## 实际01与远端能力定义问题

01当前Main网页搜索真实返回WHATWG标准/两MDN来源，代码搜索原始MCP -32602找不到get_code_context_exa已完整可见；6EOF/Native69488/原前台94742 actual0，自己123关闭，物理/输出/请求闭合。正常搜索和真实错误都已进入新生产路径，没有Host切换，旧01图和输入输出保留。

全新无认证tools/list实际：默认endpoint只有web_search_exa/web_fetch_exa；显式?tools=web_search_exa,get_code_context_exa实际同时注册两个当前消费者。当前Exa官方MCP说明明确tools参数替换默认列表，当前mcp-handler源码仍注册get_code_context_exa。旧裸URL沿用外部默认值，导致本地声明code search与远端能力不一致；不是模型选错。原旧路径一直吞掉工具错误，未根治配置漂移。

修正单一exa-mcp provider定义：共享EXA_MCP_TOOLS定义两个原当前方法，endpoint tools参数从此定义生成，两调用方引用同一定义；不新增模型工具发现/白名单/gate，不增加认证或绕过quota。先精确保管01当前五产物（所有01观察/checker均已实际结束），再新检查与独立02 Native600000ms/12请求/ui18215真实验收，不重启或延长01。新R=search-diagnostic-275-live-02/E=live-02，无新Task/成员；模型各实际调用一次同两工具，审原Source/结果与真实错误，全部闭合再提交。

## 真实02后通用失败归档复核

02真实网页搜索3官方来源/8116字符成功，代码搜索已经是实际Exa免费额度限制而非缺方法；6EOF/原前台61898/Native65104 actual0，自己124关闭/端口pair闭合。归档却发现failure.data只有caller的toolCallId/toolName，NamedError.data中的code/result被toolFailureCauseFromUnknown丢弃；新decoder保留的完整原MCP信号尚未全程持久化，不能以界面文字可见宣称完整完成。

全仓审计该共享转换器：SessionProcessor、loop、shell-exec、build、dispatch/recovery、MCP app host、execution interruption均使用相同Error分支。现MessageError路径已有canonical_error_metadata与同一redactToolDiagnosticValue；ToolFailureCause公共data允许诊断record，消费方只按原kind/name/message/origin/classification运行。修复在既有Error分支只对真实NamedError使用toObject().data，移除已单独保留message，按同一canonical_error_metadata命名和redactor合并caller provenance；普通Error/string/既有Cause路径保持契约。不是给Exa做旁路，没有新调度/终态/重试机制。结构化data新增可能影响日志/历史/CLI/ACP/Tool UI显示，遵从当前同一renderer与脱敏机制；不捕获未知Error的任意属性/stack。不适用的新路由/config/迁移明确排除。

新增聚焦正向test验证原Exa code/result._meta与caller Tool身份共同保留，并经当前appendToolPartOutcome/sqlite/读取往返证明持久化（若不可直接复用，纯转换测试仅局部）。先精确保管02所有当前handle结束后的五文件，再独立03/ui18216/600000ms12请求：仅实际一次代码搜索、如实报告，不新Task/member/认证。验证真实Tool.failure中的canonical_error_metadata保留实际RateLimit或工具result；第三方正常结果与限流受真实状态决定，不注入UI错误或伪造消息。原01/02不重启/改结果。完成才提交。
