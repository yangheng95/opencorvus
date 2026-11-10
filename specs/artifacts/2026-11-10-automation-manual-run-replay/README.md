# 定时任务手动运行复用已接受的执行证据

对应[规格](../../records/2026-11/2026-11-10-automation-manual-run-replay.md)。[真实运行记录](run-observations.json)保留两次桌面现场的代理回执、公开接口历史、重启和跨项目样本，以及原数据库保留的行身份。真实开发后端使用隔离目录和本机流式模型 `b165-review/review`，无外部 Provider 凭据。代理只截断指定定义的首次成功回执，其他请求正常转发。

| 现场 | 人工复核 |
| --- | --- |
| 基线：完整的 607 字节回执被截为 24 字节 | [页面显示从未运行，按钮仍可直接运行](baseline-lost-run-receipt.jpg)；[再次点击后实际有两次成功](baseline-two-completed-runs.jpg) |
| 初次候选：同一标签页重试已经复用原结果 | [首次截断后，旧快照仍显示从未运行](candidate-unconfirmed-en.jpg) |
| 最终候选：完整的 595 字节回执被截为 24 字节 | [英文页明确标为未确认](final-unconfirmed-en.jpg)；[同一标签页重载后，中文页保留提示和重试，已读到的真实时间照常显示](final-reloaded-zh.jpg) |
| 最终候选：取回原回执后发起新动作 | [重试后只有一条成功](final-one-after-retry-zh.jpg)；[明确再次运行后有两条独立成功](final-independent-run-zh.jpg) |
