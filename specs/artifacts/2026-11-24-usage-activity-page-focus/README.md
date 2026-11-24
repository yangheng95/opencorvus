# 用量活动图分页的桌面证据

真实基线 `41590/ui/` 由隔离服务提供。截图已本人复核。英文 100%，简体中文 160%。

| 基线 | 观察 |
| --- | --- |
| [英文年度初态](investigation-en-year-empty-usage.jpg) | 实际年度数据及周期切换。 |
| [中文年度末日](investigation-zh-year-last-interval.jpg) | End 揭示实际 12 月 31 日及当前提示。 |
| [中文年度末日下翻](investigation-zh-year-period-focus-after-page-down.jpg) | 正文只显示官方来源，焦点仍是旧的 12 月 31 日。 |
| [中文年度首日下翻](baseline-zh-year-page-down-leaves-january-focused.jpg) | 1 月 1 日焦点亦能留在屏幕外。 |
| [英文月图下翻](baseline-en-month-page-down-focuses-offscreen-interval.jpg) | 光标保持在 11 月 30 日，图完全滚出屏幕。 |

[活动焦点及双滚动视口](baseline-desktop-focus.json)与[四周期实际用量](baseline-usage-proof.json)。

[首版候选日图](first-candidate-zh-day-page-stops-before-visible-final-hour.jpg) 的末桶可见，但整数视口宽度令首桶下翻停在 22:00。

[首版焦点和实测宽度](first-candidate-desktop-focus.json)记录了日图与周图的末桶，[第二版焦点和实测宽度](second-candidate-desktop-focus.json)记录了正向到达实际末桶、反向仍停在 01:00 的现象。

最终构建 `41596/ui/` 加载 `main-D0dQkXUq.js`。下表截图已在真实 Windows 桌面逐张复核。

| 最终构建 | 观察 |
| --- | --- |
| [英文月图末日](verified-en-month-last-day-keeps-grid-visible.jpg) | 11 月 30 日的描边和相同日期的提示与全图同屏。 |
| [英文图外翻页](verified-en-outside-chart-pages-through-source-cards.jpg) | Tab 把焦点交回披露控件，Page Down 滚到展开的官方卡片。 |
| [中文年度下翻](verified-zh-year-shifts-within-same-weekday.jpg) | 到达 12 月 31 日，和之前的实际目标处于同一星期行。 |
| [中文年度上翻](verified-zh-year-reverse-tooltip.jpg) | 指针仍在原日期一端，提示和焦点描边同指 4 月 30 日。 |
| [中文周图末日](verified-zh-week-last-day.jpg) | 末位 11 月 29 日完整显示，反向返回 11 月 23 日。 |
| [中文日图正向末位](verified-zh-day-last-hour.jpg) | 正向进入实际最后一个小时 23:00。 |
| [中文日图反向首位](verified-zh-day-first-hour.jpg) | 反向直接进入 00:00，并在边界保持焦点。 |

[最终真实焦点及滚动范围](verified-desktop-focus.json)、[基线完整四周期报表](baseline-statistics-evidence.json)、[最终完整四周期报表](verified-statistics-evidence.json)、[最终服务用量读回](verified-usage-read-receipts.json)。四份隔离候选报表逐项一致，统计证据包括实时数据、数据库快速完整性检查及项目文件读回。
