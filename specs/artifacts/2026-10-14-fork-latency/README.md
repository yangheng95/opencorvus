# 长历史分叉耗时证据

见[Recall、共享根因与剩余调查](../../records/2026-10/2026-10-14-fork-latency.md)。本批已改善共享持久事件投递对主线程的连续占用，**复制总耗时低于5秒尚未达成**，持续goal保持active。没有再次重建用户数据库。

## 真实运行结果

固定主Session `ses_-zUS2EY0ezzjFidQwBy1`的38消息、37份已完成正文、36次read和36组真实行范围；它们来自同一144行README，复制不产生新的工具执行或研究来源。

| 运行 | POST耗时 | 全部目标phase回执可见 | 复制窗口health | 资格 |
| --- | ---: | ---: | --- | --- |
| before | 15504ms | 本轮未全程采样 | 单次并发15479ms | 实际阻塞及浏览器超时 |
| timing-02 | 9826ms | 本轮未全程采样 | 8.72ms，发生在同步热点前 | 精确事务热点 |
| after（每批64写入） | 7490ms | 7604ms | 32次，最大374ms | 响应改善，总耗时未达标 |
| after-256（当前实现） | 7660ms | 7745ms | 22次，最大614ms | 响应改善，总耗时未达标 |
| commit（当前实现及额外被动计时） | 9095ms | 9187ms | 26次，最大804ms | 进一步定位提交成本 |

原始[复制前HTTP记录](copy-health-before.json)、[64写入后态](copy-settlement-after.json)、[256写入后态](copy-settlement-256.json)、[额外提交计时后态](copy-settlement-commit.json)和[只读事实检查](checked-facts.json)。后三次均为263个publication、789份exact/wildcard/global回执。最早[health-before](health-before.json)在UI操作之前结束，不能用于证明复制窗口响应。最后一次正式服务[请求日志切片](side-chat-request-timeline.json)与HTTP记录相符；早轮dev.log随后被开发服务覆盖，不能把当时观察到的UI请求毫秒值当成现存原始日志。

原始根因是4676次外层事务中的6114ms提交；源复制唯一事务仅291ms。[原计时](transaction-analysis.json)、[64批次](transaction-after-analysis.json)、[256批次](transaction-256-analysis.json)分别保留统计。当前256批次的22次投递提交仍需3868ms，增大批量没有消除剩余成本。[提交细分](transaction-commit-analysis.json)记录真实WAL、NORMAL、1000页自动checkpoint，提交4558ms中系统CPU时间3875ms。日志回写是待进一步确认的候选；本批没有修改SQLite同步级别、checkpoint或持久化格式。

## 人工视觉复核

- [01创建前](01-before-create.jpg)、[02创建中](02-creating.jpg)、[03完成](03-copy-complete.jpg)：复现长历史侧聊创建及原阅读位置。
- [04后态创建前](04-after-before-create.jpg)、[05后态创建中](05-after-creating.jpg)、[06后态完成](06-after-created.jpg)：64批次保持R06—R08和38条引用。
- [07当前实现创建前](07-256-before-create.jpg)、[08准备引用中](08-256-creating.jpg)、[09当前实现完成](09-256-created.jpg)：实际Side 10→11创建期间保持Online，主区正文/来源行号及早段阅读位置可见，侧栏返回38条引用。英文产品控件与中文用户/模型原文保持各自真实语言。

以上通过隔离正式`/ui`页面进行真实交互并查看截图，不运行UI自动化。本批没有UI源码改动；成员面板Rendering闪烁、多种来源组合和更大历史规模仍须独立验收，不能从侧聊副本推断已全面修复。

## Provider与物理结算

五次成功服务共18次真实`gpt-6.1-sol`流式请求，全部200/EOF。每次正式动作前分别确认凭据usable、目录projected及actualModel完全一致。每个独立服务预算8次、600秒物理租约；后者不用于性能通过判定。第一次timing包装器违反原生只读属性约束，启动TypeError/exit1，修复包装器并通过真实SQLite四模式检查后才重跑；保留失败事实。

原始文件按其原名归入各`run-record.json`：[before](before/run-record.json)、[timing失败](timing/run-record.json)、[timing-02](timing-02/run-record.json)、[after](after/run-record.json)、[after-256](after-256/run-record.json)、[commit](commit/run-record.json)。每份包含原Host/Target身份、终态、输出/请求结算及auth/models配对退休证据。原句柄60910、66724、76222、54062、70463均已join exit0，失败timing原Target90508退出1；不存在留待后续替代结算的自有服务。本批关闭了所有自有验收页。

大文件以gzip原样压缩保存：例如[原CPU profile](before/before.cpuprofile.gz)、[原事务记录](timing-02/transaction-timings.json.gz)、[当前额外计时](commit/transaction-timings.json.gz)。不采集堆快照、SQL参数或凭据内容。完整[文件索引](evidence-index.json)只列路径，不使用可变源码摘要作验收。

## 后台验证与边界

- [初次Bus](focused-first.log)：13项/46断言；[当前批次和四个真实进程](focused-256.log)：14项/78断言。
- [原子复制/事务/跨进程](physical-and-atomic.log)：10项/63断言；[Task终态和Mission跨进程](task-mission-regression.log)：10项/27断言。去除重复用例后共33项；这些是后台实际SQLite及物理控制路径，不冒充OpenAI端到端或视觉资格。
- [Backend typecheck](typecheck-first.log)及[文档检查](docs-check.log)通过。
- [事实检查脚本](check-facts.ts)以实际数据库和原始审计记录检查：当前版本1、12个侧聊中11个完整引用副本的工具/消息绑定及源payload、全部18条真实流与服务清理。第一份早期空引用副本记录其创建边界。

下一批继续确认日志回写页数与提交成本，并在完整生命周期/恢复合同下修复；不放宽5秒目标，不将本批响应改善描述为长历史复制性能完成。

## 追加：已确认同步日志回写成本

`b3fb10aad`提交后正常推送的[原hook日志](push.log.gz)显示整仓类型/迁移检查通过，但另一组尚未完成SDK生成的Question接口工作使路由检查失败。保留工作区来源，不覆盖其生成事务，不跳过hook。

随后只读观测的[真实WAL-index与提交记录](transaction-wal-analysis.json)证明：10次慢提交合计4700.682ms，每次在相同WAL salt下，nBackfill由0变为mxFrame，实际回写1079—1763页；两份头一致。不是单纯从文件大小猜测checkpoint。实际[公共复制及全回执](copy-settlement-wal.json)9678/9775ms、health最大908ms，5秒目标仍未达成；[原服务请求](wal-request-timeline.json)已在dev.log覆盖前保留。

新增[机制探针](wal-index-preflight.json)只验证被动字段读取，不能替代产品事实；[采样器](wal-index.ts)按SQLite公开格式读取前100字节，不写内存/文件、不获取SQLite锁、不执行checkpoint。完整[本轮原记录](wal/run-record.json)、[压缩原始事务记录](wal/transaction-timings.json.gz)、[追加只读检查结果](checked-facts-wal.json)与[检查器](check-wal-facts.ts)单独保留，前述旧记录保持原观察时点。

累计六次成功服务21条Sol真实流全部200/EOF，另一个诊断启动失败保留；当前13个侧聊中的12个完整引用副本身份与Source payload通过，第一份仍为首个回复完成前的空引用。原Target61484/Host整体与配对清理已结算，原服务72943/API取证9985均join exit0。没有新增UI视觉资格或生产修改。下一批先审共享Database生命周期并设计唯一回写策略；本批仍使用原同步/自动checkpoint配置。
