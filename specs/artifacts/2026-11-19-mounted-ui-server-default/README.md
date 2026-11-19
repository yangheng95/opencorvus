# 反向代理下默认连接的桌面证据

- `baseline-prefixed-offline.png` 显示前缀始终可见，页面已加载但连接为 Offline。
- `baseline-truncated-server-url.png` 显示默认连接被截到 `/team`。
- `baseline-manual-recovery.png` 显示同一基线浏览器通过 Network 保存完整前缀后恢复。
- `baseline-relay-sample.jsonl` 是同次转发记录中按路径和状态归类的一份样本。网页、脚本、语言资源和正确目标的健康检查为 200，错误目标的真实健康请求为 404。
- `candidate-prefixed-online.png` 和 `candidate-prefixed-network.png` 显示全新浏览器通过 `/team/ui/edge/ui/` 直接在线，连接地址和项目作用域已确定。
- `candidate-nested-online.png`、`candidate-forwarded-online.png`、`candidate-direct-online.png` 分别显示嵌套文档、带转发头的普通前缀和直接根加载。
- `candidate-explicit-saved.png` 和 `candidate-explicit-reloaded.png` 显示通过 40220 加载页面、手动连到 40218，重载后地址仍指向 40218，代理项目作用域来自其 `baseline` 目录。
- `candidate-relay-sample.jsonl` 记录两种前缀下真实网页模块、语言、健康检查及项目发现的转发结果。

[根因及验收规格](../../records/2026-11/2026-11-19-mounted-ui-server-default.md)
