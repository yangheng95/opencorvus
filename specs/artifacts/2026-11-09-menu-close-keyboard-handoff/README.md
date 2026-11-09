# 菜单关闭和键盘交接：真实桌面证据

1280 × 720 桌面 Chromium，两次独立 OpenCorvus 开发服务。截图逐张由本人查看。详见[根因和验收规格](../../records/2026-11/2026-11-09-menu-close-keyboard-handoff.md)。

- [01：两行已选并打开上下文菜单](01-before-two-selection-menu.jpg)、[02：快速 Escape 后误开复制](02-before-rapid-escape-outcome.jpg)
- [03：新建菜单聚焦新建文件](03-before-dropdown-focused-item.jpg)、[04：快速 Escape 后误开新建确认](04-before-dropdown-escape-outcome.jpg)
- [05：实际标题 View 菜单](05-before-title-menu-item.jpg)、[06：分开按键完成正确范围选择](06-before-separated-keys-select-range.jpg)、[07：真实打开 gamma 原文](07-before-original-file-opens.jpg)
- [08：改后打开同一文件菜单](08-after-two-selection-menu.jpg)、[09：快速关闭后继续选择范围](09-after-rapid-escape-selects-range.jpg)
- [10：空格重新打开新建菜单](10-after-space-reopens-new-menu.jpg)、[11：显式选择打开新建确认](11-after-explicit-new-file.jpg)、[12：取消回到新建](12-after-new-dialog-cancel-focus.jpg)
- [13：嵌套菜单焦点在滑块](13-after-nested-menu-opens.jpg)、[14：关闭回到原入口](14-after-nested-menu-escape-focus.jpg)、[15：中文标题菜单焦点交接](15-after-title-menu-return-zh.jpg)
- [16：中文页面范围选择](16-after-zh-range-selection.jpg)、[17：紧接 Enter 读取原文](17-after-original-file-opened.jpg)

[隔离种子](seed.json)、[基线启动](before-startup.json)、[改后启动](after-startup.json)、[基线根目录和原始字节](before-files.json)、[改后根目录和原始字节](after-files.json)、[两端原件、实际编辑器读取与隔离审计](owned-final-check.json)。[实际服务检查器](check-project-bytes.mjs)和[隔离项目审计](audit-owned-menu.py)读取真实公开响应、原件、服务日志和只读数据库。
