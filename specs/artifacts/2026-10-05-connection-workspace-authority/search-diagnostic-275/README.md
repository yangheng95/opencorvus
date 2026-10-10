# 275 搜索诊断与远端能力修复

[Recall 与完整分析](../search-diagnostic-plan-275.md)。本轮单root修复两个真实问题：共享Exa MCP（Model Context Protocol，模型上下文协议）丢失错误/元数据，以及本地声明代码搜索却使用不含该工具的远端默认端点。另按用户禁止fallback约束删除隐式Host搜索切换，原历史Source不改写。

共享传输使用现有SDK schema和eventsource-parser3.1.0接受当前JSON/SSE（Server-Sent Events，服务器发送事件），保留完整CallToolResult及派生text；标准工具错误、JSON-RPC错误、明确rateLimited元数据成为ExaMcpFailure，原result/rpcError保留。远端方法名及endpoint tools参数来自同一EXA_MCP_TOOLS定义，网页/代码调用共用。搜索当前Highlights/Text/无preview、合法空结果分别保留；未知格式为带原text的类型错误。Tool描述仅说明能力，删除指挥模型不得换工具的旧文字。原HTTP body owner、deadline/abort/权限与EXA_API_KEY既有路径保持，不新增认证或绕过限流。

删除旧Host adapter/锁/abort shim、composition factory/attempt状态、open-websearch依赖及专用声明，Bun重建锁后完整差异审查、拓扑通过。仅Host的Axios依赖测试删除；SDK Express当前正向检查保留。初次误认root catalog为direct dependency的测试失败保留并纠正；错误spec相对路径精确移回统一根目录，不留package内平行文档。

8个聚焦协议/结果/持久化测试、14断言actual0，真实本地HTTP JSON/多行SSE完整字段和正向错误契约通过；通用failure converter对真实NamedError.data使用现有canonical_error_metadata和同一诊断redactor，caller provenance保持，真实Session.updatePart→SQLite Tool outcome往返证明code/result._meta保存。普通Error/string/已存在Cause路径沿用当前契约。SDK依赖1pass/其余无关6filtered、类型检查和依赖拓扑actual0。局部fixture检查不冒充外部服务或UI（User Interface，用户界面）验收。

三个独立真实Sol开发/ui轮次，每个600000ms/12累计请求，普通Main无Task/成员/委托。各preflight独立核对OpenAI凭据usable、完整models projected/paired、实际gpt-6.1-sol/streaming true。

01 Main `ses_-zUSMrVspzzAVfo44tih`/Project `prj_hWmozVxK6hjXtvMa0RUS`，网页Tool `prt_g0VXd8Vlb00sXYdRhiRe`成功6737字符、真实3条WHATWG/MDN来源；[官方来源](live-01/04-official-sources.jpg)人工查看。代码Tool `prt_g0VXd8Xkv00cZTsHjJve`明确失败-32602/[原错误可见](live-01/03-code-search-detail.jpg)，模型未当作空代码。随后独立公共tools/list实际默认只有web_search_exa/web_fetch_exa，明确tools参数时同时包含get_code_context_exa，原列表/当前schema留存。由此证明裸端点默认漂移，非模型选择错误。

02最终端点 Main `ses_-zUSMpgSlzzohuNKKXMd`/Project `prj_hAROhHKBRxd4gPgTxsmX`，网页 `prt_g0VXdAKvI00yUkGIU46C`成功8116字符/[三官方来源](live-02/04-official-sources.jpg)，代码 `prt_g0VXdAMu000WzKKw1kFT`已到真实服务而返回免费额度限制/[实际诊断](live-02/03-rate-limit-detail.jpg)。Root查看原结果及模型区分，未新增key/重试或伪造错误。归档发现当时公共failure转换还丢NamedError.data，只保存文字/调用身份，遂完成上面的通用metadata修复；02旧结果不改写。

03 Main `ses_-zUSMlN06zzJ9qkA5Ulg`/Project `prj_hvkLWAeV0PiU7BRj5pvk`，唯一代码Tool `prt_g0VXdEehf00wZ9SZoNMH`实际成功34680字符、完整mcpResult持久化，metadata字段为provider/mcpResult/truncated。[正常返回](live-03/02-current-result.jpg)与[原代码上下文](live-03/03-code-search-output.jpg)人工读取；不是手工注入错误或Source。该次外部服务返回正常内容，未出现失败，所以不能宣称最新NamedError结构在实时失败分支已再次通过；该持久化分支的证据是聚焦真实SQLite测试。第三方限制会变化，成功一例不等同限流解除。

三自己的IAB（In-App Browser，应用内浏览器）123/124/125均关闭，sole shutdown与原前台94742/61898/84709 actual0；每轮实际流6/6/5 EOF、取消0，Native69488/65104/61548均exited0，Host78228/51424/63408，精确出生见原owner/独立closure。01物理07:42:19.230Z/余量408264ms，02物理07:48:43.625Z/451108ms，03物理08:09:01.817Z/268090ms，均满足至少4分钟目标；没有延长/重启旧occurrence。18214/18215/18216释放、三完整auth-model pair退休，原预算/结果/日志保留。01/02所有当时工具与checker actual结束后已先精确移动各自五产物，03在最终checks全部join后移动。

当前架构/根月相关索引同步、文档/凭据/差异和完整待推送集合复核、范围提交与普通push按实际收据完成。原ResearchStudio Task/全帧Rendering/实时固定阅读仍继续，不能把本轮协议/搜索修复扩大为整个目标完成。goal active。

最终补充普通Error明确空诊断record的正向契约，9pass/15断言；docs:check345ops/25groups、architecture-index18文档actual0，224公开文本首次凭据匹配0。原工具错误及依赖误判日志保留；全scope只规范AX尾部空白，不改图片。03前台/归档/观察及全部当前checker actual完成后精确移动自己的五产物，01/02已分别在下一Native前结束并保管，没有将两轮文件混为新出生。当前完整依赖差异与生产接口/error/Tool文案复核，范围commit和普通push收敛后继续。
