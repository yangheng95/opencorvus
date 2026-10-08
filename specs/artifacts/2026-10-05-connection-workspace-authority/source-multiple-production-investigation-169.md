#169 单次真实 Tool 多 Sources 生产入口调查

## Recall

用户要求持续改善真实 Sources 体验；URL/file单Source已采，单个真实Tool返回多Source并在同一chronological run显示还未采。Root报告168 completed176879ms/16 streamedSol200EOF/原combined ONCE0+nested0/own scope全关闭、11938终值0joined，167 path-query优先标签380/280实际通过；Root正在提交。本调查不重跑、不把三个独立Sources1改成Sources3。只读源码/spec/非UI测试定义，无网络/Provider/auth/模型/UI/runtime/DB/helper/产品/Git/委托。

已读/检索：tool/websearch.ts/txt、websearch-service.ts、exa-mcp.ts、global-tools.ts、registry.ts、permission/invocation.ts、builtin/base/expert-squad.jsonc；session/source-persistence.ts与processor真实tool-result/source事件入口；CardParts citationRenderRuns/SourceParts及07 Sources合同；17-code-work-agent-platform能力层、capability-search-runtime HTTP共同body owner；109/114/115/116/128/137/157/164/165/166历史；既有test/tool/websearch-service.test.ts、test/session/source-persistence.test.ts仅读，未运行。

## 明确生产入口与数据合同

WebSearchTool一次execute调用WebSearchService.search，并返回 output真实renderWebSearchResults、title真实query、metadata.provider/attempts/resultCount，以及sources=webSearchSources(response.results)。parameters仅query:string及optional numResults int1–50；默认8，是既有工具合同，不是为Source UI加控制。webSearchSources192–202把每个实际result的URL/title/snippet/author/publishedAt/provider经唯一urlSource转Message.SourceUrlPayload；没有单结果截断，也没有宿主Source补齐。实际多result是当前明确可达生产入口，尚未证明当前隔离网络可以成功返回多distinct URL。

Service159–190现正式Exa-first、已有Host-search接续策略（本调查不新增替代路径）：Exa返回非空result直接用该批；Exa错误/空结果记录真实attempt再用Host provider；aborted时不改成搜索成功。Exa84–98调用唯一exaMcpCall(web_search_exa,numResults)，25s；parseExaWebSearchText62–81按当前Title/URL/Published/Author/Highlights record grammar解析，语法不匹配可产空结果。Host102–156用open-websearch Bing request模式、20s navigation设定、60s keyed-lock预算，真实title/url/description解析；不是浏览器UI自动化测试，也无需为此启动独立Playwright页面。它只接受实际合法URL，invalid result被当前解析丢弃。结果数、排序、重复URL、内容格式和可用性均实际外部数据，不能由默认8推定Sources8。

exa-mcp.ts44–112现公开HTTPS mcp.exa.ai请求；EXA_API_KEY仅已有环境设置时读取并送header，不强制新增凭据。当前真实隔离环境是否无该key/公开服务能返回结果未知，本轮未读环境私有值或联网。两个搜索provider都用当前webResearch proxy配置；Task通过assertTaskNetworkCapability真实capsule授权，必须保留。共用HTTP owner原overall/parent signal涵盖headers/body/conversion，Exa不套webfetch5MiB截断。LLM仍原Sol流式，搜索HTTP工具请求不是额外模型切换。

## 真实授权、声明与执行身份

Base manifest44–77明确scheduler有websearch；base-researcher base_role explore有explore-base及直接webfetch/websearch/external_code_search refs。global-tools42/74/115注册真实WebSearchTool，ToolRegistry.exactRuntimeTools130按actual requested leaf与known IDs物化，不需要高级发现步骤才得到已授权通用websearch。permission/invocation.ts79分类network_read；真实Runtime SessionExecutionAuthority来自Tool.requireExecutionAuthority(ctx)，不是由prompt或agent名字推权限。

