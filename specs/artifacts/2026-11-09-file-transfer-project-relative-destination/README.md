# 文件转移目的路径：真实桌面和服务证据

1280 × 720 桌面 Chromium。所有截图均来自本人操作的隔离开发页面。详见[根因和验收规格](../../records/2026-11/2026-11-09-file-transfer-project-relative-destination.md)。

- [01：输入以斜线开头的复制目的路径](01-before-rooted-copy-entered.jpg)、[02：实际复制到项目内镜像](02-before-copy-written-to-project-mirror.jpg)
- [03：两项移动输入 Windows 反斜线根路径](03-before-rooted-batch-move-entered.jpg)、[04：实际移动到项目内镜像](04-before-batch-moves-to-project-mirror.jpg)
- [05：候选已保留输入和错误，尚未分离可访问名称](05-candidate-rooted-copy-keeps-field.jpg)
- [06：最终复制字段和错误](06-final-rooted-copy-stable-name.jpg)、[07：在原字段修正](07-final-copy-corrected-in-place.jpg)、[08：复制真实回执与焦点](08-final-copy-to-chosen-destination.jpg)
- [09：批量复制的盘符相对输入](09-final-batch-copy-rejects-drive-relative.jpg)、[10：取消归还原行焦点](10-final-cancel-restores-batch-focus.jpg)
- [11：中文批量移动错误](11-final-rooted-batch-move-zh.jpg)、[12：改正后的实际移动目标和焦点](12-final-batch-moves-to-chosen-directory.jpg)、[13：中文单项移动的盘符绝对输入](13-final-single-move-drive-zh.jpg)

[种子](seed.json)、[基线启动](before-startup.json)、[候选启动](candidate-startup.json)、[最终启动](after-final-startup.json)、[基线目录与原件](before-files.json)、[最终目录与原件](after-files.json)、[直接调用的具名路径错误](before-direct-contract.json)、[实际请求与项目审计](owned-final-check.json)。[公开目录和字节检查器](check-destination-bytes.mjs)及[隔离磁盘与数据库检查](audit-owned-destination.py)。
