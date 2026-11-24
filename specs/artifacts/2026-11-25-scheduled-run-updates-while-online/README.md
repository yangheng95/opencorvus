# 在线定时运行历史证据

独立开发服务继续使用两条自建的 2099 年规则及本机流式检查器。基线和候选各自的实际运行及会话由正式路由回读。

- [观察页初次读取两条](baseline-online-before-peer-run.jpg)。
- [操作页新增一条成功](baseline-online-author-shows-third-run.jpg)。[真实运行回执](baseline-online-successful-peer-run.json)关联原规则、唯一逻辑触发和实际会话。
- [观察页仍为两条](baseline-online-observer-stays-stale.jpg)。[实际浏览器连接和读取](baseline-online-receipts.json)记录同一在线消息流及手动刷新前后的请求。
- [手动刷新后历史已新、摘要仍旧](baseline-online-history-refresh-only.jpg)。第三条真实记录出现，原摘要仍显示 `03:41`。

## 候选

- [在线标签自动更新至四条并保留焦点](candidate-online-shows-new-run-and-keeps-focus.jpg)。上方最新时间为 `03:55`，旧 `03:47` 会话入口保持持焦。
- [已打开的另一规则仍显示自己接纳的空历史](candidate-online-control-retains-empty-history.jpg)。
- [通知阻断时显式刷新](candidate-manual-refresh-reads-summary-and-history.jpg)。两次最近结果在同一分钟，实际列表和历史请求均被接收，焦点仍在同一按钮。
- [实际事件流、浏览器请求、持久运行及调度检查回执](candidate-online-and-manual-receipts.json)。两次真正提交，各发一条精确规则通知；最新摘要与实际下发的运行开始时间一致。
