# 文件键盘多选的实际界面证据

1280 × 720 桌面 Chromium。每张图片来自自有隔离 OpenCorvus 开发服务的真实 `/ui/`，本人逐张查看。详见[根因和验收规格](../../records/2026-11/2026-11-09-file-selection-keyboard-discovery.md)。

- [01：Ctrl+空格已有单项选择](01-before-tree-control-space.jpg)、[02：键盘多选已有两项菜单](02-before-tree-control-multiselect.jpg)、[03：Shift+空格已有范围行为](03-before-tree-shift-space-range.jpg)
- [04：搜索页脚只提示浏览和打开](04-before-search-shortcuts-undisclosed.jpg)、[05：现有搜索切换](05-before-search-control-toggle.jpg)、[06：现有搜索范围操作](06-before-search-shift-range.jpg)
- [07：候选的英文双行提示](07-after-en-shortcut-and-selection.jpg)、[08：候选仍能用键盘多选](08-after-en-two-selected.jpg)。候选使用的辅助描述未被当前桌面可访问树呈现，故这两张图不作为最终可访问证据。
- [09：最终英文提示与选择](09-delivery-en-selected-name.jpg)、[10：菜单确认两项](10-delivery-en-two-selected-menu.jpg)、[11：英文范围选择](11-delivery-en-range-beta-gamma.jpg)
- [12：中文搜索保持原选区](12-delivery-zh-search-shortcut-and-selected.jpg)、[13：切换 beta](13-delivery-zh-search-toggle.jpg)、[14：重建准确范围](14-delivery-zh-range-beta-alpha.jpg)
- [15：键盘进入批量复制](15-delivery-zh-keyboard-copy-dialog.jpg)、[16：真实目标](16-delivery-zh-copy-result-with-path.jpg)、[17：Enter 打开目标原文](17-delivery-zh-enter-opens-copy.jpg)

[基线](before-startup.json)、[候选](after-startup.json)、[最终](delivery-startup.json)启动回执、[种子](seed.json)、[真实目录与原件](delivery-selected.json)、[原件、写入与数据库核对](owned-final-check.json)。[公开接口复核](check-keyboard-copy.mjs)与[隔离项目复核](audit-owned-selection.py)不操作界面。
