# 250 当前子 Dock 历史复核

最新用户要求只用一个 agent；本轮由 root 独立完成，没有 Codex 委托或新应用 agent。复用真实已完成 Task 的完整历史，验证 249 当前执行时钟改动在子 Dock 的实际呈现。没有新增生产代码。

- [Recall 与启动分析](../child-dock-review-plan-250.md)。
- [新鲜启动审查与准入](../child-dock-readiness-250/README.md)。
- [真实页面、原结果与完整保管](live-01/README.md)。

实际看过 researcher 的三条来源标题/域名、Markdown 正文和固定 1m1s；tester 固定 1m15s。成员切换、返回列表和整 Dock 关闭重开均保留当前 researcher 阅读状态，最后关闭前后同一会话 scrollTop=1008。截图是视觉验收依据，只读几何数据用于说明位置，未新增或运行 UI（User Interface，用户界面）自动化测试。

本轮来源是 153 原始完整历史，不是用户原截图中的 Research Studio Task。没有新 LLM（Large Language Model，大语言模型）请求，不能据此宣称实时子会话生成、全部 Rendering 帧、原截图场景、所有主题或重试已通过。应用内新增只读子会话的范围问题仍待用户回复；等待不构成授权。持续迭代目标保持进行中。
