# 2026-10-10 共享搜索诊断275

## Recall

持续单root自主修复Sources/Rendering、UI（User Interface，用户界面）与功能，不新Task或成员。274发现搜索误回及MCP（Model Context Protocol，模型上下文协议）限流诊断被丢，原响应原因未知、时段/收尾缺口保留。275先完整协议/所有调用/依赖/公共错误审计与方案再改当前实现。

[完整分析](../../artifacts/2026-10-05-connection-workspace-authority/search-diagnostic-plan-275.md) / [实际证据与边界](../../artifacts/2026-10-05-connection-workspace-authority/search-diagnostic-275/README.md)。完整SDK结果、错误标志/明确限流保留，JSON/SSE单一decoder；删除隐式Host切换与旧依赖，搜索当前Text/Highlights/合法空/格式错误正向契约；统一两个远端方法与endpoint工具选择。实际公共列表证实默认遗漏代码搜索，最终端点修复该配置。

三独立真实gpt-6.1-sol轮次：官方网页3来源正常；代码搜索原-32602明确可见→真实quota诊断→最终34680字符代码上下文正常返回。归档又发现通用Tool failure丢NamedError.data，按现有canonical_error_metadata/redactor修根因，8个正向测试/14断言含真实SQLite往返通过。最新实时轮次正常而非失败，不能用它冒充修后实时失败元数据验收。6/6/5流EOF/各原Native与前台actual0，自己的页面/端口/完整凭据对闭合，余量408264/451108/268090ms均达4分钟目标。未扩期、未伪造Source/错误、未创建凭据。当前协议/类型/依赖检查通过，文档/扫描/范围提交及普通push收敛，goal active。

最终普通Error诊断record正向补验后9pass/15断言，文档345ops/25groups及architecture-index18文档actual0，224公开文本首扫描凭据匹配0；三轮原Native/CLI与全部当前工具join后精确保管，范围提交和普通push，goal active。
