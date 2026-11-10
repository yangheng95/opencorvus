# MCP 状态恢复实页证据

规格：[MCP 状态读回成功后收起已解决的读取提示](../../records/2026-11/2026-11-10-mcp-status-read-recovery.md)。隔离项目以实际禁用定义和公开状态路线验收，代理仅改变明确的只读响应交付。

[真实状态回执](receipts.json)记录公开项目和有效状态、代表性失败与恢复请求，以及候选延迟 13.969 秒后继续下一次状态读。基线 39463/39464，候选 39465/39466；截图只收录真实桌面状态，不用自动比较。

| 实页截图 | 人工观察 |
| --- | --- |
| [基线正常](baseline-mcp-status-healthy.jpg) / [失败](baseline-mcp-status-read-failed.jpg) / [恢复](baseline-mcp-recovered-row-with-stale-error.jpg) | 原来自动读回禁用状态后，仍留着通用动作错误。 |
| [英文候选正常](candidate-en-status-before-fault.jpg) / [读失败](candidate-en-scoped-status-read-failure.jpg) / [恢复](candidate-en-recovered-status-and-focus.jpg) | 当前读错误就近呈现，真实读回后恢复禁用行与计数，诊断焦点回到服务连接标题。 |
| [中文候选正常](candidate-zh-healthy-before-fault.jpg) / [读失败](candidate-zh-scoped-status-read-failure.jpg) / [恢复](candidate-zh-recovered-without-focus-steal.jpg) | 双语状态含义一致；未进入诊断时恢复不改变页签焦点。 |
