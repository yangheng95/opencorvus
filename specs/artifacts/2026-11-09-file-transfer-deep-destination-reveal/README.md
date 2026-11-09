# 深层转移目的地：真实桌面和服务证据

1280 × 720 桌面 Chromium；截图均来自本人操作的隔离开发服务。详见[根因和验收规格](../../records/2026-11/2026-11-09-file-transfer-deep-destination-reveal.md)。

- [01：复制的深层目的路径](01-before-copy-into-collapsed-chain.jpg)、[02：成功但目标不可见](02-before-copy-success-target-hidden.jpg)、[03：手动展开祖先后才看到副本](03-before-manual-ancestors-reveal-copy.jpg)
- [04：批量移动到另一个深层折叠路径](04-before-batch-into-collapsed-chain.jpg)、[05：成功但目标不可见](05-before-batch-success-target-hidden.jpg)
- [06：改后复制前目的链折叠](06-after-copy-input-collapsed-destination.jpg)、[07：成功自动展开和归焦](07-after-copy-full-chain-and-focus.jpg)
- [08：紧接 Enter 实际打开原文](08-after-enter-opens-copied-original.jpg)、[09：返回仍保持完整路径](09-after-return-to-explorer-keeps-chain.jpg)
- [10：中文批量移动前的另一个折叠路径](10-after-batch-input-collapsed-destination-zh.jpg)、[11：成功自动展开并归焦最后目标](11-after-batch-full-chain-and-focus-zh.jpg)

[基线启动](before-startup.json)、[改后启动](after-startup.json)、[种子](seed.json)、[基线目录与字节](before-files.json)、[改后目录与字节](after-files.json)、[实际写入、读取与项目归属](owned-final-check.json)。[公开服务检查器](check-deep-destinations.mjs)和[隔离项目审计](audit-owned-deep.py)。
