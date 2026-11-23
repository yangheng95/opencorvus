# 文件操作选区的真实桌面截图

Windows 桌面使用自有隔离项目两个同名文件和真实文件树，英文 160%。原图由本人查看。

| 截图 | 复核内容 |
| --- | --- |
| [04](04-baseline-en-160-context-keyboard-stale-selection.jpg) | 用键盘为北区交付文件打开菜单，原南区归档条目仍然高亮。 |
| [05](05-baseline-en-160-keyboard-rename-exact-target.jpg) | 改名对话框指向确切交付文件，背后仍是归档选区，随后取消。 |
| [06](06-baseline-en-160-pointer-menu-updates-selection.jpg) | 用鼠标为交付条目打开菜单后，交付文件成为所选项。 |
| [07](07-baseline-en-160-directory-context-selection.jpg) | 目录树的 `records` 键盘菜单可用。 |
| [08](08-baseline-en-160-directory-action-scope.jpg) | 关闭该菜单后，焦点归还 `records`，目录仍未选中。 |
| [09](09-baseline-en-160-new-dialog-stale-directory.jpg) | 实际打开工具栏新建目录，提示仍是上一交付文件所属目录，随后取消。 |
| [10](10-candidate-en-160-keyboard-menu-selects-target.jpg) | 键盘打开同一北区交付菜单，交付条目立即成为选项。 |
| [11](11-candidate-en-160-rename-correct-selection.jpg) | 英文改名对话框显示精确路径，后方同一个交付条目已选。 |
| [12](12-candidate-en-160-rename-cancel-returns-to-selected-file.jpg) | 取消后同一交付结果继续选中并持焦。 |
| [13](13-candidate-en-160-keyboard-retains-multi-selection.jpg) | 从已选归档行打开菜单，批量操作保留两个条目。 |
| [14](14-candidate-en-160-pointer-updates-selection.jpg) | 对未选归档条目按鼠标右键，菜单按该单个文件打开。 |
| [15](15-candidate-zh-160-tree-keyboard-menu-selects-directory.jpg) | 简体中文目录树中给 `records` 开菜单，目录同步成为选项。 |
| [16](16-candidate-zh-160-tree-escape-restores-selected-directory.jpg) | 关闭菜单后同一目录可辨认且持焦。 |
| [17](17-candidate-zh-160-new-folder-correct-target.jpg) | 工具栏的新建目录对话框明确写「在 records 中新建」。 |
| [18](18-candidate-zh-160-folder-created-under-records.jpg) | 真实创建后显示完整位置、展开父目录并聚焦新增行。 |
| [19](19-candidate-zh-160-keyboard-opens-neighbor-file.jpg) | 从新目录继续键盘导航，显示真实相邻文件正文。 |
