# 用量刷新前后的真实桌面与请求

基线为隔离 `39847/ui` 和开发服务 `39846`，只持有或截断原服务实际回复。

- [确认的今日报表](02-baseline-usage-today.png)、[同周期刷新超过标准期限](03-baseline-same-period-refresh-blank.png)、[完整响应后恢复](04-baseline-same-period-restored.png)。
- [失败时原诊断和报表状态](06-baseline-refresh-failure-diagnostic.png)、[重试期间的状态](07-baseline-retry-removes-diagnostic.png)、[切到真正本周](08-baseline-week-replaces-today.png)。
- [真实基线响应及区间](baseline-usage-evidence.json)。
