# 对话查找按可见空白匹配的真实桌面截图

五张基线来自 `40608/ui/`，本人查看并与真实导出对照。

| 画面 | 观察 |
| --- | --- |
| [01 原对话](01-baseline-real-messages-render-spaces.jpg) | 两条真实消息都以普通空格显示。 |
| [02 单空格短语](02-baseline-single-space-query-misses.jpg) | 可见的 `Copper seam 421` 查找为 0。 |
| [03 短词查找](03-baseline-short-query-shows-collapsed-preview.jpg) | 同一条原消息的摘要正好显示该短语。 |
| [04 跨行短语](04-baseline-single-space-query-misses-line-break.jpg) | 原 CRLF 按可见空格查询为 0。 |
| [05 跨行消息的摘要](05-baseline-line-query-shows-joined-preview.jpg) | 局部子串可以查到，摘要中有完整跨行短语。 |

七张候选图来自 `40610/ui/`，均由本人操作和复核。

| 画面 | 观察 |
| --- | --- |
| [06 单空格短语](06-candidate-en-single-space-finds-real-message.jpg) | 英文查询一项，命中保存四空格的原消息。 |
| [07 大小写与空格变体](07-candidate-en-mixed-case-spaces-same-result.jpg) | 同一实际结果保留完整短语。 |
| [08 第一条消息高亮](08-candidate-en-locates-exact-space-message.jpg) | 英文查找选中后高亮第一条原文并回标题操作。 |
| [09 中文跨行查找](09-candidate-zh-phrase-finds-crlf-message.jpg) | 单空格短语命中保存 CRLF 的第二条消息。 |
| [10 真实刷新](10-candidate-zh-refresh-preserves-phrase-match.jpg) | 查询、计数、结果身份和刷新控件焦点保持。 |
| [11 第二条消息高亮](11-candidate-zh-locates-original-crlf-message.jpg) | 查找到准确的第二条原文并回标题操作。 |
| [12 词序不同](12-candidate-zh-reordered-terms-remain-no-match.jpg) | 乱序的词显示中文零匹配。 |
