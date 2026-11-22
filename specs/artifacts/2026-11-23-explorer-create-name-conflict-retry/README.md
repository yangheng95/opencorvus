# 创建名称冲突的真实桌面证据

使用隔离实际开发服务 `40528/ui/`、资源 `main-BXXZyC-P.js`。公共测试目录由本批创建，原文件和目录均属于本批独立 Git（版本控制）项目。截图已人工逐张查看。

| 原图 | 实际观察 |
| --- | --- |
| [01 根目录输入已有 drafts](01-baseline-en-existing-folder-typed.jpg) | 原新建文件夹名称、目标和操作可见 |
| [02 文件夹冲突销毁原表单](02-baseline-en-folder-conflict-dismissed-input.jpg) | 正式诊断移至侧栏，焦点回 New，无法原位改名 |
| [03 实际文件夹冲突明细](03-baseline-en-folder-conflict-diagnostic.jpg) | 409 `FileConflictError`，请求 `9a5b6cdb-bd5d-4e96-a3a3-e87854ea2c6b` |
| [04 已有文件冲突销毁原表单](04-baseline-en-file-conflict-dismissed-input.jpg) | `review.txt` 的 409，详情回执为 `2bd82179-f406-479c-a989-6a750b03ac0f` |
| [05 重开新建文件输入](05-baseline-en-file-reopened-empty.jpg) | 名称字段空，只显示 `notes.md` 占位，需重新输入 |
