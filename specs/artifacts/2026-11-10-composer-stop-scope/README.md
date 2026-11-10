# 主输入区停止范围的桌面与执行证据

对应[规格](../../records/2026-11/2026-11-10-composer-stop-scope.md)。此批使用隔离开发工作台和本机流式协议；所有对象均为测试数据。

- 基线真实桌面：[Task 正在运行](baseline-task-stop.jpg)、[Work 正在运行](baseline-work-stop.jpg)、[仅 Work 已停止](baseline-work-stopped.jpg)。两处控制的实际无障碍名和原生提示相同；真实点击 Work 后，独立 Task 继续运行。
- 英文候选：[Work 主按钮焦点提示](candidate-work-keyboard.jpg)、[有草稿时的独立 Stop 和 Send](candidate-work-draft.jpg)、[Work 停止且未发送草稿仍可见](candidate-work-stopped-draft.jpg)、[Task 的轮次取消提示](candidate-task-keyboard.jpg)、[Task 已取消](candidate-task-cancelled.jpg)。键盘焦点进入实际按钮并显示提示，回车调用原停止操作。
- 简体中文候选：[独立 Chat](candidate-chat-zh-keyboard.jpg)、[Mission 的专用提示](candidate-mission-zh-keyboard.jpg)、[Mission 已停止且空闲](candidate-mission-zh-stopped.jpg)。语言从隔离页面的外观设置切换，未改变用户正在使用的页面或应用。
- [规范化运行事实](stop-observations.json) 保存同一候选资产名、两个独立 Session 的 `session.abort`、Task 的 `task.cancel` 与精确轮次、Mission 的 `mission.abort` 和 durable `mission.execution.closed`，以及实际流式连接关闭顺序。所有截图均 1280×720，已经逐张人工复核。真实流不代表外部 Provider 或模型质量验收。
