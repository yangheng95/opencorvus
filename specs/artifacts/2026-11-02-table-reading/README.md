# Markdown 表格阅读证据

对应[调查与方案](../../records/2026-11/2026-11-02-table-reading.md)。21张本人独立真实开发页面原图，逐张人工复核；无UI自动化、截图基线或像素断言。

- [01-before-real-document.jpg](01-before-real-document.jpg)：真实Sol文件基线：标题/用途被长网址挤压。
- [02-before-reading-cases.jpg](02-before-reading-cases.jpg)：合成短表与网址表基线。
- [03-before-identity-columns.jpg](03-before-identity-columns.jpg)：长身份旁说明列基线，完整身份仍保留。
- [04-after-real-document-en.jpg](04-after-real-document-en.jpg)：首次after真实文档：三列可读且无需横滚。
- [05-after-source-view-en.jpg](05-after-source-view-en.jpg)：Source仍展示完整原URL及正文。
- [06-after-real-document-wide-en.jpg](06-after-real-document-wide-en.jpg)：首次after宽面板。
- [07-after-real-document-wide-zh.jpg](07-after-real-document-wide-zh.jpg)：首次after中文宽面板。
- [08-after-real-document-narrow-zh.jpg](08-after-real-document-narrow-zh.jpg)：首次after中文窄面板。
- [09-after-reading-cases-zh.jpg](09-after-reading-cases-zh.jpg)：首次after发现真实对齐失败：数量/状态仍左对齐，未当作通过。
- [10-final-real-document-en.jpg](10-final-real-document-en.jpg)：最终独立构建的真实Sol文档。
- [11-final-reading-alignment-en.jpg](11-final-reading-alignment-en.jpg)：最终短表左/右/居中与长网址阅读。
- [12-final-identity-keyboard-scroll-en.jpg](12-final-identity-keyboard-scroll-en.jpg)：原生方向键到达完整身份末尾与说明列。
- [13-final-wide-table-start-en.jpg](13-final-wide-table-start-en.jpg)：八列表格首列、数量右对齐与后续正文。
- [14-final-wide-table-keyboard-end-en.jpg](14-final-wide-table-keyboard-end-en.jpg)：Tab进入后15次原生右键到末列876-A/B，焦点可见。
- [15-final-wide-table-pointer-return-en.jpg](15-final-wide-table-pointer-return-en.jpg)：指针横向滚动回首列，原文档正文可读。
- [16-final-existing-main-table-en.jpg](16-final-existing-main-table-en.jpg)：旧真实主对话统计表，3/3/2右对齐。
- [17-final-existing-member-table-en.jpg](17-final-existing-member-table-en.jpg)：旧成员上下文及表格尾部。
- [18-final-member-table-start-en.jpg](18-final-member-table-start-en.jpg)：旧成员表头与长正文首行。
- [19-final-member-table-end-en.jpg](19-final-member-table-end-en.jpg)：旧成员表格本地横滚后完整长代码/正文。
- [20-final-real-document-zh.jpg](20-final-real-document-zh.jpg)：最终中文文件预览。
- [21-final-sources-and-table-zh.jpg](21-final-sources-and-table-zh.jpg)：最终两来源展开/复制和文件表格同时可用。

[验收结果](verification.json)与[动作记录](actions.csv)区分baseline、保留对齐失败的首次after、最终新occurrence。资料包含原Sol真实文件/旧主对话/旧成员消息，以及明确手动合成的短表和宽表。本轮三阶段均0模型请求，不冒充新模型执行。Source/Preview、原文下载、真实链接打开、方向键/Tab/指针、数字对齐及两来源复制均手动验证。

三阶段原native句柄exit0/public shutdown200，物理、输出和请求结清；6个配对副本退休。schema9/92表和全部旧业务行/项目Git及文件/227附件受保护，没有操作用户窗口或真实用户数据库。宽表和长代码仍通过原生局部横滚查看所有原内容；只验收桌面面板，不宣称移动端。
