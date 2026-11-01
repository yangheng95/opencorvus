# 执行、来源与成果体验证据

对应[调查与方案](../../records/2026-11/2026-11-02-execution-reading.md)。本人独立后台开发实例 `/ui/`，13张真实页面原图，逐张人工复核；没有UI自动化、截图基线或组件断言。

- [01-before-execution-sources-zh.jpg](01-before-execution-sources-zh.jpg)：改前：聚合webfetch最后URL与第一Source同排，看似配错。
- [02-before-two-sources-zh.jpg](02-before-two-sources-zh.jpg)：改前：展开后两份官方来源事实与顺序正确。
- [03-before-expanded-operation-zh.jpg](03-before-expanded-operation-zh.jpg)：改前：原始工具ID、原输入和结果。
- [04-after-streaming-actions-en.jpg](04-after-streaming-actions-en.jpg)：英文真实流式：2 actions/Read web page，来源独立占行。
- [05-after-actions-sources-zh.jpg](05-after-actions-sources-zh.jpg)：中文终态：操作名称本地化，单次读取仍保持紧凑布局。
- [06-after-two-sources-zh.jpg](06-after-two-sources-zh.jpg)：中文两份网页来源展开：标题/发布方/摘录/复制入口。
- [07-after-expanded-input-zh.jpg](07-after-expanded-input-zh.jpg)：中文展开操作：输入标题明确保留webfetch原始ID。
- [08-after-raw-tool-input-zh.jpg](08-after-raw-tool-input-zh.jpg)：中文原始输入：准确URL、format参数可读。
- [09-after-file-and-sources-zh.jpg](09-after-file-and-sources-zh.jpg)：当前Markdown直接预览；窄对话仍保留独立Sources行，另记录长网址表格可读性问题。
- [10-after-source-excerpt-zh.jpg](10-after-source-excerpt-zh.jpg)：真实来源原文摘录及独立复制入口。
- [11-after-history-member-zh.jpg](11-after-history-member-zh.jpg)：既有成员侧栏只读：聚合查找/运行命令/读取文件、来源与真实错误状态。
- [12-after-raw-tool-input-en.jpg](12-after-raw-tool-input-en.jpg)：英文展开输入：Input · webfetch与同一原始参数。
- [13-after-two-sources-en.jpg](13-after-two-sources-en.jpg)：英文来源组复制后确认，剪贴板为两行准确URL。

[验收结果](verification.json)记录前后各7个精确GPT-6.1 Sol流式HTTP200/EOF请求、两份Source与原工具归属、真实文件回读和两轮旧数据保护资格；[操作记录](actions.csv)对应原图。两个原native句柄均exit0、public shutdown200、物理与输出结清，配对认证/完整目录副本及每轮9个未用请求额度退休。未操作用户窗口或真实用户数据库。

后续事项：09所示窄Markdown表格含长网址时可读性仍差，下一批处理；生产者原始工具结果与未知扩展标识保留真实内容。
