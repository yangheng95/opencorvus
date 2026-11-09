# 关于页宿主快捷键证据

对应[Recall、实施前分析和验收](../../records/2026-11/2026-11-09-about-host-shortcuts.md)。截图均为本人查看的真实开发桌面 1280×720 原图。

- 前态：[01 浏览器列出桌面专属项](01-before-browser-advertises-native-shortcuts.jpg)、[02 Help 已遵循宿主](02-before-help-follows-browser-capabilities.jpg)。
- 后态：[03 英文应用快捷键](03-after-browser-app-shortcuts-en.jpg)、[04 中文应用快捷键](04-after-browser-app-shortcuts-zh.jpg)、[05 Esc 返回对话](05-after-escape-returns-to-chat.jpg)、[06 Shift+Enter 草稿换行](06-after-shift-enter-draft-newline.jpg)。
- [前态接口](before-tcp.json)、[后态接口](after-tcp.json)各两项，均为 HTTP 200 且通过运行时 schema；[前态启动](before-startup.json)、[后态启动](after-startup.json)、[Git 基线](seed.json)、[数据核对](owned-final-check.json)、[接口检查器](check-project-tcp.mjs)和[数据核对脚本](audit-owned-data.py)。
