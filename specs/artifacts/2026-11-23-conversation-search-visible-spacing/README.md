# 对话查找按可见空白匹配的真实桌面截图

五张基线来自 `40608/ui/`，本人查看并与真实导出对照。

| 画面 | 观察 |
| --- | --- |
| [01 原对话](01-baseline-real-messages-render-spaces.jpg) | 两条真实消息都以普通空格显示。 |
| [02 单空格短语](02-baseline-single-space-query-misses.jpg) | 可见的 `Copper seam 421` 查找为 0。 |
| [03 短词查找](03-baseline-short-query-shows-collapsed-preview.jpg) | 同一条原消息的摘要正好显示该短语。 |
| [04 跨行短语](04-baseline-single-space-query-misses-line-break.jpg) | 原 CRLF 按可见空格查询为 0。 |
| [05 跨行消息的摘要](05-baseline-line-query-shows-joined-preview.jpg) | 局部子串可以查到，摘要中有完整跨行短语。 |
