# 2026-10-13 来源文件保存换行371

[Recall](../../artifacts/2026-10-05-connection-workspace-authority/source-line-endings-plan-371.md) / [证据](../../artifacts/2026-10-05-connection-workspace-authority/source-line-endings-371/README.md)。单agent实页复现CRLF/CR/混合换行小幅编辑保存后全部变LF，修复共享CodeEditor唯一序列化边界。格式随真实ChangeSet和原生Undo/Redo保留，无重复全文或自建历史。

16项纯文本数据合同、类型、正式构建、docs及架构索引通过；改前4图、改后12图人工复核，真实Source文件逐个键盘编辑保存、增删换行、撤销/重做、仅格式重载及重复定位，完整磁盘字节吻合预期。真实Provider各5流式EOF，两固定600000ms scope实际162056/315960ms、原54003/30476均exit0，页面及物理/request/output/auth-models pair均关闭。

纯CR搜索坐标使用rg行定义，与编辑器的CR行定义不同，下一轮继续调查；非UTF-8编辑、CodeArtifact具体页面不扩称已实测。未改版本、未发布。完成范围提交、fresh fetch/merge和普通push后继续目标。
