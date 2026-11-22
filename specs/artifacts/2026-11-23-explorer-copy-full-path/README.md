# 资源管理器复制路径的桌面验收

[调查与规格](../../records/2026-11/2026-11-23-explorer-copy-full-path.md)

## 基线

从隔离的项目开发页面 `http://127.0.0.1:40420/ui/` 实际交互，截图在 Windows 桌面打开的浏览器中原样保留。

- [北区实际搜索结果的右键菜单](01-baseline-search-menu.jpg)
- [原 Copy 命令的副本目标确认](02-baseline-copy-destination.jpg)
- [项目树中 `records` 的实际右键菜单](03-baseline-tree-folder-menu.jpg)

## 候选

在项目开发模式 `40422/ui/` 的英文和简体中文页面中实际使用右键及键盘。源文件来自两个有相同项目名和相对路径的独立项目。

- [英文目录菜单中的复制完整路径](04-candidate-folder-menu.jpg)
- [北区目录操作后的实际成功状态](05-candidate-folder-feedback.jpg)
- [中文键盘激活的文件菜单](06-candidate-zh-keyboard-menu.jpg)
- [Windows 记事本实际从系统剪贴板收到的南区完整路径](07-candidate-south-system-clipboard.jpg)
- [中文工作台中粘贴独立核对的南区路径](08-candidate-south-search-path.jpg)
- [键盘打开的确切南区原文](09-candidate-south-exact-file.jpg)
- [多选时原有批量复制入口及选择数量](10-candidate-multiselect-menu.jpg)
- [批量复制打开原有目标位置确认](11-candidate-copy-destination.jpg)
- [英文工作台中的独立北区路径及确切结果](12-candidate-north-search-path.jpg)
- [键盘打开的确切北区原文](13-candidate-north-exact-file.jpg)
- [北区目录操作后独立窗口仍粘贴先前南区内容的记录](14-candidate-clipboard-recheck.jpg)
- [真实查找和源文件读取回执](candidate-search-and-file-reads.json)
- [两套运行库计数与原始样本核对](isolated-runtime-and-source-counts.json)
