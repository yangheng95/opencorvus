# 跨工作表结算核对证据

对应[根因、方案与真实结果](../../records/2026-11/2026-11-28-cross-sheet-settlement-review.md)。修复模型参数声明与运行时公式单元格校验的不一致；保留基线首错及恢复，候选新任务首次read→publish→stop成功。CSV（Comma-Separated Values，逗号分隔值）保存当前值，未宣称保存工作簿公式。

- `01`—`06`原生截图为基线发表错误、原始/分类表、现有列宽操作和15.20→16.20后跨表重算；`07`—`11`为候选首次发表、初值、源编辑、分类24.65/全量18.65及最终正文。11原图全部本人查看，无UI（User Interface，用户界面）自动化断言。03/08窄列表头的裁剪是原生初始状态，04/10显示现有调整列宽后的完整内容。
- 两份`sheet-artifact.json`与`sheet-data-facts.json`：实际API（Application Programming Interface，应用程序接口）和持久化原始行/八条跨表公式/缓存核对，独立Decimal（十进制）检查17.65原总额，四份原生下载核对16.2/24.65/18.65；发表原件保持初始数据。`original-bytes.zip`保存8业务输入、原始请求、4下载及人工可访问性观察字节，原图未经处理。
- `actual-cell-schema-facts.json`记录实际1条Chat预检与3条Work请求携带的两分支单元格参数形状；`publication-declaration-facts.json`明确实际tools[].strict为false。根因是本地参数声明required（必需）/null形状和规范二选一约束冲突，不伪称远端开启严格生成。`execution-facts.json`保留基线两次发表error/completed和候选首次completed事实。
- 两份`public-messages.json`保留真实用户、助手与工具记录，基线失败完整可见；仅从证据投影排除不透明Provider（模型提供方）推理/协议元数据，不改产品消息。`validation-facts.json`记旧声明正向失败、修复后33后台案例78断言与46纯导出案例51断言、SDK（Software Development Kit，软件开发工具包）事务重建/类型/Node构建和文档检查。
- `historical-payload-read-facts.json`：60旧交付物含3旧电子表格经当前API完整读取，载荷与原持久数据一致。两份`facts-run*.json`及资源事实核对原23文件/3035旧行/2完成任务/23任务行/59字节资源、SQLite完整性。8业务输入保持，记忆v11空闲、待处理/丢弃0。
- 两份`stream-facts`证明14次精确gpt-6.1-sol流均200/EOF（End Of File，流结束）；`runtime-cleanup-facts.json`记录原31371/29650句柄加入退出0、流排空及成对副本/端口退役、自有443/447标签关闭。旧392/428未绑定，不宣称关闭。凭据/模型目录、私有项目配置、全数据库不归档。
- 局限：真实候选只覆盖这一组首次发表与跨表公式链；结构识别仅适用于唯一可判定封闭对象联合，不推测多义输入。不声称所有模型、公式、持久编辑或Office工作簿均已验收。
