# 首次失败的日志观察边界

修复前在18809活跃时，通过rg读取自有runtime/log/dev.log，实际工具输出连续给出：

- 2026-10-20T14:52:20.417Z：continuous-goal / goal reconciliation failed，owner chat/ses_-zUROdQv5zz44ZJn5zu0，MissingModelConfigError，agent work。
- 14:52:21.418Z、14:52:22.419Z、14:52:23.420Z、14:52:24.421Z：同一owner、同一类型和原因。
- 原因正文为：No model configured for agent "work". Set `agent.work.model` or top-level `model` in opencorvus.jsonc.

这是当时工具输出的事实记录，不是重新生成的原始日志。随后同一自有根重启CLI时，dev.log被新日志替换。最终collector误读当前dev.log，输出repeatedBefore=0；该无效计数已删除，不能用当前文件推导历史错误次数。原始修复前日志未单独冻结，这是本轮日志保全的限制。

可复核的持久证据仍包括截图04的Active/0轮空会话、goal-recovery.json中同一个Goal的created、明确Pause/Resume、真实goal-controller blocked决策及恢复后实际Message/usage；共享根因另外通过三个owner的真实resolver功能检查验证。
