# ACP 消息身份的真实 Windows Zed 记录

## 已推送基线

Windows Zed 1.28.1 在受限模式打开本批专用项目，通过 `b2db9598c` 的真实 `opencorvus acp` 连接隔离本机模型。

- [第一轮实际流等待](baseline-first-stream-open.jpg)、[实时两条独立用户输入](baseline-zed-live-two-user-messages.jpg) 和 [真实重启后拼接为一行](baseline-zed-replay-merged-users.jpg)
- [实际输入、取消、流式分段和加载通知](baseline-runtime.json)、[公开消息身份和父级](baseline-public-messages.json) 和 [实际标题](baseline-public-session.json)

截图已逐张人工复核。
