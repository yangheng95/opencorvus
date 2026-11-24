# 普通对话更新与任务看板读取证据

真实开发页面运行于隔离项目 `mission-list-review`。普通对话和多步任务草稿均经真实公开接口创建。中继只控制真实看板响应体何时到达页面，记录原请求身份，不构造看板内容。

- [原版手动刷新在途](baseline-refresh-pending.png)展示真实旧版刷新图标和保留的草稿卡片。
- [基线请求记录](baseline-mission-requests.jsonl)记录原服务端两次返回 200。原请求在普通对话更名时被关闭，替代请求随后返回。
- [原版恢复后的页面](baseline-refresh-recovered.png)展示普通对话的新标题、再次可用的刷新按钮和内容始终相同的草稿。

候选页面延续同一个持久化草稿和普通对话。

- [普通对话新标题与进行中的原刷新](candidate-refresh-during-peer-rename.png)和[同一刷新完成](candidate-refresh-completed.png)展示侧栏和看板的实际结果。[更名回执](verified-peer-rename.json)与[请求时间](verified-mission-requests.jsonl)保留了原响应身份。
- [另一页保存后自动更新的分栏看板](candidate-board-receives-mission-edit.png)展示仍在 Backlog 的原卡片。[同一页列表上的完整正文](candidate-list-shows-full-saved-request.png)和[精确草稿查询回执](verified-draft-read.json)核对新文字和原身份。
