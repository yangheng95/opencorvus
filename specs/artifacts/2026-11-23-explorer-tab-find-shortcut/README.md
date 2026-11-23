# 资源管理器标签查找的真实桌面截图

本人操作了实际 `40786/ui/` 基线，加载 `main-BCgCXPXE.js`。

- [关闭文件后焦点落在已选中的 Explorer 标签](01-baseline-en-100-close-file-returns-to-explorer-tab.jpg)
- [从 Explorer 标签按 Ctrl+F 仍停在标签](02-baseline-en-100-find-from-focused-explorer-tab.jpg)
- [从实际结果行按现有 Ctrl+F 可以进入并选中搜索词](03-baseline-en-100-find-from-explorer-body-works.jpg)

本人从实际候选 `40788/ui/` 逐张核对以下操作结果，资源为 `main-mNnpbipP.js`。

- [英文 100% 关闭文件后从 Explorer 标签查找并选中原词](04-candidate-en-100-find-after-closing-file.jpg)
- [直接替换选中的搜索词并打开北仓收货件](05-candidate-en-100-direct-replacement-opens-freight-receipt.jpg)
- [未激活的 Explorer 标签收到快捷键时仍显示当前文件](06-candidate-en-100-inactive-explorer-does-not-change-open-file.jpg)
- [从文件预览的 Ctrl+F 进入实际正文查找](07-candidate-en-100-file-content-find-stays-local.jpg)
- [简体中文 160% 的资源管理器标签选中原查询](08-candidate-zh-160-selected-explorer-tab-finds-existing-query.jpg)
- [改查后显示实际中文交接清单](09-candidate-zh-160-refined-query-opens-exact-document.jpg)
- [关闭中文文件后，标签快捷键选中中文原查询](10-candidate-zh-160-close-file-then-selects-chinese-query.jpg)
- [清空回到目录，目录行仍可把焦点交给同一输入](11-candidate-zh-160-tree-find-uses-same-empty-field.jpg)
