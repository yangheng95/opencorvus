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
