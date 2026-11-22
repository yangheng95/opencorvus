# 日志刷新失败保留上次结果的实页截图

Windows 桌面专用标签。基线开发端口 40548，应用构建 main-CJgaiAec.js。四条标识来自实际本机日志公开接口。

| 截图 | 人工核对 |
| --- | --- |
| [01](01-baseline-en-accepted-tail.jpg) | 正常读取时有 4 条服务端匹配，查询与复制、路径动作可用。 |
| [02](02-baseline-en-failed-refresh-drops-tail.jpg) | 服务实际退出后刷新，保留原查询和错误，但已加载记录全部消失。 |
| [03](03-baseline-en-transport-detail.jpg) | 展开失败细节可见真实网络错误和原栈。 |

[规格和验收](../../records/2026-11/2026-11-23-log-refresh-retains-last-read.md)

候选端口 40550，最终构建 main-gMBBzVGS.js。

| 截图 | 人工核对 |
| --- | --- |
| [04](04-candidate-en-before-outage.jpg) | 正常读取正式接口创建的四条候选标识。 |
| [05](05-candidate-en-failure-retains-tail.jpg) | 英文刷新失败保留四条和查询，提示上次加载结果。 |
| [06](06-candidate-zh-failure-retains-tail.jpg) | 中文复现同一真实断连，四条及来源仍可读。 |
| [07](07-candidate-en-first-read-failure.jpg) | 从未加载过尾部的独立标签显示首次读失败。 |
| [08](08-candidate-en-retained-original-detail.jpg) | 故障时仍能展开并读取实际原始记录。 |
| [09](09-candidate-en-refresh-uses-new-tail.jpg) | 同址重启后在原页成功刷新为三条新记录。 |
| [10](10-candidate-zh-refresh-recovery.jpg) | 中文查询亦刷新为三条，刷新焦点、路径动作可用。 |
| [11](11-candidate-en-switches-to-second-connection.jpg) | 本地专用标签保存到第二个自有实例。 |
| [12](12-candidate-en-second-connection-exact-tail.jpg) | 同一标签重新打开后，结果来自实际第二连接。 |
