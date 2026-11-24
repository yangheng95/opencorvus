# 保存成功后原操作报告忙碌的桌面证据

基线由实际服务提供 `main-CQOC7kb7.js`，操作对象为临时 Git 项目的独立空白会话和文本文件。本人查看真实桌面视口。

| 实际操作 | 观察 |
| --- | --- |
| [从资源管理器提交存在未保存正文的改名](baseline-unsaved-decision.jpg) | 原提示指向准确的 `notes/checklist.txt`。 |
| [实际保存后的原改名表单](baseline-save-committed-rename-busy.jpg) | 输入保留，真实忙碌诊断出现，后台读的数据仍暂缓交付。 |
| [交付后台读再提交原表单](baseline-explicit-retry-settled.jpg) | 文件改名结果正常，准确新行持焦。 |

[实际中转记录](baseline-transport.jsonl)保留已提交写入、被暂缓读取、释放和修改路径的原始请求身份。保存后、重试前，原磁盘路径仍为 `notes/checklist.txt`，实际正文已有 `First saved note.`。[重试后实际读取](baseline-actual-file.json)记录正确新文件和两个真实目录成员。
