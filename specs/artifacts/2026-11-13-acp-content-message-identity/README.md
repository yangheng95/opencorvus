# ACP 消息身份的真实 Windows Zed 记录

## 已推送基线

Windows Zed 1.28.1 在受限模式打开本批专用项目，通过 `b2db9598c` 的真实 `opencorvus acp` 连接隔离本机模型。

- [第一轮实际流等待](baseline-first-stream-open.jpg)、[实时两条独立用户输入](baseline-zed-live-two-user-messages.jpg) 和 [真实重启后拼接为一行](baseline-zed-replay-merged-users.jpg)
- [实际输入、取消、流式分段和加载通知](baseline-runtime.json)、[公开消息身份和父级](baseline-public-messages.json) 和 [实际标题](baseline-public-session.json)

截图已逐张人工复核。

## 候选结果

- [重载后分开的历史用户消息](candidate-zed-replay-separate-users.jpg)、[实时第三轮](candidate-zed-live-third-turn.jpg) 和 [展开的实际思考](candidate-zed-expanded-thinking.jpg)
- [实际桌面加载、实时分段和原持久记录核对](candidate-zed-runtime.json)、[公开模型与旧记录](candidate-projection.json) 和 [实际会话流式模型请求](candidate-model-stream.json)
- [实际派生、公开持久身份和 100 字节图片回放](candidate-fork-runtime.json)
- [候选网页项目文件](candidate-web-project-files.png)、[原文件内容](candidate-web-original-file.png) 和 [实际网页请求](candidate-web.json)

候选桌面截图已逐张人工复核。派生使用官方 ACP 客户端连接实际进程。
