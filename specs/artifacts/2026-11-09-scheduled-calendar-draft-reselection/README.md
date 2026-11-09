# 定时日历补全日期的桌面证据

1280 × 720 桌面 Chromium。所有图片来自自有隔离 OpenCorvus 开发服务的真实 `/ui/` 页面，并逐张人工复核。详见[根因、方案和验收记录](../../records/2026-11/2026-11-09-scheduled-calendar-draft-reselection.md)。

- [01：英文日分段清空](01-before-cleared-day.jpg)
- [02：日历却仍报告原日已选](02-before-calendar-still-selected.jpg)
- [03：键盘重选原日后仍空](03-before-enter-keeps-gap.jpg)、[04：鼠标重选同样不填](04-before-pointer-keeps-gap.jpg)
- [05：不同日期能填回，形成对照](05-before-different-day-completes.jpg)
- [06：首个候选的鼠标焦点看不见](06-after-en-focus-without-selection.jpg)、[07：键盘打开可见焦点圈](07-after-en-keyboard-focus.jpg)、[08：键盘重选成功](08-after-en-same-day-filled.jpg)
- [09：最终鼠标打开可见焦点](09-delivery-en-pointer-focus-ring.jpg)、[10：英文键盘重选补全](10-delivery-en-same-day-restored.jpg)
- [11：中文导航到新编辑的二月并仅聚焦 5 日](11-delivery-zh-far-date-only-focused.jpg)、[12：鼠标补全远期日期](12-delivery-zh-same-far-date-filled.jpg)、[13：保存前确认日期与时区](13-delivery-zh-ready.jpg)
- [14：真实保存](14-delivery-zh-saved.jpg)、[15：真实暂停](15-delivery-zh-paused.jpg)、[16：重开同时选中和聚焦](16-delivery-zh-persisted-selected.jpg)

[基线](before-startup.json)、[候选](after-startup.json)、[最终](delivery-startup.json) 启动回执。[基线](before-empty.json)、[候选](after-empty.json)、[最终初始](delivery-empty.json)、[保存后](delivery-active.json)、[暂停后](delivery-paused.json) 公开读。[隔离项目种子](seed.json)、[数据库与项目核对](owned-final-check.json)。[公开接口检查](check-schedule-date.mjs) 与[持久化核对](audit-owned-data.py) 不驱动界面。
