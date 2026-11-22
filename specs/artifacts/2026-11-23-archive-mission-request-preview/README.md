# 归档多步任务请求预览的桌面验收

## 基线

`40392/ui/` 来自本批隔离的真实开发服务。北区和南区有同题草稿，各自保存不同原请求，两条已归档。

- [英文未过滤列表，两条同题草稿](baseline-en-archive-list.jpg)
- [英文按北区请求查询，结果行未展示请求](baseline-en-archive-by-request.jpg)
- [打开命中的北区会话读完整请求](baseline-en-archive-request-detail.jpg)
- [真实恢复北区会话并返回待开始状态](baseline-en-archive-restored.jpg)
- [简体中文按南区请求查询，结果行未展示请求](baseline-zh-archive-by-request.jpg)
- [正式归档与查询的身份、项目和请求回执](baseline-archive-baseline.json)
- [仅北区会话恢复后的正式读取回执](baseline-after-restore.json)

## 候选

`40394/ui/` 使用相同项目、标题和请求开头。南区原请求额外保存多行库存核对内容，供两行预览和详情末尾核验。

- [英文未过滤列表，两条同题草稿及各自原请求](candidate-en-archive-list.jpg)
- [英文查询北区请求，显示正确的一行和请求](candidate-en-archive-by-request.jpg)
- [打开北区归档会话的完整请求](candidate-en-archive-request-detail.jpg)
- [实际恢复同一条北区草稿](candidate-en-archive-restored.jpg)
- [简体中文未过滤列表，只有南区仍归档](candidate-zh-archive-after-restore.jpg)
- [简体中文查询南区请求，原文预览两行](candidate-zh-archive-by-request.jpg)
- [南区归档会话里的完整正文与末尾标记](candidate-zh-archive-full-request.jpg)
- [两个草稿的初始归档和按请求查询回执](candidate-archive-baseline.json)
- [恢复后两个正式读的身份和原文](candidate-after-restore.json)
- [两套服务数据库中的实际记录计数](isolated-runtime-counts.json)
