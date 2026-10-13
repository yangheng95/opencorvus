# 383 投影大结果授权证据

后台功能修复 **通过**：[backend-contract/verification.json](backend-contract/verification.json)。正式红测三个真实包装器全部触发缺authority，修复后3 pass / 44断言，12次实际producer调用与6份完整保存文件、精确项目/Task/Session目录核对通过。压缩原始红绿日志、类型检查及范围检查同目录保存。这一结论与下述真实模型任务失败分开记录。

首次真实模型运行：[live-attempt-01](live-attempt-01/)。结果为 **未达成**：Task 的主会话与派发 worker 在能力搜索中遇到同一不可变请求 metadata 冲突，模型最终自然调用 fail_task；尚未进入报告工具及 read 接续。

- [规范失败检查](live-attempt-01/live-check-failed.json)：四次真实工具错误、会话与 Task 身份。
- [模型审计](live-attempt-01/live-failed-provider-audit.json.gz)：15 次 GPT-6.1 Sol 请求全部流式 HTTP 200/EOF。
- [规范持久化快照](live-attempt-01/live-failed-canonical.json.gz)：真实请求、结果、消息原文及失败终态。
- [物理收尾](live-attempt-01/provider-live__projected-output-authority-383-live-physical-terminal-and-pair-cleanup.json)：Host/Target 正常退出、输出排空、请求清理及 auth/models 配对副本删除。
- [句柄完成](live-attempt-01/owner-handle-joins.json)及[独立复查](live-attempt-01/independent-closure.json)。
- [归档清单和凭据扫描](live-attempt-01/credential-scan.json)：精确 allowlist 27 项，已知凭据匹配 0；未归档 runtime、数据库或凭据文件。

NativeService 回执只证明服务与流式物理收尾，不证明该 Task 的用户目标完成。主 agent 未及时取得失败页面截图，已关闭自有页面，故本轮没有页面验收。完整调查见 [383 记录](../../records/2026-10/2026-10-13-projected-output-authority-383.md)。

后续两次真实运行也未达到功能验收，分别保存，不覆盖首轮：

- [Attempt02](live-attempt-02/credential-scan.json)：本地preflight每请求15秒TimeoutError，尚未建立业务Task。唯一实际模型请求为memory助手、HTTP200/EOF。原失败、owner与正常物理收尾14项，凭据匹配0。
- [Attempt03](live-attempt-03/credential-scan.json)：预检成功、正常CLI显式选包后，真实Provider在首个Task执行轮返回overloaded，业务工具尚未执行。[规范失败事实](live-attempt-03/failure-canonical.json.gz)与[真实失败页面截图](live-attempt-03/actual-task-provider-overloaded.png)均保留。主agent实际查看并关闭tab17，本子任务也人工查看截图；这是失败证据，不是大结果/read功能通过。正常物理收尾及配对清理共24项，凭据匹配0。

共享metadata根因独立修复与10项/74断言后台检查见[385档案](../2026-10-13-capability-request-metadata-385/README.md)。后续复验仍须证明真实投影工具大结果、read接续及Task完成。
