# 编辑器斜杠命令参数空白的实际证据

第 303 批在 Windows Zed 1.28.1、隔离项目开发运行时和本机流式参与者上复现。

- [在基线会话草稿复现含双空格的带引号参数](baseline-zed-double-space.jpg)
- [在基线会话草稿复现实际两行输入](baseline-zed-multiline.jpg)
- [两条命令均完成的实际画面](baseline-zed-multiline-result.jpg)
- [客户端原文、远端收到的具名参数、持久消息和流式输入](baseline-runtime.json)

## 候选验收

- [实际编辑器输入含双空格的远端参数](candidate-zed-double-space.jpg)
- [实际编辑器输入两行参数](candidate-zed-multiline.jpg)
- [两种参数均已执行的会话](candidate-zed-multiline-result.jpg)
- [附加无参命令，三轮均有流式回复](candidate-zed-all-results.jpg)
- [同一候选开发网页的真实项目连接](candidate-web-connected.png)
- [精确请求、持久消息、记忆原文与流式内容](candidate-runtime.json)

所有画面逐张人工复核。可见的会话回复来自本机确定性参与者，精确参数由实际协议请求与公开历史证明。
