# 模型目录刷新结算的证据

[规格与验证记录](../../records/2026-11/2026-11-11-provider-catalog-refresh-settlement.md) · [正式接口回执摘要](api-evidence.json)。截图均来自本人在隔离服务桌面页面的实际操作，裁切到设置内容。

- [基线写入等待](02-baseline-catalog-refresh-loses-focus.png)和[基线重读等待](04-baseline-catalog-projection-pending.png)：原按钮先丢焦点，再在新目录实际到达前解禁。
- [首版重读等待](06-en-projection-pending.png)和[真实读完](07-en-after-read.png)：88 项旧目录在等待时保持，236 项到达后刷新时间与可用按钮一起显示；首版等待文字和边框偏暗。
- [最终版英文等待](08-final-en-focused-pending.png)：同一按钮保留清楚的焦点轮廓和加载文案。
- [最终版中文等待](10-final-zh-focused-pending.png)、[主动移到搜索](11-final-zh-search-pending.png)与[搜索仍持焦](12-final-zh-search-after-read.png)：真实结果到达后焦点没有被抢回。
- [读取中断](13-final-zh-projection-failed.png)和[原位重试恢复](14-final-zh-retry-recovered.png)：同一筛选得到可读错误、随后完整恢复。
- [项目旧回执到达后的全局设置](16-final-zh-global-after-retired-receipt.png)、[全局自己的等待](17-final-zh-global-pending.png)及[完成](18-final-zh-global-complete.png)：旧回执没有写入全局时间，真实全局回执完成才显示当前时间。
