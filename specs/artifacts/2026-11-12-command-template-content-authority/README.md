# 注册命令模板文本与主机操作的基线

实际 Windows Chrome 在开发服务 `40026/ui/` 创建隔离编码会话。同一服务的公开命令入口送入合成样本，确定性模型仅在本机流式回复。

- [位置参数里的原文被二次替换，普通参数内联标记被执行](baseline-web-interpolation.png)
- [远端提示与配置内联标记变成命令输出](baseline-web-current.png)
- [远端文本带入了项目的实际样本文件](baseline-web-remote-file.png)
- [真实请求、明确会话权限、持久正文和实际流式输入](baseline-runtime.json)

三张截图逐张人工复核。命令行探针只打印测试标记，文件为专用项目样本。

## 候选验收

- [美元符号和占位符按原文显示](candidate-web-dollar-literals.png)
- [普通参数和远端正文的内联标记显示为文字](candidate-web-remote-literal.png)
- [固定和参数化声明文件都作为会话输入](candidate-web-declared-files.png)
- [实际展开并下载显式图片](candidate-web-image-preview.png)
- [明确禁用工具的候选会话请求、持久记录和流式数据](candidate-runtime.json)
- [显式 Shell 执行、图片原件逐字节核对及数据库完整性](candidate-verification.json)

另在[基线](baseline-web-file-preview-failure.png)和[候选](candidate-file-preview-details.png)逐张复核了本地文本附件展开失败。该失败在本批之前已存在。显式存储的图片在候选可打开和下载。
