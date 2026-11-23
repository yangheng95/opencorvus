# 文件审阅阅读说明的真实桌面空间

在隔离的 OpenCorvus 开发服务 `/ui/` 使用 84 个真实保存的新增文件。浏览器原始截图为 1280×720。

| 基线交互 | 原始截图 |
| --- | --- |
| 英文 100% 展开阅读说明 | [截图](baseline-en-reading-guide-open.jpg) |
| 简体中文 160% 的九条普通结果在展开时只露组标题 | [截图](baseline-zh-normal-reading-guide-open.jpg) |
| 简体中文 160% 的虚拟结果展开时裁切第一行 | [截图](baseline-zh-virtual-reading-guide-open.jpg) |
| 同一虚拟列表收起说明后恢复 | [截图](baseline-zh-virtual-reading-guide-closed.jpg) |

| 最终交互 | 原始截图 |
| --- | --- |
| 英文 100% 浮层、Escape 回焦和点击外部文件 | [展开](candidate-en-reading-guide-open.jpg) · [回焦](candidate-en-escape-restores-focus.jpg) · [选择第 2 条](candidate-en-outside-selects-file.jpg) |
| 简体中文 160% 的虚拟列表及筛选状态 | [全列表浮层](candidate-zh-virtual-reading-guide-open.jpg) · [相同查询浮层](candidate-zh-filtered-virtual-reading-guide-open.jpg) · [回焦](candidate-zh-escape-restores-focus.jpg) |
| 简体中文普通九条及列表隐藏时的浮层 | [九条](candidate-zh-normal-reading-guide-open.jpg) · [隐藏列表](candidate-zh-guide-with-list-hidden.jpg) |
| 说明关闭后读取当前文件 | [实际磁盘正文](candidate-zh-current-file-after-guide.jpg) |
