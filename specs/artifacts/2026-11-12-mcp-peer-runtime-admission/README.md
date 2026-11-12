# 跨后端配置变更与连接运行证据

两个真实开发后端共享一套隔离数据，只有本机匿名协议请求。[连接回执](baseline-peer-first-pass.json)、[断开回执](baseline-peer-disconnect-evidence.json)、[桌面回执](baseline-peer-desktop-evidence.json)、[服务原因](baseline-peer-diagnostics.json)、[授权预检](baseline-peer-auth-evidence.json)、[全局保存](baseline-peer-global-evidence.json)、[资源首个请求](baseline-peer-inventory-evidence.json)和[提示命令缓存](baseline-peer-command-evidence.json)。

| 桌面实拍 | 画面 |
| --- | --- |
| [01](01-baseline-reader-settings-en.png) | 读取端真实项目的可连接行 |
| [02](02-baseline-connect-after-peer-en.png) | 另一后端保存成功后首次点击返回 500 |
| [03](03-baseline-reader-retry-en.png) | 同一按钮重试后已连接 |
| [04](04-baseline-disconnect-after-peer-en.png) | 刚保存后断开返回成功，实际是普通已断开 |
| [05](05-baseline-normal-manual-disconnect-en.png) | 稳定配置的对照动作显示手动断开 |
| [06](06-candidate-first-connection-en.png) | 首轮候选在 peer 保存后首次连接成功 |
| [07](07-candidate-first-disconnect-en.png) | 首轮候选首次断开记录手动状态 |
| [08](08-candidate-in-flight-conflict-en.png) | 首轮候选在途冲突的通用提示 |
| [09](09-candidate-current-connection-en.png) | 首轮候选冲突后连接新端点 |
| [10](10-final-first-connection-en.png) | 本地化构建首次连接 |
| [11](11-final-first-disconnect-en.png) | 本地化构建手动断开 |
| [12](12-final-in-flight-conflict-en.png) | 本地化后首次冲突，状态读回前仍显示连接中 |
| [13](13-final-first-connection-en.png) | 最终构建英文连接 |
| [14](14-final-conflict-readback-en.png) | 最终英文冲突提示与已读回的可重试状态 |
| [15](15-final-conflict-readback-zh.png) | 最终中文冲突提示与独立项目状态 |
| [16](16-final-retry-connected-zh.png) | 中文重试后已连接 |
| [17](17-final-manual-disconnect-zh.png) | 刚保存后首次手动断开，中文状态准确 |

[首轮候选](candidate-first-pass.json)、[本地化与读回调整前](candidate-localized-before-readback.json)、[最终桌面回执](candidate-desktop-evidence.json)、[生成客户端](candidate-sdk-evidence.json)、[重启读回](candidate-restart-evidence.json)、[本机协议](candidate-protocol-evidence.json)及 [SQLite 检查](candidate-storage-evidence.json)。
