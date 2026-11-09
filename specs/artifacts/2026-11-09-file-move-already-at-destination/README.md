# 移动回执：真实桌面和服务证据

1280 × 720 桌面 Chromium，所有画面来自本人实际操作的隔离开发服务。详见[根因和验收规格](../../records/2026-11/2026-11-09-file-move-already-at-destination.md)。

- [01：单项确认原路径](01-before-single-default-destination.jpg)、[02：归焦但没有结果](02-before-single-closes-without-result.jpg)
- [03：整批都已在目标](03-before-two-already-in-destination.jpg)、[04：未显示结果](04-before-batch-no-visible-outcome.jpg)、[05：拖回原父级未显示结果](05-before-drag-same-parent-outcome.jpg)
- [06：混合选区三条来源](06-before-mixed-three-source-paths.jpg)、[07：只显示实际移动的一项](07-before-mixed-only-moved-item.jpg)
- [08：单项已在根目录](08-after-single-already-in-root.jpg)、[09：两项已在目的地](09-after-batch-already-in-dest.jpg)、[10：真实拖回父目录的单项回执](10-after-drag-already-in-parent.jpg)
- [11：中文混合选择](11-after-mixed-selection-zh.jpg)、[12：分行显示实际移动和已在目标](12-after-mixed-move-and-already-there.jpg)

[基线启动](before-startup.json)、[改后启动](after-startup.json)、[隔离种子](seed.json)、[基线目录和原件](before-files.json)、[改后目录和原件](after-files.json)、[实际写入和隔离项目](owned-final-check.json)。[实际公开服务检查器](check-move-receipts.mjs)和[只读隔离审计](audit-owned-move.py)。
