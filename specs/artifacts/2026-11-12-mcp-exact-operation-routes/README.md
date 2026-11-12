# 连接操作地址的桌面与服务基线

[实际基线回执](baseline-route-evidence.json)记录两个隔离项目的桌面请求、独立操作请求和准确项目的状态读取。

| 实拍 | 画面 |
| --- | --- |
| [01](01-baseline-exact-names-en.png) | 英文连接设置呈现六个真实原名 |
| [02](02-baseline-dot-route-error-en.png) | `.` 的连接失败，实际路径移除了名称 |
| [03](03-baseline-dotdot-route-error-en.png) | `..` 的连接失败，实际路径还移除了 `/mcp` |
| [04](04-baseline-empty-route-error-en.png) | 空名称连接失败 |
| [05](05-baseline-slash-connected-en.png) | 斜杠名称经现路径正确连接 |
| [06](06-baseline-empty-auth-project-zh.png) | 另一同名项目的空名 OAuth 连接 |
| [07](07-baseline-empty-oauth-route-error-zh.png) | 中文连接操作同样返回真实 404 |

| 候选实拍 | 画面 |
| --- | --- |
| [08](08-candidate-before-connection-en.png) | 英文同一清单和独立连接控件 |
| [09](09-candidate-empty-and-dot-connected-en.png) | 空名、点号、双点分别连接 |
| [10](10-candidate-empty-and-dot-restored-en.png) | 三条记录各自恢复手动断开状态 |
| [11](11-candidate-empty-auth-ready-zh.png) | 另一同名项目空名显示需要认证 |
| [12](12-candidate-empty-auth-dialog-zh.png) | 中文确认显示空名与准确项目文件夹 |
| [13](13-candidate-local-oauth-consent.png) | 自有本地提供方的同意页面 |
| [14](14-candidate-empty-oauth-callback-zh.png) | 真实中文授权成功回调 |
| [15](15-candidate-empty-oauth-connected-zh.png) | 另一项目空名已连接 |

[桌面实际请求和项目读回](candidate-desktop-evidence.json)、[重启和授权清理](candidate-restart-evidence.json)、[生成客户端实测](candidate-sdk-evidence.json)、[公开接口结构](candidate-openapi-evidence.json)、[本地协议](candidate-protocol-evidence.json)和[隔离数据库检查](candidate-storage-evidence.json)。
