# 383 Tool 结果、Sources 与恢复证据

[方案与 Recall](../source-result-commit-plan-383.md) · [记录](../../../records/2026-10/2026-10-13-source-result-commit-383.md)

## 实际页面

当前代码经正式构建，生产开发服务的/ui提供页面；单 agent 操作独立tab3，没有UI自动化测试。

- [真实来源与行内文档](live/01-real-source-and-document.png)：读取结果来源.txt前两行后发布document@1，来源显示文件名和L1–2。
- [点击来源](live/02-open-source-lines.png)：实际文件视图打开并高亮1–2行。
- [打开文档工作区](live/03-document-workspace.png)：原两行正文可读。
- [刷新后到期状态](live/04-reload-scope-expired.png)：重选会话验收尚未完成，固定时限已到，页面Offline。

[实际运行检查](runtime-review.json) 核对真实数据库中的Tool请求/输出、Source文件/行号/调用绑定、产物正文/调用绑定、实际模型/流式响应与物理清理；不把页面文本用作自动化断言。全部请求为gpt-6.1-sol、stream=true、200/EOF，共7/20。原生目标594777ms后deadline_exceeded/exit1，launcher23132为exit1，整轮fullQualification=false。固定预算未改变，没有重复启动此scope。

## 后台合同与边界

| 合同 | 测试/断言 |
| --- | --- |
| 结果恢复、完整事务、晚到Source、fork与绑定 | 11 / 44 |
| 来源批次并发与项目隔离 | 7 / 15 |
| 来源持久化 | 1 / 4 |
| 处理器生产/消费错误边界 | 12 / 45 |
| fork原子transcript | 3 / 5 |
| 规范Tool存储 | 1 / 15 |
| Permission continuation恢复 | 8 / 25 |
| capability-search completion | 1 / 6 |
| 实际OS退出后新进程恢复 | 3 / 25 |
| Task-root失活后原结果结算 | 1 / 5 |
| **去重合计** | **48 / 189** |

OS边界测试使用真实ReadTool、权限receipt、SQLite与新子进程；Mission走实际死亡owner的正式恢复入口，其后续模型wake在测试消费者处截住。Task读取通过实际owned HTTP服务和真实webfetch执行。它们不是真实Provider崩溃端到端验收。并行同一调用恢复通过，不等于多个不同permission continuation的终态收敛已覆盖。

checks保存完整日志和实际归档/checker脚本；live保存当前occurrence的原生句柄/结算/凭据清理、全监督链、Provider审计、全运行日志、规范数据和截图。大文本gzip归档保留全部脱敏字节，私有原件保留；解压字节比较只证明归档完整性，不替代功能验收。初次失败包括Identifier引用、错误SQLite function API、Task文件边界拒绝和Mission缺真实死亡owner，修正后重跑原合同。

旧DDL定义需遵守SCHEMA_RESET_REQUIRED，未提供迁移或执行用户重置。真实Provider崩溃恢复、刷新重开、历史不完整结果与不同continuation并行收尾仍未满足。自动审批拒绝删除空目录runner-65772-O8iIva，仅返回blocked by policy，未重试删除；产品owned进程和auth/models副本已有独立清理完成事实。
