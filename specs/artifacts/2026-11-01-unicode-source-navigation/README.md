# Unicode Sources 真实定位验收

[Recall与实际过程](../../records/2026-11/2026-11-01-unicode-source-navigation.md) · [脱敏回执](verification.json)

本轮没有发现新的定位缺陷，生产代码改动为零。真实GPT-6.1 Sol搜索三文件并产生三条原始Sources，随后直接检验编辑器光标和独立重启后的同一自然消息。八个后端真实ripgrep正向用例通过；实际模型请求5，全部流式200/EOF，重启复验0请求。

| 原始输入 | 显示行:列 | 从真实光标到行末复制并粘贴 |
| --- | --- | --- |
| [中文定位.md](inputs/中文定位.md) | 2:6 | `NEEDLE_847_ALPHA 尾文` |
| [字节序标记.md](inputs/字节序标记.md) | 1:5 | `NEEDLE_847_BETA 终` |
| [混合换行.md](inputs/混合换行.md) | 3:5 | `NEEDLE_847_GAMMA 完` |

输入保留真实UTF-8 BOM和混合CR/LF字节；不是供agent执行的指令。三个后缀均在原生编辑器真实Shift+End、复制、粘贴到自有未发送草稿后人工确认，随即清空；不以模型自述、行色带或DOM文本代替光标验证。

| 实图 | 内容 |
| --- | --- |
| [01](01-real-sol-preflight.jpg) | 明确GPT-6.1 Sol的真实可见预检回复。 |
| [02](02-real-search-three-sources.jpg) | 原search_code与三来源及模型原回答。 |
| [03](03-chinese-emoji-caret-suffix.jpg) | 中文/emoji来源点击后的原件及实际光标后缀。 |
| [04](04-bom-caret-suffix.jpg) | 保留BOM的原件及准确BETA后缀。 |
| [05](05-mixed-newline-caret-suffix.jpg) | 混合换行显示第3行及准确GAMMA后缀。 |
| [06](06-bom-original-zh.jpg) | 中文原件、控制字符与来源列号。 |
| [07](07-original-excerpt-zh.jpg) | 原来源绑定的中文保存摘录。 |
| [08](08-restarted-chinese-caret-zh.jpg) | 独立重启后同一中文/emoji来源的准确光标。 |
| [09](09-restarted-bom-caret-zh.jpg) | 重启后同一BOM来源的准确光标。 |
| [10](10-restarted-mixed-caret-zh.jpg) | 重启后同一混合换行来源的准确光标。 |

十张真实JPEG均已亲自查看，没有UI自动化、截图基线或像素比较。数据schema始终9，旧业务行和原文件/Git保全，125保护附件保持；自有50/51页关闭，两个原服务物理退出与配对凭据副本退休，用户页/进程/数据库未操作。结论只覆盖本轮真实场景和明确后端契约，不外推所有Unicode或其他工作流。
