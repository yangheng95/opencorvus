# 普通对话更新与任务看板读取证据

真实开发页面运行于隔离项目 `mission-list-review`。普通对话和多步任务草稿均经真实公开接口创建。中继只控制真实看板响应体何时到达页面，记录原请求身份，不构造看板内容。

- [原版手动刷新在途](baseline-refresh-pending.png)展示真实旧版刷新图标和保留的草稿卡片。
- [基线请求记录](baseline-mission-requests.jsonl)记录原服务端两次返回 200。原请求在普通对话更名时被关闭，替代请求随后返回。
- [原版恢复后的页面](baseline-refresh-recovered.png)展示普通对话的新标题、再次可用的刷新按钮和内容始终相同的草稿。
