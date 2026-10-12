# 2026-10-13 历史来源与短文件光标369

[Recall](../../artifacts/2026-10-05-connection-workspace-authority/source-shortened-file-plan-369.md) · [改前改后真实证据](../../artifacts/2026-10-05-connection-workspace-authority/source-shortened-file-369/README.md)。

自主检查后实页复现：真实40:10来源生成后文件缩为两行，首行输入x导致光标被拉到末行，下一字符y落错。根因是CodeEditor以行数不足当加载未完成，当前FileEditorPane已有唯一加载owner，该代理使reveal身份永不结束。删除过期settled字段和条件，完成可见文档的夹取定位，后续输入保持光标。

改后同样操作得到首行xy、末行完整；重复点击、隐藏返回和恢复原40行后的正常定位通过。12张图人工复核，真实Source前后记录及文件完整字节/ToolOutcome/完成顺序由实际checker核对。两个scope共10 Sol流式EOF，原11707/17567 exit0，Native147137/187296ms及配对清除通过；改前UI失败独立保留。类型/构建通过，无UI自动化测试、开发子agent、版本更新或发布。
