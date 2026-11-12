# 用量刷新前后的真实桌面与请求

基线为隔离 `39847/ui` 和开发服务 `39846`，只持有或截断原服务实际回复。

- [确认的今日报表](02-baseline-usage-today.png)、[同周期刷新超过标准期限](03-baseline-same-period-refresh-blank.png)、[完整响应后恢复](04-baseline-same-period-restored.png)。
- [失败时原诊断和报表状态](06-baseline-refresh-failure-diagnostic.png)、[重试期间的状态](07-baseline-retry-removes-diagnostic.png)、[切到真正本周](08-baseline-week-replaces-today.png)。
- [真实基线响应及区间](baseline-usage-evidence.json)。

候选为 `39849/ui` 和隔离开发服务 `39848`。

- [长读显示上次报告](10-candidate-refresh-retains-confirmed-report.png)、[完整晚响应被接受](11-candidate-late-report-accepted.png)、[明确取消且保留报告](12-candidate-cancel-retains-confirmed-report.png)。
- [截断后旧报表和错误](13-candidate-failed-refresh-keeps-report.png)、[重试期间诊断仍展开](14-candidate-retry-retains-report-diagnostic.png)、[成功归还刷新焦点](15-candidate-retry-restores-refresh-focus.png)。
- [切本周等待真实响应](16-candidate-new-week-loading.png)、[本周完整报告](17-candidate-week-confirmed.png)、[取消本月首读](18-candidate-new-month-cancelled.png)、[重新读取本月](19-candidate-month-accepted.png)。
- [中文刷新失败](20-candidate-chinese-refresh-failed.png)、[中文重试保留报告](21-candidate-chinese-retry-keeps-report.png)、[成功后用键盘检视首小时](22-candidate-chinese-grid-keyboard.png)。
- [正式请求、时间和区间](candidate-usage-evidence.json)、[隔离数据状态](candidate-storage-evidence.json)。
