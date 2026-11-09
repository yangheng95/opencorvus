# 文件名称与父目录：真实桌面和服务证据

1280 × 720 桌面 Chromium；截图均来自本人交互的隔离开发服务。详见[根因和验收规格](../../records/2026-11/2026-11-09-file-entry-name-parent-boundary.md)。

- [01：文件夹名输入路径](01-before-name-path-in-create.jpg)、[02：实际在另一个目录创建](02-before-folder-created-in-sibling.jpg)
- [03：重命名输入路径](03-before-name-path-in-rename.jpg)、[04：原件移到另一个目录](04-before-rename-moves-to-sibling.jpg)
- [05：新建文件名输入路径](05-before-name-path-in-new-file.jpg)、[06：实际打开另一目录的新文件](06-before-file-created-in-sibling.jpg)
- [07：文件夹路径输入原地反馈](07-after-folder-name-stays-in-dialog.jpg)、[08：Windows 字符错误](08-after-windows-character-error.jpg)、[09：Windows 末尾句点错误](09-after-windows-trailing-dot-error.jpg)、[10：在确认的父目录创建并归焦](10-after-folder-created-in-selected-parent.jpg)
- [11：中文重命名路径错误](11-after-rename-path-error-zh.jpg)、[12：改名后在原目录归焦](12-after-rename-remains-in-parent.jpg)
- [13：中文新建文件保留确认父级](13-after-new-file-path-error-zh.jpg)、[14：真实编辑器路径和焦点](14-after-new-file-editor-in-selected-parent.jpg)

[种子](seed.json)、[基线启动](before-startup.json)、[改后启动](after-startup.json)、[基线目录和字节](before-files.json)、[改后目录和字节](after-files.json)、[服务请求和原件审计](owned-final-check.json)。[实际服务检查器](check-name-bytes.mjs)和[隔离审计](audit-owned-name.py)读取真实公开响应、原件、服务日志和只读数据库。
