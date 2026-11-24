# 定时任务重连后的运行历史证据

页面和宿主均为隔离开发服务，规则仅绑定自建数据。所有实际运行经公开入口、真实运行回执和本机流式检查器完成。

## 基线

- [观察页已接受空历史](baseline-history-before-run.jpg)。未来的固定时刻保持 2099 年。
- [另一页完成真实运行](baseline-author-accepted-run.jpg)。[原运行与逻辑触发](baseline-genuine-run.json)记录其成功结果，定时器尚未触发未来规则。
- [重连时只更新上次运行时间](baseline-reconnected-summary-updates-history-stale.jpg)。历史仍显示从未运行。
- [手动刷新才显示原运行](baseline-manual-refresh-finds-run.jpg)。[实际连接和读取回执](baseline-reconnect-receipts.json)区分了重连触发的列表读和之后显式发出的历史读。

## 候选

- [断线前确认为一条并聚焦原会话](candidate-confirmed-run-before-disconnect.jpg)。
- [重连后保留上次已确认行并标记正在刷新](candidate-rejoined-keeps-confirmed-run-while-refreshing.jpg)。该请求的实际 200 响应体被暂缓约 11 秒。
- [放行后自动显示两条成功记录](candidate-rejoined-shows-both-runs-and-retains-focus.jpg)。新的记录排在前面，旧活动链接仍在同一原会话。
- [键盘打开原会话](candidate-original-keyboard-link-opens-first-session.jpg)和[独立规则仍为空](candidate-control-rule-keeps-its-own-empty-history.jpg)。
- [候选请求、实际运行、流式响应和正式检查摘要](candidate-run-and-reconnect-receipts.json)记录两条手动运行及两个未来触发的真实状态。
