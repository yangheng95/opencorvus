# 248 流式列表格式

单 agent 沿当前唯一 Markdown（轻量标记语言）lexer/parser 呈现所有已接受 token，包括变化中的最后一块。连续列表不再整段转成原始文本；完成块缓存、locale（语言资源）、安全链接/HTML（Hypertext Markup Language，超文本标记语言）转义、代码复制及现有分帧队列保持原实现。已删除 activeText 回复、model 信号、plain tail 输出、无调用者的 activeTextClassName 及仅服务它的 CSS（Cascading Style Sheets，层叠样式表）。InlineToolPart 的原始工具预览限制仍有真实调用者，继续保留。

- [Recall/根因/影响/实施准入](../streaming-markdown-plan-248.md)。
- [修复前真实 Working 照片](../streaming-prefix-247/review-01/side-before-close.jpg)：连续列表第 6 段仍带原始粗体和代码符号，前面完成的条目也未解析。
- [新真实运行与照片](live-01/README.md)：列表生成中已格式化、向上阅读、终态 Sources/部分表格及代码视图、空输入和正常物理闭合。
- [typecheck 原运行副本](checks/typecheck.log) / [build 原运行副本](checks/build.log)：实际 0，仅辅助证据。

本轮没有 UI（User Interface，用户界面）自动化或 renderer 测试；照片实际呈现，由 root 人工复核，只读页面诊断辅助绑定身份和阶段。目标区域的布局、格式与现有对话实际改善，但不宣称全部 Rendering 帧、原 Research 子 agent Dock、嵌套列表/长块性能、变化块的文本选择或键盘焦点保持、所有主题语言均已验收。

结束时同一阅读 scrollTop 保持，但 elapsed header 移除及输入框恢复仍有布局变化，需要后续独立调查。表格照片只涵盖当时可见部分，未把它描述为所有行列的全视窗验收；当前块中的不完整符号沿真实 parser 解释，不伪造闭合标记。目标持续迭代，不标记全部工作完成。
