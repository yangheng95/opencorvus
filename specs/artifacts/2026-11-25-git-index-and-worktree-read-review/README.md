# Git 索引与工作树读取的证据

## 实际 Git 与正式读取

- [原 HEAD、分支、全索引语义和正式基线](git-before.json)，[索引一行/磁盘两行及正式结果](git-split.json)。
- [单文件恢复原索引后的事实](git-restore.json)，[页面刷新后再次正式核对](git-restored.json)。
- 正式 Git 差异均按原双空格文件路径返回 added、2 新增/0 删除及完整两行。恢复前后工作树原文相同，实际索引恢复为原语义，原不可变 HEAD 和分支保持。

## 本人真实桌面截图

- [英文独立分项计数](desktop-split-git-counts-en.png)，[工作树实际两行](desktop-working-tree-two-lines-en.png)。
- [中文同一原文](desktop-working-tree-two-lines-zh.png)，[中文独立分项计数](desktop-split-git-counts-zh.png)。
- [恢复原索引后真实刷新为 24 个未跟踪](desktop-restored-index-refreshed-zh.png)。

五张截图均本人查看。公开 Git 差异不冒充界面差异预览，环境栏和文件正文以真实交互及人工截图为准。本批未打开会自动生成模型主题的提交弹窗，未执行隔离项目的提交或推送。
