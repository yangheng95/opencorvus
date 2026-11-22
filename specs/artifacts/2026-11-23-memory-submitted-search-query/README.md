# 笔记搜索草稿与已提交查询

[调查和验收记录](../../records/2026-11/2026-11-23-memory-submitted-search-query.md)

基线来自独立项目开发服务 `http://127.0.0.1:40446/ui/` 的真实桌面。

- [北区两份真实笔记的普通列表](01-baseline-north-note-list.jpg)
- [提交雪松词后显示真实命中](02-baseline-cedar-search.jpg)
- [编辑河道词时仍展开旧搜索的雪松原文](03-baseline-draft-with-previous-result.jpg)
- [再次提交后才显示实际河道笔记](04-baseline-river-submitted.jpg)
- [编辑有效草稿时仍显示先前查询的通用空提示](05-baseline-draft-with-previous-empty-result.jpg)

候选版直接使用 `http://127.0.0.1:40448/ui/`。最后三张通过 `40449/ui/` 截断同一实际服务的一次搜索响应并正常重试。

- [带首尾空格的输入与实际修剪后提交词](06-candidate-trimmed-search-group.jpg)
- [英文草稿变化时，已提交词和已展开原文仍有明确归属](07-candidate-english-draft-keeps-owner.jpg)
- [切中文仍保留同一草稿、查询和原文](08-candidate-chinese-draft-keeps-owner.jpg)
- [提交河道词后标签和命中一同变更](09-candidate-chinese-current-river-result.jpg)
- [新草稿旁的空提示明确指向已提交词](10-candidate-chinese-empty-owner.jpg)
- [键盘清除恢复真实普通列表与输入焦点](11-candidate-ordinary-list-after-clear.jpg)
- [长空结果查询在结果区换行](12-candidate-long-query-wrap.jpg)
- [长查询结果标签在结果区换行](13-candidate-long-result-label-wrap.jpg)
- [切换南区即显示该项目的加载状态](14-candidate-south-fresh-scope.jpg)
- [南区加载完成后的普通列表](15-candidate-south-ordinary-list.jpg)
- [同一个查询读回南区真实山脊原文](16-candidate-south-original-note.jpg)
- [真实传输中断时英文错误标明准确查询](17-candidate-search-error-owner.jpg)
- [编辑草稿与切换语言后中文摘要保留准确归属和原诊断](18-candidate-chinese-error-owner-and-diagnostic.jpg)
- [正常重提交后返回真实雪松结果及对应查询](19-candidate-search-retry-accepted.jpg)
