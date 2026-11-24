# 项目文件恢复后编辑器提示的桌面证据

基线使用 `41824/ui/` 与 `main-B0ewkqE_.js`。通过同项目第三个标签真实改名再改回，另两个标签保持打开。

- [文件改名后，另页原草稿与通用读取错误](baseline-moved-with-draft.jpg)
- [原文件恢复且读取成功，干净编辑器仍显示旧错误](baseline-restored-clean-stale-error.jpg)
- [原文件恢复且读取成功，草稿编辑器仍显示旧错误](baseline-restored-draft-stale-error.jpg)

候选版使用 `main-CYlZS1nj.js`。三个已打开的编辑器覆盖英文、中文、干净内容与未保存草稿。收到同一文件和版本的成功读取后，页面自行恢复。另用真正的不同文件验证旧草稿仍受版本条件保护。[服务回执和验收记录](../../records/2026-11/2026-11-24-file-editor-restored-path.md#实施和复验)

- [英文原路径缺失反馈与未保存草稿](candidate-missing-file-draft-en.jpg)
- [中文原路径缺失反馈与真实文件内容](candidate-missing-file-zh.jpg)
- [原文件恢复后的干净编辑器](candidate-restored-clean.jpg)
- [原文件恢复后仍然可以保存原草稿](candidate-restored-draft.jpg)
- [原草稿保存后，另一页自动显示新行](candidate-saved-peer.jpg)
- [真正替换文件时，草稿页仍提供磁盘比较](candidate-replacement-draft-warning.jpg)
- [尝试保存后的具名冲突状态仍保留草稿](candidate-replacement-save-conflict.jpg)
