# MCP 连接回执和真实进程

基线为隔离 `39851/ui` 和开发服务 `39850`。标准输入输出协议服务只由实际连接请求启动。

- [初始禁用](01-baseline-mcp-disabled.png)、[已连接但显示失败](02-baseline-mcp-connected-with-failure.png)、[已断开但显示失败](03-baseline-mcp-disconnected-with-failure.png)。
- [真实连接、断开、项目状态和进程](baseline-mcp-receipt-evidence.json)。

候选为 `39853/ui` 和 `39852`。

- [原项目初态](04-candidate-primary-disabled-en.png)、[截断后确认已连接](05-candidate-primary-state-connected-en.png)、[原传输诊断](06-candidate-primary-connect-diagnostic.png)、[截断后确认已禁用](07-candidate-primary-state-disabled-en.png)。
- [另一项目同名服务的初态](08-candidate-alternate-disabled-zh.png)、[中文双截断](09-candidate-alternate-double-interruption-zh.png)、[两份原诊断](10-candidate-alternate-both-diagnostics-zh.png)、[自动读回恢复](11-candidate-alternate-status-recovers-zh.png)。
- [中文断开确认](12-candidate-alternate-disabled-confirmed-zh.png)、[正常连接](13-candidate-normal-connect-zh.png)、[换项目后等待旧回执](14-candidate-primary-before-alternate-reply.png)、[旧回执到达后的当前项目](15-candidate-primary-after-alternate-reply.png)。
- [正式回执、项目读回及三个进程](candidate-mcp-receipt-evidence.json)、[隔离数据状态](candidate-storage-evidence.json)。
