# 日志刷新失败保留上次结果的实页截图

Windows 桌面专用标签。基线开发端口 40548，应用构建 main-CJgaiAec.js。四条标识来自实际本机日志公开接口。

| 截图 | 人工核对 |
| --- | --- |
| [01](01-baseline-en-accepted-tail.jpg) | 正常读取时有 4 条服务端匹配，查询与复制、路径动作可用。 |
| [02](02-baseline-en-failed-refresh-drops-tail.jpg) | 服务实际退出后刷新，保留原查询和错误，但已加载记录全部消失。 |
| [03](03-baseline-en-transport-detail.jpg) | 展开失败细节可见真实网络错误和原栈。 |

[规格和验收](../../records/2026-11/2026-11-23-log-refresh-retains-last-read.md)