因此最小自然用例可沿既有Work/builtinbase/实际projected researcher、现OpenAI Sol配对预检，不安装新包/换Provider/上传或新增key。启动前actual projected tool声明必须含websearch；模型最终是否选择该工具及外部结果数不保证，不能以模型自述或静态manifest代替actual outgoing declaration。

## 持久化与真正同组

processor484将真实output.sources逐条严格SourcePayload.parse，531在actual assistantMessage sessionID/messageID上调用persistMessageSources；1258保留工具sources。source-persistence7–37按同Message type+sourceId现有集合去重，逐条await Session.updatePart真实ascending Part ID，actual payload次序保留。urlSource规范实际URL并去fragment，同canonicalURL重复会减少新Part数；resultCount不等于真实新增Source count。跨Message不合并。SDK source事件1493也是同一持久化primitive，但一次一个event，不能取代此次Tool多result目标。

CardParts134–165将已排序实际Parts的连续Source聚为一run；intervening真实Text/Tool/其它Part分隔，不为验收重排。SourceParts props.sources.length是实际count；Key以type/session/message/sourceId稳定身份，index仅同group显示序号，单group1现不重复ordinal。所有主/子会话通过同CardParts；TaskAgentView activity不替代完整Sources库存。多个distinct sources虽通常按同execute批次连续持久化，但并发追加或其他actualpart间隔可能分run，真实parts order才决定UI，同Tool不自动保证单一SourcesN。

历史109/116固定三URL三次webfetch只有三Sources1；每次read单文件也不是一次多文件Source组。已有128 secondary搜索建议未执行；165七Task census15URL/6file不能证明单Tool多Source。旧不足是用例都是给定URL读取，不是发现多个候选的搜索需求；没有现有源码证据显示Source计数/grouping需要修复。

## 最小自然请求候选（准备仍未准入）

“请委托只读研究员查找当前关于网页键盘可访问性的官方指南，比较 W3C/WAI 与 MDN 对键盘操作及焦点可见的建议。用简短中文说明共同点和一个需要注意的区别，引用实际找到的官方来源；不要改文件或另写报告。”

这是实际搜索/比较任务，不规定tool名字、numResults、Tool次数、来源数或SourcePart结构；没有固定三URL限制搜索结果的自然机会。只读正式Work/builtinbase、全部gpt-6.1-sol streamed，建议沿既有24累计请求/600000准备/180000 inactivity/900000 service固定边界，由Root另落独立run/evidence/port后准入。若未自然调用websearch或结果仅1，目标多Source仍UNMET，不重试强迫或把多个webfetch合并。

## 证据与风险/验收

既有websearch-service.test.ts解析两个实际形状record→两Source的正向局部合同、provider composition测试只证明fixture行为；source-persistence.test.ts是局部存储合同。此调查未运行这些测试，不能称真实网络或模型E2E。

下一genuine必须保存actual tool request/name/input真实query、执行authority Task/Session、provider attempts/resultCount、原result.sources与persisted sameMessage Part/sourceID fulltuples/order、actual distinct计数，保持真实错误/结果为空原状。Root在真实main/child wide380/narrow280看同group真实count、每leafordinal/title/fullTooltip、nativeTab各leaf/Escapefocus/Enter真实目标、自然live更新；同一Tool但多个runs也准确记录，不称Sources3。正文比较结论由Root人工核对，查询返回snippet不是每网页完整读取证据。

所有普通Session/Mission/Task共享同工具、严格sources解析/持久化和展示；本轮未发现调度异常。Host全局config keyed锁负责并行search temporary config恢复；withAbortSignal取消等待不等于底层网络/锁operation已经物理结束，这个源码边界不能由本调查宣称取消全验证，若真实出现超时/恢复异常需横向机制审计。多Project权限由每request actualexecutionauthority与capsule，不可借公共search共享proxy推跨Project读取。外部服务配额/网络/格式兼容/重定向、结果误报/重复/同标题、极长URL和documentSource都未知，不能加新key或补Source解决。

未修改生产，无根因修复准入建议；当前建议是先执行真正搜索型自然用例，资格多Source生产→持久化→同组UI完整链，保留所有未出现scene。Root负责索引/后续release。