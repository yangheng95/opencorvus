# 通知权限反馈调查

对应[调查与方案](../../records/2026-11/2026-11-08-notification-permission-feedback.md)。仅本人临时实例与真实页面的通知偏好/权限结果，不使用凭据、模型、消息或实际通知。

不预设 IAB 权限值，不伪造 Notification 对象或截取请求。实际截图/只读页面观察将在交互后登记；没有 UI 自动化或 DOM/截图断言。

38950/main-BydIgfm3.js，1280×720；三张逐张人工查看：

- 01-natural-enabled-no-status.jpg：真实 off→on 后稳定可见 true，页面无错误反馈；没有据此断言具体权限值。
- 02-natural-enabled-chinese.jpg：原地中文仍是同一可见偏好状态。
- 03-remounted-general.jpg：真正离开/重进 General，仍为当前 true/null。
- before-observations.json：实际原值、关闭/开启、稳定检查、双语、重开与最后恢复英文/初始 true 的只读观察。

通知错误路径尚未实际验收，General/翻译/架构均未修；没有 after 产品截图或新构建。没有通过隐藏权限对象、注入或用户浏览器来补足缺口。本人页面关闭，服务正常 shutdown、原启动句柄 23256 exit 0，无模型/消息/通知发送。

相关宿主 API 纯正向测试 6 项/17 断言通过；只清理原两条“未调用/未走另一宿主”的核心负向断言，保留明确交付回执和载荷。该夹具没有 DOM/组件/页面渲染，不代真实权限验收。docs:check/architecture-index 通过，原未验错误分支保留为开放调查。
