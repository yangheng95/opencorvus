# 设置页日志导出证据

隔离开发服务的日志目录只含本次服务运行日志和本人创建的 `support-bundle-fixture.log`。这里记录真实页面和必要的请求元数据。

## 基线

- [原请求等待下载交接](baseline-export-in-progress.jpg)。真实通用设置的按钮呈忙态。
- [切换设置后重新启用](baseline-settings-return-reenables-ongoing-export.jpg)。原响应仍被隔离中继暂缓时，按钮再次显示 `Export ZIP`。
- [两笔真实服务响应](baseline-duplicate-export-receipts.json)。相隔 19.362 秒的两次键盘操作各自发起了请求，标识不同。两笔响应均被中继暂缓，关闭隔离标签时取消交接。

## 候选

- [切页后仍忙](candidate-export-pending-after-tab-change.jpg)和[关闭重开设置后仍忙](candidate-export-pending-after-reopen.jpg)。浏览器使用了同一个待交接的服务响应，原生键盘 Enter 已在忙态按钮上实际按下。
- [切页后仍有成功反馈](candidate-export-success-after-tab-change.jpg)。实际浏览器下载已收到，操作入口恢复可用。
- [切页后仍可展开原诊断](candidate-export-error-after-tab-change.jpg)。独占打开本批私有日志后，原服务返回 500，界面显示原请求标识。
- [中文重试完成](candidate-export-retry-chinese.jpg)。释放该文件后通过相同按钮实际重试，浏览器收到新归档，焦点仍在导出按钮，显示本地化成功提示。
- [候选请求与两份浏览器下载回执](candidate-export-receipts.json)。原请求、真实失败和明确重试分别产生 200、500、200。两份下载均用标准归档读取器验证，清单归属于实际隔离目录，自有日志原始 100 字节逐字节一致。
