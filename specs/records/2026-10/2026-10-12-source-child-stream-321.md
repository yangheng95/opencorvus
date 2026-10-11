# 321 真实子侧栏持续输出验收

[实施前Recall、覆盖差异和验收方案](../../artifacts/2026-10-05-connection-workspace-authority/source-child-stream-plan-321.md)。单agent开发，核对被测产品真实Task子会话的Sources与持续正文。

真实Task首轮生成6915字符、三个文件来源及一个网页来源，截图验证子面板与完成后定位/重开。本轮同时证实read_agent_message不能读取同一已结算轮次的早段可见正文，导致负责人要求同一Researcher再次输出7097字符。[实际请求、代码根因、截图边界和下一步](../../artifacts/2026-10-05-connection-workspace-authority/source-child-stream-321/README.md)。15次实际模型请求完成、原执行器与配对清理通过；没有生产代码变更。
