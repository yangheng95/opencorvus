# 用量图表随有效数据展示：桌面与接口证据

两个实际开发服务提供 `/ui/`。通过启动回执验证唯一自有进程，再正常关停自建服务，浏览器保持在同一页面，用真实 Refresh 触发断线请求。新构建同样测试并在原页重试恢复。下图均由本人操作并复核。

| 图 | 实页观察 |
| --- | --- |
| [01](01-before-zero-week.jpg) | 基线正常零用量，有 7 个区间和图例 |
| [02](02-before-transport-failure-with-legend.jpg) | 基线真实断线，错误后还有空图间距和孤立图例 |
| [03](03-after-zero-week.jpg) | 改后正常零用量的周图保持 |
| [04](04-after-zero-year-calendar.jpg) | 改后全年格局和月份坐标保持 |
| [05](05-after-transport-failure-controls-remain.jpg) | 改后真实断线只保留失败提示和控件 |
| [06](06-after-zh-offline-retry.jpg) | 同一断线页面切为中文 |
| [07](07-after-zh-recovered-zero-week.jpg) | 原页面中文重试恢复周图，刷新按钮保有焦点 |
| [08](08-after-zh-keyboard-interval.jpg) | Tab 进入首日区间并显示本地时刻与 0 令牌 |

[基线观察](before-observed.json)记录展开的实际 `TypeError: Failed to fetch` 和空图列表；[改后观察](after-observed.json)记录周/月/日/年、错误与恢复。用量[在线检查器](check-usage-tcp.mjs)读取服务实时接口说明并验证[基线](before-online-tcp.json)、[改后](after-online-tcp.json)及[恢复](after-recovered-tcp.json)。[三次关停与进程检查](shutdown-verification.json)和[隔离项目审计](owned-final-check.json)记录进程退出、原文件身份及数据库事实。
