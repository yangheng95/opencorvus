# 正则查找真实文档边界验收

## 基线

- [实际句号前的正则查询](baseline-sapphire-before-direction.png) · [上一项错误选择](baseline-sapphire-false-match.png)
- [跨行正则错误选择](baseline-multiline-false-match.png)
- [带真实句号的前瞻高亮](baseline-quartz-real-highlight.png) · [下一项错误报告未匹配](baseline-quartz-missed.png)

本人在 `40264/ui/` 的实际页面操作并复核五张截图。构建资源是 `main-BAaCvWTl.js`。真实 `file.read` 返回 200，内容与 106 字节磁盘文件精确相同。两个用例的光标偏移 18 和 65 处都是真实句号。命令报告与原正则局部基准见配套规格。

## 候选

- [英文按真实行尾判断](candidate-en-real-line-boundary.png) · [中文保留查询及结果](candidate-zh-real-line-boundary.png) · [按真实文件尾判断跨行表达式](candidate-zh-real-document-boundary.png)
- [实际第二行行尾](candidate-zh-ruby-real-match.png) · [实际跨行](candidate-zh-cross-line-match.png) · [实际句号前瞻](candidate-zh-lookahead-selected.png)
- [仅替换目标的草稿](candidate-zh-replaced-draft.png) · [原标点和保存完成](candidate-zh-saved-exact-text.png)
- [字面查找已保存正文](candidate-zh-literal-saved-match.png) · [中文无效正则反馈](candidate-zh-invalid-preserved.png)

本人在 `40266/ui/` 手动操作，逐张复核十张实际页面截图。候选构建入口为 `main-CysxSAvr.js`。保存前后服务的同一文件接口均返回 200，对应字节从 106 变为 108，变化仅为原字节 `[59,65)` 的替换。
