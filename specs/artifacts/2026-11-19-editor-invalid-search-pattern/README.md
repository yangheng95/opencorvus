# 文件查找的正则错误反馈证据

## 基线

- [英文指南中三个匹配](baseline-search-alpha-en.png)、[切换中文后仍保留查询](baseline-search-alpha-zh.png)
- [实际打开另一文件得到空查询](baseline-new-file-empty-search-zh.png)、[参考文件中两个匹配](baseline-reference-beta-zh.png)
- [回车执行有效无匹配查询](baseline-no-match-after-enter-en.png)、[按下一项执行同一查询](baseline-no-match-after-next-en.png)
- [执行无效的 `[`](baseline-invalid-pattern-en.png)、[修正后两处实际匹配](baseline-valid-pattern-en.png)

截图由 `40256/ui/` 真实隔离 Windows Chrome 操作采集并人工检查。指南三处 Alpha，参考文件两处 Beta，两份读回均为 200，精确等于各自磁盘。有效无匹配与非法正则都没有明确状态提示。无效查询修正后原有高亮和定位可用。

## 候选

- [字面模式实际匹配方括号](candidate-literal-bracket-en.png)、[正则模式显示英文错误](candidate-invalid-pattern-en.png)
- [在当前查询上切换中文](candidate-invalid-pattern-zh.png)、[约 320 像素侧栏](candidate-invalid-pattern-narrow-zh.png)
- [更正后两处结果及定位](candidate-corrected-pattern-zh.png)、[再次输入非法正则时的焦点](candidate-invalid-typed-focused-zh.png)、[按 Escape 关闭面板](candidate-search-closed-zh.png)
- [独立只读文件的新查询](candidate-other-source-empty-search-zh.png)、[只读来源的错误状态](candidate-read-only-invalid-pattern-zh.png)、[更正后真实只读匹配](candidate-read-only-corrected-pattern-zh.png)

候选 `40258/ui/` 的十张截图来自实际桌面操作并逐张复核。真实项目三份原文和一份绝对只读来源读取 200，正文精确等于磁盘。原两个基线文档分别为 293 和 136 字节，候选逐字节一致。基线 36684 和候选 5340 已以各自启动身份正常关闭，端口 `40256` 和 `40258` 均释放。
