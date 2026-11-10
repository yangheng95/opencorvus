# 文件编辑器保存状态的证据

[规格与真实写入回执](../../records/2026-11/2026-11-11-file-editor-save-status.md)。截图来自本人在隔离桌面页面的实际操作，裁切到文件面板；写入期间的两份真实响应、实际磁盘和辅助状态观察见规格。

- [基线：初读](01-baseline-clean-long-file.png)、[编辑后](02-baseline-edited-asterisk.png)、[真正保存后](03-baseline-after-real-save.png)：头部状态主要靠星号和 Save 外观表达。
- [基线 Markdown 预览](04-baseline-markdown-preview-unsaved-hint.png)：预览另有未保存文字说明。
- [最终英文初读](09-final-en-clean-file.png)及[编辑后](10-final-en-unsaved-file.png)：同一位置展示清洁与未保存状态。
- [真实保存等待](11-final-en-saving-with-newer-input.png)：按钮保持 Save，只有状态行说明正在保存，编辑器仍接收较新文字。
- [第一次保存后](12-final-en-first-save-leaves-newer-draft.png)和[第二次完成](13-final-en-two-saves-clean.png)：较新输入先保留未保存状态，收到第二份写入回执才回到清洁。
- [中文源码](14-final-zh-source-unsaved.png)、[中文预览](15-final-zh-preview-unsaved.png)、[撤销后的中文源码](16-final-zh-undo-clean.png)：原稿、当前视图和状态保持一致。
- [中文子目录文件](17-final-zh-nested-path.png)：相对路径和状态在同一行清楚可辨。
