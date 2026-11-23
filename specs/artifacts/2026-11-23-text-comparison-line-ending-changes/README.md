# 文本比较纯换行变化的桌面证据

真实隔离开发入口 `40592/ui/`、`40594/ui/` 的基线与候选。

| 画面 | 观察 |
| --- | --- |
| [01 六个行尾改变](01-baseline-lf-to-crlf-looks-like-six-rewritten-lines.jpg) | 正式文件证据只有 LF 到 CRLF，旧界面把六行原文显示为整段删增。 |
| [02 最后一个换行被移除](02-baseline-last-lf-removal-indistinguishable.jpg) | 重读后只标末行两次，可见文字彼此相同。 |
| [03 正常正文差异](03-baseline-text-change-shows-actual-new-content.jpg) | 同一文件基准到草稿的真实新增仍明确可读。 |
| [04 英文纯格式范围](04-candidate-en-six-lines-one-format-range.jpg) | 六个一致的变化合为 `1–6`，明确列出 LF 和 CRLF。 |
| [05 英文无末行换行](05-candidate-en-exact-removed-final-lf.jpg) | 第 6 行明确由 LF 改为无换行符，重读按钮保留焦点。 |
| [06 英文混合格式](06-candidate-en-mixed-endings-exact-line-ranges.jpg) | 真正变化的行分别显示为 `1`、`2`、`4–5` 和 `6`。 |
| [07 基准到草稿的正文](07-candidate-en-normal-draft-diff-keeps-text.jpg) | 第 7 行实际新增内容继续显示。 |
| [08 磁盘到草稿的正文](08-candidate-en-disk-and-draft-text-diff.jpg) | 含正文变化的比较继续呈现原差异和原草稿。 |
| [09 中文混合格式](09-candidate-zh-mixed-formats-localized.jpg) | 范围、术语和列头均可在同一页面阅读。 |
| [10 原字节重新读回](10-candidate-zh-restored-bytes-no-difference.jpg) | 原始版本恢复后，当前比较显示无差异。 |
| [11 试验稿撤销](11-candidate-zh-draft-undone-original-file.jpg) | 比较退出保留草稿，手动撤销后明确显示无未保存更改。 |
