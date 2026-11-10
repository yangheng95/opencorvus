# 停止消息卡本地化与原始诊断证据

对应[规格](../../records/2026-11/2026-11-10-stopped-message-diagnostic-disclosure.md)。[实际中文 Mission 基线](../2026-11-10-composer-stop-scope/candidate-mission-zh-stopped.jpg) 和[实际 Task 基线](../2026-11-10-composer-stop-scope/candidate-task-cancelled.jpg) 来自上一批真实停止操作；其原始消息和关闭事实可在[规范化观测](../2026-11-10-composer-stop-scope/stop-observations.json)核对。

- 首次候选实际交互：[英文 Work 冷读](en-work-cold.jpg)、[Work 流式输出后实际停止](en-work-live-stop.jpg)、[中文 Mission 默认视图](zh-mission-collapsed.jpg)、[中文 Task 默认视图](zh-task-collapsed.jpg)。第一轮复核后，最终仅调整取消 Copy 的提示气泡外观；原本地化卡片和真实请求保持。
- 最终候选 `main-C3FmnzaH.js`：[默认折叠时的中性复制提示](zh-mission-copy-tooltip.jpg)、[真实复制反馈](zh-mission-copied.jpg)、[展开原始 Mission 原因和结构化取消](zh-mission-details.jpg)、[独立 Chat 冷读](zh-chat-cold.jpg)、[普通错误对照](en-ordinary-error.jpg)。均为实际 1280×720 工作台操作后人工复核。首次后台键盘操作未取得剪贴板结果，后以真实指针点击取得已复制反馈和实际内容；最终构建重复成功。
- [规范化事实](stop-diagnostic-observations.json) 核对四条冷读历史的真实 Message/Parts 与上批数据库原行相同、普通失败仍为原记录、新 Work 保留已输出的文字和实际 `session.abort` 事实。最终从隔离页面读回实际剪贴板，分解并比对原 Mission reason 和完整错误 envelope。无外部模型或用户凭据。
