# 服务商读取和重试进度的证据

[规格与验证记录](../../records/2026-11/2026-11-11-provider-read-progress.md) · [真实读取回执](api-evidence.json)。截图来自隔离开发桌面页，已逐张检查，归档只裁切设置内容。

- [基线自动读](02-baseline-automatic-reopen-duplicate.png)同时显示两次加载。改后[真正首读](04-final-en-first-loading.png)保留顶部提示，[已有错误时自动读](05-final-en-automatic-pending.png)只在恢复区显示进度。
- [主动重试](06-final-en-retrying.png)保持原错误、原筛选与清晰的键盘焦点。[成功](07-final-en-recovered.png)后焦点回原搜索，读到 Bedrock 的 67 个模型。
- [中文重试](09-final-zh-retrying.png)与[重试失败](10-final-zh-retry-failed.png)保留原按钮焦点和可再次操作的入口。
- [读取时 Tab 到行配置](11-final-zh-pending-focus-moved.png)和[恢复后行焦点丢失](12-final-zh-recovered-row-focus-lost.png)记录另一个可复现问题，下一批调查行实例如何在目录更新中保留。
