# 定时任务建议时间的桌面验收

2026-11-22 独立开发服务和桌面浏览器的实际原图。

| 基线 | 人工观察 |
| --- | --- |
| [时间选择器重开](baseline-clock-reopened.jpg) | 9 时与 57 分已显示为当前选中项，该候选问题排除。 |
| [建议列表](baseline-suggestion-list.jpg) | 英文建议把每周复盘显示为 Weekly at 16:00，星期五在描述中。 |
| [实际每周草稿](baseline-weekly-draft.jpg) | 星期五 4:00 PM，使用英语的时钟格式，草稿未提交。 |

| 候选 | 人工观察 |
| --- | --- |
| [英文建议](candidate-en-list.jpg) | 三条建议时间含本地化的 AM 或 PM，每周复盘显示 Friday。 |
| [英文每周复盘](candidate-en-weekly.jpg) | Every week、Friday、4:00 PM，默认时区 Asia/Shanghai。 |
| [英文每日简报](candidate-en-daily.jpg) | Weekdays、8:00 AM。 |
| [英文跟进监控](candidate-en-follow-up.jpg) | Weekdays、9:00 AM。 |
| [简体中文建议](candidate-zh-list.jpg) | 两条工作日建议为 8:00 和 9:00，每周复盘为星期五 16:00。 |
| [简体中文每周草稿](candidate-zh-weekly.jpg) | 每周、星期五、16:00，默认时区 Asia/Shanghai。 |
| [简体中文取消后](candidate-zh-cancel.jpg) | 恢复三条建议与空列表，搜索栏重新获得焦点。 |

[运行回执](runtime-proof.json) 包含候选服务的真实页面和资源读取、草稿交互前后的定义列表和两套隔离数据库的只读统计。
