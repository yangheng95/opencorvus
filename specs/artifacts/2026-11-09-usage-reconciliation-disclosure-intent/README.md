# 用量对账展开选择：桌面与接口证据

两套开发服务在隔离目录提供真实的 `/ui/`。本人逐张复核下列截图：

| 图 | 实页观察 |
| --- | --- |
| [01](01-before-week-disclosure-open.jpg) | 基线手动展开本周的官方对账 |
| [02](02-before-period-change-collapses.jpg) | 基线切 Today 后自动折叠 |
| [03](03-before-refresh-collapses.jpg) | 基线重新展开后，同周期刷新仍自动折叠 |
| [04](04-after-period-preserves-open.jpg) | 改后切 Today 保留已展开的来源卡片 |
| [05](05-after-refresh-preserves-open.jpg) | 改后同周期刷新仍展开，焦点在刷新 |
| [06](06-after-refresh-preserves-explicit-close.jpg) | 明确关闭后刷新仍折叠 |
| [07](07-after-chinese-expanded-sources.jpg) | 再展开并切中文，来源、状态与文档入口随语言显示 |
| [08](08-after-unavailable-source-cards-withdraw.jpg) | 自有服务关停后，实际刷新失败，旧来源随数据撤下 |
| [09](09-after-retry-restores-open-and-focus.jpg) | 服务恢复后原页重试，回到三张新卡、展开状态与刷新焦点 |

[基线观察](before-observed.json)和[改后观察](after-observed.json)来自实页。在线检查器根据运行时接口说明核对[基线](before-tcp.json)、[改后](after-tcp.json)及[恢复](after-recovered-tcp.json)的自然周期、官方来源状态及只对账规则。[隔离项目和留存请求审计](owned-final-check.json)核对原文件、原提交、数据库和进程退出；改后开发日志为重启后的轮次。
