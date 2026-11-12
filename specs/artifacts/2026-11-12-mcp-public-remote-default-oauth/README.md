# 默认 OAuth 连接的真实协议与桌面验收

## 基线

- [实际远程表单、同端点的两笔独立配置和 HTTP 响应](../2026-11-12-mcp-add-field-validation/README.md)
- [隔离的持久代际与连续两次令牌读取](baseline-connection-snapshot.json)

## 候选

- [默认 OAuth 的真实新增表单](01-candidate-default-remote-form.png)
- [主项目公共服务已连接](02-candidate-primary-connected.png)
- [主项目按下 Disconnect 后的实际状态](03-candidate-primary-disconnected.png)
- [主项目通过同一行显式重连](04-candidate-primary-reconnected.png)
- [另一个项目最初为空](05-candidate-alternate-empty.png)
- [另一个项目的同名服务连接完成](06-candidate-alternate-connected.png)
- [真实后端重启后，已保存定义等待连接](07-candidate-after-restart-disconnected.png)
- [重启后从页面连接第二个项目](08-candidate-alternate-after-reconnect.png)
- [两个项目的正式回执、协议请求、版本稳定性及并行接入区间](candidate-protocol-evidence.json)
- [隔离数据库与模型活动](candidate-storage-evidence.json)
- [隔离浏览器、后端、代理及回环协议服务关停](candidate-shutdown-evidence.json)
