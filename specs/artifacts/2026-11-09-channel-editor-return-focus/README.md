# 通道编辑返回焦点证据

对应[Recall、实施前分析和验收](../../records/2026-11/2026-11-09-channel-editor-return-focus.md)。截图均为本人查看的真实开发桌面 1280×720 原图。

- 前态：[01 键盘打开 Telegram](01-before-telegram-editor-open.jpg)、[02 Cancel 后回页面根](02-before-cancel-focus-falls-to-page.jpg)、[03 Escape 后回页面根](03-before-escape-focus-falls-to-page.jpg)。
- 首轮：[04 表单](04-after-telegram-editor-open.jpg)、[05 Cancel 回 Telegram](05-after-cancel-restores-telegram-edit.jpg)、[06 后续 Tab](06-after-next-tab-continues-catalog-order.jpg)、[07 退出空表单](07-intermediate-closed-form-flash.jpg)、[08 较低行焦点稳定](08-intermediate-nextcloud-focus-stable.jpg)。
- 最终英文：[09 原表单](09-final-telegram-opening-layout.jpg)、[10 Cancel 首帧](10-final-cancel-returns-to-telegram.jpg)、[11 Telegram 稳定焦点](11-final-telegram-edit-focus-stable.jpg)、[12 Tab 到 Discord 文档](12-final-tab-continues-at-discord-docs.jpg)、[13 较低行 Esc 首帧](13-final-escape-no-empty-shell.jpg)、[14 Nextcloud Talk 稳定焦点](14-final-scrolled-nextcloud-focus-stable.jpg)。
- 最终中文：[15 原 Feishu / Lark 表单](15-final-chinese-feishu-editor.jpg)、[16 Esc 还原原动作](16-final-chinese-escape-restores-feishu.jpg)、[17 Shift+Tab 到同一行文档](17-final-shift-tab-same-feishu-docs.jpg)、[18 未保存开关草稿](18-final-unsaved-switch-draft.jpg)、[19 重新打开原值](19-final-reopen-restores-original-draft.jpg)。
- [前态接口与目录](before-tcp.json)、[最终接口与目录](after-tcp.json)各三项 HTTP 200/运行时 schema；[前态启动](before-startup.json)、[首轮启动](first-after-startup.json)、[最终启动](after-startup.json)、[Git 基线](seed.json)、[数据核对](owned-final-check.json)、[接口检查器](check-project-tcp.mjs)和[数据核对脚本](audit-owned-data.py)。
