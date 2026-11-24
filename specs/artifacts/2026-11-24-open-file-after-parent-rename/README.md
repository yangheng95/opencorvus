# 父目录改名后的项目编辑器桌面证据

三个标签连接同一个隔离项目服务。观察编辑器输入了一行未保存内容，操作标签只改名其父目录。

- [资源管理器收到父目录改名回执](baseline-parent-rename-accepted.jpg)
- [改名后目标编辑器仍只有未保存提示](baseline-editor-no-ancestry-notice.jpg)
- [手动尝试保存才出现原路径缺失原因](baseline-missing-notice-only-on-save.jpg)

候选在三个桌面标签重走同一操作，人工复核以下画面。

- [改名后原编辑页自动显示缺失提示，草稿保留](candidate-parent-move-draft-and-warning.jpg)
- [相似前缀目录的文件内容及编辑状态](candidate-prefix-sibling.jpg)
- [恢复原目录后提示结清，草稿仍待保存](candidate-parent-restored-draft-retained.jpg)
- [同一草稿实际写入并呈现已保存状态](candidate-parent-restored-draft-saved.jpg)

[调查、正式请求和验收记录](../../records/2026-11/2026-11-24-open-file-after-parent-rename.md)
