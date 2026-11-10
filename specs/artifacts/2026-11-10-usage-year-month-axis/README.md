# 年度用量月份轴实页证据

对应[根因、方案与验收](../../records/2026-11/2026-11-10-usage-year-month-axis.md)。下图为独立真实开发 `/ui` 的 1280×720 桌面原图，已由本人目视复核。

| 场景 | 原图 | 观察 |
| --- | --- | --- |
| 英文基线 | [全年](baseline-en-year.jpg)、[标签左缘上方](baseline-en-year-dec-label-nov-column.jpg)、[按右键后一周](baseline-en-year-dec-first-actual-column.jpg) | `Dec` 左缘上方点到 11 月 24 日；按 Right 才到 12 月 1 日。 |
| 简体中文基线 | [全年](baseline-zh-year.jpg)、[标签左缘上方](baseline-zh-year-dec-label-nov-column.jpg) | 「12月」左缘正上方同样点到 11 月 24 日。 |
| 英文候选 | [全年](candidate-en-year.jpg)、[标签左缘上方](candidate-en-year-dec-label-actual-column.jpg)、[按左键](candidate-en-year-left-to-november.jpg) | `Dec` 贴其实际首周列；点上方是 12 月 1 日，左键为 11 月 24 日、右键返回。 |
| 年度首尾 | [Home 首日](candidate-en-year-home-first-day.jpg)、[End 末日](candidate-en-year-end-last-day.jpg) | 原键盘位置和具体时间详情保留；首尾不完整周仍是实际日格。 |
| 简体中文候选 | [全年](candidate-zh-year.jpg)、[12 月首日](candidate-zh-year-dec-label-actual-column.jpg)、[键盘刷新](candidate-zh-year-keyboard-refresh.jpg) | 12 月轴位置对应实际 12 月 1 日；刷新后轴保持，焦点仍在「刷新用量」。 |
| 短周期回归 | [今天](candidate-zh-day.jpg)、[本周](candidate-zh-week.jpg)、[本月](candidate-zh-month.jpg) | 小时及日期轴保留原位置、选中状态和零用量。 |

[真实读取、数据库和关停回执](receipts.json)包含前后各四个周期的响应及当前运行接口文档验证。
