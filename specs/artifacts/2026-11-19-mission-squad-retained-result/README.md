# 搜索保留专家团的桌面验收

## 基线

- [查询零结果时正确显示仍选中的 Dynamic](baseline-zero-query-retained.png)
- [取消选择后已不属于当前搜索的行仍可聚焦](baseline-zero-query-row-stays.png)
- [按第二次空格重新勾选搜索范围外的 Dynamic](baseline-zero-query-reselected.png)

本人在 `40300/ui/` 实际操作并逐图复核，页面视口 1280×800，入口 `main-zA6pe0jI.js`。[真实项目目录的四次查询回执](baseline-search-receipts.json)

## 候选

- [英文零结果查询仍显示已选 Dynamic](candidate-en-retained-before-removal.png)
- [取消 Dynamic 后显示零结果，原搜索框重新获得焦点](candidate-en-empty-state-focus.png)
- [取消真实匹配项时，复选框仍可操作且保留焦点](candidate-en-matched-row-keeps-focus.png)
- [再按空格时，真实匹配项重新选中](candidate-en-matched-row-reselected.png)
- [两个查询先后选中 Advanced 和 Dynamic](candidate-en-two-queries-selected.png)
- [清除查询后恢复实际目录和两个选择](candidate-en-cleared-catalog.png)
- [中文取消后显示零结果且原查询框获得焦点](candidate-zh-empty-state-focus.png)
- [直接输入新查询并选择真实匹配项，草稿内容保留](candidate-zh-matching-selection.png)
- [中文正式保存，草稿显示在待规划列表](candidate-zh-draft-receipt.png)

本人在 `40302/ui/` 键盘与鼠标操作并逐图复核，页面视口 1280×800，入口 `main-vn79wV_1.js`。[真实目录查询回执](candidate-search-receipts.json) · [任务与会话接口的草稿回读](candidate-draft-receipt.json)
