# Task 成员重连与阅读连续性

[调查与范围](../../records/2026-10/2026-10-23-task-member-reconnect.md) · [实际观察、公开返回与资源证据](evidence.json)

同一自有页面经历正常服务关闭、Offline、另一完整数据副本在相同端口启动、自然 Online。14 段正文和 5 条 Sources 的组件身份、内容与阅读位置保持。本批未发现需要新增生产修复的证据。

| 实际截图 | 人工观察 |
| --- | --- |
| [原来源阅读](before-source-reading.png) | 原 B 的 ReConcile 来源、域名和后续长正文 |
| [同页离线](offline-same-page.png) | Offline 提示期间保留正文和阅读位置 |
| [同页恢复](reconnected-same-page.png) | Online，仍处于原来源和段落 |
| [成员往返](member-return-reading.png) | 实际切到 A 再回 B，恢复相同阅读位置 |

四图均实际查看，没有截图基线或 UI 自动化测试。低频私有观察在冷打开捕获 62 条事件，重连保持原 owner；有意切换成员时又捕获 38 条正常卸载事件。日志批次范围单独记录，未把空日志当成完整证明。

独立 checker 验证旧 epoch 到新 epoch 的完整 snapshot、20 条消息和 5 条原来源。它不是浏览器重连请求：静止成员 revision 未变时，页面沿用原已读正文；离线期间新增内容和活跃流恢复仍未覆盖。

当前 OpenCorvus 认证和完整模型目录配对，4 次真实 Sol 流式请求均 200/原 EOF。两服务正常退出、原 exec 0、8 份配对文件退休；90 表完整源数据保留，仅目标的两条运行租约自然变化。用户数据库未参与本批。
