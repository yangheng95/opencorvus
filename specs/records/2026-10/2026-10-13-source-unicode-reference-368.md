# 2026-10-13 Unicode文件引用368

[Recall](../../artifacts/2026-10-05-connection-workspace-authority/source-unicode-reference-plan-368.md) · [真实页面与运行证据](../../artifacts/2026-10-05-connection-workspace-authority/source-unicode-reference-368/README.md)。

367真实发现中文行内代码引用没有链接属性，标准Markdown及Source打开正常。根因是唯一codespan路径guard的ASCII word字符类。改为Unicode字母/数字/组合标记并保留原字符序列及路径判别，既有列号与统一导航继续生效。

11张实页图覆盖中文、分解重音、日文+非ASCII数字、ASCII文件名和Windows绝对引用；Main及Side正文/Source正确打开2:10，隐藏后重开成功。首次换行引用locator未触发的04保留，之后真实文字点击成功，不冒称所有首次动作通过。9实际Source与自然模型正文/原文件完整内容核对通过，9 Sol流式EOF、Native221188ms、原91532 exit0且配对完整清除。类型/构建通过，纯UI修改无UI自动化。

本轮完整会话资格与上一轮367的固定预算失败分开保留。没有开发子agent、额外分支、版本更新或发布；持续自主迭代。
