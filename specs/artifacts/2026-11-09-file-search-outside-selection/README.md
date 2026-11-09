# 文件搜索结果外选区证据

1280 × 720 桌面 Chromium。截图来自自有隔离 OpenCorvus 开发服务的真实 `/ui/`，本人逐张查看。详见[分析、方案及验收](../../records/2026-11/2026-11-09-file-search-outside-selection.md)。

- [01：根目录选择 alpha](01-before-alpha-selected.jpg)、[02：搜索后只显示 beta](02-before-filter-hides-selection.jpg)
- [03：菜单只给总数](03-before-menu-masks-hidden-target.jpg)、[04：确认框只给总数](04-before-copy-dialog-count-only.jpg)
- [05：实际复制结果包含两个文件](05-before-copied-visible-and-hidden.jpg)
- [06：英文一个结果外选择](06-after-en-single-outside.jpg)、[07：两项已选且一项在外](07-after-en-two-selected.jpg)、[08：批量菜单披露范围](08-after-en-menu-discloses-outside.jpg)
- [09：清空查询保留两项选择](09-after-en-cleared-query-keeps-both.jpg)、[10：零结果时显示两项都在外](10-after-en-zero-results-two-outside.jpg)、[11：键盘清理并归焦](11-after-en-zero-results-cleared.jpg)
- [12：中文选区摘要](12-after-zh-outside-summary.jpg)、[13：只清理结果外项](13-after-zh-keeps-visible-selection.jpg)、[14：原单项复制入口](14-after-zh-copy-only-beta.jpg)、[15：实际仅复制 beta](15-after-zh-real-single-copy.jpg)

[基线](before-startup.json)和[修复后](after-startup.json)启动回执、[种子](seed.json)、[基线目录与原字节](before-base.json)、[修复后目录与原字节](after-selected.json)、[原文件和实际请求核对](owned-final-check.json)。[公开接口检查](check-selection-copy.mjs)及[隔离项目核对](audit-owned-selection.py)均不操作页面。
