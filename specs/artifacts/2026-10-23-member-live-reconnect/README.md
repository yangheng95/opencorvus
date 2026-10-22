# 成员活跃流重连

[方案、测量修正与边界](../../records/2026-10/2026-10-23-member-live-reconnect.md) · [真实网络、Provider、数据和资源事实](evidence.json) · [低频生命周期记录](lifecycle.ndjson)

真实 Task SSE 连接在原 B 正文输出期间断开，3.062 秒后以原游标恢复。同一个原模型 reader 又持续 25.461 秒后 EOF；页面继续追加正文，已有组件保持。本轮修正了私有验收工具的快照读取方式，没有新增生产补丁。

| 实际截图 | 人工观察 |
| --- | --- |
| [首轮真实长文](first-real-stream.png) | RFC2606 任务的前文增长；此时尚未执行断流 |
| [首轮真实来源](first-rfc2606-source.png) | 新来源及自然完成保留，首轮不宣称重连通过 |
| [复验完整基准](retry-baseline.png) | 17 段正文、6 来源及全部历史 |
| [真实断流前](before-active-cut.png) | 正文 owner 31，883 字符、9 块 |
| [恢复后继续增长](after-active-cut.png) | 同一 owner 31，2110 字符、17 块 |
| [新后文完成](new-final-body.png) | 新材料说明自然输出到 LIVE547R_AFTER_END |
| [第七来源与完成态](completed-rfc6761-source.png) | RFC6761 来源、长正文与 Task completed |

七图均实际呈现并人工查看，DOM 元组用于解释观察，不是自动化断言。原 17 个正文 owner 和六个 Source owner 保持，后续新增内容自然挂载；最终公开成员端点为 28 消息/7 来源。

原始审计磁盘文件只在绑定/结算等边界发布。首轮因此有两次保护拒绝，未实际断流；复验改为每 500ms 从原 audit 对象采集最小 reader pulse，并匹配可见 assistant Message。原错误与成功复验分别保留。

两组共 27 次真实 Sol 流式请求全部 200/原 EOF，两个后端和两个 relay 正常退出，8 份配对文件退休。完整 90 表源数据保持；目标的运行租约、原项目记忆及三个原 Session 时间随真实责任更新，差异明确列出。用户数据库未参与。

资格限于此次 Task 同 epoch 活跃流恢复；其他重连边界仍需独立实页验收。
