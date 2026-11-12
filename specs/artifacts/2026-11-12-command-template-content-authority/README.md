# 注册命令模板文本与主机操作的基线

实际 Windows Chrome 在开发服务 `40026/ui/` 创建隔离编码会话。同一服务的公开命令入口送入合成样本，确定性模型仅在本机流式回复。

- [位置参数里的原文被二次替换，普通参数内联标记被执行](baseline-web-interpolation.png)
- [远端提示与配置内联标记变成命令输出](baseline-web-current.png)
- [远端文本带入了项目的实际样本文件](baseline-web-remote-file.png)
- [真实请求、明确会话权限、持久正文和实际流式输入](baseline-runtime.json)

三张截图逐张人工复核。命令行探针只打印测试标记，文件为专用项目样本。
