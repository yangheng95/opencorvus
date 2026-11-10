# 定时运行历史已确认读取证据

对应[规格](../../records/2026-11/2026-11-10-scheduled-run-history-confirmed-read.md)。[历史读取观测](history-observations.json)记录 B165 原 Fire、Run 和 Session 的有序身份、真实 HTTP 请求、响应截断和切换定义时的客户端关闭。代理只控制选定读取的时机和长度。16 张桌面截图均已本人查看。

| 现场 | 人工复核 |
| --- | --- |
| 基线 39428/39429 | [已确认两条原运行](baseline-history-accepted.jpg)；[慢刷新隐藏两条](baseline-refresh-hides-history.jpg)；[失败仅剩错误和第二个动作](baseline-history-error.jpg)；[重试卸载原诊断和焦点](baseline-retry-loses-focus.jpg)；[完整响应后才恢复两条](baseline-history-restored.jpg) |
| 首次候选 39430/39431 | [重试仍保留原诊断及记录；旧文案仍要求重试](candidate-retry-retains-focus-and-details.jpg) |
| 最终首次读取 39432/39433 | [冷读取失败不显示空历史](final-cold-history-error.jpg)；[真实空回执后显示尚未运行](final-confirmed-empty-history.jpg) |
| 最终英文 39432/39433 | [刷新标记上次加载记录](final-en-refresh-keeps-history.jpg)；[二次重试仍见原诊断及两条](final-en-diagnostic-and-original-rows.jpg)；[恢复后保留刷新焦点](final-en-recovered-refresh-focus.jpg)；[移动到会话后保留会话焦点](final-en-focus-remains-on-session.jpg)；[打开 08:43 的真实会话](final-opened-exact-run-session.jpg) |
| 最终中文 39432/39433 | [刷新保留原记录](final-zh-refresh-keeps-history.jpg)；[刷新失败、明确说明仍为上次记录](final-zh-history-error-with-original-rows.jpg)；[切换后保留另一自动化的三条](final-zh-other-definition-own-history.jpg) |
