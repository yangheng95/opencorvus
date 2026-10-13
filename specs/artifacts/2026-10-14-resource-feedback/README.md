# Skill 与模型上下文协议（Model Context Protocol，MCP）资源操作反馈证据

对应[第16批记录](../../records/2026-10/2026-10-14-resource-feedback.md)。Root独立实现、真实操作和人工验收，子agent保持停止。

- screenshots：14张原始桌面PNG全部本人查看。01是表单viewport、错误位于上方；02实际可见Skill错误前态；03中文MCP原英文解析错误。04–05英文Skill摘要/键盘原详情与真实请求ID；06–07英文MCP；08–09中文Skill；10真实自有Skill安装后的名称/原描述/路径；11–12中文MCP；13–14无项目scope的中英warning。原始资源描述保真，没有翻译用户/资源正文。
- runs：before PID79352、18630/18631，after PID72448、18632/18633，两轮真实生产backend均正常退出0、各自监听0、假Auth/models整对在物理exit后清理。完整原stdout/stderr/backend经原privacy扫描后gzip保存。
- inputs：当前唯一生产backend调查运行器/launcher、实际公开GET checker、失败checker原输入、简单自有SKILL.md输入和隐私检查器。before页面使用B15 ui-final，参考源来自已交付f79bd5f16。没有用户凭据或外部第三方Skill，未运行所填MCP命令。
- checks：类型与Node构建实际0（52.83秒），原chunk警告保留；formatter仅本批源hunk。真实UI安装后的正向公开GET checker82ca25实际0。初次a9d67c将同一Windows目录的两种分隔符作裸字符串相等，随后Node25.7附带UV_HANDLE_CLOSING，原exit -1073740791和完整日志/输入保留；只修正目录身份比较后重跑，没有改接口输出或伪造成功。
- previous-batch：第15批原正常commit/index结算、fresh fetch/merge、完整pending审阅、本任务normal push和实际exit，无损gzip保留原remote空格。

核心资格是当前语言的短操作摘要、原诊断与真实requestID展开、键盘Return/Space、关闭后保留输入、有效本地Skill真实接受与公开目录/全局来源、目录警告配色。实际Skill错误仍是backend500，分类根因及提示在viewport上方的独立问题均明确未修复。没有将MCP本地解析当backend端到端；没有资格外部market安装、远端连接、所有native/success分支或同notice跨语言存活。0推理请求、0 real Sol、0 UI自动化。
