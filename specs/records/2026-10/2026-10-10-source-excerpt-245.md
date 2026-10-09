# 245 Sources摘录缺字上游调查

[Recall](../../artifacts/2026-10-05-connection-workspace-authority/source-excerpt-investigation-245.md) / [实际证据](../../artifacts/2026-10-05-connection-workspace-authority/source-excerpt-245/README.md)。244 UI截图/canonical中的MDN元素名空位已追查：原completed search Tool输出包含同一canonical三条snippet，长度1700/1400/4142，完整内容分别在7730字符输出偏移170/2040/3588。

一次新的公共Exa真实HTTP200/SSE响应12054字节，由当前production parser解析为3条结果；完整摘录就在remote文本偏移189/2083/3673，原本已含13/22/20空inline-code span。代码链当前从transport文本到snippet/source/纯text显示只有trim/校验，没有剥离HTML标签。因此新响应的缺字属于上游摘录质量；原244缺字在真实Tool/Source边界一致，但原HTTP未保存，不将新请求假称原响应。

只读observer实际0，无生产修复、LLM调用、凭据复制、新Native服务或UI操作。保留当前canonical事实，不以关键词猜测补字，也不在无格式字段的snippet上增加第二套格式解释。所有UI自动化未运行；检索到的overlay-ui-frozen-source是HTTP不可变bundle协议检查，无页面/DOM/组件行为，不属于UI自动化且本轮未运行。完整remote原文仅private ignored目录。

本轮推进了根因范围，未宣称Sources/Rendering总体完成。下一步实际运行中侧栏卸载返回的帧仍须独立复核，当前只root，goal保持active。

docs:check（345 ops/25 groups）、architecture-index（18 documents/live links）、git diff --check实际0。没有源码修改，未重复执行类型/构建来充当视觉证明。
