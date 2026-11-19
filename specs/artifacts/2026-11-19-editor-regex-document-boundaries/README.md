# 正则查找真实文档边界验收

## 基线

- [实际句号前的正则查询](baseline-sapphire-before-direction.png) · [上一项错误选择](baseline-sapphire-false-match.png)
- [跨行正则错误选择](baseline-multiline-false-match.png)
- [带真实句号的前瞻高亮](baseline-quartz-real-highlight.png) · [下一项错误报告未匹配](baseline-quartz-missed.png)

本人在 `40264/ui/` 的实际页面操作并复核五张截图。构建资源是 `main-BAaCvWTl.js`。真实 `file.read` 返回 200，内容与 106 字节磁盘文件精确相同。两个用例的光标偏移 18 和 65 处都是真实句号。命令报告与原正则局部基准见配套规格。
