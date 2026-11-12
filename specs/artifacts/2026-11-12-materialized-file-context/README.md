# 本地文件捕获上下文的桌面验证

Windows Chrome 连接隔离开发服务 `40044/ui/`。同一真实会话执行文本行范围、目录、图片和用户直接输入四轮。

- [文本范围和目录在用户正文中直接显示](baseline-range-and-folder.png)
- [图片路径说明与用户输入的相同前缀](baseline-binary-and-user-text.png)
- [简体中文界面中的英文读取说明与真实目录卡片](baseline-zh-folder-context.png)
- [公开历史、部件和请求编号](baseline-context.json)
- [本机流式参与者收到的实际内容](baseline-model-input.json)

## 候选版本

最终开发服务 `40050/ui/` 使用独立数据库副本。初次截图后增大展开正文与标题的间距，再构建并复核。

- [英文卡片](final-en-overview.png) 与 [完整文本范围](final-en-range.png)
- [中文键盘折叠](final-zh-keyboard-collapsed.png)、[展开](final-zh-keyboard-expanded.png) 与 [当前文件](final-zh-current-file.png)
- [中文完整目录捕获](final-zh-folder-context.png) 与 [真实资源管理器](final-zh-folder-explorer.png)
- [图片和用户直接输入的相同前缀](final-zh-binary-and-user-text.png) 与 [真实图片预览](final-zh-image-preview.png)
- [候选版本打开原有历史](visual-en-old-history.png)
- [真实会话、模型请求、文件接口、下载及分叉记录](candidate-runtime.json)

截图已逐张人工复核。样本、项目和本机模型均为本批独立实例。
