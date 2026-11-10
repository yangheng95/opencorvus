# 文件编辑器首次读取失败实页证据

对应[根因和方案](../../records/2026-11/2026-11-10-file-editor-first-read-error-focus.md)。基线本人目视检查首次读取失败、键盘顺序、重试等待与真实恢复、用户主动移焦和健康第二文件。代理只控制本批隔离文件的真实读取交付。

- [基线：首次失败后的下一个 Tab 落到不可用的保存按钮](baseline-en-next-tab-disabled-save.jpg)
- [候选：英文首次失败直接到 Retry](candidate-en-first-read-retry-focus.jpg)、[回车后等待](candidate-en-retry-holds-focus.jpg)、[完整读取回到原文字和编辑器](candidate-en-retry-restores-source.jpg)
- [候选：中文延迟失败保留主动移到的对话输入](candidate-zh-delayed-first-failure-keeps-composer-focus.jpg)、[再次打开时重试接焦](candidate-zh-first-read-retry-focus.jpg)、[保留实际解析诊断](candidate-zh-details-original-diagnostic.jpg)
- [真实读取、隔离数据和服务关停回执](receipt.json)
