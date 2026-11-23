# 文件审阅搜索结果与键盘焦点截图

真实隔离开发服务、正常会话和正式快照的桌面交互。基线 `40870/ui/` 有三个真实保存的变更项。

| 原图 | 实际观察 |
| --- | --- |
| [01 英文搜索向下](01-baseline-en-arrow-down-stays-in-review-filter.jpg) | 两项匹配，向下键后仍聚焦查询。 |
| [02 原生 Tab](02-baseline-en-tab-goes-to-clear-before-file-list.jpg) | 搜索后先进入清除，列表还需穿过两个筛选。 |
| [03 结果行焦点](03-baseline-en-list-arrow-focus-before-choosing.jpg) | 列表向下聚焦下一行，原预览保持。 |
| [04 原生选择](04-baseline-en-enter-selects-focused-review-record.jpg) | Enter 选中正确的变更记录，预览更新。 |
| [05 中文 160%](05-baseline-zh-160-up-stays-in-review-filter.jpg) | 两条匹配仍在，列表在筛选下方被压到 0 像素。 |

[调查、方案及验收](../../records/2026-11/2026-11-24-file-review-search-result-focus.md)
