# 资源管理器搜索文件夹的桌面验收

[调查与规格](../../records/2026-11/2026-11-23-explorer-search-folder-entries.md)

## 基线

真实项目开发页面 `/ui/` 位于 `127.0.0.1:40436`，使用北区项目。

- [完整目录路径显示无文件匹配](01-baseline-full-folder-path.jpg)
- [同一目录中的确切文件完整路径可以匹配](02-baseline-full-file-path.jpg)
- [按目录名称查询只能获得文件项](03-baseline-folder-name-file-results.jpg)
- [真实正式路由对同一个完整目录的不同类型结果](baseline-full-folder-lookups.json)

## 首个候选

- [完整路径命中唯一真实目录](04-candidate-exact-folder-result.jpg)
- [新建对话框显示搜索中选中的真实父级](05-candidate-new-destination.jpg)
- [回车打开后焦点落到目录](06-candidate-keyboard-folder-focus.jpg)
- [普通名称返回文件和目录及 80 项上限提示](07-candidate-mixed-name-search.jpg)
- [目录结果的共享菜单](08-candidate-search-folder-context-menu.jpg)
- [右键打开后原焦点缺口](09-first-menu-focus-failure.jpg)

## 最终候选

- [右键打开且实际焦点交到北区目录](10-approved-menu-folder-focus.jpg)
- [通过完整文件路径打开北区原文](11-approved-north-file-open.jpg)
- [现有文件头所在目录动作仍能接续焦点](12-approved-editor-folder-focus.jpg)
- [中文页面在北区使用南区路径时的空结果](13-approved-other-project-scope.jpg)
- [切到南区后相同带引号的路径命中](14-approved-quoted-south-folder-result.jpg)
- [键盘打开并聚焦南区实际目录](15-approved-south-keyboard-folder.jpg)
- [从该目录实际打开南区的独有正文](16-approved-south-child-file.jpg)
- [正式查找、列表和源文件读取回执](candidate-search-and-folder-reads.json)
- [文件字节与隔离库计数](isolated-runtime-and-source-counts.json)
