# 记忆整理租约与失败收尾证据

关联[规格与Recall](../../records/2026-11/2026-11-28-memory-lease-settlement.md)。没有凭据、模型目录或来源私有配置内容；以下证据范围分别说明，不能互相冒充。

- [改前真实事务](before-expired-settlement.json)：自然过期后失败手回false，公开organizing及完整输入。修复后的聚焦服务测试在仓库`test/memory/project-memory-lease-settlement.test.ts`，验证retry_wait及下一版本。
- [共享物理租约到期](shared-physical-expiry.json)：12类目标自然到期后，新持有者实际获取/释放成功，物理期限合同独立。
- [独立进程事实](multiprocess-facts.json)：实际6个进程/SQLite，接替、已知失败释放、主动退出后的恢复及两个Project独立提交；2项16断言，原进程句柄均退出0。这是数据面检查，不是模型端到端。
- `run138-{north,south}-*`保存真实用户消息、read/publish工具及正式发表物/记忆；[原始字节包](original-bytes.zip)保留两份交接原件（north/handoff.md 153字节、south/handoff.md 159字节）和原CSV 59字节，逐成员与实际原件比较，避免Git文本换行转换改变原件。本人已阅读实际文档和记忆，模型英文原文保持；整理当时只有用户输入，不能将本轮发表结果算作已进入记忆。
- `run139-{north,south}-*`为真实服务重启后的同一数据，与138逐字节一致，见[重启和退役](restart-cleanup-facts.json)。[138流](stream-facts-run138.json)10条、[139流](stream-facts-run139.json)2条精确Sol均流式自然EOF、读者收敛，原5844/75717退出0，成对凭据/目录副本退役。
- `facts-run{138,139}.json`与`reference-facts-run{138,139}.json`保留原23文件/2725行/两个Task和23引用行的检查、真实59字节CSV读取合同；[原始字节包](original-bytes.zip)内CSV与[正式定位器](csv-locator.json)可核对实际输出。

11张原生截图均本人查看，未经图片编辑或像素比较：

|截图|实际复核目标|
|---|---|
|[02](02-north-work-rendered.jpg)、[03](03-north-source.jpg)|北仓正式中文文档、来源第3行陈晨及文件身份|
|[04](04-north-memory.jpg)|中文设置中的北仓正式记忆与版本1|
|[06](06-south-memory.jpg)|选择南仓后独立规则、版本1及项目路径|
|[08](08-south-work.jpg)、[09](09-south-source.jpg)|南仓正式文档、来源李青；09为面板展开过程中截获，不作为最终栏宽基线|
|[10](10-restart-south-work.jpg)|真实重启并重开后的南仓正式文档|
|[12](12-restart-south-memory-rendered.jpg)、[13](13-restart-south-memory-end.jpg)|重启后南仓记忆首尾、原日期、证据未知边界|
|[14](14-restart-north-memory.jpg)、[15](15-restart-north-memory-end.jpg)|同一设置页切北仓后正文首尾、版本及不同约定|

本批407标签已通过绑定API关闭，中文/系统主题保持；上批失去绑定的旧392标签仍未安全关闭，不能据本批退役记录声称所有历史页面已关闭。原Provider ECONNRESET原因未知；本批未故意制造真实模型失败，过期失败结论据事务/进程证据，正常模型任务据实际流和工具。
