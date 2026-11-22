# 文件查看器打开所在目录的桌面验收

[调查与规格](../../records/2026-11/2026-11-23-file-editor-containing-folder.md)

## 基线

隔离 `/ui/` 位于 `127.0.0.1:40428`，原始桌面截图均已人工查看。

- [通过北区真实搜索结果打开文件后的文件头和正文](01-baseline-editor-toolbar.jpg)
- [切回 Explorer 后保留原搜索](02-baseline-return-keeps-search.jpg)
- [在原编辑器创建未保存样本](03-baseline-editor-draft.jpg)
- [清除搜索后显示已展开的目录，搜索框仍持有焦点](04-baseline-clear-search-expands-folder.jpg)

## 交互复核期间

- [首个候选的北区文件草稿和新动作](05-first-editor-with-draft.jpg)
- [首个候选选中目录时缺少键盘焦点](06-candidate-first-folder-focus.jpg)
- [第二个候选正常宽度的目录焦点](07-second-standard-folder-focus.jpg)
- [第二个候选恢复原文件时的草稿](08-second-draft-preserved.jpg)
- [第二个候选窄栏的中文文件头和南区正文](09-second-south-narrow-editor.jpg)
- [第二个候选窄栏目录选中与焦点分离](10-second-narrow-folder-focus.jpg)

## 最终候选

- [英文北区文件动作的真实键盘焦点与草稿](11-approved-north-toolbar-draft.jpg)
- [北区确切目录的焦点环](12-approved-north-folder-focus.jpg)
- [返回北区编辑器后仍属原文件的草稿](13-approved-draft-retained.jpg)
- [中文窄栏的南区文件工具和原文](14-approved-south-narrow-toolbar.jpg)
- [中文窄栏真实南区目录焦点](15-approved-south-narrow-folder-focus.jpg)
- [南区根级文件及其目录动作](16-approved-root-editor.jpg)
- [打开项目根后的搜索焦点](17-approved-root-folder-focus.jpg)
- [两个项目的正式列表与文件读取回执](final-folder-and-file-receipts.json)
- [原文件内容及隔离数据库计数](isolated-runtime-and-source-counts.json)
