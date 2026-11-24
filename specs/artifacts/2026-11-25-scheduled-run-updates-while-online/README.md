# 在线定时运行历史证据

独立开发服务继续使用两条自建的 2099 年规则及本机流式检查器。基线和候选各自的实际运行及会话由正式路由回读。

- [观察页初次读取两条](baseline-online-before-peer-run.jpg)。
- [操作页新增一条成功](baseline-online-author-shows-third-run.jpg)。[真实运行回执](baseline-online-successful-peer-run.json)关联原规则、唯一逻辑触发和实际会话。
- [观察页仍为两条](baseline-online-observer-stays-stale.jpg)。[实际浏览器连接和读取](baseline-online-receipts.json)记录同一在线消息流及手动刷新前后的请求。
- [手动刷新后历史已新、摘要仍旧](baseline-online-history-refresh-only.jpg)。第三条真实记录出现，原摘要仍显示 `03:41`。
