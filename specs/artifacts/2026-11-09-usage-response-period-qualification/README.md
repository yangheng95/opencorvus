# 用量响应周期辨别证据

两套隔离开发服务实际提供 `/ui/` 和用量数据。隔离代理仅改写一个请求周期参数，回传真实服务正文。每张截图均由本人实际操作与复核。

| 图 | 实页观察 |
| --- | --- |
| [01](01-before-direct-week-uses-the-requested-period.jpg) | 直连本周真实显示 7 个区间 |
| [02](02-before-week-selection-renders-actual-year-data.jpg) | 基线误把全年结果放在本周下 |
| [03](03-after-proxy-today-still-loads-correctly.jpg) | 改后正常 Today 和真实日区间 |
| [04](04-after-week-mismatch-uses-error-not-year-chart.jpg) | 改后仍选本周，提示周期不符 |
| [05](05-after-usage-requested-and-returned-period-detail.jpg) | 展开的实际 week/year 诊断 |
| [06](06-after-chinese-period-mismatch-and-retry.jpg) | 同一错误在中文中可重试 |
| [07](07-after-retry-restores-selected-week-and-refresh-focus.jpg) | 修复代理后同页重试恢复本周与刷新焦点 |
| [08](08-after-keyboard-reaches-real-week-interval.jpg) | Tab 进入真实首日区间 |

[基线](before-observed.json)与[改后](after-observed.json)记录可见周期和焦点。[代理脚本](misrouted-usage-proxy.mjs)、[基线代理](before-proxy.log)、[改后代理](after-proxy.log)及[规则修正](routing-correction.json)对应真实请求。[在线检查器](check-usage-period-tcp.mjs)按运行契约核对[基线](before-misrouted-tcp.json)、[改后错配](after-misrouted-tcp.json)和[改后恢复](after-recovered-tcp.json)。[审计脚本](audit-owned-usage.py)和[结果](owned-final-check.json)核对[原项目](seed.json)、真实请求编号、数据库和正常关闭。服务回执：[39127](before-startup.json)、[39128](after-startup.json)。
