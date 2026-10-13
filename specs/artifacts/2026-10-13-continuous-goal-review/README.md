# 持续目标独立复核证据

对应[汇总方案](../../records/2026-10/2026-10-13-continuous-goal-review.md)和[独立审计](../../records/2026-10/2026-10-13-continuous-goal-independent-audit.md)。本轮在授权 worktree 使用隔离 Bun 1.4.0；模型恢复用例使用本机受控流式 Provider，没有真实凭据。

| 证据 | 结果与范围 |
| --- | --- |
| [首次复现](independent-before.log) | 10 pass / 2 fail；归档 Mission/Task 的重叠创建实际返回 200 |
| [删除复现](independent-deletion-before.log) | 11 pass / 4 fail；额外复现 Chat/Mission 保留历史删除后仍 active |
| [独立修后](independent-after.log) | 15 pass，119 assertions |
| [主 agent 复跑](parent-regression.log) | 核心13 + 独立15 + 并发跨进程1，共29 pass |
| [恢复测试初次清理超时](runtime-checker-timeout.log) | 已激活恢复请求，测试等待进程退出超时；不是模型行为结论 |
| [恢复与清理修后](runtime-after.log) | 实际两进程、流式 HTTP、原 Message/receipt、一次续跑预算、回复输出全部通过 |
| [类型检查](typecheck.log) | 根 typecheck，8/8 workspace 检查通过 |

运行测试的 Provider 端为受控协议 fixture，只证明真实 Prompt/SessionWake/数据库/进程恢复合同。本轮没有真实模型端到端或 UI 验收；没有修改 UI。Task/Mission 的物理崩溃矩阵未扩展，前一轮三模式真实模型与截图仍见[原验收](../2026-10-13-continuous-goal-mode/README.md)。
