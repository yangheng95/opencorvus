# 文件查找的正则错误反馈证据

## 基线

- [英文指南中三个匹配](baseline-search-alpha-en.png)、[切换中文后仍保留查询](baseline-search-alpha-zh.png)
- [实际打开另一文件得到空查询](baseline-new-file-empty-search-zh.png)、[参考文件中两个匹配](baseline-reference-beta-zh.png)
- [回车执行有效无匹配查询](baseline-no-match-after-enter-en.png)、[按下一项执行同一查询](baseline-no-match-after-next-en.png)
- [执行无效的 `[`](baseline-invalid-pattern-en.png)、[修正后两处实际匹配](baseline-valid-pattern-en.png)

截图由 `40256/ui/` 真实隔离 Windows Chrome 操作采集并人工检查。指南三处 Alpha，参考文件两处 Beta，两份读回均为 200，精确等于各自磁盘。有效无匹配与非法正则都没有明确状态提示。无效查询修正后原有高亮和定位可用。
