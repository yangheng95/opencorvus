# 保存成功后原操作报告忙碌的桌面证据

基线由实际服务提供 `main-CQOC7kb7.js`，操作对象为临时 Git 项目的独立空白会话和文本文件。本人查看真实桌面视口。

| 实际操作 | 观察 |
| --- | --- |
| [从资源管理器提交存在未保存正文的改名](baseline-unsaved-decision.jpg) | 原提示指向准确的 `notes/checklist.txt`。 |
| [实际保存后的原改名表单](baseline-save-committed-rename-busy.jpg) | 输入保留，真实忙碌诊断出现，后台读的数据仍暂缓交付。 |
| [交付后台读再提交原表单](baseline-explicit-retry-settled.jpg) | 文件改名结果正常，准确新行持焦。 |

[实际中转记录](baseline-transport.jsonl)保留已提交写入、被暂缓读取、释放和修改路径的原始请求身份。保存后、重试前，原磁盘路径仍为 `notes/checklist.txt`，实际正文已有 `First saved note.`。[重试后实际读取](baseline-actual-file.json)记录正确新文件和两个真实目录成员。

## 候选验收证据

| 实际操作 | 可见结果 |
| --- | --- |
| 主项目通过原确认进行真实保存和改名 | [原保存决定](verified-save-confirmation.jpg)、[一次确认后的成功新行](verified-first-save-and-rename-succeeded.jpg)、[显式打开新文件验证第一条草稿](verified-first-save-persisted-in-new-file.jpg)。 |
| 同时打开不同项目的同名文件 | [独立未保存草稿](verified-unrelated-project-draft.jpg)和[单独点击 Save 后的实际保存](verified-independent-manual-save.jpg)。主项目操作后、对照手动保存前的[真实对照读取](verified-control-before-own-save.json)仍是对照自己的原文。 |
| 保存后遇到实际 409，再更正目标 | [原接口冲突反馈](verified-real-conflict-after-save.jpg)、[更名成功与焦点](verified-conflict-retry-retains-focus.jpg)以及[最终准确路径和三行正文](verified-final-file-after-retry.jpg)。 |

[真实请求顺序](verified-transport.jsonl)含写入、改名、冲突及后台重读在不同路径的实际请求身份。第一次暂缓的是改名后的新路径，第二次在真实冲突释放后才暂缓原路径。[最终文件事实](verified-file-receipt.json)包含主项目结果、冲突对照及独立项目的实际正文和磁盘目录。[隔离数据库](verified-isolation.json)记录准确会话范围、完整性和模型活动。
