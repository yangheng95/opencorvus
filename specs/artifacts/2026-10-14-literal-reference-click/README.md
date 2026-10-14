# 正文文件链接原始路径证据

[方案与Recall](../../records/2026-10/2026-10-14-literal-reference-click.md)。单开发agent，实际开发服务/ui，原始文件、自然产生的消息与来源，六张截图已人工查看；无UI自动化测试。

| 证据 | 实际结果 |
| --- | --- |
| [01 真实链接](before/01-real-links.jpg) / [02 修前误开](before/02-wrong-file-open.jpg) | 带空白链接属性保留原文件身份，点击却显示普通文件内容 |
| [03 加载帧](after/03-literal-file-open.jpg) / [04 加载完成](after/04-literal-file-loaded.jpg) | 03仅为中间帧；04显示IDENTITY_LEADING_NBSP_423及第1行 |
| [05 普通对照](after/05-plain-file-open.jpg) / [06 原始来源](after/06-source-file-open.jpg) | 普通链接与带空白Source各自准确打开对应文件 |

`facts/`为只读SQLite业务轮次、两个实际文件内容及身份、前后逐字段比较和Provider摘要。相同4条业务消息、2个来源及工具结果保留；数据库版本2。9条实际Sol流均HTTP200/settled，其中7条eof、2条memory在公开关闭时aborted，业务最终自然finish=stop。`before/`和`after/`保留原生服务资格、完整终态、公开shutdown、配对退休、人工观察及运行脚本，凭据内容未归档。

纯文件引用解析21项/29断言、正式Node构建、文档和架构检查通过，命令原件在`checks/`。它们不代替真实点击和视觉检查。真实厂商原生编辑器窗口、完整复制粘贴及新的长回复侧栏流式均不在本轮通过范围。
