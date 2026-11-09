# 批量复制和移动确认路径的实际证据

1280 × 720 桌面 Chromium。所有图片来自自有隔离服务的真实 OpenCorvus `/ui/`，本人逐张查看。详见[根因和验收规格](../../records/2026-11/2026-11-09-file-batch-transfer-source-review.md)。

- [01：父项加子项只显示复制总数](01-before-copy-selected-count.jpg)、[02：真实复制完成一个根](02-before-copy-completes-one-root.jpg)
- [03：父项加子项只显示移动总数](03-before-move-selected-count.jpg)、[04：真实移动完成一个根](04-before-move-completes-one-root.jpg)
- [05：展开两个独立来源](05-after-copy-independent-paths.jpg)、[06：取消恢复原行焦点](06-after-cancel-focus.jpg)
- [07：英文复制显示实际根和包含说明](07-after-copy-effective-folder.jpg)、[08：复制回执与目标焦点](08-after-copy-complete.jpg)
- [09：中文移动显示实际根和包含说明](09-after-move-effective-folder-zh.jpg)、[10：移动回执与目标焦点](10-after-move-complete-zh.jpg)
- [11：拖放的独立移动回执和新位置](11-after-drag-shared-destination.jpg)

[种子](seed.json)；[基线启动](before-startup.json)与[改后启动](after-startup.json)；[基线目录与原件](before-base.json)、[改后目录与原件](after-verified.json)及[服务写入与磁盘审计](owned-final-check.json)。[目录与字节检查器](check-transfer-bytes.mjs)直接调用本地公开服务，[隔离项目审计](audit-owned-transfer.py)对照其实际 Git 原件、物理内容、服务日志和只读数据库。
