# 批量移动后的键盘续接证据

1280 × 720 桌面 Chromium。原图来自自有隔离 OpenCorvus 开发服务的真实 `/ui/`，本人逐张查看。详见[根因与验收](../../records/2026-11/2026-11-09-file-multi-move-keyboard-continuity.md)。

- [01：多选移动入口](01-before-move-two-menu.jpg)
- [02：两个目标选中但没有键盘焦点](02-before-move-success-focus-lost.jpg)、[03：真实方向键和回车未能续接](03-before-move-native-keys-stay.jpg)
- [04：部分完成和原冲突反馈](04-before-partial-move.jpg)
- [05：真实指针拖放独立成功](05-before-pointer-drag-result.jpg)
- [06：两个目标选中且最后一项有焦点](06-after-two-moves-focus-anchor.jpg)、[07：直接按键打开相邻文件](07-after-keyboard-opens-neighbor.jpg)
- [08：部分成功聚焦已移动文件](08-after-zh-partial-focus.jpg)、[09：实际冲突响应](09-after-zh-move-conflict-details.jpg)
- [10：取消回到原搜索行](10-after-zh-move-cancel-returns-source.jpg)、[11：移出结果时归焦搜索输入](11-after-zh-search-focus.jpg)、[12：实际方向键继续](12-after-zh-search-keyboard.jpg)
- [13：真实拖放仍展开并选中目的文件](13-after-zh-pointer-drop.jpg)

[基线](before-startup.json)与[最终](after-startup.json)启动回执、[种子](seed.json)、[基线目录和字节](before-base.json)、[最终目录和字节](after-search.json)、[移动位置、原始对象和数据库检查](owned-final-check.json)。[接口原字节检查](check-move-bytes.mjs)和[隔离项目核对](audit-owned-move.py)不操作界面。
