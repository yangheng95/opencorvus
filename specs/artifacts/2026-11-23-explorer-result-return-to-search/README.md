# 文件搜索结果回焦的真实桌面截图

实际基线 `40780/ui/` 加载 `main-CF6whGgk.js`。本人从真实项目首页进入 Explorer 并核对以下原图。

- [英文 100% 进第一条同名搜索结果](01-baseline-en-100-down-focuses-first-file-result.jpg)
- [基线 Escape 后焦点仍在同一结果](02-baseline-en-100-escape-leaves-result-focus.jpg)
- [上下文菜单关闭回到原结果行](03-baseline-en-100-menu-dismissal-returns-to-row.jpg)
- [现有 Ctrl+F 回到输入并选中查询](04-baseline-en-100-current-ctrl-f-return.jpg)

候选 `40782/ui/` 加载 `main-BCgCXPXE.js`。本人按实际键盘操作顺序复核以下原图。

- [英文 100% Escape 回到保留原查询的输入框](05-candidate-en-100-escape-returns-to-query.jpg)
- [另一条同名结果的菜单接受键盘打开](06-candidate-en-100-menu-open-on-north-result.jpg)
- [一次 Escape 退出菜单并恢复到结果行](07-candidate-en-100-first-escape-closes-menu-only.jpg)
- [从结果行再按 Escape 回到保留查询和选择的搜索](08-candidate-en-100-second-escape-from-row-returns-to-query.jpg)
- [修改查询并打开唯一匹配的真实收货文档](09-candidate-en-100-refined-query-opens-real-file.jpg)
- [文件正文查找仍使用工作台的编辑器](10-candidate-en-100-file-find-remains-scoped.jpg)
- [简体中文 160% 显示回到搜索的提示和保留的查询](11-candidate-zh-160-escape-refocuses-current-chinese-query.jpg)
- [输入已聚焦时 Escape 清空并显示项目树](12-candidate-zh-160-escape-on-input-restores-project-tree.jpg)
- [普通目录行收到 Escape 后维持原焦点](13-candidate-zh-160-tree-row-keeps-original-focus.jpg)
- [从中文搜索打开真实交接清单](14-candidate-zh-160-original-chinese-document-preview.jpg)
