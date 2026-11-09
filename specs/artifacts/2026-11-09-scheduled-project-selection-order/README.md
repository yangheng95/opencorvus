# 定时项目筛选的目标顺序证据

[规格及复核](../../records/2026-11/2026-11-09-scheduled-project-selection-order.md)。隔离开发 `/ui`，1280 × 720；计划在 2099 年到期并已暂停，没有任何运行。

- [01](01-before-saved-alpha-then-beta.jpg)：旧版计划详情原顺序 Alpha、Beta。
- [02](02-before-gamma-selected-under-filter.jpg)：旧版在筛选内仅新增 Gamma。
- [03](03-before-save-reorders-existing-targets.jpg)：旧版保存后错误重排为 Beta、Alpha、Gamma。
- [04](04-after-initial-target-order.jpg)：新版原顺序 Alpha、Beta。
- [05](05-after-add-gamma-with-beta-hidden.jpg)：新版同样隐藏 Beta，只选新增 Gamma。
- [06](06-after-save-preserves-alpha-beta-and-appends-gamma.jpg)：实际保存并按 Alpha、Beta、Gamma 显示。
- [07](07-after-chinese-temporary-beta-removal.jpg)：中文重开编辑，暂时取消选择 Beta。
- [08](08-after-cancel-keeps-saved-order.jpg)：取消后已存修订和顺序保持。

[公开检查器](check-scheduled-target-order.mjs)核对实际 `/doc`、项目、暂停定义与保存后的读取；[落盘检查](audit-owned-data.py)与[结果](owned-final-check.json)确认各历史修订的位置、未来触发、真实写入事件和隔离项目文件。
