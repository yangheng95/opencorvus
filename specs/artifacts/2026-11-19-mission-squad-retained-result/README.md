# 搜索保留专家团的桌面验收

## 基线

- [查询零结果时正确显示仍选中的 Dynamic](baseline-zero-query-retained.png)
- [取消选择后已不属于当前搜索的行仍可聚焦](baseline-zero-query-row-stays.png)
- [按第二次空格重新勾选搜索范围外的 Dynamic](baseline-zero-query-reselected.png)

本人在 `40300/ui/` 实际操作并逐图复核，页面视口 1280×800，入口 `main-zA6pe0jI.js`。[真实项目目录的四次查询回执](baseline-search-receipts.json)
