# 设置页日志导出证据

隔离开发服务的日志目录只含本次服务运行日志和本人创建的 `support-bundle-fixture.log`。这里记录真实页面和必要的请求元数据。

## 基线

- [原请求等待下载交接](baseline-export-in-progress.jpg)。真实通用设置的按钮呈忙态。
- [切换设置后重新启用](baseline-settings-return-reenables-ongoing-export.jpg)。原响应仍被隔离中继暂缓时，按钮再次显示 `Export ZIP`。
- [两笔真实服务响应](baseline-duplicate-export-receipts.json)。相隔 19.362 秒的两次键盘操作各自发起了请求，标识不同。两笔响应均被中继暂缓，关闭隔离标签时取消交接。
