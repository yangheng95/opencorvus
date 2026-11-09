# 定时编辑器鼠标时钟选择证据

1280 × 720 桌面 Chromium。所有原图来自隔离的真实 OpenCorvus 开发服务 `/ui/`，逐张呈现并由交付者查看。图中仅为本地自有测试数据；未读取服务商凭据或调用模型。详见[分析、方案与验收](../../records/2026-11/2026-11-09-scheduled-clock-pointer-picker.md)。

- [01：旧版点分钟只聚焦](01-before-minute-focus.jpg)
- [02：首个候选英文浮层](02-candidate-en-open.jpg)、[03：应用前](03-candidate-en-staged.jpg)、[04：应用并归焦](04-candidate-en-applied.jpg)
- [05：页面顶端、打开前](05-candidate-en-before-open.jpg)、[06：纯指针打开不移动表单](06-candidate-en-after-open.jpg)
- [07：中文预选](07-candidate-zh-open.jpg)、[08：鼠标滚动到底](08-candidate-zh-scroll-end.jpg)、[09：23:59 待应用](09-candidate-zh-staged-2359.jpg)、[10：应用 23:59](10-candidate-zh-applied-2359.jpg)、[11：重开滚到所选](11-candidate-zh-reopened-2359.jpg)
- [12：分钟空位](12-candidate-zh-partial.jpg)、[13：首个候选连小时也取消预选](13-candidate-zh-partial-open.jpg)、[14：重选同一时刻后成功补回分段](14-candidate-zh-restored-2359.jpg)
- [15：最终英文浮层与字段间距](15-delivery-en-open.jpg)、[16：应用英文时分并归焦](16-delivery-en-applied.jpg)、[17：最终中文浮层](17-delivery-zh-open.jpg)
- [18：清空分钟保留已选小时](18-delivery-zh-partial-hour-retained.jpg)、[19：只补分钟恢复同一时刻](19-delivery-zh-same-value-restored.jpg)
- [20：远期日历](20-delivery-zh-future-calendar.jpg)、[21：保存前](21-delivery-zh-ready-2359.jpg)、[22：真实保存](22-delivery-zh-saved.jpg)、[23：真实暂停](23-delivery-zh-paused.jpg)
- [24：英文重开预选 11 PM 与 59](24-delivery-en-reopened-persisted.jpg)、[25：键盘改值投影到浮层](25-delivery-en-keyboard-then-picker.jpg)

启动回执：[基线](before-startup.json)、[候选](after-startup.json)、[最终](delivery-startup.json)。公开读：[候选取消后](after-empty.json)、[最终初始](delivery-empty.json)、[保存](delivery-active.json)、[暂停后](delivery-paused.json)。[隔离项目种子](seed.json)、[数据库、写入与项目完整性核对](owned-final-check.json)。复核脚本为 [公开接口](check-schedule-clock.mjs) 和 [持久化核对](audit-owned-data.py)，不驱动界面。
