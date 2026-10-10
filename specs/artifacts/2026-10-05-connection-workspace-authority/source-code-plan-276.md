# 276 外部代码搜索真实来源

## Recall

用户要求持续自主迭代、实际体验修复 Sources 显示和 Rendering 闪烁；最新明确只使用单 agent，不委托、不新建 Task 或成员，不操作用户页面23/18107。275提交 b00b3f330bdec9a1af0f05eadd0cc381d46386b6 已正常推送且工作区干净。275真实03的代码搜索成功34680字符，10个正式Title/URL记录，只有provider/mcpResult/truncated元数据；真实截图只有原始长文本。原Research Studio任务身份和全帧闪烁仍未验证，不能把普通会话来源验收等同原子侧栏。

已读 AGENTS、275 Recall、codesearch及描述、exa-mcp、websearch-service、source、source-persistence、Tool.Info、Processor来源提交和loop转交、SourceParts、现有真实HTTP/SQLite来源测试、当前capability-search-runtime。全仓搜索tokensNum只有codesearch声明和请求；外部代码工具注册、权限、CLI、ACP、生成SDK和专家包引用的是工具ID，没有该参数调用。生成包/技能有工具流程文案，本次无关，不改动。检索到的测试是后端能力/HTTP/持久化契约，未发现需要删除的UI自动化测试。

权威依据：[当前Exa代码搜索实现](https://github.com/exa-labs/exa-mcp-server/blob/main/src/tools/exaCode.ts)。当前远端声明query/numResults；记录为Title、URL，正文Code/Highlights或Text或无正文，记录以空行/---/空行分隔，明确空结果文案。275真实03输出与此语法一致；内容中的空反引号已在原始Provider结果中存在，发布者清洗原因未知，不猜测或补写原文。继续采用benchmark-debug-template调查/修复/复核流程；仓库UI人工验收约束优先于skill自动评分，Native固定生命周期属于服务保管边界，不替代检查器无活动超时。

## 根因与完整影响面

现象是成功搜索来源不可直接阅读。触发点是codesearch只返回output/title/metadata；Tool公开契约已有sources，loop透传、Processor按真实助手消息经persistMessageSources持久化、Sources组件按同一sourceId显示。缺失发生在生产工具事实生成处，界面没有足够数据；先前只修协议和方法可用，没有为代码结果建立来源投影。同步发现tokensNum已不是当前远端声明，数量提示和实际请求不一致；它使用户指定结果范围无法可信生效，不能声称其控制token预算。

实现只在当前codesearch解析当前正式记录，生成既有urlSource，包含发布者标题/规范URL/完整原摘要/provider=exa；完整原始输出和MCP（Model Context Protocol，模型上下文协议）结果保留一个事实来源。无正文来源照样成立，N/A标题省略；显式空结果返回空来源。未知格式抛明确类型和原记录，不以任意网址或关键词猜来源。共享URL身份/消息去重/排序/历史不改写，没有新UI状态、renderer、迁移、配置或路由。公共参数替换为numResults默认8、正整数，声明与实际请求一致；删除旧token文案及参数，不做兼容双源。历史Tool输入仍是历史事实，不回写。当前原记录分隔语法与websearch字段不同，保留两个实际语法owner，不无需求抽象或复制websearch函数。

影响包括模型工具定义/实际调用、当前Tool结果和SourcePart持久化/CLI及ACP读取、现有Sources标题/摘要阅读；不改调度、重试、恢复、队列、并发、终态或Provider预算。无新异常证据，不适用共享调度横审；若实际运行出现立即扩大审计。风险是远端格式再次漂移或额度限制，应保留真实错误而非降级成功；长摘要使用已有阅读组件，人工查看真实布局。缺少实际远端失败不宣称错误分支端到端通过。

## 实施和验收

方案先落盘后修改。聚焦正向后端测试覆盖当前三种记录、CRLF、正文内普通分隔线、明确空结果、未知记录类型错误，验证真实SQLite消息来源往返、标题/URL/摘要/共享身份；工具参数解析输出也检查当前numResults。测试不操作DOM（Document Object Model，文档对象模型）、组件、UI文案或截图。运行相关测试、opencorvus typecheck和当前文档检查。

新独立R=2026-10-10/source-code-276-live-01，E=source-code-276/live-01，开发/ui18217，600000ms/累计12请求。完整复制用户已授权OpenAI auth/models，先分别检查凭据可用/目标模型投影，再核对实际gpt-6.1-sol且streaming=true。只发普通Main输入请求一次external_code_search、numResults=4，不新Task/成员或凭据，不隐藏工具。查看真实Sources标题/域名/数量，展开完整摘录、键盘或滚轮阅读后再截图人工确认；保留真实结果及限制。若远端忽略numResults记录实际差异，不能伪称数量生效。

目标至少期限前4分钟收尾，自己页面关闭、sole shutdown、原前台actual join，独立精确PID出生/物理输出请求/端口/pair退休复核，脱敏归档。所有本轮checker/observer实际结束后精确归档自己的五个Bun产物，再更新根/相关/月README、当前架构。范围清晰提交，fetch/merge upstream并审完整待推送集合，正常push；goal保持active，后续继续迭代。

## 完成事实
真实Main一次当前numResults4搜索、四个持久化来源/原14480字符一致，实际展开/End阅读/收起和四来源同屏人工复核。5EOF/原52205与Native75084 actual0、自己页126与18217/auth-models完整闭合，期限余343480ms；后端12pass/17断言、最终types/docs/architecture0。详见本轮README与live-01，限定当前代码搜索来源；原用户Research Studio完整身份/全帧闪烁未达成，goal继续active。
