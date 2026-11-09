# 定时项目选择键盘焦点证据

[规格及复核](../../records/2026-11/2026-11-09-scheduled-project-selection-focus.md)。隔离的真实开发 `/ui` 桌面 1280 × 720，未保存或运行定时计划。

- [01](01-before-first-project-focused.jpg)：旧版两个匹配项目、首项有可见焦点。
- [02](02-before-selection-recreates-both-rows.jpg)：旧版 Space 选中第一项，两行更新、焦点丢失。
- [03](03-before-down-cannot-continue.jpg)：旧版下一次 Down 无法移到第二项。
- [04](04-after-first-project-focused.jpg)：新版同一路径聚焦第一项。
- [05](05-after-space-keeps-first-project-focused.jpg)：Space 选中第一项并保持焦点。
- [06](06-after-down-and-space-select-second-project.jpg)：Down、Space 接着选中第二项并保持焦点。
- [07](07-after-space-deselects-with-focus.jpg)：Up、Space 取消第一项并保持焦点。
- [08](08-after-filter-preserves-hidden-selection.jpg)：缩窄到一项，保留两项选中总数。
- [09](09-after-clear-restores-both-selected-projects.jpg)：Escape 清查询后两项恢复显示，仍都选中。
- [10](10-after-chinese-keyboard-selection.jpg)：中文从末项向上连续选取两个项目。
- [11](11-after-cancel-keeps-schedule-empty.jpg)：取消后回到空定时列表。

[公开读取检查器](check-scheduled-target-focus.mjs)验证真实 `/doc`、项目身份和定时读取；[落盘检查](audit-owned-data.py)与[输出](owned-final-check.json)核对项目文件、数据库和真实定时请求。
