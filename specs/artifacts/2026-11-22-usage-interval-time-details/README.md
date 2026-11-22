# 用量活动时间提示的桌面证据

2026-11-22 独立开发服务的 1280×720 浏览器原图。请求时区为 Asia/Shanghai，实际账本为空，服务返回真实自然周期和零用量统计。

| 基线画面 | 人工观察 |
| --- | --- |
| [英文首小时](baseline-en-first-hour.jpg) | 相同日期和 GMT+8 各展示两次。 |
| [英文末小时](baseline-en-last-hour.jpg) | End 聚焦当地 23:00，结束边界是翌日 00:00。 |
| [中文首小时](baseline-zh-first-hour.jpg) | 相同日期和 GMT+8 各展示两次。 |

| 候选画面 | 人工观察 |
| --- | --- |
| [英文年度首日](candidate-en-year-day.jpg) | 年度格显示 1 月 1 日到 2 日及一次 GMT+8。 |
| [英文首小时](candidate-en-first-hour.jpg) | 鼠标打开，日期和偏移各显示一次。 |
| [英文相邻小时](candidate-en-second-hour.jpg) | Right 聚焦第二格并更新时段。 |
| [英文末小时](candidate-en-last-hour.jpg) | End 聚焦末格，保留次日日期及一次偏移。 |
| [英文关闭提示](candidate-en-escape.jpg) | Escape 收起浮层，焦点仍在末格。 |
| [中文本周首日](candidate-zh-week-day.jpg) | 提示显示周一和周二的实际午夜端点。 |
| [中文本月末日](candidate-zh-month-end.jpg) | 提示显示 11 月 30 日开始、12 月 1 日结束。 |
| [中文首小时](candidate-zh-first-hour.jpg) | 显示一次日期、00:00–01:00 和一次 GMT+8。 |
| [中文末小时](candidate-zh-last-hour.jpg) | 键盘打开末格，显示 23:00 至翌日 00:00。 |

[四个自然周期的候选读取回执](candidate-usage-receipts.json)来自真实 `/global/usage`，核对截至时间、时间粒度、时区、连续分桶和零用量。
