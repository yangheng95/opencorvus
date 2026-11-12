# 跨后端配置变更与连接运行证据

两个真实开发后端共享一套隔离数据，只有本机匿名协议请求。[连接回执](baseline-peer-first-pass.json)、[断开回执](baseline-peer-disconnect-evidence.json)、[桌面回执](baseline-peer-desktop-evidence.json)、[服务原因](baseline-peer-diagnostics.json)、[授权预检](baseline-peer-auth-evidence.json)、[全局保存](baseline-peer-global-evidence.json)、[资源首个请求](baseline-peer-inventory-evidence.json)和[提示命令缓存](baseline-peer-command-evidence.json)。

| 桌面实拍 | 画面 |
| --- | --- |
| [01](01-baseline-reader-settings-en.png) | 读取端真实项目的可连接行 |
| [02](02-baseline-connect-after-peer-en.png) | 另一后端保存成功后首次点击返回 500 |
| [03](03-baseline-reader-retry-en.png) | 同一按钮重试后已连接 |
| [04](04-baseline-disconnect-after-peer-en.png) | 刚保存后断开返回成功，实际是普通已断开 |
| [05](05-baseline-normal-manual-disconnect-en.png) | 稳定配置的对照动作显示手动断开 |
