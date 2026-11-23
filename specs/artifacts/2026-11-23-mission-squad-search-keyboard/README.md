# 新建多步任务专家团搜索的键盘交互截图

[方案与验收](../../records/2026-11/2026-11-23-mission-squad-search-keyboard.md)

本人通过独立实际开发页面与真实键盘逐张查看下列画面。基线端口为 `40620`。

- [基线 01 · Down 后搜索框仍获焦](01-baseline-en-down-stays-in-search.jpg)
- [基线 02 · Up 后搜索框仍获焦](02-baseline-en-up-stays-in-search.jpg)
- [基线 03 · 第二次 Tab 才到首项，焦点只见复选框弱泛光](03-baseline-en-first-result-after-two-tabs.jpg)
- [基线 04 · 空结果仍保留 Dynamic](04-baseline-en-confirmed-empty-retains-dynamic.jpg)

候选端口 `40622` 使用同一内置目录与独立存储。中文截图使用产品菜单设置的 150% 桌面缩放。

- [候选 05 · Down 直接聚焦 Research Studio，并显示整行焦点](05-candidate-en-down-focuses-research-studio.jpg)
- [候选 06 · Space 勾选 Research Studio，焦点留在该行](06-candidate-en-space-selects-exact-first.jpg)
- [候选 07 · Up 到最后一个当前匹配 Base，Dynamic 单独保留](07-candidate-en-up-focuses-base-before-retention.jpg)
- [候选 08 · 移除范围外 Dynamic 后搜索框回焦](08-candidate-en-removing-retained-row-returns-focus.jpg)
- [候选 09 · 确认无匹配后仍可编辑查询，原选择可见](09-candidate-en-empty-query-stays-in-field.jpg)
- [候选 10 · Escape 清除后，Up 到初始完整目录末项](10-candidate-en-clear-restores-initial-results.jpg)
- [候选 11 · 中文 150% 的说明与 Base 行焦点](11-candidate-zh-150-percent-up-focuses-base.jpg)
- [候选 12 · 中文 150% 下选中 Base 和 Research Studio](12-candidate-zh-150-percent-selects-two-squads.jpg)
- [候选 13 · 看板显示真实草稿回执和待规划卡片](13-candidate-zh-saved-backlog-receipt.jpg)
- [候选 14 · 打开已保存的草稿并读取原请求](14-candidate-zh-opens-exact-saved-request.jpg)
