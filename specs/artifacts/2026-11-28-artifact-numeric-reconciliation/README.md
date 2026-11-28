# 交付物数值交叉核对证据

对应[根因、影响及结果](../../records/2026-11/2026-11-28-artifact-numeric-reconciliation.md)。共享数值核对指导进入真实Chat/Work及发布工具；两组不同新金额的真实任务首次回复通过本人逐项核对。证据不代表所有模型算术永不出错。

- `01`—`04`原生截图：北仓首次完整六行与分类/全量净额17.65、金额升序、退款两行、清除恢复六行。`05`—`07`：南仓首次完整五行与净额6.00、零额样品一行、清除恢复五行。全部原图本人查看，未做像素、DOM、文案或组件自动化断言。
- `numeric-data-facts.json`、两组`artifact.json`：实际API（Application Programming Interface，应用程序接口）与持久化交付物一致；逐行编号、类型、带符号金额对150/127字节原CSV（Comma-Separated Values，逗号分隔值），独立Decimal得北仓普通23.65/退款−6/样品0共17.65，南仓10/−4/0共6，记录数6/5。
- 两组`public-messages.json`、`execution-facts.json`：实际read→publish_interactive_artifact→stop与首次回复；仅从证据投影排除不透明Provider（模型提供方）推理/协议元数据，产品原消息不改写。两组`task.json`含真实请求、URL（Uniform Resource Locator，统一资源定位符）与在请求前独立算出的事实，正确答案未放入模型请求。
- `actual-request-projection-facts.json`、`stream-facts-run154.json`：10条精确gpt-6.1-sol流均HTTP（Hypertext Transfer Protocol，超文本传输协议）200并读到EOF（End Of File，流结束）。6条Work请求的新指导实际位于`/instructions`和`/tools/25/description`。不以源码摘要验收。
- `historical-identity-facts.json`、`facts-run154.json`、`reference-facts-run154.json`：8个完整历史API对象保持，包括原26错误及真实更正18；保护23文件、2995旧五表行、2完成Task（任务）/23任务行/59字节原资源，SQLite完整性正确。两个项目记忆分别v9/v6空闲、待处理与丢弃数0，记忆正文是否完整表达最终助手结果不在本批通过范围内。
- `runtime-cleanup-facts.json`：原19013句柄退出0，流排空，成对凭据/模型目录副本和51776端口退役，自有439标签实际关闭，中文/系统主题保持。
- `original-bytes.zip`保留原输入、旧业务输入和人工可访问性树观察字节，防止Git（版本控制工具）换行转换；`archive-facts.json`列出成员字节数。完整数据库、私有项目配置、凭据及模型目录不入仓库。
