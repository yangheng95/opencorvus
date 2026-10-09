# 236 live-01 原始运行与有限视觉

ownIAB75/18168/current main-CcagVDdu.js；实际Main Session ses_-zUSRZKRGzzQ1VCVbesX，Project prj_hg4TMU2SHTliU3ZGbN7B。完整canonical-current-conversations.json与canonical-source-prose.json为物理关闭后只读事务所得的真实身份、错误、Source全文、正文和工具事实。

- request.txt：原自然用户请求，没有指定工具、伪造Sources、写文件或委托。
- preflight-ready与authority-ready：现授权凭据可用、完整目录投影gpt-6.1-sol、实际模型一致，分别验证。
- final-provider-audit：12个实际出站请求均streaming/200/源reader EOF；exhausted=true由第13次尝试在工具预算拒绝触发。不能将12个200称为最终任务成功。
- canonical-source-prose：16条source-url、9个完成工具请求；主会话user165字/assistant初始89字，无所要求的最终八节正文。最后assistant finish=error/UnknownError明确保存Error: E2E_REQUEST_BUDGET_EXHAUSTED。
- main-submitted/main-first-progress/budget-boundary.jpg：root人工查看。后二图处于同一终态来源尾部，显示Not running、来源与摘要入口，没有明确的失败正文；流式中间帧没有取得，Side Chat未启动。manual-boundary-observation记录当时结论，不回填为成功。
- runtime/stdout/stderr及HTTP-summary：完整当前范围日志经单一CredentialRedactor处理，未知时间戳0行。原凭据不入prompt、日志、spec或Git。
- native-host-settled、physical-terminal-and-pair-cleanup、closure-readback：sole shutdown0，原foreground70903实际1/OWNED_PROVIDER_COMPLETION_INVALID；Native68708实际exited0，12:26:42Z物理/output/request完成，原期限12:28:01Z没有延期，自己UI关闭，配对auth/models副本已清理。

代码线索：ChatBubbleEmptyTurnState仅在无可见内容时显示正文错误，已有Sources的turn仅剩可能在视口外的header tooltip。既有writer保留真实errorReason；该展示线索需要下一轮独立分析和真实前后截图。此处没有产品修复，也没有UI自动化断言或测试。

docs:check/architecture-index均实际0。所有原观察器终态后最后运行archive-piles实际0，仅按本目标精确birth与已核定绝对边界移动自己的五个Bun文件；owned-native-pile-archive.json为实际记录。
