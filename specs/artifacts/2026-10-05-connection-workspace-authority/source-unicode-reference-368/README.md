# 368 Unicode行内文件引用

[Recall与根因分析](../source-unicode-reference-plan-368.md)。367/05的中文代码路径被ASCII token规则拒绝。本轮在唯一Markdown renderer改用Unicode Letter/Number/Mark属性类，保留原字符序列、位置解析、现有路径语义和统一打开入口。

## 实页与原始事实

- 01–03：真实Main模型回复的中文及分解重音文件名成为可点击引用，实际打开对应文件第2行第10列；磁盘和规范消息中的组合序列一致。
- 04–05：日文与阿拉伯数字文件名第一次locator click未改变目标，保留04。换行链接的总矩形覆盖两行及中间空白，可能解释工具点击落点，但没有底层点击坐标，未断言其内部根因。随后直接点击可见文字实际打开正确文件，05人工确认。
- 06–07：ASCII文件名对照、带中文的Windows绝对路径分别打开原文件；绝对引用经键盘Enter打开，现有只读来源语义保持。未额外测试全ASCII目录或Native外部编辑器。
- 08–11：Side实际检索和最终回复完整结束，中文正文引用与结构化Source分别打开同一位置；隐藏后键盘重新打开分解重音引用仍正确。全部11张截图均亲自查看，JSON只是只读辅助，无UI断言。
- `checks/runtime-qualification.json`核对真实9 Source（Main4、Side继承4、Side当前1）、自然模型最后正文、原文件完整字节与生产ToolOutcome，列2:10与精确原文件名一致。9实际gpt-6.1-sol流式HTTP200/EOF；完整Main/Side最终message均stop/completed。
- 正式overlay typecheck91688 exit0、build4696 exit0（52.41s，main-aBfB0VSj.js），当前HTTP200；纯UI修改没有新增、修改或运行UI自动化测试。

18369/page187独立scope、预设12累计请求与固定600000ms未改变。页面关闭后唯一shutdown exit0，原launcher91532实际join exit0，Native221188ms内exited0、physical/output/request/端口/配对凭据清除完整。该次成功不覆盖367原预算失败。auth/models内容只在私有运行目录，公开证据通过凭据扫描。

自动代码路径语法此次扩展文字类Unicode字符，不泛化空格、任意符号或emoji路径；显式Markdown目标沿现合同。旧359首次复制边界未知保留，持续单agent目标active。
