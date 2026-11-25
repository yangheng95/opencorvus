# 嵌套文件显示路径与搜索证据

## 基线

- [实际 receipt 搜索行](baseline-nested-result.png)，[照抄原显示标签后为空](baseline-displayed-query-empty.png)，[规范项目路径查询找到同一文件](baseline-portable-query-finds-file.png)。
- [从原生结果行记录的实际输入](baseline-query-input.json)，[两种查询与原文的正式回执](baseline-path-queries.json)。

## 候选真实桌面

- [规范完整路径的实际结果行](candidate-nested-result.png)，[将其显示标签原样用于查询](candidate-exact-display-query.png)，[打开原 receipt 的正文](candidate-opened-original-receipt.png)。
- [中文完整查询及选择状态](candidate-chinese-exact-query-selection.png)，[中文普通关键词的两个原结果](candidate-chinese-common-query.png)。
- [候选原生行的实际标签](candidate-query-input.json)，[显示名查询与原文正式回执](candidate-path-query.json)。正式内容同时与磁盘原文核对。

截图来自专用 Chrome 的真实开发页面，所有交互使用原生 Computer Use 接口，本人逐张查看。文件均为本人隔离项目内的验收文件。
