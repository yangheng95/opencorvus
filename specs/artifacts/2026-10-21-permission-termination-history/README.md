# 权限历史系统终止语义修复

原真实已取消Task tsk_g00VYeMccK0078SroWDw的同一请求，在旧页面显示Reject/拒绝，现按同一账本决定显示Cancelled/已取消；两原批准仍为Allow Once/本次允许。唯一读投影新增termination元数据，唯一formatter复用现行语言资源，原决定/事件/时间/执行及schema不改。[完整调查](../../records/2026-10/2026-10-21-permission-termination-history.md)。

| 实图 | 人工观察 |
| --- | --- |
| [01 原英文](01-before-cancelled-shown-reject-en.png) | 原系统cancelled被展示为Reject |
| [02 原中文](02-before-cancelled-shown-reject-zh.png) | 同一请求显示拒绝；左侧有设置hover |
| [03 原中文清晰](03-before-clear-zh.png) | 移开hover后原失败 |
| [04 新英文](04-after-cancelled-en.png) | 同一请求Cancelled，两个原批准保持 |
| [05 新中文](05-after-cancelled-zh.png) | 同一请求已取消，两个本次允许保持 |

[原公开元数据](before-public-metadata.json)、[当前公开元数据](after-public-metadata.json)关联同一个immutable决定per_g0VYeVhyT00XzS04yhz9及原reason/时间，原interaction和Task终态保持；真实旧ETag请求200新body、当前ETag请求304，完整JSON对象身份随当前投影变化。原数据发现只有cancelled Task赢家和已有approval-retirement，[发现记录](before-discovery.json)保留。stale/实际denied的后端合同通过，没有虚构其历史UI样本。

[12项/331断言原验收](focused-contracts-corrected.log)：67请求/后代/并发取消、跨Project/重开/生产retry、stale同毫秒HTTP更新、实际denied原决策、两类批准事件顺序和Channel竞争。[首次新断言失败](focused-contracts.log)保留：错误按两个不同排序配对，修正为externalID精确身份核对，未修改生产排序或放宽身份。没有UI自动化测试。

[全仓typecheck](typecheck.log)8项成功；正式当前配置Node构建[before](build-before.log)/[after](build-after.log)，原服务都是Source CLI /ui。[数据保留](data-preservation-observation.json)覆盖每scope完整90表145033原行/所有字段/rowid或主键，源/副本0差异、schema3与完整配置保持、Provider activity364不变。

两套原[before物理结算](before-physical-terminal.json)/[after物理结算](after-physical-terminal.json)覆盖68133/native77296与86358/native75012的publicshutdown200、物理/output/request/launcher/精确出生；IAB81/82均关闭。两份Provider audit真实0/max0/exhausted false；没有凭据或模型目录复制。图中模型配置不可用属于明确零模型隔离阅读范围，未借此声称Provider/执行重放验收。

当前[安全公开合同](../../current/architecture/security-permission.md)描述唯一账本派生元数据；历史无需迁移或重写即可显示正确原因。用户数据库及18571进程窗口未操作，版本不变。Rendering并发/重连/连续帧、Main回收触发与149目录完整性能等仍在长期迭代范围。
