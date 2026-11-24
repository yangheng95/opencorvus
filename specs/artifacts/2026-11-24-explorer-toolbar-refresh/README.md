# 文件资源管理器工具栏刷新入口的桌面证据

基线 `41848/ui/` 使用 `main-i55j0gos.js`，对照页展开了 `notes/archive`，查询页保持目录折叠。

- [展开目录已经看到外部写入的文件](baseline-external-file-seen-in-expanded-tree.jpg)
- [同项目当前搜索仍无匹配，工具栏没有直接刷新入口](baseline-collapsed-search-still-empty.jpg)
- [刷新只在结果背景的菜单中出现](baseline-refresh-only-in-background-menu.jpg)
- [已有刷新命令能更新原查询并找到文件](baseline-context-refresh-finds-file.jpg)

候选版使用 `main-COr7kqoq.js`，以同一隔离项目和另一个实际外部写入文件进行复验。[操作与服务回执](../../records/2026-11/2026-11-24-explorer-toolbar-refresh.md#实施和复验)

- [正常文件树上的工具栏布局](candidate-tree-toolbar.jpg)
- [原查询仍无匹配，Tab 焦点已经到达刷新](candidate-search-refresh-keyboard-focus.jpg)
- [按 Enter 后直接获得匹配并保留按钮焦点](candidate-keyboard-refresh-finds-file.jpg)
- [打开真实文件与完整原文](candidate-opened-external-file.jpg)
- [简体中文刷新成功和实际搜索结果](candidate-refresh-chinese-search.jpg)
