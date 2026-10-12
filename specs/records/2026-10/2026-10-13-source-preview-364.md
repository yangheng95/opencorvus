# 2026-10-13 文件来源匹配行预览

[Recall](../../artifacts/2026-10-05-connection-workspace-authority/source-preview-plan-364.md) · [证据](../../artifacts/2026-10-05-connection-workspace-authority/source-preview-364/README.md)。单agent改进真实搜索文件来源的内容辨认。

此前同一文件多处命中只有重复文件名/行号，必须打开文件或工具输出才能知道各处内容。根因是search_code有真实lineText，但fileSource/schema没有保存这条事实。现在同一处有界且已处理内联载荷的匹配文字同时进入工具输出和Source；Source保持原路径/范围身份，历史消息不回填。现有2000 UTF-16编码单元预算在完整字符边界截断，修复截开emoji的真实问题。SDK类型/OpenAPI由正常生成器更新。

文件预览放在原Tooltip内，沿用本地化“来源摘要”，最多四行，文字按原文呈现。紧凑来源列表不增加逐条展开控件，网页来源保留原完整摘要阅读区。真实Main/Side中英、键盘与指针、长行、原始空白、markup、不同目录、正确文件行导航、折叠/展开均有手动截图；复制按钮反馈通过，但359首次复制边界问题仍明确未知。

改前真实工具测试12通过/2失败，修复后23聚焦正向契约通过；SDK生成、全类型8/8、overlay build、公共renderer检查和CSS token检查通过。实际SQLite/ToolOutcome/输入文件checker逐值验证22个Source（Main10、Side继承10、新增2），9次真实gpt-6.1-sol请求全部流式EOF。单一NativeService18364固定600000ms，实际432207ms内正常退出，原launcher82701join exit0，输出/请求/配对凭据清理合格。14张截图亲自查看，未运行UI自动化断言。

此轮不更新版本或发布。持续目标保持active，后续继续单agent自主体验和修复。
