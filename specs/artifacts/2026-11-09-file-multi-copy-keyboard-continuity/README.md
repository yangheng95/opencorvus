# 批量复制后的键盘续接证据

1280 × 720 桌面 Chromium。原图为自有隔离 OpenCorvus 开发服务的真实 `/ui/` 页面，均本人查看。详见[根因与方案](../../records/2026-11/2026-11-09-file-multi-copy-keyboard-continuity.md)。

- [01：真实菜单确认选中两项](01-before-two-items-menu.jpg)
- [02：已复制并选中两个目标，未见键盘焦点](02-before-copy-focus-lost.jpg)、[03：方向键和回车后仍留在原页面](03-before-keys-cannot-continue.jpg)
- [04：第二项冲突时显示第一项完成，焦点仍丢失](04-before-partial-copy.jpg)
- [05：两个目标选中，焦点停在最后成功项](05-after-two-copies-focus-anchor.jpg)、[06：键盘直接打开相邻文件](06-after-native-keys-open-neighbor.jpg)
- [07：部分成功时聚焦已复制文件](07-after-zh-partial-completed-focus.jpg)、[08：原始冲突详情](08-after-zh-conflict-details.jpg)
- [09：取消回原结果](09-after-zh-cancel-returns-source.jpg)、[10：结果移出搜索时回输入](10-after-zh-search-restores-input.jpg)、[11：方向键重新进入结果](11-after-zh-search-keyboard-continues.jpg)

[基线](before-startup.json)与[修复后](after-startup.json)启动回执、[种子](seed.json)、[基线列表和字节](before-base.json)、[修复后列表和字节](after-search.json)、[原文件、数据库和请求核对](owned-final-check.json)。[原字节检查](check-copy-bytes.mjs)与[隔离项目核对](audit-owned-copy.py)都不操作界面。
