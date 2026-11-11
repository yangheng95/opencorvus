# 定时任务状态回执的桌面证据

真实基线 `39800/ui` 连接隔离开发服务 `39798`。代理保留真实事件连接，只对指定响应缩短正文。

- [原活动详情](02-baseline-active-detail.png)，[暂停已提交但详情保留旧状态](03-baseline-pause-committed-still-active.png)，[真实网络诊断](04-baseline-pause-network-detail.png)，[再次提交的版本冲突](05-baseline-stale-pause-conflict.png)。
- [正式版本、项目、未来 Fire 和回执证据](baseline-status-evidence.json)。

最终候选桌面 `39802/ui` 连接隔离开发服务 `39801`。

- [首次候选检查时详情被加载提示替换](10-candidate-zh-check-pending.png)。
- [英文暂停回执截断后确认](12-final-en-paused.png)，[完整恢复回执](13-final-en-resumed.png)。
- [中文状态和下次运行待确认](14-final-zh-status-unconfirmed.png)，[手动读取再中断后的真实诊断](15-final-zh-check-failure-diagnostics.png)，[键盘重试保留原详情](16-final-zh-check-keeps-detail.png)，[原位置显示已暂停](17-final-zh-paused-original-detail.png)。
- [真实版本冲突](18-final-zh-version-conflict.png)，[列表显示另一连接提交的新版本](19-final-zh-list-shows-current-version.png)。
- [正式版本、精确回执及运行历史](final-status-evidence.json)，[持久版本和唯一当前投递记录](final-database-evidence.json)。
