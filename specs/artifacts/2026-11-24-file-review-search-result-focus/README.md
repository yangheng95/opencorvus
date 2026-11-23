# 文件审阅搜索结果与键盘焦点截图

真实隔离开发服务、正常会话和正式快照的桌面交互。基线 `40870/ui/` 及普通候选均有三个真实保存的变更项。最终另用 `40878/ui/` 的 84 条真实快照确认虚拟列表和切回普通路径。

| 原图 | 实际观察 |
| --- | --- |
| [01 英文搜索向下](01-baseline-en-arrow-down-stays-in-review-filter.jpg) | 两项匹配，向下键后仍聚焦查询。 |
| [02 原生 Tab](02-baseline-en-tab-goes-to-clear-before-file-list.jpg) | 搜索后先进入清除，列表还需穿过两个筛选。 |
| [03 结果行焦点](03-baseline-en-list-arrow-focus-before-choosing.jpg) | 列表向下聚焦下一行，原预览保持。 |
| [04 原生选择](04-baseline-en-enter-selects-focused-review-record.jpg) | Enter 选中正确的变更记录，预览更新。 |
| [05 中文 160%](05-baseline-zh-160-up-stays-in-review-filter.jpg) | 两条匹配仍在，列表在筛选下方被压到 0 像素。 |
| [06 首候选英文交接](06-candidate-en-down-focuses-current-matching-item.jpg) | 方向键进入当前匹配。 |
| [10 首候选中文可见结果](10-candidate-zh-160-shows-both-results-after-keyboard-entry.jpg) | 两条结果恢复可见，比较正文空间不足。 |
| [13 第二候选英文并排](13-final-en-wide-side-by-side-retains-search-and-preview.jpg) | 1600×900 桌面中审阅宽约 948 像素，并排布局可真实操作。 |
| [14 第二候选中文预览](14-final-zh-160-first-match-and-comparison-body-visible.jpg) | 结果和比较都有空间，首条聚焦完整。 |
| [15 第二候选焦点裁切](15-second-candidate-zh-160-focused-row-clipped.jpg) | 第二项实际得到焦点，但列表没有滚动，只见裁切边线。 |
| [17 第三候选普通渲染](17-third-candidate-zh-160-nonvirtual-flag-removes-custom-rows.jpg) | 动态关闭 Kobalte 属性后仍有两条数据，真实行不再渲染。 |
| [19 最终中文第一条](19-reader-zh-160-enter-current-matching-file.jpg) | 查询交接到当前选择，比较正文现有内容可滚动。 |
| [20 最终中文第二条](20-reader-zh-160-second-row-fully-visible-with-old-preview.jpg) | 第二条完整滚入，原预览保持到明确选择。 |
| [21 最终中文向上复位](21-reader-zh-160-previous-file-clears-sticky-heading.jpg) | 向上回第一条，黏附标题不再遮挡当前焦点。 |
| [22 最终中文选择](22-reader-zh-160-selected-file-uses-own-preview.jpg) | 空格选择第二条，比较准确更新。 |
| [23 最终中文收起](23-reader-zh-160-hidden-record-list-opens-comparison-space.jpg) | 保留当前记录，正文提示可完整阅读。 |
| [24 最终中文磁盘文件](24-reader-zh-160-workbench-reads-exact-file.jpg) | 工作台真正显示所选的文件及准确内容。 |
| [25 最终中文返回](25-reader-zh-160-return-restores-query-and-file-selection.jpg) | 重新打开审阅后恢复原查询和当前文件。 |
| [26 最终中文空交集](26-reader-zh-160-empty-intersection-keeps-search-focus.jpg) | 新增与修改查询组合没有结果，向下键保留输入焦点。 |
| [27 最终中文清除](27-reader-zh-160-clear-restores-three-original-files.jpg) | 恢复三条原结果和第一条记录焦点。 |
| [28 最终英文长列表进入](28-reader-en-virtual-84-matches-first-record.jpg) | 84 条实际匹配，可直接进入首条。 |
| [29 最终英文旧的跨窗限制](29-reader-en-virtual-end-scrolls-but-loses-focus.jpg) | End 滚到末段，实际焦点回到页面。 |
| [30 最终英文第 84 项](30-reader-en-virtual-last-record-opens-correct-preview.jpg) | 可选择真实已出现的末项并读取确切路径。 |
| [31 最终英文虚拟邻项](31-reader-en-virtual-adjacent-keyboard-selects-correct-record.jpg) | 向上及 Enter 选择第 83 项。 |
| [32 最终英文切到普通列表](32-reader-en-filter-returns-from-virtual-to-five-files.jpg) | 五项匹配中，原第 83 项仍选中且聚焦可见。 |

[调查、方案及验收](../../records/2026-11/2026-11-24-file-review-search-result-focus.md)
