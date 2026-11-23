# 文件标签查找的真实桌面截图

隔离的 OpenCorvus 实际开发入口 `/ui/` 使用生产保存记录和本地文件，原始截图为 1280×720。

| 基线 | 原始截图 |
| --- | --- |
| 英文 100% 聚焦活动文件标签，查找误入会话 | [截图](baseline-en-file-tab-opens-conversation-find.jpg) |
| 相同文件的工具栏焦点打开原生本地查找 | [截图](baseline-en-file-toolbar-opens-local-find.jpg) |
| 简体中文 160% 聚焦活动文件标签，查找误入会话 | [截图](baseline-zh-file-tab-opens-conversation-find.jpg) |

| 最终交互 | 原始截图 |
| --- | --- |
| 英文文件标签打开本地查找，工具栏保留原查询 | [标签查找](candidate-en-local-file-find-from-tab.jpg) · [工具栏复用查询](candidate-en-local-query-reopened.jpg) |
| 英文资源管理器仍查找项目文件 | [截图](candidate-en-explorer-find-retains-scope.jpg) |
| 中文 160% 从 Markdown 预览进入源码，命中真实第 5 行 | [预览](candidate-zh-markdown-before-tab-find.jpg) · [源码命中](candidate-zh-markdown-source-match.jpg) |
| 中文非文本下载视图与现有会话查找 | [7 字节原件](candidate-zh-binary-file-download-view.jpg) · [从非文本文件查找](candidate-zh-binary-declines-text-find.jpg) · [从会话查找](candidate-zh-conversation-find-from-conversation.jpg) |
| 中文从非文本返回文本，原生查找重新绑定真实文件 | [截图](candidate-zh-text-find-restored-after-binary.jpg) |
