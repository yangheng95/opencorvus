# 短期原生查询作用域：局部收益与交付边界

[修改前分析、原失组及实施方案](../../records/2026-10/2026-10-21-native-query-scope.md)。490单agent；Bun1.4.0，原149目录和Git2.45.1.windows.1。仅自有scratch的Rust副本、隔离进程和证据归档；**生产代码未改，完整配置性能未达成，也没有本批UI（User Interface，用户界面）资格**。无Provider、凭据或模型目录副本、模型请求或用户18571/数据库操作。

## 原始实测

[交错矩阵](matrix.json)，每组原149目录/148 Git/1非Git、并发12、两次独立查询，stdout/stderr全部逐项等于[489原296个真实输出](original-git-outputs.json.gz)，设备/inode/realpath新鲜比对通过。每组注册目录循环44402次stat+44402次realpath；不包含输入基线与输出资格的额外读取，不称作全部系统调用。

| 原组 | 墙钟ms | 原生helper数 | 最大主线程计时间隔ms |
| --- | ---: | ---: | ---: |
| [single-c](single-c-result.json) | 17468.243 | 296 | 247.252 |
| [scope-c](scope-c-result.json) | 11117.909 | 1 | 50.925 |
| [scope-d](scope-d-result.json) | 11194.090 | 1 | 75.609 |
| [single-d](single-d-result.json) | 17921.683 | 296 | 359.920 |

每个scope仍有296个真实Git目标/Job、逐请求持久化request/helper/ready/settled与独立stdout/stderr；单个helper只活到这批请求和输出join完成，不保存已完成查询结果、不固定延迟合批、不创建长期daemon。不用计时间隔替代UI帧或页面视觉验收。

四组共1184查询、594helper。原修复前[single-a](single-a-result.json)为17963.967ms/296helper；紧接的[scope-a失败](failed-scope-a.json)148Git启动尝试失败、1非Git完成，原launcher exit1保留在[原始日志](scope-a.log.gz)。原型漏了生产已有whichAsync可执行文件解析，补回原解析规则后重新分配并运行完整交错矩阵；不把失败组混入有效性能对照。首个脚本未在聚合断言前落盘per-request结果，因此该历史组具体Win32错误码缺失，不能重建；修复后raw结果在断言前保存。成功真实Git观察总1480，另148次启动尝试，合计1628；不把失败尝试称作已执行Git输出。

## 正向合同与真实生命周期

[十项聚合合同摘要](contracts-summary.json)、[基础完整原记录](contracts-result.json.gz)、[生命周期完整原记录](lifecycle-result.json.gz)。原50查询上限实际12（含原单请求模式），38未用额度已退休，模型0。覆盖真实Unicode/空格/引号/尾斜杠参数、cwd和逐查询ceiling、非空双流、快查询在慢同伴仍活跃时独立EOF（End Of File，流结束）、明确CreateProcess失败与同伴成功、主动取消、静默inactivity_timeout、持续实际bytes刷新窗口、output_limit和原Process.runHost单请求。

活动查询收到scope输入EOF后仍完成原查询/输出分支并正常关闭；另一个原Bun owner按精确PID（Process Identifier，进程标识）/出生时间主动结束后，原helper通过owner句柄终止每项Job，target及孙进程都证明dead_or_reused，原active_processes=0标记完整。owner已死时不能履行它原来的JavaScript输出/response分支，本记录不伪称该分支成功或公共孤儿恢复已合格。

多查询管道使用微软[明确继承句柄列表](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute)；父读取端不可继承，创建后关闭自己的子写端。每项env块独立，原父PID/出生身份、悬停时原子Job准入和active-process-zero监管保留。只有真实参数/bytes/退出/原marker/后代身份合同通过，不以静态源码字符串代替行为。

[八个原scope完整收尾](physical-scopes.json)：七个原exit0、原失败scope-a exit1；各自4分钟资源边界未延长/重启，原native物理/output/request/launcher均结算且原host/target已dead_or_reused。[原数据保留](source-preserved.json)：schema3/integrity ok，149 Project/198 Session/518 Message/1155 Part/1407 protocol/119 request/119 outcome共3665行，所有rowid/字段/时间与库bytes/mtime保持。

## 决定与限制

局部负载稳定减少约6秒，仍为11秒，不能通过保存10秒/完整恢复5秒的原指标。当前不推广新传输到生产，也不宣称原完整Config服务→HostTransport→公开HTTP（Hypertext Transfer Protocol，超文本传输协议）checker已通过。所有Host/Task/Mission/Session occurrence、shell/detached/SDK（Software Development Kit，软件开发工具包）、worker崩溃/损坏帧/公共重启恢复尚未获得新资格；私有原型也在最终响应中收集输出，不能当公共流式Process适配器直接替换。

原先已排除的worker数、文件系统API切换、同轮次合批、缓存/删新鲜检查不重试。本结果证明逐条helper启动是部分成本，剩余成本的关键依赖仍未知；下一步必须先用原执行链的分段证据区分真实目标创建、持久化和物理核验等待，不从累计重叠值猜剩余根因。长期Goal继续active。

各摘要的相邻同名`.json.gz`保存原完整bytes；解压逐字节相同只证明归档保存，不是功能/性能验收。副本源代码快照为[native-main.rs.txt.gz](native-main.rs.txt.gz)，构建Cargo输入、准备/调用/测量/验证脚本相邻；未提交native可执行文件、完整私人业务历史或数据库。
