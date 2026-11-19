# 资源管理器查找快捷键验收

## 基线

- [活动会话旁的真实文件行焦点](baseline-chat-tree-focus.png)
- [从树行按键误开会话查找](baseline-chat-shortcut-stolen.png)
- [打开实际文件后原正文查找选中 Lantern](baseline-file-find-match.png)
- [无会话时的原文件行焦点](baseline-no-chat-tree-focus.png)

本人在 `40276/ui/` 操作并逐图复核，资源为 `main-7y8P_Z_V.js`。真正建立的项目会话初始为 0 条消息，文件名称搜索和真实文件读取分别确认 `evidence\focused-record.txt` 及其 101 字节原文。

## 候选

- [英文文件树内的快捷键聚焦文件搜索](candidate-en-explorer-focus.png)
- [实际文件名查询返回项目文件](candidate-en-explorer-result.png)
- [Enter 打开项目内的确切文件](candidate-en-opened-exact-file.png)
- [从文件正文查找选中第二行的 Lantern](candidate-en-file-find-match.png)
- [从会话编辑区打开会话查找](candidate-en-conversation-find.png)
- [简体中文界面从结果行按键后选中原查询](candidate-zh-query-selected.png)
- [直接输入 notes.md 替换查询并得到新文件](candidate-zh-replaced-query.png)
- [在文件面板中打开真实 Markdown 预览](candidate-zh-opened-notes.png)
- [没有活动会话的项目主页快捷键聚焦搜索框](candidate-zh-project-home-focus.png)
- [项目主页得到实际文件名结果](candidate-zh-project-home-result.png)

本人在 `40278/ui/` 操作并逐图复核，资源为 `main-DY5usv8j.js`。候选中两份真实文件分别为 101 和 80 字节。
