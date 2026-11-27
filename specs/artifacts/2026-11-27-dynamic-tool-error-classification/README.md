# 动态工具失败分类证据

- [完整调查与方案](../../records/2026-11/2026-11-27-dynamic-tool-error-classification.md)。本批仅修正共享处理器失败分类，未改界面摘要、协议结构、执行、重试、权限或历史记录。
- 真实独立开发服务run39/53837及候选run40/56115，同一Work（工作）ses_hcKxecXGrvhy8ETMyGzr；精确GPT-6.1 Sol通过当前能力检索自然加载项目只读MCP（Model Context Protocol，模型上下文协议）。该本机服务读取真实自有文件，不能据此宣称外部服务可靠性。无伪消息、数据库注入或UI（User Interface，用户界面）自动化。

| 人工查看截图 | 实际可见证据 |
|---|---|
| [before-error-details.png](before-error-details.png) | 修复前真实缺失文件ENOENT（文件不存在）却显示tool-input-invalid/McpError，后续成功CSV原文可见 |
| [before-source-result.png](before-source-result.png) | 同一基线错误、成功数据及5笔/35.60/区域/退款/零金额说明 |
| [after-source-result.png](after-source-result.png) | 候选实际tool-execution/McpError详情、成功原文和本轮完整统计/限制说明同时可见 |

中间截图仅在仓外：提交瞬间和两张错误尚未滚入完整可见区域的图不充当最终视觉通过证据。本人实际展开工具组/详情、收起辅助字段、滚动至结论后查看上表三图。

- [基线任务](task-run39.json)、[候选重读请求](task-run40.json)、[基线真实工具读取](tool-reads-run39.json)、[候选真实工具读取](tool-reads-run40.json)：候选保留原两工具，追加新两工具。原始诊断和输入不变，新失败仅按SDK（Software Development Kit，软件开发工具包）流事实正确分类。
- [本机实际来源服务](sales-source.mjs)、[来源CSV](sales.csv)、[独立Decimal精确十进制核对](source-facts.json)。服务各次实际读取缺失来源和181字节现有来源，真实JSON-RPC（远程过程调用）错误/字节/时间在[facts-run39.json](facts-run39.json)、[facts-run40.json](facts-run40.json)；原21文件、1846旧行、示例Git HEAD和数据库完整性通过。
- [真实事实检查器](check-facts.py)直接读取实际项目文件、SQLite（数据库）原行与正式工具结果接口已保存响应。初版误设成功状态为succeeded，已按真实completed与元数据合同修正；成功正文在正式接口与源文件逐字节比较。基线在候选临时配置仍在线时的检查不能通过，最终两服务退出恢复原配置后同一检查器均通过，不掩盖失败。
- [旧实现失败](test-red.log)、[19项/66断言通过](test-green.log)、[后台类型检查](typecheck.log)。确定性模型仅用于后台SDK/处理器/持久结果契约，不冒充真实模型端到端或视觉验收。未增加或运行界面自动化测试。
- [模型与退出审计](model-audit.json)：15次实际请求全部精确gpt-6.1-sol、流式、HTTP（超文本传输协议）200、settled/eof（结算并读到结束）。凭据可用/模型目录投影/实际请求三项分别验证。两运行响应读取结算后正常退出0、项目配置逐字节恢复、两个端口关闭、配对凭据/目录副本退役。run38配置边界拒绝发生在模型请求前，不计作真实验收成功。

已知范围：本批没有真实触发新的输入验证错误；此前真实表格输入拒绝保持原始分类，新增真实SDK后台测试覆盖静态/动态输入拒绝、两类执行失败和同批成功调用。Scoped MCP与Task/Mission使用同一处理器的覆盖为源码影响分析，本批真实任务仅当前Work；没有凭单个案例宣称全部生产入口端到端通过。
