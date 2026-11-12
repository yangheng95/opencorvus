# 成员会话历史附件操作的真实桌面记录

## 已推送基线

Windows Chrome 连接构建 `dd34069ad` 的隔离服务 `40054/ui/`。

- [主会话与成员会话同源引用的操作差异](baseline-main-member-parity.png)
- [两次本地下载点击的实际页面](baseline-local-download-attempts.png)
- [规范目录索引和文本在窄右栏的实际呈现](baseline-member-stored-files.png)
- [真实浏览器诊断和成员会话请求](baseline-desktop.json)
- [实际用户部件、两份规范原件和流式轮次](baseline-member-attachments.json)

## 候选和最终构建

Windows Chrome 连接隔离服务 `40058/ui/`。最终构建实际请求了 `main-C8FxTOq6.js`。

- [候选中已打开目录、方向键未交接的页面](candidate-focus-before.png) 和 [焦点诊断](candidate-focus-before.json)
- [主会话和成员会话共用本地引用操作](candidate-main-member-local-actions.png)、[本地文件内容](candidate-member-local-file.png)、[本地目录](candidate-member-local-folder.png)
- [原图预览](candidate-member-image-preview.png) 和 [返回成员会话原阅读位置](candidate-member-returned-top.png)
- [英文规范附件操作](final-member-english.png)、[附件按钮焦点](final-folder-origin-keyboard.png)、[回车聚焦目录](final-folder-enter.png)、[方向键聚焦文件](final-folder-arrow.png)、[回车打开实际文件内容](final-folder-file-open.png)
- [目录请求进行中](final-search-during-reveal.png) 和 [手动查询保留输入焦点](final-search-keeps-focus.png)
- [中文本地引用](final-member-chinese-local.png)、[中文规范目录](final-member-chinese-stored.png)、[原样展开的规范文本](final-member-chinese-text.png)
- [真实响应、逐字节下载、全行持久数据比较和本机流式调用](candidate-runtime.json)

截图已逐张人工复核。
