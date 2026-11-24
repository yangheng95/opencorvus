# 手动滚动后用量区间焦点的桌面证据

原始隔离开发服务 `41600/ui/`。Windows 桌面 1280 × 720，英文 100%，简体中文 160%。

| 基线截图 | 本人复核 |
| --- | --- |
| [英文月图初态](baseline-en-month-first-interval.jpg) | 11 月 1 日真实焦点和提示同屏。 |
| [英文月图滚轮后按方向键](baseline-en-month-arrow-moves-focus-offscreen.jpg) | 读到 11 月 2 日的新提示，图与实际焦点仍在屏幕外。 |
| [中文年图滚轮前](baseline-zh-year-last-day-before-wheel.jpg) | 已选真正 12 月 31 日，描边和日期同屏。 |
| [中文年图纵向滚轮后按 Home](baseline-zh-year-home-bucket-stays-offscreen.jpg) | 焦点已变为 1 月 1 日，屏幕仍是官方来源卡片。 |
| [中文年图横向滚轮后按 Home](baseline-zh-year-home-remains-horizontal-offscreen.jpg) | 选择仍为 1 月 1 日，图只显示 5 月之后的列，首日没被恢复可见。 |

[真实输入前后日期及位置](baseline-desktop-focus.json)和[四周期实际用量与项目持久状态](baseline-statistics-evidence.json)。

首版候选 `41604/ui/` 恢复了真实区间焦点，但仅用单桶最近边界滚动。[英文 11 月 2 日](candidate-en-arrow-restores-november-2.jpg)贴在上缘且标题离屏，[中文 12 月 31 日](candidate-zh-boundary-returns-only-lower-rows.jpg)上方三个星期行仍被裁掉。[焦点、图表区和提示位置](candidate-desktop-focus.json)。

最终隔离开发服务 `41606/ui/`，资产 `main-7M2rr2X8.js`。以下实际截图逐张复核。

| 最终构建 | 观察 |
| --- | --- |
| [英文方向键](verified-en-arrow-restores-chart-and-title.jpg) | 11 月 2 日的真实提示和描边重新出现。 |
| [英文关闭提示](verified-en-month-heading-and-labels.jpg) | 标题、周期、时间刻度、图例与当前描边完整显示。 |
| [英文重复 End](verified-en-last-date-after-repeated-end.jpg) | 刚经滚轮离屏的 11 月 30 日恢复可见且选择维持。 |
| [英文图外页键](verified-en-page-outside-chart.jpg) | 原生 Tab 离开图后，可翻页浏览官方来源。 |
| [中文年图重复末位 Page Down](verified-zh-year-last-boundary-restores-seven-rows.jpg) | 末日焦点与七个星期行、标签和周期同屏。 |
| [中文年度反向翻页](verified-zh-year-page-up-matches-april-30.jpg) | 4 月 30 日提示和描边对应同一桶。 |
| [中文横向滚轮浏览](verified-zh-year-mouse-can-browse-other-columns.jpg) | 手动横向滚动可独立查看晚些的列。 |
| [中文重复 Home](verified-zh-year-home-restores-first-column.jpg) | 恢复第一列的 1 月 1 日，纵向位置保持。 |
| [中文下边界](verified-zh-year-bottom-boundary-restores-context.jpg) | 上滚离屏的 1 月 11 日在按边界方向键后与完整图一起返回。 |
| [中文刷新](verified-zh-refresh-keeps-year-and-source-disclosure.jpg) | 保留真实年周期、已渲染图和刷新焦点。 |

[实际焦点及滚动位置](verified-desktop-focus.json)、[最终四周期报表](verified-statistics-evidence.json)和[8 条真实读回回执](verified-usage-read-receipts.json)。
